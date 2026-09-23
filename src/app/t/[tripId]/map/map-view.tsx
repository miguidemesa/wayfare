"use client";

import { useMemo, useState } from "react";
import { useEffect } from "react";
import type { LeafletMouseEvent } from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  CircleMarker,
  MapContainer,
  Marker,
  Polyline,
  Popup,
  TileLayer,
  Tooltip as LeafletTooltip,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import { Navigation, Save } from "lucide-react";
import type { TripBundle } from "@/lib/trip-service";
import { Badge } from "@/components/ui";
import { cn } from "@/lib/utils";
import { api } from "@/lib/client-api";

type Day = TripBundle["days"][number];
type Item = Day["items"][number];

const TYPE_COLOR: Record<string, string> = {
  FLIGHT: "#34D399",
  HOTEL: "#A78BFA",
  RESTAURANT: "#F59E0B",
  ACTIVITY: "#FB7185",
  TRANSPORT: "#38BDF8",
  RESERVATION: "#7C3AED",
  PERSONAL: "#94A3B8",
};

function emojiFor(item: Item): string {
  switch (item.type) {
    case "FLIGHT": return "✈️";
    case "HOTEL": return "🏨";
    case "RESTAURANT": return "🍽️";
    case "TRANSPORT": return "🚆";
    case "RESERVATION": return "🎟️";
    default: return "📍";
  }
}

function createIcon(emoji: string, color: string, active: boolean) {
  return L.divIcon({
    className: "",
    html: `<div class="wayfare-marker ${active ? "is-active" : ""}" style="border-color:${color}">${emoji}</div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  });
}

function FlyTo({ lat, lng, trigger }: { lat: number; lng: number; trigger: number }) {
  const map = useMap();
  useEffect(() => {
    if (trigger > 0) {
      map.flyTo([lat, lng], Math.max(map.getZoom(), 14), { duration: 0.8 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trigger]);
  return null;
}

export default function MapView({ bundle }: { bundle: TripBundle }) {
  const { trip, days, hotels, savedPlaces } = bundle;

  const geoDays = useMemo(() => days.filter((d) => d.items.some((i) => i.lat != null)), [days]);
  const [dayId, setDayId] = useState<string>(geoDays[0]?.id ?? "");
  const day = geoDays.find((d) => d.id === dayId);
  const [activeItem, setActiveItem] = useState<string | null>(null);
  const [flyTick, setFlyTick] = useState(0);
  const [saved, setSaved] = useState<Set<string>>(new Set(savedPlaces.map((s) => s.name)));

  const points = useMemo(
    () => (day?.items.filter((i) => i.lat != null && i.lng != null) ?? []) as (Item & { lat: number; lng: number })[],
    [day]
  );

  const center: [number, number] =
    points.length > 0
      ? [points[0].lat, points[0].lng]
      : hotels[0]?.lat != null && hotels[0]?.lng != null
        ? [hotels[0].lat, hotels[0].lng]
        : [35.68, 139.69];

  async function savePlace(name: string) {
    setSaved((prev) => new Set(prev).add(name));
    await api(`/api/trips/${trip.id}/saved-places`, { json: { name, category: "OTHER", lat: 0, lng: 0 } }).catch(() => {});
  }

  function onMapClick(_e: LeafletMouseEvent) {
    setActiveItem(null);
  }

  return (
    <div className="relative">
      {/* ------------------------------------------------------ day selector */}
      <div className="absolute left-4 top-4 z-[500] flex max-w-[calc(100%-2rem)] flex-wrap gap-1.5 sm:max-w-md">
        {geoDays.map((d, idx) => (
          <button
            key={d.id}
            onClick={() => setDayId(d.id)}
            className={cn(
              "glass rounded-lg border px-2.5 py-1.5 text-[12px] font-semibold shadow-sm transition-all active:scale-95",
              d.id === dayId ? "border-accent/60 text-accent-strong" : "border-line text-ink-2 hover:text-ink"
            )}
          >
            D{idx + 1}
          </button>
        ))}
      </div>

      <MapContainer
        center={center}
        zoom={13}
        className="h-[calc(100dvh-3.5rem)] min-h-[420px] w-full"
        scrollWheelZoom
        attributionControl={false}
      >
        <TileLayer
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        />

        {/* route polyline */}
        {points.length > 1 && (
          <Polyline
            positions={points.map((p) => [p.lat, p.lng] as [number, number])}
            pathOptions={{ color: "var(--accent)", weight: 3, opacity: 0.55, dashArray: "6 6" }}
          />
        )}

        {/* hotels */}
        {hotels.map(
          (h) =>
            h.lat != null &&
            h.lng != null && (
              <CircleMarker
                key={h.id}
                center={[h.lat, h.lng]}
                radius={9}
                pathOptions={{ color: "#A78BFA", fillColor: "#A78BFA", fillOpacity: 0.85 }}
              >
                <LeafletTooltip direction="top" offset={[0, -8]}>
                  🏨 {h.name} · check-in {new Date(h.checkIn).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </LeafletTooltip>
              </CircleMarker>
            )
        )}

        {/* saved places */}
        {savedPlaces.map(
          (s) =>
            s.lat !== 0 &&
            s.lng !== 0 && (
              <CircleMarker
                key={s.id}
                center={[s.lat, s.lng]}
                radius={5}
                pathOptions={{ color: "#F43F5E", fillColor: "#F43F5E", fillOpacity: 0.9 }}
              >
                <LeafletTooltip>⭐ {s.name}</LeafletTooltip>
              </CircleMarker>
            )
        )}

        {/* itinerary stops */}
        {points.map((p) => (
          <Marker
            key={p.id}
            position={[p.lat, p.lng]}
            icon={createIcon(emojiFor(p), TYPE_COLOR[p.type] ?? "#94A3B8", activeItem === p.id)}
            eventHandlers={{ click: () => setActiveItem(p.id) }}
          >
            <Popup>
              <div className="min-w-44">
                <p className="text-[10px] uppercase tracking-wider" style={{ color: TYPE_COLOR[p.type] }}>
                  {p.type.toLowerCase()} · {p.startTime != null ? fmtClock(p.startTime) : ""}
                </p>
                <p className="mt-0.5 text-[13px] font-semibold">{p.title}</p>
                {p.neighborhood && <p className="text-xs text-ink-3">{p.neighborhood}</p>}
                <div className="mt-2 flex gap-1.5">
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 rounded-lg border border-line px-2 py-1 text-[11px] font-medium transition-colors hover:bg-surface-2"
                  >
                    <Navigation size={11} /> Navigate
                  </a>
                  {!saved.has(p.title) && (
                    <button
                      onClick={() => savePlace(p.title)}
                      className="inline-flex items-center gap-1 rounded-lg border border-line px-2 py-1 text-[11px] font-medium transition-colors hover:bg-surface-2"
                    >
                      <Save size={11} /> Save
                    </button>
                  )}
                  <a
                    href={`/t/${trip.id}/ai?q=${encodeURIComponent(`Tell me about ${p.title}`)}`}
                    className="inline-flex items-center gap-1 rounded-lg border border-line px-2 py-1 text-[11px] font-medium transition-colors hover:bg-surface-2"
                  >
                    ✨ Ask AI
                  </a>
                </div>
              </div>
            </Popup>
          </Marker>
        ))}

        {activeItem && points.find((p) => p.id === activeItem) && (
          <FlyTo
            key={activeItem}
            lat={points.find((p) => p.id === activeItem)!.lat}
            lng={points.find((p) => p.id === activeItem)!.lng}
            trigger={flyTick}
          />
        )}
        <ClickCatcher onClick={onMapClick} />
      </MapContainer>

      {/* ------------------------------------------------------- stop legend */}
      <div className="glass absolute bottom-4 left-4 right-4 z-[500] mx-auto max-w-xl rounded-xl border border-line p-3 shadow-pop sm:left-auto sm:right-4 sm:w-80">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-3">
            {day ? `Day ${geoDays.indexOf(day) + 1} · ${day.city}` : "Trip map"}
          </p>
          <Badge tone="neutral">{points.length} stops</Badge>
        </div>
        <ol className="max-h-36 space-y-1 overflow-y-auto pr-1">
          {points.map((p, i) => (
            <li key={p.id}>
              <button
                onClick={() => {
                  setActiveItem(p.id);
                  setFlyTick((t) => t + 1);
                }}
                className={cn(
                  "flex w-full items-center gap-2 rounded-lg px-2 py-1 text-left text-[12.5px] transition-colors",
                  activeItem === p.id ? "bg-accent-soft/50 text-accent-strong" : "hover:bg-surface-2"
                )}
              >
                <span className="tabular w-4 text-right text-[10px] text-ink-3">{i + 1}</span>
                <span>{emojiFor(p)}</span>
                <span className="min-w-0 flex-1 truncate font-medium">{p.title}</span>
                <span className="tabular text-[10px] text-ink-3">{fmtClock(p.startTime)}</span>
              </button>
            </li>
          ))}
          {points.length === 0 && (
            <li className="py-3 text-center text-xs text-ink-3">No mapped stops this day.</li>
          )}
        </ol>
      </div>
    </div>
  );
}

function ClickCatcher({ onClick }: { onClick: (e: LeafletMouseEvent) => void }) {
  useMapEvents({ click: onClick });
  return null;
}

function fmtClock(minutes: number | null): string {
  if (minutes == null) return "";
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}
