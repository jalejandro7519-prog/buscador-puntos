import { PanelAdmin } from "../components/admin/PanelAdmin";
import { PinGate } from "../components/admin/PinGate";

/**
 * PIN de acceso: barrera de cortesía en el cliente (va dentro del bundle), NO seguridad real.
 * Sin VITE_ADMIN_PIN en producción el panel queda deshabilitado; en desarrollo vale «1234».
 */
export function pinConfigurado(): string | undefined {
  const pin = import.meta.env.VITE_ADMIN_PIN?.trim();
  if (pin) return pin;
  return import.meta.env.DEV ? "1234" : undefined;
}

export default function Admin() {
  return (
    <PinGate pin={pinConfigurado()}>
      {(salir) => <PanelAdmin src={`${import.meta.env.BASE_URL}puntos.json`} onSalir={salir} />}
    </PinGate>
  );
}
