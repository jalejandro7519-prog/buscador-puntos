import { useEffect, useRef, type ReactNode } from "react";

interface Props {
  titulo: string;
  children?: ReactNode;
  etiquetaConfirmar: string;
  onConfirmar: () => void;
  onCancelar: () => void;
}

/** Confirmación en línea (sin diálogos del navegador): el foco empieza en «Cancelar». */
export function Confirmar({ titulo, children, etiquetaConfirmar, onConfirmar, onCancelar }: Props) {
  const cancelar = useRef<HTMLButtonElement>(null);
  useEffect(() => cancelar.current?.focus(), []);

  return (
    <div role="alertdialog" aria-label={titulo} className="my-3 rounded-bp border-2 border-acento bg-amber-50 p-4">
      <p className="m-0 font-bold">{titulo}</p>
      {children && <div className="mt-1">{children}</div>}
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" ref={cancelar} className="bp-boton bp-boton-borde" onClick={onCancelar}>
          Cancelar
        </button>
        <button type="button" className="bp-boton bp-boton-lleno" onClick={onConfirmar}>
          {etiquetaConfirmar}
        </button>
      </div>
    </div>
  );
}
