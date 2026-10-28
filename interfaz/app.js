/* ===== Detector de intrusiones SSH — lógica de la interfaz =====
 *
 * La interfaz NO carga el modelo: todo pasa por la API REST.
 *   GET  /salud     -> comprueba que el servicio está vivo y lee su configuración
 *   POST /analizar  -> envía las líneas, el umbral y la lista blanca; recibe las IPs sospechosas
 */

"use strict";

// ---------- Configuración ----------

// Si la página la sirve la propia API, se usa ese origen; si se abre desde el
// disco (file://), se asume la API en local en el puerto 8000.
const API_POR_DEFECTO = location.protocol.startsWith("http") ? location.origin : "http://127.0.0.1:8000";
const CLAVE_API = "detector.apiUrl";
const CLAVE_UMBRAL = "detector.umbral";

let maxLineas = null;        // lo informa GET /salud si la API lo incluye
let ultimoResultado = null;  // última respuesta correcta (para ordenar y exportar)
let orden = { col: "probabilidad", asc: false };

// ---------- Referencias al DOM ----------

const $ = (id) => document.getElementById(id);
const ui = {
  estadoApi: $("estado-api"), estadoApiTexto: $("estado-api-texto"),
  fichero: $("fichero"), nombreFichero: $("nombre-fichero"),
  lineas: $("lineas"), contador: $("contador-lineas"),
  umbralRango: $("umbral-rango"), umbralNum: $("umbral-num"),
  listaBlanca: $("lista-blanca"), apiUrl: $("api-url"), sinValidar: $("sin-validar"),
  btnAnalizar: $("btn-analizar"), btnEjemplo: $("btn-ejemplo"), btnLimpiar: $("btn-limpiar"),
  btnSalud: $("btn-salud"), btnCsv: $("btn-csv"), cargando: $("cargando"),
  resultado: $("resultado"), error: $("error"), errorTitulo: $("error-titulo"), errorTexto: $("error-texto"),
  salida: $("salida"), tablaCuerpo: $("tabla-cuerpo"), sinSospechosas: $("sin-sospechosas"),
  rRecibidas: $("r-recibidas"), rIgnoradas: $("r-ignoradas"), rIps: $("r-ips"),
  rSospechosas: $("r-sospechosas"), rResumen: $("r-resumen"),
};

// ---------- Utilidades ----------

function leerAlmacen(clave, porDefecto) {
  try { return localStorage.getItem(clave) ?? porDefecto; } catch { return porDefecto; }
}
function guardarAlmacen(clave, valor) {
  try { localStorage.setItem(clave, valor); } catch { /* sin almacenamiento: no pasa nada */ }
}

function urlApi() {
  return (ui.apiUrl.value.trim() || API_POR_DEFECTO).replace(/\/+$/, "");
}

function lineasDelTexto() {
  return ui.lineas.value.split(/\r?\n/).map((l) => l.replace(/\r$/, "")).filter((l) => l.trim() !== "");
}

function ipsListaBlanca() {
  return [...new Set(ui.listaBlanca.value.split(/[\s,;]+/).map((s) => s.trim()).filter(Boolean))];
}

function esIpv4(ip) {
  const partes = ip.split(".");
  return partes.length === 4 && partes.every((p) => /^\d{1,3}$/.test(p) && Number(p) <= 255);
}

function actualizarContador() {
  const n = lineasDelTexto().length;
  let texto = `${n.toLocaleString("es-ES")} línea${n === 1 ? "" : "s"}`;
  ui.contador.classList.remove("pista--aviso");
  if (maxLineas && n > maxLineas) {
    texto += ` · supera el máximo de la API (${maxLineas.toLocaleString("es-ES")})`;
    ui.contador.classList.add("pista--aviso");
  }
  ui.contador.textContent = texto;
}

function fijarUmbral(valor, guardar = true) {
  let v = Number(valor);
  if (Number.isNaN(v)) v = 0.7;
  ui.umbralRango.value = Math.min(1, Math.max(0, v));
  ui.umbralNum.value = v;
  if (guardar) guardarAlmacen(CLAVE_UMBRAL, String(v));
}

// ---------- Estado de la API ----------

function pintarEstado(clase, texto) {
  ui.estadoApi.className = `estado estado--${clase}`;
  ui.estadoApiTexto.textContent = texto;
}

async function comprobarSalud() {
  pintarEstado("espera", "Comprobando API…");
  try {
    const r = await fetch(`${urlApi()}/salud`);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const datos = await r.json();
    if (typeof datos.max_lineas === "number") maxLineas = datos.max_lineas;
    if (typeof datos.umbral_por_defecto === "number" && leerAlmacen(CLAVE_UMBRAL, null) === null) {
      fijarUmbral(datos.umbral_por_defecto, false);   // el usuario aún no ha elegido umbral
    }
    const detalle = [datos.modelo ? `modelo: ${datos.modelo}` : (datos.modelo_cargado ? "modelo cargado" : ""),
                     datos.version && `v${datos.version}`].filter(Boolean).join(" · ");
    pintarEstado("ok", `API conectada${detalle ? " · " + detalle : ""}`);
    actualizarContador();
  } catch (e) {
    pintarEstado("error", `API no disponible en ${urlApi()}`);
  }
}

// ---------- Errores comprensibles ----------

/** Convierte el campo `detail` de FastAPI (texto o lista de errores de validación) en frases. */
function textoDetalle(detalle) {
  if (!detalle) return "";
  if (typeof detalle === "string") return detalle;
  if (Array.isArray(detalle)) {
    return detalle.map((d) => {
      const campo = (d.loc || []).filter((x) => x !== "body").join(".");
      return campo ? `Campo «${campo}»: ${d.msg}` : d.msg;
    }).join("\n");
  }
  return JSON.stringify(detalle);
}

function mostrarError(titulo, texto) {
  ui.resultado.hidden = false;
  ui.salida.hidden = true;
  ui.error.hidden = false;
  ui.errorTitulo.textContent = titulo;
  ui.errorTexto.textContent = texto;
}

function explicarErrorHttp(status, cuerpo) {
  const detalle = textoDetalle(cuerpo && cuerpo.detail) || (typeof cuerpo === "string" ? cuerpo : "");
  switch (status) {
    case 400:
    case 422:
      return ["La API ha rechazado los datos enviados", detalle || "Revisa el umbral, la lista blanca y las líneas del log."];
    case 413:
      return ["Demasiadas líneas para una sola petición", detalle || "Divide el log en partes más pequeñas."];
    case 404:
      return ["Ruta no encontrada en la API", `La API en ${urlApi()} no tiene el endpoint /analizar. ¿Es la URL correcta?`];
    case 500:
    case 502:
    case 503:
      return ["Error interno del servicio", detalle || "La API ha fallado al procesar la petición. Revisa su consola."];
    default:
      return [`La API ha respondido con el código ${status}`, detalle];
  }
}

// ---------- Análisis ----------

function validarLocalmente(lineas, umbral, listaBlanca) {
  if (lineas.length === 0) return "No hay ninguna línea que analizar: carga un fichero o pega líneas del log.";
  if (Number.isNaN(umbral) || umbral < 0 || umbral > 1) return "El umbral debe ser un número entre 0 y 1.";
  const malas = listaBlanca.filter((ip) => !esIpv4(ip));
  if (malas.length) return `La lista blanca contiene valores que no son IPs: ${malas.join(", ")}`;
  if (maxLineas && lineas.length > maxLineas) {
    return `El log tiene ${lineas.length.toLocaleString("es-ES")} líneas y la API admite como máximo ${maxLineas.toLocaleString("es-ES")} por petición.`;
  }
  return null;
}

async function analizar() {
  const lineas = lineasDelTexto();
  const umbral = Number(ui.umbralNum.value);
  const listaBlanca = ipsListaBlanca();

  if (!ui.sinValidar.checked) {
    const problema = validarLocalmente(lineas, umbral, listaBlanca);
    if (problema) { mostrarError("Revisa los datos antes de enviar", problema); return; }
  }

  ui.btnAnalizar.disabled = true;
  ui.cargando.hidden = false;
  ui.error.hidden = true;

  let respuesta;
  try {
    respuesta = await fetch(`${urlApi()}/analizar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lineas, umbral, lista_blanca: listaBlanca }),
    });
  } catch (e) {
    mostrarError("No se puede conectar con la API",
      `No hay respuesta de ${urlApi()}. Comprueba que el servicio está arrancado (uvicorn) y que la URL es correcta.`);
    pintarEstado("error", `API no disponible en ${urlApi()}`);
    terminarCarga();
    return;
  }

  let cuerpo = null;
  try { cuerpo = await respuesta.json(); } catch { cuerpo = null; }

  if (!respuesta.ok) {
    const [titulo, texto] = explicarErrorHttp(respuesta.status, cuerpo);
    mostrarError(titulo, texto);
    terminarCarga();
    return;
  }

  if (!cuerpo || !Array.isArray(cuerpo.sospechosas)) {
    mostrarError("Respuesta inesperada de la API", "La respuesta no tiene el campo «sospechosas». ¿Es la API correcta?");
    terminarCarga();
    return;
  }

  ultimoResultado = { ...cuerpo, umbral, listaBlanca, lineasEnviadas: lineas.length };
  pintarResultado();
  terminarCarga();
}

function terminarCarga() {
  ui.btnAnalizar.disabled = false;
  ui.cargando.hidden = true;
}

// ---------- Pintar resultado ----------

function pintarResultado() {
  const r = ultimoResultado;
  ui.resultado.hidden = false;
  ui.error.hidden = true;
  ui.salida.hidden = false;

  ui.rRecibidas.textContent = (r.lineas_recibidas ?? r.lineasEnviadas).toLocaleString("es-ES");
  ui.rIgnoradas.textContent = (r.lineas_ignoradas ?? 0).toLocaleString("es-ES");
  ui.rIps.textContent = (r.ips_analizadas ?? 0).toLocaleString("es-ES");
  ui.rSospechosas.textContent = r.sospechosas.length.toLocaleString("es-ES");

  const partes = [`umbral ${r.umbral}`];
  if (r.listaBlanca.length) partes.push(`lista blanca: ${r.listaBlanca.join(", ")}`);
  ui.rResumen.textContent = partes.join(" · ");

  const filas = [...r.sospechosas].sort((a, b) => {
    const va = a[orden.col], vb = b[orden.col];
    const cmp = orden.col === "ip" ? compararIps(va, vb) : (va - vb);
    return orden.asc ? cmp : -cmp;
  });

  ui.tablaCuerpo.innerHTML = "";
  filas.forEach((s, i) => {
    const tr = document.createElement("tr");
    const prob = Number(s.probabilidad);
    const pct = Math.round(prob * 100);
    tr.innerHTML = `
      <td class="num">${i + 1}</td>
      <td class="ip"></td>
      <td><div class="prob">
        <div class="prob__barra"><div class="prob__relleno ${prob >= 0.9 ? "prob__relleno--alta" : ""}" style="width:${pct}%"></div></div>
        <span class="prob__texto">${pct} %</span>
      </div></td>
      <td class="motivo"></td>`;
    tr.querySelector(".ip").textContent = s.ip;
    tr.querySelector(".motivo").textContent = s.motivo || "—";
    ui.tablaCuerpo.appendChild(tr);
  });

  ui.sinSospechosas.hidden = filas.length > 0;
  ui.btnCsv.hidden = filas.length === 0;
  ui.resultado.scrollIntoView({ behavior: "smooth", block: "start" });
}

function compararIps(a, b) {
  const pa = a.split(".").map(Number), pb = b.split(".").map(Number);
  for (let i = 0; i < 4; i++) if (pa[i] !== pb[i]) return pa[i] - pb[i];
  return 0;
}

function descargarCsv() {
  if (!ultimoResultado) return;
  const filas = [["ip", "probabilidad", "motivo"]];
  ultimoResultado.sospechosas.forEach((s) => filas.push([s.ip, s.probabilidad, s.motivo]));
  const csv = filas.map((f) => f.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(";")).join("\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "ips_sospechosas.csv";
  a.click();
  URL.revokeObjectURL(a.href);
}

// ---------- Carga de ficheros ----------

function cargarFichero(fichero) {
  if (!fichero) return;
  const lector = new FileReader();
  lector.onload = () => {
    ui.lineas.value = lector.result;
    ui.nombreFichero.textContent = `${fichero.name} (${(fichero.size / 1024).toFixed(0)} KB)`;
    actualizarContador();
  };
  lector.onerror = () => mostrarError("No se ha podido leer el fichero", lector.error?.message || "");
  lector.readAsText(fichero);
}

// ---------- Ejemplo incrustado ----------

const EJEMPLO = `Oct  7 00:02:00 srv-web01 sshd[4127]: Accepted password for backup from 10.0.0.5 port 47130 ssh2
Oct  7 00:28:18 srv-web01 sshd[41001]: Invalid user user from 198.51.100.98 port 57170
Oct  7 00:28:18 srv-web01 sshd[43925]: Failed password for invalid user user from 198.51.100.98 port 57170 ssh2
Oct  7 00:28:18 srv-web01 sshd[1817]: Invalid user git from 198.51.100.98 port 40114
Oct  7 00:28:18 srv-web01 sshd[32042]: Failed password for invalid user git from 198.51.100.98 port 40114 ssh2
Oct  7 00:28:18 srv-web01 sshd[49384]: Invalid user git from 198.51.100.98 port 53772
Oct  7 00:28:18 srv-web01 sshd[24854]: Failed password for invalid user git from 198.51.100.98 port 53772 ssh2
Oct  7 00:28:18 srv-web01 sshd[14794]: Invalid user mysql from 198.51.100.98 port 47944
Oct  7 00:28:18 srv-web01 sshd[47397]: Failed password for invalid user mysql from 198.51.100.98 port 47944 ssh2
Oct  7 00:28:19 srv-web01 sshd[20546]: Invalid user mysql from 198.51.100.98 port 48180
Oct  7 00:28:19 srv-web01 sshd[56281]: Failed password for invalid user mysql from 198.51.100.98 port 48180 ssh2
Oct  7 00:28:20 srv-web01 sshd[32749]: Invalid user root from 198.51.100.98 port 37853
Oct  7 00:28:20 srv-web01 sshd[10271]: Failed password for invalid user root from 198.51.100.98 port 37853 ssh2
Oct  7 00:28:21 srv-web01 sshd[53588]: Invalid user ftpuser from 198.51.100.98 port 36384
Oct  7 00:28:21 srv-web01 sshd[52370]: Failed password for invalid user ftpuser from 198.51.100.98 port 36384 ssh2
Oct  7 00:28:21 srv-web01 sshd[4030]: Connection closed by invalid user root 198.51.100.98 port 53905 [preauth]
Oct  7 00:28:24 srv-web01 sshd[59726]: Invalid user ftpuser from 198.51.100.98 port 43159
Oct  7 00:28:24 srv-web01 sshd[55172]: Failed password for invalid user ftpuser from 198.51.100.98 port 43159 ssh2
Oct  7 00:28:24 srv-web01 sshd[34346]: Invalid user mysql from 198.51.100.98 port 59478
Oct  7 01:03:00 srv-web01 sshd[22009]: Accepted password for backup from 10.0.0.5 port 36320 ssh2
Oct  7 02:02:00 srv-web01 sshd[53817]: Accepted password for backup from 10.0.0.5 port 44623 ssh2
Oct  7 03:14:00 srv-web01 CRON[2211]: (root) CMD (run-parts /etc/cron.hourly)
Oct  7 07:01:04 srv-web01 sshd[47498]: Failed password for ana from 10.0.1.17 port 56301 ssh2
Oct  7 07:01:24 srv-web01 sshd[6646]: Failed password for ana from 10.0.1.17 port 41765 ssh2
Oct  7 07:01:37 srv-web01 sshd[48273]: Failed password for ana from 10.0.1.17 port 41144 ssh2
Oct  7 09:03:04 srv-web01 sshd[24811]: Failed password for admin_sistemas from 192.168.1.250 port 38225 ssh2
Oct  7 09:03:12 srv-web01 sshd[28994]: Failed password for admin_sistemas from 192.168.1.250 port 40166 ssh2
Oct  7 09:03:27 srv-web01 sshd[42418]: Failed password for admin_sistemas from 192.168.1.250 port 35871 ssh2
Oct  7 09:03:39 srv-web01 sshd[48065]: Failed password for admin_sistemas from 192.168.1.250 port 42637 ssh2
Oct  7 09:03:46 srv-web01 sshd[32031]: Failed password for admin_sistemas from 192.168.1.250 port 39239 ssh2
Oct  7 09:03:51 srv-web01 sshd[57144]: Failed password for admin_sistemas from 192.168.1.250 port 59948 ssh2
Oct  7 09:03:57 srv-web01 sshd[18566]: Failed password for admin_sistemas from 192.168.1.250 port 48215 ssh2
Oct  7 09:04:10 srv-web01 sshd[37081]: Failed password for admin_sistemas from 192.168.1.250 port 43531 ssh2
Oct  7 09:04:24 srv-web01 sshd[10234]: Failed password for admin_sistemas from 192.168.1.250 port 52899 ssh2
Oct  7 09:04:28 srv-web01 sshd[29731]: Failed password for admin_sistemas from 192.168.1.250 port 37775 ssh2
Oct  7 09:04:40 srv-web01 sshd[34940]: Failed password for admin_sistemas from 192.168.1.250 port 46653 ssh2
Oct  7 09:04:50 srv-web01 sshd[10386]: Accepted password for admin_sistemas from 192.168.1.250 port 56444 ssh2
Oct  7 11:24:27 srv-web01 sshd[44972]: Accepted password for ana from 10.0.1.17 port 53613 ssh2
Oct  7 17:41:27 srv-web01 sshd[18905]: Failed password for root from 192.168.2.107 port 36727 ssh2
Oct  7 17:46:22 srv-web01 sshd[40698]: Failed password for root from 192.168.2.107 port 33206 ssh2
Oct  7 17:53:20 srv-web01 sshd[20196]: Failed password for root from 192.168.2.107 port 35810 ssh2
Oct  7 18:08:02 srv-web01 sshd[30966]: Failed password for root from 192.168.2.107 port 50179 ssh2
Oct  7 18:22:31 srv-web01 sshd[42201]: Failed password for root from 192.168.2.107 port 53376 ssh2
Oct  7 18:31:39 srv-web01 sshd[7359]: Failed password for root from 192.168.2.107 port 40455 ssh2
Oct  7 18:38:44 srv-web01 sshd[20607]: Failed password for root from 192.168.2.107 port 60849 ssh2
Oct  7 18:42:50 srv-web01 sshd[27932]: Failed password for root from 192.168.2.107 port 36712 ssh2`;

// ---------- Eventos ----------

ui.fichero.addEventListener("change", () => cargarFichero(ui.fichero.files[0]));

ui.lineas.addEventListener("input", actualizarContador);
ui.lineas.addEventListener("dragover", (e) => { e.preventDefault(); ui.lineas.classList.add("arrastrando"); });
ui.lineas.addEventListener("dragleave", () => ui.lineas.classList.remove("arrastrando"));
ui.lineas.addEventListener("drop", (e) => {
  e.preventDefault();
  ui.lineas.classList.remove("arrastrando");
  cargarFichero(e.dataTransfer.files[0]);
});

ui.btnEjemplo.addEventListener("click", () => {
  ui.lineas.value = EJEMPLO;
  ui.nombreFichero.textContent = "ejemplo incrustado (5 IPs: 2 atacantes, 1 usuario con mal día, 1 backup, 1 línea de CRON)";
  actualizarContador();
});

ui.btnLimpiar.addEventListener("click", () => {
  ui.lineas.value = "";
  ui.fichero.value = "";
  ui.nombreFichero.textContent = "";
  ui.resultado.hidden = true;
  ultimoResultado = null;
  actualizarContador();
});

ui.umbralRango.addEventListener("input", () => fijarUmbral(ui.umbralRango.value));
ui.umbralNum.addEventListener("input", () => {
  // Mientras se escribe ("0." aún no es un número) no se toca el campo; solo se sincroniza el deslizador.
  const v = Number(ui.umbralNum.value);
  if (ui.umbralNum.value === "" || Number.isNaN(v)) return;
  ui.umbralRango.value = Math.min(1, Math.max(0, v));
  guardarAlmacen(CLAVE_UMBRAL, String(v));
});
ui.umbralNum.addEventListener("change", () => fijarUmbral(ui.umbralNum.value));

ui.apiUrl.addEventListener("change", () => { guardarAlmacen(CLAVE_API, ui.apiUrl.value.trim()); comprobarSalud(); });
ui.btnSalud.addEventListener("click", comprobarSalud);
ui.btnAnalizar.addEventListener("click", analizar);
ui.btnCsv.addEventListener("click", descargarCsv);

document.querySelectorAll(".orden").forEach((b) => b.addEventListener("click", () => {
  const col = b.dataset.col;
  orden = orden.col === col ? { col, asc: !orden.asc } : { col, asc: col === "ip" };
  if (ultimoResultado) pintarResultado();
}));

// ---------- Arranque ----------

ui.apiUrl.value = leerAlmacen(CLAVE_API, "") || "";
ui.apiUrl.placeholder = API_POR_DEFECTO;
fijarUmbral(leerAlmacen(CLAVE_UMBRAL, "0.7"), false);
actualizarContador();
comprobarSalud();
