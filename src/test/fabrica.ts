import type { Punto } from "../lib/esquema";

/** Punto de prueba con valores razonables; sobrescribe lo que haga falta. */
export function punto(sobre: Partial<Punto> = {}): Punto {
  return {
    id: "p1",
    nombre: "Punto de prueba",
    tipo: "Información",
    direccion: "Calle Falsa 1",
    codigoPostal: "11001",
    ciudad: "Managua",
    lat: 12.136,
    lng: -86.251,
    estado: "abierto",
    actualizadoEn: "2026-10-27T09:00:00.000Z",
    ...sobre,
  };
}
