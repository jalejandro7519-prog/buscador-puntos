/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** PIN del panel /admin. Barrera de cortesía en el cliente, NO seguridad real. */
  readonly VITE_ADMIN_PIN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
