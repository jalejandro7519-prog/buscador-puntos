/**
 * Marca del cliente: ÚNICO sitio donde cambiar colores y valores provisionales.
 * Cada valor se expone como variable CSS (--bp-*) que el anfitrión puede sobrescribir;
 * los valores de este fichero son solo el respaldo (fallback) de esas variables.
 */
export const MARCA = {
  colorPrimario: "#0F6CBD",
  colorAcento: "#F59E0B",
  colorTexto: "#1F2937",
  colorFondo: "#FFFFFF",
  /** Gris de los puntos cerrados temporalmente (contraste AA sobre blanco). */
  colorCerrado: "#6B7280",
  radio: "8px",
  fuente: "inherit",
} as const;

const NOMBRES = {
  primario: ["--bp-color-primario", MARCA.colorPrimario],
  acento: ["--bp-color-acento", MARCA.colorAcento],
  texto: ["--bp-color-texto", MARCA.colorTexto],
  fondo: ["--bp-color-fondo", MARCA.colorFondo],
  radio: ["--bp-radio", MARCA.radio],
  fuente: ["--bp-fuente", MARCA.fuente],
} as const;

export type NombreVariable = keyof typeof NOMBRES;

/** `var(--bp-…, respaldo)`: usable en CSS, en estilos en línea y en SVG. */
export function cssVar(nombre: NombreVariable): string {
  const [variable, respaldo] = NOMBRES[nombre];
  return `var(${variable}, ${respaldo})`;
}
