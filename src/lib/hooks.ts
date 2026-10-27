import { useCallback, useEffect, useRef, useState } from "react";
import { cargarPuntos, guardarCache, leerCache } from "./almacenamiento";
import type { Coord } from "./geo";
import type { Punto } from "./esquema";

export type FaseCarga = "cargando" | "listo" | "error";

interface EstadoPuntos {
  puntos: Punto[];
  fase: FaseCarga;
  /** true mientras lo que se muestra viene de la caché local. */
  desdeCache: boolean;
}

/**
 * Carga `puntos.json`. Si hay una copia en caché la devuelve en el primer pintado y
 * renueva en segundo plano; si la red falla, la caché sigue siendo utilizable.
 */
export function usePuntos(src: string) {
  const [estado, setEstado] = useState<EstadoPuntos>(() => {
    const cache = leerCache(src);
    return { puntos: cache?.puntos ?? [], fase: "cargando", desdeCache: Boolean(cache) };
  });
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    const control = new AbortController();
    cargarPuntos(src, control.signal)
      .then((r) => {
        setEstado({ puntos: r.puntos, fase: "listo", desdeCache: false });
        guardarCache(src, r.puntos, r.generadoEn);
      })
      .catch((e: unknown) => {
        if (control.signal.aborted) return;
        console.warn("[buscador-puntos] no se pudo cargar la lista:", e);
        setEstado((previo) => ({ ...previo, fase: "error" }));
      });
    return () => control.abort();
  }, [src, intento]);

  const reintentar = useCallback(() => {
    setEstado((previo) => ({ ...previo, fase: "cargando" }));
    setIntento((n) => n + 1);
  }, []);

  return { ...estado, reintentar };
}

export type EstadoUbicacion = "inactiva" | "buscando" | "activa" | "denegada" | "error" | "no-soportada";

/** «Cerca de mí»: la geolocalización es opcional; cualquier fallo deja la app usable. */
export function useUbicacion() {
  const [estado, setEstado] = useState<EstadoUbicacion>("inactiva");
  const [coord, setCoord] = useState<Coord | null>(null);
  const montado = useRef(true);

  useEffect(() => {
    montado.current = true;
    return () => {
      montado.current = false;
    };
  }, []);

  const solicitar = useCallback(() => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      setEstado("no-soportada");
      return;
    }
    setEstado("buscando");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (!montado.current) return;
        setCoord({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setEstado("activa");
      },
      (err) => {
        if (!montado.current) return;
        setCoord(null);
        setEstado(err.code === 1 ? "denegada" : "error");
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60_000 },
    );
  }, []);

  const limpiar = useCallback(() => {
    setCoord(null);
    setEstado("inactiva");
  }, []);

  return { estado, coord, solicitar, limpiar };
}
