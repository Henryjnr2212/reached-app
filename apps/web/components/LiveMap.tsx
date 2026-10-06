'use client';

import 'leaflet/dist/leaflet.css';
import { useEffect, useRef, useState } from 'react';
import type * as Leaflet from 'leaflet';
import type { Map as LeafletMap, LayerGroup } from 'leaflet';

export interface MapPoint {
  id: string;
  lat: number;
  lng: number;
  label: string;
  tone?: 'normal' | 'danger' | 'muted';
}

interface Props {
  points: MapPoint[];
  /** Accessible description of what the map shows. */
  label: string;
  height?: number;
}

export function mapsLink(lat: number, lng: number): string {
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
}

/**
 * OpenStreetMap map via Leaflet, loaded only in the browser. If tiles can't
 * load (offline, blocked), a static card with the coordinates is shown instead.
 */
export function LiveMap({ points, label, height = 300 }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<LeafletMap | null>(null);
  const layer = useRef<LayerGroup | null>(null);
  const leaflet = useRef<typeof Leaflet | null>(null);
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);
  const fitted = useRef(false);

  // Create the map once.
  useEffect(() => {
    let cancelled = false;
    let loadedAny = false;
    let errors = 0;
    import('leaflet')
      .then((mod) => {
        const L = (mod as { default?: typeof Leaflet }).default ?? mod;
        if (cancelled || !el.current || map.current) return;
        leaflet.current = L;
        const m = L.map(el.current, { zoomControl: false, attributionControl: true, scrollWheelZoom: false });
        L.control.zoom({ position: 'bottomright' }).addTo(m);
        const tiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        });
        tiles.on('tileload', () => {
          loadedAny = true;
        });
        tiles.on('tileerror', () => {
          errors += 1;
          if (!loadedAny && errors >= 2) setFailed(true);
        });
        tiles.addTo(m);
        layer.current = L.layerGroup().addTo(m);
        map.current = m;
        setReady(true);
      })
      .catch(() => setFailed(true));
    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
      layer.current = null;
    };
  }, []);

  // Tear Leaflet down once tiles fail so none of its controls linger.
  useEffect(() => {
    if (!failed || !map.current) return;
    map.current.remove();
    map.current = null;
    layer.current = null;
  }, [failed]);

  // Keep markers in sync with the latest points.
  const key = points.map((p) => `${p.id}:${p.lat},${p.lng},${p.tone ?? ''}`).join('|');
  useEffect(() => {
    const L = leaflet.current;
    const m = map.current;
    const group = layer.current;
    if (!ready || !L || !m || !group) return;
    group.clearLayers();
    for (const p of points) {
      const icon = L.divIcon({ className: `reached-pin ${p.tone === 'danger' ? 'danger' : p.tone === 'muted' ? 'muted' : ''}`, iconSize: [22, 22] });
      L.marker([p.lat, p.lng], { icon, title: p.label, alt: p.label, keyboard: false }).addTo(group);
    }
    if (points.length === 1) {
      const only = points[0]!;
      if (fitted.current) m.panTo([only.lat, only.lng]);
      else m.setView([only.lat, only.lng], 15);
    } else if (points.length > 1 && !fitted.current) {
      m.fitBounds(L.latLngBounds(points.map((p) => [p.lat, p.lng] as [number, number])), { padding: [40, 40], maxZoom: 15 });
    } else if (points.length === 0 && !fitted.current) {
      m.setView([5.6037, -0.187], 11); // Accra
    }
    fitted.current = true;
    // `key` stands in for `points` so markers only redraw when positions change.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- key covers points
  }, [ready, key]);

  if (failed) {
    const first = points[0];
    return (
      <div key="fallback" className="map-fallback" style={{ height }} data-testid="map-fallback">
        <span className={`pin ${first?.tone === 'danger' ? 'danger' : ''}`} aria-hidden="true" />
        <p style={{ margin: 0 }}>
          <strong>Map can&apos;t load right now.</strong>
        </p>
        {first ? (
          <span className="coords">
            {first.lat.toFixed(5)}, {first.lng.toFixed(5)}
          </span>
        ) : (
          <span className="small muted">No location yet</span>
        )}
      </div>
    );
  }

  return <div key="map" ref={el} className="map-canvas" style={{ height }} role="region" aria-label={label} data-testid="map" />;
}
