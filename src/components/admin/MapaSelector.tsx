import { useEffect, useRef, useState } from "react";
import type { Map as LMap, Marker } from "leaflet";
import leafletCss from "leaflet/dist/leaflet.css?inline";
import { estiloMarcador, opcionesIcono } from "../../lib/marcadores";
import { CENTRO_POR_DEFECTO, TILE_URL_POR_DEFECTO } from "../../lib/opciones";

type Leaflet = typeof import("leaflet");

interface Props {
  lat: number | null;
  lng: number | null;
  onCambio: (lat: number, lng: number) => void;
}

const redondear = (n: number) => Number(n.toFixed(6));

/** Mini mapa para elegir la ubicación: clic para colocar el marcador y arrastrarlo para afinar. */
export default function MapaSelector({ lat, lng, onCambio }: Props) {
  const lienzo = useRef<HTMLDivElement>(null);
  const [estado, setEstado] = useState<{ L: Leaflet; mapa: LMap } | null>(null);
  const [fallo, setFallo] = useState(false);
  const marcador = useRef<Marker | null>(null);
  const alCambiar = useRef(onCambio);
  useEffect(() => {
    alCambiar.current = onCambio;
  });
  const inicial = useRef({ lat, lng });

  useEffect(() => {
    let cancelado = false;
    let instancia: LMap | undefined;
    (async () => {
      try {
        const modulo = await import("leaflet");
        const L = ("default" in modulo ? modulo.default : modulo) as Leaflet;
        L.noConflict();
        if (cancelado || !lienzo.current) return;
        const { lat: la, lng: lo } = inicial.current;
        const centro = la !== null && lo !== null ? { lat: la, lng: lo } : CENTRO_POR_DEFECTO;
        const mapa = L.map(lienzo.current).setView([centro.lat, centro.lng], la !== null ? 16 : 13);
        L.tileLayer(TILE_URL_POR_DEFECTO, {
          maxZoom: 19,
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        }).addTo(mapa);
        mapa.on("click", (e) => alCambiar.current(redondear(e.latlng.lat), redondear(e.latlng.lng)));
        instancia = mapa;
        setEstado({ L, mapa });
      } catch {
        if (!cancelado) setFallo(true);
      }
    })();
    return () => {
      cancelado = true;
      instancia?.remove();
    };
  }, []);

  // El marcador sigue a los campos numéricos (y viceversa).
  useEffect(() => {
    if (!estado) return;
    const { L, mapa } = estado;
    if (lat === null || lng === null) {
      marcador.current?.remove();
      marcador.current = null;
      return;
    }
    if (!marcador.current) {
      const e = estiloMarcador({ estado: "abierto" }, true);
      const m = L.marker([lat, lng], {
        draggable: true,
        keyboard: true,
        title: "Ubicación del punto: arrástrala para ajustarla",
        icon: L.divIcon(opcionesIcono(e)),
      }).addTo(mapa);
      m.on("dragend", () => {
        const p = m.getLatLng();
        alCambiar.current(redondear(p.lat), redondear(p.lng));
      });
      marcador.current = m;
    } else {
      marcador.current.setLatLng([lat, lng]);
    }
    if (!mapa.getBounds().contains([lat, lng])) mapa.panTo([lat, lng]);
  }, [estado, lat, lng]);

  if (fallo) {
    return <p className="bp-aviso">El mapa no está disponible ahora. Puedes escribir la latitud y la longitud a mano.</p>;
  }
  return (
    <div className="bp-mapa-selector relative h-60 w-full overflow-hidden rounded-bp bg-gray-200">
      <style>{leafletCss}</style>
      <div ref={lienzo} className="absolute inset-0" role="region" aria-label="Mapa para elegir la ubicación" />
    </div>
  );
}
