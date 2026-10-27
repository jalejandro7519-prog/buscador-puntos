import type { Coord } from "./geo";

export const TILE_URL_POR_DEFECTO = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
export const ATRIBUCION_OSM = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
export const ALTURA_POR_DEFECTO = "600px";

export interface OpcionesBuscador {
  /** URL del puntos.json publicado. */
  src: string;
  tileUrl: string;
  /** HTML de confianza (la de OSM) o texto ya escapado. */
  atribucion: string;
  centro?: Coord;
  zoom?: number;
  /** Altura en escritorio (longitud CSS). */
  altura: string;
  idioma: "es";
  logo?: string;
}

export const OPCIONES_POR_DEFECTO: OpcionesBuscador = {
  src: "/puntos.json",
  tileUrl: TILE_URL_POR_DEFECTO,
  atribucion: ATRIBUCION_OSM,
  altura: ALTURA_POR_DEFECTO,
  idioma: "es",
};

/** Solo http(s) o rutas relativas: nada de javascript:, data:, etc. */
export function urlSegura(valor: string | null | undefined): string | undefined {
  const v = valor?.trim();
  if (!v) return undefined;
  if (/^https?:\/\//i.test(v)) return v;
  if (/^[a-z][a-z0-9+.-]*:/i.test(v) || v.startsWith("//")) return undefined;
  return v;
}

export function escaparHtml(texto: string): string {
  return texto.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c);
}

/** «12.136,-86.251» → coordenadas válidas, o undefined. */
export function parsearCentro(valor: string | null | undefined): Coord | undefined {
  if (!valor) return undefined;
  const partes = valor.split(",").map((p) => Number(p.trim()));
  const [lat, lng] = partes;
  if (partes.length !== 2 || lat === undefined || lng === undefined) return undefined;
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return undefined;
  return { lat, lng };
}

export function parsearZoom(valor: string | null | undefined): number | undefined {
  if (!valor) return undefined;
  const n = Number(valor);
  return Number.isInteger(n) && n >= 1 && n <= 19 ? n : undefined;
}

/** Longitud CSS simple (px, rem, em, vh, %); si no es válida, la de por defecto. */
export function parsearAltura(valor: string | null | undefined): string {
  const v = valor?.trim();
  return v && /^\d+(\.\d+)?(px|rem|em|vh|svh|dvh|%)$/.test(v) ? v : ALTURA_POR_DEFECTO;
}

/** Plantilla de teselas válida: URL segura con {z}, {x} e {y}. */
export function parsearTileUrl(valor: string | null | undefined): string | undefined {
  const url = urlSegura(valor);
  return url && /\{z\}/.test(url) && /\{x\}/.test(url) && /\{y\}/.test(url) ? url : undefined;
}

type Lector = (nombre: string) => string | null;

/** Opciones a partir de los atributos `data-*` del elemento (o de cualquier lector). */
export function opcionesDesdeAtributos(leer: Lector): OpcionesBuscador {
  const tileUrl = parsearTileUrl(leer("data-tile-url"));
  const atribucionPropia = leer("data-atribucion")?.trim();
  return {
    src: urlSegura(leer("data-src")) ?? OPCIONES_POR_DEFECTO.src,
    tileUrl: tileUrl ?? TILE_URL_POR_DEFECTO,
    atribucion: atribucionPropia ? escaparHtml(atribucionPropia) : ATRIBUCION_OSM,
    centro: parsearCentro(leer("data-centro")),
    zoom: parsearZoom(leer("data-zoom")),
    altura: parsearAltura(leer("data-altura")),
    idioma: "es",
    logo: urlSegura(leer("data-logo")),
  };
}

/** Por encima de este número de puntos el mapa agrupa marcadores (con carga diferida). */
export const UMBRAL_AGRUPACION = 300;
/** A partir de este zoom ya no se agrupa. */
export const ZOOM_SIN_AGRUPAR = 16;
/** Centro inicial si no hay `data-centro` ni puntos: Managua. */
export const CENTRO_POR_DEFECTO = { lat: 12.136, lng: -86.251 } as const;
