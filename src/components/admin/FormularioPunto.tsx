import { Suspense, lazy, useId, useState, type FormEvent } from "react";
import {
  formularioDesdePunto,
  formularioVacio,
  puntoDesdeFormulario,
  type CamposFormulario,
  type ErroresFormulario,
} from "../../lib/edicion";
import type { Punto } from "../../lib/esquema";
import { parsearNumero } from "../../lib/importar";
import { EditorResenas } from "./EditorResenas";

const MapaSelector = lazy(() => import("./MapaSelector"));

interface Props {
  existentes: readonly Punto[];
  editando: Punto | null;
  tipos: string[];
  onGuardar: (punto: Punto) => void;
  onCancelar: () => void;
}

interface CampoProps {
  id: string;
  etiqueta: string;
  error?: string;
  children: (props: { id: string; "aria-invalid": boolean; "aria-describedby"?: string }) => React.ReactNode;
}

function Campo({ id, etiqueta, error, children }: CampoProps) {
  const idError = `${id}-error`;
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="font-semibold">
        {etiqueta}
      </label>
      {children({ id, "aria-invalid": Boolean(error), "aria-describedby": error ? idError : undefined })}
      {error && (
        <p id={idError} className="m-0 text-sm font-semibold text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}

export function FormularioPunto({ existentes, editando, tipos, onGuardar, onCancelar }: Props) {
  const base = useId();
  const [campos, setCampos] = useState<CamposFormulario>(() => (editando ? formularioDesdePunto(editando) : formularioVacio()));
  const [errores, setErrores] = useState<ErroresFormulario>({});

  const poner = <K extends keyof CamposFormulario>(clave: K, valor: CamposFormulario[K]) =>
    setCampos((c) => ({ ...c, [clave]: valor }));

  const enviar = (e: FormEvent) => {
    e.preventDefault();
    const r = puntoDesdeFormulario(campos, existentes, editando);
    if ("errores" in r) setErrores(r.errores);
    else onGuardar(r.punto);
  };

  const lat = parsearNumero(campos.lat);
  const lng = parsearNumero(campos.lng);
  const numErrores = Object.keys(errores).length;
  const id = (n: string) => `${base}-${n}`;

  return (
    <form onSubmit={enviar} noValidate className="my-4 rounded-bp border border-gray-300 bg-white p-4" aria-label={editando ? "Editar punto" : "Nuevo punto"}>
      <h2 className="m-0 mb-3 text-xl font-bold">{editando ? `Editar «${editando.nombre}»` : "Nuevo punto"}</h2>

      {numErrores > 0 && (
        <p role="alert" className="bp-aviso mb-3">
          Revisa {numErrores === 1 ? "el campo marcado" : `los ${numErrores} campos marcados`} antes de guardar.
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <Campo id={id("nombre")} etiqueta="Nombre *" error={errores.nombre}>
          {(p) => <input {...p} className="bp-input" value={campos.nombre} onChange={(e) => poner("nombre", e.target.value)} />}
        </Campo>
        <Campo id={id("tipo")} etiqueta="Tipo *" error={errores.tipo}>
          {(p) => (
            <>
              <input {...p} list={id("tipos")} className="bp-input" value={campos.tipo} onChange={(e) => poner("tipo", e.target.value)} />
              <datalist id={id("tipos")}>
                {tipos.map((t) => (
                  <option key={t} value={t} />
                ))}
              </datalist>
            </>
          )}
        </Campo>
        <Campo id={id("direccion")} etiqueta="Dirección *" error={errores.direccion}>
          {(p) => <input {...p} className="bp-input" value={campos.direccion} onChange={(e) => poner("direccion", e.target.value)} />}
        </Campo>
        <Campo id={id("cp")} etiqueta="Código postal" error={errores.codigoPostal}>
          {(p) => <input {...p} inputMode="numeric" className="bp-input" value={campos.codigoPostal} onChange={(e) => poner("codigoPostal", e.target.value)} />}
        </Campo>
        <Campo id={id("ciudad")} etiqueta="Ciudad o barrio" error={errores.ciudad}>
          {(p) => <input {...p} className="bp-input" value={campos.ciudad} onChange={(e) => poner("ciudad", e.target.value)} />}
        </Campo>
        <Campo id={id("telefono")} etiqueta="Teléfono" error={errores.telefono}>
          {(p) => <input {...p} type="tel" className="bp-input" value={campos.telefono} onChange={(e) => poner("telefono", e.target.value)} />}
        </Campo>
        <Campo id={id("horario")} etiqueta="Horario (texto libre)" error={errores.horario}>
          {(p) => <input {...p} placeholder="L-V 8:00-16:00" className="bp-input" value={campos.horario} onChange={(e) => poner("horario", e.target.value)} />}
        </Campo>
      </div>

      <fieldset className="mt-4 border-0 p-0">
        <legend className="mb-1 font-semibold">Ubicación *</legend>
        <p className="mb-2 mt-0 text-sm">Pulsa en el mapa para colocar el marcador y arrástralo para afinar, o escribe las coordenadas.</p>
        <Suspense fallback={<div className="h-60 rounded-bp bg-gray-200" aria-hidden="true" />}>
          <MapaSelector
            lat={lat !== null && Math.abs(lat) <= 90 ? lat : null}
            lng={lng !== null && Math.abs(lng) <= 180 ? lng : null}
            onCambio={(la, lo) => setCampos((c) => ({ ...c, lat: String(la), lng: String(lo) }))}
          />
        </Suspense>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Campo id={id("lat")} etiqueta="Latitud *" error={errores.lat}>
            {(p) => <input {...p} inputMode="decimal" className="bp-input" value={campos.lat} onChange={(e) => poner("lat", e.target.value)} />}
          </Campo>
          <Campo id={id("lng")} etiqueta="Longitud *" error={errores.lng}>
            {(p) => <input {...p} inputMode="decimal" className="bp-input" value={campos.lng} onChange={(e) => poner("lng", e.target.value)} />}
          </Campo>
        </div>
      </fieldset>

      <fieldset className="mt-4 border-0 p-0">
        <legend className="mb-1 font-semibold">Estado</legend>
        <label className="flex min-h-11 items-center gap-2">
          <input type="checkbox" className="h-5 w-5" checked={campos.cerrado} onChange={(e) => poner("cerrado", e.target.checked)} />
          Cerrado temporalmente
        </label>
        {campos.cerrado && (
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            <Campo id={id("motivo")} etiqueta="Motivo (opcional)">
              {(p) => <input {...p} className="bp-input" value={campos.motivoCierre} onChange={(e) => poner("motivoCierre", e.target.value)} />}
            </Campo>
            <Campo id={id("reapertura")} etiqueta="Reapertura prevista (opcional)" error={errores.reaperturaPrevista}>
              {(p) => <input {...p} type="date" className="bp-input" value={campos.reaperturaPrevista} onChange={(e) => poner("reaperturaPrevista", e.target.value)} />}
            </Campo>
          </div>
        )}
      </fieldset>

      <EditorResenas resenas={campos.resenas} onCambio={(r) => poner("resenas", r)} />

      <div className="mt-4 flex flex-wrap gap-2">
        <button type="submit" className="bp-boton bp-boton-lleno">
          Guardar punto
        </button>
        <button type="button" className="bp-boton bp-boton-borde" onClick={onCancelar}>
          Cancelar
        </button>
      </div>
    </form>
  );
}
