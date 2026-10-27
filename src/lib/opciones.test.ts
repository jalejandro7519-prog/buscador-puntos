import { describe, expect, it } from "vitest";
import {
  ATRIBUCION_OSM,
  TILE_URL_POR_DEFECTO,
  opcionesDesdeAtributos,
  parsearAltura,
  parsearCentro,
  parsearTileUrl,
  urlSegura,
} from "./opciones";

const desde = (atributos: Record<string, string>) => opcionesDesdeAtributos((n) => atributos[n] ?? null);

describe("opciones desde atributos", () => {
  it("valores por defecto: OSM, 600px y /puntos.json", () => {
    expect(desde({})).toMatchObject({ src: "/puntos.json", tileUrl: TILE_URL_POR_DEFECTO, atribucion: ATRIBUCION_OSM, altura: "600px", idioma: "es" });
  });

  it("lee todos los atributos documentados", () => {
    const o = desde({
      "data-src": "https://x.es/puntos.json",
      "data-tile-url": "https://t.es/{z}/{x}/{y}.png",
      "data-atribucion": "© <b>Proveedor</b>",
      "data-centro": "12.136, -86.251",
      "data-zoom": "14",
      "data-altura": "80vh",
      "data-logo": "https://x.es/logo.svg",
    });
    expect(o).toMatchObject({ src: "https://x.es/puntos.json", tileUrl: "https://t.es/{z}/{x}/{y}.png", zoom: 14, altura: "80vh", logo: "https://x.es/logo.svg" });
    expect(o.centro).toEqual({ lat: 12.136, lng: -86.251 });
    expect(o.atribucion).toBe("© &lt;b&gt;Proveedor&lt;/b&gt;"); // texto, nunca HTML
  });

  it("rechaza lo no válido", () => {
    expect(parsearCentro("91,0")).toBeUndefined();
    expect(parsearCentro("12")).toBeUndefined();
    expect(parsearAltura("calc(100% - 1px)")).toBe("600px");
    expect(parsearTileUrl("https://t.es/tile.png")).toBeUndefined(); // sin {z}/{x}/{y}
    expect(urlSegura("javascript:alert(1)")).toBeUndefined();
    expect(urlSegura("//evil.com/x")).toBeUndefined();
    expect(urlSegura("/puntos.json")).toBe("/puntos.json");
  });

  it("con teselas propias y sin atribución propia se mantiene la de OpenStreetMap (los datos son suyos)", () => {
    expect(desde({ "data-tile-url": "https://t.es/{z}/{x}/{y}.png" }).atribucion).toBe(ATRIBUCION_OSM);
  });
});
