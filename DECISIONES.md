# Decisiones

Registro de las decisiones tomadas donde el encargo no definía un valor. Se mantiene al día en cada fase.

## Fase 0 – Entorno

- **Ubicación**: el proyecto vive en `buscador-puntos/`, subcarpeta de la carpeta de sesión (que ya contiene otro proyecto sin relación). Tiene su propio repositorio git, uno por proyecto.
- **Versiones**: React 18.3 (la que usa Lovable), Vite, Vitest y TypeScript en su última versión estable, Tailwind CSS 3.4 (el que usa Lovable; la v4 cambia la configuración).
- **Sin router**: la app autónoma solo tiene dos pantallas (`/` y `/admin`). Se decide con `location.pathname` / `#/admin`, sin `react-router`, para ahorrar bytes del bundle inicial.
- **`xlsx`**: el paquete de npm (0.18.5) tiene avisos de seguridad conocidos y SheetJS solo publica las versiones corregidas en su CDN oficial. Se instala `xlsx@0.20.3` desde `https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz`, como indica su documentación. Solo se carga (import dinámico) en el panel al elegir un .xlsx/.xls.
- **Marca**: `src/config/marca.ts` es el único sitio con colores; cada valor se expone como `var(--bp-…, respaldo)`.
