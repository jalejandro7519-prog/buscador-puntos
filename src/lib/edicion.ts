import Papa from "papaparse";
import { crearArchivo, puntoSchema, type Punto } from "./esquema";
import { parsearFecha, parsearNumero } from "./importar";
import { generarId, idUnico } from "./texto";

/** Contenido de un punto sin la fecha de actualización (para comparar). */
function contenido({ actualizadoEn: _fecha, ...resto }: Punto): string {
  return JSON.stringify(resto, Object.keys(resto).sort());
}

/** ¿Difiere el borrador de lo publicado? Ignora el orden y la fecha de actualización. */
export function hayCambios(borrador: readonly Punto[], publicado: readonly Punto[]): boolean {
  if (borrador.length !== publicado.length) return true;
  const a = new Map(borrador.map((p) => [p.id, contenido(p)]));
  return publicado.some((p) => a.get(p.id) !== contenido(p));
}

/** Inserta o reemplaza por id; marca la fecha de actualización. */
export function guardarPunto(puntos: readonly Punto[], punto: Punto, ahora = new Date().toISOString()): Punto[] {
  const nuevo = { ...punto, actualizadoEn: ahora };
  return puntos.some((p) => p.id === punto.id)
    ? puntos.map((p) => (p.id === punto.id ? nuevo : p))
    : [...puntos, nuevo];
}

export function borrarPunto(puntos: readonly Punto[], id: string): Punto[] {
  return puntos.filter((p) => p.id !== id);
}

/** Un único interruptor: cierra (con motivo y reapertura opcionales) o reabre (limpia ambos). */
export function fijarCierre(
  puntos: readonly Punto[],
  id: string,
  cerrado: boolean,
  motivoCierre?: string,
  reaperturaPrevista?: string,
  ahora = new Date().toISOString(),
): Punto[] {
  return puntos.map((p) => {
    if (p.id !== id) return p;
    const { motivoCierre: _m, reaperturaPrevista: _r, ...base } = p;
    return cerrado
      ? {
          ...base,
          estado: "cerrado_temporal" as const,
          ...(motivoCierre?.trim() ? { motivoCierre: motivoCierre.trim() } : {}),
          ...(reaperturaPrevista ? { reaperturaPrevista } : {}),
          actualizadoEn: ahora,
        }
      : { ...base, estado: "abierto" as const, actualizadoEn: ahora };
  });
}

/* ---------------- Formulario ---------------- */

export interface CamposFormulario {
  nombre: string;
  tipo: string;
  direccion: string;
  codigoPostal: string;
  ciudad: string;
  telefono: string;
  horario: string;
  lat: string;
  lng: string;
  cerrado: boolean;
  motivoCierre: string;
  reaperturaPrevista: string;
}

export type ErroresFormulario = Partial<Record<keyof CamposFormulario, string>>;

export function formularioVacio(): CamposFormulario {
  return {
    nombre: "",
    tipo: "",
    direccion: "",
    codigoPostal: "",
    ciudad: "",
    telefono: "",
    horario: "",
    lat: "",
    lng: "",
    cerrado: false,
    motivoCierre: "",
    reaperturaPrevista: "",
  };
}

export function formularioDesdePunto(p: Punto): CamposFormulario {
  return {
    nombre: p.nombre,
    tipo: p.tipo,
    direccion: p.direccion,
    codigoPostal: p.codigoPostal,
    ciudad: p.ciudad,
    telefono: p.telefono ?? "",
    horario: p.horario ?? "",
    lat: String(p.lat),
    lng: String(p.lng),
    cerrado: p.estado === "cerrado_temporal",
    motivoCierre: p.motivoCierre ?? "",
    reaperturaPrevista: p.reaperturaPrevista ?? "",
  };
}

/** Valida el formulario y construye el punto; conserva id y fecha si se está editando. */
export function puntoDesdeFormulario(
  campos: CamposFormulario,
  existentes: readonly Punto[],
  editando: Punto | null,
  ahora = new Date().toISOString(),
): { punto: Punto } | { errores: ErroresFormulario } {
  const errores: ErroresFormulario = {};
  const nombre = campos.nombre.trim();
  const tipo = campos.tipo.trim();
  const direccion = campos.direccion.trim();
  if (!nombre) errores.nombre = "Escribe el nombre.";
  if (!tipo) errores.tipo = "Escribe o elige un tipo.";
  if (!direccion) errores.direccion = "Escribe la dirección.";

  const lat = parsearNumero(campos.lat);
  const lng = parsearNumero(campos.lng);
  if (lat === null) errores.lat = "Latitud no válida (por ejemplo 12.1364).";
  else if (Math.abs(lat) > 90) errores.lat = "La latitud debe estar entre −90 y 90.";
  if (lng === null) errores.lng = "Longitud no válida (por ejemplo −86.251).";
  else if (Math.abs(lng) > 180) errores.lng = "La longitud debe estar entre −180 y 180.";

  let reapertura: string | undefined;
  if (campos.cerrado && campos.reaperturaPrevista.trim()) {
    const f = parsearFecha(campos.reaperturaPrevista);
    if (f) reapertura = f;
    else errores.reaperturaPrevista = "Fecha no válida.";
  }
  if (Object.keys(errores).length > 0 || lat === null || lng === null) return { errores };

  const cp = campos.codigoPostal.trim();
  const id =
    editando?.id ??
    idUnico(
      generarId(nombre, cp),
      new Set(existentes.map((p) => p.id)),
    );
  const candidato: Punto = {
    id,
    nombre,
    tipo,
    direccion,
    codigoPostal: cp,
    ciudad: campos.ciudad.trim(),
    ...(campos.telefono.trim() ? { telefono: campos.telefono.trim() } : {}),
    ...(campos.horario.trim() ? { horario: campos.horario.trim() } : {}),
    lat,
    lng,
    estado: campos.cerrado ? "cerrado_temporal" : "abierto",
    ...(campos.cerrado && campos.motivoCierre.trim() ? { motivoCierre: campos.motivoCierre.trim() } : {}),
    ...(reapertura ? { reaperturaPrevista: reapertura } : {}),
    actualizadoEn: ahora,
  };
  const r = puntoSchema.safeParse(candidato);
  if (!r.success) return { errores: { nombre: r.error.issues[0]?.message ?? "Datos no válidos." } };
  return { punto: candidato };
}

/* ---------------- Exportar ---------------- */

/** `puntos.json` listo para publicar. */
export function aJson(puntos: readonly Punto[], generadoEn = new Date().toISOString()): string {
  return JSON.stringify(crearArchivo([...puntos], generadoEn), null, 2) + "\n";
}

/** Evita que Excel interprete un texto como fórmula (=, @, +x, -x). Las coordenadas no se tocan. */
function protegerFormula(valor: string): string {
  return /^([=@\t\r]|[+-][^\d\s(])/.test(valor) ? `'${valor}` : valor;
}

/** CSV con las mismas cabeceras que acepta la importación (ida y vuelta con la hoja). */
export function aCsv(puntos: readonly Punto[]): string {
  const filas = puntos.map((p) => ({
    Id: p.id,
    Nombre: protegerFormula(p.nombre),
    Tipo: protegerFormula(p.tipo),
    Dirección: protegerFormula(p.direccion),
    "Código postal": p.codigoPostal,
    Ciudad: protegerFormula(p.ciudad),
    Teléfono: p.telefono ?? "",
    Horario: protegerFormula(p.horario ?? ""),
    Latitud: p.lat,
    Longitud: p.lng,
    Estado: p.estado === "cerrado_temporal" ? "cerrado temporal" : "abierto",
    "Motivo cierre": protegerFormula(p.motivoCierre ?? ""),
    "Reapertura prevista": p.reaperturaPrevista ?? "",
  }));
  // BOM para que Excel reconozca UTF-8.
  return "﻿" + Papa.unparse(filas, { newline: "\r\n" });
}

export function descargarArchivo(nombre: string, contenidoTexto: string, mime: string): void {
  const url = URL.createObjectURL(new Blob([contenidoTexto], { type: mime }));
  const enlace = document.createElement("a");
  enlace.href = url;
  enlace.download = nombre;
  document.body.append(enlace);
  enlace.click();
  enlace.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
