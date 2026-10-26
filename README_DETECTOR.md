# Actividad P2 — Auditar e integrar un detector de intrusiones con IA

**Python para IA · 2º DAM.** Detector de IPs atacantes por SSH: lee un `auth.log` de OpenSSH,
resume el comportamiento de cada IP en características y un bosque aleatorio
(`RandomForestClassifier`) estima la probabilidad de que sea un atacante. El modelo se expone como
**API REST** (FastAPI, `api.py`) y se consume desde una **interfaz web** (`interfaz/`). La API solo
informa: la decisión final es de una persona.

Este repositorio también contiene la Actividad P1 (análisis del Titanic, `README.md` y los
cuadernos `T1`–`T5`); los ficheros de la P2 son los que se listan aquí.

## Ficheros de la P2

| Ruta | Para qué sirve | Responsable |
|---|---|---|
| `generar_logs.py` | Genera el log sintético (`auth.log`) y sus etiquetas (`etiquetas.csv`). **No se modifica.** | kit |
| `logtools.py` | Parsea el log y construye las características por IP. **No se modifica**; la API lo importa. | kit |
| `entrenar.py` | Entrena el modelo y lo guarda en `modelo.joblib`. | kit |
| `api.py` | API REST: `GET /salud`, `POST /analizar`. Sirve también la interfaz en `/`. | Hugo (integración: Alejandro) |
| `README_API.md` | Detalle de la API y de sus pruebas en `/docs`. | Hugo |
| `interfaz/` | Interfaz web (`index.html`, `app.js`, `estilos.css`) que consume la API. | Alejandro |
| `docs/pruebas.md` | Documento de pruebas: las cuatro peticiones mínimas y otras adicionales, con capturas. | Alejandro |
| `docs/guion_demo.md` | Guion de la demostración de 3 minutos de la defensa oral. | Alejandro |
| `docs/peticion_ejemplo.json` | Petición de ejemplo para `curl` (46 líneas, 5 IPs). | Alejandro |
| `analisis.ipynb` | Cuaderno guiado con P1–P13 y experimentos E1–E7 (pendiente de reunir las respuestas del equipo). | equipo |
| `requirements.txt` | Librerías necesarias. | kit |

Los ficheros generados (`auth.log`, `etiquetas.csv`, `modelo.joblib`, `.venv/`) **no se suben**:
están en `.gitignore` y se regeneran con los comandos de abajo.

## Instalación

Requisitos: Python 3.10 o superior.

```bash
python -m venv .venv
# Windows:        .venv\Scripts\activate
# Linux / macOS:  source .venv/bin/activate
pip install -r requirements.txt
```

## Puesta en marcha

1. **Generar los datos y entrenar el modelo** (usa tu número de lista como semilla):

   ```bash
   python generar_logs.py --seed <TU_NUMERO_DE_LISTA> --salida auth.log --etiquetas etiquetas.csv
   python entrenar.py --log auth.log --etiquetas etiquetas.csv --salida modelo.joblib
   ```

   El modelo guardado con joblib solo es fiable con la misma versión de scikit-learn con la
   que se entrenó: si cambias de ordenador, vuelve a ejecutar `entrenar.py`.

2. **Arrancar la API** (en el puerto 8000):

   ```bash
   uvicorn api:app --port 8000
   ```

   La documentación interactiva queda en <http://127.0.0.1:8000/docs>.

3. **Abrir la interfaz**: <http://127.0.0.1:8000/> (la sirve la propia API).
   También se puede abrir `interfaz/index.html` directamente desde el disco: la interfaz llama
   entonces a `http://127.0.0.1:8000` y la API lo permite (CORS).

4. **Cuaderno de análisis** (fases 1 y 2): `jupyter notebook analisis.ipynb`.

## Contrato de la API

### `GET /salud`

Devuelve `{"estado": "ok", "modelo_cargado": true, "caracteristicas": [...], "umbral_por_defecto": 0.7, "max_lineas": 50000}`.

### `POST /analizar`

Entrada (JSON):

| Campo | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| `lineas` | lista de texto | sí (1 a 50.000) | Líneas de `auth.log` tal cual. |
| `umbral` | número 0 – 1 | no (0.7) | Probabilidad mínima para marcar una IP como sospechosa. |
| `lista_blanca` | lista de IPs | no (vacía) | IPs que nunca se marcan. |

Salida (JSON): `lineas_ignoradas` (líneas que no tienen el formato esperado), `ips_analizadas` y
`sospechosas`, una lista ordenada por probabilidad descendente con `ip`, `probabilidad` y `motivo`
(explicación en lenguaje humano).

Errores: `422` si el cuerpo está mal formado, `umbral` está fuera de 0 – 1, la lista blanca tiene un
valor que no es una IP, hay más de 50.000 líneas o ninguna línea es reconocible; `503` si el modelo
no está cargado. El modelo se carga una sola vez al arrancar. La API no ejecuta ningún bloqueo.

## Ejemplos de peticiones

```bash
# Estado del servicio
curl http://127.0.0.1:8000/salud

# Petición correcta (46 líneas de ejemplo, umbral 0.5)
curl -X POST http://127.0.0.1:8000/analizar -H "Content-Type: application/json" -d @docs/peticion_ejemplo.json

# Con lista blanca: 203.0.113.45 no aparecerá aunque supere el umbral
curl -X POST http://127.0.0.1:8000/analizar -H "Content-Type: application/json" \
  -d '{"lineas": ["Oct  7 10:15:32 srv-web01 sshd[1234]: Failed password for invalid user admin from 203.0.113.45 port 51234 ssh2"], "lista_blanca": ["203.0.113.45"]}'

# Umbral fuera de rango -> 422
curl -X POST http://127.0.0.1:8000/analizar -H "Content-Type: application/json" -d '{"lineas": ["x"], "umbral": 1.5}'

# Líneas basura -> 422
curl -X POST http://127.0.0.1:8000/analizar -H "Content-Type: application/json" -d '{"lineas": ["hola", "esto no es un log"]}'

# Un log completo (Linux/macOS)
python -c "import json; print(json.dumps({'lineas': open('auth.log').read().splitlines()}))" > peticion.json
curl -X POST http://127.0.0.1:8000/analizar -H "Content-Type: application/json" -d @peticion.json
```

Los resultados de estas pruebas, con capturas, están en `docs/pruebas.md`.

## Interfaz web

- Carga un fichero `.log` (botón o arrastrándolo al cuadro de texto) o pega líneas a mano.
- Fija el umbral (deslizador o número) y la lista blanca.
- Muestra un resumen (líneas enviadas e ignoradas, IPs analizadas y sospechosas) y una tabla con
  IP, probabilidad y motivo, ordenable por IP o probabilidad y exportable a CSV.
- Traduce los errores de la API a mensajes comprensibles (datos rechazados, demasiadas líneas,
  servicio caído…). Valida en el navegador antes de enviar; en *Opciones avanzadas* se puede
  desactivar esa validación para provocar los errores de la API y ver cómo se muestran.
- El botón **Cargar ejemplo** rellena un log pequeño con dos atacantes, un usuario legítimo con
  muchos fallos, la tarea de backup y una línea que no es de `sshd` (para ver `lineas_ignoradas`).

## Arquitectura de la integración

```
┌──────────────────────┐   HTTP (JSON)    ┌──────────────────────────┐          ┌───────────────┐
│ Interfaz web         │ ───────────────▶ │ API REST (FastAPI)       │  import  │ logtools.py   │
│ interfaz/index.html  │  POST /analizar  │ api.py                   │ ───────▶ │ cargar_lineas │
│ + app.js (fetch)     │ ◀─────────────── │ · valida la entrada      │          │ construir_    │
│                      │  sospechosas[]   │ · carga modelo.joblib    │          │   features    │
│ fichero o texto,     │                  │   una vez al arrancar    │          └───────────────┘
│ umbral, lista blanca │  GET /salud      │ · predict_proba + umbral │  joblib  ┌───────────────┐
│ tabla ip/prob/motivo │ ◀─────────────── │ · aplica la lista blanca │ ───────▶ │ modelo.joblib │
└──────────────────────┘                  └──────────────────────────┘          └───────────────┘
```

Flujo de una petición: la interfaz lee el log → envía `lineas`, `umbral` y `lista_blanca` →
la API convierte las líneas en eventos (`cargar_lineas`) y en una fila por IP
(`construir_features`) → el modelo devuelve una probabilidad por IP → se filtran las IPs por
umbral y lista blanca y se redacta el `motivo` → la interfaz pinta la tabla.

## Equipo

Abraham (P1–P3), Andrés (P4–P7), Ángel David (P8–P11), María (E1–E2), Sandra (E3–E4),
Kenneth (E5–E7), Hugo (API), Alejandro (interfaz e integración).
