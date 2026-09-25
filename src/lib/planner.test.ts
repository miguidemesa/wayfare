import test from "node:test";
import assert from "node:assert/strict";
import {
  optimizeDay,
  categorizeExpenseText,
  generateItinerary,
  openingWindow,
  type OptimizeItemIn,
  type PlannerInput,
} from "./planner";
import { haversineKm, estimateTransit } from "./utils";
import { emptyBrief, type TripBrief } from "./brief";
import { poiById } from "./data/pois";

const poiHours = (id: string | null) => (id ? (poiById(id)?.hours ?? "") : "");

test("planner - haversine distance calculation", () => {
  // Distance between Tokyo (35.6762, 139.6503) and Kyoto (35.0116, 135.7681) ~ 370 km
  const km = haversineKm(35.6762, 139.6503, 35.0116, 135.7681);
  assert.ok(km > 350 && km < 400, `Expected ~370km, got ${km}`);

  // Same coordinates should have 0 distance
  assert.equal(haversineKm(35.0, 135.0, 35.0, 135.0), 0);
});

test("planner - estimateTransit modes", () => {
  const walk = estimateTransit(1.0, "WALK");
  assert.equal(walk.mode, "WALK");
  assert.ok(walk.minutes >= 10 && walk.minutes <= 15);

  const train = estimateTransit(10.0, "TRAIN");
  assert.equal(train.mode, "TRAIN");
  assert.ok(train.minutes > 0);

  const taxi = estimateTransit(15.0, "TAXI");
  assert.equal(taxi.mode, "TAXI");
  assert.ok(taxi.minutes >= 15);
});

test("planner - categorizeExpenseText detects merchant categories", () => {
  assert.equal(categorizeExpenseText("Starbucks Coffee"), "FOOD");
  assert.equal(categorizeExpenseText("Ichiran Ramen"), "FOOD");
  assert.equal(categorizeExpenseText("JR East Shinkansen"), "TRANSPORT");
  assert.equal(categorizeExpenseText("Tokyo Metro Suica"), "TRANSPORT");
  assert.equal(categorizeExpenseText("Hilton Tokyo Shinjuku"), "HOTEL");
  assert.equal(categorizeExpenseText("Philippine Airlines Booking"), "FLIGHT");
  assert.equal(categorizeExpenseText("Bic Camera Electronics"), "SHOPPING");
  assert.equal(categorizeExpenseText("TeamLab Planets Ticket"), "ACTIVITY");
  assert.equal(categorizeExpenseText("Random Unknown Shop"), "MISC");
});

test("planner - optimizeDay 2-opt minimizes travel time", () => {
  // Create 4 points along a line: A(0,0), B(0,1), C(0,2), D(0,3)
  // Input in scrambled order: A, C, B, D
  const items: OptimizeItemIn[] = [
    { id: "1", title: "Point A", lat: 35.0, lng: 139.0, startTime: 540, durationMin: 60, fixed: false },
    { id: "3", title: "Point C", lat: 35.2, lng: 139.0, startTime: 660, durationMin: 60, fixed: false },
    { id: "2", title: "Point B", lat: 35.1, lng: 139.0, startTime: 780, durationMin: 60, fixed: false },
    { id: "4", title: "Point D", lat: 35.3, lng: 139.0, startTime: 900, durationMin: 60, fixed: false },
  ];

  const result = optimizeDay(items);
  assert.equal(result.order.length, 4);
  // Optimized travel time should be less than or equal to original
  assert.ok(
    result.optimizedTravelMin <= result.originalTravelMin,
    `Optimized (${result.optimizedTravelMin}m) should be <= original (${result.originalTravelMin}m)`
  );
});

test("planner - optimizeDay preserves fixed items", () => {
  const items: OptimizeItemIn[] = [
    { id: "1", title: "Activity 1", lat: 35.0, lng: 139.0, startTime: 540, durationMin: 60, fixed: false },
    { id: "2", title: "Reserved Lunch (Fixed)", lat: 35.5, lng: 139.5, startTime: 720, durationMin: 90, fixed: true },
    { id: "3", title: "Activity 2", lat: 35.1, lng: 139.1, startTime: 840, durationMin: 60, fixed: false },
  ];

  const result = optimizeDay(items);
  assert.equal(result.order.length, 3);
  const fixedItem = result.order.find((o) => o.id === "2");
  assert.ok(fixedItem, "Fixed item should be present");
  assert.equal(fixedItem.fixed, true);
});

// ------------------------------------------------------------ the brief

// Three days in Tokyo, 14–16 March 2027, as server-local days.
const DATES = [new Date(2027, 2, 14), new Date(2027, 2, 15), new Date(2027, 2, 16)];
const SHINJUKU = { lat: 35.6909, lng: 139.7003 };

function plan(brief: Partial<TripBrief>, extra: Partial<PlannerInput> = {}) {
  return generateItinerary({
    cities: ["Tokyo"],
    dates: DATES,
    interests: brief.interests ?? [],
    pace: brief.pace ?? "balanced",
    brief: { ...emptyBrief(), ...brief },
    ...extra,
  });
}
const activities = <T extends { type: string }>(day: { items: T[] }) => day.items.filter((i) => i.type === "ACTIVITY");

test("planner - pace sets how many things a full day holds", () => {
  // Before the brief, only the first two picks were ever scheduled.
  const middle = (pace: "relaxed" | "balanced" | "packed") => activities(plan({ pace })[1]).length;
  assert.equal(middle("relaxed"), 2);
  assert.equal(middle("balanced"), 3);
  assert.ok(middle("packed") >= 4, `packed day had ${middle("packed")}`);
});

test("planner - must-dos are always in the plan, and say so", () => {
  const days = plan({ mustDos: [{ name: "teamLab Planets", city: "Tokyo", poiId: "tok-teamlab-planets", placeId: null }] });
  const item = days.flatMap((d) => d.items).find((i) => i.poiId === "tok-teamlab-planets");
  assert.ok(item, "must-do was not planned");
  assert.match(item.reason, /must-do/);
});

test("planner - each day starts near where you're staying", () => {
  const stay = { city: "Tokyo", hotelName: null, hotelId: null, placeId: null, ...SHINJUKU, area: "Shinjuku", booked: false };
  const firstKm = (days: ReturnType<typeof plan>) =>
    days.map((d) => {
      const first = activities(d)[0];
      return haversineKm(SHINJUKU.lat, SHINJUKU.lng, first.lat, first.lng);
    });
  const withStay = plan({ stays: [stay] });
  const near = firstKm(withStay);
  const anywhere = firstKm(plan({}));
  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  // The guide has only a few sights in Shinjuku itself, so later days reach
  // further out; the first day starts on the doorstep, and on average the
  // days start far closer than a plan that doesn't know where you're staying.
  assert.ok(near[0] < 1.5, `first day starts ${near[0].toFixed(1)} km away`);
  assert.ok(mean(near) < mean(anywhere) / 2, `${mean(near).toFixed(1)} km vs ${mean(anywhere).toFixed(1)} km`);
  for (const d of withStay) assert.match(activities(d)[0].reason, /from Shinjuku/);
});

test("planner - the arrival day starts after you land and settle in", () => {
  const days = plan({ arrival: { date: "2027-03-14", time: 15 * 60, where: "HND" } });
  const first = days.find((d) => d.date.getDate() === 14);
  // 15:00 landing + 2.5h to get in and drop bags.
  for (const i of first?.items ?? []) assert.ok(i.startTime >= 17 * 60 + 30, `${i.title} at ${i.startTime}`);
});

test("planner - the departure day ends in time to get to the airport", () => {
  const days = plan({ departure: { date: "2027-03-16", time: 18 * 60, where: "NRT" } });
  const last = days.find((d) => d.date.getDate() === 16);
  assert.ok(last, "a departure at 18:00 still leaves a morning");
  for (const i of last.items) assert.ok(i.endTime <= 15 * 60, `${i.title} ends at ${i.endTime}`);
});

test("planner - with children: no bars or nightlife, and an earlier dinner", () => {
  const days = plan({ party: { adults: 2, childrenAges: [4, 9], seniors: 0 }, pace: "packed", rhythm: { dayStart: 540, dayEnd: 1380, lateNights: true } });
  const all = days.flatMap((d) => d.items);
  assert.ok(!all.some((i) => /golden-gai|omoide/.test(i.poiId ?? "")), "a bar was planned for a family");
  const dinners = days.map((d) => d.items.filter((i) => i.type === "RESTAURANT").at(-1)).filter(Boolean);
  for (const d of dinners) assert.ok(d!.startTime >= 18 * 60 && d!.startTime < 19 * 60, `dinner at ${d!.startTime}`);
});

test("planner - no walk is longer than the traveller's limit", () => {
  const days = plan({ mobility: { maxWalkMin: 5, avoidStairs: false } });
  for (const i of days.flatMap((d) => d.items)) {
    if (i.transportMode === "WALK") assert.ok((i.transportMin ?? 0) <= 5, `${i.title}: ${i.transportMin} min walk`);
  }
});

test("planner - every stop comes with a reason", () => {
  const days = plan({ interests: ["History", "Food"], stays: [{ city: "Tokyo", hotelName: "Hotel Gracery", hotelId: null, placeId: null, ...SHINJUKU, area: null, booked: true }] });
  const all = days.flatMap((d) => d.items);
  assert.ok(all.length > 5);
  for (const i of all) assert.ok(i.reason.trim().length > 0, `${i.title} has no reason`);
});

test("planner - never schedules a convenience store as a sight", () => {
  const all = plan({ pace: "packed" }).flatMap((d) => d.items);
  assert.ok(!all.some((i) => /seven|pharma|donki/.test(i.poiId ?? "")));
});

test("planner - reads the guide's opening hours", () => {
  assert.deepEqual(openingWindow("9 AM–5:30 PM, closed Mon"), { open: 540, close: 1050, closedDays: [1] });
  assert.deepEqual(openingWindow("9 AM–4:30 PM, closed Mon/Fri")?.closedDays, [1, 5]);
  // Split shifts span the whole day; "late" runs past midnight.
  assert.deepEqual(openingWindow("11:30 AM–3:30 PM, 5–11:30 PM"), { open: 690, close: 1410, closedDays: [] });
  assert.deepEqual(openingWindow("5 PM–late"), { open: 1020, close: 1560, closedDays: [] });
  assert.deepEqual(openingWindow("11 AM–5 AM"), { open: 660, close: 1740, closedDays: [] });
  assert.deepEqual(openingWindow("12:30–12 AM"), { open: 750, close: 1440, closedDays: [] });
  // Nothing to go on: never rule a place out on a guess.
  assert.equal(openingWindow("Always open"), null);
  assert.equal(openingWindow("Evenings are magic"), null);
});

test("planner - lunch is at lunchtime, never at a bar; dinner is never at a coffee bar", () => {
  for (const pace of ["relaxed", "balanced", "packed"] as const) {
    for (const d of plan({ pace })) {
      const meals = d.items.filter((i) => i.type === "RESTAURANT");
      const lunches = meals.filter((m) => m.startTime < 16 * 60);
      for (const l of lunches) assert.ok(l.startTime <= 14 * 60, `${pace}: lunch ${l.title} at ${l.startTime}`);
      assert.ok(!lunches.some((l) => /golden-gai|omoide/.test(l.poiId ?? "")), `${pace}: lunch at a bar`);
      assert.ok(!meals.some((m) => m.startTime >= 17 * 60 && /mameya|streamer/.test(m.poiId ?? "")), `${pace}: dinner at a cafe`);
    }
  }
});

test("planner - never plans a visit after the place has closed", () => {
  for (const d of plan({ pace: "packed", rhythm: { dayStart: 540, dayEnd: 1380, lateNights: true } })) {
    for (const i of d.items) {
      const w = openingWindow(poiHours(i.poiId));
      if (w) assert.ok(i.endTime <= w.close, `${i.title} runs to ${i.endTime}, closes ${w.close}`);
    }
  }
});

test("planner - reasons only claim what the guide knows", () => {
  const rain: Record<string, number> = {};
  for (const d of DATES) rain[`Tokyo|${d.getFullYear()}-0${d.getMonth() + 1}-${d.getDate()}`] = 90;
  const all = plan({ pace: "packed" }, { rain }).flatMap((d) => d.items);
  for (const i of all) {
    if (/Indoors/.test(i.reason)) assert.equal(poiById(i.poiId!)?.category, "MUSEUM", `${i.title} called indoors`);
  }
  // "near" means near.
  const days = plan({ pace: "packed" });
  for (const d of days) {
    d.items.forEach((i, n) => {
      const near = /near (.+?)(?: ·|$)/.exec(i.reason);
      if (!near || n === 0 || i.type !== "RESTAURANT") return;
      const prev = d.items[n - 1];
      assert.ok(haversineKm(prev.lat, prev.lng, i.lat, i.lng) <= 2, `${i.title} "near" ${prev.title}`);
    });
  }
});

