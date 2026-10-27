import { useMemo, useState } from "react";
import { tiposDisponibles } from "../../lib/busqueda";
import { aCsv, aJson, borrarPunto, descargarArchivo, fijarCierre, guardarPunto } from "../../lib/edicion";
import type { Punto } from "../../lib/esquema";
import { aplicarImportacion, type ModoImportacion } from "../../lib/importar";
import { Confirmar } from "./Confirmar";
import { FormularioPunto } from "./FormularioPunto";
import { ImportarHoja } from "./ImportarHoja";
import { TablaPuntos } from "./TablaPuntos";
import { useBorrador } from "./useBorrador";

interface Props {
  /** URL del puntos.json publicado. */
  src: string;
  onSalir: () => void;
}

type Vista = "puntos" | "importar";

export function PanelAdmin({ src, onSalir }: Props) {
  const b = useBorrador(src);
  const [vista, setVista] = useState<Vista>("puntos");
  const [formulario, setFormulario] = useState<{ editando: Punto | null } | null>(null);
  const [descartando, setDescartando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [descargadoDe, setDescargadoDe] = useState<Punto[] | null>(null);

  const tipos = useMemo(() => tiposDisponibles(b.puntos), [b.puntos]);
  const descargado = descargadoDe === b.puntos;

  const publicar = () => {
    descargarArchivo("puntos.json", aJson(b.puntos), "application/json");
    setDescargadoDe(b.puntos);
  };

  const importar = (nuevos: Punto[], modo: ModoImportacion) => {
    b.aplicar((actuales) => aplicarImportacion(actuales, nuevos, modo));
    setVista("puntos");
    setAviso(
      modo === "reemplazar"
        ? `Importados ${nuevos.length} puntos (se ha reemplazado todo).`
        : `Importados ${nuevos.length} puntos (combinados con los existentes).`,
    );
  };

  return (
    <main className="mx-auto max-w-6xl p-4">
      <div className="bp-root rounded-bp border border-gray-300 bg-white p-4">
        <header className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="m-0 text-2xl font-bold">Panel de administración</h1>
          <div className="flex flex-wrap gap-2">
            <a className="bp-boton bp-boton-borde" href={import.meta.env.BASE_URL}>
              Ver el buscador
            </a>
            <button type="button" className="bp-boton bp-boton-borde" onClick={onSalir}>
              Cerrar sesión
            </button>
          </div>
        </header>

        <div
          role="status"
          className={`my-3 rounded-bp border-l-4 p-3 font-semibold ${b.sinPublicar ? "border-acento bg-amber-50" : "border-green-700 bg-green-50"}`}
        >
          {b.cargando
            ? "Cargando los puntos publicados…"
            : b.sinPublicar
              ? "Hay cambios sin publicar"
              : "El borrador coincide con lo publicado"}
          {b.sinPublicar && descargado && (
            <span className="block font-normal">
              Has descargado puntos.json, pero los cambios no serán visibles hasta que lo subas a tu web.
            </span>
          )}
        </div>

        <p className="my-2">
          <strong>Cómo se publica:</strong> pulsa «Publicar cambios» para descargar <code>puntos.json</code>.
          <br />
          Sustituye el fichero puntos.json de tu web por este y los cambios serán visibles para todos.
        </p>

        {b.errorPublicado && (
          <p className="bp-aviso" role="status">
            No se ha podido cargar el puntos.json publicado ({b.errorPublicado}). Trabajas solo con el borrador de este navegador.
          </p>
        )}
        {b.descartados.length > 0 && (
          <details className="bp-aviso my-2" open>
            <summary className="cursor-pointer font-semibold">
              {b.descartados.length === 1
                ? "1 punto del puntos.json publicado no es válido y se ha ignorado"
                : `${b.descartados.length} puntos del puntos.json publicado no son válidos y se han ignorado`}
            </summary>
            <ul className="mb-0 mt-1 pl-5">
              {b.descartados.map((d) => (
                <li key={d.indice}>
                  Posición {d.indice + 1}: {d.motivo}
                </li>
              ))}
            </ul>
          </details>
        )}
        {b.fallaAlmacenamiento && (
          <p className="bp-aviso" role="alert">
            No se ha podido guardar el borrador en este navegador (¿modo privado o sin espacio?). Publica los cambios cuanto antes.
          </p>
        )}
        {aviso && (
          <p className="bp-aviso" role="status">
            {aviso}{" "}
            <button type="button" className="bp-enlace-boton" onClick={() => setAviso(null)}>
              Cerrar aviso
            </button>
          </p>
        )}

        <div className="my-3 flex flex-wrap gap-2" role="toolbar" aria-label="Acciones del panel">
          <button type="button" className="bp-boton bp-boton-lleno" onClick={publicar} disabled={b.cargando}>
            Publicar cambios
          </button>
          <button type="button" className="bp-boton bp-boton-borde" onClick={() => { setFormulario({ editando: null }); setVista("puntos"); }}>
            Añadir punto
          </button>
          <button type="button" className="bp-boton bp-boton-borde" onClick={() => setVista(vista === "importar" ? "puntos" : "importar")} aria-pressed={vista === "importar"}>
            Importar hoja
          </button>
          <button type="button" className="bp-boton bp-boton-borde" onClick={() => descargarArchivo("puntos.csv", aCsv(b.puntos), "text/csv;charset=utf-8")} disabled={b.puntos.length === 0}>
            Exportar a CSV
          </button>
          <button type="button" className="bp-boton bp-boton-borde" onClick={b.deshacer} disabled={!b.puedeDeshacer}>
            Deshacer
          </button>
          <button type="button" className="bp-boton bp-boton-borde" onClick={() => setDescartando(true)} disabled={!b.hayBorrador}>
            Descartar borrador
          </button>
        </div>

        {descartando && (
          <Confirmar
            titulo="¿Descartar el borrador?"
            etiquetaConfirmar="Sí, descartar"
            onCancelar={() => setDescartando(false)}
            onConfirmar={() => {
              b.descartarBorrador();
              setDescartando(false);
              setFormulario(null);
              setAviso("Borrador descartado: vuelves a lo publicado.");
            }}
          >
            Se perderán todos los cambios que no hayas publicado y volverás al puntos.json publicado.
          </Confirmar>
        )}

        {formulario && (
          <FormularioPunto
            key={formulario.editando?.id ?? "nuevo"}
            existentes={b.puntos}
            editando={formulario.editando}
            tipos={tipos}
            onCancelar={() => setFormulario(null)}
            onGuardar={(p) => {
              b.aplicar((actuales) => guardarPunto(actuales, p));
              setFormulario(null);
              setAviso(`Punto «${p.nombre}» guardado.`);
            }}
          />
        )}

        {vista === "importar" ? (
          <ImportarHoja puntosActuales={b.puntos.length} onImportar={importar} onCancelar={() => setVista("puntos")} />
        ) : (
          <TablaPuntos
            puntos={b.puntos}
            onEditar={(p) => setFormulario({ editando: p })}
            onBorrar={(id) => b.aplicar((actuales) => borrarPunto(actuales, id))}
            onCierre={(id, cerrado, motivo, reapertura) =>
              b.aplicar((actuales) => fijarCierre(actuales, id, cerrado, motivo, reapertura))
            }
          />
        )}
      </div>
    </main>
  );
}
