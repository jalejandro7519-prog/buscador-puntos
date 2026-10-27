import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { BuscadorPuntos } from "../components/BuscadorPuntos";
import estilos from "../index.css?inline";
import { opcionesDesdeAtributos } from "../lib/opciones";

export const ETIQUETA = "buscador-puntos";

const ATRIBUTOS = [
  "data-src",
  "data-tile-url",
  "data-centro",
  "data-zoom",
  "data-altura",
  "data-idioma",
  "data-logo",
  "data-atribucion",
] as const;

/**
 * <buscador-puntos data-src="…/puntos.json"></buscador-puntos>
 * Shadow DOM: el CSS de la web anfitriona no entra en el widget ni el del widget sale de él.
 * Solo se heredan la tipografía y las variables --bp-* (tematización).
 */
export class BuscadorPuntosElement extends HTMLElement {
  static observedAttributes = ATRIBUTOS;

  private montaje: HTMLDivElement | null = null;
  private raiz: Root | null = null;

  connectedCallback() {
    if (!this.montaje) {
      const sombra = this.shadowRoot ?? this.attachShadow({ mode: "open" });
      const estilo = document.createElement("style");
      estilo.textContent = `${estilos}\n:host([hidden]){display:none}`;
      this.montaje = document.createElement("div");
      sombra.append(estilo, this.montaje);
    }
    this.raiz ??= createRoot(this.montaje);
    this.pintar();
  }

  attributeChangedCallback() {
    if (this.raiz) this.pintar();
  }

  disconnectedCallback() {
    this.raiz?.unmount();
    this.raiz = null;
  }

  private pintar() {
    this.raiz?.render(createElement(BuscadorPuntos, opcionesDesdeAtributos((nombre) => this.getAttribute(nombre))));
  }
}

if (!customElements.get(ETIQUETA)) {
  customElements.define(ETIQUETA, BuscadorPuntosElement);
}
