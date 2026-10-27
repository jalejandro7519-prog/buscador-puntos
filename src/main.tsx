import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { Publico } from "./pages/Publico";

const raiz = document.getElementById("root");
if (raiz) {
  createRoot(raiz).render(
    <StrictMode>
      <Publico />
    </StrictMode>,
  );
}
