import { useEffect, useState } from "react";

export function reducirMovimiento(): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function"
    ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
    : false;
}

/** 2026-11-15 → «15 de noviembre de 2026». Las fechas sin hora se leen en UTC para no retroceder un día. */
export function formatearFecha(iso: string): string {
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return iso;
  const soloFecha = /^\d{4}-\d{2}-\d{2}$/.test(iso);
  return fecha.toLocaleDateString("es-ES", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: soloFecha ? "UTC" : undefined,
  });
}

/** «+505 2255 0100» → «tel:+50522550100». */
export function hrefTelefono(telefono: string): string {
  return `tel:${telefono.replace(/[^\d+]/g, "")}`;
}

export function useDebounced<T>(valor: T, ms: number): T {
  const [debounced, setDebounced] = useState(valor);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(valor), ms);
    return () => clearTimeout(t);
  }, [valor, ms]);
  return debounced;
}

export function pluralPuntos(n: number): string {
  return n === 1 ? "1 punto" : `${n} puntos`;
}
