"""API REST del detector de intrusiones del Proyecto DAM.

Ejecutar con: uvicorn api:app --reload
"""
import ipaddress
import os
from contextlib import asynccontextmanager
from pathlib import Path
from typing import List

import joblib
import pandas as pd
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field, field_validator

from logtools import cargar_lineas, construir_features

RUTA_MODELO = Path(os.getenv("MODELO_PATH", "modelo.joblib"))
# Un auth.log generado con el kit tiene entre 12.000 y 16.000 líneas: el límite debe admitir un log completo.
MAX_LINEAS = 50000
RUTA_INTERFAZ = Path(__file__).resolve().parent / "interfaz"
modelo = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Carga el modelo una sola vez cuando arranca la API."""
    global modelo
    if not RUTA_MODELO.is_file():
        raise RuntimeError(
            f"No se encuentra el modelo: {RUTA_MODELO}. "
            "Ejecuta antes entrenar.py para generarlo."
        )
    modelo = joblib.load(RUTA_MODELO)
    yield
    modelo = None


app = FastAPI(
    title="Detector de intrusiones",
    description="Analiza líneas de auth.log y devuelve las IP sospechosas. No bloquea IPs.",
    version="1.0.0",
    lifespan=lifespan,
)

# Integración con la interfaz: permite llamadas desde otro origen (por ejemplo, index.html abierto desde el disco).
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


class SolicitudAnalisis(BaseModel):
    lineas: List[str] = Field(..., min_length=1, description="Líneas del archivo auth.log")
    umbral: float = Field(default=0.7, ge=0, le=1, description="Umbral de sospecha entre 0 y 1")
    lista_blanca: List[str] = Field(default_factory=list, description="IPs que nunca se marcarán como sospechosas")

    @field_validator("lineas")
    @classmethod
    def validar_lineas(cls, lineas):
        if len(lineas) > MAX_LINEAS:
            raise ValueError(f"La petición no puede contener más de {MAX_LINEAS} líneas")
        if any(not isinstance(linea, str) for linea in lineas):
            raise ValueError("Todas las líneas deben ser texto")
        return lineas

    @field_validator("lista_blanca")
    @classmethod
    def validar_lista_blanca(cls, ips):
        for ip in ips:
            try:
                ipaddress.ip_address(ip)
            except ValueError:
                raise ValueError(f"La IP de la lista blanca no es válida: {ip}")
        return ips


def crear_motivo(caracteristicas):
    """Construye una explicación corta y entendible para la persona usuaria."""
    motivos = []
    if caracteristicas.get("max_fallos_5min", 0) >= 5:
        motivos.append(f"{int(caracteristicas['max_fallos_5min'])} fallos en una ventana de cinco minutos")
    if caracteristicas.get("n_usuarios", 0) >= 5:
        motivos.append(f"prueba {int(caracteristicas['n_usuarios'])} usuarios distintos")
    if caracteristicas.get("ratio_fallos", 0) >= 0.8:
        motivos.append("la mayoría de sus intentos son fallidos")
    if caracteristicas.get("n_inv", 0) >= 3:
        motivos.append(f"usa {int(caracteristicas['n_inv'])} intentos con usuarios inválidos")
    if not motivos:
        motivos.append("el modelo ha detectado un patrón de actividad sospechoso")
    return "; ".join(motivos)


@app.get("/salud")
def salud():
    """Indica si el servicio está listo y qué características espera el modelo."""
    if modelo is None:
        raise HTTPException(status_code=503, detail="El modelo todavía no está cargado")
    caracteristicas = list(getattr(modelo, "feature_names_in_", []))
    return {"estado": "ok", "modelo_cargado": True, "caracteristicas": caracteristicas,
            "umbral_por_defecto": 0.7, "max_lineas": MAX_LINEAS}


@app.post("/analizar")
def analizar(solicitud: SolicitudAnalisis):
    """Analiza el log y devuelve las IPs que superan el umbral, sin bloquearlas."""
    if modelo is None:
        raise HTTPException(status_code=503, detail="El modelo no está cargado")

    eventos, lineas_ignoradas = cargar_lineas(solicitud.lineas)
    if eventos.empty:
        raise HTTPException(
            status_code=422,
            detail="No se ha encontrado ninguna línea reconocible de auth.log. Revisa el formato.",
        )

    caracteristicas = construir_features(eventos)
    if caracteristicas.empty:
        raise HTTPException(status_code=422, detail="No se han podido calcular características para ninguna IP")

    # Se conserva el mismo orden de características usado al entrenar el modelo.
    nombres = list(getattr(modelo, "feature_names_in_", caracteristicas.columns))
    faltantes = [nombre for nombre in nombres if nombre not in caracteristicas.columns]
    if faltantes:
        raise HTTPException(status_code=500, detail=f"Faltan características necesarias para el modelo: {faltantes}")
    X = caracteristicas[nombres]

    probabilidades = modelo.predict_proba(X)
    clases = list(modelo.classes_)
    if 1 not in clases:
        prob_atacante = [0.0] * len(X)
    else:
        indice_atacante = clases.index(1)
        prob_atacante = probabilidades[:, indice_atacante]

    ips_blancas = {str(ipaddress.ip_address(ip)) for ip in solicitud.lista_blanca}
    sospechosas = []
    for posicion, (ip, fila) in enumerate(caracteristicas.iterrows()):
        ip_normalizada = str(ipaddress.ip_address(ip))
        probabilidad = float(prob_atacante[posicion])
        # La lista blanca tiene prioridad: estas IP nunca aparecen como sospechosas.
        if ip_normalizada not in ips_blancas and probabilidad >= solicitud.umbral:
            sospechosas.append({
                "ip": ip_normalizada,
                "probabilidad": round(probabilidad, 4),
                "motivo": crear_motivo(fila),
            })

    sospechosas.sort(key=lambda elemento: elemento["probabilidad"], reverse=True)
    return {
        "lineas_ignoradas": int(lineas_ignoradas),
        "ips_analizadas": int(len(caracteristicas)),
        "sospechosas": sospechosas,
    }


# Integración con la interfaz: la propia API sirve la carpeta interfaz/ en http://127.0.0.1:8000/
# Se monta al final para no tapar las rutas /salud y /analizar.
if RUTA_INTERFAZ.is_dir():
    app.mount("/", StaticFiles(directory=RUTA_INTERFAZ, html=True), name="interfaz")
