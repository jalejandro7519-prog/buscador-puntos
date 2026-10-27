export type Plataforma = "ios" | "otras";

interface Navegador {
  userAgent?: string;
  platform?: string;
  maxTouchPoints?: number;
}

interface Destino {
  lat: number;
  lng: number;
  nombre: string;
  direccion?: string;
}

/** iPhone/iPad/iPod, incluido iPadOS que se presenta como Mac con pantalla táctil. */
export function detectarPlataforma(
  nav: Navegador | undefined = typeof navigator === "undefined" ? undefined : navigator,
): Plataforma {
  if (!nav) return "otras";
  const ua = nav.userAgent ?? "";
  if (/iPad|iPhone|iPod/.test(ua)) return "ios";
  if (nav.platform === "MacIntel" && (nav.maxTouchPoints ?? 0) > 1) return "ios";
  return "otras";
}

/**
 * URL de «Cómo llegar». Se usan siempre las coordenadas (exactas); la dirección
 * solo sirve de etiqueta visible (ver `etiquetaComoLlegar`).
 */
export function urlComoLlegar(destino: Destino, plataforma: Plataforma): string {
  const coords = `${destino.lat},${destino.lng}`;
  if (plataforma === "ios") {
    return `https://maps.apple.com/?daddr=${coords}&dirflg=d&q=${encodeURIComponent(destino.nombre)}`;
  }
  return `https://www.google.com/maps/dir/?api=1&destination=${coords}`;
}

export function etiquetaComoLlegar(destino: Pick<Destino, "nombre" | "direccion">): string {
  return `Cómo llegar a ${destino.nombre}${destino.direccion ? `, ${destino.direccion}` : ""}`;
}
