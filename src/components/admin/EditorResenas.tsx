import { useId, useState } from "react";
import { MAX_RESENAS, MAX_TEXTO_RESENA, type Resena } from "../../lib/esquema";
import { formatearFecha } from "../../lib/utiles";

interface Props {
  resenas: Resena[];
  onCambio: (resenas: Resena[]) => void;
}

function idNuevo(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `r-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Alta y baja de reseñas breves de un punto (máx. 5, 280 caracteres cada una). */
export function EditorResenas({ resenas, onCambio }: Props) {
  const base = useId();
  const [texto, setTexto] = useState("");
  const [autor, setAutor] = useState("");
  const [error, setError] = useState<string | null>(null);
  const lleno = resenas.length >= MAX_RESENAS;

  const anadir = () => {
    const limpio = texto.trim();
    if (!limpio) {
      setError("Escribe el texto de la reseña.");
      return;
    }
    onCambio([
      ...resenas,
      { id: idNuevo(), texto: limpio, ...(autor.trim() ? { autor: autor.trim() } : {}), fecha: new Date().toISOString() },
    ]);
    setTexto("");
    setAutor("");
    setError(null);
  };

  return (
    <fieldset className="mt-4 border-0 p-0">
      <legend className="mb-1 font-semibold">
        Reseñas breves ({resenas.length}/{MAX_RESENAS})
      </legend>

      {resenas.length > 0 && (
        <ul className="m-0 mb-3 flex list-none flex-col gap-2 p-0">
          {resenas.map((r) => (
            <li key={r.id} className="flex items-start justify-between gap-3 rounded-bp border border-gray-300 bg-gray-50 p-3">
              <div>
                <p className="m-0">«{r.texto}»</p>
                <p className="m-0 text-sm text-gray-600">
                  {r.autor ? `${r.autor}, ` : ""}
                  {formatearFecha(r.fecha)}
                </p>
              </div>
              <button
                type="button"
                className="bp-boton bp-boton-borde shrink-0"
                aria-label={`Quitar la reseña: ${r.texto.slice(0, 40)}`}
                onClick={() => onCambio(resenas.filter((x) => x.id !== r.id))}
              >
                Quitar
              </button>
            </li>
          ))}
        </ul>
      )}

      {lleno ? (
        <p className="m-0 text-sm">Se ha alcanzado el máximo de {MAX_RESENAS} reseñas por punto. Quita una para añadir otra.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-[2fr_1fr]">
          <div className="flex flex-col gap-1">
            <label htmlFor={`${base}-t`} className="font-semibold">
              Texto de la reseña
            </label>
            <textarea
              id={`${base}-t`}
              rows={2}
              maxLength={MAX_TEXTO_RESENA}
              className="bp-input"
              value={texto}
              aria-invalid={Boolean(error)}
              aria-describedby={`${base}-c`}
              onChange={(e) => setTexto(e.target.value)}
            />
            <p id={`${base}-c`} className={`m-0 text-sm ${error ? "font-semibold text-red-700" : ""}`}>
              {error ?? `${texto.length}/${MAX_TEXTO_RESENA} caracteres`}
            </p>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor={`${base}-a`} className="font-semibold">
              Autor (opcional)
            </label>
            <input id={`${base}-a`} className="bp-input" value={autor} onChange={(e) => setAutor(e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <button type="button" className="bp-boton bp-boton-borde" onClick={anadir}>
              Añadir reseña
            </button>
          </div>
        </div>
      )}
    </fieldset>
  );
}
