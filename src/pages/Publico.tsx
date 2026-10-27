import { BuscadorPuntos } from "../components/BuscadorPuntos";

export function Publico() {
  return (
    <main style={{ maxWidth: 1200, margin: "0 auto", padding: "16px" }}>
      <h1 style={{ margin: "0 0 12px", fontSize: 24, fontWeight: 700 }}>Buscador de puntos</h1>
      <BuscadorPuntos src={`${import.meta.env.BASE_URL}puntos.json`} altura="min(680px, 80vh)" />
    </main>
  );
}
