import type { Punto } from "./esquema";
import { centroide, ordenarPorDistancia, type Coord, type PuntoConDistancia } from "./geo";
import { normalizar } from "./texto";

export { normalizar };

/** Los códigos postales tienen 5 dígitos (se guardan siempre como texto). */
const FORMATO_CP = /^\d{5}$/;

export interface ConsultaBusqueda {
  texto: string;
  /** Tipos seleccionados; vacío = «Todos». */
  tipos: readonly string[];
  /** Posición del usuario si activó «Cerca de mí». */
  ubicacion?: Coord | null;
}

export type ModoBusqueda = "ninguno" | "texto" | "codigoPostal" | "cercania";

export interface ResultadoBusqueda {
  items: PuntoConDistancia[];
  modo: ModoBusqueda;
  /** Punto de referencia de las distancias (centroide del CP o ubicación). */
  origen: Coord | null;
  /** Código postal buscado (solo en modo codigoPostal o si no existe). */
  codigoPostal?: string;
  /** true si la entrada parece un CP pero no hay puntos con él. */
  codigoPostalInexistente: boolean;
}

export function esCodigoPostal(texto: string): boolean {
  return FORMATO_CP.test(texto.trim());
}

/** Centroide de los puntos que comparten un código postal (null si no hay ninguno). */
export function centroideCodigoPostal(puntos: readonly Punto[], codigoPostal: string): Coord | null {
  return centroide(puntos.filter((p) => p.codigoPostal === codigoPostal));
}

export function tiposDisponibles(puntos: readonly Punto[]): string[] {
  return [...new Set(puntos.map((p) => p.tipo))].sort((a, b) => a.localeCompare(b, "es"));
}

function pajar(p: Punto): string {
  return normalizar(`${p.nombre} ${p.direccion} ${p.ciudad} ${p.tipo}`);
}

/** Todas las palabras de la consulta deben aparecer (sin tildes ni mayúsculas). */
export function coincideTexto(punto: Punto, texto: string): boolean {
  const palabras = normalizar(texto).split(/\s+/).filter(Boolean);
  if (palabras.length === 0) return true;
  const heno = pajar(punto);
  return palabras.every((p) => heno.includes(p));
}

export function buscar(puntos: readonly Punto[], consulta: ConsultaBusqueda): ResultadoBusqueda {
  const texto = consulta.texto.trim();
  const porTipo = consulta.tipos.length === 0 ? puntos : puntos.filter((p) => consulta.tipos.includes(p.tipo));

  // 1) Código postal existente: todo el listado por distancia al centroide.
  if (esCodigoPostal(texto)) {
    const origen = centroideCodigoPostal(puntos, texto);
    if (origen) {
      return {
        items: ordenarPorDistancia(porTipo, origen),
        modo: "codigoPostal",
        origen,
        codigoPostal: texto,
        codigoPostalInexistente: false,
      };
    }
    // CP inexistente: se avisa, pero el listado sigue completo y usable.
    const origenUsuario = consulta.ubicacion ?? null;
    return {
      items: ordenarPorDistancia(porTipo, origenUsuario),
      modo: origenUsuario ? "cercania" : "ninguno",
      origen: origenUsuario,
      codigoPostal: texto,
      codigoPostalInexistente: true,
    };
  }

  // 2) Texto (y/o cercanía).
  const filtrados = texto ? porTipo.filter((p) => coincideTexto(p, texto)) : porTipo;
  const origen = consulta.ubicacion ?? null;
  return {
    items: ordenarPorDistancia(filtrados, origen),
    modo: origen ? "cercania" : texto ? "texto" : "ninguno",
    origen,
    codigoPostalInexistente: false,
  };
}
