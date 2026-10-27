import { MARCA, cssVar } from "../config/marca";
import type { Punto } from "./esquema";

export interface EstiloMarcador {
  variante: "abierto" | "cerrado";
  seleccionado: boolean;
  /** Diámetro del icono en px. */
  tam: number;
  relleno: string;
  borde: string;
  /** punto = abierto; pausa = cerrado temporalmente. */
  glifo: "punto" | "pausa";
}

/** Marcador de la marca para abiertos; gris con icono de pausa para cerrados temporalmente. */
export function estiloMarcador(punto: Pick<Punto, "estado">, seleccionado: boolean): EstiloMarcador {
  const cerrado = punto.estado === "cerrado_temporal";
  return {
    variante: cerrado ? "cerrado" : "abierto",
    seleccionado,
    tam: seleccionado ? 38 : 30,
    relleno: cerrado ? MARCA.colorCerrado : cssVar("primario"),
    borde: seleccionado ? cssVar("acento") : "#ffffff",
    glifo: cerrado ? "pausa" : "punto",
  };
}

/** Caja táctil del marcador (el dibujo es menor): más fácil de pulsar con el dedo. */
export const CAJA_MARCADOR = 40;

/** Opciones de `L.divIcon` para un marcador (sin depender de Leaflet, para poder probarlo). */
export function opcionesIcono(e: EstiloMarcador) {
  return {
    html: svgMarcador(e),
    className: "bp-marcador",
    iconSize: [CAJA_MARCADOR, CAJA_MARCADOR] as [number, number],
    iconAnchor: [CAJA_MARCADOR / 2, CAJA_MARCADOR / 2] as [number, number],
    popupAnchor: [0, -e.tam / 2] as [number, number],
  };
}

/** SVG ligero (sin imágenes externas). Los colores van en `style` para admitir var(). */
export function svgMarcador(e: EstiloMarcador): string {
  const anchoBorde = e.seleccionado ? 4 : 3;
  const glifo =
    e.glifo === "pausa"
      ? '<rect x="11.5" y="10" width="3" height="12" rx="1" style="fill:#fff"/><rect x="17.5" y="10" width="3" height="12" rx="1" style="fill:#fff"/>'
      : '<circle cx="16" cy="16" r="4" style="fill:#fff"/>';
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${e.tam}" height="${e.tam}" viewBox="0 0 32 32" aria-hidden="true" focusable="false">` +
    `<circle cx="16" cy="16" r="${16 - anchoBorde / 2 - 0.5}" style="fill:${e.relleno};stroke:${e.borde};stroke-width:${anchoBorde}"/>` +
    glifo +
    "</svg>"
  );
}

export function svgGrupo(cantidad: number): string {
  return (
    '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40" aria-hidden="true" focusable="false">' +
    `<circle cx="20" cy="20" r="18" style="fill:${cssVar("primario")};stroke:#fff;stroke-width:3"/>` +
    `<text x="20" y="25" text-anchor="middle" style="fill:#fff;font:700 14px system-ui,sans-serif">${cantidad}</text>` +
    "</svg>"
  );
}
