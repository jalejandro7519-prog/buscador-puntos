import { describe, expect, it } from "vitest";
import {
  aCsv,
  aJson,
  borrarPunto,
  fijarCierre,
  formularioDesdePunto,
  formularioVacio,
  guardarPunto,
  hayCambios,
  puntoDesdeFormulario,
} from "./edicion";
import { parsearArchivo } from "./esquema";
import { leerCsv, puntosImportables } from "./importar";
import { punto } from "../test/fabrica";

const AHORA = "2026-10-28T08:00:00.000Z";

describe("hayCambios", () => {
  const a = punto({ id: "a" });
  const b = punto({ id: "b", nombre: "B" });

  it("iguales (aunque cambie el orden o la fecha de actualización) → sin cambios", () => {
    expect(hayCambios([a, b], [b, { ...a, actualizadoEn: "2030-01-01T00:00:00Z" }])).toBe(false);
  });

  it("alta, baja o edición → hay cambios; revertir los deshace", () => {
    expect(hayCambios([a], [a, b])).toBe(true);
    expect(hayCambios([a, { ...b, nombre: "B2" }], [a, b])).toBe(true);
    expect(hayCambios([a, b], [a, b])).toBe(false);
  });
});

describe("edición de puntos", () => {
  const a = punto({ id: "a" });

  it("guardarPunto inserta o reemplaza por id y marca la fecha", () => {
    const r = guardarPunto([a], { ...a, nombre: "Nuevo" }, AHORA);
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ nombre: "Nuevo", actualizadoEn: AHORA });
    expect(guardarPunto([a], punto({ id: "z" }), AHORA)).toHaveLength(2);
  });

  it("borrarPunto quita solo el indicado", () => {
    expect(borrarPunto([a, punto({ id: "b" })], "a").map((p) => p.id)).toEqual(["b"]);
  });

  it("un solo interruptor cierra (con motivo y reapertura) y reabre limpiando ambos", () => {
    const cerrado = fijarCierre([a], "a", true, " Obras ", "2026-11-15", AHORA);
    expect(cerrado[0]).toMatchObject({ estado: "cerrado_temporal", motivoCierre: "Obras", reaperturaPrevista: "2026-11-15", actualizadoEn: AHORA });
    const abierto = fijarCierre(cerrado, "a", false, undefined, undefined, AHORA);
    expect(abierto[0]?.estado).toBe("abierto");
    expect(abierto[0]).not.toHaveProperty("motivoCierre");
    expect(abierto[0]).not.toHaveProperty("reaperturaPrevista");
  });
});

describe("formulario", () => {
  const completo = { ...formularioVacio(), nombre: "Punto nuevo", tipo: "Información", direccion: "Calle 1", codigoPostal: "11001", lat: "12,1364", lng: "-86.251" };

  it("valida obligatorios y coordenadas con mensajes por campo", () => {
    const r = puntoDesdeFormulario(formularioVacio(), [], null, AHORA);
    expect("errores" in r && Object.keys(r.errores)).toEqual(expect.arrayContaining(["nombre", "tipo", "direccion", "lat", "lng"]));
    const fuera = puntoDesdeFormulario({ ...completo, lat: "95" }, [], null, AHORA);
    expect("errores" in fuera && fuera.errores.lat).toMatch(/entre/);
  });

  it("crea el punto con id determinista y único, y coordenadas con coma decimal", () => {
    const existente = punto({ id: "punto-nuevo-11001" });
    const r = puntoDesdeFormulario(completo, [existente], null, AHORA);
    expect("punto" in r && r.punto).toMatchObject({ id: "punto-nuevo-11001-2", lat: 12.1364, lng: -86.251, estado: "abierto", actualizadoEn: AHORA });
  });

  it("al editar conserva el id aunque cambie el nombre; cerrado guarda motivo y fecha", () => {
    const original = punto({ id: "fijo" });
    const campos = { ...formularioDesdePunto(original), nombre: "Otro nombre", cerrado: true, motivoCierre: "Obras", reaperturaPrevista: "15/11/2026" };
    const r = puntoDesdeFormulario(campos, [original], original, AHORA);
    expect("punto" in r && r.punto).toMatchObject({ id: "fijo", nombre: "Otro nombre", estado: "cerrado_temporal", motivoCierre: "Obras", reaperturaPrevista: "2026-11-15" });
  });
});

describe("exportar", () => {
  const puntos = [
    punto({ id: "a", nombre: "Café, «Sol»", telefono: "+505 2255 0100", lat: 12.1364, lng: -86.251 }),
    punto({ id: "b", nombre: "=SUMA(1;1)", estado: "cerrado_temporal", motivoCierre: "Obras", reaperturaPrevista: "2026-11-15" }),
  ];

  it("aJson produce el formato publicable y se vuelve a leer sin pérdidas", () => {
    const texto = aJson(puntos, AHORA);
    expect(JSON.parse(texto)).toMatchObject({ version: 1, generadoEn: AHORA });
    expect(parsearArchivo(JSON.parse(texto)).puntos).toEqual(puntos);
  });

  it("aCsv hace el viaje de ida y vuelta con la importación, conservando coordenadas exactas", () => {
    const csv = aCsv(puntos);
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv).toContain("'=SUMA(1;1)"); // protegido frente a fórmulas de Excel
    const vuelta = puntosImportables(leerCsv(csv, AHORA).filas);
    expect(vuelta).toHaveLength(2);
    expect(vuelta[0]).toMatchObject({ id: "a", nombre: "Café, «Sol»", lat: 12.1364, lng: -86.251, telefono: "+505 2255 0100" });
    expect(vuelta[1]).toMatchObject({ id: "b", nombre: "=SUMA(1;1)", estado: "cerrado_temporal", motivoCierre: "Obras", reaperturaPrevista: "2026-11-15" });
  });
});
