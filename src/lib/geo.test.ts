import { describe, expect, it } from "vitest";
import { centroide, formatearDistancia, haversineKm, ordenarPorDistancia } from "./geo";
import { punto } from "../test/fabrica";

describe("haversineKm", () => {
  it("es 0 entre un punto y sí mismo", () => {
    expect(haversineKm({ lat: 12.136, lng: -86.251 }, { lat: 12.136, lng: -86.251 })).toBe(0);
  });

  it("un grado de longitud en el ecuador son ≈111,19 km", () => {
    expect(haversineKm({ lat: 0, lng: 0 }, { lat: 0, lng: 1 })).toBeCloseTo(111.19, 1);
  });

  it("Madrid–Barcelona ≈504,6 km", () => {
    const madrid = { lat: 40.4168, lng: -3.7038 };
    const barcelona = { lat: 41.3851, lng: 2.1734 };
    expect(haversineKm(madrid, barcelona)).toBeGreaterThan(503.5);
    expect(haversineKm(madrid, barcelona)).toBeLessThan(505.5);
  });

  it("París–Londres ≈343,5 km y es simétrica", () => {
    const paris = { lat: 48.8566, lng: 2.3522 };
    const londres = { lat: 51.5074, lng: -0.1278 };
    expect(haversineKm(paris, londres)).toBeCloseTo(343.5, 0);
    expect(haversineKm(londres, paris)).toBeCloseTo(haversineKm(paris, londres), 10);
  });

  it("no usa distancia euclídea: a 60° de latitud un grado de longitud mide la mitad", () => {
    const d = haversineKm({ lat: 60, lng: 0 }, { lat: 60, lng: 1 });
    expect(d).toBeCloseTo(55.6, 1);
  });
});

describe("centroide", () => {
  it("devuelve null sin puntos y la media con puntos", () => {
    expect(centroide([])).toBeNull();
    expect(centroide([{ lat: 10, lng: -80 }, { lat: 12, lng: -84 }])).toEqual({ lat: 11, lng: -82 });
  });
});

describe("ordenarPorDistancia", () => {
  const origen = { lat: 12.136, lng: -86.251 };
  const cerca = punto({ id: "cerca", nombre: "Cerca", lat: 12.137, lng: -86.251 });
  const media = punto({ id: "media", nombre: "Media", lat: 12.15, lng: -86.251 });
  const lejos = punto({ id: "lejos", nombre: "Lejos", lat: 12.2, lng: -86.251 });

  it("ordena de menor a mayor distancia y rellena distanciaKm", () => {
    const r = ordenarPorDistancia([lejos, cerca, media], origen);
    expect(r.map((x) => x.punto.id)).toEqual(["cerca", "media", "lejos"]);
    expect(r[0]?.distanciaKm).toBeCloseTo(0.111, 2);
  });

  it("los cerrados van después de los abiertos aunque estén más cerca", () => {
    const cerrado = punto({ id: "cerrado", nombre: "Cerrado", estado: "cerrado_temporal", lat: 12.1361, lng: -86.251 });
    const r = ordenarPorDistancia([cerrado, lejos, cerca], origen);
    expect(r.map((x) => x.punto.id)).toEqual(["cerca", "lejos", "cerrado"]);
  });

  it("el orden es estable: en empate de distancia decide el nombre y no el orden de entrada", () => {
    const b = punto({ id: "b", nombre: "B", lat: 12.14, lng: -86.251 });
    const a = punto({ id: "a", nombre: "A", lat: 12.14, lng: -86.251 });
    expect(ordenarPorDistancia([b, a], origen).map((x) => x.punto.id)).toEqual(["a", "b"]);
    expect(ordenarPorDistancia([a, b], origen).map((x) => x.punto.id)).toEqual(["a", "b"]);
  });

  it("sin origen ordena por nombre (abiertos primero) y no calcula distancias", () => {
    const cerrado = punto({ id: "c", nombre: "A cerrado", estado: "cerrado_temporal" });
    const r = ordenarPorDistancia([cerrado, lejos, cerca], null);
    expect(r.map((x) => x.punto.id)).toEqual(["cerca", "lejos", "c"]);
    expect(r.every((x) => x.distanciaKm === null)).toBe(true);
  });

  it("ordena «Punto 2» antes que «Punto 10» (orden natural)", () => {
    const p10 = punto({ id: "10", nombre: "Punto 10" });
    const p2 = punto({ id: "2", nombre: "Punto 2" });
    expect(ordenarPorDistancia([p10, p2], null).map((x) => x.punto.id)).toEqual(["2", "10"]);
  });
});

describe("formatearDistancia", () => {
  it("usa coma decimal y un decimal", () => {
    expect(formatearDistancia(0.44)).toBe("0,4 km");
    expect(formatearDistancia(12.34)).toBe("12,3 km");
  });
});
