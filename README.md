# Buscador de puntos

Buscador con **mapa y listado** de la red de puntos del ayuntamiento: cualquier persona encuentra, desde el
móvil y en segundos, el punto más cercano, su horario y cómo llegar. Quien mantiene la lista la actualiza en
minutos desde un panel, sin depender de nadie. Se incrusta en la web que el ayuntamiento ya tiene sin romper su estilo.

> ⚠️ **Los 24 puntos de `public/puntos.json`, `public/ejemplo-hoja.csv` y `public/ejemplo-hoja-con-errores.csv`
> son DEMO** (ficticios, en torno a Managua). Hay que sustituirlos por los reales antes de publicar.

- React + TypeScript (estricto) + Vite + Tailwind CSS 3. Sin backend ni base de datos: solo ficheros estáticos y `localStorage`.
- Mapa: Leaflet con teselas de OpenStreetMap (sin API key), cargado de forma diferida.
- Importación de la hoja de cálculo: `papaparse` (CSV) y `xlsx` (Excel); el panel y `xlsx` solo se descargan en `/admin`.
- Compatible con Lovable (Vite + React + Tailwind, componentes en `src/components`): se puede importar el repositorio o sincronizarlo por GitHub.

## Puesta en marcha

```bash
npm install
npm run dev        # http://localhost:5173  (panel: /admin, PIN de desarrollo 1234)
npm run lint && npm test && npm run build
npm run demo       # construye y abre la página anfitriona de prueba (http://localhost:4173/demo/pagina-anfitriona.html)
```

Resultado de `npm run build` (carpeta `dist/`):

| Ruta | Qué es |
|---|---|
| `dist/index.html`, `dist/assets/*` | La aplicación autónoma (buscador en `/`, panel en `/admin`) |
| `dist/puntos.json` | El «dato publicado» (copia de `public/puntos.json`) |
| `dist/embed/buscador-puntos.js` | El componente incrustable `<buscador-puntos>` (un solo fichero, con el CSS dentro) |
| `dist/embed/iframe.html` | Alternativa con `<iframe>` si el gestor de contenidos filtra scripts |
| `dist/demo/pagina-anfitriona.html` | Web de ejemplo con CSS agresivo que incrusta el widget con dos líneas |

## Cómo se publican los cambios

**Limitación importante.** `localStorage` es propio de cada navegador: lo que se edite en el panel solo existe
en ese navegador y **no llega a los ciudadanos**. Por eso hay dos niveles de datos:

1. **Dato publicado**: un fichero estático `puntos.json` (`{ "version": 1, "generadoEn": "…", "puntos": [...] }`).
   El buscador público (y el componente incrustado) lo leen de la URL de `data-src` (por defecto `/puntos.json`).
2. **Borrador**: lo que se edita en `/admin`, guardado en `localStorage` (clave `buscador-puntos:borrador:v1`).
   Si no hay borrador, el panel parte del `puntos.json` publicado.

**Flujo para quien mantiene la lista**

1. Entrar en `/admin` con el PIN.
2. Importar la hoja de cálculo («Importar hoja») o editar puntos uno a uno; cerrar/reabrir un punto con el interruptor de su fila.
3. Mientras el borrador difiera de lo publicado el panel muestra **«Hay cambios sin publicar»**.
4. Pulsar **«Publicar cambios»**: se descarga el `puntos.json` actualizado.
5. **Sustituir el fichero `puntos.json` de la web por el descargado.** Desde ese momento los cambios son visibles para todos.
6. «Exportar a CSV» devuelve los datos a la hoja de cálculo; «Descartar borrador» vuelve a lo publicado (pide confirmación); «Deshacer» revierte el último cambio (hasta 20 niveles).

**Copia en caché en el buscador público.** El buscador guarda en `localStorage` la última lista cargada
(`buscador-puntos:cache:v1`): se abre al instante con ella mientras renueva en segundo plano, y sigue funcionando
si el fichero falla. Al publicar un `puntos.json` nuevo, cada visitante lo verá en su siguiente visita (se pide con revalidación, `no-cache`).

> Si el `puntos.json` está en **otro dominio** distinto del de la página, ese servidor debe enviar la cabecera
> `Access-Control-Allow-Origin` (CORS) para que el navegador pueda leerlo.

## Panel de administración (`/admin`)

- **Acceso por PIN** definido al compilar con la variable `VITE_ADMIN_PIN` (ver `.env.example`). En desarrollo, si no está
  definida, vale `1234`. **Si no está definida en un build de producción, el panel no se habilita.**
- ⚠️ **Es una barrera de cortesía en el cliente, NO seguridad real.** El PIN viaja dentro del JavaScript que descarga
  cualquiera y el panel no protege ningún dato: simplemente evita cambios accidentales. Por eso:
  - **No se deben guardar datos sensibles** en los puntos (ni datos personales).
  - **`puntos.json` es público por diseño**: cualquiera puede leerlo.
  - Lo que realmente decide qué se publica es quién tiene acceso para subir el fichero `puntos.json` al servidor.
- Para que `/admin` funcione al recargar la página, el servidor debe devolver `index.html` en esa ruta (reescritura SPA).
  Si no es posible, `…/#/admin` funciona sin configurar nada.

**Importar la hoja** (arrastrar o elegir un `.csv`, `.xlsx` o `.xls`):

- Reconoce cabeceras sin importar tildes ni mayúsculas: `nombre`; `tipo`/`categoría`; `dirección`; `código postal`/`cp`/`codigo_postal`/`zip`;
  `ciudad`/`localidad`/`barrio`; `teléfono`; `horario`; `lat`/`latitud`; `lng`/`lon`/`longitud`; `estado`; y, opcionales,
  `id`, `motivo cierre`, `reapertura prevista`. El resto de columnas se ignoran (y se indica cuáles).
- Admite decimales con coma (`12,1364`) o punto, coordenadas con espacios, CSV con `,` `;` o tabulador, y UTF-8 o Windows-1252.
- **Vista previa antes de confirmar**: total de filas, válidas, con aviso y con error, con la lista de problemas por fila
  (falta nombre, coordenadas vacías o fuera de rango, lat/lng intercambiadas…). Una fila sin coordenadas válidas **no se pierde
  en silencio**: se marca como error y se corrige a mano en esa misma pantalla.
- Dos modos: **«Reemplazar todo»** (por defecto, con confirmación explícita) y **«Combinar»** (actualiza por `id`, añade los nuevos, no borra los ausentes).
- En Excel, guardar la columna del código postal como **texto** (si es numérica, Excel pierde los ceros a la izquierda).
- Hojas de prueba: [`public/ejemplo-hoja.csv`](public/ejemplo-hoja.csv) (24 filas válidas) y
  [`public/ejemplo-hoja-con-errores.csv`](public/ejemplo-hoja-con-errores.csv) (coma decimal, coordenadas vacías, ilegibles, fuera de rango, intercambiadas, sin nombre).

## Incrustarlo en la web del ayuntamiento

Subir `dist/embed/buscador-puntos.js` y `dist/puntos.json` al servidor y añadir en la página:

```html
<script src="https://TU-DOMINIO/buscador-puntos.js" defer></script>
<buscador-puntos data-src="https://TU-DOMINIO/puntos.json"></buscador-puntos>
```

Si el gestor de contenidos **filtra scripts**, usar el iframe (subir también `dist/embed/iframe.html`):

```html
<iframe src="https://TU-DOMINIO/iframe.html?src=https://TU-DOMINIO/puntos.json"
        title="Buscador de puntos" width="100%" height="650" style="border:0" loading="lazy"></iframe>
```

(El iframe acepta los parámetros `src`, `tile`, `centro`, `zoom`, `logo` y `atribucion`.)

**Atributos**

| Atributo | Qué hace | Por defecto |
|---|---|---|
| `data-src` | URL del `puntos.json` | `/puntos.json` |
| `data-tile-url` | Plantilla de teselas (`…/{z}/{x}/{y}.png`) | `https://tile.openstreetmap.org/{z}/{x}/{y}.png` |
| `data-atribucion` | Texto de atribución de las teselas (texto plano) | © OpenStreetMap contributors |
| `data-centro` | Centro inicial `lat,lng` (si falta, se encuadran los puntos) | encuadre automático |
| `data-zoom` | Zoom inicial (1–19), junto con `data-centro` | 13 |
| `data-altura` | Altura en pantallas anchas (`600px`, `80vh`…) | `600px` |
| `data-idioma` | Idioma (hoy solo `es`) | `es` |
| `data-logo` | URL de un logo para la cabecera del widget | sin logo |

**Cómo se adapta.** El widget responde al ancho de **su contenedor**, no al de la ventana: con ≥ 720 px de ancho muestra listado
(380 px) y mapa lado a lado; por debajo (incluido un contenedor de 320 px), el mapa arriba y el listado debajo. Funciona
varias veces en la misma página.

**Aislamiento y estilos.** El widget usa *Shadow DOM*: el CSS de la web anfitriona no lo rompe ni el del widget rompe la web.
Solo hereda la tipografía y las variables CSS siguientes, que se pueden definir en cualquier elemento padre:

```css
.mi-contenedor {
  --bp-color-primario: #0b7a3b; /* botones, enlaces, marcadores */
  --bp-color-acento: #f97316;   /* borde del marcador seleccionado, avisos */
  --bp-color-texto: #1f2937;
  --bp-color-fondo: #ffffff;
  --bp-radio: 8px;              /* esquinas */
  --bp-fuente: inherit;         /* por defecto hereda la tipografía de la web */
}
```

## Marca (colores y logo)

Aún no hay logo ni colores del cliente: se usan valores provisionales neutros (primario `#0F6CBD`, acento `#F59E0B`).
**Se cambian en un único archivo: [`src/config/marca.ts`](src/config/marca.ts)** (y, sin recompilar, con las variables
`--bp-*` de arriba). El logo es opcional (`data-logo`); no se ha inventado ninguno.

## Teselas de OpenStreetMap

Se usan las teselas públicas de OpenStreetMap con su atribución obligatoria. Su [política de uso](https://operations.osmfoundation.org/policies/tiles/)
es para uso moderado: **para un uso intensivo, OSM recomienda un proveedor de teselas propio o de pago**. Basta con apuntar `data-tile-url`
al proveedor (y, si lo exige, `data-atribucion`). Privacidad: al cargar el mapa, el navegador pide las teselas a ese servidor (que ve la IP
del visitante); la ubicación de «Cerca de mí» se usa solo en el navegador y no se envía a ningún sitio.

## Estructura

```
src/
  components/   BuscadorPuntos, Mapa(+Diferido), Listado, FichaPunto, Filtros, CajaBusqueda, admin/*
  lib/          geo (Haversine), busqueda, directions, importar, edicion, esquema (zod), almacenamiento, marcadores, opciones
  config/marca.ts
  embed/main.ts           registra <buscador-puntos>
  pages/        Publico.tsx, Admin.tsx
public/         puntos.json, ejemplo-hoja.csv, ejemplo-hoja-con-errores.csv   (DEMO)
demo/pagina-anfitriona.html   embed-static/iframe.html   scripts/
docs/           rendimiento.md, aceptacion.md        DECISIONES.md
```

## Más documentación

- [`DECISIONES.md`](DECISIONES.md): decisiones tomadas donde el encargo no definía un valor, por fase.
- [`docs/rendimiento.md`](docs/rendimiento.md): tamaños, Lighthouse y tiempo hasta mapa interactivo en 4G lento.
- [`docs/aceptacion.md`](docs/aceptacion.md): criterios de aceptación uno a uno, con su evidencia.
