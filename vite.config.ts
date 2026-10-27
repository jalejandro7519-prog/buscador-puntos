import { defineConfig, type Plugin } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "tailwindcss";
import autoprefixer from "autoprefixer";
import { readFileSync } from "node:fs";

/** En el embed, rem → px: el html de la web anfitriona puede tener otro font-size base. */
const remAPx = {
  postcssPlugin: "rem-a-px",
  Declaration(decl: { value: string }) {
    if (decl.value.includes("rem")) {
      decl.value = decl.value.replace(/(-?\d*\.?\d+)rem\b/g, (_, n: string) => `${parseFloat(n) * 16}px`);
    }
  },
};

/** Emite iframe.html junto al bundle embebible (alternativa si el CMS filtra scripts). */
function iframeHtml(): Plugin {
  return {
    name: "emitir-iframe-html",
    generateBundle() {
      this.emitFile({
        type: "asset",
        fileName: "iframe.html",
        source: readFileSync(new URL("./embed-static/iframe.html", import.meta.url), "utf8"),
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const embed = mode === "embed";
  return {
    plugins: [react(), ...(embed ? [iframeHtml()] : [])],
    css: embed ? { postcss: { plugins: [tailwindcss(), autoprefixer(), remAPx] } } : undefined,
    define: embed ? { "process.env.NODE_ENV": JSON.stringify("production") } : undefined,
    build: embed
      ? {
          outDir: "dist/embed",
          emptyOutDir: false,
          copyPublicDir: false,
          assetsInlineLimit: 1_000_000,
          lib: {
            entry: "src/embed/main.ts",
            name: "BuscadorPuntos",
            formats: ["iife" as const],
            fileName: () => "buscador-puntos.js",
          },
        }
      : { target: "es2020" },
    server: { watch: { usePolling: true, interval: 300 } },
    test: {
      environment: "jsdom",
      setupFiles: ["./vitest.setup.ts"],
      include: ["src/**/*.test.{ts,tsx}"],
      passWithNoTests: true,
      css: false,
    },
  };
});
