import { useId, useMemo, useState } from "react";
import { coincideTexto, tiposDisponibles } from "../../lib/busqueda";
import type { Punto } from "../../lib/esquema";
import { Confirmar } from "./Confirmar";

interface Props {
  puntos: Punto[];
  onEditar: (punto: Punto) => void;
  onBorrar: (id: string) => void;
  /** Un único interruptor: cierra (con motivo y reapertura opcionales) o reabre. */
  onCierre: (id: string, cerrado: boolean, motivo?: string, reapertura?: string) => void;
}

/** Motivo y fecha de reapertura de una fila cerrada: se guardan al salir del campo. */
function DatosCierre({ punto, onCierre }: { punto: Punto; onCierre: Props["onCierre"] }) {
  const base = useId();
  const [motivo, setMotivo] = useState(punto.motivoCierre ?? "");
  const [reapertura, setReapertura] = useState(punto.reaperturaPrevista ?? "");
  // Si el punto cambia desde fuera (p. ej. «Deshacer»), los campos siguen al dato.
  const [previo, setPrevio] = useState({ m: punto.motivoCierre, r: punto.reaperturaPrevista });
  if (previo.m !== punto.motivoCierre || previo.r !== punto.reaperturaPrevista) {
    setPrevio({ m: punto.motivoCierre, r: punto.reaperturaPrevista });
    setMotivo(punto.motivoCierre ?? "");
    setReapertura(punto.reaperturaPrevista ?? "");
  }
  const guardar = () => onCierre(punto.id, true, motivo, reapertura || undefined);
  return (
    <div className="mt-2 flex flex-col gap-2">
      <label htmlFor={`${base}-m`} className="text-sm font-semibold">
        Motivo (opcional)
      </label>
      <input id={`${base}-m`} className="bp-input" value={motivo} onChange={(e) => setMotivo(e.target.value)} onBlur={guardar} />
      <label htmlFor={`${base}-r`} className="text-sm font-semibold">
        Reapertura prevista (opcional)
      </label>
      <input
        id={`${base}-r`}
        type="date"
        className="bp-input"
        value={reapertura}
        onChange={(e) => setReapertura(e.target.value)}
        onBlur={guardar}
      />
    </div>
  );
}

export function TablaPuntos({ puntos, onEditar, onBorrar, onCierre }: Props) {
  const base = useId();
  const [texto, setTexto] = useState("");
  const [tipo, setTipo] = useState("");
  const [estado, setEstado] = useState<"" | "abierto" | "cerrado_temporal">("");
  const [borrando, setBorrando] = useState<Punto | null>(null);

  const tipos = useMemo(() => tiposDisponibles(puntos), [puntos]);
  const visibles = useMemo(
    () =>
      puntos.filter(
        (p) => (!tipo || p.tipo === tipo) && (!estado || p.estado === estado) && (!texto || coincideTexto(p, texto)),
      ),
    [puntos, texto, tipo, estado],
  );

  return (
    <section aria-labelledby={`${base}-t`}>
      <h2 id={`${base}-t`} className="mb-2 mt-4 text-xl font-bold">
        Puntos <span className="font-normal">({puntos.length})</span>
      </h2>

      <div className="mb-3 grid gap-3 sm:grid-cols-3">
        <div className="flex flex-col gap-1">
          <label htmlFor={`${base}-q`} className="font-semibold">
            Buscar
          </label>
          <input id={`${base}-q`} type="search" className="bp-input" value={texto} onChange={(e) => setTexto(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={`${base}-tipo`} className="font-semibold">
            Tipo
          </label>
          <select id={`${base}-tipo`} className="bp-input" value={tipo} onChange={(e) => setTipo(e.target.value)}>
            <option value="">Todos</option>
            {tipos.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={`${base}-estado`} className="font-semibold">
            Estado
          </label>
          <select
            id={`${base}-estado`}
            className="bp-input"
            value={estado}
            onChange={(e) => setEstado(e.target.value as typeof estado)}
          >
            <option value="">Todos</option>
            <option value="abierto">Abiertos</option>
            <option value="cerrado_temporal">Cerrados temporalmente</option>
          </select>
        </div>
      </div>

      <p role="status" aria-live="polite" className="my-2">
        {visibles.length === puntos.length ? `${puntos.length} puntos` : `${visibles.length} de ${puntos.length} puntos`}
      </p>

      {borrando && (
        <Confirmar
          titulo={`¿Borrar «${borrando.nombre}»?`}
          etiquetaConfirmar="Sí, borrar"
          onCancelar={() => setBorrando(null)}
          onConfirmar={() => {
            onBorrar(borrando.id);
            setBorrando(null);
          }}
        >
          Podrás deshacerlo con «Deshacer» mientras no cierres el panel.
        </Confirmar>
      )}

      {visibles.length === 0 ? (
        <p className="bp-vacio">{puntos.length === 0 ? "Todavía no hay puntos. Importa una hoja o añade el primero." : "Ningún punto coincide con los filtros."}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <caption className="bp-sr">Lista de puntos</caption>
            <thead>
              <tr className="border-b-2 border-gray-300">
                <th scope="col" className="p-2">Nombre</th>
                <th scope="col" className="p-2">Tipo</th>
                <th scope="col" className="p-2">Dirección</th>
                <th scope="col" className="p-2">CP</th>
                <th scope="col" className="p-2">Cerrado temporalmente</th>
                <th scope="col" className="p-2">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {visibles.map((p) => {
                const cerrado = p.estado === "cerrado_temporal";
                return (
                  <tr key={p.id} className={`border-b border-gray-200 align-top ${cerrado ? "bg-gray-100 text-gray-600" : ""}`}>
                    <th scope="row" className="p-2 font-semibold">
                      {p.nombre}
                      {p.resenas && p.resenas.length > 0 && (
                        <span className="block text-sm font-normal">
                          {p.resenas.length === 1 ? "1 reseña" : `${p.resenas.length} reseñas`}
                        </span>
                      )}
                    </th>
                    <td className="p-2">{p.tipo}</td>
                    <td className="p-2">{p.direccion}</td>
                    <td className="p-2">{p.codigoPostal}</td>
                    <td className="min-w-48 p-2">
                      <button
                        type="button"
                        role="switch"
                        aria-checked={cerrado}
                        aria-label={`Cerrado temporalmente: ${p.nombre}`}
                        className={`relative inline-flex h-11 w-16 items-center rounded-full border-2 ${cerrado ? "border-gray-700 bg-gray-700" : "border-gray-500 bg-white"}`}
                        onClick={() => onCierre(p.id, !cerrado)}
                      >
                        <span
                          aria-hidden="true"
                          className={`inline-block h-7 w-7 rounded-full transition-transform ${cerrado ? "translate-x-7 bg-white" : "translate-x-1 bg-gray-500"}`}
                        />
                      </button>
                      <span className="ml-2 align-middle text-sm font-semibold">{cerrado ? "Cerrado" : "Abierto"}</span>
                      {cerrado && <DatosCierre key={p.id} punto={p} onCierre={onCierre} />}
                    </td>
                    <td className="p-2">
                      <div className="flex flex-wrap gap-2">
                        <button type="button" className="bp-boton bp-boton-borde" onClick={() => onEditar(p)} aria-label={`Editar ${p.nombre}`}>
                          Editar
                        </button>
                        <button type="button" className="bp-boton bp-boton-borde" onClick={() => setBorrando(p)} aria-label={`Borrar ${p.nombre}`}>
                          Borrar
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
