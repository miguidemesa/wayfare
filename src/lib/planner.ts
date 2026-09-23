import { poiById, poisByCity, type Poi } from "./data/pois";
import { estimateTransit, haversineKm } from "./utils";

/**
 * Deterministic geographic itinerary planner.
 *
 * Design goals:
 * - Group activities by neighborhood/proximity each day (minimize travel time)
 * - Respect pace (items per day), interests (scoring), and meal windows
 * - Produce structured output the UI can preview before anything is saved
 */

export type Pace = "relaxed" | "balanced" | "packed";

export type PlannerInput = {
  cities: string[];
  dates: Date[];
  interests: string[];
  pace: Pace;
  currency?: string;
  startLate?: boolean; // arrival day
  endEarly?: boolean; // departure day
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

const MEAL_LUNCH_START = 12 * 60 + 15;
const MEAL_DINNER_START = 18 * 60 + 45;

function interestScore(poi: Poi, interests: string[]): number {
  let score = poi.rating * 2;
  for (const t of poi.tags) {
    if (interests.some((i) => i.toLowerCase() === t.toLowerCase())) score += 3.5;
  }
  return score;
}

/** Activities only (meals handled separately). */
function activityPool(cities: string[], interests: string[]): Poi[] {
  const pool = cities.flatMap(poisByCity).filter(
    (p) => p.category !== "RESTAURANT" && p.category !== "CAFE"
  );
  return pool.sort((a, b) => interestScore(b, interests) - interestScore(a, interests));
}

function restaurantsByCity(cities: string[]): Record<string, Poi[]> {
  const map: Record<string, Poi[]> = {};
  for (const c of cities) {
    map[c] = poisByCity(c).filter(
      (p) => p.category === "RESTAURANT" || p.category === "CAFE"
    );
  }
  return map;
}

function pickMeal(
  city: string,
  map: Record<string, Poi[]>,
  usedIds: Set<string>,
  near: { lat: number; lng: number } | null,
  kind: "lunch" | "dinner"
): Poi | null {
  const list = map[city] ?? [];
  let best: Poi | null = null;
  let bestScore = -Infinity;
  for (const r of list) {
    if (usedIds.has(r.id)) continue;
    // dinner prefers dinner-capable places (bars/izakaya skew evening)
    let s = r.rating * 2;
    if (kind === "dinner") {
      if (r.category === "BAR") s += 1.5;
      if (r.hours.includes("AM")) s += 0.5;
    } else {
      if (r.id.includes("market")) s += 1.5;
      if (r.category === "CAFE") s -= 2;
    }
    if (near) {
      const km = haversineKm(near.lat, near.lng, r.lat, r.lng);
      s -= km * 1.8;
    }
    if (s > bestScore) {
      bestScore = s;
      best = r;
    }
  }
  return best;
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

export function generateItinerary(input: PlannerInput): PlannedDay[] {
  const pool = activityPool(input.cities, input.interests);
  const restMap = restaurantsByCity(input.cities);
  const usedActivities = new Set<string>();
  const usedRestaurants = new Set<string>();
  const cityOrder = splitDaysAcrossCities(input.dates, input.cities);

  const out: PlannedDay[] = [];

  input.dates.forEach((date, dayIdx) => {
    const city = cityOrder[dayIdx];
    const isFirst = dayIdx === 0;
    const isLast = dayIdx === input.dates.length - 1;
    const items: PlannedItem[] = [];
    const maxActivities =
      dayTarget(input.pace) -
      (isFirst && input.startLate ? 1 : 0) -
      (isLast && input.endEarly ? 1 : 0);

    // Seed with the top unused activity, then greedily add the nearest unused ones,
    // keeping everything inside a walkable/metro-friendly radius.
    const candidates = pool.filter((p) => p.city === city && !usedActivities.has(p.id));
    const anchor = candidates[0] ?? null;
    const chosen: Poi[] = [];
    let cursor: Poi | null = anchor;

    while (chosen.length < Math.max(maxActivities, 0) && cursor) {
      chosen.push(cursor!);
      usedActivities.add(cursor.id);
      const remaining = pool.filter((p) => p.city === city && !usedActivities.has(p.id));
      if (!remaining.length) break;
      let nearest: Poi | null = null;
      let nearestScore = Infinity;
      for (const p of remaining) {
        const km = haversineKm(cursor.lat, cursor.lng, p.lat, p.lng);
        const score = km - interestScore(p, input.interests) * 0.12;
        if (km < 6 && score < nearestScore) {
          nearestScore = score;
          nearest = p;
        }
      }
      cursor = nearest ?? null;
    }

    // Build timeline: morning activity(s) → lunch → afternoon → dinner → optional night
    let clock = isFirst && input.startLate ? 14 * 60 : 9 * 60 + 30;

    const pushPoi = (
      p: Poi,
      type: "ACTIVITY" | "RESTAURANT",
      opts?: { fixedStart?: number; notesSuffix?: string }
    ) => {
      if (opts?.fixedStart != null && opts.fixedStart > clock) clock = opts.fixedStart;
      const end = clock + p.durationMin;
      items.push({
        type,
        title: p.name,
        poiId: p.id,
        startTime: clock,
        endTime: end,
        durationMin: p.durationMin,
        placeName: p.name,
        neighborhood: p.neighborhood,
        lat: p.lat,
        lng: p.lng,
        cost: p.avgCost,
        currency: p.currency,
        notes: opts?.notesSuffix ? `${p.blurb} ${opts.notesSuffix}` : p.blurb,
        transportMode: null,
        transportMin: null,
        transportCost: null,
        reservationSuggested: type === "RESTAURANT" && p.priceLevel >= 3 || p.id.includes("teamlab") || p.id.includes("dai"),
      });
      clock = end;
    };

    const addTransitTo = (p: Poi) => {
      const prev = items[items.length - 1];
      if (!prev?.lat) return;
      const km = haversineKm(prev.lat, prev.lng, p.lat, p.lng);
      const t = estimateTransit(km);
      prev.transportMode = t.mode;
      prev.transportMin = t.minutes;
      prev.transportCost = t.mode === "TRAIN" ? 180 : t.mode === "TAXI" ? 1200 : 0;
    };

    // Morning block
    if (chosen[0]) {
      pushPoi(chosen[0], "ACTIVITY");
    }

    // Lunch near the morning anchor
    const lunch = pickMeal(city, restMap, usedRestaurants, chosen[0] ?? null, "lunch");
    if (lunch && clock <= MEAL_LUNCH_START + 150) {
      addTransitTo(lunch);
      pushPoi(lunch, "RESTAURANT", { fixedStart: MEAL_LUNCH_START });
      usedRestaurants.add(lunch.id);
    }

    // Afternoon block
    if (chosen[1]) {
      addTransitTo(chosen[1]);
      pushPoi(chosen[1], "ACTIVITY");
    }

    // Dinner near the last stop of the day
    const lastLoc = chosen[chosen.length - 1] ?? null;
    const dinner = pickMeal(city, restMap, usedRestaurants, lastLoc, "dinner");
    if (dinner) {
      addTransitTo(dinner);
      pushPoi(dinner, "RESTAURANT", { fixedStart: MEAL_DINNER_START });
      usedRestaurants.add(dinner.id);
    }

    // Evening bonus for packed pace / nightlife lovers
    if (input.pace === "packed" && chosen.length >= 4) {
      const nightPool = pool.filter(
        (p) =>
          p.city === city &&
          !usedActivities.has(p.id) &&
          (p.category === "BAR" ||
            p.tags.includes("Nightlife") ||
            (p.tags.includes("Photography") && p.hours.includes("PM")))
      );
      const night = nightPool.find((p) =>
        haversineKm(lastLoc!.lat, lastLoc!.lng, p.lat, p.lng) < 4
      );
      if (night) {
        addTransitTo(night);
        pushPoi(night, "ACTIVITY");
        usedActivities.add(night.id);
      }
    }

    const hoods = [...new Set(chosen.map((c) => c.neighborhood))].slice(0, 2).join(" & ");
    const estTravelMin = items.reduce((s, i) => s + (i.transportMin ?? 0), 0);

    out.push({
      date,
      city,
      title:
        isFirst && input.startLate
          ? `Arrival · ${hoods || city}`
          : isLast && input.endEarly
            ? `Departure · ${hoods || city}`
            : hoods || city,
      items,
      estTravelMin,
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
