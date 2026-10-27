import Papa from "papaparse";
import type { EstadoPunto, Punto } from "./esquema";
import { generarId, idUnico, normalizar } from "./texto";

/* ------------------------------------------------------------------ */
/* Cabeceras de la hoja                                                */
/* ------------------------------------------------------------------ */

export type CampoHoja =
  | "id"
  | "nombre"
  | "tipo"
  | "direccion"
  | "codigoPostal"
  | "ciudad"
  | "telefono"
  | "horario"
  | "lat"
  | "lng"
  | "estado"
  | "motivoCierre"
  | "reaperturaPrevista";

/** Alias aceptados por campo, ya sin tildes, mayúsculas, espacios ni signos. */
const ALIAS: Record<CampoHoja, string[]> = {
  id: ["id", "identificador"],
  nombre: ["nombre", "name"],
  tipo: ["tipo", "categoria", "type"],
  direccion: ["direccion", "domicilio", "address"],
  codigoPostal: ["codigopostal", "cp", "codpostal", "zip", "zipcode", "postal"],
  ciudad: ["ciudad", "localidad", "barrio", "municipio", "city"],
  telefono: ["telefono", "tel", "tlf", "phone", "movil"],
  horario: ["horario", "horarios"],
  lat: ["lat", "latitud", "latitude"],
  lng: ["lng", "lon", "long", "longitud", "longitude"],
  estado: ["estado"],
  motivoCierre: ["motivocierre", "motivodelcierre", "motivo"],
  reaperturaPrevista: ["reaperturaprevista", "reapertura", "fechareapertura"],
};

export const CAMPOS_OBLIGATORIOS: CampoHoja[] = ["nombre", "tipo", "direccion", "lat", "lng"];
const CAMPOS: CampoHoja[] = Object.keys(ALIAS) as CampoHoja[];

export const ETIQUETA_CAMPO: Record<CampoHoja, string> = {
  id: "Id",
  nombre: "Nombre",
  tipo: "Tipo",
  direccion: "Dirección",
  codigoPostal: "Código postal",
  ciudad: "Ciudad",
  telefono: "Teléfono",
  horario: "Horario",
  lat: "Latitud",
  lng: "Longitud",
  estado: "Estado",
  motivoCierre: "Motivo cierre",
  reaperturaPrevista: "Reapertura prevista",
};

const clave = (cabecera: string) => normalizar(cabecera).replace(/[^a-z0-9]/g, "");

export function reconocerCampo(cabecera: string): CampoHoja | null {
  const k = clave(cabecera);
  return CAMPOS.find((c) => ALIAS[c].includes(k)) ?? null;
}

/* ------------------------------------------------------------------ */
/* Valores                                                             */
/* ------------------------------------------------------------------ */

/** Admite coma o punto decimal, espacios y signo Unicode. Devuelve null si no es un número. */
export function parsearNumero(valor: unknown): number | null {
  if (typeof valor === "number") return Number.isFinite(valor) ? valor : null;
  if (typeof valor !== "string") return null;
  let t = valor.replace(/[\s\u00a0]/g, "").replace(/\u2212/g, "-");
  if (!t) return null;
  const coma = t.lastIndexOf(",");
  const punto = t.lastIndexOf(".");
  if (coma >= 0 && punto >= 0) {
    // «1.234,56» (coma decimal) o «1,234.56» (punto decimal)
    t = coma > punto ? t.replace(/\./g, "").replace(",", ".") : t.replace(/,/g, "");
  } else if (coma >= 0) {
    t = t.replace(",", ".");
  }
  return /^[+-]?(\d+(\.\d+)?|\.\d+)([eE][+-]?\d+)?$/.test(t) ? Number(t) : null;
}

function parsearEstado(texto: string): { estado: EstadoPunto; reconocido: boolean } {
  const n = normalizar(texto).replace(/[\s_-]+/g, " ");
  if (!n || /^(abiert[oa]|activ[oa]|open)$/.test(n)) return { estado: "abierto", reconocido: true };
  if (/^(cerrad[oa]|cerrad[oa] temporal(mente)?|temporal(mente)? cerrad[oa]|temporal|closed)$/.test(n)) {
    return { estado: "cerrado_temporal", reconocido: true };
  }
  return { estado: "abierto", reconocido: false };
}

/** ISO (2026-11-15), español (15/11/2026) o número de serie de Excel → «2026-11-15». */
export function parsearFecha(texto: string): string | null {
  const t = texto.trim();
  if (!t) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(t)) {
    const d = t.slice(0, 10);
    return Number.isNaN(Date.parse(d)) ? null : d;
  }
  const es = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(t);
  if (es) {
    const d = `${es[3]}-${es[2]?.padStart(2, "0")}-${es[1]?.padStart(2, "0")}`;
    return Number.isNaN(Date.parse(d)) ? null : d;
  }
  if (/^\d{5}(\.\d+)?$/.test(t)) {
    const serie = Number(t);
    if (serie > 20000 && serie < 80000) return new Date(Math.round((serie - 25569) * 86400000)).toISOString().slice(0, 10);
  }
  return null;
}

/** Texto de la hoja → texto de la app (deshace la protección anti-fórmulas del CSV exportado). */
function limpiar(valor: unknown): string {
  const t = String(valor ?? "").trim();
  return /^'([=@+-])/.test(t) ? t.slice(1) : t;
}

/* ------------------------------------------------------------------ */
/* Filas                                                               */
/* ------------------------------------------------------------------ */

export type CamposFila = Record<CampoHoja, string>;

export interface Problema {
  nivel: "error" | "aviso";
  campo?: CampoHoja;
  mensaje: string;
}

export interface FilaImportada {
  /** Número de fila en la hoja (la cabecera es la 1). */
  fila: number;
  campos: CamposFila;
  /** null si la fila tiene algún error: no se importa hasta corregirla. */
  punto: Punto | null;
  problemas: Problema[];
  /** true si lat/lng parecen estar intercambiadas (se ofrece intercambiarlas). */
  sugerirIntercambio: boolean;
}

export interface ColumnasHoja {
  reconocidas: Partial<Record<CampoHoja, string>>;
  ignoradas: string[];
  faltan: CampoHoja[];
}

export interface LecturaHoja {
  filas: FilaImportada[];
  columnas: ColumnasHoja;
}

export interface ResumenImportacion {
  total: number;
  /** Sin ningún problema. */
  validas: number;
  /** Importables, pero con algún aviso. */
  conAviso: number;
  /** No importables hasta corregirlas. */
  conError: number;
  /** validas + conAviso: lo que se importaría. */
  importables: number;
}

export function resumir(filas: readonly FilaImportada[]): ResumenImportacion {
  const conError = filas.filter((f) => f.punto === null).length;
  const conAviso = filas.filter((f) => f.punto !== null && f.problemas.length > 0).length;
  const validas = filas.length - conError - conAviso;
  return { total: filas.length, validas, conAviso, conError, importables: validas + conAviso };
}

export function camposVacios(): CamposFila {
  return Object.fromEntries(CAMPOS.map((c) => [c, ""])) as CamposFila;
}

export function intercambiarCoordenadas(campos: CamposFila): CamposFila {
  return { ...campos, lat: campos.lng, lng: campos.lat };
}

const mediana = (valores: number[]): number => {
  const orden = [...valores].sort((a, b) => a - b);
  const m = Math.floor(orden.length / 2);
  return orden.length % 2 ? (orden[m] ?? 0) : ((orden[m - 1] ?? 0) + (orden[m] ?? 0)) / 2;
};

interface EntradaFila {
  fila: number;
  campos: CamposFila;
}

/**
 * Valida todas las filas a la vez (necesita el lote para ids únicos y para detectar
 * coordenadas intercambiadas que siguen dentro de rango). Es pura: se vuelve a llamar
 * tras cada corrección manual.
 */
export function analizarFilas(entradas: readonly EntradaFila[], ahora = new Date().toISOString()): FilaImportada[] {
  // Referencia del lote para detectar lat/lng intercambiadas: mediana de las coordenadas válidas.
  const coords = entradas.flatMap((e) => {
    const lat = parsearNumero(e.campos.lat);
    const lng = parsearNumero(e.campos.lng);
    return lat !== null && lng !== null && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? [{ lat, lng }] : [];
  });
  const referencia =
    coords.length >= 3 ? { lat: mediana(coords.map((c) => c.lat)), lng: mediana(coords.map((c) => c.lng)) } : null;

  const usados = new Set<string>();
  return entradas.map(({ fila, campos }) => {
    const problemas: Problema[] = [];
    const error = (mensaje: string, campo?: CampoHoja) => problemas.push({ nivel: "error", campo, mensaje });
    const aviso = (mensaje: string, campo?: CampoHoja) => problemas.push({ nivel: "aviso", campo, mensaje });
    let sugerirIntercambio = false;

    if (!campos.nombre) error("Falta el nombre.", "nombre");
    if (!campos.tipo) error("Falta el tipo.", "tipo");
    if (!campos.direccion) error("Falta la dirección.", "direccion");

    const lat = parsearNumero(campos.lat);
    const lng = parsearNumero(campos.lng);
    if (!campos.lat && !campos.lng) {
      error("Sin coordenadas: latitud y longitud están vacías.", "lat");
    } else {
      if (!campos.lat) error("Falta la latitud.", "lat");
      else if (lat === null) error(`Latitud no válida: «${campos.lat}».`, "lat");
      if (!campos.lng) error("Falta la longitud.", "lng");
      else if (lng === null) error(`Longitud no válida: «${campos.lng}».`, "lng");
    }
    if (lat !== null && lng !== null) {
      const latFuera = Math.abs(lat) > 90;
      const lngFuera = Math.abs(lng) > 180;
      if (latFuera || lngFuera) {
        const intercambiadasValen = Math.abs(lng) <= 90 && Math.abs(lat) <= 180;
        sugerirIntercambio = latFuera && intercambiadasValen;
        if (latFuera) error(`Latitud fuera de rango (−90 a 90): ${lat}.${sugerirIntercambio ? " ¿Están intercambiadas latitud y longitud?" : ""}`, "lat");
        if (lngFuera) error(`Longitud fuera de rango (−180 a 180): ${lng}.`, "lng");
      } else if (lat === 0 && lng === 0) {
        error("Las coordenadas son 0, 0 (parecen estar vacías).", "lat");
      } else if (referencia) {
        const lejos = Math.abs(lat - referencia.lat) > 20 || Math.abs(lng - referencia.lng) > 20;
        const cercaSiSeCambian = Math.abs(lng - referencia.lat) < 10 && Math.abs(lat - referencia.lng) < 10;
        if (lejos && cercaSiSeCambian) {
          sugerirIntercambio = true;
          aviso("Las coordenadas están lejos del resto y parecen intercambiadas (latitud ↔ longitud).", "lat");
        } else if (lejos) {
          aviso("Las coordenadas están muy lejos del resto de puntos; compruébalas.", "lat");
        }
      }
    }

    const { estado, reconocido } = parsearEstado(campos.estado);
    if (!reconocido) aviso(`Estado no reconocido «${campos.estado}»: se importa como abierto.`, "estado");
    let reapertura: string | undefined;
    if (campos.reaperturaPrevista) {
      const f = parsearFecha(campos.reaperturaPrevista);
      if (f) reapertura = f;
      else aviso(`Fecha de reapertura no reconocida «${campos.reaperturaPrevista}»: se ignora.`, "reaperturaPrevista");
    }

    const hayError = problemas.some((p) => p.nivel === "error");
    let punto: Punto | null = null;
    if (!hayError && lat !== null && lng !== null) {
      const base = campos.id || generarId(campos.nombre, campos.codigoPostal);
      const id = idUnico(base, usados);
      usados.add(id);
      if (id !== base) aviso(`El id «${base}» ya existía en la hoja: se usa «${id}».`, "id");
      punto = {
        id,
        nombre: campos.nombre,
        tipo: campos.tipo,
        direccion: campos.direccion,
        codigoPostal: campos.codigoPostal,
        ciudad: campos.ciudad,
        ...(campos.telefono ? { telefono: campos.telefono } : {}),
        ...(campos.horario ? { horario: campos.horario } : {}),
        lat,
        lng,
        estado,
        ...(campos.motivoCierre ? { motivoCierre: campos.motivoCierre } : {}),
        ...(reapertura ? { reaperturaPrevista: reapertura } : {}),
        actualizadoEn: ahora,
      };
    }
    return { fila, campos, punto, problemas, sugerirIntercambio };
  });
}

/* ------------------------------------------------------------------ */
/* Lectura de ficheros                                                 */
/* ------------------------------------------------------------------ */

/** Núcleo puro: cabeceras + filas de objetos (de CSV o de Excel) → filas validadas. */
export function leerFilas(
  cabeceras: readonly string[],
  filasCrudas: readonly Record<string, unknown>[],
  ahora = new Date().toISOString(),
): LecturaHoja {
  const reconocidas: Partial<Record<CampoHoja, string>> = {};
  const ignoradas: string[] = [];
  for (const cabecera of cabeceras) {
    const campo = reconocerCampo(cabecera);
    if (campo && !reconocidas[campo]) reconocidas[campo] = cabecera;
    else if (cabecera.trim()) ignoradas.push(cabecera);
  }
  const faltan = CAMPOS_OBLIGATORIOS.filter((c) => !reconocidas[c]);

  const entradas: EntradaFila[] = [];
  filasCrudas.forEach((cruda, i) => {
    const campos = camposVacios();
    for (const campo of CAMPOS) {
      const cabecera = reconocidas[campo];
      if (cabecera) campos[campo] = limpiar(cruda[cabecera]);
    }
    if (Object.values(campos).some((v) => v !== "")) entradas.push({ fila: i + 2, campos });
  });

  return { filas: analizarFilas(entradas, ahora), columnas: { reconocidas, ignoradas, faltan } };
}

/** CSV (con o sin BOM, separado por comas, punto y coma o tabuladores). */
export function leerCsv(texto: string, ahora?: string): LecturaHoja {
  const limpio = texto.replace(/^\uFEFF/, "");
  const r = Papa.parse<Record<string, string>>(limpio, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (h) => h.trim(),
  });
  return leerFilas(r.meta.fields ?? [], r.data, ahora);
}

/** UTF-8 y, si no lo es, Windows-1252 (CSV antiguos de Excel). */
export async function leerTextoArchivo(archivo: Blob): Promise<string> {
  const buffer = await archivo.arrayBuffer();
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  } catch {
    return new TextDecoder("windows-1252").decode(buffer);
  }
}

/** .xlsx / .xls: SheetJS se carga solo ahora (import dinámico), en la primera hoja. */
export async function leerExcel(archivo: Blob, ahora?: string): Promise<LecturaHoja> {
  const XLSX = await import("xlsx");
  const libro = XLSX.read(await archivo.arrayBuffer(), { type: "array" });
  const nombreHoja = libro.SheetNames[0];
  const hoja = nombreHoja ? libro.Sheets[nombreHoja] : undefined;
  if (!hoja) throw new Error("El libro no tiene hojas.");
  const filas = XLSX.utils.sheet_to_json<Record<string, unknown>>(hoja, { defval: "", raw: true });
  const cabeceras = (XLSX.utils.sheet_to_json<unknown[]>(hoja, { header: 1, defval: "" })[0] ?? []).map(String);
  return leerFilas(cabeceras, filas, ahora);
}

export async function leerArchivoHoja(archivo: File): Promise<LecturaHoja> {
  if (/\.(xlsx|xls|xlsm)$/i.test(archivo.name)) return leerExcel(archivo);
  if (/\.(csv|txt|tsv)$/i.test(archivo.name) || archivo.type.startsWith("text/")) {
    return leerCsv(await leerTextoArchivo(archivo));
  }
  throw new Error("Formato no admitido: sube un .csv, .xlsx o .xls exportado de la hoja de cálculo.");
}

/* ------------------------------------------------------------------ */
/* Aplicar al borrador                                                 */
/* ------------------------------------------------------------------ */

export type ModoImportacion = "reemplazar" | "combinar";

export function puntosImportables(filas: readonly FilaImportada[]): Punto[] {
  return filas.flatMap((f) => (f.punto ? [f.punto] : []));
}

const sinFecha = ({ actualizadoEn: _fecha, ...resto }: Punto) => JSON.stringify(resto);

/** Si un punto no ha cambiado respecto al existente conserva su fecha de actualización. */
function conservarFecha(nuevo: Punto, existente: Punto | undefined): Punto {
  return existente && sinFecha(existente) === sinFecha(nuevo) ? existente : nuevo;
}

/**
 * «Reemplazar todo»: el resultado son exactamente los puntos importados.
 * «Combinar»: actualiza por id, añade los nuevos y NO borra los ausentes.
 */
export function aplicarImportacion(actuales: readonly Punto[], nuevos: readonly Punto[], modo: ModoImportacion): Punto[] {
  const porId = new Map(actuales.map((p) => [p.id, p]));
  if (modo === "reemplazar") return nuevos.map((n) => conservarFecha(n, porId.get(n.id)));

  const nuevosPorId = new Map(nuevos.map((n) => [n.id, n]));
  const actualizados = actuales.map((a) => {
    const n = nuevosPorId.get(a.id);
    return n ? conservarFecha(n, a) : a;
  });
  return [...actualizados, ...nuevos.filter((n) => !porId.has(n.id))];
}
