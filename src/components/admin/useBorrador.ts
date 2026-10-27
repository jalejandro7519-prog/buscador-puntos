import { useEffect, useState } from "react";
import { borrarBorrador, cargarPuntos, guardarBorrador, leerBorrador } from "../../lib/almacenamiento";
import { hayCambios } from "../../lib/edicion";
import type { Punto, PuntoDescartado } from "../../lib/esquema";

const NIVELES_DESHACER = 20;

/**
 * Estado del panel: lo publicado (puntos.json), el borrador en localStorage y la pila de deshacer.
 * Mientras no se toca nada, el borrador no existe y se trabaja sobre lo publicado.
 */
export function useBorrador(src: string) {
  const [publicado, setPublicado] = useState<Punto[] | null>(null);
  const [descartados, setDescartados] = useState<PuntoDescartado[]>([]);
  const [errorPublicado, setErrorPublicado] = useState<string | null>(null);
  const [borrador, setBorrador] = useState<Punto[] | null>(() => leerBorrador()?.puntos ?? null);
  const [historial, setHistorial] = useState<Punto[][]>([]);
  const [fallaAlmacenamiento, setFallaAlmacenamiento] = useState(false);

  useEffect(() => {
    const control = new AbortController();
    cargarPuntos(src, control.signal)
      .then((r) => {
        setPublicado(r.puntos);
        setDescartados(r.descartados);
      })
      .catch((e: unknown) => {
        if (control.signal.aborted) return;
        setPublicado([]);
        setErrorPublicado(e instanceof Error ? e.message : String(e));
      });
    return () => control.abort();
  }, [src]);

  const puntos = borrador ?? publicado ?? [];
  const cargando = publicado === null;

  const aplicar = (cambio: (previos: Punto[]) => Punto[]) => {
    const nuevo = cambio(puntos);
    setHistorial((h) => [...h.slice(-(NIVELES_DESHACER - 1)), puntos]);
    setBorrador(nuevo);
    setFallaAlmacenamiento(!guardarBorrador(nuevo));
  };

  const deshacer = () => {
    const anterior = historial.at(-1);
    if (!anterior) return;
    setHistorial((h) => h.slice(0, -1));
    setBorrador(anterior);
    setFallaAlmacenamiento(!guardarBorrador(anterior));
  };

  const descartarBorrador = () => {
    borrarBorrador();
    setBorrador(null);
    setHistorial([]);
    setFallaAlmacenamiento(false);
  };

  return {
    puntos,
    cargando,
    publicado,
    descartados,
    errorPublicado,
    hayBorrador: borrador !== null,
    sinPublicar: publicado !== null && hayCambios(puntos, publicado),
    puedeDeshacer: historial.length > 0,
    fallaAlmacenamiento,
    aplicar,
    deshacer,
    descartarBorrador,
  };
}
