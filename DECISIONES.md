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
