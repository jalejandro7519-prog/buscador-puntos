import { useMemo, useState, type CSSProperties } from "react";
import { buscar, tiposDisponibles } from "../lib/busqueda";
import { detectarPlataforma } from "../lib/directions";
import { usePuntos, useUbicacion } from "../lib/hooks";
import { OPCIONES_POR_DEFECTO, type OpcionesBuscador } from "../lib/opciones";
import { pluralPuntos, useDebounced } from "../lib/utiles";
import { CajaBusqueda } from "./CajaBusqueda";
import { Filtros } from "./Filtros";
import { Listado } from "./Listado";
import { MapaDiferido, type EstadoMapa } from "./MapaDiferido";

export type PropsBuscador = Partial<OpcionesBuscador>;

function conDefectos(props: PropsBuscador): OpcionesBuscador {
  const definidas = Object.fromEntries(Object.entries(props).filter(([, v]) => v !== undefined));
  return { ...OPCIONES_POR_DEFECTO, ...definidas };
}

export function BuscadorPuntos(props: PropsBuscador) {
  const opciones = conDefectos(props);
  const { puntos, fase, desdeCache, reintentar } = usePuntos(opciones.src);
  const ubicacion = useUbicacion();
  const plataforma = useMemo(() => detectarPlataforma(), []);

  const [texto, setTexto] = useState("");
  const textoBusqueda = useDebounced(texto, 150);
  const [tiposElegidos, setTiposElegidos] = useState<string[]>([]);
  const [seleccionadoId, setSeleccionadoId] = useState<string | null>(null);
  const [estadoMapa, setEstadoMapa] = useState<EstadoMapa>("espera");

  const tipos = useMemo(() => tiposDisponibles(puntos), [puntos]);
  // Si tras renovar los datos un tipo deja de existir, deja de filtrar por él.
  const tiposActivos = useMemo(() => tiposElegidos.filter((t) => tipos.includes(t)), [tiposElegidos, tipos]);

  const resultado = useMemo(
    () => buscar(puntos, { texto: textoBusqueda, tipos: tiposActivos, ubicacion: ubicacion.coord }),
    [puntos, textoBusqueda, tiposActivos, ubicacion.coord],
  );
  const seleccion = resultado.items.some((i) => i.punto.id === seleccionadoId) ? seleccionadoId : null;

  const sinDatos = puntos.length === 0;
  const cargandoSinDatos = sinDatos && fase === "cargando";
  const errorSinDatos = sinDatos && fase === "error";

  const alternarCerca = () => {
    if (ubicacion.estado === "activa") {
      ubicacion.limpiar();
    } else {
      // El CP existente manda sobre la ubicación: se vacía para que «Cerca de mí» tenga efecto.
      if (resultado.modo === "codigoPostal") setTexto("");
      ubicacion.solicitar();
    }
  };

  const quitarFiltros = () => {
    setTexto("");
    setTiposElegidos([]);
  };

  const conMapa = estadoMapa !== "fallo";
  const estilo = { "--bp-altura": opciones.altura } as CSSProperties;

  return (
    <section className="bp-root" lang={opciones.idioma} style={estilo} aria-label="Buscador de puntos">
      {opciones.logo && (
        <header className="bp-cabecera">
          <img src={opciones.logo} alt="" className="bp-logo" />
        </header>
      )}

      <div className={`bp-rejilla ${conMapa ? "" : "bp-sin-mapa"}`}>
        <div className="bp-controles">
          <CajaBusqueda
            valor={texto}
            onCambio={setTexto}
            cercaActiva={ubicacion.estado === "activa"}
            buscandoUbicacion={ubicacion.estado === "buscando"}
            onAlternarCerca={alternarCerca}
          />
          {cargandoSinDatos ? (
            <div className="bp-reserva" aria-hidden="true" />
          ) : (
            <Filtros tipos={tipos} seleccionados={tiposActivos} onCambio={setTiposElegidos} />
          )}

          {/* Siempre presente (aunque vacío) para que el mapa no salte cuando llegan los datos. */}
          <p className="bp-contador" role="status" aria-live="polite">
            {sinDatos ? (
              " "
            ) : (
              <>
                <strong>{pluralPuntos(resultado.items.length)}</strong>
                {resultado.modo === "codigoPostal" && <> · ordenados por distancia al código postal {resultado.codigoPostal}</>}
                {resultado.modo === "cercania" && <> · ordenados por cercanía a tu ubicación</>}
              </>
            )}
          </p>

          {resultado.codigoPostalInexistente && (
            <p className="bp-aviso" role="status">
              No tenemos puntos con ese código postal. Prueba por nombre o con «Cerca de mí».
            </p>
          )}
          {ubicacion.estado === "denegada" && (
            <p className="bp-aviso" role="status">
              No hemos podido acceder a tu ubicación. Puedes seguir buscando por nombre o código postal.
            </p>
          )}
          {ubicacion.estado === "error" && (
            <p className="bp-aviso" role="status">
              No hemos podido obtener tu ubicación ahora. Puedes seguir buscando por nombre o código postal.
            </p>
          )}
          {ubicacion.estado === "no-soportada" && (
            <p className="bp-aviso" role="status">
              Tu navegador no permite usar la ubicación. Puedes buscar por nombre o código postal.
            </p>
          )}
          {!sinDatos && fase === "error" && (
            <p className="bp-aviso" role="status">
              No hemos podido actualizar la lista; se muestra la última guardada.{" "}
              <button type="button" className="bp-enlace-boton" onClick={reintentar}>
                Reintentar
              </button>
            </p>
          )}
          {(estadoMapa === "fallo" || estadoMapa === "tarde") && (
            <p className="bp-aviso" role="status">
              El mapa no está disponible ahora. Puedes seguir usando la lista.
            </p>
          )}
          {!sinDatos && fase === "cargando" && desdeCache && <p className="bp-sr">Actualizando la lista…</p>}
        </div>

        {conMapa && (
          <div className="bp-mapa">
            <MapaDiferido
              puntos={resultado.items}
              seleccionadoId={seleccion}
              onSeleccionar={setSeleccionadoId}
              tileUrl={opciones.tileUrl}
              atribucion={opciones.atribucion}
              centro={opciones.centro}
              zoom={opciones.zoom}
              plataforma={plataforma}
              onEstado={setEstadoMapa}
            />
          </div>
        )}

        <div className="bp-lista">
          <h2 className="bp-sr">Puntos encontrados</h2>
          {cargandoSinDatos && (
            <div aria-busy="true" aria-label="Cargando puntos" className="bp-esqueleto-lista">
              {[0, 1, 2].map((i) => (
                <div key={i} className="bp-esqueleto" />
              ))}
            </div>
          )}

          {errorSinDatos && (
            <div role="alert" className="bp-vacio">
              <p>No hemos podido cargar la lista de puntos. Comprueba tu conexión e inténtalo de nuevo.</p>
              <button type="button" className="bp-boton bp-boton-lleno" onClick={reintentar}>
                Reintentar
              </button>
            </div>
          )}

          {!sinDatos && resultado.items.length === 0 && (
            <div className="bp-vacio">
              <p>No hay puntos que coincidan con tu búsqueda.</p>
              <button type="button" className="bp-boton bp-boton-borde" onClick={quitarFiltros}>
                Quitar búsqueda y filtros
              </button>
            </div>
          )}

          {resultado.items.length > 0 && (
            <Listado
              items={resultado.items}
              seleccionadoId={seleccion}
              onSeleccionar={setSeleccionadoId}
              plataforma={plataforma}
            />
          )}
        </div>
      </div>
    </section>
  );
}
