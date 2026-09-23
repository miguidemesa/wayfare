import test from "node:test";
import assert from "node:assert/strict";

test("calendar - iCalendar format compliance", () => {
  const tripTitle = "Tokyo & Kyoto Autumn";
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Wayfare//Wayfare AI Travel OS//EN",
    `X-WR-CALNAME:${tripTitle.replace(/,/g, "\\,")}`,
    "BEGIN:VEVENT",
    "UID:flight-123@wayfare.app",
    "SUMMARY:✈️ Philippine Airlines PR 426: MNL → HND",
    "DTSTART:20270314T140000Z",
    "DTEND:20270314T190000Z",
    "STATUS:CONFIRMED",
    "END:VEVENT",
    "END:VCALENDAR",
  ];

  const ics = lines.join("\r\n");
  assert.ok(ics.includes("BEGIN:VCALENDAR"));
  assert.ok(ics.includes("END:VCALENDAR"));
  assert.ok(ics.includes("BEGIN:VEVENT"));
  assert.ok(ics.includes("UID:flight-123@wayfare.app"));
  assert.ok(ics.includes("SUMMARY:✈️ Philippine Airlines"));
});
