"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { LatLng, ChargingStop, ChargerStation } from "@/lib/types";
import { UnitSystem, formatDistance } from "@/lib/units";
import { Theme } from "./TripPlanner";

export interface ChargerFilters {
  showSuperchargers: boolean;
  showOtherChargers: boolean;
  hideUnusedChargers: boolean;
}

interface TripMapProps {
  route: LatLng[] | null;
  origin: LatLng | null;
  destination: LatLng | null;
  chargingStops: ChargingStop[];
  nearbyChargers: ChargerStation[];
  units: UnitSystem;
  filters: ChargerFilters;
  theme: Theme;
  focusPoint?: { center: LatLng; zoom: number } | null;
  showTraffic?: boolean;
  highlightedChargerId?: string | null;
  swappingStopIndex?: number | null;
  onMapSwapCharger?: (station: ChargerStation) => void;
}

const CHARGER_ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><path d="M5 18H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h3.19M15 6h2a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-3.19"/><line x1="23" y1="13" x2="23" y2="11"/><polyline points="11 6 7 12 13 12 9 18"/></svg>`;

const SMALL_CHARGER_ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="10" height="10"><polyline points="11 6 7 12 13 12 9 18"/></svg>`;

function createIcon(color: string, size: number, html: string, pulse = false) {
  const pulseRing = pulse
    ? `<div style="
        position:absolute;
        top:50%;left:50%;
        width:${size + 16}px;height:${size + 16}px;
        margin-left:-${(size + 16) / 2}px;margin-top:-${(size + 16) / 2}px;
        border-radius:50%;
        border:2px solid ${color};
        opacity:0;
        animation:charger-ping 2s cubic-bezier(0,0,0.2,1) infinite;
      "></div>
      <div style="
        position:absolute;
        top:50%;left:50%;
        width:${size + 8}px;height:${size + 8}px;
        margin-left:-${(size + 8) / 2}px;margin-top:-${(size + 8) / 2}px;
        border-radius:50%;
        background:${color};
        opacity:0.15;
        animation:charger-glow 2s ease-in-out infinite;
      "></div>`
    : "";

  const totalSize = pulse ? size + 20 : size;
  return L.divIcon({
    className: "custom-marker",
    html: `<div style="position:relative;width:${totalSize}px;height:${totalSize}px;display:flex;align-items:center;justify-content:center;">
      ${pulseRing}
      <div style="
        width:${size}px;height:${size}px;
        background:${color};
        border-radius:50%;
        border:${size > 20 ? 3 : 2}px solid white;
        box-shadow:0 2px 8px rgba(0,0,0,0.4);
        display:flex;align-items:center;justify-content:center;
        position:relative;z-index:1;
      ">${html}</div>
    </div>`,
    iconSize: [totalSize, totalSize],
    iconAnchor: [totalSize / 2, totalSize / 2],
  });
}

const TILE_URLS = {
  dark: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
  light: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
};

const TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>';

export default function TripMap({
  route,
  origin,
  destination,
  chargingStops,
  nearbyChargers,
  units,
  filters,
  theme,
  focusPoint,
  showTraffic = false,
  highlightedChargerId,
  swappingStopIndex,
  onMapSwapCharger,
}: TripMapProps) {
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const routeLayerRef = useRef<L.Polyline | null>(null);
  const glowLayerRef = useRef<L.Polyline | null>(null);
  const markersRef = useRef<L.LayerGroup | null>(null);
  const chargerMarkersRef = useRef<L.LayerGroup | null>(null);
  const highlightMarkerRef = useRef<L.Marker | null>(null);
  const swapCallbackRef = useRef<{ index: number | null; callback: ((s: ChargerStation) => void) | undefined }>({ index: null, callback: undefined });
  swapCallbackRef.current = { index: swappingStopIndex ?? null, callback: onMapSwapCharger };
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const trafficLayerRef = useRef<L.TileLayer | null>(null);

  // Initialize map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [40.7128, -74.006],
      zoom: 11,
      zoomControl: false,
    });

    L.control.zoom({ position: "bottomright" }).addTo(map);

    mapRef.current = map;
    markersRef.current = L.layerGroup().addTo(map);
    chargerMarkersRef.current = L.layerGroup().addTo(map);

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Tile layer (theme-aware)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
    }

    tileLayerRef.current = L.tileLayer(TILE_URLS[theme], {
      attribution: TILE_ATTRIBUTION,
      maxZoom: 19,
    }).addTo(map);
  }, [theme]);

  // Traffic tile overlay
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (trafficLayerRef.current) {
      map.removeLayer(trafficLayerRef.current);
      trafficLayerRef.current = null;
    }

    const apiKey = process.env.NEXT_PUBLIC_TOMTOM_API_KEY;
    if (!showTraffic || !apiKey) return;

    trafficLayerRef.current = L.tileLayer(
      `https://api.tomtom.com/traffic/map/4/tile/flow/relative0/{z}/{x}/{y}.png?tileSize=256&key=${apiKey}`,
      {
        opacity: theme === "dark" ? 0.7 : 0.6,
        zIndex: 2,
        maxZoom: 19,
      }
    ).addTo(map);
  }, [showTraffic, theme]);

  // Fly to focusPoint when it changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !focusPoint) return;
    map.flyTo([focusPoint.center.lat, focusPoint.center.lng], focusPoint.zoom, {
      duration: 1.2,
    });
  }, [focusPoint]);

  // Effect 1: Route polyline drawing
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (routeLayerRef.current) {
      map.removeLayer(routeLayerRef.current);
      routeLayerRef.current = null;
    }
    if (glowLayerRef.current) {
      map.removeLayer(glowLayerRef.current);
      glowLayerRef.current = null;
    }

    if (!route || route.length === 0) return;

    const routeCoords: L.LatLngExpression[] = route.map((p) => [
      p.lat,
      p.lng,
    ]);

    glowLayerRef.current = L.polyline(routeCoords, {
      color: "#e31937",
      weight: 8,
      opacity: 0.3,
    }).addTo(map);

    routeLayerRef.current = L.polyline(routeCoords, {
      color: "#e31937",
      weight: 4,
      opacity: 0.9,
    }).addTo(map);
  }, [route]);

  // Effect 2: Markers (origin, destination, charging stops) + fitBounds
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (markersRef.current) {
      markersRef.current.clearLayers();
    }

    const hasOrigin = !!origin;
    const hasDest = !!destination;
    const hasRoute = route && route.length > 0;

    if (!hasOrigin && !hasDest && !hasRoute && chargingStops.length === 0) return;

    // Origin marker
    if (origin) {
      const originMarker = L.marker([origin.lat, origin.lng], {
        icon: createIcon(
          "#22c55e",
          32,
          '<div style="color:white;font-size:14px;font-weight:bold">A</div>'
        ),
      });
      originMarker.bindPopup(
        '<div style="font-weight:600;color:var(--secondary-fg)">Start</div>'
      );
      markersRef.current?.addLayer(originMarker);
    }

    // Destination marker
    if (destination) {
      const destMarker = L.marker([destination.lat, destination.lng], {
        icon: createIcon(
          "#ef4444",
          32,
          '<div style="color:white;font-size:14px;font-weight:bold">B</div>'
        ),
      });
      destMarker.bindPopup(
        '<div style="font-weight:600;color:var(--secondary-fg)">Destination</div>'
      );
      markersRef.current?.addLayer(destMarker);
    }

    // Charging stop markers (planned stops — with pulse animation)
    chargingStops.forEach((stop, idx) => {
      const marker = L.marker(
        [stop.station.location.lat, stop.station.location.lng],
        {
          icon: createIcon("#e31937", 28, CHARGER_ICON, true),
          zIndexOffset: 1000,
        }
      );
      marker.bindPopup(`
        <div style="min-width:180px;font-family:system-ui">
          <div style="font-weight:700;font-size:13px;color:var(--secondary-fg);margin-bottom:4px">
            Stop ${idx + 1}: ${stop.station.name}
          </div>
          <div style="font-size:12px;color:var(--muted-fg);margin-bottom:6px">${stop.station.address}</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;font-size:11px">
            <div><span style="color:var(--faint-fg)">Arrive:</span> <strong style="color:var(--secondary-fg)">${stop.arrivalCharge}%</strong></div>
            <div><span style="color:var(--faint-fg)">Depart:</span> <strong style="color:var(--secondary-fg)">${stop.departureCharge}%</strong></div>
            <div><span style="color:var(--faint-fg)">Charge:</span> <strong style="color:var(--secondary-fg)">${stop.chargeTime} min</strong></div>
            <div><span style="color:var(--faint-fg)">Distance:</span> <strong style="color:var(--secondary-fg)">${formatDistance(stop.distanceFromStart, units)}</strong></div>
          </div>${stop.station.locationId ? `
          <a href="https://www.tesla.com/findus/location/supercharger/${stop.station.locationId}" target="_blank" rel="noopener noreferrer"
            style="display:inline-flex;align-items:center;gap:4px;margin-top:8px;padding:4px 10px;background:#e31937;color:white;border-radius:6px;font-size:11px;font-weight:600;text-decoration:none">
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
            View on Tesla.com
          </a>` : ''}
        </div>
      `);
      markersRef.current?.addLayer(marker);
    });

    // Fit bounds
    if (hasRoute) {
      const routeCoords: L.LatLngExpression[] = route!.map((p) => [p.lat, p.lng]);
      const bounds = L.latLngBounds(routeCoords);
      map.fitBounds(bounds, { padding: [120, 50] });
    } else {
      // No route (loaded saved trip) — fit to markers
      const points: L.LatLngExpression[] = [];
      if (origin) points.push([origin.lat, origin.lng]);
      if (destination) points.push([destination.lat, destination.lng]);
      chargingStops.forEach((s) =>
        points.push([s.station.location.lat, s.station.location.lng])
      );
      if (points.length >= 2) {
        const bounds = L.latLngBounds(points);
        map.fitBounds(bounds, { padding: [120, 50] });
      } else if (points.length === 1) {
        map.setView(points[0], 12);
      }
    }
  }, [route, origin, destination, chargingStops, units]);

  // Update nearby charger markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !chargerMarkersRef.current) return;

    chargerMarkersRef.current.clearLayers();

    if (filters.hideUnusedChargers) return;

    const plannedIds = new Set(chargingStops.map((s) => s.station.id));
    const isSwapping = swappingStopIndex != null;

    nearbyChargers.forEach((charger) => {
      if (plannedIds.has(charger.id)) return;

      const isTesla = charger.network?.toLowerCase().includes("tesla");

      if (isTesla && !filters.showSuperchargers) return;
      if (!isTesla && !filters.showOtherChargers) return;

      const color = isTesla ? "#e31937" : "#6366f1";
      const markerSize = isSwapping ? 24 : 18;
      const markerIcon = isSwapping ? CHARGER_ICON : SMALL_CHARGER_ICON;
      const marker = L.marker(
        [charger.location.lat, charger.location.lng],
        {
          icon: createIcon(
            isSwapping ? color : color + "99",
            markerSize,
            markerIcon
          ),
          zIndexOffset: isSwapping ? 500 : 100,
        }
      );
      if (isSwapping) {
        marker.on("click", () => {
          const ref = swapCallbackRef.current;
          if (ref.index != null && ref.callback) {
            ref.callback(charger);
          }
        });
        marker.bindTooltip(
          `<div style="font-family:system-ui;font-size:11px;font-weight:600">${charger.name}</div>
           <div style="font-family:system-ui;font-size:10px;color:#888">${charger.numStalls} stalls · ${charger.power} kW</div>`,
          { direction: "top", offset: [0, -8] }
        );
      } else {
        marker.bindPopup(`
          <div style="min-width:160px;font-family:system-ui">
            <div style="font-weight:700;font-size:12px;color:var(--secondary-fg);margin-bottom:3px">
              ${charger.name}
            </div>
            <div style="font-size:11px;color:var(--muted-fg);margin-bottom:4px">${charger.address}</div>
            <div style="font-size:11px;color:var(--faint-fg)">
              ${charger.numStalls} stalls · ${charger.power} kW · ${charger.network}
            </div>${charger.locationId ? `
            <a href="https://www.tesla.com/findus/location/supercharger/${charger.locationId}" target="_blank" rel="noopener noreferrer"
              style="display:inline-flex;align-items:center;gap:4px;margin-top:6px;padding:3px 8px;background:#e31937;color:white;border-radius:5px;font-size:10px;font-weight:600;text-decoration:none">
              <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
              View on Tesla.com
            </a>` : ''}
          </div>
        `);
      }
      chargerMarkersRef.current?.addLayer(marker);
    });
  }, [nearbyChargers, chargingStops, units, filters, swappingStopIndex]);

  // Highlighted charger marker (swap preview)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (highlightMarkerRef.current) {
      map.removeLayer(highlightMarkerRef.current);
      highlightMarkerRef.current = null;
    }

    if (!highlightedChargerId) return;

    const charger = nearbyChargers.find((c) => c.id === highlightedChargerId);
    if (!charger) return;

    const isTesla = charger.network?.toLowerCase().includes("tesla");
    const color = isTesla ? "#e31937" : "#6366f1";

    highlightMarkerRef.current = L.marker(
      [charger.location.lat, charger.location.lng],
      {
        icon: createIcon(color, 36, CHARGER_ICON, true),
        zIndexOffset: 2000,
      }
    );
    highlightMarkerRef.current.addTo(map);
  }, [highlightedChargerId, nearbyChargers]);

  return (
    <div ref={mapContainerRef} className="w-full h-full" />
  );
}
