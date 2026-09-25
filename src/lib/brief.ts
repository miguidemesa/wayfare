// The trip brief: what the traveller told Wayfare while planning — where
// they're staying, who's coming, what they're into, what they must see, how
// they like their days. The planner and the concierge both work from it.
//
// Stored as a JSON string on Trip.brief (SQLite has no Json column type).
// parseBrief() is the one gate every write goes through: it never throws,
// drops what it doesn't recognise, and clamps numbers to sensible ranges, so
// a brief read back from the database is always well-formed.

import { INTEREST_OPTIONS, type Interest } from "./types";

export const BRIEF_VERSION = 1;

export type Pace = "relaxed" | "balanced" | "packed";

export type Stay = {
  city: string;
  /** Set once the traveller names a hotel. */
  hotelName: string | null;
  /** The Hotel row created for it, when there is one. */
  hotelId: string | null;
  /** Google Places id, when the hotel came from place search. */
  placeId: string | null;
  lat: number | null;
  lng: number | null;
  /** Neighbourhood, when the hotel isn't booked yet ("somewhere in Shibuya"). */
  area: string | null;
  booked: boolean;
};

export type MustDo = {
  name: string;
  city: string | null;
  /** Curated guide id, when picked from the guide. */
  poiId: string | null;
  /** Google Places id, when picked from place search. */
  placeId: string | null;
};

export const DIETS = ["vegetarian", "vegan", "halal", "kosher", "gluten-free", "no-pork", "no-seafood", "no-alcohol"] as const;
export type Diet = (typeof DIETS)[number];

export const AVOIDS = ["crowds", "long-queues", "early-starts", "late-nights", "stairs", "tourist-traps"] as const;
export type Avoid = (typeof AVOIDS)[number];

export type Moment = {
  /** YYYY-MM-DD */
  date: string;
  /** Minutes after midnight, local time at the destination. */
  time: number | null;
  /** Airport, station… */
  where: string | null;
};

export type TripBrief = {
  version: typeof BRIEF_VERSION;
  stays: Stay[];
  party: { adults: number; childrenAges: number[]; seniors: number };
  interests: Interest[];
  mustDos: MustDo[];
  avoid: Avoid[];
  pace: Pace;
  rhythm: { dayStart: number; dayEnd: number; lateNights: boolean };
  food: { diet: Diet[]; priceLevel: 1 | 2 | 3 | 4 | null; mustTry: string[] };
  mobility: { maxWalkMin: number | null; avoidStairs: boolean };
  arrival: Moment | null;
  departure: Moment | null;
  /** Per person per day, in the trip's home currency. */
  dailyActivityBudget: number | null;
};

export const DEFAULT_RHYTHM = { dayStart: 9 * 60, dayEnd: 21 * 60, lateNights: false };

export function emptyBrief(): TripBrief {
  return {
    version: BRIEF_VERSION,
    stays: [],
    party: { adults: 1, childrenAges: [], seniors: 0 },
    interests: [],
    mustDos: [],
    avoid: [],
    pace: "balanced",
    rhythm: { ...DEFAULT_RHYTHM },
    food: { diet: [], priceLevel: null, mustTry: [] },
    mobility: { maxWalkMin: null, avoidStairs: false },
    arrival: null,
    departure: null,
    dailyActivityBudget: null,
  };
}

// ------------------------------------------------------------- interests

// Labels older clients (and the first mobile app) saved, mapped onto the tags
// the place guide actually uses. Without this, "Food & Dining" never matched a
// single place tagged "Food".
const INTEREST_ALIASES: Record<string, Interest> = {
  "food & dining": "Food",
  "cafes & coffee": "Food",
  "street food": "Food",
  "historic sites": "History",
  "iconic sights & temples": "History",
  "art & museums": "Culture",
  "art & architecture": "Architecture",
  "nature & parks": "Nature",
  "gardens & scenic walks": "Nature",
  "shopping & boutiques": "Shopping",
  "nightlife & izakaya": "Nightlife",
  "hidden gems": "Culture",
};

/** Map any interest labels onto canonical tags, dropping unknowns and repeats. */
export function normalizeInterests(labels: unknown): Interest[] {
  if (!Array.isArray(labels)) return [];
  const out = new Set<Interest>();
  for (const raw of labels) {
    if (typeof raw !== "string") continue;
    const key = raw.trim().toLowerCase();
    const canonical = INTEREST_OPTIONS.find((o) => o.toLowerCase() === key) ?? INTEREST_ALIASES[key];
    if (canonical) out.add(canonical);
  }
  return [...out];
}

// ------------------------------------------------------------- validation

const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const str = (v: unknown, max = 120): string | null => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);
const num = (v: unknown, min: number, max: number): number | null =>
  typeof v === "number" && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : null;
const int = (v: unknown, min: number, max: number, fallback: number): number => {
  const n = num(v, min, max);
  return n == null ? fallback : Math.round(n);
};
const bool = (v: unknown): boolean => v === true;
const oneOf = <T extends string>(v: unknown, options: readonly T[]): T | null => (options.includes(v as T) ? (v as T) : null);
const listOf = <T extends string>(v: unknown, options: readonly T[]): T[] =>
  Array.isArray(v) ? [...new Set(v.filter((x): x is T => options.includes(x as T)))] : [];
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const MINUTES_IN_DAY = 24 * 60;

function moment(v: unknown): Moment | null {
  const m = obj(v);
  const date = typeof m.date === "string" && DATE.test(m.date) ? m.date : null;
  if (!date) return null;
  const time = num(m.time, 0, MINUTES_IN_DAY - 1);
  return { date, time: time == null ? null : Math.round(time), where: str(m.where) };
}

function stay(v: unknown): Stay | null {
  const s = obj(v);
  const city = str(s.city);
  if (!city) return null;
  const lat = num(s.lat, -90, 90);
  const lng = num(s.lng, -180, 180);
  const located = lat != null && lng != null && !(lat === 0 && lng === 0);
  return {
    city,
    hotelName: str(s.hotelName),
    hotelId: str(s.hotelId, 64),
    placeId: str(s.placeId, 300),
    lat: located ? lat : null,
    lng: located ? lng : null,
    area: str(s.area),
    booked: bool(s.booked),
  };
}

function mustDo(v: unknown): MustDo | null {
  const m = obj(v);
  const name = str(m.name);
  if (!name) return null;
  return { name, city: str(m.city), poiId: str(m.poiId, 64), placeId: str(m.placeId, 300) };
}

/**
 * Validate and normalise a brief from any source (request body, database,
 * a model's output later). Unknown fields are dropped; bad values fall back
 * to defaults. Only a value that isn't an object at all is refused.
 */
export function parseBrief(raw: unknown): { ok: true; brief: TripBrief } | { ok: false; error: string } {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { ok: false, error: "brief must be an object" };
  const b = raw as Record<string, unknown>;
  const base = emptyBrief();

  const party = obj(b.party);
  const childrenAges = Array.isArray(party.childrenAges)
    ? party.childrenAges.map((a) => num(a, 0, 17)).filter((a): a is number => a != null).map(Math.round).slice(0, 12)
    : [];

  const rhythm = obj(b.rhythm);
  let dayStart = int(rhythm.dayStart, 5 * 60, 13 * 60, base.rhythm.dayStart);
  let dayEnd = int(rhythm.dayEnd, 15 * 60, MINUTES_IN_DAY - 1, base.rhythm.dayEnd);
  if (dayEnd - dayStart < 4 * 60) [dayStart, dayEnd] = [base.rhythm.dayStart, base.rhythm.dayEnd];

  const food = obj(b.food);
  const priceLevel = num(food.priceLevel, 1, 4);
  const mobility = obj(b.mobility);
  const maxWalk = num(mobility.maxWalkMin, 5, 60);

  const budget = num(b.dailyActivityBudget, 0, 1e9);

  return {
    ok: true,
    brief: {
      version: BRIEF_VERSION,
      stays: (Array.isArray(b.stays) ? b.stays : []).map(stay).filter((s): s is Stay => s != null).slice(0, 12),
      party: {
        adults: int(party.adults, 0, 30, base.party.adults),
        childrenAges,
        seniors: int(party.seniors, 0, 30, 0),
      },
      interests: normalizeInterests(b.interests),
      mustDos: (Array.isArray(b.mustDos) ? b.mustDos : []).map(mustDo).filter((m): m is MustDo => m != null).slice(0, 30),
      avoid: listOf(b.avoid, AVOIDS),
      pace: oneOf(b.pace, ["relaxed", "balanced", "packed"] as const) ?? base.pace,
      rhythm: { dayStart, dayEnd, lateNights: bool(rhythm.lateNights) },
      food: {
        diet: listOf(food.diet, DIETS),
        priceLevel: priceLevel == null ? null : (Math.round(priceLevel) as 1 | 2 | 3 | 4),
        mustTry: (Array.isArray(food.mustTry) ? food.mustTry : []).map((x) => str(x, 60)).filter((x): x is string => x != null).slice(0, 12),
      },
      mobility: { maxWalkMin: maxWalk == null ? null : Math.round(maxWalk), avoidStairs: bool(mobility.avoidStairs) },
      arrival: moment(b.arrival),
      departure: moment(b.departure),
      dailyActivityBudget: budget,
    },
  };
}

// ------------------------------------------------------------ preferences

/** The parts of a brief that describe the traveller, not the trip: reused to prefill the next one. */
export type TravellerPreferences = Pick<TripBrief, "party" | "interests" | "avoid" | "pace" | "rhythm" | "mobility"> & {
  food: Pick<TripBrief["food"], "diet" | "priceLevel">;
};

export function preferencesFrom(brief: TripBrief): TravellerPreferences {
  return {
    party: brief.party,
    interests: brief.interests,
    avoid: brief.avoid,
    pace: brief.pace,
    rhythm: brief.rhythm,
    mobility: brief.mobility,
    food: { diet: brief.food.diet, priceLevel: brief.food.priceLevel },
  };
}

export function readStoredPreferences(json: string | null | undefined): TravellerPreferences | null {
  const brief = readStoredBrief(json);
  return brief ? preferencesFrom(brief) : null;
}

/** Everyone on the trip, for Trip.travelersCount. */
export function partySize(brief: TripBrief): number {
  return Math.max(1, brief.party.adults + brief.party.childrenAges.length + brief.party.seniors);
}

/** Read Trip.brief back. Null when unset or unreadable, never a throw. */
export function readStoredBrief(json: string | null | undefined): TripBrief | null {
  if (!json) return null;
  try {
    const parsed = parseBrief(JSON.parse(json));
    return parsed.ok ? parsed.brief : null;
  } catch {
    return null;
  }
}
