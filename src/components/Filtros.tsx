interface Props {
  tipos: string[];
  seleccionados: string[];
  onCambio: (tipos: string[]) => void;
}

export function Filtros({ tipos, seleccionados, onCambio }: Props) {
  if (tipos.length < 2) return null;

  const alternar = (tipo: string) =>
    onCambio(seleccionados.includes(tipo) ? seleccionados.filter((t) => t !== tipo) : [...seleccionados, tipo]);

  return (
    <fieldset className="bp-filtros">
      <legend className="bp-sr">Filtrar por tipo de punto</legend>
      <button type="button" className="bp-chip" aria-pressed={seleccionados.length === 0} onClick={() => onCambio([])}>
        Todos
      </button>
      {tipos.map((tipo) => (
        <button
          key={tipo}
          type="button"
          className="bp-chip"
          aria-pressed={seleccionados.includes(tipo)}
          onClick={() => alternar(tipo)}
        >
          {tipo}
        </button>
      ))}
    </fieldset>
  );
}
