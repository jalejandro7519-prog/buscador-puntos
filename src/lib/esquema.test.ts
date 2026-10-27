import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parsearArchivo } from "./esquema";
import { generarId, idUnico } from "./texto";

const valido = {
  id: "a",
  nombre: "Punto demo 01",
  tipo: "Información",
  direccion: "Calle 1",
  codigoPostal: "01001",
  ciudad: "Managua",
  lat: 12.1,
  lng: -86.2,
  estado: "abierto",
  actualizadoEn: "2026-10-27T09:00:00.000Z",
};

describe("parsearArchivo", () => {
  beforeEach(() => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });
  afterEach(() => vi.restoreAllMocks());

  it("acepta el formato {version, generadoEn, puntos} y conserva el código postal como texto", () => {
    const r = parsearArchivo({ version: 1, generadoEn: "2026-10-27T00:00:00Z", puntos: [valido] });
    expect(r.puntos).toHaveLength(1);
    expect(r.puntos[0]?.codigoPostal).toBe("01001");
    expect(r.descartados).toEqual([]);
  });

  it("descarta SOLO el punto inválido y lo registra en consola", () => {
    const r = parsearArchivo({
      version: 1,
      puntos: [valido, { ...valido, id: "b", lat: 999 }, { ...valido, id: "c", nombre: "" }, { ...valido, id: "d" }],
    });
    expect(r.puntos.map((p) => p.id)).toEqual(["a", "d"]);
    expect(r.descartados.map((d) => d.indice)).toEqual([1, 2]);
    expect(console.warn).toHaveBeenCalledTimes(2);
  });

  it("aplica valores por defecto: estado abierto y códigos postales numéricos a texto", () => {
    const sinEstado: Record<string, unknown> = { ...valido, codigoPostal: 11001 };
    delete sinEstado.estado;
    const r = parsearArchivo({ version: 1, puntos: [sinEstado] });
    expect(r.puntos[0]?.estado).toBe("abierto");
    expect(r.puntos[0]?.codigoPostal).toBe("11001");
  });

  it("descarta ids duplicados", () => {
    const r = parsearArchivo({ version: 1, puntos: [valido, valido] });
    expect(r.puntos).toHaveLength(1);
    expect(r.descartados[0]?.motivo).toMatch(/duplicado/);
  });

  it("lanza error si la estructura general no es válida o la versión no se soporta", () => {
    expect(() => parsearArchivo({ foo: 1 })).toThrow();
    expect(() => parsearArchivo(null)).toThrow();
    expect(() => parsearArchivo({ version: 2, puntos: [] })).toThrow(/versión/i);
  });
});

describe("ids", () => {
  it("generarId es determinista y sin tildes", () => {
    expect(generarId("Punto demo 01", "11001")).toBe("punto-demo-01-11001");
    expect(generarId("Café Ñandú", "")).toBe("cafe-nandu");
  });

  it("idUnico añade sufijo", () => {
    expect(idUnico("a", new Set(["a", "a-2"]))).toBe("a-3");
    expect(idUnico("b", new Set(["a"]))).toBe("b");
  });
});
