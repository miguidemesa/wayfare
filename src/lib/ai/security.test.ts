import test from "node:test";
import assert from "node:assert/strict";
import { runTool } from "./tools";

test("security - AI tool rejects unknown tools", async () => {
  const res = await runTool("nonexistent_tool", {}, { tripId: "trip-1", userId: "u-1" });
  assert.equal(res.ok, false);
  assert.match(res.error, /Unknown tool/);
});

test("security - AI tool rejects invalid trip access", async () => {
  // Access with non-existent or foreign tripId should fail
  const res = await runTool(
    "update_itinerary_item",
    { item_id: "item-foreign-1", title: "Hacked Item" },
    { tripId: "trip-nonexistent-999", userId: "u-attacker" }
  );
  assert.equal(res.ok, false);
  assert.match(res.error, /(Trip not found|Item not found)/i);
});

test("security - AI tool delete rejects foreign item", async () => {
  const res = await runTool(
    "delete_itinerary_item",
    { item_id: "item-foreign-1" },
    { tripId: "trip-nonexistent-999", userId: "u-attacker" }
  );
  assert.equal(res.ok, false);
  assert.match(res.error, /(Trip not found|Item not found)/i);
});
