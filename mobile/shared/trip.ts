// Pure trip logic shared by every screen: phase, "what's next", day stats and
// spend math. No React, no network. Covered by trip.test.ts.

import type { Expense, ItineraryDay, ItineraryItem, TripBundle } from "./types";

// ---------------------------------------------------------------- dates
//
// The API sends two kinds of date:
//
// - Instants: expenses, flights, reservations, journal entries. A real moment,
//   read in the phone's timezone with localKey().
// - Calendar dates: itinerary days, trip start and end, weather, hotel stays.
//   A day of the trip, not a moment. The server stores these as a wall-clock
//   time in *its own* timezone (midnight for days and trip starts, 23:59:59 for
//   trip ends, 15:00 for check-in…), so reading them in the phone's timezone
//   lands on the wrong day once the two are far enough apart. Read them with
//   dayKey(), which undoes the server's offset instead.
//
// The offset isn't in the payload, but every writer stores a trip's startDate
// at the server's local midnight, so its UTC time of day gives the offset away.
// The API client calls learnServerOffset() on every trip it loads. Exact for a
// server without daylight saving (UTC in production); a DST server can still
// be an hour out across a clock change.

/** Device-local YYYY-MM-DD for an instant (ISO timestamp or Date). */
export function localKey(input: string | Date): string {
  const d = typeof input === "string" ? new Date(input) : input;
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

let serverOffsetMin = 0;

/** Record the server's UTC offset from a trip's startDate (its local midnight). */
export function learnServerOffset(tripStartIso: string) {
  const d = new Date(tripStartIso);
  if (isNaN(d.getTime())) return;
  let offset = -(d.getUTCHours() * 60 + d.getUTCMinutes());
  // Midnight at 16:00Z is UTC+8, not UTC−16.
  if (offset <= -720) offset += 1440;
  serverOffsetMin = offset;
}

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/** YYYY-MM-DD of a calendar-date field. The same day on every phone. */
export function dayKey(iso: string): string {
  if (DATE_ONLY.test(iso)) return iso;
  return new Date(new Date(iso).getTime() + serverOffsetMin * 60000).toISOString().slice(0, 10);
}

/** Step a YYYY-MM-DD key by whole days. */
export function addDays(key: string, n: number): string {
  const d = new Date(key + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Whole days from key `a` to key `b` (negative when b is earlier). */
export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / 86400000);
}

/** Dates in the trip's range that have no itinerary day yet. */
export function missingDays(trip: { startDate: string; endDate: string }, days: { date: string }[], limit = 366): number {
  const start = dayKey(trip.startDate);
  const total = Math.min(daysBetween(start, dayKey(trip.endDate)) + 1, limit);
  const have = new Set(days.map((d) => dayKey(d.date)));
  let missing = 0;
  for (let n = 0; n < total; n++) if (!have.has(addDays(start, n))) missing++;
  return missing;
}

export type TripPhase = "before" | "during" | "after";

export function tripPhase(startIso: string, endIso: string, now: Date = new Date()): TripPhase {
  const today = localKey(now);
  if (today < dayKey(startIso)) return "before";
  if (today > dayKey(endIso)) return "after";
  return "during";
}

/** Index of the day that's "today", or null when the trip isn't running. */
export function todayDayIndex(days: ItineraryDay[], now: Date = new Date()): number | null {
  const key = localKey(now);
  const i = days.findIndex((d) => dayKey(d.date) === key);
  return i >= 0 ? i : null;
}

// ------------------------------------------------------------ itinerary

export type LocatedItem = ItineraryItem & { lat: number; lng: number };

export function isLocated(item: ItineraryItem): item is LocatedItem {
  return typeof item.lat === "number" && typeof item.lng === "number" && !(item.lat === 0 && item.lng === 0);
}

/**
 * Stop count, travel time, bookings and planned cost for a day. Costs are
 * kept per currency — stops can be priced in yen and pesos on the same day,
 * and adding those together would be meaningless.
 */
export function dayStats(day: ItineraryDay, fallbackCurrency: string) {
  let transitMin = 0;
  let booked = 0;
  const planned = new Map<string, number>();
  for (const it of day.items) {
    transitMin += it.transportMin ?? 0;
    if (it.cost) {
      const c = it.currency || fallbackCurrency;
      planned.set(c, (planned.get(c) ?? 0) + it.cost);
    }
    if (it.confirmed) booked += 1;
  }
  return { stops: day.items.length, transitMin, planned: [...planned.entries()], booked };
}

export type NextStop = { item: ItineraryItem; day: ItineraryDay; dayIndex: number; leaveInMin: number | null };

/**
 * The next timed stop from `now` onward. During the trip, a stop that started
 * under 30 minutes ago still counts as "next" — you may be walking to it.
 */
export function nextStop(days: ItineraryDay[], now: Date = new Date()): NextStop | null {
  const todayKey = localKey(now);
  const nowMin = now.getHours() * 60 + now.getMinutes();
  for (let di = 0; di < days.length; di++) {
    const day = days[di];
    const key = dayKey(day.date);
    if (key < todayKey) continue;
    for (let ii = 0; ii < day.items.length; ii++) {
      const item = day.items[ii];
      if (item.startTime == null) continue;
      if (key === todayKey && item.startTime < nowMin - 30) continue;
      // transportMin on a stop is the leg *leaving* it, so the leg into this
      // stop lives on the previous one.
      const legIn = day.items[ii - 1]?.transportMin ?? 0;
      const leaveIn = key === todayKey ? Math.max(0, item.startTime - legIn - nowMin) : null;
      return { item, day, dayIndex: di, leaveInMin: leaveIn };
    }
  }
  return null;
}

/** Suggested start time (minutes) for a stop added after `prev`. */
export function suggestedStartAfter(prev: ItineraryItem | undefined): number {
  if (!prev || prev.startTime == null) return 10 * 60;
  const end = prev.endTime ?? prev.startTime + (prev.durationMin || 60);
  // Leave room to get there, then round up to the next quarter hour.
  const leg = prev.transportMin ?? 15;
  return Math.min(23 * 60 + 45, Math.ceil((end + leg) / 15) * 15);
}

export function moveInArray<T>(arr: T[], from: number, to: number): T[] {
  if (to < 0 || to >= arr.length || from === to) return arr;
  const next = arr.slice();
  const [x] = next.splice(from, 1);
  next.splice(to, 0, x);
  return next;
}

// ---------------------------------------------------------------- money

/** Rates are units per 1 USD (the backend's convention). */
export function convert(amount: number, from: string, to: string, rates: Record<string, number>): number {
  const f = rates[from];
  const t = rates[to];
  if (!f || !t) return amount;
  return (amount / f) * t;
}

const COUNTRY_CURRENCY: [RegExp, string][] = [
  [/japan/i, "JPY"],
  [/korea/i, "KRW"],
  [/philippin/i, "PHP"],
  [/thailand/i, "THB"],
  [/singapore/i, "SGD"],
  [/vietnam|viet nam/i, "VND"],
  [/indonesia/i, "IDR"],
  [/malaysia/i, "MYR"],
  [/taiwan/i, "TWD"],
  [/hong kong/i, "HKD"],
  [/china/i, "CNY"],
  [/india/i, "INR"],
  [/australia/i, "AUD"],
  [/new zealand/i, "NZD"],
  [/canada/i, "CAD"],
  [/united states|usa|^us$/i, "USD"],
  [/united kingdom|england|scotland|wales|^uk$/i, "GBP"],
  [/switzerland/i, "CHF"],
  [/france|italy|spain|germany|portugal|netherlands|belgium|austria|greece|ireland|finland|croatia|slovenia|slovakia|estonia|latvia|lithuania|luxembourg|malta|cyprus/i, "EUR"],
];

/** The currency you'll most likely pay in at the destination. */
export function localCurrency(bundle: Pick<TripBundle, "destinations" | "trip">): string {
  for (const d of bundle.destinations) {
    for (const [re, code] of COUNTRY_CURRENCY) if (re.test(d.country)) return code;
  }
  return bundle.trip.homeCurrency;
}

export function totalSpent(expenses: Expense[]): number {
  return expenses.reduce((s, e) => s + e.amountHome, 0);
}

export function spentOn(expenses: Expense[], key: string): number {
  return expenses.filter((e) => localKey(e.date) === key).reduce((s, e) => s + e.amountHome, 0);
}

export function byCategory(expenses: Expense[]): [string, number][] {
  const m = new Map<string, number>();
  for (const e of expenses) m.set(e.category, (m.get(e.category) ?? 0) + e.amountHome);
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}

export type ExpenseGroup = { key: string; total: number; items: Expense[] };

export function groupByDay(expenses: Expense[]): ExpenseGroup[] {
  const map = new Map<string, Expense[]>();
  for (const e of expenses) {
    const k = localKey(e.date);
    const list = map.get(k);
    if (list) list.push(e);
    else map.set(k, [e]);
  }
  return [...map.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([key, items]) => ({ key, items, total: items.reduce((s, e) => s + e.amountHome, 0) }));
}

/**
 * What you can spend per day from here on and stay on budget: what's left
 * (after anything already paid, like flights) spread over the trip days that
 * remain, today included. Null when there's no budget, it's spent, or the
 * trip is over.
 */
export function dailyAllowance(opts: {
  budget: number;
  spent: number;
  startIso: string;
  endIso: string;
  now?: Date;
}): number | null {
  const { budget, spent, startIso, endIso } = opts;
  if (budget <= 0) return null;
  const now = opts.now ?? new Date();
  const phase = tripPhase(startIso, endIso, now);
  if (phase === "after") return null;
  const from = phase === "before" ? dayKey(startIso) : localKey(now);
  const daysLeft = daysBetween(from, dayKey(endIso)) + 1;
  const left = budget - spent;
  if (daysLeft <= 0 || left <= 0) return null;
  return left / daysLeft;
}

export const EXPENSE_CATEGORIES: { key: string; label: string }[] = [
  { key: "FOOD", label: "Food" },
  { key: "TRANSPORT", label: "Transport" },
  { key: "HOTEL", label: "Stay" },
  { key: "ACTIVITY", label: "Activities" },
  { key: "SHOPPING", label: "Shopping" },
  { key: "ENTERTAINMENT", label: "Going out" },
  { key: "FLIGHT", label: "Flights" },
  { key: "MISC", label: "Other" },
];

export function categoryLabel(key: string): string {
  return EXPENSE_CATEGORIES.find((c) => c.key === key)?.label ?? "Other";
}

/** Expense category that best fits an itinerary stop type. */
export function categoryForItemType(type: string): string {
  switch (type) {
    case "RESTAURANT":
      return "FOOD";
    case "TRANSPORT":
      return "TRANSPORT";
    case "HOTEL":
      return "HOTEL";
    case "FLIGHT":
      return "FLIGHT";
    default:
      return "ACTIVITY";
  }
}

export const ITEM_TYPES: { key: string; label: string }[] = [
  { key: "ACTIVITY", label: "Activity" },
  { key: "RESTAURANT", label: "Food" },
  { key: "TRANSPORT", label: "Transit" },
  { key: "HOTEL", label: "Stay" },
  { key: "FLIGHT", label: "Flight" },
  { key: "PERSONAL", label: "Free time" },
];

export function itemTypeLabel(key: string): string {
  return ITEM_TYPES.find((t) => t.key === key)?.label ?? "Activity";
}

export function transportLabel(mode: string | null): string {
  switch (mode) {
    case "WALK":
      return "on foot";
    case "TRAIN":
      return "by train";
    case "TAXI":
      return "by taxi";
    case "BUS":
      return "by bus";
    default:
      return "travel";
  }
}

/** "HH:MM" → minutes, or null when malformed. */
export function parseClock(value: string): number | null {
  const m = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(value.trim());
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

// ------------------------------------------------------------ geography

export function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/** Straight-line distance along the day's located stops, in order. */
export function routeKm(items: ItineraryItem[]): number {
  const pts = items.filter(isLocated);
  let km = 0;
  for (let i = 1; i < pts.length; i++) km += haversineKm(pts[i - 1].lat, pts[i - 1].lng, pts[i].lat, pts[i].lng);
  return km;
}
