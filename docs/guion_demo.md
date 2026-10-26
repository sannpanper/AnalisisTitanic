# Guion de la demostración (3 minutos) — defensa oral

Objetivo: enseñar la API y la interfaz funcionando de principio a fin, incluida la gestión de
errores, sin improvisar. Ensayar con cronómetro al menos dos veces.

## Antes de entrar

- [ ] Entorno virtual activado y `pip install -r requirements.txt` hecho en el portátil de la demo.
- [ ] `auth.log`, `etiquetas.csv` y `modelo.joblib` generados **en ese portátil** (misma versión de scikit-learn).
- [ ] API arrancada y comprobada: `uvicorn api:app --port 8000` → abrir <http://127.0.0.1:8000/salud>.
- [ ] Pestañas abiertas y ordenadas: ① interfaz <http://127.0.0.1:8000/> ② `/docs` de FastAPI ③ terminal con la API.
- [ ] Un `auth.log` pequeño de reserva (por ejemplo `head -500 auth.log > demo.log`) por si el completo tarda.
- [ ] Brillo de pantalla y zoom del navegador al 125 % para que se lea desde el fondo del aula.
- [ ] Plan B si falla la API: las capturas de `docs/capturas/`.

## Minuto 0:00 – 0:30 · Qué vamos a ver

> "El detector lee el log de autenticación SSH y señala IPs sospechosas. Lo hemos expuesto
> como API REST para que cualquier aplicación lo use, y esta interfaz web es un cliente de esa
> API: no carga el modelo, solo habla con ella por HTTP."

Enseñar el punto verde "API conectada" arriba a la derecha y decir que viene de `GET /salud`.

## Minuto 0:30 – 1:30 · Petición correcta

1. **Cargar ejemplo** → señalar el contador de líneas.
2. Umbral en **0.5** → **Analizar**.
3. Leer las tarjetas: líneas enviadas, **1 ignorada** (la línea de CRON, que no es de `sshd`), 5 IPs, 2 sospechosas.
4. Leer la tabla: la IP `198.51.100.98` con el motivo "8 fallos en una ventana de cinco minutos;
   prueba 5 usuarios distintos; usa 17 intentos con usuarios inválidos" → es un ataque de diccionario.
5. Señalar `192.168.1.250` (11 fallos seguidos y luego entra): es el administrador con un mal día.
   Si no aparece, el modelo lo distingue de un atacante; si aparece con probabilidad media, es el
   ejemplo perfecto de falso positivo que el umbral y la lista blanca corrigen.

## Minuto 1:30 – 2:00 · Lista blanca y umbral

1. Escribir `198.51.100.98` en la lista blanca → **Analizar** → desaparece de la tabla.
   > "La lista blanca nunca se marca, pase lo que pase: así evitamos bloquear por error a una IP conocida."
2. Subir el umbral a **0.95** → **Analizar** → quedan menos (o ninguna).
   > "El umbral es la decisión de negocio: bajo detecta más pero molesta a usuarios legítimos; alto deja pasar atacantes."

## Minuto 2:00 – 2:40 · Errores

1. Pegar texto basura (`hola`, `esto no es un log`) → **Analizar** → mensaje claro: ninguna línea reconocible (422).
2. Abrir *Opciones avanzadas*, marcar "Enviar sin validar", umbral **1.5** → **Analizar** → la API
   responde 422 y la interfaz lo traduce: "Campo umbral: debe ser ≤ 1".
3. (Opcional, si sobra tiempo) Parar la API en la terminal → **Analizar** → "No se puede conectar con la API".

## Minuto 2:40 – 3:00 · Cierre

Cargar el `auth.log` completo con **Cargar fichero…** → **Analizar** (medio segundo, ~100 IPs
sospechosas) y enseñar `/docs` de FastAPI cinco segundos ("la API está documentada y se puede
probar sin la interfaz"). Cerrar:

> "La API solo informa; la decisión de bloquear es de una persona. Los límites del modelo los
> contamos en el informe."

## Preguntas probables y quién responde

| Pregunta del profesor | Idea de respuesta | Quién |
|---|---|---|
| ¿Por qué la interfaz no carga el modelo directamente? | Para que el panel, la app móvil y el sistema de tickets (no Python) usen el mismo servicio; el modelo se carga una vez y se actualiza en un solo sitio. | Alejandro |
| ¿Qué pasa si bloquea la IP del director? | Falso positivo: por eso la API no bloquea, hay lista blanca y revisión humana. | Ángel David / Alejandro |
| ¿Cómo actualizarías el modelo sin parar el servicio? | Nuevo `modelo.joblib` (ruta configurable con `MODELO_PATH`) + versión en `/salud`; arrancar una segunda instancia y cambiar el tráfico. | Hugo |
| ¿Qué añadirías antes de ponerla en Internet? | Autenticación por clave de API, HTTPS, límite de peticiones por minuto, registro de peticiones sin IPs en claro, y restringir CORS a los orígenes conocidos (ahora está abierto para la demo). | Hugo |
| ¿Qué datos personales hay en los logs? | Las IPs son dato personal (RGPD): minimizar, no guardarlas en claro, plazo de conservación. | Alejandro |
