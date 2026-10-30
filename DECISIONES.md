# Decisiones

Registro de las decisiones tomadas donde el encargo no definía un valor. Se mantiene al día en cada fase.

## Fase 0 – Entorno

- **Ubicación**: el proyecto vive en `buscador-puntos/`, subcarpeta de la carpeta de sesión (que ya contiene otro proyecto sin relación). Tiene su propio repositorio git, uno por proyecto.
- **Versiones**: React 18.3 (la que usa Lovable), Vite, Vitest y TypeScript en su última versión estable, Tailwind CSS 3.4 (el que usa Lovable; la v4 cambia la configuración).
- **Sin router**: la app autónoma solo tiene dos pantallas (`/` y `/admin`). Se decide con `location.pathname` / `#/admin`, sin `react-router`, para ahorrar bytes del bundle inicial.
- **`xlsx`**: el paquete de npm (0.18.5) tiene avisos de seguridad conocidos y SheetJS solo publica las versiones corregidas en su CDN oficial. Se instala `xlsx@0.20.3` desde `https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz`, como indica su documentación. Solo se carga (import dinámico) en el panel al elegir un .xlsx/.xls.
- **Marca**: `src/config/marca.ts` es el único sitio con colores; cada valor se expone como `var(--bp-…, respaldo)`.

## Fase 1 – Modelo y lógica

- **Orden (regla única)**: siempre primero los puntos abiertos y después los cerrados temporalmente; dentro de cada grupo, por distancia al origen (centroide del CP o ubicación del usuario) y, en empate o sin origen, por nombre en orden natural («Punto 2» antes que «Punto 10»). Un cerrado más cercano NUNCA adelanta a un abierto: es lo más simple de explicar y de testear.
- **Código postal**: 5 dígitos exactos (`^\d{5}$`), guardado siempre como texto. Si existe en los datos → modo CP (todo el listado por distancia al centroide). Si tiene forma de CP pero no existe → aviso «No tenemos puntos con ese código postal…» y el listado sigue completo (no se vacía). Una entrada con menos o más dígitos es búsqueda de texto normal.
- **Texto**: todas las palabras deben aparecer en nombre + dirección + ciudad + tipo (sin tildes ni mayúsculas). El CP no forma parte del texto buscable salvo en modo CP.
- **Prioridad de origen**: si hay un CP existente en la caja, manda sobre «Cerca de mí». Al pulsar «Cerca de mí» se vacía la caja si contenía un CP.
- **«Cómo llegar»**: la URL solo lleva coordenadas (exactas); la dirección va en la etiqueta accesible del enlace (`aria-label`). Android/escritorio/por defecto: Google Maps; iOS (incluido iPadOS como «Mac táctil»): Apple Maps.
- **Modelo**: `Punto` es una interfaz explícita; el esquema zod se comprueba en compilación contra ella. Valores vacíos opcionales (`""`) se normalizan a `undefined`.
- **Carga de `puntos.json`**: se acepta también un array directo. Ids duplicados descartan el segundo punto. Versión distinta de 1 → error de carga (se usa la caché).

## Fase 2 – Vista pública

- **Umbral de la rejilla**: el encargo habla de «≥ 1024 px», pero también de que el widget se adapte al ancho de su contenedor y no de la ventana. Se usa una *container query*: listado (380 px) + mapa lado a lado cuando el contenedor mide **≥ 720 px**; por debajo, mapa arriba (≈ 40 vh, entre 240 y 360 px) y listado debajo. Con 1024 px de umbral, una columna de contenido típica de un CMS (800–900 px) nunca vería la versión de escritorio.
- **Altura (`data-altura`)**: solo rige en el modo lado a lado (el listado hace scroll dentro). En modo apilado la altura es automática y la página hace scroll: un mapa de 40 vh más un listado no caben en 600 px.
- **Cerrado temporalmente**: «Cómo llegar» pasa a ser un `<button disabled>` (no un enlace) con etiqueta accesible «no disponible: cerrado temporalmente»; el teléfono sigue siendo un enlace `tel:`. Fondo gris y texto `#4B5563` (contraste AA). Fechas de reapertura en formato largo («15 de noviembre de 2026»), leídas en UTC para no retroceder un día en zonas horarias de América.
- **Caché**: la clave `buscador-puntos:cache:v1` guarda también la `src` de la que viene; si cambia el `data-src`, la caché de otra fuente no se usa. Dos widgets con `src` distintas en la misma página se pisan la caché (solo pierden la aceleración del primer pintado).
- **Errores**: sin datos ni caché → mensaje con «Reintentar»; con caché → se muestra la última lista y un aviso discreto con «Reintentar». Los puntos inválidos se descartan solo en consola (el aviso visible será del panel).
- **Debounce** de 150 ms en la caja de búsqueda; al vaciar con «Quitar búsqueda y filtros» el listado vuelve tras ese mismo intervalo.
- **Accesibilidad**: `lang="es"`, `<ul>` semántico, contador en `role="status"` (aria-live polite), filtros como `aria-pressed`, `useId` para etiquetas (válido con dos instancias).

## Fase 3 – Mapa

- **Carga diferida**: el listado se pinta primero. `MapaDiferido` espera a `requestIdleCallback` (respaldo: `setTimeout` 200 ms) y a que el contenedor esté a ≤ 200 px de la zona visible (`IntersectionObserver`, respaldo: inmediato). El código del mapa y Leaflet son un fragmento aparte (`Mapa-*.js` + `leaflet-*.js`, ≈ 53 KB gzip) que nunca entra en el bundle inicial; mientras tanto se ve un esqueleto.
- **Fallos**: error boundary + `try/catch` en el montaje → estado `fallo` (el panel del mapa desaparece y el listado ocupa todo el ancho). Si en 6 s no está listo → estado `tarde` (aviso «El mapa no está disponible ahora», pero se deja terminar de cargar; si llega, el mapa aparece). En ambos casos búsqueda, filtros y «Cómo llegar» siguen funcionando.
- **Leaflet no pisa `window.L`**: Leaflet se asigna siempre a `window.L`; tras importarlo se llama a `L.noConflict()` para devolver el valor previo (importante en el embed: la web anfitriona puede tener su propio Leaflet).
- **Marcadores**: `divIcon` con SVG en línea (sin imágenes). Color por `var(--bp-color-primario)`. Cerrados: gris `#6B7280` con icono de pausa; seleccionado: mayor tamaño y borde de acento. Los colores van en `style` (no en atributos de presentación) para que `var()` funcione en todos los navegadores.
- **Fichas del popup**: se construyen con `createElement`/`textContent` (nunca `innerHTML`), así que los datos del JSON no pueden inyectar HTML.
- **Encuadre**: `fitBounds` solo cuando cambia el *conjunto* de puntos visibles (filtros, búsqueda), no al renovar los mismos datos. Con `data-centro`/`data-zoom` se respeta esa vista en la carga inicial.
- **Agrupación (> 300 puntos)**: agrupación propia por celdas de 60 px en proyección Web Mercator (`lib/agrupar.ts`, ≈ 0,4 KB gzip, `import()` dinámico solo si se supera el umbral) en lugar de `leaflet.markercluster`, que exige `window.L` global y añade ~10 KB. Por encima del zoom 16 no se agrupa.
- **Medición**: el mapa deja `performance.mark("bp:mapa-listo")` y `"bp:mapa-teselas"` (primeras teselas pintadas).
- **Filtros en móvil**: una sola fila desplazable en contenedores estrechos para que el mapa quede visible sin hacer scroll.

## Fase 4 – Panel de administración

- **Acceso**: ruta `/admin` (o `#/admin` si el servidor no reescribe rutas). PIN en `VITE_ADMIN_PIN`; sin definir, en desarrollo vale `1234` y en producción el panel se deshabilita. Sesión en `sessionStorage`. El PIN va dentro del bundle: es una barrera de cortesía, no seguridad (documentado en el README).
- **Borrador**: no existe hasta el primer cambio; mientras tanto se trabaja sobre `puntos.json`. «Hay cambios sin publicar» compara contenido por `id`, **ignorando el orden y `actualizadoEn`**, así que revertir un cambio a mano también quita el aviso.
- **Deshacer**: pila de 20 niveles (importaciones, altas, ediciones, borrados y cierres/reaperturas son cada uno un nivel). «Descartar borrador» vacía la pila.
- **`actualizadoEn`**: lo pone la app al guardar un punto; al importar, un punto idéntico al existente conserva su fecha (reimportar la misma hoja no genera cambios falsos).
- **Importación – criterios de clasificación**: *válida* = sin problemas; *con aviso* = se importa pero hay algo que revisar (estado desconocido → abierto, fecha de reapertura ilegible → se ignora, id repetido → sufijo `-2`, coordenadas lejos del resto); *con error* = no se importa hasta corregirla (falta nombre/tipo/dirección, coordenadas vacías, ilegibles, fuera de rango o 0,0). El botón importa «válidas + con aviso».
- **lat/lng intercambiadas**: fuera de rango → error con botón «Intercambiar»; dentro de rango (p. ej. −86,25 / 12,13) → aviso si la fila está a > 20° de la mediana del lote y su inversa a < 10°; el lote necesita ≥ 3 filas con coordenadas para tener referencia.
- **Formatos**: CSV con coma, punto y coma o tabulador (autodetección), con o sin BOM, UTF-8 o Windows-1252; .xlsx/.xls solo la primera hoja, con valores sin formato (`raw`) para no perder decimales; códigos postales numéricos de Excel pierden ceros a la izquierda (avisar al cliente: guardar la columna como texto). Fechas ISO, `dd/mm/aaaa` o número de serie de Excel.
- **Exportar a CSV**: mismas cabeceras que acepta la importación (más `Id`), coma como separador y BOM UTF-8; los textos que empiezan por `=`, `@` o `±letra` se protegen con `'` (fórmulas de Excel) y la importación lo deshace.
- **Confirmaciones**: en línea (`role="alertdialog"`) en lugar de `window.confirm`; el foco empieza en «Cancelar». «Reemplazar todo» es el modo por defecto y siempre pide confirmación.
- **Código partido**: el panel (con papaparse y el mapa de selección) es un fragmento aparte que solo se descarga en `/admin`; `xlsx` (≈ 160 KB gzip) solo al elegir un Excel.

## Fase 5 – Componente incrustable

- **Un solo fichero**: `dist/embed/buscador-puntos.js` es un IIFE con React, Leaflet, zod, la app y todo el CSS (Tailwind + Leaflet) como cadenas dentro del JS (`?inline`), de modo que sirve el `<script src=… defer>` clásico del snippet. Pesa ≈ 428 KB / **≈ 133 KB gzip**. El presupuesto de 120 KB del encargo se aplica a la **app autónoma** (inicial ≈ 81 KB gzip, con Leaflet en un fragmento diferido); en el embed, «un solo fichero» obliga a incluir Leaflet en el mismo fichero (se ejecuta igualmente tras el primer pintado del listado). Si el cliente prefiere un embed más ligero se puede partir en dos ficheros (carga del mapa bajo demanda), a costa de incumplir «un solo fichero».
- **Aislamiento**: Shadow DOM `open`. Los estilos viven dentro del shadow root (también los de Leaflet, que se inyectan al montar el mapa). Se cortan las propiedades heredables más peligrosas en `.bp-root` (tamaño, interlineado, `text-transform`, `letter-spacing`, `text-align`, `white-space`…) y solo se deja pasar la tipografía (`--bp-fuente`, por defecto `inherit`) y las variables `--bp-*`.
- **rem → px en el embed**: una web con `html { font-size: 62.5% }` encogería todo el widget; en el build del embed un plugin de PostCSS convierte `rem` en `px` (×16). En la app autónoma se mantienen `rem`.
- **Sin pisar el `window.L` de la web anfitriona** (ver Fase 3) y sin variables globales: el único global es el registro del elemento `buscador-puntos` (se evita registrarlo dos veces).
- **Atributos**: `data-src`, `data-tile-url`, `data-centro`, `data-zoom`, `data-altura`, `data-idioma` (solo `es`), `data-logo` y, además, `data-atribucion` (el encargo pide la atribución configurable). Cambiar un atributo con el widget montado vuelve a pintar. Todo se valida: URLs solo `http(s)` o relativas (nada de `javascript:`), `data-tile-url` debe llevar `{z}/{x}/{y}`, la altura solo admite longitudes simples, la atribución propia se escapa como texto. Con teselas propias y sin `data-atribucion` se mantiene la atribución de OpenStreetMap.
- **`data-src` relativo**: se resuelve contra la página anfitriona (no contra el script), igual que cualquier `fetch`.
- **iframe**: `dist/embed/iframe.html` acepta `?src=…&tile=…&centro=…&zoom=…&logo=…&atribucion=…` y ocupa el 100 % del iframe (`data-altura="100vh"`).
- **Demo**: `demo/pagina-anfitriona.html` (copiada a `dist/demo/` en el build) con CSS agresivo y dos instancias (una a 320 px con otra marca). Se ve con `npm run demo`.

## Fase 6 – Rendimiento, accesibilidad y documentación

- **Definición de «mapa interactivo»**: Leaflet creado, marcadores pintados y controles activos (`bp:mapa-interactivo`). Las teselas son imágenes de un servidor externo y se miden aparte (`bp:mapa-teselas`). El criterio de 3 s se evalúa con el perfil de red «4G lento» de Lighthouse aplicado de verdad; la penalización extra de CPU 4× se informa por separado porque deja el resultado en el límite (ver `docs/rendimiento.md`).
- **Optimizaciones**: Leaflet dentro del fragmento del mapa (descarga en paralelo, no en cascada), `modulepreload` de prioridad baja de esos fragmentos inyectado en `index.html` al compilar, `puntos.json` pedido desde `index.html` (el JS de la app lo recoge si existe; si no, pide él), encuadre inicial al crear el mapa, `preconnect` al servidor de teselas, y reserva de altura para el contador y los filtros (CLS 0).
- **El embed sigue en un solo fichero (≈ 133 KB gzip)**: es la consecuencia de «un solo fichero». Alternativa si se quiere más ligero: dos ficheros, con el mapa cargado bajo demanda.
- **Accesibilidad**: se añadió un `<h2>` oculto «Puntos encontrados» para que los títulos de las fichas (`<h3>`) no salten de nivel; marcadores con caja táctil de 40 px (el dibujo mide 30 px). Queda un aviso de Lighthouse (`target-size`) por marcadores solapados a zoom bajo con los datos de demo; la lista es la alternativa textual completa. No se ha probado con lector de pantalla.
- **Datos DEMO**: coordenadas inventadas alrededor del centro de Managua (12,136; −86,251) y nombres claramente ficticios («Punto demo 01»…). Los barrios (Altamira, Bolonia…) solo sirven de etiqueta; las direcciones («Calle Demo 1») no existen.
- **Pendiente de decidir por el cliente**: ver el resumen final y el README.

## Fase 7 – Reseñas breves por punto (tras la revisión de Kodarvia)

- **Origen**: el encargo original no las mencionaba, pero la revisión indicó que el alcance contemplaba «reseñas breves por punto gestionadas desde el panel» y ofreció sumarlas. Se han sumado.
- **Interpretación**: reseñas *editoriales*, escritas y mantenidas por quien administra el panel. Las enviadas por el público necesitan un backend (moderación, anti-spam), que el encargo deja fuera de alcance.
- **Límites**: máx. 5 por punto y 280 caracteres por reseña (breves; la ficha sigue siendo breve). Autor opcional. Fecha de alta automática.
- **Presentación**: bloque `<details>` plegado («2 reseñas») para no alargar las fichas; en el popup del mapa se construye con `textContent`. Los puntos cerrados conservan sus reseñas.
- **Datos**: `resenas` opcional en `Punto`; una reseña inválida se descarta sola. Sin reseñas el campo no existe (los `puntos.json` anteriores siguen valiendo).
- **Hoja**: columna `Reseñas` con textos separados por ` || ` (solo texto). Al reimportar se reutilizan autor y fecha de las que no cambian; una celda vacía **no** borra las existentes, para que reimportar una hoja antigua no destruya reseñas escritas en el panel.
- **Comparación de cambios**: la detección de «cambios sin publicar» ahora serializa con claves ordenadas a cualquier profundidad (antes solo ordenaba el primer nivel, lo que habría ocultado cambios dentro de las reseñas).
- **Datos DEMO**: 3 puntos con 4 reseñas ficticias en total.
