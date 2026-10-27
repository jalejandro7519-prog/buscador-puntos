import { etiquetaComoLlegar, urlComoLlegar, type Plataforma } from "../lib/directions";
import type { Punto } from "../lib/esquema";
import { formatearDistancia } from "../lib/geo";
import { formatearFecha, hrefTelefono } from "../lib/utiles";

interface Props {
  punto: Punto;
  distanciaKm: number | null;
  plataforma: Plataforma;
  seleccionado?: boolean;
  onSeleccionar?: (id: string) => void;
}

export function FichaPunto({ punto, distanciaKm, plataforma, seleccionado = false, onSeleccionar }: Props) {
  const cerrado = punto.estado === "cerrado_temporal";
  const destino = { lat: punto.lat, lng: punto.lng, nombre: punto.nombre, direccion: punto.direccion };

  return (
    <article className={`bp-ficha ${cerrado ? "bp-ficha-cerrada" : ""} ${seleccionado ? "bp-ficha-activa" : ""}`}>
      <h3 className="bp-ficha-titulo">
        {onSeleccionar ? (
          <button
            type="button"
            className="bp-ficha-nombre"
            onClick={() => onSeleccionar(punto.id)}
            aria-label={`${punto.nombre}: ver en el mapa`}
          >
            {punto.nombre}
          </button>
        ) : (
          punto.nombre
        )}
      </h3>

      {cerrado && (
        <p className="bp-insignia" data-testid="insignia-cerrado">
          Cerrado temporalmente
        </p>
      )}
      {cerrado && (punto.motivoCierre || punto.reaperturaPrevista) && (
        <p className="bp-ficha-linea">
          {punto.motivoCierre && <span>Motivo: {punto.motivoCierre}. </span>}
          {punto.reaperturaPrevista && <span>Reapertura prevista: {formatearFecha(punto.reaperturaPrevista)}.</span>}
        </p>
      )}

      <p className="bp-ficha-meta">
        {punto.tipo}
        {distanciaKm !== null && (
          <>
            {" · "}
            <span className="bp-distancia">{formatearDistancia(distanciaKm)}</span>
          </>
        )}
      </p>
      <p className="bp-ficha-linea">
        {punto.direccion}
        {punto.ciudad ? `, ${punto.ciudad}` : ""}
        {punto.codigoPostal ? ` (${punto.codigoPostal})` : ""}
      </p>
      {punto.horario && <p className="bp-ficha-linea">Horario: {punto.horario}</p>}
      {punto.telefono && (
        <p className="bp-ficha-linea">
          Teléfono:{" "}
          <a className="bp-enlace" href={hrefTelefono(punto.telefono)}>
            {punto.telefono}
          </a>
        </p>
      )}

      <div className="bp-ficha-acciones">
        {cerrado ? (
          <button
            type="button"
            className="bp-boton bp-boton-lleno"
            disabled
            aria-label={`${etiquetaComoLlegar(destino)} (no disponible: cerrado temporalmente)`}
          >
            Cómo llegar
          </button>
        ) : (
          <a
            className="bp-boton bp-boton-lleno"
            href={urlComoLlegar(destino, plataforma)}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`${etiquetaComoLlegar(destino)} (se abre en otra pestaña)`}
          >
            Cómo llegar
          </a>
        )}
      </div>
    </article>
  );
}
