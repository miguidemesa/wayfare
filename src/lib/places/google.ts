// Google Places (the "new" Places API), for cities the curated guide doesn't
// cover. Switched on by GOOGLE_PLACES_API_KEY; everything here returns
// nothing when it's unset, so the app runs on the curated guide alone.
//
// Results are turned into the guide's Poi shape so the planner treats them
// like any other place. Only what Google says is kept: no invented prices
// (avgCost 0), visit lengths from the place type, hours as Google gives them.
//
// Caching: Google's terms allow keeping place IDs indefinitely but limit
// storing other content, so there is no database cache, only a short
// in-memory one that saves repeating identical requests. Check the current
// Maps Platform terms before relying on more.

import type { Poi } from "../data/pois";
import type { PlaceCategory } from "../types";

const BASE = "https://places.googleapis.com/v1";
const CACHE_MS = 30 * 60 * 1000;

// Ask for only what the planner uses: every extra field can move a request
// into a pricier billing tier.
const PLACE_FIELDS = [
  "id",
  "displayName",
  "formattedAddress",
  "location",
  "rating",
  "priceLevel",
  "primaryType",
  "types",
  "regularOpeningHours.weekdayDescriptions",
  "editorialSummary",
  "addressComponents",
];

export function googleEnabled(): boolean {
  return !!process.env.GOOGLE_PLACES_API_KEY;
}

type GooglePlace = {
  id: string;
  displayName?: { text: string };
  formattedAddress?: string;
  location?: { latitude: number; longitude: number };
  rating?: number;
  priceLevel?: string;
  primaryType?: string;
  types?: string[];
  regularOpeningHours?: { weekdayDescriptions?: string[] };
  editorialSummary?: { text: string };
  addressComponents?: { longText: string; types: string[] }[];
};

const cache = new Map<string, { at: number; value: unknown }>();

async function call<T>(path: string, init: { method: "GET" | "POST"; fields: string; body?: unknown }): Promise<T | null> {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) return null;
  const cacheKey = `${init.method} ${path} ${init.fields} ${JSON.stringify(init.body ?? null)}`;
  const hit = cache.get(cacheKey);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.value as T;
  try {
    const res = await fetch(`${BASE}${path}`, {
      method: init.method,
      headers: { "Content-Type": "application/json", "X-Goog-Api-Key": key, "X-Goog-FieldMask": init.fields },
      body: init.body ? JSON.stringify(init.body) : undefined,
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      console.error("[places] google", res.status, (await res.text().catch(() => "")).slice(0, 200));
      return null;
    }
    const value = (await res.json()) as T;
    cache.set(cacheKey, { at: Date.now(), value });
    if (cache.size > 500) cache.delete(cache.keys().next().value!);
    return value;
  } catch (e) {
    console.error("[places] google unreachable", e);
    return null;
  }
}

// ------------------------------------------------------------- mapping

const CATEGORY_BY_TYPE: [string[], PlaceCategory][] = [
  [["restaurant", "meal_takeaway", "food_court", "ramen_restaurant", "sushi_restaurant"], "RESTAURANT"],
  [["cafe", "coffee_shop", "bakery", "tea_house"], "CAFE"],
  [["bar", "night_club", "pub", "wine_bar"], "BAR"],
  [["museum", "art_gallery"], "MUSEUM"],
  [["park", "national_park", "garden", "botanical_garden", "hiking_area", "beach"], "PARK"],
  [["place_of_worship", "church", "hindu_temple", "mosque", "synagogue", "buddhist_temple", "shinto_shrine"], "TEMPLE"],
  [["shopping_mall", "market", "store", "department_store", "clothing_store", "book_store"], "SHOPPING"],
  [["convenience_store", "pharmacy", "supermarket", "atm"], "ESSENTIAL"],
  [["tourist_attraction", "historical_landmark", "monument", "observation_deck", "amusement_park", "zoo", "aquarium", "castle"], "ATTRACTION"],
];

const TAGS_BY_TYPE: [string[], string][] = [
  [["restaurant", "cafe", "bakery", "market", "food_court"], "Food"],
  [["museum", "art_gallery", "performing_arts_theater"], "Culture"],
  [["historical_landmark", "monument", "place_of_worship", "castle", "church", "buddhist_temple", "shinto_shrine"], "History"],
  [["park", "national_park", "garden", "botanical_garden", "hiking_area", "beach"], "Nature"],
  [["shopping_mall", "market", "store", "department_store"], "Shopping"],
  [["bar", "night_club", "pub"], "Nightlife"],
  [["observation_deck", "tourist_attraction"], "Photography"],
  [["amusement_park", "hiking_area", "zoo", "aquarium"], "Adventure"],
  [["spa", "garden"], "Relaxation"],
];

/** A typical visit, by kind of place (Google doesn't say how long people stay). */
const DURATION: Record<PlaceCategory, number> = {
  RESTAURANT: 75,
  CAFE: 40,
  BAR: 90,
  MUSEUM: 105,
  PARK: 75,
  TEMPLE: 60,
  SHOPPING: 60,
  ESSENTIAL: 20,
  ATTRACTION: 75,
  OTHER: 60,
};

const PRICE: Record<string, number> = {
  PRICE_LEVEL_FREE: 0,
  PRICE_LEVEL_INEXPENSIVE: 1,
  PRICE_LEVEL_MODERATE: 2,
  PRICE_LEVEL_EXPENSIVE: 3,
  PRICE_LEVEL_VERY_EXPENSIVE: 4,
};

const DAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/**
 * Google's week of opening hours → the guide's one-line form, which the
 * planner reads: "9 AM–5 PM, closed Mon". The most common hours win.
 */
export function hoursFromGoogle(week: string[] | undefined): string {
  if (!week?.length) return "";
  const clean = week.map((d) => d.replace(/[   ]/g, " ").replace(/:00(?= ?[AP]M)/g, ""));
  const byDay = clean.map((d) => {
    const i = d.indexOf(":");
    return { day: d.slice(0, 3), hours: d.slice(i + 1).trim() };
  });
  if (byDay.every((d) => /24 hours/i.test(d.hours))) return "24 hours";
  const closed = byDay.filter((d) => /closed/i.test(d.hours)).map((d) => d.day);
  const counts = new Map<string, number>();
  for (const d of byDay) if (!/closed/i.test(d.hours)) counts.set(d.hours, (counts.get(d.hours) ?? 0) + 1);
  const common = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";
  const hours = common.replace(/\s*[–-]\s*/g, "–");
  const closedDays = closed.filter((d) => DAY.includes(d));
  return closedDays.length ? `${hours}, closed ${closedDays.join("/")}` : hours;
}

export function poiFromGoogle(p: GooglePlace, city: string): Poi | null {
  if (!p.id || !p.displayName?.text || !p.location) return null;
  const types = [p.primaryType, ...(p.types ?? [])].filter(Boolean) as string[];
  const category = CATEGORY_BY_TYPE.find(([ts]) => ts.some((t) => types.includes(t)))?.[1] ?? "OTHER";
  const tags = [...new Set(TAGS_BY_TYPE.filter(([ts]) => ts.some((t) => types.includes(t))).map(([, tag]) => tag))];
  const hood =
    p.addressComponents?.find((c) => c.types.includes("neighborhood") || c.types.includes("sublocality_level_1") || c.types.includes("sublocality"))?.longText ??
    city;
  return {
    id: `g:${p.id}`,
    name: p.displayName.text,
    category,
    city,
    neighborhood: hood,
    lat: p.location.latitude,
    lng: p.location.longitude,
    rating: p.rating ?? 0,
    priceLevel: p.priceLevel ? (PRICE[p.priceLevel] ?? 0) : 0,
    // Google gives a price band, not a price; don't make one up.
    avgCost: 0,
    currency: "",
    hours: hoursFromGoogle(p.regularOpeningHours?.weekdayDescriptions),
    tags,
    durationMin: DURATION[category],
    blurb: p.editorialSummary?.text ?? p.formattedAddress ?? "",
  };
}

// --------------------------------------------------------------- calls

type Near = { lat: number; lng: number } | null;

const bias = (near: Near, radius = 15000) =>
  near ? { locationBias: { circle: { center: { latitude: near.lat, longitude: near.lng }, radius } } } : {};

/** Places matching a text query in a city ("temples in Hanoi", "ramen"). */
export async function searchText(query: string, city: string, near: Near, max = 20): Promise<Poi[]> {
  const res = await call<{ places?: GooglePlace[] }>("/places:searchText", {
    method: "POST",
    fields: PLACE_FIELDS.map((f) => `places.${f}`).join(","),
    body: { textQuery: `${query} in ${city}`, maxResultCount: Math.min(20, max), languageCode: "en", ...bias(near) },
  });
  return (res?.places ?? []).map((p) => poiFromGoogle(p, city)).filter((p): p is Poi => p != null);
}

/**
 * What the planner draws from for a city the guide doesn't cover: sights
 * and experiences, plus somewhere to eat. A handful of requests per plan.
 */
export async function cityPool(city: string, near: Near, interests: string[]): Promise<Poi[]> {
  const queries = ["top sights", "restaurants", ...interests.slice(0, 3).map((i) => `${i.toLowerCase()} spots`)];
  const results = await Promise.all(queries.map((q) => searchText(q, city, near)));
  const byId = new Map<string, Poi>();
  for (const p of results.flat()) if (!byId.has(p.id)) byId.set(p.id, p);
  return [...byId.values()];
}

export type Prediction = { placeId: string; name: string; detail: string };

/** As-you-type search: hotels ("lodging") or neighbourhoods near a city. */
export async function autocomplete(input: string, near: Near, kind: "lodging" | "area" | "any"): Promise<Prediction[]> {
  const types = kind === "lodging" ? ["lodging"] : kind === "area" ? ["neighborhood", "sublocality"] : undefined;
  const res = await call<{ suggestions?: { placePrediction?: { placeId: string; structuredFormat?: { mainText?: { text: string }; secondaryText?: { text: string } } } }[] }>(
    "/places:autocomplete",
    { method: "POST", fields: "suggestions.placePrediction.placeId,suggestions.placePrediction.structuredFormat", body: { input, ...(types ? { includedPrimaryTypes: types } : {}), ...bias(near, 30000) } }
  );
  return (res?.suggestions ?? [])
    .map((s) => s.placePrediction)
    .filter((p): p is NonNullable<typeof p> => !!p?.placeId && !!p.structuredFormat?.mainText?.text)
    .map((p) => ({ placeId: p.placeId, name: p.structuredFormat!.mainText!.text, detail: p.structuredFormat?.secondaryText?.text ?? "" }));
}

/** One place, e.g. a hotel or must-do picked from autocomplete. */
export async function placeDetails(placeId: string, city: string): Promise<Poi | null> {
  const p = await call<GooglePlace>(`/places/${encodeURIComponent(placeId)}`, { method: "GET", fields: PLACE_FIELDS.join(",") });
  return p ? poiFromGoogle(p, city) : null;
}

/** For tests. */
export function clearPlacesCache() {
  cache.clear();
}
