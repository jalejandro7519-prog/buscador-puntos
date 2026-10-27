import { useId, useMemo, useState, type DragEvent } from "react";
import {
  ETIQUETA_CAMPO,
  analizarFilas,
  intercambiarCoordenadas,
  leerArchivoHoja,
  puntosImportables,
  resumir,
  type CamposFila,
  type CampoHoja,
  type FilaImportada,
  type LecturaHoja,
  type ModoImportacion,
} from "../../lib/importar";
import { Confirmar } from "./Confirmar";

interface Props {
  /** Nº de puntos del borrador actual (para avisar al reemplazar). */
  puntosActuales: number;
  onImportar: (puntos: ReturnType<typeof puntosImportables>, modo: ModoImportacion) => void;
  onCancelar: () => void;
}

const EDITABLES: { campo: CampoHoja; etiqueta: string }[] = [
  { campo: "nombre", etiqueta: "Nombre" },
  { campo: "tipo", etiqueta: "Tipo" },
  { campo: "direccion", etiqueta: "Dirección" },
  { campo: "lat", etiqueta: "Latitud" },
  { campo: "lng", etiqueta: "Longitud" },
];

function Tarjeta({ valor, etiqueta, tono }: { valor: number; etiqueta: string; tono?: "ok" | "aviso" | "error" }) {
  const color = tono === "error" ? "border-red-700" : tono === "aviso" ? "border-acento" : tono === "ok" ? "border-green-700" : "border-gray-400";
  return (
    <div className={`rounded-bp border-l-4 bg-white p-3 ${color}`}>
      <p className="m-0 text-2xl font-bold">{valor}</p>
      <p className="m-0 text-sm font-semibold">{etiqueta}</p>
    </div>
  );
}

export function ImportarHoja({ puntosActuales, onImportar, onCancelar }: Props) {
  const base = useId();
  const [lectura, setLectura] = useState<LecturaHoja | null>(null);
  const [filas, setFilas] = useState<FilaImportada[]>([]);
  const [nombreArchivo, setNombreArchivo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [leyendo, setLeyendo] = useState(false);
  const [arrastrando, setArrastrando] = useState(false);
  const [modo, setModo] = useState<ModoImportacion>("reemplazar");
  const [confirmando, setConfirmando] = useState(false);

  const resumen = useMemo(() => resumir(filas), [filas]);
  const conProblemas = useMemo(() => filas.filter((f) => f.problemas.length > 0), [filas]);

  async function leer(archivo: File | undefined) {
    if (!archivo) return;
    setError(null);
    setLeyendo(true);
    setConfirmando(false);
    try {
      const l = await leerArchivoHoja(archivo);
      setLectura(l);
      setFilas(l.filas);
      setNombreArchivo(archivo.name);
    } catch (e) {
      setLectura(null);
      setFilas([]);
      setError(e instanceof Error ? e.message : "No se pudo leer el archivo.");
    } finally {
      setLeyendo(false);
    }
  }

  const soltar = (e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setArrastrando(false);
    void leer(e.dataTransfer.files[0]);
  };

  /** Corrige una celda y vuelve a validar todo el lote (ids y coordenadas dependen del conjunto). */
  const corregir = (fila: number, cambio: (c: CamposFila) => CamposFila) =>
    setFilas((actuales) =>
      analizarFilas(actuales.map((f) => (f.fila === fila ? { fila: f.fila, campos: cambio(f.campos) } : { fila: f.fila, campos: f.campos }))),
    );

  const importar = () => onImportar(puntosImportables(filas), modo);
  const alPulsarImportar = () => (modo === "reemplazar" ? setConfirmando(true) : importar());

  return (
    <section aria-labelledby={`${base}-t`} className="mt-4">
      <h2 id={`${base}-t`} className="mb-2 text-xl font-bold">
        Importar desde la hoja de cálculo
      </h2>

      <label
        onDragOver={(e) => {
          e.preventDefault();
          setArrastrando(true);
        }}
        onDragLeave={() => setArrastrando(false)}
        onDrop={soltar}
        className={`flex min-h-28 cursor-pointer flex-col items-center justify-center gap-1 rounded-bp border-2 border-dashed p-4 text-center focus-within:outline focus-within:outline-4 focus-within:outline-primario ${arrastrando ? "border-primario bg-blue-50" : "border-gray-500 bg-white"}`}
      >
        <span className="font-semibold">Arrastra aquí tu archivo .csv o .xlsx, o pulsa para elegirlo</span>
        <span className="text-sm">Exporta la hoja desde Excel o Google Sheets («Descargar como CSV»).</span>
        <input
          type="file"
          className="bp-sr"
          accept=".csv,.txt,.tsv,.xlsx,.xls,text/csv"
          onChange={(e) => {
            void leer(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </label>
      <p className="mt-2 text-sm">
        ¿Quieres ver cómo debe ser? Descarga la{" "}
        <a className="bp-enlace" href={`${import.meta.env.BASE_URL}ejemplo-hoja.csv`} download>
          hoja de ejemplo
        </a>{" "}
        o la{" "}
        <a className="bp-enlace" href={`${import.meta.env.BASE_URL}ejemplo-hoja-con-errores.csv`} download>
          hoja de ejemplo con errores
        </a>
        .
      </p>

      {leyendo && <p role="status">Leyendo el archivo…</p>}
      {error && (
        <p role="alert" className="bp-aviso" style={{ borderColor: "#b91c1c" }}>
          {error}
        </p>
      )}

      {lectura && (
        <div className="mt-4" aria-live="polite">
          <h3 className="mb-2 text-lg font-bold">Vista previa de «{nombreArchivo}»</h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Tarjeta valor={resumen.total} etiqueta="Filas" />
            <Tarjeta valor={resumen.validas} etiqueta="Válidas" tono="ok" />
            <Tarjeta valor={resumen.conAviso} etiqueta="Con aviso" tono="aviso" />
            <Tarjeta valor={resumen.conError} etiqueta="Con error" tono="error" />
          </div>

          <p className="mb-1 mt-3 text-sm">
            Columnas reconocidas:{" "}
            {Object.entries(lectura.columnas.reconocidas)
              .map(([campo, cabecera]) => `${cabecera} → ${ETIQUETA_CAMPO[campo as CampoHoja]}`)
              .join(", ") || "ninguna"}
            .
            {lectura.columnas.ignoradas.length > 0 && <> Ignoradas: {lectura.columnas.ignoradas.join(", ")}.</>}
          </p>
          {lectura.columnas.faltan.length > 0 && (
            <p role="alert" className="bp-aviso">
              No hemos encontrado las columnas: {lectura.columnas.faltan.map((c) => ETIQUETA_CAMPO[c]).join(", ")}. Las filas
              no se podrán importar hasta que existan.
            </p>
          )}

          {conProblemas.length > 0 && (
            <>
              <h3 className="mb-1 mt-4 text-lg font-bold">Filas con problemas ({conProblemas.length})</h3>
              <p className="mt-0 text-sm">
                Corrige los datos aquí mismo: las filas con error no se importan hasta que estén bien.
              </p>
              <ul className="m-0 flex list-none flex-col gap-3 p-0">
                {conProblemas.map((f) => (
                  <li
                    key={f.fila}
                    className={`rounded-bp border-2 bg-white p-3 ${f.punto ? "border-acento" : "border-red-700"}`}
                  >
                    <p className="m-0 font-bold">
                      Fila {f.fila}: {f.punto ? "se importará, con aviso" : "con error, no se importará"}
                    </p>
                    <ul className="my-1 pl-5">
                      {f.problemas.map((p, i) => (
                        <li key={i} className={p.nivel === "error" ? "font-semibold text-red-800" : ""}>
                          <span className="font-semibold">{p.nivel === "error" ? "Error: " : "Aviso: "}</span>
                          {p.mensaje}
                        </li>
                      ))}
                    </ul>
                    <div className="mt-2 grid gap-2 sm:grid-cols-5">
                      {EDITABLES.map(({ campo, etiqueta }) => {
                        const idCampo = `${base}-${f.fila}-${campo}`;
                        const invalido = f.problemas.some((p) => p.nivel === "error" && p.campo === campo);
                        return (
                          <div key={campo} className="flex flex-col gap-1">
                            <label htmlFor={idCampo} className="text-sm font-semibold">
                              {etiqueta}
                              <span className="bp-sr"> (fila {f.fila})</span>
                            </label>
                            <input
                              id={idCampo}
                              className="bp-input"
                              inputMode={campo === "lat" || campo === "lng" ? "decimal" : undefined}
                              aria-invalid={invalido}
                              value={f.campos[campo]}
                              onChange={(e) => corregir(f.fila, (c) => ({ ...c, [campo]: e.target.value }))}
                            />
                          </div>
                        );
                      })}
                    </div>
                    {f.sugerirIntercambio && (
                      <button
                        type="button"
                        className="bp-boton bp-boton-borde mt-2"
                        onClick={() => corregir(f.fila, intercambiarCoordenadas)}
                      >
                        Intercambiar latitud y longitud (fila {f.fila})
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </>
          )}

          <fieldset className="mt-4 border-0 p-0">
            <legend className="mb-1 font-semibold">¿Cómo quieres importar?</legend>
            <label className="flex min-h-11 items-start gap-2">
              <input type="radio" name={`${base}-modo`} className="mt-1 h-5 w-5" checked={modo === "reemplazar"} onChange={() => setModo("reemplazar")} />
              <span>
                <strong>Reemplazar todo</strong>: el borrador pasa a tener exactamente los puntos de la hoja.
              </span>
            </label>
            <label className="flex min-h-11 items-start gap-2">
              <input type="radio" name={`${base}-modo`} className="mt-1 h-5 w-5" checked={modo === "combinar"} onChange={() => setModo("combinar")} />
              <span>
                <strong>Combinar</strong>: actualiza los puntos con el mismo id y añade los nuevos; no borra los que no estén en la hoja.
              </span>
            </label>
          </fieldset>

          {resumen.conError > 0 && (
            <p className="bp-aviso mt-3">
              {resumen.conError === 1 ? "1 fila con error no se importará" : `${resumen.conError} filas con error no se importarán`} mientras no las corrijas.
            </p>
          )}

          {confirmando && (
            <Confirmar
              titulo="¿Reemplazar todos los puntos?"
              etiquetaConfirmar={`Sí, reemplazar por ${resumen.importables}`}
              onCancelar={() => setConfirmando(false)}
              onConfirmar={() => {
                setConfirmando(false);
                importar();
              }}
            >
              El borrador tiene ahora {puntosActuales} {puntosActuales === 1 ? "punto" : "puntos"} y pasará a tener {resumen.importables}.
              Podrás deshacerlo después.
            </Confirmar>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" className="bp-boton bp-boton-lleno" disabled={resumen.importables === 0} onClick={alPulsarImportar}>
              Importar {resumen.importables} {resumen.importables === 1 ? "punto" : "puntos"}
            </button>
            <button type="button" className="bp-boton bp-boton-borde" onClick={onCancelar}>
              Cancelar
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
