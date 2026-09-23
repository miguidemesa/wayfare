import test from "node:test";
import assert from "node:assert/strict";
import {
  optimizeDay,
  categorizeExpenseText,
  type OptimizeItemIn,
} from "./planner";
import { haversineKm, estimateTransit } from "./utils";

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
