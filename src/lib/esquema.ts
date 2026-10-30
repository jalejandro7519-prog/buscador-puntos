import { z } from "zod";

export const ESTADOS = ["abierto", "cerrado_temporal"] as const;
export type EstadoPunto = (typeof ESTADOS)[number];

const texto = z.string().trim();
const textoObligatorio = texto.min(1, "obligatorio");
const textoOpcional = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? v : undefined));

/** Un código postal puede llegar como número en un JSON editado a mano. */
const cadena = z.preprocess((v) => (typeof v === "number" ? String(v) : v), texto);

const fechaIso = z
  .string()
  .trim()
  .refine((v) => v === "" || !Number.isNaN(Date.parse(v)), "fecha no válida")
  .optional()
  .transform((v) => (v ? v : undefined));

/** Reseñas breves por punto, escritas y gestionadas desde el panel (no hay envío público: no hay backend). */
export const MAX_RESENAS = 5;
export const MAX_TEXTO_RESENA = 280;

export const resenaSchema = z.object({
  id: textoObligatorio,
  texto: texto.min(1, "obligatorio").max(MAX_TEXTO_RESENA, "máximo " + MAX_TEXTO_RESENA + " caracteres"),
  autor: textoOpcional,
  fecha: z.string().default(() => new Date().toISOString()),
});

/** Una reseña inválida se descarta sola (el punto y las demás reseñas se conservan). */
const resenas = z.preprocess(
  (v) => (Array.isArray(v) ? v.filter((r) => resenaSchema.safeParse(r).success).slice(0, MAX_RESENAS) : undefined),
  z
    .array(resenaSchema)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
);

export const puntoSchema = z.object({
  id: textoObligatorio,
  nombre: textoObligatorio,
  tipo: textoObligatorio,
  direccion: textoObligatorio,
  codigoPostal: cadena.default(""),
  ciudad: texto.default(""),
  telefono: textoOpcional,
  horario: textoOpcional,
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  estado: z.enum(ESTADOS).default("abierto"),
  motivoCierre: textoOpcional,
  reaperturaPrevista: fechaIso,
  resenas,
  actualizadoEn: z.string().default(() => new Date().toISOString()),
});

export interface Resena {
  id: string;
  /** Texto breve (máx. 280 caracteres). */
  texto: string;
  autor?: string;
  /** Fecha-hora ISO. */
  fecha: string;
}

export interface Punto {
  /** Estable; si la hoja no lo trae, se genera de forma determinista (slug nombre+cp). */
  id: string;
  nombre: string;
  tipo: string;
  direccion: string;
  /** Texto, nunca número (conserva ceros). */
  codigoPostal: string;
  ciudad: string;
  telefono?: string;
  /** Texto libre, p. ej. «L-V 8:00-16:00». */
  horario?: string;
  /** WGS84. */
  lat: number;
  lng: number;
  estado: EstadoPunto;
  motivoCierre?: string;
  /** Fecha ISO opcional. */
  reaperturaPrevista?: string;
  /** Reseñas breves gestionadas desde el panel (máx. 5). */
  resenas?: Resena[];
  /** Fecha-hora ISO; la pone la app. */
  actualizadoEn: string;
}

// Comprobación en compilación: la salida del esquema es asignable a Punto.
const _comprobacion = (p: z.infer<typeof puntoSchema>): Punto => p;
void _comprobacion;

export interface ArchivoPuntos {
  version: 1;
  generadoEn: string;
  puntos: Punto[];
}

export interface PuntoDescartado {
  indice: number;
  motivo: string;
}

export interface ResultadoParseo {
  puntos: Punto[];
  generadoEn: string;
  descartados: PuntoDescartado[];
}

/**
 * Valida el contenido de `puntos.json`. Un punto inválido se descarta SOLO él
 * (se registra en consola y se devuelve en `descartados`); un archivo con la
 * estructura general rota lanza un error.
 */
export function parsearArchivo(datos: unknown): ResultadoParseo {
  let lista: unknown[];
  let generadoEn = new Date().toISOString();

  if (Array.isArray(datos)) {
    lista = datos;
  } else if (datos && typeof datos === "object" && Array.isArray((datos as { puntos?: unknown }).puntos)) {
    const obj = datos as { version?: unknown; generadoEn?: unknown; puntos: unknown[] };
    if (obj.version !== undefined && obj.version !== 1) {
      throw new Error(`Versión de archivo no soportada: ${String(obj.version)}`);
    }
    if (typeof obj.generadoEn === "string") generadoEn = obj.generadoEn;
    lista = obj.puntos;
  } else {
    throw new Error("El archivo no tiene el formato esperado: falta la lista «puntos».");
  }

  const puntos: Punto[] = [];
  const descartados: PuntoDescartado[] = [];
  const ids = new Set<string>();

  lista.forEach((crudo, indice) => {
    const r = puntoSchema.safeParse(crudo);
    let motivo: string | null = null;
    if (!r.success) {
      motivo = r.error.issues.map((i) => `${i.path.join(".") || "punto"}: ${i.message}`).join("; ");
    } else if (ids.has(r.data.id)) {
      motivo = `id duplicado «${r.data.id}»`;
    } else {
      ids.add(r.data.id);
      puntos.push({ ...r.data, actualizadoEn: r.data.actualizadoEn || generadoEn });
    }
    if (motivo) {
      descartados.push({ indice, motivo });
      console.warn(`[buscador-puntos] punto #${indice} descartado: ${motivo}`);
    }
  });

  return { puntos, generadoEn, descartados };
}

export function crearArchivo(puntos: Punto[], generadoEn = new Date().toISOString()): ArchivoPuntos {
  return { version: 1, generadoEn, puntos };
}
