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

/**
 * Avisa al navegador de los fragmentos del mapa con prioridad BAJA: se descargan mientras el
 * navegador trabaja con lo inicial, sin competir con él; el mapa se monta después del primer pintado.
 */
function precargarMapa(): Plugin {
  let base = "/";
  return {
    name: "precargar-fragmentos-del-mapa",
    configResolved(config) {
      base = config.base;
    },
    transformIndexHtml: {
      order: "post",
      handler(_html, ctx) {
        const nombres = Object.keys(ctx.bundle ?? {}).filter((n) => /^assets\/(Mapa|leaflet-src|marcadores)-.*\.js$/.test(n));
        return nombres.map((n) => ({
          tag: "link",
          attrs: { rel: "modulepreload", crossorigin: true, href: `${base}${n}`, fetchpriority: "low" },
          injectTo: "head" as const,
        }));
      },
    },
  };
}

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
    plugins: [react(), ...(embed ? [iframeHtml()] : [precargarMapa()])],
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
