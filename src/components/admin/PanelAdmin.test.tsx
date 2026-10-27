import { readFileSync } from "node:fs";
import { join } from "node:path";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CLAVE_BORRADOR } from "../../lib/almacenamiento";
import { parsearArchivo } from "../../lib/esquema";
import { PanelAdmin } from "./PanelAdmin";
import { PinGate } from "./PinGate";

vi.mock("./MapaSelector", () => ({ default: () => <div data-testid="mapa-selector" /> }));

const publico = (nombre: string) => readFileSync(join(process.cwd(), "public", nombre), "utf8");
const PUBLICADO = publico("puntos.json");

function simularFetch(cuerpo: string = PUBLICADO, estado = 200) {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(cuerpo, { status: estado })));
}

async function abrirPanel() {
  const user = userEvent.setup();
  render(<PanelAdmin src="/puntos.json" onSalir={() => undefined} />);
  await screen.findByText("El borrador coincide con lo publicado");
  return user;
}

const filasTabla = () => within(screen.getByRole("table")).getAllByRole("row").length - 1;

describe("PinGate", () => {
  afterEach(() => sessionStorage.clear());

  it("sin PIN configurado el panel está deshabilitado", () => {
    render(<PinGate pin={undefined}>{() => <p>secreto</p>}</PinGate>);
    expect(screen.getByText(/deshabilitado/)).toBeVisible();
    expect(screen.queryByText("secreto")).toBeNull();
  });

  it("rechaza un PIN incorrecto, acepta el correcto y recuerda la sesión", async () => {
    const user = userEvent.setup();
    const { unmount } = render(<PinGate pin="4321">{() => <p>dentro</p>}</PinGate>);
    await user.type(screen.getByLabelText("PIN de acceso"), "0000");
    await user.click(screen.getByRole("button", { name: "Entrar" }));
    expect(screen.getByRole("alert")).toHaveTextContent("PIN incorrecto");
    expect(screen.queryByText("dentro")).toBeNull();

    await user.clear(screen.getByLabelText("PIN de acceso"));
    await user.type(screen.getByLabelText("PIN de acceso"), "4321");
    await user.click(screen.getByRole("button", { name: "Entrar" }));
    expect(screen.getByText("dentro")).toBeVisible();

    unmount();
    render(<PinGate pin="4321">{() => <p>dentro</p>}</PinGate>);
    expect(screen.getByText("dentro")).toBeVisible(); // sessionStorage
  });
});

describe("PanelAdmin", () => {
  beforeEach(() => {
    simularFetch();
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("parte del puntos.json publicado y no hay cambios sin publicar", async () => {
    await abrirPanel();
    expect(filasTabla()).toBe(24);
    expect(screen.getByText(/Sustituye el fichero puntos.json de tu web por este/)).toBeVisible();
    expect(localStorage.getItem(CLAVE_BORRADOR)).toBeNull();
  });

  it("cerrar y reabrir un punto con un único interruptor; indicador de cambios y deshacer", async () => {
    const user = await abrirPanel();
    const interruptor = screen.getByRole("switch", { name: "Cerrado temporalmente: Punto demo 01" });
    expect(interruptor).toHaveAttribute("aria-checked", "false");

    await user.click(interruptor);
    expect(await screen.findByText("Hay cambios sin publicar")).toBeVisible();
    expect(screen.getByRole("switch", { name: "Cerrado temporalmente: Punto demo 01" })).toHaveAttribute("aria-checked", "true");
    expect(JSON.parse(localStorage.getItem(CLAVE_BORRADOR)!).puntos[0].estado).toBe("cerrado_temporal");

    // motivo y reapertura opcionales
    await user.type(screen.getAllByLabelText("Motivo (opcional)")[0]!, "Obras");
    await user.tab();
    await waitFor(() => expect(JSON.parse(localStorage.getItem(CLAVE_BORRADOR)!).puntos[0].motivoCierre).toBe("Obras"));

    // reabrir con otro clic
    await user.click(screen.getByRole("switch", { name: "Cerrado temporalmente: Punto demo 01" }));
    expect(screen.getByRole("switch", { name: "Cerrado temporalmente: Punto demo 01" })).toHaveAttribute("aria-checked", "false");
    // volver a lo publicado quita el aviso
    await waitFor(() => expect(screen.getByText("El borrador coincide con lo publicado")).toBeVisible());
  });

  it("deshacer vuelve atrás el último cambio", async () => {
    const user = await abrirPanel();
    expect(screen.getByRole("button", { name: "Deshacer" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Borrar Punto demo 02" }));
    await user.click(screen.getByRole("button", { name: "Sí, borrar" }));
    expect(filasTabla()).toBe(23);
    await user.click(screen.getByRole("button", { name: "Deshacer" }));
    expect(filasTabla()).toBe(24);
  });

  it("alta de un punto con validación y edición", async () => {
    const user = await abrirPanel();
    await user.click(screen.getByRole("button", { name: "Añadir punto" }));
    await user.click(screen.getByRole("button", { name: "Guardar punto" }));
    expect(screen.getByRole("alert")).toHaveTextContent(/Revisa los 5 campos/);

    await user.type(screen.getByLabelText("Nombre *"), "Punto demo 99");
    await user.type(screen.getByLabelText("Tipo *"), "Punto de información");
    await user.type(screen.getByLabelText("Dirección *"), "Calle Nueva 9");
    await user.type(screen.getByLabelText("Latitud *"), "12,1364");
    await user.type(screen.getByLabelText("Longitud *"), "-86.251");
    await user.click(screen.getByRole("button", { name: "Guardar punto" }));

    expect(await screen.findByText(/Punto «Punto demo 99» guardado/)).toBeVisible();
    expect(filasTabla()).toBe(25);
    const guardado = parsearArchivo(JSON.parse(localStorage.getItem(CLAVE_BORRADOR)!)).puntos.at(-1);
    expect(guardado).toMatchObject({ nombre: "Punto demo 99", lat: 12.1364, lng: -86.251 });
  });

  it("«Publicar cambios» descarga el puntos.json actualizado", async () => {
    const user = await abrirPanel();
    const blobs: Blob[] = [];
    vi.stubGlobal("URL", Object.assign(URL, { createObjectURL: (b: Blob) => (blobs.push(b), "blob:prueba"), revokeObjectURL: () => undefined }));
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);

    await user.click(screen.getByRole("switch", { name: "Cerrado temporalmente: Punto demo 01" }));
    await user.click(screen.getByRole("button", { name: "Publicar cambios" }));

    expect(blobs).toHaveLength(1);
    const archivo = JSON.parse(await blobs[0]!.text());
    expect(archivo.version).toBe(1);
    expect(archivo.puntos).toHaveLength(24);
    expect(archivo.puntos[0].estado).toBe("cerrado_temporal");
    expect(screen.getByText(/no serán visibles hasta que lo subas a tu web/)).toBeVisible();
  });

  it("«Descartar borrador» pide confirmación y vuelve al publicado", async () => {
    const user = await abrirPanel();
    await user.click(screen.getByRole("switch", { name: "Cerrado temporalmente: Punto demo 01" }));
    await screen.findByText("Hay cambios sin publicar");
    await user.click(screen.getByRole("button", { name: "Descartar borrador" }));
    expect(screen.getByRole("alertdialog")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Sí, descartar" }));
    expect(screen.getByText("El borrador coincide con lo publicado")).toBeVisible();
    expect(localStorage.getItem(CLAVE_BORRADOR)).toBeNull();
  });

  it("un borrador guardado tiene prioridad sobre lo publicado al reabrir el panel", async () => {
    const user = await abrirPanel();
    await user.click(screen.getByRole("button", { name: "Borrar Punto demo 03" }));
    await user.click(screen.getByRole("button", { name: "Sí, borrar" }));
    expect(filasTabla()).toBe(23);

    document.body.innerHTML = "";
    render(<PanelAdmin src="/puntos.json" onSalir={() => undefined} />);
    expect(await screen.findByText("Hay cambios sin publicar")).toBeVisible();
    expect(filasTabla()).toBe(23);
  });

  it("los puntos inválidos del publicado se avisan en el panel (no en la vista pública)", async () => {
    const roto = JSON.parse(PUBLICADO);
    roto.puntos[1].lat = 999;
    simularFetch(JSON.stringify(roto));
    render(<PanelAdmin src="/puntos.json" onSalir={() => undefined} />);
    expect(await screen.findByText(/1 punto del puntos.json publicado no es válido/)).toBeVisible();
    expect(filasTabla()).toBe(23);
  });

  it("si no se puede cargar el publicado, avisa y permite trabajar con el borrador", async () => {
    simularFetch("", 404);
    render(<PanelAdmin src="/puntos.json" onSalir={() => undefined} />);
    expect(await screen.findByText(/No se ha podido cargar el puntos.json publicado/)).toBeVisible();
    expect(screen.getByRole("button", { name: "Añadir punto" })).toBeEnabled();
  });
});

describe("importar la hoja desde el panel", () => {
  beforeEach(() => {
    simularFetch();
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  const subir = async (user: ReturnType<typeof userEvent.setup>, nombre: string) => {
    await user.click(screen.getByRole("button", { name: "Importar hoja" }));
    const entrada = document.querySelector<HTMLInputElement>('input[type="file"]')!;
    await user.upload(entrada, new File([publico(nombre)], nombre, { type: "text/csv" }));
  };

  it("vista previa de la hoja de ejemplo: 24 filas, 24 válidas; «Reemplazar todo» pide confirmación", async () => {
    const user = await abrirPanel();
    await subir(user, "ejemplo-hoja.csv");
    expect(await screen.findByText(/Vista previa de «ejemplo-hoja.csv»/)).toBeVisible();
    const tarjetas = screen.getByText("Filas").closest("div")!.parentElement!;
    expect(within(tarjetas).getByText("Filas").previousSibling).toHaveTextContent("24");
    expect(within(tarjetas).getByText("Válidas").previousSibling).toHaveTextContent("24");
    expect(within(tarjetas).getByText("Con error").previousSibling).toHaveTextContent("0");
    expect(screen.getByRole("radio", { name: /Reemplazar todo/ })).toBeChecked();

    await user.click(screen.getByRole("button", { name: "Importar 24 puntos" }));
    expect(screen.getByRole("alertdialog")).toHaveTextContent(/pasará a tener 24/);
    await user.click(screen.getByRole("button", { name: /Sí, reemplazar por 24/ }));

    expect(await screen.findByText(/Importados 24 puntos/)).toBeVisible();
    expect(filasTabla()).toBe(24);
    // misma hoja, mismos datos: nada nuevo que publicar
    expect(screen.getByText("El borrador coincide con lo publicado")).toBeVisible();
  });

  it("la hoja con errores marca cada fila problemática y deja corregir a mano antes de importar", async () => {
    const user = await abrirPanel();
    await subir(user, "ejemplo-hoja-con-errores.csv");
    await screen.findByText(/Filas con problemas/);
    const tarjetas = screen.getByText("Filas").closest("div")!.parentElement!;
    expect(within(tarjetas).getByText("Filas").previousSibling).toHaveTextContent("12");
    expect(within(tarjetas).getByText("Con error").previousSibling).toHaveTextContent("4");
    expect(within(tarjetas).getByText("Con aviso").previousSibling).toHaveTextContent("1");
    expect(screen.getByRole("button", { name: "Importar 8 puntos" })).toBeEnabled();
    expect(screen.getByText(/4 filas con error no se importarán/)).toBeVisible();

    // corrige la fila «sin coordenadas»
    const fila = screen.getByText(/Fila 8:/).closest("li")!;
    await user.type(within(fila).getByLabelText(/Latitud/), "12,1");
    await user.type(within(fila).getByLabelText(/Longitud/), "-86,2");
    await waitFor(() => expect(within(tarjetas).getByText("Con error").previousSibling).toHaveTextContent("3"));
    expect(screen.getByRole("button", { name: "Importar 9 puntos" })).toBeEnabled();

    // intercambia lat/lng de la fila marcada como «intercambiadas»
    await user.click(screen.getByRole("button", { name: /Intercambiar latitud y longitud/ }));
    await waitFor(() => expect(within(tarjetas).getByText("Con aviso").previousSibling).toHaveTextContent("0"));
  });

  it("«Combinar» no borra los ausentes y no pide confirmación de reemplazo", async () => {
    const user = await abrirPanel();
    await subir(user, "ejemplo-hoja-con-errores.csv");
    await screen.findByText(/Filas con problemas/);
    await user.click(screen.getByRole("radio", { name: /Combinar/ }));
    await user.click(screen.getByRole("button", { name: "Importar 8 puntos" }));
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(await screen.findByText(/Importados 8 puntos \(combinados/)).toBeVisible();
    // 24 publicados + 3 nuevos (la hoja repite 5 de los existentes)
    expect(filasTabla()).toBe(27);
  });

  it("rechaza formatos no admitidos con un mensaje claro", async () => {
    const user = await abrirPanel();
    await user.click(screen.getByRole("button", { name: "Importar hoja" }));
    const entrada = document.querySelector<HTMLInputElement>('input[type="file"]')!;
    await userEvent.setup({ applyAccept: false }).upload(entrada, new File(["x"], "foto.png", { type: "image/png" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/Formato no admitido/);
    void user;
  });
});
