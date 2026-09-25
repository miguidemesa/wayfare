import test from "node:test";
import assert from "node:assert/strict";
import { autocomplete, clearPlacesCache, cityPool, googleEnabled, hoursFromGoogle, poiFromGoogle, searchText } from "./google";
import { openingWindow, generateItinerary } from "../planner";
import { emptyBrief } from "../brief";

// Google formats times with narrow no-break spaces; the tests keep them.
const NNBSP = " ";
const WEEK_9_TO_5_CLOSED_MON = [
  "Monday: Closed",
  `Tuesday: 9:00${NNBSP}AM – 5:00${NNBSP}PM`,
  `Wednesday: 9:00${NNBSP}AM – 5:00${NNBSP}PM`,
  `Thursday: 9:00${NNBSP}AM – 5:00${NNBSP}PM`,
  `Friday: 9:00${NNBSP}AM – 8:30${NNBSP}PM`,
  `Saturday: 9:00${NNBSP}AM – 5:00${NNBSP}PM`,
  `Sunday: 9:00${NNBSP}AM – 5:00${NNBSP}PM`,
];

function withKey<T>(fn: () => Promise<T>): Promise<T> {
  const before = process.env.GOOGLE_PLACES_API_KEY;
  process.env.GOOGLE_PLACES_API_KEY = "test-key";
  clearPlacesCache();
  return fn().finally(() => {
    if (before === undefined) delete process.env.GOOGLE_PLACES_API_KEY;
    else process.env.GOOGLE_PLACES_API_KEY = before;
  });
}

function mockFetch(respond: (url: string, init: RequestInit) => unknown) {
  const calls: { url: string; init: RequestInit }[] = [];
  const original = globalThis.fetch;
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return { ok: true, status: 200, json: async () => respond(url, init), text: async () => "" } as Response;
  }) as typeof fetch;
  return { calls, restore: () => (globalThis.fetch = original) };
}

const TEMPLE = {
  id: "ChIJtemple",
  displayName: { text: "Temple of Literature" },
  formattedAddress: "58 Quốc Tử Giám, Hanoi",
  location: { latitude: 21.0294, longitude: 105.8355 },
  rating: 4.5,
  priceLevel: "PRICE_LEVEL_INEXPENSIVE",
  primaryType: "tourist_attraction",
  types: ["tourist_attraction", "historical_landmark", "place_of_worship"],
  regularOpeningHours: { weekdayDescriptions: WEEK_9_TO_5_CLOSED_MON.map((d) => d.replace("Friday: 9:00 AM – 8:30 PM", "Friday: 9:00 AM – 5:00 PM")) },
  editorialSummary: { text: "Confucian temple and Vietnam's first university." },
  addressComponents: [{ longText: "Đống Đa", types: ["sublocality_level_1", "political"] }],
};

test("google - reads a week of opening hours into the guide's form", () => {
  const line = hoursFromGoogle(WEEK_9_TO_5_CLOSED_MON);
  assert.equal(line, "9 AM–5 PM, closed Mon");
  // …which the planner's own parser understands.
  assert.deepEqual(openingWindow(line), { open: 540, close: 1020, closedDays: [1] });
  assert.equal(hoursFromGoogle(Array(7).fill("Monday: Open 24 hours")), "24 hours");
  assert.equal(hoursFromGoogle(undefined), "");
});

test("google - maps a place onto the guide's shape without inventing a price", () => {
  const poi = poiFromGoogle(TEMPLE, "Hanoi")!;
  assert.equal(poi.id, "g:ChIJtemple");
  assert.equal(poi.category, "TEMPLE");
  assert.equal(poi.neighborhood, "Đống Đa");
  assert.deepEqual(poi.tags.sort(), ["History", "Photography"]);
  assert.equal(poi.priceLevel, 1);
  assert.equal(poi.avgCost, 0);
  assert.equal(poi.hours, "9 AM–5 PM, closed Mon");
  assert.equal(poiFromGoogle({ id: "x" }, "Hanoi"), null, "a place with no name or location is dropped");
});

test("google - does nothing without a key", async () => {
  const before = process.env.GOOGLE_PLACES_API_KEY;
  delete process.env.GOOGLE_PLACES_API_KEY;
  const mock = mockFetch(() => ({ places: [TEMPLE] }));
  try {
    assert.equal(googleEnabled(), false);
    assert.deepEqual(await searchText("temples", "Hanoi", null), []);
    assert.equal(mock.calls.length, 0);
  } finally {
    mock.restore();
    if (before !== undefined) process.env.GOOGLE_PLACES_API_KEY = before;
  }
});

test("google - asks only for the fields it uses, and caches repeats", () =>
  withKey(async () => {
    const mock = mockFetch(() => ({ places: [TEMPLE] }));
    try {
      const a = await searchText("temples", "Hanoi", { lat: 21.03, lng: 105.85 });
      const b = await searchText("temples", "Hanoi", { lat: 21.03, lng: 105.85 });
      assert.equal(a.length, 1);
      assert.deepEqual(a, b);
      assert.equal(mock.calls.length, 1, "the second identical search came from the cache");
      const headers = mock.calls[0].init.headers as Record<string, string>;
      assert.equal(headers["X-Goog-Api-Key"], "test-key");
      assert.match(headers["X-Goog-FieldMask"], /^places\.id,places\.displayName,/);
      assert.equal(JSON.parse(mock.calls[0].init.body as string).textQuery, "temples in Hanoi");
    } finally {
      mock.restore();
    }
  }));

test("google - hotel autocomplete returns names and ids", () =>
  withKey(async () => {
    const mock = mockFetch(() => ({
      suggestions: [
        { placePrediction: { placeId: "h1", structuredFormat: { mainText: { text: "Hotel de l'Opera" }, secondaryText: { text: "Hoàn Kiếm, Hanoi" } } } },
        { queryPrediction: { text: { text: "hotels" } } },
      ],
    }));
    try {
      assert.deepEqual(await autocomplete("hotel de", { lat: 21.03, lng: 105.85 }, "lodging"), [{ placeId: "h1", name: "Hotel de l'Opera", detail: "Hoàn Kiếm, Hanoi" }]);
      assert.deepEqual(JSON.parse(mock.calls[0].init.body as string).includedPrimaryTypes, ["lodging"]);
    } finally {
      mock.restore();
    }
  }));

test("google - a city the guide doesn't cover still gets a plan", () =>
  withKey(async () => {
    // A small Hanoi: three sights near the Old Quarter, and two places to eat.
    const at = (id: string, name: string, types: string[], lat: number, lng: number, rating = 4.4) => ({
      id,
      displayName: { text: name },
      location: { latitude: lat, longitude: lng },
      rating,
      primaryType: types[0],
      types,
      regularOpeningHours: { weekdayDescriptions: Array(7).fill("Monday: 8:00 AM – 10:00 PM") },
    });
    const places = [
      at("s1", "Hoan Kiem Lake", ["park"], 21.0288, 105.8525),
      at("s2", "Temple of Literature", ["tourist_attraction", "historical_landmark"], 21.0294, 105.8355),
      at("s3", "Hanoi Opera House", ["tourist_attraction"], 21.0245, 105.8575),
      at("r1", "Bún Chả Hương Liên", ["restaurant"], 21.0183, 105.8529),
      at("r2", "Phở Gia Truyền", ["restaurant"], 21.0337, 105.8497),
    ];
    const mock = mockFetch(() => ({ places }));
    try {
      const pool = await cityPool("Hanoi", { lat: 21.03, lng: 105.85 }, ["History"]);
      assert.equal(pool.length, 5, "results from several searches are de-duplicated");
      const days = generateItinerary({
        cities: ["Hanoi"],
        dates: [new Date(2027, 2, 15)],
        interests: ["History"],
        pace: "balanced",
        brief: emptyBrief(),
        extraPois: pool,
      });
      const items = days[0]?.items ?? [];
      assert.ok(items.some((i) => i.type === "ACTIVITY"), "no sights planned");
      assert.ok(items.some((i) => i.type === "RESTAURANT"), "no meals planned");
      assert.ok(items.every((i) => i.reason.length > 0));
      assert.ok(!items.some((i) => /in the guide/.test(i.reason)), "Google places aren't 'in the guide'");
    } finally {
      mock.restore();
    }
  }));
