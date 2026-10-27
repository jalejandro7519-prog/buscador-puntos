# Criterios de aceptación

Comprobados el 27/10/2026 sobre la compilación de producción. Estado de las comprobaciones automáticas:
`npm run lint` sin avisos · `tsc --noEmit` (estricto) sin errores · `npm test`: **12 ficheros, 149 pruebas, todas en verde** · `npm run build` correcto.

| # | Criterio | Resultado |
|---|---|---|
| 1 | La importación carga todos los puntos de la hoja con sus coordenadas | ✔ cumplido |
| 2 | La búsqueda por código postal devuelve los puntos ordenados por distancia | ✔ cumplido |
| 3 | «Cómo llegar» abre la app de mapas del móvil con la dirección correcta | ✔ cumplido (URL verificadas por pruebas; no probado en un teléfono físico) |
| 4 | Un punto marcado como cerrado se ve señalado y no desaparece | ✔ cumplido |
| 5 | El mapa carga en menos de tres segundos en móvil | ✔ con 4G lento (≈ 2,2 s); ≈ 3,0 s si además se penaliza la CPU 4× (ver matices) |
| 6 | El componente incrustado funciona en la web actual del cliente | ✔ cumplido en la página anfitriona de demo (no hay acceso a la web real del cliente) |

## 1. Importación: todos los puntos, con sus coordenadas

**Evidencia — pruebas** (`src/lib/importar.test.ts`, bloque «hoja de ejemplo (criterio de aceptación 1)»):

- *«todas las filas son válidas y se importan: nº de puntos = nº de filas válidas»*: `public/ejemplo-hoja.csv` → 24 filas, 24 válidas, 0 con aviso, 0 con error; `puntosImportables` devuelve 24.
- *«cada punto conserva sus coordenadas EXACTAS (incluida la fila con coma decimal)»*: las 24 `lat`/`lng` importadas son idénticas (`toBe`) a las de `public/puntos.json`; la fila 6 de la hoja está escrita como `"12,165"` / `"-86,2418"` y se importa como `12.165` / `-86.2418`.
- *«conserva el resto de campos»*: 3 cerrados con motivo y reapertura, 3 teléfonos y 2 horarios ausentes, ids idénticos a los del publicado.
- Vista previa en la interfaz (`src/components/admin/PanelAdmin.test.tsx`): *«vista previa de la hoja de ejemplo: 24 filas, 24 válidas»* → «Importar 24 puntos» → la tabla pasa a tener 24 filas.
- Filas con problemas (`ejemplo-hoja-con-errores.csv`, 12 filas): 7 válidas, 1 con aviso (lat/lng intercambiadas), 4 con error (sin coordenadas, latitud ilegible, latitud fuera de rango, sin nombre); ninguna se pierde en silencio y se corrigen a mano en la vista previa (*«la hoja con errores marca cada fila problemática y deja corregir a mano antes de importar»*).
- Modos «Reemplazar todo» / «Combinar»: `importar.test.ts` → *«modos de importación»*; en la interfaz, «Reemplazar todo» exige confirmación explícita.

## 2. Búsqueda por código postal ordenada por distancia

**Evidencia — pruebas:**

- `src/lib/busqueda.test.ts` → *«ordena TODO el listado por distancia al centroide y da la distancia»*, *«el centro del CP es el centroide de los puntos que lo comparten»*, *«un CP inexistente avisa pero no bloquea»*.
- `src/lib/geo.test.ts` → Haversine con pares conocidos (Madrid–Barcelona, París–Londres, 1° en el ecuador), orden estable, cerrados después de abiertos.
- `src/components/BuscadorPuntos.test.tsx` → *«un código postal existente ordena todo por distancia al centroide y muestra km»* (el listado muestra «0,x km» junto a cada punto) y *«un código postal inexistente avisa sin bloquear el listado»* («No tenemos puntos con ese código postal. Prueba por nombre o con «Cerca de mí»»).

## 3. «Cómo llegar» con la dirección correcta

**Evidencia — pruebas:**

- `src/lib/directions.test.ts`: Android y por defecto → `https://www.google.com/maps/dir/?api=1&destination=12.1364,-86.251`; iOS (iPhone, iPad e iPadOS «Mac táctil») → `https://maps.apple.com/?daddr=12.1364,-86.251&dirflg=d&q=<nombre codificado>`. Se usan las coordenadas exactas del punto; la dirección va en la etiqueta accesible del enlace.
- `BuscadorPuntos.test.tsx` → *««Cómo llegar» abre la app de mapas con las coordenadas y rel seguro»*: `href` correcto, `target="_blank"`, `rel="noopener noreferrer"`. En un punto cerrado el botón está deshabilitado.
- **No verificado**: la apertura real de Google Maps / Apple Maps en un teléfono (el entorno de trabajo no dispone de uno). Los formatos de URL son los documentados por Google (`maps/dir/?api=1&destination=`) y Apple (`maps.apple.com/?daddr=`).

## 4. Punto cerrado: señalado y sin desaparecer

**Evidencia — pruebas:**

- `BuscadorPuntos.test.tsx` → *«un punto cerrado temporalmente NO desaparece: insignia, motivo, reapertura y teléfono accesible»*: sigue en el `<ul>`, muestra «Cerrado temporalmente», «Motivo: Obras en el local», «Reapertura prevista: 15 de noviembre de 2026», conserva el enlace `tel:` y «Cómo llegar» queda deshabilitado.
- `BuscadorPuntos.mapa.test.tsx` → *«el punto cerrado sigue en el listado y en el mapa (con su variante propia)»*.
- `src/lib/marcadores.test.ts` → el marcador cambia: gris `#6B7280` con icono de pausa, distinto del azul de marca con punto central.
- Orden: `geo.test.ts` → *«los cerrados van después de los abiertos aunque estén más cerca»* (regla documentada en `DECISIONES.md`).
- **Medición en navegador real** (mapa de demo): 24 marcadores, 3 de ellos con el icono de pausa (`rect`), y popup con la ficha completa al pulsar.
- Panel: cerrar y reabrir con un único interruptor (`PanelAdmin.test.tsx` → *«cerrar y reabrir un punto con un único interruptor…»*).

## 5. El mapa carga en menos de tres segundos en móvil

**Evidencia — medición** (detalle y método en [`rendimiento.md`](rendimiento.md)). Lighthouse 12.8.2, perfil móvil, red *Slow 4G* aplicada de verdad (latencia 562,5 ms, 1,47 Mbps). «Mapa interactivo» = marca `bp:mapa-interactivo` (mapa creado con los marcadores pulsables):

| Escenario | Mapa interactivo | Primeras teselas |
|---|---:|---:|
| App, red 4G lento (5 ejecuciones) | **2,15 – 2,20 s** | 3,3 – 3,45 s |
| Embed en la demo, red 4G lento (3 ejecuciones) | **2,08 – 2,10 s** | 3,75 – 3,78 s |
| App, 4G lento + CPU 4× más lenta (3 ejecuciones) | 2,63 / 3,00 / 3,44 s (mediana 3,0 s) | 3,68 / 4,09 / 4,46 s |

**Matices honestos:** el criterio «< 3 s» se cumple con el perfil de red pedido (4G lento). Con la penalización adicional de CPU de
Lighthouse (equivalente a un móvil de gama baja) el resultado está en el límite (mediana 3,0 s, entre 2,6 y 3,4 s según la ejecución). Las **teselas** (imágenes de
`tile.openstreetmap.org`) tardan más (3,3–4,5 s) porque dependen de un servidor público externo; el mapa ya es interactivo antes.
El listado es usable desde ≈ 2 s en la primera visita y al instante en las siguientes (caché local). Un proveedor de teselas propio
o de pago mejoraría este tiempo.

Presupuesto de tamaño: inicial ≈ **82 KB gzip** (HTML + JS + CSS) frente al máximo de 120 KB; Leaflet (43 KB gzip) y el mapa se cargan después.
Si el mapa falla o tarda más de 6 s, el listado sigue siendo plenamente usable y aparece el aviso «El mapa no está disponible ahora»
(`BuscadorPuntos.mapa.test.tsx`: *«si el mapa lanza un error…»* y *«si el mapa tarda más de 6 s…»*).

## 6. El componente incrustado funciona en la web del cliente

**Evidencia:**

- **Prueba de humo** (`src/embed/main.test.ts`): `<buscador-puntos>` se monta en jsdom y renderiza el listado dentro de su Shadow DOM; los estilos van dentro del shadow root y el `<head>` de la página no recibe ninguno; dos instancias en la misma página son independientes; los atributos `data-*` se leen y se validan (`javascript:` rechazado).
- **Página anfitriona** `demo/pagina-anfitriona.html` (`npm run demo`) con CSS agresivo (reset global, `html{font-size:62.5%}`, `* { box-sizing; text-transform: uppercase; letter-spacing; color !important… }`, estilos de `button`, `input`, `a`, `h1-h3`, imágenes y listas). Medido en el navegador sobre la compilación de producción:
  - `font-size: 16px`, `text-transform: none`, `letter-spacing: normal` y `color` propio dentro del widget (la web anfitriona los pone en mayúsculas, espaciados y violeta).
  - El campo de búsqueda mide 44 px aunque la web fuerza `input { height: 8rem; border: double red }`; los botones usan su propio fondo aunque la web fuerza `button { background: hotpink }`.
  - Hereda la tipografía de la web (`Georgia`) y, en la segunda instancia, aplica `--bp-fuente: "Courier New"`, `--bp-color-primario: #0b7a3b` y `--bp-radio: 2px` definidos en un contenedor.
  - Segunda instancia en un contenedor de **320 px**: diseño apilado (mapa arriba, listado debajo), sin desbordamiento horizontal.
  - `window.L` queda sin definir (Leaflet no pisa al de la web anfitriona).
- Snippet del README (`<script src="…/buscador-puntos.js" defer>` + `<buscador-puntos data-src="…/puntos.json">`) y alternativa `<iframe>` (`dist/embed/iframe.html`) documentados.
- **No verificado**: la web real del ayuntamiento (no se tiene acceso). El README indica qué subir al servidor y el requisito CORS si `puntos.json` está en otro dominio.

## Otras comprobaciones del encargo

- **Accesibilidad**: Lighthouse 96 (único fallo: `target-size` por marcadores solapados a zoom bajo; la lista es la alternativa textual). Listado en `<ul>`, contador en `role="status"`, controles con etiqueta, foco visible (`outline` de 3 px), objetivos táctiles de 44 px, `prefers-reduced-motion` respetado, ≥ 16 px de texto base. No se ha hecho una revisión manual con lector de pantalla.
- **Seguridad del cliente**: datos del JSON siempre como texto (nunca `innerHTML`), URL de atributos validadas, PIN descrito como barrera de cortesía.
- **Fuera de alcance, no implementado**: reservas, pedidos, stock, incidencias, cuentas de usuario, backend, base de datos remota, pagos.
