import type { Resena } from "../lib/esquema";
import { formatearFecha } from "../lib/utiles";

/** Reseñas breves de un punto, plegadas por defecto para que la ficha siga siendo breve. */
export function Resenas({ resenas }: { resenas?: Resena[] }) {
  if (!resenas || resenas.length === 0) return null;
  return (
    <details className="bp-resenas">
      <summary>{resenas.length === 1 ? "1 reseña" : `${resenas.length} reseñas`}</summary>
      <ul className="bp-resenas-lista">
        {resenas.map((r) => (
          <li key={r.id}>
            <p className="bp-resena-texto">«{r.texto}»</p>
            <p className="bp-resena-meta">
              {r.autor ? `${r.autor}, ` : ""}
              {formatearFecha(r.fecha)}
            </p>
          </li>
        ))}
      </ul>
    </details>
  );
}
