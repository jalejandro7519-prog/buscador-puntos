import { etiquetaComoLlegar, urlComoLlegar, type Plataforma } from "../lib/directions";
import type { Punto } from "../lib/esquema";
import { formatearDistancia } from "../lib/geo";
import { formatearFecha, hrefTelefono } from "../lib/utiles";

function el<K extends keyof HTMLElementTagNameMap>(etiqueta: K, clase: string, texto?: string): HTMLElementTagNameMap[K] {
  const nodo = document.createElement(etiqueta);
  nodo.className = clase;
  if (texto !== undefined) nodo.textContent = texto;
  return nodo;
}

/** Ficha del popup del mapa. Solo textContent/atributos: los datos nunca se interpretan como HTML. */
export function crearPopupDom(punto: Punto, distanciaKm: number | null, plataforma: Plataforma): HTMLElement {
  const cerrado = punto.estado === "cerrado_temporal";
  const raiz = el("article", `bp-popup bp-ficha ${cerrado ? "bp-ficha-cerrada" : ""}`);

  raiz.append(el("h3", "bp-ficha-titulo", punto.nombre));
  if (cerrado) {
    raiz.append(el("p", "bp-insignia", "Cerrado temporalmente"));
    const detalle = [
      punto.motivoCierre ? `Motivo: ${punto.motivoCierre}.` : "",
      punto.reaperturaPrevista ? `Reapertura prevista: ${formatearFecha(punto.reaperturaPrevista)}.` : "",
    ]
      .filter(Boolean)
      .join(" ");
    if (detalle) raiz.append(el("p", "bp-ficha-linea", detalle));
  }
  raiz.append(el("p", "bp-ficha-meta", distanciaKm === null ? punto.tipo : `${punto.tipo} · ${formatearDistancia(distanciaKm)}`));
  raiz.append(
    el("p", "bp-ficha-linea", `${punto.direccion}${punto.ciudad ? `, ${punto.ciudad}` : ""}${punto.codigoPostal ? ` (${punto.codigoPostal})` : ""}`),
  );
  if (punto.horario) raiz.append(el("p", "bp-ficha-linea", `Horario: ${punto.horario}`));
  if (punto.telefono) {
    const linea = el("p", "bp-ficha-linea", "Teléfono: ");
    const enlace = el("a", "bp-enlace", punto.telefono);
    enlace.href = hrefTelefono(punto.telefono);
    linea.append(enlace);
    raiz.append(linea);
  }

  const destino = { lat: punto.lat, lng: punto.lng, nombre: punto.nombre, direccion: punto.direccion };
  const acciones = el("div", "bp-ficha-acciones");
  if (cerrado) {
    const boton = el("button", "bp-boton bp-boton-lleno", "Cómo llegar");
    boton.type = "button";
    boton.disabled = true;
    boton.setAttribute("aria-label", `${etiquetaComoLlegar(destino)} (no disponible: cerrado temporalmente)`);
    acciones.append(boton);
  } else {
    const enlace = el("a", "bp-boton bp-boton-lleno", "Cómo llegar");
    enlace.href = urlComoLlegar(destino, plataforma);
    enlace.target = "_blank";
    enlace.rel = "noopener noreferrer";
    enlace.setAttribute("aria-label", `${etiquetaComoLlegar(destino)} (se abre en otra pestaña)`);
    acciones.append(enlace);
  }
  raiz.append(acciones);
  return raiz;
}
