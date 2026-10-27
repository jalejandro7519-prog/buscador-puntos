// Resume un informe JSON de Lighthouse: puntuaciones, métricas y marcas de usuario del mapa.
import { readFileSync } from "node:fs";

const informe = JSON.parse(readFileSync(process.argv[2], "utf8"));
const a = informe.audits;
const cat = Object.fromEntries(Object.entries(informe.categories).map(([k, v]) => [k, Math.round(v.score * 100)]));
const metrica = (id) => a[id]?.displayValue ?? "n/d";
const marcas = (a["user-timings"]?.details?.items ?? [])
  .filter((i) => i.timingType === "Mark")
  .map((i) => `${i.name}: ${(i.startTime / 1000).toFixed(2)} s`);

console.log(JSON.stringify({
  url: informe.finalDisplayedUrl,
  lighthouse: informe.lighthouseVersion,
  throttlingMethod: informe.configSettings.throttlingMethod,
  formFactor: informe.configSettings.formFactor,
  categorias: cat,
  FCP: metrica("first-contentful-paint"),
  LCP: metrica("largest-contentful-paint"),
  TBT: metrica("total-blocking-time"),
  CLS: metrica("cumulative-layout-shift"),
  SpeedIndex: metrica("speed-index"),
  TTI: metrica("interactive"),
  marcasMapa: marcas,
  bytesTotales: a["total-byte-weight"]?.displayValue,
  fallosAccesibilidad: Object.values(a).filter((x) => x.score === 0 && (informe.categories.accessibility?.auditRefs ?? []).some((r) => r.id === x.id)).map((x) => x.id),
}, null, 2));
