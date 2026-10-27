import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  aplicarImportacion,
  intercambiarCoordenadas,
  analizarFilas,
  leerCsv,
  parsearFecha,
  parsearNumero,
  puntosImportables,
  reconocerCampo,
  resumir,
} from "./importar";
import { parsearArchivo, type Punto } from "./esquema";
import { punto } from "../test/fabrica";

const AHORA = "2026-10-27T10:00:00.000Z";
const leerPublic = (nombre: string) => readFileSync(join(process.cwd(), "public", nombre), "utf8");

describe("alias de cabeceras", () => {
  it.each([
    ["Nombre", "nombre"],
    ["TIPO", "tipo"],
    ["Categoría", "tipo"],
    ["Dirección", "direccion"],
    ["direccion", "direccion"],
    ["Código postal", "codigoPostal"],
    ["CP", "codigoPostal"],
    ["codigo_postal", "codigoPostal"],
    ["ZIP", "codigoPostal"],
    ["Ciudad", "ciudad"],
    ["Localidad", "ciudad"],
    ["Barrio", "ciudad"],
    ["Teléfono", "telefono"],
    ["telefono", "telefono"],
    ["Horario", "horario"],
    ["Lat", "lat"],
    ["Latitud", "lat"],
    ["lng", "lng"],
    ["LON", "lng"],
    ["Longitud", "lng"],
    ["Estado", "estado"],
  ])("«%s» → %s", (cabecera, campo) => {
    expect(reconocerCampo(cabecera)).toBe(campo);
  });

  it("una cabecera desconocida se ignora y se informa de las que faltan", () => {
    const l = leerCsv("Nombre,Observaciones,Latitud\nA,algo,12.1", AHORA);
    expect(l.columnas.ignoradas).toEqual(["Observaciones"]);
    expect(l.columnas.faltan).toEqual(expect.arrayContaining(["tipo", "direccion", "lng"]));
  });
});

describe("números", () => {
  it.each([
    ["12.1364", 12.1364],
    ["12,1364", 12.1364],
    ["-86,2510", -86.251],
    [" 12.1390 ", 12.139],
    ["12 . 1390", 12.139],
    ["1.234,5", 1234.5],
    ["1,234.5", 1234.5],
    ["−86.25", -86.25],
  ])("«%s» → %s", (texto, esperado) => {
    expect(parsearNumero(texto)).toBe(esperado);
  });

  it.each(["", "abc", "12,13,14", "doce coma uno", "--5"])("«%s» no es un número", (texto) => {
    expect(parsearNumero(texto)).toBeNull();
  });
});

describe("fechas", () => {
  it("acepta ISO, dd/mm/aaaa y números de serie de Excel", () => {
    expect(parsearFecha("2026-11-15")).toBe("2026-11-15");
    expect(parsearFecha("5/11/2026")).toBe("2026-11-05");
    expect(parsearFecha("46341")).toBe("2026-11-15");
    expect(parsearFecha("ayer")).toBeNull();
  });
});

describe("filas con problemas", () => {
  it("una fila sin coordenadas se marca como ERROR (no se pierde en silencio)", () => {
    const l = leerCsv("Nombre,Tipo,Dirección,Latitud,Longitud\nA,T,Calle 1,,\nB,T,Calle 2,12.1,-86.2", AHORA);
    expect(l.filas).toHaveLength(2);
    const [a, b] = l.filas;
    expect(a?.punto).toBeNull();
    expect(a?.problemas.some((p) => p.nivel === "error" && /coordenadas/i.test(p.mensaje))).toBe(true);
    expect(b?.punto).not.toBeNull();
    expect(resumir(l.filas)).toMatchObject({ total: 2, validas: 1, conError: 1, importables: 1 });
  });

  it("detecta nombre vacío, latitud ilegible, fuera de rango y 0,0", () => {
    const l = leerCsv(
      ["Nombre,Tipo,Dirección,Latitud,Longitud", ",T,C,12.1,-86.2", "B,T,C,doce,-86.2", "C,T,C,95,-86.2", "D,T,C,0,0"].join("\n"),
      AHORA,
    );
    const mensajes = l.filas.map((f) => f.problemas.map((p) => p.mensaje).join(" | "));
    expect(mensajes[0]).toMatch(/Falta el nombre/);
    expect(mensajes[1]).toMatch(/Latitud no válida/);
    expect(mensajes[2]).toMatch(/fuera de rango/);
    expect(mensajes[3]).toMatch(/0, 0/);
    expect(l.filas.every((f) => f.punto === null)).toBe(true);
  });

  it("latitud fuera de rango con longitud válida como latitud: error con sugerencia de intercambio", () => {
    const campos = { ...camposBase(), lat: "-122.4", lng: "37.8" };
    const [f] = analizarFilas([{ fila: 2, campos }], AHORA);
    expect(f?.sugerirIntercambio).toBe(true);
    expect(f?.punto).toBeNull();
    const [corregida] = analizarFilas([{ fila: 2, campos: intercambiarCoordenadas(campos) }], AHORA);
    expect(corregida?.punto).toMatchObject({ lat: 37.8, lng: -122.4 });
  });

  it("lat/lng intercambiadas pero dentro de rango: aviso por estar lejos del resto del lote", () => {
    const filas = [
      { fila: 2, campos: { ...camposBase(), nombre: "A", lat: "12.13", lng: "-86.25" } },
      { fila: 3, campos: { ...camposBase(), nombre: "B", lat: "12.14", lng: "-86.26" } },
      { fila: 4, campos: { ...camposBase(), nombre: "C", lat: "12.15", lng: "-86.24" } },
      { fila: 5, campos: { ...camposBase(), nombre: "D", lat: "-86.25", lng: "12.13" } },
    ];
    const r = analizarFilas(filas, AHORA);
    expect(r[3]?.sugerirIntercambio).toBe(true);
    expect(r[3]?.punto).not.toBeNull(); // es un aviso, no un error
    expect(r[3]?.problemas[0]?.nivel).toBe("aviso");
    expect(r[0]?.problemas).toEqual([]);

    // «Intercambiar» lo deja sin problemas
    const [ok] = analizarFilas([...filas.slice(0, 3), { fila: 5, campos: intercambiarCoordenadas(filas[3]!.campos) }], AHORA).slice(3);
    expect(ok?.problemas).toEqual([]);
    expect(ok?.punto).toMatchObject({ lat: 12.13, lng: -86.25 });
  });

  it("estado desconocido → aviso y se importa como abierto; ids repetidos → aviso y sufijo", () => {
    const l = leerCsv(
      ["Nombre,Tipo,Dirección,Código postal,Latitud,Longitud,Estado", "A,T,C,11001,12.1,-86.2,quizá", "A,T,C2,11001,12.2,-86.3,cerrado"].join("\n"),
      AHORA,
    );
    expect(l.filas[0]?.punto?.estado).toBe("abierto");
    expect(l.filas[0]?.problemas[0]?.nivel).toBe("aviso");
    expect(l.filas[1]?.punto?.estado).toBe("cerrado_temporal");
    expect(l.filas.map((f) => f.punto?.id)).toEqual(["a-11001", "a-11001-2"]);
    expect(resumir(l.filas)).toMatchObject({ validas: 0, conAviso: 2, conError: 0, importables: 2 });
  });
});

describe("hoja de ejemplo (criterio de aceptación 1)", () => {
  const esperados = parsearArchivo(JSON.parse(leerPublic("puntos.json"))).puntos;
  const lectura = leerCsv(leerPublic("ejemplo-hoja.csv"), AHORA);

  it("todas las filas son válidas y se importan: nº de puntos = nº de filas válidas", () => {
    const r = resumir(lectura.filas);
    expect(r).toMatchObject({ total: 24, validas: 24, conAviso: 0, conError: 0, importables: 24 });
    expect(puntosImportables(lectura.filas)).toHaveLength(r.validas);
    expect(lectura.columnas.faltan).toEqual([]);
  });

  it("cada punto conserva sus coordenadas EXACTAS (incluida la fila con coma decimal)", () => {
    const importados = puntosImportables(lectura.filas);
    importados.forEach((p, i) => {
      expect(p.lat).toBe(esperados[i]?.lat);
      expect(p.lng).toBe(esperados[i]?.lng);
    });
    // la fila 6 de la hoja (índice 4) está escrita con coma decimal
    expect(lectura.filas[4]?.campos.lat).toMatch(/,/);
    expect(importados[4]?.lat).toBe(12.165);
  });

  it("conserva el resto de campos: cerrados con motivo y reapertura, teléfonos y horarios ausentes", () => {
    const importados = puntosImportables(lectura.filas);
    expect(importados.filter((p) => p.estado === "cerrado_temporal")).toHaveLength(3);
    expect(importados[3]).toMatchObject({ estado: "cerrado_temporal", motivoCierre: "Obras en el local", reaperturaPrevista: "2026-11-15" });
    expect(importados.filter((p) => !p.telefono)).toHaveLength(3);
    expect(importados.filter((p) => !p.horario)).toHaveLength(2);
    // los ids coinciden con los del puntos.json publicado → «Combinar» no duplica nada
    expect(importados.map((p) => p.id)).toEqual(esperados.map((p) => p.id));
  });
});

describe("hoja con errores", () => {
  const lectura = leerCsv(leerPublic("ejemplo-hoja-con-errores.csv"), AHORA);
  const r = resumir(lectura.filas);

  it("clasifica las filas y no pierde ninguna", () => {
    expect(r.total).toBe(12);
    expect(r.conError).toBe(4); // sin coordenadas, lat ilegible, fuera de rango, sin nombre
    expect(r.conAviso).toBe(1); // intercambiadas dentro de rango
    expect(r.validas).toBe(7);
    expect(r.importables).toBe(8);
  });

  it("lee coma decimal y coordenadas con espacios", () => {
    const coma = lectura.filas.find((f) => f.campos.nombre.includes("coma decimal"));
    expect(coma?.punto).toMatchObject({ lat: 12.1364, lng: -86.251 });
    const espacios = lectura.filas.find((f) => f.campos.nombre.includes("con espacios"));
    expect(espacios?.punto).toMatchObject({ lat: 12.139, lng: -86.254, estado: "cerrado_temporal" });
  });

  it("puede corregirse a mano y volver a analizar", () => {
    const sin = lectura.filas.find((f) => f.campos.nombre.includes("sin coordenadas"))!;
    expect(sin.punto).toBeNull();
    const [corregida] = analizarFilas([{ fila: sin.fila, campos: { ...sin.campos, lat: "12,1", lng: "-86,2" } }], AHORA);
    expect(corregida?.punto).toMatchObject({ lat: 12.1, lng: -86.2 });
  });
});

describe("modos de importación", () => {
  const a = punto({ id: "a", nombre: "A viejo", actualizadoEn: "2020-01-01T00:00:00.000Z" });
  const b = punto({ id: "b", nombre: "B", actualizadoEn: "2020-01-01T00:00:00.000Z" });
  const aNuevo: Punto = { ...a, nombre: "A nuevo", actualizadoEn: AHORA };
  const c = punto({ id: "c", nombre: "C", actualizadoEn: AHORA });

  it("reemplazar todo: el resultado son exactamente los importados", () => {
    const r = aplicarImportacion([a, b], [aNuevo, c], "reemplazar");
    expect(r.map((p) => p.id)).toEqual(["a", "c"]);
    expect(r[0]?.nombre).toBe("A nuevo");
  });

  it("combinar: actualiza por id, añade los nuevos y NO borra los ausentes", () => {
    const r = aplicarImportacion([a, b], [aNuevo, c], "combinar");
    expect(r.map((p) => p.id)).toEqual(["a", "b", "c"]);
    expect(r[0]?.nombre).toBe("A nuevo");
    expect(r[1]).toBe(b);
  });

  it("un punto sin cambios conserva su fecha de actualización", () => {
    const identico: Punto = { ...a, actualizadoEn: AHORA };
    expect(aplicarImportacion([a], [identico], "combinar")[0]?.actualizadoEn).toBe("2020-01-01T00:00:00.000Z");
    expect(aplicarImportacion([a], [identico], "reemplazar")[0]?.actualizadoEn).toBe("2020-01-01T00:00:00.000Z");
  });

  it("importar la hoja de ejemplo sobre el publicado en modo combinar no duplica ni cambia nada", () => {
    const publicado = parsearArchivo(JSON.parse(leerPublic("puntos.json"))).puntos;
    const hoja = puntosImportables(leerCsv(leerPublic("ejemplo-hoja.csv"), AHORA).filas);
    const r = aplicarImportacion(publicado, hoja, "combinar");
    expect(r).toHaveLength(24);
    expect(r).toEqual(publicado);
  });
});

function camposBase() {
  return { id: "", nombre: "X", tipo: "T", direccion: "C", codigoPostal: "", ciudad: "", telefono: "", horario: "", lat: "", lng: "", estado: "", motivoCierre: "", reaperturaPrevista: "" };
}
