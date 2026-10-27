import { useId } from "react";

interface Props {
  valor: string;
  onCambio: (valor: string) => void;
  cercaActiva: boolean;
  buscandoUbicacion: boolean;
  onAlternarCerca: () => void;
}

export function CajaBusqueda({ valor, onCambio, cercaActiva, buscandoUbicacion, onAlternarCerca }: Props) {
  const id = useId();
  return (
    <div className="bp-busqueda" role="search">
      <label htmlFor={id} className="bp-sr">
        Buscar por nombre, dirección, barrio o código postal
      </label>
      <input
        id={id}
        type="search"
        className="bp-input"
        inputMode="search"
        autoComplete="off"
        placeholder="Nombre, calle, barrio o código postal"
        value={valor}
        onChange={(e) => onCambio(e.target.value)}
      />
      <button
        type="button"
        className="bp-boton bp-boton-borde"
        aria-pressed={cercaActiva}
        disabled={buscandoUbicacion}
        onClick={onAlternarCerca}
      >
        {buscandoUbicacion ? "Buscando…" : "Cerca de mí"}
      </button>
    </div>
  );
}
