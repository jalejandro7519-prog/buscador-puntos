import type { PuntoConDistancia } from "./geo";
import { ZOOM_SIN_AGRUPAR } from "./opciones";


export interface Grupo {
  lat: number;
  lng: number;
  items: PuntoConDistancia[];
}

/** Proyección Web Mercator a píxeles del mundo en el zoom dado. */
export function proyectar(lat: number, lng: number, zoom: number): { x: number; y: number } {
  const escala = 256 * 2 ** zoom;
  const seno = Math.sin((Math.max(-85.0511, Math.min(85.0511, lat)) * Math.PI) / 180);
  return {
    x: ((lng + 180) / 360) * escala,
    y: (0.5 - Math.log((1 + seno) / (1 - seno)) / (4 * Math.PI)) * escala,
  };
}

/** Agrupa por celdas de `celdaPx` píxeles. Sin agrupar (un grupo por punto) desde ZOOM_SIN_AGRUPAR. */
export function agruparPuntos(items: readonly PuntoConDistancia[], zoom: number, celdaPx = 60): Grupo[] {
  if (zoom >= ZOOM_SIN_AGRUPAR) {
    return items.map((i) => ({ lat: i.punto.lat, lng: i.punto.lng, items: [i] }));
  }
  const celdas = new Map<string, PuntoConDistancia[]>();
  for (const item of items) {
    const { x, y } = proyectar(item.punto.lat, item.punto.lng, zoom);
    const clave = `${Math.floor(x / celdaPx)}:${Math.floor(y / celdaPx)}`;
    const celda = celdas.get(clave);
    if (celda) celda.push(item);
    else celdas.set(clave, [item]);
  }
  return [...celdas.values()].map((grupo) => ({
    lat: grupo.reduce((s, i) => s + i.punto.lat, 0) / grupo.length,
    lng: grupo.reduce((s, i) => s + i.punto.lng, 0) / grupo.length,
    items: grupo,
  }));
}
