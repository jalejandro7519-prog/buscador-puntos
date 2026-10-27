import { useState, type FormEvent, type ReactNode } from "react";
import { guardarSesionAdmin, sesionAdminActiva } from "../../lib/almacenamiento";

interface Props {
  /** PIN configurado; undefined = panel deshabilitado. */
  pin: string | undefined;
  children: (salir: () => void) => ReactNode;
}

/** Barrera de cortesía en el cliente: el PIN viaja en el bundle, NO es seguridad real. */
export function PinGate({ pin, children }: Props) {
  const [dentro, setDentro] = useState(() => Boolean(pin) && sesionAdminActiva());
  const [valor, setValor] = useState("");
  const [error, setError] = useState(false);

  if (!pin) {
    return (
      <main className="mx-auto max-w-md p-4">
        <h1 className="text-2xl font-bold">Panel de administración</h1>
        <p role="status">
          El panel está deshabilitado: falta configurar <code>VITE_ADMIN_PIN</code> al compilar la aplicación.
        </p>
      </main>
    );
  }

  if (dentro) {
    return (
      <>
        {children(() => {
          guardarSesionAdmin(false);
          setDentro(false);
          setValor("");
        })}
      </>
    );
  }

  const enviar = (e: FormEvent) => {
    e.preventDefault();
    if (valor === pin) {
      guardarSesionAdmin(true);
      setDentro(true);
      setError(false);
    } else {
      setError(true);
    }
  };

  return (
    <main className="mx-auto max-w-md p-4">
      <h1 className="mb-3 text-2xl font-bold">Panel de administración</h1>
      <form onSubmit={enviar} className="bp-root rounded-bp border border-gray-300 bg-white p-4">
        <label htmlFor="bp-pin" className="mb-1 block font-semibold">
          PIN de acceso
        </label>
        <input
          id="bp-pin"
          type="password"
          inputMode="numeric"
          autoComplete="off"
          className="bp-input w-full"
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          aria-invalid={error}
          aria-describedby={error ? "bp-pin-error" : undefined}
        />
        {error && (
          <p id="bp-pin-error" role="alert" className="mb-0 mt-2 font-semibold text-red-700">
            PIN incorrecto.
          </p>
        )}
        <button type="submit" className="bp-boton bp-boton-lleno mt-3">
          Entrar
        </button>
      </form>
    </main>
  );
}
