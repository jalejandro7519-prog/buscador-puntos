import type { Config } from "tailwindcss";
import { MARCA, cssVar } from "./src/config/marca";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primario: cssVar("primario"),
        acento: cssVar("acento"),
        texto: cssVar("texto"),
        fondo: cssVar("fondo"),
        gris: MARCA.colorCerrado,
      },
      borderRadius: { bp: cssVar("radio") },
      fontFamily: { sans: [cssVar("fuente")] },
    },
  },
  plugins: [],
} satisfies Config;
