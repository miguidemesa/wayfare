"use client";

import { useEffect, useState } from "react";
import {
  MapPin,
  Navigation,
  Save,
  Search,
  Sparkles,
  Star,
} from "lucide-react";
import type { TripBundle } from "@/lib/trip-service";
import { Badge, Button, Card, EmptyState, Input, Select, toast } from "@/components/ui";
import { api } from "@/lib/client-api";
import { POIS } from "@/lib/data/pois";

const CATEGORIES = ["RESTAURANT", "ATTRACTION", "CAFE", "BAR", "SHOPPING", "ESSENTIAL", "PARK", "MUSEUM", "TEMPLE", "OTHER"] as const;

export function DiscoverClient({ tripId, bundle }: { tripId: string; bundle: TripBundle }) {
  const { savedPlaces, destinations } = bundle;
  const initialCity = destinations[0]?.name || "";
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [city, setCity] = useState(initialCity);
  const [results, setResults] = useState<typeof POIS>([]);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState<Set<string>>(new Set(savedPlaces.map((s) => s.name)));

  const cities = [...new Set(POIS.map((p) => p.city))];

  async function search() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (query) params.set("q", query);
      if (category) params.set("category", category);
      if (city) params.set("city", city);
      params.set("tripId", tripId);
      const data = await api<{ places: typeof POIS }>(`/api/trips/${tripId}/places?${params}`);
      setResults(data.places);
    } catch {
      toast.error("Failed to fetch places");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    search();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function savePlace(place: typeof POIS[number]) {
    setSaved((prev) => new Set(prev).add(place.name));
    try {
      await api(`/api/trips/${tripId}/saved-places`, {
        json: {
          name: place.name,
          category: place.category || "OTHER",
          lat: place.lat || 0,
          lng: place.lng || 0,
          address: place.neighborhood || undefined,
          notes: place.blurb || undefined,
        },
      });
      toast.success(`Saved ${place.name} to places`);
    } catch {
      setSaved((prev) => {
        const next = new Set(prev);
        next.delete(place.name);
        return next;
      });
      toast.error("Failed to save place");
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 pb-24 pt-5 sm:px-6">
      <div className="mb-5 flex items-center justify-between gap-3 animate-fade-up">
        <div>
          <h1 className="font-display text-3xl tracking-tight">Discover nearby</h1>
          <p className="mt-0.5 text-[13px] text-ink-3">
            Search curated places — restaurants, attractions, cafes, and essentials.
          </p>
        </div>
        <Button onClick={search} loading={loading}>
          <Search size={15} /> Search
        </Button>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search places..."
          className="w-full sm:w-64"
        />
        <Select value={category} onChange={(e) => setCategory(e.target.value)} className="w-auto">
          <option value="">All categories</option>
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </Select>
        <Select value={city} onChange={(e) => setCity(e.target.value)} className="w-auto">
          <option value="">All cities</option>
          {cities.map((c) => <option key={c} value={c}>{c}</option>)}
        </Select>
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <div className="aspect-video skeleton" />
              <div className="p-4 space-y-2">
                <div className="skeleton h-4 w-3/4" />
                <div className="skeleton h-3 w-1/2" />
              </div>
            </Card>
          ))}
        </div>
      ) : results.length === 0 ? (
        <EmptyState
          emoji="🔍"
          title={query ? "No matches" : "Start exploring"}
          description={query ? "Try a broader search or different category." : "Search for restaurants, temples, cafes, or essentials near you."}
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {results.map((place) => (
            <Card key={place.id} className="overflow-hidden transition-colors hover:bg-surface-2/60">
              <div className="aspect-video bg-surface-2 flex items-center justify-center">
                <span className="text-4xl">{place.category === "RESTAURANT" ? "🍽️" : place.category === "CAFE" ? "☕" : place.category === "ATTRACTION" ? "📍" : "📌"}</span>
              </div>
              <div className="p-4">
                <div className="flex items-baseline justify-between gap-2">
                  <h3 className="font-semibold truncate">{place.name}</h3>
                  <Badge tone={saved.has(place.name) ? "success" : "neutral"} className="shrink-0">
                    {saved.has(place.name) ? "Saved" : place.category}
                  </Badge>
                </div>
                <p className="mt-1 flex flex-wrap items-center gap-x-3 text-[13px] text-ink-2">
                  <span className="flex items-center gap-1">
                    <MapPin size={11} className="text-accent" />
                    {place.neighborhood}, {place.city}
                  </span>
                  <span className="flex items-center gap-1">
                    <Star size={11} className="text-amber" />
                    {place.rating}★
                  </span>
                  <span>{"¥".repeat(place.priceLevel)}</span>
                </p>
                <p className="mt-2 text-xs text-ink-3">{place.hours}</p>
                <div className="mt-3 flex gap-2">
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&destination=${place.lat},${place.lng}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 rounded-lg border border-line px-2.5 py-1 text-[12px] font-medium transition-colors hover:bg-surface-2"
                  >
                    <Navigation size={11} /> Navigate
                  </a>
                  {!saved.has(place.name) && (
                    <Button variant="secondary" size="sm" onClick={() => savePlace(place)}>
                      <Save size={13} /> Save
                    </Button>
                  )}
                  <a
                    href={`/t/${tripId}/ai?q=${encodeURIComponent(`Tell me about ${place.name}`)}`}
                    className="inline-flex items-center gap-1 rounded-lg border border-line px-2.5 py-1 text-[12px] font-medium transition-colors hover:bg-surface-2"
                  >
                    <Sparkles size={11} /> Ask AI
                  </a>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}