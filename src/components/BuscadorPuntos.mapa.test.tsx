import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { crearArchivo, type Punto } from "../lib/esquema";
import { punto } from "../test/fabrica";
import { BuscadorPuntos } from "./BuscadorPuntos";
import type { PropsMapa } from "./Mapa";

const control = vi.hoisted(() => ({ modo: "normal" as "normal" | "error" | "mudo" }));

// Mapa simulado: un botón por marcador visible, con el mismo contrato de props que el real.
vi.mock("./Mapa", async () => {
  const { useEffect } = await import("react");
  return {
    default: function MapaSimulado(props: PropsMapa) {
      if (control.modo === "error") throw new Error("boom: el mapa ha fallado");
      const { onListo } = props;
      useEffect(() => {
        if (control.modo === "normal") onListo();
      }, [onListo]);
      return (
        <div data-testid="mapa-simulado">
          {props.puntos.map(({ punto: p }) => (
            <button
              key={p.id}
              type="button"
              data-estado={p.estado}
              aria-pressed={p.id === props.seleccionadoId}
              onClick={() => props.onSeleccionar(p.id)}
            >
              marcador {p.nombre}
            </button>
          ))}
        </div>
      );
    },
  };
});

const DATOS: Punto[] = [
  punto({ id: "a", nombre: "Punto demo 01", tipo: "Reciclaje", lat: 12.14, lng: -86.25 }),
  punto({ id: "b", nombre: "Punto demo 02", tipo: "Información", lat: 12.2, lng: -86.3 }),
  punto({ id: "c", nombre: "Punto demo 03", tipo: "Reciclaje", lat: 12.1401, lng: -86.2501, estado: "cerrado_temporal" }),
];

describe("BuscadorPuntos con mapa", () => {
  beforeEach(() => {
    control.modo = "normal";
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(crearArchivo(DATOS)))));
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("el mapa se monta después del listado y muestra los mismos puntos que la lista filtrada", async () => {
    const user = userEvent.setup();
    render(<BuscadorPuntos src="/puntos.json" />);
    await screen.findByText("Punto demo 01");
    const mapa = await screen.findByTestId("mapa-simulado");
    expect(within(mapa).getAllByRole("button")).toHaveLength(3);

    await user.click(screen.getByRole("button", { name: "Información" }));
    await waitFor(() => expect(within(screen.getByTestId("mapa-simulado")).getAllByRole("button")).toHaveLength(1));
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
  });

  it("el punto cerrado sigue en el listado y en el mapa (con su variante propia)", async () => {
    render(<BuscadorPuntos src="/puntos.json" />);
    const mapa = await screen.findByTestId("mapa-simulado");
    const marcadorCerrado = within(mapa).getByRole("button", { name: "marcador Punto demo 03" });
    expect(marcadorCerrado).toHaveAttribute("data-estado", "cerrado_temporal");
    const cerrado = screen.getByText("Punto demo 03").closest("li")!;
    expect(within(cerrado).getByText("Cerrado temporalmente")).toBeVisible();
  });

  it("sincroniza la selección: marcador → listado y listado → mapa", async () => {
    const user = userEvent.setup();
    render(<BuscadorPuntos src="/puntos.json" />);
    const mapa = await screen.findByTestId("mapa-simulado");

    await user.click(within(mapa).getByRole("button", { name: "marcador Punto demo 02" }));
    expect(screen.getByText("Punto demo 02").closest("li")).toHaveAttribute("aria-current", "true");

    await user.click(screen.getByRole("button", { name: "Punto demo 01: ver en el mapa" }));
    expect(within(mapa).getByRole("button", { name: "marcador Punto demo 01" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("Punto demo 02").closest("li")).not.toHaveAttribute("aria-current");
  });

  it("si el mapa lanza un error, el listado sigue plenamente usable y aparece un aviso discreto", async () => {
    control.modo = "error";
    const user = userEvent.setup();
    render(<BuscadorPuntos src="/puntos.json" />);
    expect(await screen.findByText(/El mapa no está disponible ahora/)).toBeVisible();
    expect(screen.queryByTestId("mapa-simulado")).toBeNull();

    // búsqueda, filtros y «Cómo llegar» siguen funcionando
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
    await user.type(screen.getByRole("searchbox"), "demo 02");
    await waitFor(() => expect(screen.getAllByRole("listitem")).toHaveLength(1));
    expect(screen.getByRole("link", { name: /Cómo llegar a Punto demo 02/ })).toHaveAttribute("href", expect.stringContaining("destination=12.2,-86.3"));
  });

  it("si el mapa tarda más de 6 s avisa y el listado sigue usable", async () => {
    control.modo = "mudo";
    vi.useFakeTimers({ shouldAdvanceTime: true });
    render(<BuscadorPuntos src="/puntos.json" />);
    await screen.findByText("Punto demo 01");
    expect(screen.queryByText(/El mapa no está disponible ahora/)).toBeNull();
    // 1.º se activa el mapa (tras el primer pintado); 2.º vence el límite de 6 s
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(6500);
    });
    expect(screen.getByText(/El mapa no está disponible ahora/)).toBeVisible();
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
  });
});
