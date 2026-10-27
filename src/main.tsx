import { StrictMode, Suspense, lazy } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { Publico } from "./pages/Publico";

// El panel solo se descarga si se entra en /admin (o en #/admin si el servidor no reescribe rutas).
const Admin = lazy(() => import("./pages/Admin"));

const esAdmin = /\/admin\/?$/.test(location.pathname) || location.hash.startsWith("#/admin");

const raiz = document.getElementById("root");
if (raiz) {
  createRoot(raiz).render(
    <StrictMode>
      {esAdmin ? (
        <Suspense fallback={<p style={{ padding: 16 }}>Cargando el panel…</p>}>
          <Admin />
        </Suspense>
      ) : (
        <Publico />
      )}
    </StrictMode>,
  );
}
