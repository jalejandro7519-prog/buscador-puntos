# Rendimiento

Medido el 27/10/2026 sobre la compilación de producción (`npm run build` + `vite preview`), con
Lighthouse 12.8.2 (Chrome para Windows, perfil móvil) en un portátil con conexión real a Internet
(las teselas se piden de verdad a `tile.openstreetmap.org`). Los informes completos no se versionan
(`.lighthouse/` está en `.gitignore`); se reproducen con los comandos del final.

## 1. Presupuesto de tamaño (app autónoma)

| Recurso | gzip | Cuándo se carga |
|---|---:|---|
| `index.html` | 0,4 KB | inicial |
| `assets/index-*.js` (React, zod, app pública) | 76,9 KB | inicial |
| `assets/rolldown-runtime-*.js` | 0,4 KB | inicial |
| `assets/index-*.css` | 4,2 KB | inicial |
| **Total inicial** | **≈ 81,9 KB** | **presupuesto: ≤ 120 KB ✔** |
| `Mapa-*.js` + `marcadores-*.js` | 2,3 + 7,1 KB | diferido (tras el primer pintado) |
| `leaflet-src-*.js` | 43,4 KB | diferido |
| `agrupar-*.js` | 0,4 KB | solo con > 300 puntos |
| `Admin-*.js` | 17,4 KB | solo en `/admin` |
| `xlsx-*.js` | 160,5 KB | solo al elegir un .xlsx/.xls |

Componente incrustable: `dist/embed/buscador-puntos.js` = 428 KB / **132,7 KB gzip** en un único
fichero (React + Leaflet + zod + app + CSS). Supera los 120 KB porque «un solo fichero» obliga a incluir
Leaflet; en la página anfitriona se descarga con `defer`, así que no bloquea su primer pintado
(FCP 0,7 s en `demo/pagina-anfitriona.html`).

## 2. Tiempo hasta mapa interactivo (criterio: < 3 s en móvil con 4G lento)

«Mapa interactivo» = Leaflet creado, marcadores pintados y controles activos (`performance.mark("bp:mapa-interactivo")`).
«Teselas» = primeras teselas pintadas (`bp:mapa-teselas`). Perfil de red: *Slow 4G* de Lighthouse
(latencia 562,5 ms, 1,47 Mbps de bajada, 0,67 Mbps de subida), **aplicado de verdad** (`--throttling-method=devtools`,
no estimado) para que las marcas de usuario reflejen la red limitada.

| Escenario | Mapa interactivo | Primeras teselas | FCP |
|---|---:|---:|---:|
| App autónoma, red 4G lento (5 ejecuciones) | **2,15 – 2,20 s** ✔ | 3,28 – 3,45 s | 2,0 s |
| Embed en la página de demo, red 4G lento (3 ejecuciones) | **2,08 – 2,10 s** ✔ | 3,75 – 3,78 s | 0,7 s |
| App autónoma, red 4G lento **+ CPU 4× más lenta** (Moto G4 de Lighthouse; 3 ejecuciones) | 2,63 / 3,00 / 3,44 s (mediana 3,0 s) | 3,68 / 4,09 / 4,46 s | 2,3 – 2,5 s |

Lectura honesta: con el perfil de red pedido el mapa es interactivo en ≈ 2,2 s. Si además se
penaliza la CPU 4×, el resultado ronda los 3 s y varía mucho entre ejecuciones (2,6–3,4 s); las teselas, que dependen de un
servidor externo con su propia latencia, llegan hacia los 3,3–4,5 s. El listado, que es lo que la gente usa
primero, es utilizable desde el FCP (≈ 2 s) y desde el primer pintado con caché (visitas posteriores).

### Qué se hizo para llegar ahí

Punto de partida (red 4G lento + CPU 4× lenta): mapa interactivo a **3,8 s**, primeras teselas a 5,1 s. Mejoras, con el
resultado medido tras cada una en ese mismo escenario:

1. **Mapa y Leaflet en paralelo, no en cascada**: `Mapa.tsx` importa Leaflet estáticamente y se carga con `import()`; el navegador pide ambos fragmentos a la vez. → 3,2 – 3,6 s.
2. **Fragmentos del mapa con `modulepreload` de prioridad baja** (inyectados en `index.html` en el build) y **`puntos.json` pedido desde `index.html`**, antes de que termine de descargarse el JS de la app. El mapa se sigue **montando** después del primer pintado del listado. → 2,9 – 3,0 s.
3. **Encuadre inicial al crear el mapa**: antes se creaba en zoom 13 y `fitBounds` pasaba luego a zoom 12 (dos tandas de teselas); ahora la vista final es la primera.
4. **`preconnect` al servidor de teselas** (en `index.html` y, para el embed, añadido al `<head>` al montar el mapa). → 2,63 / 3,00 / 3,44 s (mediana 3,0 s); teselas ≈ 4,1 s.
5. **CLS 0**: el contador y los filtros reservan su altura mientras llegan los datos (antes 0,076).

## 3. Lighthouse móvil (simulado, por defecto)

| Categoría | Puntuación |
|---|---:|
| Rendimiento | 92 |
| Accesibilidad | 96 |
| Buenas prácticas | 93 |
| SEO | 92 |

FCP 1,4 s · LCP 3,3 s (una tesela del mapa) · TBT 10 ms · CLS 0 · Speed Index 1,4 s · 234 KiB en total (incluye las teselas).

Único fallo de accesibilidad: `target-size` en los marcadores del mapa que se solapan entre sí con los
24 puntos de demo (cada marcador mide 40 × 40 px, pero a zoom bajo se pisan). La lista contiene la misma
información y es la alternativa accesible; con más zoom los marcadores dejan de solaparse.

## 4. Cómo repetir las mediciones

```bash
npm run build
npx vite preview --port 4173 &
# Lighthouse por defecto (red y CPU simuladas)
npx lighthouse@12 http://localhost:4173/ --form-factor=mobile --output=json --output-path=.lighthouse/simulado.json
# Red 4G lento aplicada de verdad (sin penalizar la CPU)
npx lighthouse@12 http://localhost:4173/ --form-factor=mobile --only-categories=performance \
  --throttling-method=devtools --throttling.requestLatencyMs=562.5 \
  --throttling.downloadThroughputKbps=1474.56 --throttling.uploadThroughputKbps=675 \
  --throttling.cpuSlowdownMultiplier=1 --output=json --output-path=.lighthouse/4g.json
node scripts/resumen-lighthouse.mjs .lighthouse/4g.json   # muestra FCP, LCP y las marcas bp:mapa-*
```
Para medir en un móvil real: Chrome → `chrome://inspect`, y en la consola `performance.getEntriesByType("mark")`.

## 5. Notas

- Las teselas de OpenStreetMap vienen de un servidor público compartido: su tiempo de respuesta no lo controlamos. Con un proveedor propio o de pago (`data-tile-url`) mejorarían los tiempos y la fiabilidad.
- En el modo desarrollo (`npm run dev`) no se aplica nada de esto (módulos sin empaquetar): las cifras son solo de producción.
