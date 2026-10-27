import { waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { crearArchivo } from "../lib/esquema";
import { punto } from "../test/fabrica";

vi.mock("../components/Mapa", () => ({ default: () => null }));
// En las pruebas el CSS no se procesa: el «?inline» se sustituye por un texto reconocible.
vi.mock("../index.css?inline", () => ({ default: ".bp-root{color:red}" }));

const DATOS = [
  punto({ id: "a", nombre: "Punto demo 01", tipo: "Reciclaje" }),
  punto({ id: "b", nombre: "Punto demo 02", tipo: "Información", estado: "cerrado_temporal" }),
];

function montar(atributos: Record<string, string> = { "data-src": "/puntos.json" }) {
  const el = document.createElement("buscador-puntos");
  for (const [k, v] of Object.entries(atributos)) el.setAttribute(k, v);
  document.body.append(el);
  return el;
}

describe("<buscador-puntos>", () => {
  beforeEach(async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(crearArchivo(DATOS)))));
    await import("./main");
  });
  afterEach(() => {
    document.body.innerHTML = "";
    vi.unstubAllGlobals();
  });

  it("se registra como elemento personalizado y renderiza el listado dentro de su Shadow DOM", async () => {
    expect(customElements.get("buscador-puntos")).toBeDefined();
    const el = montar();
    expect(el.shadowRoot).not.toBeNull();
    await waitFor(() => expect(el.shadowRoot!.querySelectorAll("ul li").length).toBe(2));
    expect(el.shadowRoot!.textContent).toContain("Punto demo 01");
    expect(el.shadowRoot!.textContent).toContain("Cerrado temporalmente");
  });

  it("aísla estilos y DOM: los estilos van dentro del shadow root y el DOM público no ve el widget", async () => {
    const el = montar();
    await waitFor(() => expect(el.shadowRoot!.querySelector("li")).not.toBeNull());
    expect(el.shadowRoot!.querySelector("style")?.textContent).toContain(".bp-root");
    expect(document.querySelector(".bp-root")).toBeNull();
    expect(document.head.querySelectorAll("style")).toHaveLength(0);
  });

  it("admite dos instancias en la misma página, independientes entre sí", async () => {
    const a = montar();
    const b = montar({ "data-src": "/otro.json", "data-altura": "300px" });
    await waitFor(() => {
      expect(a.shadowRoot!.querySelectorAll("li").length).toBe(2);
      expect(b.shadowRoot!.querySelectorAll("li").length).toBe(2);
    });
    expect(a.shadowRoot).not.toBe(b.shadowRoot);
    expect((b.shadowRoot!.querySelector(".bp-root") as HTMLElement).style.getPropertyValue("--bp-altura")).toBe("300px");
    expect((a.shadowRoot!.querySelector(".bp-root") as HTMLElement).style.getPropertyValue("--bp-altura")).toBe("600px");
  });

  it("lee data-src y reacciona al cambio de atributos", async () => {
    const el = montar({ "data-src": "/uno.json" });
    await waitFor(() => expect(fetch).toHaveBeenCalledWith("/uno.json", expect.anything()));
    el.setAttribute("data-src", "/dos.json");
    await waitFor(() => expect(fetch).toHaveBeenCalledWith("/dos.json", expect.anything()));
  });

  it("ignora atributos peligrosos (javascript:) y valores no válidos", async () => {
    const el = montar({ "data-src": "/puntos.json", "data-logo": "javascript:alert(1)", "data-altura": "calc(1px)", "data-zoom": "99" });
    await waitFor(() => expect(el.shadowRoot!.querySelector("li")).not.toBeNull());
    expect(el.shadowRoot!.querySelector("img")).toBeNull();
    expect((el.shadowRoot!.querySelector(".bp-root") as HTMLElement).style.getPropertyValue("--bp-altura")).toBe("600px");
  });

  it("pinta el logo opcional (data-logo) en la cabecera", async () => {
    const el = montar({ "data-src": "/puntos.json", "data-logo": "https://ejemplo.es/logo.svg" });
    await waitFor(() => expect(el.shadowRoot!.querySelector("header img")).not.toBeNull());
    expect(el.shadowRoot!.querySelector("header img")?.getAttribute("src")).toBe("https://ejemplo.es/logo.svg");
  });

  it("al quitarlo de la página se desmonta sin errores", async () => {
    const el = montar();
    await waitFor(() => expect(el.shadowRoot!.querySelector("li")).not.toBeNull());
    expect(() => el.remove()).not.toThrow();
  });
});
