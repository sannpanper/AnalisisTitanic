# Documento de pruebas de la API

Fase 3, apartado C: al menos cuatro peticiones documentadas (correcta, con lista blanca, umbral
fuera de rango y líneas basura), indicando qué se esperaba y qué se obtuvo.

**Entorno:** `api.py` (API definitiva), modelo entrenado con `generar_logs.py --seed 7`
(15.270 líneas, 384 IPs, 100 atacantes). Las peticiones se hicieron con `curl` y, en paralelo,
desde la interfaz web; las capturas de `docs/capturas/` son de la interfaz.

Preparación: `uvicorn api:app --port 8000`.

---

## Prueba 0 — Estado del servicio

```bash
curl http://127.0.0.1:8000/salud
```

**Esperado:** `200` con `"estado": "ok"` y la lista de características del modelo.

**Obtenido:**

```json
{"estado":"ok","modelo_cargado":true,"caracteristicas":["n_eventos","n_fallos","n_ok","n_usuarios","n_inv","duracion_min","ratio_fallos","fallos_por_min","es_interna","max_fallos_5min","hora_media"],"umbral_por_defecto":0.7,"max_lineas":50000}
```

✅ Coincide.

---

## Prueba 1 — Petición correcta

Log de ejemplo de la interfaz (`docs/peticion_ejemplo.json`: 46 líneas, 5 IPs, una línea de CRON
que no es de `sshd`), umbral 0.5.

```bash
curl -X POST http://127.0.0.1:8000/analizar -H "Content-Type: application/json" -d @docs/peticion_ejemplo.json
```

**Esperado:** `200`; 1 línea ignorada (la de CRON); 5 IPs analizadas; las dos IPs atacantes
(`198.51.100.98`, diccionario rápido; `192.168.2.107`, fallos lentos contra `root`) marcadas con
motivo; `192.168.1.250` (admin con 11 fallos y luego acceso correcto) y `10.0.1.17` **no** marcadas.

**Obtenido:**

```json
{
  "lineas_ignoradas": 1,
  "ips_analizadas": 5,
  "sospechosas": [
    {"ip": "192.168.2.107", "probabilidad": 0.97, "motivo": "la mayoría de sus intentos son fallidos"},
    {"ip": "198.51.100.98", "probabilidad": 0.86, "motivo": "8 fallos en una ventana de cinco minutos; prueba 5 usuarios distintos; usa 17 intentos con usuarios inválidos"}
  ]
}
```

✅ Coincide. Captura: `docs/capturas/prueba1_correcta.png`.

---

## Prueba 2 — Lista blanca

Misma petición con `"lista_blanca": ["198.51.100.98"]`.

**Esperado:** `200`; `198.51.100.98` desaparece de `sospechosas` aunque supere el umbral; el resto igual.

**Obtenido:**

```json
{
  "lineas_ignoradas": 1,
  "ips_analizadas": 5,
  "sospechosas": [
    {"ip": "192.168.2.107", "probabilidad": 0.97, "motivo": "la mayoría de sus intentos son fallidos"}
  ]
}
```

✅ Coincide. Captura: `docs/capturas/prueba2_lista_blanca.png`.

---

## Prueba 3 — Umbral fuera de rango

```bash
curl -i -X POST http://127.0.0.1:8000/analizar -H "Content-Type: application/json" \
  -d '{"lineas": ["x"], "umbral": 1.5}'
```

**Esperado:** `422` con un mensaje que señale el campo `umbral`.

**Obtenido:** `HTTP 422`

```json
{"detail":[{"type":"less_than_equal","loc":["body","umbral"],"msg":"Input should be less than or equal to 1","input":1.5,"ctx":{"le":1.0}}]}
```

En la interfaz se muestra como **"La API ha rechazado los datos enviados — Campo «umbral»: Input
should be less than or equal to 1"** (hay que desactivar la validación del navegador en *Opciones
avanzadas*, porque la interfaz no deja enviar un umbral fuera de rango).

✅ Coincide. Captura: `docs/capturas/prueba3_umbral.png`.

---

## Prueba 4 — Líneas basura

```bash
curl -i -X POST http://127.0.0.1:8000/analizar -H "Content-Type: application/json" \
  -d '{"lineas": ["hola", "esto no es un log"]}'
```

**Esperado:** `422` con un mensaje comprensible (ninguna línea reconocible), no un error 500.

**Obtenido:** `HTTP 422`

```json
{"detail":"No se ha encontrado ninguna línea reconocible de auth.log. Revisa el formato."}
```

✅ Coincide. Captura: `docs/capturas/prueba4_basura.png`.

---

## Pruebas adicionales

| Prueba | Petición | Esperado | Obtenido |
|---|---|---|---|
| Lista vacía de líneas | `{"lineas": []}` | 422 | ✅ 422 `List should have at least 1 item` |
| Lista blanca con un valor que no es IP | `{"lineas": ["x"], "lista_blanca": ["no-es-ip"]}` | 422 con mensaje claro | ✅ 422 `La IP de la lista blanca no es válida: no-es-ip` |
| Más líneas que el máximo | 50.001 líneas | 422 | ✅ 422 `La petición no puede contener más de 50000 líneas` |
| Log completo (15.270 líneas, semilla 7) | fichero `auth.log` desde la interfaz | 200 en menos de 2 s | ✅ 200 en 0,53 s; 384 IPs analizadas, 99 sospechosas con umbral 0.7 (`docs/capturas/log_completo.png`) |
| Interfaz abierta desde el disco (`file://`) | análisis del ejemplo | funciona gracias a CORS | ✅ |
| API apagada | desde la interfaz | mensaje "No se puede conectar con la API" | ✅ |
| Sin líneas | desde la interfaz | aviso antes de enviar | ✅ "No hay ninguna línea que analizar" |
