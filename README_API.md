# API REST del detector

## 1. Preparar el proyecto (Windows)
Abre una terminal en esta carpeta y ejecuta:

```powershell
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python generar_logs.py --seed TU_NUMERO_DE_LISTA --salida auth.log --etiquetas etiquetas.csv
python entrenar.py --log auth.log --etiquetas etiquetas.csv --salida modelo.joblib
```

Sustituye `TU_NUMERO_DE_LISTA` por tu número de lista. Los ficheros `auth.log`, `etiquetas.csv` y `modelo.joblib` se generan localmente; no los subas al repositorio.

## 2. Arrancar la API

```powershell
uvicorn api:app --reload
```

Abre `http://127.0.0.1:8000/docs` para probar la API desde Swagger.

## 3. Rutas

- `GET /salud`: indica que el servicio está activo y muestra las características del modelo.
- `POST /analizar`: recibe `lineas`, `umbral` (0 a 1, por defecto 0.7) y `lista_blanca`.

Ejemplo de cuerpo JSON para `/analizar`:

```json
{
  "lineas": [
    "Oct  7 10:15:32 srv-web01 sshd[1234]: Failed password for root from 203.0.113.15 port 43210 ssh2",
    "Oct  7 10:16:01 srv-web01 sshd[1235]: Failed password for admin from 203.0.113.15 port 43211 ssh2"
  ],
  "umbral": 0.7,
  "lista_blanca": ["192.168.1.10"]
}
```

La API devuelve `lineas_ignoradas`, `ips_analizadas` y `sospechosas`. Cada sospechosa contiene `ip`, `probabilidad` y `motivo`. La API informa, pero nunca bloquea direcciones.

## 4. Pruebas obligatorias

En `/docs`, ejecuta estas cuatro pruebas y guarda capturas de la solicitud y respuesta:

1. **Correcta:** envía líneas reales copiadas de `auth.log` y `umbral: 0.7`.
2. **Lista blanca:** repite la petición añadiendo una IP presente en el log a `lista_blanca`; esa IP no debe salir en `sospechosas`.
3. **Umbral fuera de rango:** usa `umbral: 1.5`; debe responder con HTTP 422.
4. **Líneas basura:** usa `lineas: ["esto no es una línea de auth.log"]`; debe responder con HTTP 422 y un mensaje comprensible.

También puedes probar `GET /salud`. La lista blanca solo evita que una IP aparezca como sospechosa; no bloquea ni modifica el log.
