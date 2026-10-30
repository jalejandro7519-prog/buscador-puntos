import { readFileSync } from "node:fs";
import { join } from "node:path";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CLAVE_BORRADOR } from "../../lib/almacenamiento";
import { MAX_RESENAS } from "../../lib/esquema";
import { PanelAdmin } from "./PanelAdmin";

vi.mock("./MapaSelector", () => ({ default: () => <div data-testid="mapa-selector" /> }));

const PUBLICADO = readFileSync(join(process.cwd(), "public", "puntos.json"), "utf8");

async function abrirEdicion(nombre: string) {
  const user = userEvent.setup();
  render(<PanelAdmin src="/puntos.json" onSalir={() => undefined} />);
  await screen.findByText("El borrador coincide con lo publicado");
  await user.click(screen.getByRole("button", { name: `Editar ${nombre}` }));
  return user;
}

const guardadas = () => JSON.parse(localStorage.getItem(CLAVE_BORRADOR)!).puntos as { nombre: string; resenas?: { texto: string; autor?: string }[] }[];

describe("panel: reseñas por punto", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(PUBLICADO)));
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("la tabla indica cuántas reseñas tiene cada punto", async () => {
    render(<PanelAdmin src="/puntos.json" onSalir={() => undefined} />);
    const fila = (await screen.findByText("Punto demo 01")).closest("tr")!;
    expect(within(fila).getByText("2 reseñas")).toBeVisible();
  });

  it("añade una reseña (con autor opcional), la guarda y marca cambios sin publicar", async () => {
    const user = await abrirEdicion("Punto demo 02");
    expect(screen.getByText(/Reseñas breves \(0\/5\)/)).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Añadir reseña" }));
    expect(screen.getByText("Escribe el texto de la reseña.")).toBeVisible();

    await user.type(screen.getByLabelText("Texto de la reseña"), "  Servicio muy correcto.  ");
    await user.type(screen.getByLabelText("Autor (opcional)"), "Vecino");
    await user.click(screen.getByRole("button", { name: "Añadir reseña" }));
    expect(screen.getByText("«Servicio muy correcto.»")).toBeVisible();
    expect(screen.getByText(/Reseñas breves \(1\/5\)/)).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Guardar punto" }));
    expect(await screen.findByText("Hay cambios sin publicar")).toBeVisible();
    const p = guardadas().find((x) => x.nombre === "Punto demo 02");
    expect(p?.resenas).toEqual([expect.objectContaining({ texto: "Servicio muy correcto.", autor: "Vecino" })]);
  });

  it("quita una reseña existente y, al quitar todas, el punto queda sin el campo", async () => {
    const user = await abrirEdicion("Punto demo 06");
    await user.click(screen.getByRole("button", { name: /Quitar la reseña/ }));
    expect(screen.getByText(/Reseñas breves \(0\/5\)/)).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Guardar punto" }));
    await waitFor(() => expect(guardadas().find((x) => x.nombre === "Punto demo 06")).not.toHaveProperty("resenas"));
  });

  it(`no permite más de ${MAX_RESENAS} reseñas por punto`, async () => {
    const user = await abrirEdicion("Punto demo 01"); // ya tiene 2
    for (let i = 1; i <= MAX_RESENAS - 2; i++) {
      await user.type(screen.getByLabelText("Texto de la reseña"), `Reseña extra ${i}`);
      await user.click(screen.getByRole("button", { name: "Añadir reseña" }));
    }
    expect(screen.getByText(new RegExp(`Reseñas breves \\(${MAX_RESENAS}/${MAX_RESENAS}\\)`))).toBeVisible();
    expect(screen.getByText(/Se ha alcanzado el máximo/)).toBeVisible();
    expect(screen.queryByRole("button", { name: "Añadir reseña" })).toBeNull();
  });
});
