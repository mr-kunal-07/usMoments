import { useEffect, useRef, memo, useCallback } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { TravelLocation } from "@/hooks/useTravelLocations";

// ─── Constants ────────────────────────────────────────────────────────────────

// Default map view: geographic center of India at a zoom that shows the full
// subcontinent. Change these if your users are primarily from another region.
const DEFAULT_CENTER: L.LatLngTuple = [22.5, 82.0];
const DEFAULT_ZOOM = 5;

// ─── Reverse Geocode ──────────────────────────────────────────────────────────

export interface ReverseGeoResult {
  city: string;
  country: string;
  /** Short name to pre-fill the "place name" field */
  display: string;
}

async function reverseGeocode(
  lat: number,
  lng: number,
  signal?: AbortSignal,
): Promise<ReverseGeoResult | undefined> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`,
      {
        headers: { "Accept-Language": "en", "User-Agent": "usMoment-App/1.0" },
        signal,
      },
    );
    const data = await res.json();
    if (!data?.address) return undefined;
    const a = data.address;
    return {
      city: a.city || a.town || a.village || a.county || a.state || "",
      country: a.country || "",
      display: a.neighbourhood || a.suburb || a.quarter || a.amenity ||
        a.city || a.town || a.village || a.county || "",
    };
  } catch {
    // AbortError is expected on rapid clicks — swallow silently
    return undefined;
  }
}

// ─── GPS Locate Control ───────────────────────────────────────────────────────

function makeLocateControl(onLocate: () => void): L.Control {
  const Ctrl = L.Control.extend({
    onAdd() {
      const btn = L.DomUtil.create("button", "");
      btn.setAttribute("aria-label", "Jump to my location");
      btn.setAttribute("title", "My location");
      btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/><circle cx="12" cy="12" r="8" stroke-opacity="0.2"/></svg>`;
      Object.assign(btn.style, {
        width: "34px", height: "34px",
        display: "flex", alignItems: "center", justifyContent: "center",
        background: "white", border: "2px solid rgba(0,0,0,0.2)",
        borderRadius: "6px", cursor: "pointer", color: "#374151",
        boxShadow: "0 1px 5px rgba(0,0,0,0.15)", outline: "none",
        transition: "background 0.12s, color 0.12s",
        marginBottom: "4px",
      });
      btn.onmouseover = () => { btn.style.background = "#eff6ff"; btn.style.color = "#2563eb"; };
      btn.onmouseout = () => { btn.style.background = "white"; btn.style.color = "#374151"; };
      L.DomEvent.on(btn, "click", L.DomEvent.stopPropagation);
      L.DomEvent.on(btn, "click", onLocate);
      return btn;
    },
    onRemove() { },
  });
  return new Ctrl({ position: "bottomright" });
}

function makeUserDot(): L.DivIcon {
  return L.divIcon({
    html: `<div style="width:16px;height:16px;border-radius:50%;background:#3b82f6;border:3px solid white;box-shadow:0 0 0 4px rgba(59,130,246,0.28)"></div>`,
    className: "",
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });
}

// ─── Pin HTML ─────────────────────────────────────────────────────────────────

const PIN_CONFIG = {
  normal: { size: 32, border: 2.5, fontSize: 13 },
  selected: { size: 40, border: 3, fontSize: 16 },
} as const;

function buildPinHtml(visited: boolean, variant: "normal" | "selected"): string {
  const color = visited
    ? variant === "selected" ? "#16a34a" : "#22c55e"
    : variant === "selected" ? "#db2777" : "#ec4899";
  const symbol = visited ? "✓" : "♥";
  const cfg = PIN_CONFIG[variant];
  const outer = cfg.size + 4;
  const sel = variant === "selected";
  return (
    `<div style="width:${outer}px;height:${outer + 8}px;display:flex;flex-direction:column;` +
    `align-items:center;filter:drop-shadow(0 ${sel ? "4px 16px" : "3px 8px"} ${color}${sel ? "cc" : "88"})">` +
    `<div style="width:${cfg.size}px;height:${cfg.size}px;border-radius:50% 50% 50% 0;` +
    `transform:rotate(-45deg);background:${color};display:flex;align-items:center;` +
    `justify-content:center;border:${cfg.border}px solid white;` +
    `box-shadow:0 ${sel ? "4px 16px" : "2px 8px"} rgba(0,0,0,${sel ? "0.25" : "0.18"})">` +
    `<span style="transform:rotate(45deg);font-size:${cfg.fontSize}px;color:white;font-weight:700">${symbol}</span>` +
    `</div></div>`
  );
}

function makeDivIcon(visited: boolean, variant: "normal" | "selected"): L.DivIcon {
  const sel = variant === "selected";
  const w = sel ? 44 : 36, h = sel ? 52 : 42;
  return L.divIcon({
    html: buildPinHtml(visited, variant),
    className: "",
    iconSize: [w, h],
    iconAnchor: [w / 2, h],
    popupAnchor: [0, -(h + 2)],
  });
}

function buildTooltipHtml(loc: TravelLocation): string {
  const sub = loc.city
    ? `<br><span style="font-weight:400;font-size:10px;color:#64748b">${loc.city}${loc.country ? `, ${loc.country}` : ""}</span>`
    : "";
  return (
    `<div style="background:white;border:1.5px solid #e2e8f0;color:#1e293b;padding:5px 10px;` +
    `border-radius:8px;font-size:12px;font-weight:600;box-shadow:0 2px 8px rgba(0,0,0,0.12)">` +
    `${loc.visited ? "✅" : "📍"} ${loc.location_name}${sub}</div>`
  );
}

// Unbind and rebind a marker's tooltip so it always reflects current data.
function refreshTooltip(marker: L.Marker, loc: TravelLocation): void {
  marker.unbindTooltip();
  marker.bindTooltip(buildTooltipHtml(loc), {
    permanent: false,
    direction: "top",
    offset: [0, -8],
    opacity: 1,
  });
}

// ─── Session position persistence ────────────────────────────────────────────

const SESSION_KEY = "travel_map_pos";

function loadSavedPos(): { lat: number; lng: number; zoom: number } | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function savePos(map: L.Map): void {
  try {
    const c = map.getCenter();
    sessionStorage.setItem(
      SESSION_KEY,
      JSON.stringify({ lat: c.lat, lng: c.lng, zoom: map.getZoom() }),
    );
  } catch { /* storage unavailable */ }
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  locations: TravelLocation[];
  /** Fired immediately on click with coords, then again once reverse-geocode resolves with geo */
  onMapClick: (lat: number, lng: number, geo?: ReverseGeoResult) => void;
  onPinClick: (location: TravelLocation) => void;
  focusLocation: TravelLocation | null;
  /** Notifies parent while GPS locate is in progress */
  onLocating?: (loading: boolean) => void;
}

// ─── TravelMapCanvas ──────────────────────────────────────────────────────────

export const TravelMapCanvas = memo(function TravelMapCanvas({
  locations,
  onMapClick,
  onPinClick,
  focusLocation,
  onLocating,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Map<string, L.Marker>>(new Map());
  const fenceRef = useRef<Map<string, L.Circle>>(new Map());
  const polylineRef = useRef<L.Polyline | null>(null);
  const userMarkerRef = useRef<L.Marker | null>(null);

  // FIX: abort controller for in-flight geocode requests — prevents out-of-order
  // results from overwriting a newer click's coordinates.
  const geoAbortRef = useRef<AbortController | null>(null);

  // Stable callback refs — prevents Leaflet from re-binding event listeners on
  // every React render cycle.
  const onMapClickRef = useRef(onMapClick);
  const onPinClickRef = useRef(onPinClick);
  const onLocatingRef = useRef(onLocating);
  useEffect(() => { onMapClickRef.current = onMapClick; }, [onMapClick]);
  useEffect(() => { onPinClickRef.current = onPinClick; }, [onPinClick]);
  useEffect(() => { onLocatingRef.current = onLocating; }, [onLocating]);

  // ── GPS locate ──────────────────────────────────────────────────────────────

  const handleLocate = useCallback(() => {
    const map = mapRef.current;
    if (!map || !("geolocation" in navigator)) return;

    onLocatingRef.current?.(true);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        onLocatingRef.current?.(false);
        map.flyTo([lat, lng], 14, { duration: 1.1 });

        if (userMarkerRef.current) {
          userMarkerRef.current.setLatLng([lat, lng]);
        } else {
          userMarkerRef.current = L.marker([lat, lng], {
            icon: makeUserDot(),
            zIndexOffset: 1000,
          })
            .addTo(map)
            .bindTooltip(
              '<div style="padding:4px 8px;font-size:11px;font-weight:600;border-radius:6px">📍 You are here</div>',
              { permanent: false, direction: "top", offset: [0, -6], opacity: 1 },
            );
        }
      },
      (err) => {
        onLocatingRef.current?.(false);
        console.warn("Geolocation error:", err.message);
      },
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  }, []);

  // ── Init map once ───────────────────────────────────────────────────────────

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    // FIX: restore last session position so the user returns to where they left
    // off. Falls back to India center (DEFAULT_CENTER / DEFAULT_ZOOM) on first
    // visit or when sessionStorage is unavailable.
    const saved = loadSavedPos();

    const map = L.map(containerRef.current, {
      // FIX: was [20, 10] (Central Africa/Atlantic). Now defaults to India.
      center: saved ? [saved.lat, saved.lng] : DEFAULT_CENTER,
      zoom: saved ? saved.zoom : DEFAULT_ZOOM,
      minZoom: 2,
      maxZoom: 19,
      zoomControl: false,
      attributionControl: true,
      worldCopyJump: true,
    });

    // Persist map position to sessionStorage on every pan/zoom end.
    map.on("moveend", () => savePos(map));

    // Tile layer: CartoDB Voyager
    // ✅ Warm beige land, soft blues for water — romantic, not clinical
    // ✅ Clean labels for every country/city — ideal for a travel memory app
    // ✅ Free tier, no API key, global CDN via {s} subdomains
    // ✅ Retina support via {r} — looks sharp on all mobile screens
    // ✅ Hot-pink/green pins contrast perfectly against the muted palette
    L.tileLayer(
      "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
      {
        attribution: '&copy; <a href="https://carto.com/">CARTO</a> &copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>',
        subdomains: "abcd",
        maxZoom: 19,
      },
    ).addTo(map);

    L.control.zoom({ position: "bottomright" }).addTo(map);
    makeLocateControl(handleLocate).addTo(map);

    // Click → open modal immediately with raw coords, then enrich asynchronously
    // with reverse-geocode result.
    // FIX: abort any in-flight geocode from a previous click so stale results
    // never overwrite a newer click's coordinates.
    map.on("click", async (e: L.LeafletMouseEvent) => {
      const { lat, lng } = e.latlng;

      // Cancel previous in-flight geocode
      geoAbortRef.current?.abort();
      geoAbortRef.current = new AbortController();
      const { signal } = geoAbortRef.current;

      // Phase 1: open modal immediately with just coordinates
      onMapClickRef.current(lat, lng, undefined);

      // Phase 2: enrich with reverse-geocode in background
      const geo = await reverseGeocode(lat, lng, signal);
      if (geo && !signal.aborted) {
        onMapClickRef.current(lat, lng, geo);
      }
    });

    mapRef.current = map;
    const markers = markersRef.current;
    const fences = fenceRef.current;

    return () => {
      geoAbortRef.current?.abort();
      map.remove();
      mapRef.current = null;
      userMarkerRef.current = null;
      markers.clear();
      fences.clear();
      polylineRef.current = null;
    };
  }, [handleLocate]);

  // ── Sync markers + polyline ─────────────────────────────────────────────────

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const locMap = new Map(locations.map(l => [l.id, l]));

    // Remove markers for deleted locations
    markersRef.current.forEach((m, id) => {
      if (!locMap.has(id)) { m.remove(); markersRef.current.delete(id); }
    });
    // Remove fences for deleted locations
    fenceRef.current.forEach((f, id) => {
      if (!locMap.has(id)) { f.remove(); fenceRef.current.delete(id); }
    });

    locations.forEach(loc => {
      const isFocused = focusLocation?.id === loc.id;
      const icon = makeDivIcon(loc.visited ?? false, isFocused ? "selected" : "normal");
      const existing = markersRef.current.get(loc.id);

      if (existing) {
        existing.setIcon(icon);
        // FIX: also refresh tooltip so updated city/visited state is reflected,
        // not just the icon. Previously the tooltip was only set on creation.
        refreshTooltip(existing, loc);
        return;
      }

      const marker = L.marker([loc.latitude, loc.longitude], { icon })
        .addTo(map)
        .on("click", (e) => {
          L.DomEvent.stopPropagation(e);
          onPinClickRef.current(loc);
        });

      refreshTooltip(marker, loc);
      markersRef.current.set(loc.id, marker);
    });

    // Sync geofences for visited locations
    const fences = fenceRef.current;
    locations.forEach(loc => {
      const existing = fences.get(loc.id);
      if (!loc.visited) {
        if (existing) { existing.remove(); fences.delete(loc.id); }
        return;
      }

      const center: L.LatLngTuple = [loc.latitude, loc.longitude];
      if (existing) {
        existing.setLatLng(center);
        return;
      }

      const fence = L.circle(center, {
        radius: 300,
        color: "#86efac",
        fillColor: "#86efac",
        fillOpacity: 0.18,
        weight: 1.5,
      }).addTo(map);
      fences.set(loc.id, fence);
    });

    // Rebuild the dashed visited-path polyline.
    // FIX: previously rebuilt unconditionally on every locations change.
    // Now we only touch the polyline when there is something to draw.
    polylineRef.current?.remove();
    polylineRef.current = null;

    const visited = locations
      .filter(l => l.visited && l.date_visited)
      .sort((a, b) => (a.date_visited ?? "").localeCompare(b.date_visited ?? ""));

    if (visited.length >= 2) {
      polylineRef.current = L.polyline(
        visited.map(l => [l.latitude, l.longitude] as [number, number]),
        { color: "#22c55e", weight: 2.5, opacity: 0.55, dashArray: "7 9", lineCap: "round" },
      ).addTo(map);
    }
  }, [locations, focusLocation]);

  // ── Focus fly-to ─────────────────────────────────────────────────────────────

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (!focusLocation) {
      // Reset all pins to normal when selection is cleared
      markersRef.current.forEach((marker, id) => {
        const loc = locations.find(l => l.id === id);
        if (loc) marker.setIcon(makeDivIcon(loc.visited ?? false, "normal"));
      });
      return;
    }

    map.flyTo([focusLocation.latitude, focusLocation.longitude], 13, { duration: 0.9 });

    // FIX: set the focused pin to "selected" here.
    // The marker sync effect above also sets icons, but we do it here too so
    // the selection highlight appears immediately (before the sync effect runs).
    markersRef.current
      .get(focusLocation.id)
      ?.setIcon(makeDivIcon(focusLocation.visited ?? false, "selected"));
    const markers = markersRef.current;

    return () => {
      // Reset to normal on cleanup — this fires before the next focusLocation
      // effect run, so the previously-selected pin always returns to normal.
      markers
        .get(focusLocation.id)
        ?.setIcon(makeDivIcon(focusLocation.visited ?? false, "normal"));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusLocation]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full"
      style={{ cursor: "crosshair", minHeight: 300 }}
      aria-label="Travel map — click anywhere to pin a memory"
      role="application"
    />
  );
});

export default TravelMapCanvas;
