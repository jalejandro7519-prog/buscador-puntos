import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { aCsv, formularioDesdePunto, hayCambios, puntoDesdeFormulario } from "./edicion";
import { MAX_RESENAS, MAX_TEXTO_RESENA, parsearArchivo, type Punto } from "./esquema";
import { aplicarImportacion, leerCsv, puntosImportables } from "./importar";
import { punto } from "../test/fabrica";

const AHORA = "2026-10-30T10:00:00.000Z";
const publico = (n: string) => readFileSync(join(process.cwd(), "public", n), "utf8");
const resena = (n: number, extra = {}) => ({ id: `r${n}`, texto: `Reseña ${n}`, fecha: "2026-10-01T10:00:00.000Z", ...extra });

describe("esquema: reseñas", () => {
  beforeEach(() => void vi.spyOn(console, "warn").mockImplementation(() => undefined));
  afterEach(() => vi.restoreAllMocks());

  const base = { id: "a", nombre: "A", tipo: "T", direccion: "C", lat: 12.1, lng: -86.2 };

  it("acepta reseñas válidas y deja sin campo las listas vacías", () => {
    const r = parsearArchivo({ version: 1, puntos: [{ ...base, resenas: [resena(1, { autor: "Ana" })] }, { ...base, id: "b", resenas: [] }, { ...base, id: "c" }] });
    expect(r.puntos[0]?.resenas).toEqual([resena(1, { autor: "Ana" })]);
    expect(r.puntos[1]?.resenas).toBeUndefined();
    expect(r.puntos[2]?.resenas).toBeUndefined();
  });

  it("una reseña inválida se descarta SOLA: el punto y las demás reseñas se conservan", () => {
    const r = parsearArchivo({
      version: 1,
      puntos: [{ ...base, resenas: [resena(1), { id: "x", texto: "" }, resena(3), { id: "y", texto: "a".repeat(MAX_TEXTO_RESENA + 1) }] }],
    });
    expect(r.descartados).toEqual([]);
    expect(r.puntos[0]?.resenas?.map((x) => x.id)).toEqual(["r1", "r3"]);
  });

  it(`conserva como máximo ${MAX_RESENAS} reseñas por punto`, () => {
    const muchas = Array.from({ length: 8 }, (_, i) => resena(i + 1));
    const r = parsearArchivo({ version: 1, puntos: [{ ...base, resenas: muchas }] });
    expect(r.puntos[0]?.resenas).toHaveLength(MAX_RESENAS);
  });
});

describe("edición de reseñas", () => {
  it("el formulario las lleva y las guarda en el punto", () => {
    const original = punto({ id: "p", resenas: [resena(1)] });
    const campos = formularioDesdePunto(original);
    expect(campos.resenas).toEqual([resena(1)]);
    const r = puntoDesdeFormulario({ ...campos, resenas: [...campos.resenas, resena(2)] }, [original], original, AHORA);
    expect("punto" in r && r.punto.resenas?.map((x) => x.id)).toEqual(["r1", "r2"]);
    const sin = puntoDesdeFormulario({ ...campos, resenas: [] }, [original], original, AHORA);
    expect("punto" in sin && sin.punto).not.toHaveProperty("resenas");
  });

  it("añadir, cambiar o quitar una reseña cuenta como «cambio sin publicar»", () => {
    const publicado = [punto({ id: "p", resenas: [resena(1)] })];
    expect(hayCambios(publicado, publicado)).toBe(false);
    expect(hayCambios([punto({ id: "p", resenas: [resena(1), resena(2)] })], publicado)).toBe(true);
    expect(hayCambios([punto({ id: "p", resenas: [resena(1, { texto: "Otra" })] })], publicado)).toBe(true);
    expect(hayCambios([punto({ id: "p" })], publicado)).toBe(true);
  });
});

describe("hoja: columna «Reseñas»", () => {
  const cabecera = "Nombre,Tipo,Dirección,Latitud,Longitud,Reseñas";

  it("separa las reseñas por « || » y les pone id estable", () => {
    const l = leerCsv(`${cabecera}\nA,T,C,12.1,-86.2,Muy buena || Atención amable`, AHORA);
    const p = puntosImportables(l.filas)[0];
    expect(p?.resenas?.map((r) => r.texto)).toEqual(["Muy buena", "Atención amable"]);
    expect(p?.resenas?.map((r) => r.id)).toEqual([`${p?.id}-r1`, `${p?.id}-r2`]);
  });

  it("avisa (sin perder la fila) si hay más de 5 reseñas o alguna es demasiado larga", () => {
    const largas = Array.from({ length: 6 }, (_, i) => `R${i + 1}`).join(" || ");
    const l1 = leerCsv(`${cabecera}\nA,T,C,12.1,-86.2,${largas}`, AHORA);
    expect(l1.filas[0]?.punto?.resenas).toHaveLength(MAX_RESENAS);
    expect(l1.filas[0]?.problemas.some((p) => p.nivel === "aviso" && /5 primeras/.test(p.mensaje))).toBe(true);

    const l2 = leerCsv(`${cabecera}\nA,T,C,12.1,-86.2,${"x".repeat(MAX_TEXTO_RESENA + 20)}`, AHORA);
    expect(l2.filas[0]?.punto?.resenas?.[0]?.texto).toHaveLength(MAX_TEXTO_RESENA);
    expect(l2.filas[0]?.problemas[0]?.mensaje).toMatch(/se recorta/);
  });

  it("exportar a CSV e importar de nuevo conserva los textos de las reseñas", () => {
    const origen: Punto[] = [punto({ id: "a", nombre: "A", resenas: [resena(1), resena(2)] })];
    const vuelta = puntosImportables(leerCsv(aCsv(origen), AHORA).filas);
    expect(vuelta[0]?.resenas?.map((r) => r.texto)).toEqual(["Reseña 1", "Reseña 2"]);
  });

  it("al importar sobre un punto existente se conservan autor y fecha de las reseñas que no cambian", () => {
    const existente = punto({ id: "a-11001", nombre: "A", codigoPostal: "11001", resenas: [resena(1, { autor: "Ana" })] });
    const hoja = puntosImportables(leerCsv(`Nombre,Tipo,Dirección,Código postal,Latitud,Longitud,Reseñas\nA,T,C,11001,12.1,-86.2,Reseña 1 || Reseña nueva`, AHORA).filas);
    const r = aplicarImportacion([existente], hoja, "combinar");
    expect(r[0]?.resenas?.[0]).toEqual(resena(1, { autor: "Ana" }));
    expect(r[0]?.resenas?.[1]?.texto).toBe("Reseña nueva");
  });

  it("una celda vacía NO borra las reseñas existentes (se quitan desde el panel)", () => {
    const existente = punto({ id: "a-11001", nombre: "A", codigoPostal: "11001", resenas: [resena(1)] });
    const hoja = puntosImportables(leerCsv(`Nombre,Tipo,Dirección,Código postal,Latitud,Longitud,Reseñas\nA,T,C,11001,12.1,-86.2,`, AHORA).filas);
    for (const modo of ["combinar", "reemplazar"] as const) {
      expect(aplicarImportacion([existente], hoja, modo)[0]?.resenas).toEqual([resena(1)]);
    }
  });
});

describe("datos de ejemplo", () => {
  it("el puntos.json de demo trae reseñas válidas y la hoja de ejemplo las repite", () => {
    const publicado = parsearArchivo(JSON.parse(publico("puntos.json"))).puntos;
    expect(publicado.filter((p) => p.resenas?.length)).toHaveLength(3);
    const hoja = puntosImportables(leerCsv(publico("ejemplo-hoja.csv"), AHORA).filas);
    expect(hoja.filter((p) => p.resenas?.length)).toHaveLength(3);
    // «Combinar» con la hoja de ejemplo no duplica ni cambia nada, ni siquiera las reseñas
    expect(aplicarImportacion(publicado, hoja, "combinar")).toEqual(publicado);
  });
});
