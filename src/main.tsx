import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";

const raiz = document.getElementById("root");
if (raiz) {
  createRoot(raiz).render(<StrictMode><p>Buscador de puntos</p></StrictMode>);
}
