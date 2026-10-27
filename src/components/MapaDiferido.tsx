import { Suspense, lazy, useCallback, useEffect, useRef, useState } from "react";
import { preconectar } from "../lib/utiles";
import { ErrorBoundary } from "./ErrorBoundary";
import type { PropsMapa } from "./Mapa";

// El código del mapa (y Leaflet con él) es un fragmento aparte: nunca va en el bundle inicial.
const Mapa = lazy(() => import("./Mapa"));

export type EstadoMapa = "espera" | "cargando" | "listo" | "tarde" | "fallo";

const LIMITE_MS = 6000;

type Props = Omit<PropsMapa, "onListo" | "onFallo"> & {
  onEstado: (estado: EstadoMapa) => void;
};

/**
 * Monta el mapa DESPUÉS del primer pintado del listado: espera a que el navegador esté libre
 * (requestIdleCallback, con respaldo) y a que el contenedor esté cerca de la zona visible.
 */
export function MapaDiferido({ onEstado, ...props }: Props) {
  const contenedor = useRef<HTMLDivElement>(null);
  const [estado, setEstado] = useState<EstadoMapa>("espera");
  const { tileUrl } = props;
  useEffect(() => preconectar(tileUrl), [tileUrl]);

  const cambiar = useCallback(
    (nuevo: EstadoMapa) => {
      setEstado(nuevo);
      onEstado(nuevo);
    },
    [onEstado],
  );

  // Activación diferida
  useEffect(() => {
    let cancelado = false;
    let observador: IntersectionObserver | undefined;
    let idle: number | undefined;
    let temporizador: ReturnType<typeof setTimeout> | undefined;

    const activar = () => {
      if (cancelado) return;
      void import("./Mapa"); // se pide ya; React.lazy reutiliza la misma promesa
      cambiar("cargando");
    };
    const cuandoVisible = () => {
      if (cancelado) return;
      if (typeof IntersectionObserver !== "undefined" && contenedor.current) {
        observador = new IntersectionObserver(
          (entradas) => {
            if (entradas.some((e) => e.isIntersecting)) {
              observador?.disconnect();
              activar();
            }
          },
          { rootMargin: "200px" },
        );
        observador.observe(contenedor.current);
      } else {
        activar();
      }
    };

    if (typeof requestIdleCallback === "function") {
      idle = requestIdleCallback(cuandoVisible, { timeout: 50 });
    } else {
      temporizador = setTimeout(cuandoVisible, 200);
    }
    return () => {
      cancelado = true;
      observador?.disconnect();
      if (idle !== undefined && typeof cancelIdleCallback === "function") cancelIdleCallback(idle);
      if (temporizador) clearTimeout(temporizador);
    };
  }, [cambiar]);

  // Si en 6 s no está listo, se avisa (el listado ya es plenamente usable).
  useEffect(() => {
    if (estado !== "cargando") return;
    const t = setTimeout(() => setEstado((e) => (e === "cargando" ? "tarde" : e)), LIMITE_MS);
    return () => clearTimeout(t);
  }, [estado]);
  useEffect(() => {
    if (estado === "tarde") onEstado("tarde");
  }, [estado, onEstado]);

  const listo = useCallback(() => cambiar("listo"), [cambiar]);
  const fallo = useCallback(() => cambiar("fallo"), [cambiar]);

  return (
    <div ref={contenedor} className="bp-mapa-contenedor" style={{ position: "absolute", inset: 0 }}>
      {estado !== "listo" && estado !== "fallo" && <div className="bp-mapa-esqueleto" aria-hidden="true" />}
      {estado !== "espera" && estado !== "fallo" && (
        <ErrorBoundary onError={fallo} fallback={null}>
          <Suspense fallback={null}>
            <Mapa {...props} onListo={listo} onFallo={fallo} />
          </Suspense>
        </ErrorBoundary>
      )}
    </div>
  );
}
