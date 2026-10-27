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
