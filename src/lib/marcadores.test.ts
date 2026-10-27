import { describe, expect, it } from "vitest";
import { MARCA } from "../config/marca";
import { agruparPuntos } from "./agrupar";
import { estiloMarcador, svgMarcador } from "./marcadores";
import { ordenarPorDistancia } from "./geo";
import { punto } from "../test/fabrica";

describe("estiloMarcador", () => {
  it("abierto: color de la marca (variable CSS) y punto central", () => {
    const e = estiloMarcador({ estado: "abierto" }, false);
    expect(e.variante).toBe("abierto");
    expect(e.relleno).toContain("--bp-color-primario");
    expect(e.glifo).toBe("punto");
  });

  it("cerrado temporalmente: gris con icono de pausa, distinto del abierto", () => {
    const abierto = estiloMarcador({ estado: "abierto" }, false);
    const cerrado = estiloMarcador({ estado: "cerrado_temporal" }, false);
    expect(cerrado.relleno).toBe(MARCA.colorCerrado);
    expect(cerrado.glifo).toBe("pausa");
    expect(svgMarcador(cerrado)).not.toBe(svgMarcador(abierto));
    expect(svgMarcador(cerrado)).toContain(MARCA.colorCerrado);
    expect(svgMarcador(cerrado)).toContain("<rect");
  });

  it("seleccionado: más grande y con borde de acento", () => {
    const normal = estiloMarcador({ estado: "abierto" }, false);
    const sel = estiloMarcador({ estado: "abierto" }, true);
    expect(sel.tam).toBeGreaterThan(normal.tam);
    expect(sel.borde).toContain("--bp-color-acento");
  });

  it("el SVG no usa imágenes externas", () => {
    expect(svgMarcador(estiloMarcador({ estado: "abierto" }, false))).not.toMatch(/<image|href=|url\(/);
  });
});

describe("agruparPuntos (a partir de 300 puntos)", () => {
  const items = ordenarPorDistancia(
    [
      punto({ id: "1", lat: 12.136, lng: -86.251 }),
      punto({ id: "2", lat: 12.1361, lng: -86.2511 }),
      punto({ id: "3", lat: 12.5, lng: -86.9 }),
    ],
    null,
  );

  it("con zoom bajo agrupa los cercanos", () => {
    const grupos = agruparPuntos(items, 8);
    expect(grupos).toHaveLength(2);
    expect(grupos.map((g) => g.items.length).sort()).toEqual([1, 2]);
  });

  it("con zoom alto no agrupa", () => {
    expect(agruparPuntos(items, 17)).toHaveLength(3);
  });

  it("conserva todos los puntos", () => {
    expect(agruparPuntos(items, 5).reduce((n, g) => n + g.items.length, 0)).toBe(3);
  });
});
