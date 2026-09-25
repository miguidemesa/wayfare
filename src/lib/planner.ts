import { poiById, poisByCity, type Poi } from "./data/pois";
import { estimateTransit, haversineKm } from "./utils";
import { DEFAULT_RHYTHM, type TripBrief } from "./brief";

/**
 * Deterministic geographic itinerary planner.
 *
 * Design goals:
 * - Plan each day from where the traveller is staying, grouping stops by
 *   neighbourhood so there's little crossing of the city
 * - Honour the trip brief: must-dos first, interests, pace and daily rhythm,
 *   arrival and departure times, who's travelling, walking limits, food
 * - Give every stop a plain-language reason, built only from facts the
 *   planner actually used (no invented crowd levels or walking times)
 * - Produce structured output the UI can preview before anything is saved
 */

export type Pace = "relaxed" | "balanced" | "packed";

export type PlannerInput = {
  cities: string[];
  dates: Date[];
  interests: string[];
  pace: Pace;
  currency?: string;
  /** Arrival day, when the brief doesn't say what time you arrive. */
  startLate?: boolean;
  /** Departure day, when the brief doesn't say what time you leave. */
  endEarly?: boolean;
  /** The planning interview's answers. */
  brief?: TripBrief | null;
  /** Booked hotels with a location; each night's base. */
  hotels?: { name: string; lat: number; lng: number; checkIn: Date; checkOut: Date }[];
  /** Chance of rain, 0–100, keyed "City|YYYY-MM-DD" (server-local day). */
  rain?: Record<string, number>;
  /** Commitments already booked, to plan around. Minutes after midnight. */
  fixed?: { date: string; start: number; end: number }[];
  /** Places from outside the curated guide (Google), for cities it doesn't cover. */
  extraPois?: Poi[];
};

export type PlannedItem = {
  type: "ACTIVITY" | "RESTAURANT";
  title: string;
  poiId: string | null;
  startTime: number;
  endTime: number;
  durationMin: number;
  placeName: string;
  neighborhood: string;
  lat: number;
  lng: number;
  cost: number;
  currency: string;
  notes?: string;
  /** Why Wayfare picked it, in a sentence. */
  reason: string;
  transportMode: "WALK" | "TRAIN" | "TAXI" | null;
  transportMin: number | null;
  transportCost: number | null;
  reservationSuggested: boolean;
};

export type PlannedDay = {
  date: Date;
  city: string;
  title: string;
  items: PlannedItem[];
  estTravelMin: number;
};

/** Getting from the airport or station and dropping bags, before the first stop. */
const ARRIVAL_BUFFER = 150;
/** Leaving the last stop in time to get back, collect bags and reach the airport. */
const DEPARTURE_BUFFER = 180;
const RAINY = 50;

/** YYYY-MM-DD of a Date in the server's timezone (how trip days are stored). */
export function localDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function interestMatches(poi: Poi, interests: string[]): string[] {
  return poi.tags.filter((t) => interests.some((i) => i.toLowerCase() === t.toLowerCase()));
}

function interestScore(poi: Poi, interests: string[]): number {
  return poi.rating * 2 + interestMatches(poi, interests).length * 3.5;
}

// ------------------------------------------------------------ opening hours

export type OpeningWindow = { open: number; close: number; closedDays: number[] };

const DAY_INDEX: Record<string, number> = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };

function clockOf(token: string, meridiem: string | undefined, fallbackMeridiem: string | undefined): number | null {
  const t = token.trim().toLowerCase();
  if (t === "late") return 26 * 60;
  if (t === "evening") return 17 * 60;
  // Only ever an opening time in the guide ("Sunrise–4:30 PM"; one entry
  // says "Sunset", meaning the same): places that open at dawn.
  if (t === "sunrise" || t === "sunset") return 6 * 60;
  const m = /^(\d{1,2})(?::(\d{2}))?$/.exec(t);
  if (!m) return null;
  let h = Number(m[1]);
  const min = Number(m[2] ?? 0);
  const mer = (meridiem ?? fallbackMeridiem)?.toUpperCase();
  if (!meridiem && h === 12) return 12 * 60 + min; // "12:30–…" is lunchtime
  if (mer === "PM" && h !== 12) h += 12;
  if (mer === "AM" && h === 12) h = 0;
  return h * 60 + min;
}

/**
 * Read a guide place's opening hours ("9 AM–5:30 PM, closed Mon",
 * "11:30 AM–3:30 PM, 5–11:30 PM", "5 PM–late"). Null when the hours don't
 * constrain a visit ("Always open", "24 hours") or can't be read; a place
 * is never ruled out on a guess.
 */
export function openingWindow(hours: string): OpeningWindow | null {
  const h = hours.replace(/~/g, "");
  if (/always|24 hours/i.test(h)) return null;
  const range = /([\d:]+|late|evening|sunrise|sunset)\s*(AM|PM)?\s*[–-]\s*([\d:]+|late)\s*(AM|PM)?/gi;
  const spans: [number, number][] = [];
  for (const m of h.matchAll(range)) {
    const open = clockOf(m[1], m[2], m[4]);
    let close = clockOf(m[3], m[4], undefined);
    if (open == null || close == null) continue;
    if (close <= open) close += 24 * 60; // "11 AM–5 AM"
    spans.push([open, close]);
  }
  if (!spans.length) return null;
  const closedDays: number[] = [];
  const closed = /closed\s+([a-z/ ,]+)/i.exec(h);
  if (closed) for (const d of closed[1].toLowerCase().split(/[/, ]+/)) if (d.slice(0, 3) in DAY_INDEX) closedDays.push(DAY_INDEX[d.slice(0, 3)]);
  return { open: Math.min(...spans.map((x) => x[0])), close: Math.max(...spans.map((x) => x[1])), closedDays };
}

/** When a visit of `duration` can start at or after `from`, or null if it can't that day. */
function visitStart(p: Poi, from: number, weekday: number): number | null {
  const w = openingWindow(p.hours);
  if (!w) return from;
  if (w.closedDays.includes(weekday)) return null;
  const start = Math.max(from, w.open);
  return start + p.durationMin <= w.close ? start : null;
}

const isOutdoor = (p: Poi) => p.category === "PARK" || p.tags.includes("Nature");
const isAdultsOnly = (p: Poi) => p.category === "BAR" || p.tags.includes("Nightlife");
const isMeal = (p: Poi) => p.category === "RESTAURANT" || p.category === "CAFE" || p.category === "BAR";

function listWords(words: string[]): string {
  return words.length <= 1 ? (words[0] ?? "") : `${words.slice(0, -1).join(", ")} and ${words[words.length - 1]}`;
}

function dayTarget(pace: Pace): number {
  return pace === "relaxed" ? 2 : pace === "balanced" ? 3 : 4;
}

function splitDaysAcrossCities(days: Date[], cities: string[]): string[] {
  const perCity: string[] = [];
  const base = Math.floor(days.length / cities.length);
  const extra = days.length % cities.length;
  cities.forEach((c, i) => {
    for (let j = 0; j < base + (i < extra ? 1 : 0); j++) perCity.push(c);
  });
  return perCity;
}

type Anchor = { lat: number; lng: number; label: string | null };

/** Where the traveller sleeps that night (or leaves from, on the last day). */
function anchorFor(input: PlannerInput, city: string, key: string): Anchor | null {
  const hotel = (input.hotels ?? []).find((h) => localDateKey(h.checkIn) <= key && key <= localDateKey(h.checkOut));
  if (hotel) return { lat: hotel.lat, lng: hotel.lng, label: hotel.name };
  const stay = input.brief?.stays.find((s) => s.city.toLowerCase() === city.toLowerCase() && s.lat != null && s.lng != null);
  if (stay) return { lat: stay.lat!, lng: stay.lng!, label: stay.hotelName ?? stay.area };
  return null;
}

/** How to get between two stops, within the traveller's walking limits. */
function legFor(km: number, brief: TripBrief | null | undefined) {
  let leg = estimateTransit(km);
  const maxWalk = brief?.mobility.maxWalkMin ?? null;
  // Over the walking limit on a short hop: a taxi beats a train ride.
  if (leg.mode === "WALK" && maxWalk != null && leg.minutes > maxWalk) leg = estimateTransit(km, "TAXI");
  // Stations mean stairs and long corridors.
  if (leg.mode === "TRAIN" && brief && (brief.party.seniors > 0 || brief.mobility.avoidStairs)) leg = estimateTransit(km, "TAXI");
  return leg;
}

function pickMeal(
  city: string,
  map: Record<string, Poi[]>,
  usedIds: Set<string>,
  near: { lat: number; lng: number } | null,
  kind: "lunch" | "dinner",
  brief: TripBrief | null | undefined,
  at: number,
  weekday: number
): { poi: Poi; tried: string | null } | null {
  const list = map[city] ?? [];
  const kids = (brief?.party.childrenAges.length ?? 0) > 0;
  const wantLevel = brief?.food.priceLevel ?? null;
  let best: { poi: Poi; tried: string | null } | null = null;
  let bestScore = -Infinity;
  for (const r of list) {
    if (usedIds.has(r.id)) continue;
    if (kids && r.category === "BAR") continue;
    // No bar crawls at lunch; no coffee bars for dinner.
    if (kind === "lunch" && r.category === "BAR") continue;
    if (kind === "dinner" && r.category === "CAFE") continue;
    // Open for the whole meal, counting the journey there.
    const arrive = at + (near ? legFor(haversineKm(near.lat, near.lng, r.lat, r.lng), brief).minutes : 0);
    if (visitStart(r, arrive, weekday) == null) continue;
    let s = r.rating * 2;
    if (kind === "dinner") {
      if (r.category === "BAR") s += 1.5;
      if (r.hours.includes("AM")) s += 0.5;
    } else {
      if (r.id.includes("market")) s += 1.5;
      if (r.category === "CAFE") s -= 2;
    }
    if (wantLevel != null && r.priceLevel > wantLevel) s -= (r.priceLevel - wantLevel) * 2;
    const haystack = `${r.name} ${r.cuisine ?? ""} ${r.tags.join(" ")}`.toLowerCase();
    const tried = brief?.food.mustTry.find((t) => haystack.includes(t.toLowerCase())) ?? null;
    if (tried) s += 4;
    if (near) s -= haversineKm(near.lat, near.lng, r.lat, r.lng) * 1.8;
    if (s > bestScore) {
      bestScore = s;
      best = { poi: r, tried };
    }
  }
  return best;
}

/**
 * Spread must-dos over their city's days: fewest must-dos first, and the
 * full days in the middle before the arrival and departure days.
 */
/** A must-do's place: from the guide by poiId, or from Google by placeId. */
export function mustDoPoiId(m: { poiId: string | null; placeId: string | null }): string | null {
  return m.poiId ?? (m.placeId ? `g:${m.placeId}` : null);
}

function assignMustDos(input: PlannerInput, cityOrder: string[]): Map<number, Poi[]> {
  const byDay = new Map<number, Poi[]>();
  const last = cityOrder.length - 1;
  for (const m of input.brief?.mustDos ?? []) {
    const id = mustDoPoiId(m);
    const poi = id ? (poiById(id) ?? input.extraPois?.find((p) => p.id === id)) : undefined;
    if (!poi) continue;
    const days = cityOrder.map((c, i) => (c === poi.city ? i : -1)).filter((i) => i >= 0);
    if (!days.length) continue;
    const edge = (i: number) => (i === 0 || i === last ? 1 : 0);
    const day = days.reduce((a, b) => {
      const ca = byDay.get(a)?.length ?? 0;
      const cb = byDay.get(b)?.length ?? 0;
      return cb < ca || (cb === ca && edge(b) < edge(a)) ? b : a;
    });
    byDay.set(day, [...(byDay.get(day) ?? []), poi]);
  }
  return byDay;
}

export function generateItinerary(input: PlannerInput): PlannedDay[] {
  const brief = input.brief ?? null;
  const kids = brief?.party.childrenAges ?? [];
  const youngKids = kids.some((a) => a < 6);
  const avoid = new Set(brief?.avoid ?? []);
  const rhythm = brief?.rhythm ?? DEFAULT_RHYTHM;
  const diets = (brief?.food.diet ?? []).map((d) => d.replace("-", " "));
  const mustIds = new Set((brief?.mustDos ?? []).map(mustDoPoiId).filter(Boolean) as string[]);
  const poolFor = (city: string) => [...poisByCity(city), ...(input.extraPois ?? []).filter((p) => p.city === city)];

  // Sights and experiences, plus nightlife bars for evenings. Not meals, and
  // not the guide's "essentials" (convenience stores, pharmacies).
  const activities = input.cities
    .flatMap(poolFor)
    .filter((p) => p.category !== "ESSENTIAL" && (!isMeal(p) || (p.category === "BAR" && p.tags.includes("Nightlife"))));
  const restMap: Record<string, Poi[]> = {};
  for (const c of input.cities) restMap[c] = poolFor(c).filter((p) => p.category === "RESTAURANT" || p.category === "CAFE" || p.category === "BAR");

  const usedActivities = new Set<string>();
  const usedRestaurants = new Set<string>();
  const cityOrder = splitDaysAcrossCities(input.dates, input.cities);
  const mustByDay = assignMustDos(input, cityOrder);
  const out: PlannedDay[] = [];

  input.dates.forEach((date, dayIdx) => {
    const city = cityOrder[dayIdx];
    const key = localDateKey(date);
    const weekday = date.getDay();
    const isFirst = dayIdx === 0;
    const isLast = dayIdx === input.dates.length - 1;
    const rainy = (input.rain?.[`${city}|${key}`] ?? 0) >= RAINY;
    const anchor = anchorFor(input, city, key);
    const fixed = (input.fixed ?? []).filter((f) => f.date === key).sort((a, b) => a.start - b.start);

    // ---- the day's window
    let dayStart = Math.max(rhythm.dayStart, avoid.has("early-starts") ? 10 * 60 : 0);
    let dayEnd = rhythm.dayEnd;
    if (youngKids) dayEnd = Math.min(dayEnd, 20 * 60);
    if (avoid.has("late-nights")) dayEnd = Math.min(dayEnd, 21 * 60 + 30);
    const arrival = brief?.arrival?.date === key && brief.arrival.time != null ? brief.arrival.time : null;
    const departure = brief?.departure?.date === key && brief.departure.time != null ? brief.departure.time : null;
    if (arrival != null) dayStart = Math.max(dayStart, arrival + ARRIVAL_BUFFER);
    else if (isFirst && input.startLate) dayStart = Math.max(dayStart, 14 * 60);
    if (departure != null) dayEnd = Math.min(dayEnd, departure - DEPARTURE_BUFFER);
    const arrivalDay = arrival != null || (isFirst && !!input.startLate);
    const departureDay = departure != null || (isLast && !!input.endEarly);

    let target = dayTarget(input.pace);
    if (kids.length || brief?.party.seniors) target = Math.min(target, 3);
    if (departure == null && isLast && input.endEarly) target -= 1;

    const lunchAt = youngKids ? 12 * 60 : 12 * 60 + 15;
    const dinnerAt = kids.length ? 18 * 60 : rhythm.lateNights ? 19 * 60 + 30 : 18 * 60 + 45;

    // ---- choose the day's stops: must-dos first, then a walkable cluster
    const score = (p: Poi) =>
      interestScore(p, input.interests) + (mustIds.has(p.id) ? 100 : 0) - (rainy && isOutdoor(p) ? 4 : 0);
    const allowed = (p: Poi) => p.city === city && !usedActivities.has(p.id) && !(kids.length && isAdultsOnly(p)) && p.category !== "BAR";
    const chosen: Poi[] = [];
    for (const m of mustByDay.get(dayIdx) ?? []) {
      if (!usedActivities.has(m.id)) {
        chosen.push(m);
        usedActivities.add(m.id);
      }
    }
    if (!chosen.length) {
      // Near home counts: the first stop is a trade-off of fit and distance.
      const firstScore = (p: Poi) => score(p) - (anchor ? haversineKm(anchor.lat, anchor.lng, p.lat, p.lng) * 1.2 : 0);
      const first = activities.filter(allowed).sort((a, b) => firstScore(b) - firstScore(a))[0];
      if (first) {
        chosen.push(first);
        usedActivities.add(first.id);
      }
    }
    while (chosen.length && chosen.length < target) {
      const cursor = chosen[chosen.length - 1];
      let next: Poi | null = null;
      let nextScore = Infinity;
      for (const p of activities) {
        if (!allowed(p)) continue;
        const km = haversineKm(cursor.lat, cursor.lng, p.lat, p.lng);
        const s = km - score(p) * 0.12;
        if (km < 6 && s < nextScore) {
          nextScore = s;
          next = p;
        }
      }
      if (!next) break;
      chosen.push(next);
      usedActivities.add(next.id);
    }

    // ---- lay the day out in time
    const items: PlannedItem[] = [];
    let clock = dayStart;
    let lunchDone = clock > lunchAt + 90 || lunchAt + 60 > dayEnd;
    let dinnerDone = dinnerAt + 45 > dayEnd + 15;

    const from = () => {
      const prev = items[items.length - 1];
      return prev ? { lat: prev.lat, lng: prev.lng } : anchor;
    };
    const travelTo = (p: Poi) => {
      const prev = items[items.length - 1];
      if (!prev) return 0;
      const leg = legFor(haversineKm(prev.lat, prev.lng, p.lat, p.lng), brief);
      prev.transportMode = leg.mode;
      prev.transportMin = leg.minutes;
      prev.transportCost = leg.mode === "TRAIN" ? 180 : leg.mode === "TAXI" ? 1200 : 0;
      return leg.minutes;
    };
    /** Push past any booked commitment the slot would run into. */
    const clearOfFixed = (start: number, duration: number) => {
      let s = start;
      for (const f of fixed) if (s < f.end && s + duration > f.start) s = f.end + 15;
      return s;
    };
    const place = (p: Poi, type: "ACTIVITY" | "RESTAURANT", reason: string, notBefore?: number) => {
      const legMin = travelTo(p);
      const earliest = clearOfFixed(Math.max(clock + legMin, notBefore ?? 0), p.durationMin);
      const start = visitStart(p, earliest, weekday) ?? earliest;
      items.push({
        type,
        title: p.name,
        poiId: p.id,
        startTime: start,
        endTime: start + p.durationMin,
        durationMin: p.durationMin,
        placeName: p.name,
        neighborhood: p.neighborhood,
        lat: p.lat,
        lng: p.lng,
        cost: p.avgCost,
        currency: p.currency,
        notes: p.blurb,
        reason,
        transportMode: null,
        transportMin: null,
        transportCost: null,
        reservationSuggested: (type === "RESTAURANT" && p.priceLevel >= 3) || p.id.includes("teamlab") || p.id.includes("dai"),
      });
      clock = start + p.durationMin;
    };

    const activityReason = (p: Poi) => {
      const bits: string[] = [];
      if (mustIds.has(p.id)) bits.push("On your must-do list");
      const matches = interestMatches(p, input.interests);
      if (matches.length) bits.push(`You're into ${listWords(matches.map((m) => m.toLowerCase()))}`);
      if (!items.length && anchor) {
        const leg = legFor(haversineKm(anchor.lat, anchor.lng, p.lat, p.lng), brief);
        const how = leg.mode === "WALK" ? "walk" : leg.mode === "TRAIN" ? "by train" : "by taxi";
        bits.push(`${leg.minutes} min ${how} from ${anchor.label ?? "where you're staying"}`);
      }
      // Only claim "indoors" where the guide says so: not tagged outdoors
      // isn't the same as having a roof (temple grounds, shopping streets).
      if (rainy && p.category === "MUSEUM") bits.push("Indoors, with rain likely");
      if (!bits.length) {
        const source = p.id.startsWith("g:") ? "on Google" : "in the guide";
        bits.push(p.rating > 0 ? `Rated ${p.rating.toFixed(1)} ${source}, and near your other stops` : "Near your other stops");
      }
      return bits.join(" · ");
    };
    const mealReason = (kind: "Lunch" | "Dinner", pick: { poi: Poi; tried: string | null }) => {
      const prev = items[items.length - 1];
      // "Near" only when it is: within a couple of kilometres.
      const km = prev ? haversineKm(prev.lat, prev.lng, pick.poi.lat, pick.poi.lng) : null;
      const bits = [prev ? `${kind} ${km! <= 2 ? "near" : "after"} ${prev.title}` : `${kind} close to where you're staying`];
      if (pick.tried) bits.push(`You wanted to try ${pick.tried}`);
      if (diets.length) bits.push(`Check they can do ${listWords(diets)}`);
      return bits.join(" · ");
    };
    const lunch = () => {
      lunchDone = true;
      const pick = pickMeal(city, restMap, usedRestaurants, from(), "lunch", brief, Math.max(clock, lunchAt), weekday);
      if (!pick) return;
      usedRestaurants.add(pick.poi.id);
      place(pick.poi, "RESTAURANT", mealReason("Lunch", pick), lunchAt);
    };
    const dinner = () => {
      dinnerDone = true;
      const pick = pickMeal(city, restMap, usedRestaurants, from(), "dinner", brief, Math.max(clock, dinnerAt), weekday);
      if (!pick) return;
      usedRestaurants.add(pick.poi.id);
      place(pick.poi, "RESTAURANT", mealReason("Dinner", pick), dinnerAt);
    };

    /** Can p fit next: open, and done before the next meal or the day's end? */
    const fitsNext = (p: Poi) => {
      const prevLoc = from();
      const legMin = prevLoc && items.length ? legFor(haversineKm(prevLoc.lat, prevLoc.lng, p.lat, p.lng), brief).minutes : 0;
      const start = visitStart(p, clearOfFixed(clock + legMin, p.durationMin), weekday);
      const limit = !dinnerDone ? dinnerAt : dayEnd;
      return start != null && start + p.durationMin <= limit;
    };

    /** Lunch when the morning reaches it; past its window, the day just goes without. */
    const lunchIfDue = () => {
      if (lunchDone || clock < lunchAt - 30) return;
      if (clock <= lunchAt + 90) lunch();
      else lunchDone = true;
    };

    for (const p of chosen) {
      lunchIfDue();
      if (!fitsNext(p)) {
        usedActivities.delete(p.id);
        continue;
      }
      place(p, "ACTIVITY", activityReason(p));
    }

    // Packed means packed: keep adding what's close by until dinner.
    if (input.pace === "packed") {
      for (let guard = 0; guard < 6 && !dinnerDone && dinnerAt - clock >= 60; guard++) {
        lunchIfDue();
        const here = from();
        const extra = activities
          .filter((p) => allowed(p) && fitsNext(p))
          .sort((a, b) => (here ? haversineKm(here.lat, here.lng, a.lat, a.lng) - haversineKm(here.lat, here.lng, b.lat, b.lng) : 0) - (score(a) - score(b)) * 0.12)[0];
        if (!extra) break;
        usedActivities.add(extra.id);
        place(extra, "ACTIVITY", activityReason(extra));
      }
    }
    if (!lunchDone && clock <= lunchAt + 90) lunch();
    if (!dinnerDone) dinner();

    // Something for the evening: night owls and packed days, never with children.
    if ((rhythm.lateNights || input.pace === "packed") && !kids.length && !avoid.has("late-nights") && items.length) {
      const last = items[items.length - 1];
      const night = activities.find(
        (p) =>
          p.city === city &&
          !usedActivities.has(p.id) &&
          (p.category === "BAR" || p.tags.includes("Nightlife") || p.tags.includes("Photography")) &&
          haversineKm(last.lat, last.lng, p.lat, p.lng) < 4 &&
          // Open well into the evening (not a park that shut at five).
          visitStart(p, clock + 20, weekday) != null
      );
      // Evenings may run past the usual end, but never into a departure.
      const eveningEnd = departure != null ? dayEnd : Math.max(dayEnd, 22 * 60);
      if (night && clock + 20 + night.durationMin <= eveningEnd) {
        usedActivities.add(night.id);
        place(night, "ACTIVITY", rhythm.lateNights ? "An evening stop, since you like late nights" : "An evening stop to round off a packed day");
      }
    }

    const hoods = [...new Set(items.filter((i) => i.type === "ACTIVITY").map((i) => i.neighborhood))].slice(0, 2).join(" & ");
    out.push({
      date,
      city,
      title: arrivalDay ? `Arrival · ${hoods || city}` : departureDay ? `Departure · ${hoods || city}` : hoods || city,
      items,
      estTravelMin: items.reduce((s, i) => s + (i.transportMin ?? 0), 0),
    });
  });

  return out.filter((d) => d.items.length > 0);
}

// ---------------------------------------------------------------------------
// Day optimizer — reorder movable stops to minimize travel time.
// Fixed anchors (first item, timed reservations) stay put.
// ---------------------------------------------------------------------------

export type OptimizeItemIn = {
  id: string;
  title: string;
  lat: number | null;
  lng: number | null;
  startTime: number | null;
  durationMin: number;
  /** Items with a hard external commitment (reservation numbers etc.) */
  fixed: boolean;
};

export type OptimizationResult = {
  order: OptimizeItemIn[];
  originalTravelMin: number;
  optimizedTravelMin: number;
  savedMin: number;
};

function legMinutes(a: OptimizeItemIn, b: OptimizeItemIn): number {
  if (!a.lat || !a.lng || !b.lat || !b.lng) return 10;
  const km = haversineKm(a.lat, a.lng, b.lat, b.lng);
  return estimateTransit(km).minutes;
}

function totalTravel(order: OptimizeItemIn[]): number {
  let sum = 0;
  for (let i = 0; i < order.length - 1; i++) sum += legMinutes(order[i], order[i + 1]);
  return sum;
}

export function optimizeDay(items: OptimizeItemIn[]): OptimizationResult {
  if (items.length < 3) {
    return {
      order: items,
      originalTravelMin: totalTravel(items),
      optimizedTravelMin: totalTravel(items),
      savedMin: 0,
    };
  }
  const originalTravel = totalTravel(items);

  // Anchor points: first item + any fixed items keep their positions.
  // Strategy: greedy insertion — start with fixed skeleton, insert movable items
  // at the position that minimizes added travel (nearest-insertion heuristic).
  const fixedWithFirst = items.map((it, idx) => ({ it, idx })).filter(
    ({ it, idx }) => it.fixed || idx === 0
  );
  const movable = items.filter(
    (it, idx) => !(it.fixed || idx === 0) && it.lat != null && it.lng != null
  );

  let skeleton = fixedWithFirst.map(({ it }) => it);
  if (!movable.length) {
    return {
      order: items,
      originalTravelMin: originalTravel,
      optimizedTravelMin: totalTravel(items),
      savedMin: 0,
    };
  }

  for (const m of movable) {
    let bestIdx = skeleton.length;
    let bestDelta = Infinity;
    for (let pos = 1; pos <= skeleton.length; pos++) {
      const before = skeleton[pos - 1];
      const after = skeleton[pos];
      const delta =
        legMinutes(before, m) +
        (after ? legMinutes(m, after) : 0) -
        (after ? legMinutes(before, after) : 0);
      if (delta < bestDelta) {
        bestDelta = delta;
        bestIdx = pos;
      }
    }
    skeleton = [
      ...skeleton.slice(0, bestIdx),
      m,
      ...skeleton.slice(bestIdx),
    ];
  }

  // 2-opt improvement pass on movable subsequences (bounded iterations).
  let improved = true;
  let iter = 0;
  while (improved && iter < 40) {
    improved = false;
    iter++;
    for (let i = 1; i < skeleton.length - 1; i++) {
      if (skeleton[i].fixed || i === 0) continue;
      for (let j = i + 1; j < skeleton.length; j++) {
        if (skeleton[j].fixed) continue;
        const candidate = [...skeleton];
        const seg = candidate.slice(i, j + 1).reverse();
        candidate.splice(i, seg.length, ...seg);
        if (totalTravel(candidate) < totalTravel(skeleton) - 1) {
          skeleton = candidate;
          improved = true;
        }
      }
    }
  }

  const optimizedTravel = totalTravel(skeleton);
  return {
    order: skeleton,
    originalTravelMin: originalTravel,
    optimizedTravelMin: optimizedTravel,
    savedMin: Math.max(0, originalTravel - optimizedTravel),
  };
}

// ---------------------------------------------------------------------------
// Packing list generator
// ---------------------------------------------------------------------------

export function generatePackingList(input: {
  daysCount: number;
  cities: string[];
  interests: string[];
  rainyDaysExpected: boolean;
}): { section: "BEFORE_TRIP" | "PACKING"; text: string; category: string }[] {
  const before: [string, string][] = [
    ["Check passport validity (6+ months)", "Documents"],
    ["Verify visa / entry requirements (JESTA/ETA check)", "Documents"],
    ["Buy travel insurance", "Documents"],
    ["Book flights & download tickets", "Bookings"],
    ["Book hotels & save confirmations", "Bookings"],
    ["Install eSIM / arrange roaming", "Tech"],
    ["Notify bank of travel + card fees", "Money"],
    ["Withdraw some cash in home currency", "Money"],
    ["Set up offline maps for destination", "Tech"],
  ];
  const packing: [string, string][] = [
    [`Clothes for ${Math.min(input.daysCount + 1, 12)} days (layers)`, "Clothing"],
    ["Comfortable walking shoes", "Clothing"],
    ["Toiletries kit (<100ml for carry-on)", "Essentials"],
    ["Medications + basic first aid", "Health"],
    ["Universal power adapter", "Electronics"],
    ["Phone charger + cable", "Electronics"],
    ["Portable battery pack", "Electronics"],
    ["Camera / go-pro", "Electronics"],
    ["Passport copies (physical + digital)", "Documents"],
    ["Day backpack", "Essentials"],
    ["Reusable water bottle", "Essentials"],
  ];

  if (input.rainyDaysExpected) {
    packing.push(["Packable rain jacket / umbrella", "Weather"]);
  }
  if (["Nature", "Adventure"].some((i) => input.interests.includes(i))) {
    packing.push(["Day-hike gear (trail shoes, sunhat)", "Outdoors"]);
  }
  if (input.interests.includes("Photography")) {
    packing.push(["Extra camera batteries + storage cards", "Electronics"]);
  }
  if (["Tokyo", "Kyoto"].some((c) => input.cities.includes(c))) {
    packing.push(["Coin pouch (Japan loves cash)", "Money"]);
  }

  return [
    ...before.map(([text, category]) => ({
      section: "BEFORE_TRIP" as const,
      text,
      category,
    })),
    ...packing.map(([text, category]) => ({
      section: "PACKING" as const,
      text,
      category,
    })),
  ];
}

// ---------------------------------------------------------------------------
// Expense auto-categorization from merchant/description text
// ---------------------------------------------------------------------------

const CATEGORY_RULES: [string[], string][] = [
  [["ramen", "sushi", "izakaya", "restaurant", "cafe", "coffee", "noodle", "soba", "tonkatsu", "gyoza", "ramen", "bakery", "breakfast", "lunch", "dinner", "market", "food", "yakitori", "tempura", "curry", "bento", "onigiri"], "FOOD"],
  [["train", "metro", "subway", "bus", "suica", "pasmo", "taxi", "uber", "shinkansen", "ticket gate", "jr ", "ferry", "tram"], "TRANSPORT"],
  [["hotel", "hostel", "ryokan", "airbnb", "check-in", "lodging", "hilton", "marriott", "hyatt", "sheraton", "inn"], "HOTEL"],
  [["flight", "airline", "airport", "jal", "ana", "pal ", "cebu pacific", "terminal fee"], "FLIGHT"],
  [["museum", "temple", "shrine", "teamlab", "observatory", "skytree", "tower", "tour", "ticket", "entry", "admission", "park"], "ACTIVITY"],
  [["shopping", "uniqlo", "don quijote", "gu ", "mall", "store", "souvenir", "vintage", "camera", "electronics", "bic camera", "yodobashi"], "SHOPPING"],
  [["bar", "karaoke", "nightlife", "club", "cinema", "arcade", "concert"], "ENTERTAINMENT"],
];

export function categorizeExpenseText(text: string): string {
  const t = text.toLowerCase();
  for (const [words, cat] of CATEGORY_RULES) {
    if (words.some((w) => t.includes(w))) return cat;
  }
  return "MISC";
}

export function suggestDurationForPoi(poiId: string): number | undefined {
  return poiById(poiId)?.durationMin;
}
