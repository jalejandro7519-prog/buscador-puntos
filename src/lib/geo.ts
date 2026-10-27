import type { Punto } from "./esquema";

export interface Coord {
  lat: number;
  lng: number;
}

export interface PuntoConDistancia {
  punto: Punto;
  /** null cuando no hay punto de referencia. */
  distanciaKm: number | null;
}

export const RADIO_TIERRA_KM = 6371.0088;

const aRad = (grados: number) => (grados * Math.PI) / 180;

/** Distancia ortodrómica (Haversine) en km entre dos coordenadas WGS84. */
export function haversineKm(a: Coord, b: Coord): number {
  const dLat = aRad(b.lat - a.lat);
  const dLng = aRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(aRad(a.lat)) * Math.cos(aRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * RADIO_TIERRA_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Media aritmética de coordenadas (válida a escala municipal). */
export function centroide(coords: readonly Coord[]): Coord | null {
  if (coords.length === 0) return null;
  const suma = coords.reduce((acc, c) => ({ lat: acc.lat + c.lat, lng: acc.lng + c.lng }), { lat: 0, lng: 0 });
  return { lat: suma.lat / coords.length, lng: suma.lng / coords.length };
}

const porNombre = (a: Punto, b: Punto) => a.nombre.localeCompare(b.nombre, "es", { numeric: true });
const abiertoPrimero = (a: Punto, b: Punto) =>
  Number(a.estado === "cerrado_temporal") - Number(b.estado === "cerrado_temporal");

/**
 * Regla de orden (ver DECISIONES.md): primero los abiertos y luego los cerrados
 * temporalmente; dentro de cada grupo, por distancia al origen (si lo hay) y, en
 * empate o sin origen, por nombre. El orden es estable.
 */
export function ordenarPorDistancia(puntos: readonly Punto[], origen: Coord | null): PuntoConDistancia[] {
  const conDistancia = puntos.map((punto) => ({
    punto,
    distanciaKm: origen ? haversineKm(origen, punto) : null,
  }));
  return conDistancia.sort((a, b) => {
    const estado = abiertoPrimero(a.punto, b.punto);
    if (estado !== 0) return estado;
    if (a.distanciaKm !== null && b.distanciaKm !== null && a.distanciaKm !== b.distanciaKm) {
      return a.distanciaKm - b.distanciaKm;
    }
    return porNombre(a.punto, b.punto);
  });
}

/** «0,4 km», «12,3 km». */
export function formatearDistancia(km: number): string {
  return `${km.toFixed(1).replace(".", ",")} km`;
}
