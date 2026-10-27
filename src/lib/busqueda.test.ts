import { describe, expect, it } from "vitest";
import {
  buscar,
  centroideCodigoPostal,
  coincideTexto,
  esCodigoPostal,
  normalizar,
  tiposDisponibles,
} from "./busqueda";
import { haversineKm } from "./geo";
import { punto } from "../test/fabrica";

const puntos = [
  punto({ id: "a", nombre: "Biblioteca Ñandú", tipo: "Cultura", direccion: "Avenida de la Paz 3", ciudad: "Altamira", codigoPostal: "11001", lat: 12.14, lng: -86.25 }),
  punto({ id: "b", nombre: "Farmacia Sol", tipo: "Salud", direccion: "Calle Mayor 10", ciudad: "Bolonia", codigoPostal: "11001", lat: 12.142, lng: -86.252 }),
  punto({ id: "c", nombre: "Oficina Norte", tipo: "Salud", direccion: "Camino Real 5", ciudad: "Linda Vista", codigoPostal: "11002", lat: 12.2, lng: -86.3 }),
  punto({ id: "d", nombre: "Oficina Sur", tipo: "Salud", direccion: "Camino Sur 7", ciudad: "Reparto Schick", codigoPostal: "11003", lat: 12.08, lng: -86.2, estado: "cerrado_temporal" }),
];

describe("normalizar", () => {
  it("quita tildes y mayúsculas", () => {
    expect(normalizar("  ÁÉÍÓÚ Ñandú Ü ")).toBe("aeiou nandu u");
  });
});

describe("búsqueda por texto", () => {
  it("encuentra sin tildes ni mayúsculas en nombre, dirección, ciudad y tipo", () => {
    expect(coincideTexto(puntos[0]!, "BIBLIOTECA nandu")).toBe(true);
    expect(coincideTexto(puntos[0]!, "avenida paz")).toBe(true);
    expect(coincideTexto(puntos[0]!, "altamira")).toBe(true);
    expect(coincideTexto(puntos[0]!, "cultura")).toBe(true);
    expect(coincideTexto(puntos[0]!, "farmacia")).toBe(false);
  });

  it("todas las palabras deben coincidir", () => {
    const r = buscar(puntos, { texto: "oficina sur", tipos: [] });
    expect(r.items.map((i) => i.punto.id)).toEqual(["d"]);
    expect(r.modo).toBe("texto");
  });

  it("filtra por tipos (selección múltiple) y vacío significa todos", () => {
    expect(buscar(puntos, { texto: "", tipos: [] }).items).toHaveLength(4);
    expect(buscar(puntos, { texto: "", tipos: ["Cultura"] }).items).toHaveLength(1);
    expect(buscar(puntos, { texto: "", tipos: ["Cultura", "Salud"] }).items).toHaveLength(4);
  });

  it("los tipos disponibles salen de los datos, sin repetidos y ordenados", () => {
    expect(tiposDisponibles(puntos)).toEqual(["Cultura", "Salud"]);
  });

  it("sin resultados devuelve lista vacía", () => {
    expect(buscar(puntos, { texto: "zzz", tipos: [] }).items).toEqual([]);
  });
});

describe("búsqueda por código postal", () => {
  it("reconoce el formato de código postal", () => {
    expect(esCodigoPostal(" 11001 ")).toBe(true);
    expect(esCodigoPostal("1100")).toBe(false);
    expect(esCodigoPostal("calle 11001")).toBe(false);
  });

  it("el centro del CP es el centroide de los puntos que lo comparten", () => {
    const c = centroideCodigoPostal(puntos, "11001")!;
    expect(c.lat).toBeCloseTo(12.141, 6);
    expect(c.lng).toBeCloseTo(-86.251, 6);
    expect(centroideCodigoPostal(puntos, "99999")).toBeNull();
  });

  it("ordena TODO el listado por distancia al centroide y da la distancia", () => {
    const r = buscar(puntos, { texto: "11001", tipos: [] });
    expect(r.modo).toBe("codigoPostal");
    expect(r.items).toHaveLength(4);
    const distancias = r.items.map((i) => i.distanciaKm!);
    const abiertos = r.items.filter((i) => i.punto.estado === "abierto").map((i) => i.distanciaKm!);
    expect(abiertos).toEqual([...abiertos].sort((x, y) => x - y));
    expect(distancias.every((d) => d >= 0)).toBe(true);
    // Los dos puntos del CP están a la misma distancia del centroide; después el resto.
    expect(r.items.slice(0, 2).map((i) => i.punto.codigoPostal)).toEqual(["11001", "11001"]);
    expect(r.items[2]?.punto.id).toBe("c");
    expect(r.items[3]?.punto.id).toBe("d"); // cerrado, el último
    expect(r.items[2]?.distanciaKm).toBeCloseTo(haversineKm(r.origen!, puntos[2]!), 10);
  });

  it("un CP inexistente avisa pero no bloquea: el listado sigue completo", () => {
    const r = buscar(puntos, { texto: "99999", tipos: [] });
    expect(r.codigoPostalInexistente).toBe(true);
    expect(r.items).toHaveLength(4);
    expect(r.modo).toBe("ninguno");
  });

  it("combina CP con filtro por tipo", () => {
    const r = buscar(puntos, { texto: "11001", tipos: ["Salud"] });
    expect(r.items.map((i) => i.punto.id)).toEqual(["b", "c", "d"]);
  });
});

describe("cercanía", () => {
  it("ordena por distancia real a la ubicación del usuario", () => {
    const r = buscar(puntos, { texto: "", tipos: [], ubicacion: { lat: 12.19, lng: -86.29 } });
    expect(r.modo).toBe("cercania");
    expect(r.items[0]?.punto.id).toBe("c");
    expect(r.items.at(-1)?.punto.id).toBe("d");
  });
});
