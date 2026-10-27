import { crearArchivo, parsearArchivo, type ArchivoPuntos, type Punto, type ResultadoParseo } from "./esquema";

export const CLAVE_BORRADOR = "buscador-puntos:borrador:v1";
export const CLAVE_CACHE = "buscador-puntos:cache:v1";
export const CLAVE_SESION_ADMIN = "buscador-puntos:admin:v1";

/** localStorage puede lanzar (modo privado, cuota, bloqueado): nunca debe romper la app. */
function leer(almacen: () => Storage, clave: string): unknown {
  try {
    const bruto = almacen().getItem(clave);
    return bruto ? JSON.parse(bruto) : null;
  } catch {
    return null;
  }
}

function escribir(almacen: () => Storage, clave: string, valor: unknown): boolean {
  try {
    almacen().setItem(clave, JSON.stringify(valor));
    return true;
  } catch {
    return false;
  }
}

function borrar(almacen: () => Storage, clave: string): void {
  try {
    almacen().removeItem(clave);
  } catch {
    /* sin almacenamiento */
  }
}

const local = () => localStorage;
const sesion = () => sessionStorage;

interface CacheGuardada {
  src: string;
  guardadoEn: string;
  archivo: ArchivoPuntos;
}

/** Última lista cargada con éxito desde `src` (null si no hay o es de otra fuente). */
export function leerCache(src: string): ResultadoParseo | null {
  const guardada = leer(local, CLAVE_CACHE) as Partial<CacheGuardada> | null;
  if (!guardada || guardada.src !== src || !guardada.archivo) return null;
  try {
    const r = parsearArchivo(guardada.archivo);
    return r.puntos.length > 0 ? r : null;
  } catch {
    return null;
  }
}

export function guardarCache(src: string, puntos: Punto[], generadoEn: string): void {
  const valor: CacheGuardada = { src, guardadoEn: new Date().toISOString(), archivo: crearArchivo(puntos, generadoEn) };
  escribir(local, CLAVE_CACHE, valor);
}

export function leerBorrador(): ResultadoParseo | null {
  const bruto = leer(local, CLAVE_BORRADOR);
  if (!bruto) return null;
  try {
    return parsearArchivo(bruto);
  } catch {
    return null;
  }
}

export function guardarBorrador(puntos: Punto[]): boolean {
  return escribir(local, CLAVE_BORRADOR, crearArchivo(puntos));
}

export function borrarBorrador(): void {
  borrar(local, CLAVE_BORRADOR);
}

export function sesionAdminActiva(): boolean {
  return leer(sesion, CLAVE_SESION_ADMIN) === true;
}

export function guardarSesionAdmin(activa: boolean): void {
  if (activa) escribir(sesion, CLAVE_SESION_ADMIN, true);
  else borrar(sesion, CLAVE_SESION_ADMIN);
}

/** Descarga y valida `puntos.json`. Lanza si la petición o la estructura fallan. */
export async function cargarPuntos(src: string, signal?: AbortSignal): Promise<ResultadoParseo> {
  const respuesta = await fetch(src, { cache: "no-cache", signal });
  if (!respuesta.ok) throw new Error(`No se pudo cargar ${src} (HTTP ${respuesta.status})`);
  return parsearArchivo(await respuesta.json());
}
