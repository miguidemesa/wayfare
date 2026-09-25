import test from "node:test";
import assert from "node:assert/strict";
import { emptyBrief, normalizeInterests, parseBrief, readStoredBrief } from "./brief";

test("brief - maps old mobile interest labels onto the guide's tags", () => {
  // The first mobile app saved these; none matched a place tag before.
  assert.deepEqual(normalizeInterests(["Food & Dining", "Historic Sites", "Nature & Parks", "Shopping"]), [
    "Food",
    "History",
    "Nature",
    "Shopping",
  ]);
  // Case-insensitive, de-duplicated, unknowns dropped.
  assert.deepEqual(normalizeInterests(["food", "Cafes & Coffee", "Knitting", 42]), ["Food"]);
});

test("brief - refuses anything that isn't an object", () => {
  assert.equal(parseBrief(null).ok, false);
  assert.equal(parseBrief("brief").ok, false);
  assert.equal(parseBrief([]).ok, false);
});

test("brief - an empty object becomes the default brief", () => {
  const r = parseBrief({});
  assert.ok(r.ok);
  assert.deepEqual(r.brief, emptyBrief());
});

test("brief - keeps a full, valid brief intact", () => {
  const input = {
    stays: [{ city: "Tokyo", hotelName: "Shibuya Stream Excel", hotelId: "h1", placeId: null, lat: 35.657, lng: 139.703, area: "Shibuya", booked: true }],
    party: { adults: 2, childrenAges: [6, 9], seniors: 1 },
    interests: ["Food", "History"],
    mustDos: [{ name: "teamLab Planets", city: "Tokyo", poiId: null, placeId: "abc" }],
    avoid: ["crowds", "early-starts"],
    pace: "relaxed",
    rhythm: { dayStart: 600, dayEnd: 1260, lateNights: false },
    food: { diet: ["halal"], priceLevel: 2, mustTry: ["ramen"] },
    mobility: { maxWalkMin: 15, avoidStairs: true },
    arrival: { date: "2027-03-14", time: 810, where: "HND" },
    departure: { date: "2027-03-23", time: 600, where: "KIX" },
    dailyActivityBudget: 3000,
  };
  const r = parseBrief(input);
  assert.ok(r.ok);
  assert.deepEqual(r.brief, { version: 1, ...input });
});

test("brief - clamps and drops bad values instead of failing", () => {
  const r = parseBrief({
    stays: [{ city: "" }, { city: "Kyoto", lat: 0, lng: 0 }, "nope"],
    party: { adults: -3, childrenAges: [4, 40, "x"], seniors: 2.6 },
    avoid: ["crowds", "spiders"],
    pace: "sprint",
    rhythm: { dayStart: 20 * 60, dayEnd: 21 * 60 },
    food: { diet: ["vegan", "carnivore"], priceLevel: 9 },
    mobility: { maxWalkMin: 500 },
    arrival: { date: "14 March", time: 900 },
    dailyActivityBudget: -5,
  });
  assert.ok(r.ok);
  const b = r.brief;
  // A stay needs a city; 0,0 isn't a real location.
  assert.deepEqual(b.stays.map((s) => [s.city, s.lat, s.lng]), [["Kyoto", null, null]]);
  assert.equal(b.party.adults, 0);
  assert.deepEqual(b.party.childrenAges, [4, 17]);
  assert.equal(b.party.seniors, 3);
  assert.deepEqual(b.avoid, ["crowds"]);
  assert.equal(b.pace, "balanced");
  // A 20:00 start is clamped to 13:00 (the latest a day may begin).
  assert.deepEqual([b.rhythm.dayStart, b.rhythm.dayEnd], [13 * 60, 21 * 60]);
  assert.deepEqual(b.food.diet, ["vegan"]);
  assert.equal(b.food.priceLevel, 4);
  assert.equal(b.mobility.maxWalkMin, 60);
  assert.equal(b.arrival, null);
  assert.equal(b.dailyActivityBudget, 0);
});

test("brief - a day shorter than four hours falls back to the default rhythm", () => {
  const r = parseBrief({ rhythm: { dayStart: 12 * 60, dayEnd: 15 * 60 } });
  assert.ok(r.ok);
  assert.deepEqual([r.brief.rhythm.dayStart, r.brief.rhythm.dayEnd], [9 * 60, 21 * 60]);
});

test("brief - reading a stored brief never throws", () => {
  assert.equal(readStoredBrief(null), null);
  assert.equal(readStoredBrief("{not json"), null);
  assert.equal(readStoredBrief("[]"), null);
  assert.equal(readStoredBrief(JSON.stringify({ pace: "packed" }))?.pace, "packed");
});
