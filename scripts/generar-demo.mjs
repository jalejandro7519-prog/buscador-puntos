// Genera los datos DEMO: public/puntos.json, public/ejemplo-hoja.csv y public/ejemplo-hoja-con-errores.csv.
// Determinista: ejecutar `node scripts/generar-demo.mjs` produce siempre los mismos ficheros.
import { writeFileSync } from "node:fs";

const GENERADO_EN = "2026-10-27T09:00:00.000Z";
const TIPOS = ["Punto de información", "Punto de reciclaje", "Punto de atención", "Punto de recogida"];
const ZONAS = [
  { cp: "11001", ciudad: "Altamira", lat: 12.138, lng: -86.254 },
  { cp: "11002", ciudad: "Linda Vista", lat: 12.15, lng: -86.27 },
  { cp: "11003", ciudad: "Bolonia", lat: 12.12, lng: -86.23 },
  { cp: "11004", ciudad: "Reparto Schick", lat: 12.11, lng: -86.265 },
  { cp: "11005", ciudad: "Villa Fontana", lat: 12.165, lng: -86.24 },
  { cp: "11006", ciudad: "Monseñor Lezcano", lat: 12.13, lng: -86.215 },
];
const HORARIOS = ["L-V 8:00-16:00", "L-S 9:00-13:00 y 15:00-19:00", "Todos los días 7:00-21:00", "L, X y V 10:00-14:00"];
const CERRADOS = {
  3: { motivoCierre: "Obras en el local", reaperturaPrevista: "2026-11-15" },
  11: { motivoCierre: "Vacaciones del personal", reaperturaPrevista: "2026-12-01" },
  19: { motivoCierre: "Reforma del acceso", reaperturaPrevista: undefined },
};
const SIN_TELEFONO = new Set([7, 15, 22]);
const SIN_HORARIO = new Set([9, 20]);
const FILA_COMA_DECIMAL = 4;

const slug = (...partes) =>
  partes
    .join(" ")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
const redondear = (n) => Number(n.toFixed(6));

const puntos = Array.from({ length: 24 }, (_, i) => {
  const zona = ZONAS[i % ZONAS.length];
  const nombre = `Punto demo ${String(i + 1).padStart(2, "0")}`;
  const cerrado = CERRADOS[i];
  const p = {
    id: slug(nombre, zona.cp),
    nombre,
    tipo: TIPOS[(i + Math.floor(i / 6)) % TIPOS.length],
    direccion: `Calle Demo ${i + 1}`,
    codigoPostal: zona.cp,
    ciudad: zona.ciudad,
    lat: redondear(zona.lat + (((i * 37) % 11) - 5) * 0.0009),
    lng: redondear(zona.lng + (((i * 53) % 13) - 6) * 0.0009),
    estado: cerrado ? "cerrado_temporal" : "abierto",
    actualizadoEn: GENERADO_EN,
  };
  if (!SIN_TELEFONO.has(i)) p.telefono = `+505 2255 ${String(100 + i).padStart(4, "0")}`;
  if (!SIN_HORARIO.has(i)) p.horario = HORARIOS[i % HORARIOS.length];
  if (cerrado) {
    p.motivoCierre = cerrado.motivoCierre;
    if (cerrado.reaperturaPrevista) p.reaperturaPrevista = cerrado.reaperturaPrevista;
  }
  return p;
});

writeFileSync("public/puntos.json", JSON.stringify({ version: 1, generadoEn: GENERADO_EN, puntos }, null, 2) + "\n");

const CABECERA = [
  "Nombre",
  "Tipo",
  "Dirección",
  "Código postal",
  "Ciudad",
  "Teléfono",
  "Horario",
  "Latitud",
  "Longitud",
  "Estado",
  "Motivo cierre",
  "Reapertura prevista",
];
const celda = (v) => {
  const s = v === undefined ? "" : String(v);
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const coma = (n) => `"${String(n).replace(".", ",")}"`;
const fila = (campos) => campos.map((c) => (typeof c === "string" && c.startsWith("\u0000") ? c.slice(1) : celda(c))).join(",");
const crudo = (texto) => `\u0000${texto}`;

function filaDePunto(p, i) {
  return fila([
    p.nombre,
    p.tipo,
    p.direccion,
    p.codigoPostal,
    p.ciudad,
    p.telefono,
    p.horario,
    i === FILA_COMA_DECIMAL ? crudo(coma(p.lat)) : p.lat,
    i === FILA_COMA_DECIMAL ? crudo(coma(p.lng)) : p.lng,
    p.estado === "cerrado_temporal" ? "cerrado temporal" : "abierto",
    p.motivoCierre,
    p.reaperturaPrevista,
  ]);
}

const hoja = [fila(CABECERA), ...puntos.map(filaDePunto)];
writeFileSync("public/ejemplo-hoja.csv", "﻿" + hoja.join("\n") + "\n");

// Hoja con problemas: 5 filas buenas + comas decimales + coordenadas rotas.
const base = puntos.slice(0, 5).map(filaDePunto);
const problemas = [
  // Coma decimal (válida)
  fila(["Punto demo 31 (coma decimal)", TIPOS[0], "Calle Demo 31", "11001", "Altamira", "", "L-V 8:00-16:00", crudo('"12,1364"'), crudo('"-86,2510"'), "abierto", "", ""]),
  // Coordenadas vacías
  fila(["Punto demo 32 (sin coordenadas)", TIPOS[1], "Calle Demo 32", "11003", "Bolonia", "", "", "", "", "abierto", "", ""]),
  // Latitud no numérica
  fila(["Punto demo 33 (lat. ilegible)", TIPOS[2], "Calle Demo 33", "11002", "Linda Vista", "", "", "doce coma uno", "-86.27", "abierto", "", ""]),
  // Latitud fuera de rango (falta el punto decimal)
  fila(["Punto demo 34 (latitud fuera de rango)", TIPOS[3], "Calle Demo 34", "11001", "Altamira", "", "", "1213.64", "-86.2511", "abierto", "", ""]),
  // Intercambiadas pero dentro de rango (solo se detecta por estar lejos del resto)
  fila(["Punto demo 35 (intercambiadas)", TIPOS[0], "Calle Demo 35", "11003", "Bolonia", "", "", "-86.2511", "12.1364", "abierto", "", ""]),
  // Sin nombre
  fila(["", TIPOS[1], "Calle Demo 36", "11005", "Villa Fontana", "", "", "12.1651", "-86.2402", "abierto", "", ""]),
  // Coordenadas con espacios y punto decimal (válida)
  fila(["Punto demo 37 (con espacios)", TIPOS[2], "Calle Demo 37", "11001", "Altamira", "", "", " 12.1390 ", " -86.2540 ", "cerrado temporal", "Obras", ""]),
];
writeFileSync("public/ejemplo-hoja-con-errores.csv", "﻿" + [fila(CABECERA), ...base, ...problemas].join("\n") + "\n");

console.log(`${puntos.length} puntos, ${puntos.filter((p) => p.estado !== "abierto").length} cerrados`);
