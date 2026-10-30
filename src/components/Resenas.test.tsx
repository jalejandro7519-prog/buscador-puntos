import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { crearArchivo, type Punto } from "../lib/esquema";
import { punto } from "../test/fabrica";
import { BuscadorPuntos } from "./BuscadorPuntos";
import { crearPopupDom } from "./popupDom";

vi.mock("./Mapa", () => ({ default: () => null }));

const DATOS: Punto[] = [
  punto({
    id: "a",
    nombre: "Punto con reseñas",
    resenas: [
      { id: "r1", texto: "Atención rápida y amable.", autor: "Vecina", fecha: "2026-10-05T10:00:00.000Z" },
      { id: "r2", texto: "Fácil de encontrar.", fecha: "2026-10-12T16:30:00.000Z" },
    ],
  }),
  punto({ id: "b", nombre: "Punto sin reseñas", lat: 12.2 }),
  punto({
    id: "c",
    nombre: "Punto cerrado con reseña",
    estado: "cerrado_temporal",
    lat: 12.3,
    resenas: [{ id: "r3", texto: "Cerrado por obras, pero muy bien atendido.", fecha: "2026-09-01T10:00:00.000Z" }],
  }),
];

describe("reseñas en la ficha pública", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(crearArchivo(DATOS)))));
  });
  afterEach(() => vi.unstubAllGlobals());

  it("el listado muestra «N reseñas» plegado y, al abrirlo, el texto, el autor y la fecha", async () => {
    const user = userEvent.setup();
    render(<BuscadorPuntos src="/puntos.json" />);
    const ficha = (await screen.findByText("Punto con reseñas")).closest("li")!;
    const resumen = within(ficha).getByText("2 reseñas");
    expect(ficha.querySelector("details")).not.toHaveAttribute("open");

    await user.click(resumen);
    expect(ficha.querySelector("details")).toHaveAttribute("open");
    expect(within(ficha).getByText("«Atención rápida y amable.»")).toBeVisible();
    expect(within(ficha).getByText(/Vecina, 5 de octubre de 2026/)).toBeVisible();
  });

  it("un punto sin reseñas no muestra el bloque; uno cerrado sí lo conserva", async () => {
    render(<BuscadorPuntos src="/puntos.json" />);
    const sin = (await screen.findByText("Punto sin reseñas")).closest("li")!;
    expect(sin.querySelector("details")).toBeNull();
    const cerrado = screen.getByText("Punto cerrado con reseña").closest("li")!;
    expect(within(cerrado).getByText("1 reseña")).toBeVisible();
  });
});

describe("reseñas en el popup del mapa", () => {
  it("se pintan como texto (nunca como HTML)", () => {
    const p = punto({
      resenas: [{ id: "r1", texto: "<img src=x onerror=alert(1)> Muy bien", autor: "<b>Ana</b>", fecha: "2026-10-05T10:00:00.000Z" }],
    });
    const dom = crearPopupDom(p, null, "otras");
    expect(dom.querySelector("details summary")?.textContent).toBe("1 reseña");
    expect(dom.querySelector("img")).toBeNull();
    expect(dom.querySelector("b")).toBeNull();
    expect(dom.querySelector(".bp-resena-texto")?.textContent).toContain("<img src=x onerror=alert(1)>");
  });

  it("sin reseñas no añade el bloque", () => {
    expect(crearPopupDom(punto(), null, "otras").querySelector("details")).toBeNull();
  });
});
