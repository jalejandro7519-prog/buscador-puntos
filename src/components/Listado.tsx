import { useEffect, useRef } from "react";
import type { Plataforma } from "../lib/directions";
import type { PuntoConDistancia } from "../lib/geo";
import { reducirMovimiento } from "../lib/utiles";
import { FichaPunto } from "./FichaPunto";

interface Props {
  items: PuntoConDistancia[];
  seleccionadoId: string | null;
  onSeleccionar: (id: string) => void;
  plataforma: Plataforma;
}

export function Listado({ items, seleccionadoId, onSeleccionar, plataforma }: Props) {
  const elementos = useRef(new Map<string, HTMLLIElement>());

  // Al seleccionar (p. ej. desde el mapa) el elemento se acerca a la vista.
  useEffect(() => {
    if (!seleccionadoId) return;
    elementos.current.get(seleccionadoId)?.scrollIntoView?.({
      block: "nearest",
      behavior: reducirMovimiento() ? "auto" : "smooth",
    });
  }, [seleccionadoId]);

  return (
    <ul className="bp-lista-ul">
      {items.map(({ punto, distanciaKm }) => (
        <li
          key={punto.id}
          data-punto-id={punto.id}
          ref={(el) => {
            if (el) elementos.current.set(punto.id, el);
            else elementos.current.delete(punto.id);
          }}
          aria-current={punto.id === seleccionadoId ? "true" : undefined}
          className="bp-lista-item"
        >
          <FichaPunto
            punto={punto}
            distanciaKm={distanciaKm}
            plataforma={plataforma}
            seleccionado={punto.id === seleccionadoId}
            onSeleccionar={onSeleccionar}
          />
        </li>
      ))}
    </ul>
  );
}
