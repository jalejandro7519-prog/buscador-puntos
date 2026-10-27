import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CLAVE_CACHE } from "../lib/almacenamiento";
import { crearArchivo, type Punto } from "../lib/esquema";
import { punto } from "../test/fabrica";
import { BuscadorPuntos } from "./BuscadorPuntos";

// El mapa real se prueba aparte; aquí solo importa el listado.
vi.mock("./Mapa", () => ({ default: () => null }));

const DATOS: Punto[] = [
  punto({ id: "a", nombre: "Punto demo 01", tipo: "Reciclaje", direccion: "Calle Uno", codigoPostal: "11001", lat: 12.14, lng: -86.25, telefono: "+505 2255 0100" }),
  punto({ id: "b", nombre: "Punto demo 02", tipo: "Información", direccion: "Calle Dos", codigoPostal: "11002", lat: 12.2, lng: -86.3 }),
  punto({
    id: "c",
    nombre: "Punto demo 03",
    tipo: "Reciclaje",
    direccion: "Calle Tres",
    codigoPostal: "11001",
    lat: 12.1401,
    lng: -86.2501,
    estado: "cerrado_temporal",
    motivoCierre: "Obras en el local",
    reaperturaPrevista: "2026-11-15",
    telefono: "+505 2255 0102",
  }),
];

function responderCon(puntos: Punto[]) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify(crearArchivo(puntos)), { status: 200 })),
  );
}

describe("BuscadorPuntos (sin mapa)", () => {
  beforeEach(() => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("muestra el listado como <ul> y anuncia el contador en una región aria-live", async () => {
    responderCon(DATOS);
    render(<BuscadorPuntos src="/puntos.json" />);
    const lista = await screen.findByRole("list");
    expect(within(lista).getAllByRole("listitem")).toHaveLength(3);
    const contador = screen.getByText("3 puntos").closest("p");
    expect(contador).toHaveAttribute("aria-live", "polite");
  });

  it("un punto cerrado temporalmente NO desaparece: insignia, motivo, reapertura y teléfono accesible", async () => {
    responderCon(DATOS);
    render(<BuscadorPuntos src="/puntos.json" />);
    const cerrado = (await screen.findByText("Punto demo 03")).closest("li")!;
    expect(within(cerrado).getByText("Cerrado temporalmente")).toBeVisible();
    expect(within(cerrado).getByText(/Obras en el local/)).toBeVisible();
    expect(within(cerrado).getByText(/15 de noviembre de 2026/)).toBeVisible();
    expect(within(cerrado).getByRole("link", { name: "+505 2255 0102" })).toHaveAttribute("href", "tel:+50522550102");
    // «Cómo llegar» deshabilitado, no es un enlace
    expect(within(cerrado).queryByRole("link", { name: /Cómo llegar/ })).toBeNull();
    expect(within(cerrado).getByRole("button", { name: /Cómo llegar/ })).toBeDisabled();
  });

  it("«Cómo llegar» abre la app de mapas con las coordenadas y rel seguro", async () => {
    responderCon(DATOS);
    render(<BuscadorPuntos src="/puntos.json" />);
    const abierto = (await screen.findByText("Punto demo 01")).closest("li")!;
    const enlace = within(abierto).getByRole("link", { name: /Cómo llegar a Punto demo 01, Calle Uno/ });
    expect(enlace).toHaveAttribute("href", "https://www.google.com/maps/dir/?api=1&destination=12.14,-86.25");
    expect(enlace).toHaveAttribute("target", "_blank");
    expect(enlace).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("filtra por texto sin tildes y por tipo con chips (Todos restablece)", async () => {
    const user = userEvent.setup();
    responderCon(DATOS);
    render(<BuscadorPuntos src="/puntos.json" />);
    await screen.findByText("Punto demo 01");

    await user.click(screen.getByRole("button", { name: "Información" }));
    await waitFor(() => expect(screen.getAllByRole("listitem")).toHaveLength(1));
    await user.click(screen.getByRole("button", { name: "Todos" }));
    expect(screen.getAllByRole("listitem")).toHaveLength(3);

    await user.type(screen.getByRole("searchbox"), "INFORMACION");
    await waitFor(() => expect(screen.getAllByRole("listitem")).toHaveLength(1));
  });

  it("un código postal existente ordena todo por distancia al centroide y muestra km", async () => {
    const user = userEvent.setup();
    responderCon(DATOS);
    render(<BuscadorPuntos src="/puntos.json" />);
    await screen.findByText("Punto demo 01");

    await user.type(screen.getByRole("searchbox"), "11001");
    await screen.findByText(/ordenados por distancia al código postal 11001/);
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(3);
    expect(within(items[0]!).getByText("Punto demo 01")).toBeVisible();
    expect(within(items[0]!).getByText(/\d,\d km/)).toBeVisible();
    // abierto lejano antes que cerrado cercano
    expect(within(items[1]!).getByText("Punto demo 02")).toBeVisible();
    expect(within(items[2]!).getByText("Punto demo 03")).toBeVisible();
  });

  it("un código postal inexistente avisa sin bloquear el listado", async () => {
    const user = userEvent.setup();
    responderCon(DATOS);
    render(<BuscadorPuntos src="/puntos.json" />);
    await screen.findByText("Punto demo 01");
    await user.type(screen.getByRole("searchbox"), "99999");
    expect(await screen.findByText(/No tenemos puntos con ese código postal/)).toBeVisible();
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
  });

  it("sin resultados: estado vacío con salida para quitar filtros", async () => {
    const user = userEvent.setup();
    responderCon(DATOS);
    render(<BuscadorPuntos src="/puntos.json" />);
    await screen.findByText("Punto demo 01");
    await user.type(screen.getByRole("searchbox"), "zzzz");
    expect(await screen.findByText(/No hay puntos que coincidan/)).toBeVisible();
    await user.click(screen.getByRole("button", { name: /Quitar búsqueda y filtros/ }));
    await waitFor(() => expect(screen.getAllByRole("listitem")).toHaveLength(3));
  });

  it("si la geolocalización se deniega, mensaje amable y el listado sigue funcionando", async () => {
    const user = userEvent.setup();
    responderCon(DATOS);
    vi.stubGlobal("navigator", {
      ...navigator,
      geolocation: { getCurrentPosition: (_ok: unknown, error: (e: { code: number }) => void) => error({ code: 1 }) },
    });
    render(<BuscadorPuntos src="/puntos.json" />);
    await screen.findByText("Punto demo 01");
    await user.click(screen.getByRole("button", { name: "Cerca de mí" }));
    expect(await screen.findByText(/No hemos podido acceder a tu ubicación/)).toBeVisible();
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
  });

  it("«Cerca de mí» ordena por distancia a la ubicación del usuario", async () => {
    const user = userEvent.setup();
    responderCon(DATOS);
    vi.stubGlobal("navigator", {
      ...navigator,
      geolocation: {
        getCurrentPosition: (ok: (p: { coords: { latitude: number; longitude: number } }) => void) =>
          ok({ coords: { latitude: 12.199, longitude: -86.299 } }),
      },
    });
    render(<BuscadorPuntos src="/puntos.json" />);
    await screen.findByText("Punto demo 01");
    await user.click(screen.getByRole("button", { name: "Cerca de mí" }));
    await screen.findByText(/ordenados por cercanía a tu ubicación/);
    expect(within(screen.getAllByRole("listitem")[0]!).getByText("Punto demo 02")).toBeVisible();
  });

  it("guarda una copia en caché y la usa si el fichero falla", async () => {
    responderCon(DATOS);
    const { unmount } = render(<BuscadorPuntos src="/puntos.json" />);
    await screen.findByText("Punto demo 01");
    await waitFor(() => expect(localStorage.getItem(CLAVE_CACHE)).toContain("Punto demo 01"));
    unmount();

    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 500 })));
    render(<BuscadorPuntos src="/puntos.json" />);
    // primer pintado inmediato desde la caché
    expect(screen.getByText("Punto demo 01")).toBeVisible();
    expect(await screen.findByText(/se muestra la última guardada/)).toBeVisible();
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
  });

  it("si falla la carga y no hay caché, mensaje con reintento", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 404 })));
    render(<BuscadorPuntos src="/puntos.json" />);
    expect(await screen.findByRole("alert")).toHaveTextContent(/No hemos podido cargar la lista/);

    responderCon(DATOS);
    await user.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(await screen.findByText("Punto demo 01")).toBeVisible();
  });

  it("los puntos inválidos del JSON se descartan sin mostrar avisos en la vista pública", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ version: 1, puntos: [DATOS[0], { id: "x", nombre: "" }] }))),
    );
    render(<BuscadorPuntos src="/puntos.json" />);
    await screen.findByText("Punto demo 01");
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
    expect(screen.queryByText(/descartad/i)).toBeNull();
  });
});
