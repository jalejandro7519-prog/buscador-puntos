import { useEffect, useRef, useState } from "react";
import type { LayerGroup, Map as LMap, Marker } from "leaflet";
import leafletCss from "leaflet/dist/leaflet.css?inline";
import type { Plataforma } from "../lib/directions";
import type { Punto } from "../lib/esquema";
import type { Coord, PuntoConDistancia } from "../lib/geo";
import { estiloMarcador, svgGrupo, svgMarcador } from "../lib/marcadores";
import { CENTRO_POR_DEFECTO, UMBRAL_AGRUPACION, ZOOM_SIN_AGRUPAR } from "../lib/opciones";
import { reducirMovimiento } from "../lib/utiles";
import { crearPopupDom } from "./popupDom";

type Leaflet = typeof import("leaflet");

export interface PropsMapa {
  /** Los puntos de la lista filtrada: el mapa muestra exactamente estos. */
  puntos: PuntoConDistancia[];
  seleccionadoId: string | null;
  onSeleccionar: (id: string) => void;
  tileUrl: string;
  atribucion: string;
  centro?: Coord;
  zoom?: number;
  plataforma: Plataforma;
  onListo: () => void;
  onFallo: (error: unknown) => void;
}

export default function Mapa(props: PropsMapa) {
  const lienzo = useRef<HTMLDivElement>(null);
  const [L, setL] = useState<Leaflet | null>(null);
  const [mapa, setMapa] = useState<LMap | null>(null);

  // Última versión de las props para los manejadores de Leaflet (que viven más que un render).
  const ultimas = useRef(props);
  useEffect(() => {
    ultimas.current = props;
  });

  const capa = useRef<LayerGroup | null>(null);
  const marcadores = useRef(new Map<string, Marker>());
  const items = useRef(new Map<string, PuntoConDistancia>());
  const seleccionActual = useRef<string | null>(null);
  const pendienteAbrir = useRef<string | null>(null);
  const claveAjuste = useRef<string | null>(null);

  // 1) Crear el mapa (Leaflet se carga aquí, con import() dinámico).
  useEffect(() => {
    let cancelado = false;
    let instancia: LMap | undefined;
    let observador: ResizeObserver | undefined;

    (async () => {
      try {
        const modulo = await import("leaflet");
        const Lf = ("default" in modulo ? modulo.default : modulo) as Leaflet;
        // Leaflet se asigna a window.L al cargar: se devuelve el valor previo para no pisar al anfitrión.
        Lf.noConflict();
        const contenedor = lienzo.current;
        if (cancelado || !contenedor) return;

        const { centro, zoom, tileUrl, atribucion } = ultimas.current;
        const inicial = centro ?? CENTRO_POR_DEFECTO;
        const m = Lf.map(contenedor, { zoomControl: true, worldCopyJump: false }).setView(
          [inicial.lat, inicial.lng],
          zoom ?? 13,
        );
        const teselas = Lf.tileLayer(tileUrl, { attribution: atribucion, maxZoom: 19 }).addTo(m);
        teselas.once("load", () => performance.mark?.("bp:mapa-teselas"));

        if (typeof ResizeObserver !== "undefined") {
          observador = new ResizeObserver(() => m.invalidateSize());
          observador.observe(contenedor);
        }
        instancia = m;
        setL(Lf);
        setMapa(m);
        m.whenReady(() => {
          performance.mark?.("bp:mapa-listo");
          ultimas.current.onListo();
        });
      } catch (error) {
        if (!cancelado) ultimas.current.onFallo(error);
      }
    })();

    return () => {
      cancelado = true;
      observador?.disconnect();
      instancia?.remove();
    };
  }, []);

  // 2) Marcadores = puntos de la lista filtrada (con agrupación diferida si son muchos).
  const { puntos } = props;
  useEffect(() => {
    if (!L || !mapa) return;
    let cancelado = false;
    let quitarZoom: (() => void) | undefined;

    const icono = (p: Punto, seleccionado: boolean) => {
      const e = estiloMarcador(p, seleccionado);
      return L.divIcon({
        html: svgMarcador(e),
        className: "bp-marcador",
        iconSize: [e.tam, e.tam],
        iconAnchor: [e.tam / 2, e.tam / 2],
        popupAnchor: [0, -e.tam / 2],
      });
    };

    items.current = new Map(puntos.map((i) => [i.punto.id, i]));
    const grupoCapa = capa.current ?? (capa.current = L.layerGroup().addTo(mapa));

    (async () => {
      const agrupador = puntos.length > UMBRAL_AGRUPACION ? await import("../lib/agrupar") : null;
      if (cancelado) return;

      const construir = () => {
        grupoCapa.clearLayers();
        marcadores.current.clear();
        const grupos = agrupador
          ? agrupador.agruparPuntos(puntos, mapa.getZoom())
          : puntos.map((i) => ({ lat: i.punto.lat, lng: i.punto.lng, items: [i] }));

        for (const g of grupos) {
          const [unico] = g.items;
          if (g.items.length === 1 && unico) {
            const p = unico.punto;
            const seleccionado = p.id === seleccionActual.current;
            const marcador = L.marker([p.lat, p.lng], {
              icon: icono(p, seleccionado),
              title: p.nombre,
              alt: p.nombre,
              keyboard: true,
              zIndexOffset: seleccionado ? 1000 : p.estado === "cerrado_temporal" ? -100 : 0,
            });
            marcador.bindPopup(() => crearPopupDom(p, unico.distanciaKm, ultimas.current.plataforma), { maxWidth: 280 });
            marcador.on("click", () => ultimas.current.onSeleccionar(p.id));
            marcadores.current.set(p.id, marcador);
            grupoCapa.addLayer(marcador);
          } else {
            const n = g.items.length;
            const cluster = L.marker([g.lat, g.lng], {
              icon: L.divIcon({ html: svgGrupo(n), className: "bp-marcador", iconSize: [40, 40], iconAnchor: [20, 20] }),
              title: `${n} puntos agrupados: pulsa para acercar`,
              keyboard: true,
            });
            cluster.on("click", () => mapa.setView([g.lat, g.lng], Math.min(mapa.getZoom() + 2, ZOOM_SIN_AGRUPAR + 1)));
            grupoCapa.addLayer(cluster);
          }
        }

        // Si la selección estaba esperando a que su marcador apareciera (tras acercar), se abre ahora.
        const pendiente = pendienteAbrir.current;
        const marcadorPendiente = pendiente ? marcadores.current.get(pendiente) : undefined;
        if (pendiente && marcadorPendiente) {
          pendienteAbrir.current = null;
          marcadorPendiente.openPopup();
        }
      };

      construir();

      // Encuadre: solo cuando cambia el conjunto de puntos (no al renovar los mismos datos).
      const clave = puntos.map((i) => i.punto.id).join("|");
      if (clave !== claveAjuste.current) {
        const primera = claveAjuste.current === null;
        claveAjuste.current = clave;
        const { centro } = ultimas.current;
        if (puntos.length > 0 && !(primera && centro)) {
          mapa.invalidateSize();
          mapa.fitBounds(
            L.latLngBounds(puntos.map((i) => [i.punto.lat, i.punto.lng] as [number, number])),
            { padding: [32, 32], maxZoom: 16, animate: !reducirMovimiento() },
          );
        }
      }

      if (agrupador) {
        mapa.on("zoomend", construir);
        quitarZoom = () => mapa.off("zoomend", construir);
      }
    })();

    return () => {
      cancelado = true;
      quitarZoom?.();
    };
  }, [L, mapa, puntos]);

  // 3) Selección desde el listado (o desde un marcador): resalta, centra y abre la ficha.
  const { seleccionadoId } = props;
  useEffect(() => {
    if (!L || !mapa) return;
    const restilar = (id: string | null, seleccionado: boolean) => {
      const marcador = id ? marcadores.current.get(id) : undefined;
      const item = id ? items.current.get(id) : undefined;
      if (!marcador || !item) return;
      const e = estiloMarcador(item.punto, seleccionado);
      marcador.setIcon(
        L.divIcon({
          html: svgMarcador(e),
          className: "bp-marcador",
          iconSize: [e.tam, e.tam],
          iconAnchor: [e.tam / 2, e.tam / 2],
          popupAnchor: [0, -e.tam / 2],
        }),
      );
      marcador.setZIndexOffset(seleccionado ? 1000 : item.punto.estado === "cerrado_temporal" ? -100 : 0);
    };

    const previa = seleccionActual.current;
    if (previa && previa !== seleccionadoId) restilar(previa, false);
    seleccionActual.current = seleccionadoId;
    if (!seleccionadoId) return;

    restilar(seleccionadoId, true);
    const item = items.current.get(seleccionadoId);
    if (!item) return;
    mapa.setView([item.punto.lat, item.punto.lng], Math.max(mapa.getZoom(), 15), { animate: !reducirMovimiento() });
    const marcador = marcadores.current.get(seleccionadoId);
    if (marcador) {
      if (!marcador.isPopupOpen()) marcador.openPopup();
    } else {
      // Estaba agrupado: se acerca y el marcador se abrirá al reconstruir la capa.
      pendienteAbrir.current = seleccionadoId;
      mapa.setView([item.punto.lat, item.punto.lng], Math.max(mapa.getZoom(), ZOOM_SIN_AGRUPAR));
    }
  }, [L, mapa, seleccionadoId]);

  return (
    <>
      <style>{leafletCss}</style>
      <div
        ref={lienzo}
        className="bp-mapa-lienzo"
        role="region"
        aria-label="Mapa de puntos. La lista contiene la misma información en texto."
      />
    </>
  );
}
