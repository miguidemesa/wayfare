// Reminders the phone schedules for itself: what to remind and when, worked
// out from the trip. Pure, like alerts.ts; lib/reminders.ts hands the list
// to the OS. Covered by reminders.test.ts.

import type { TripBundle } from "./types";
import { dayKey } from "./trip";

export type Reminder = {
  /** Stable across syncs, so rescheduling replaces rather than duplicates. */
  id: string;
  at: Date;
  title: string;
  body: string;
};

const MIN = 60_000;
/** Look this far ahead; the OS caps how many can wait (iOS: 64). */
const HORIZON_DAYS = 7;
const MAX = 40;

/** A local Date on a YYYY-MM-DD key at a clock time (minutes). */
function atKey(key: string, minutes: number): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d, Math.floor(minutes / 60), minutes % 60);
}

export function reminderSchedule(bundle: TripBundle, now: Date = new Date()): Reminder[] {
  const out: Reminder[] = [];
  const horizon = now.getTime() + HORIZON_DAYS * 24 * 60 * MIN;
  const push = (r: Reminder) => {
    const t = r.at.getTime();
    if (t > now.getTime() && t <= horizon) out.push(r);
  };

  // Leave-by for every timed stop: ten minutes before you need to set off.
  for (const day of bundle.days) {
    const key = dayKey(day.date);
    day.items.forEach((item, i) => {
      if (item.startTime == null) return;
      const legIn = day.items[i - 1]?.transportMin ?? 0;
      push({
        id: `leave-${item.id}`,
        at: atKey(key, item.startTime - legIn - 10),
        title: `Leave in 10 min for ${item.title}`,
        body: legIn ? `About ${legIn} min to get there.` : item.neighborhood ?? day.city,
      });
    });
  }

  for (const f of bundle.flights) {
    const depart = new Date(f.departAt).getTime();
    const name = [f.airline, f.flightNumber].filter(Boolean).join(" ");
    const route = `${f.originCode || f.originCity} → ${f.destCode || f.destCity}`;
    push({ id: `flight-24h-${f.id}`, at: new Date(depart - 24 * 60 * MIN), title: `${name} tomorrow`, body: `${route}. Online check-in usually opens about now.` });
    push({ id: `flight-3h-${f.id}`, at: new Date(depart - 3 * 60 * MIN), title: `${name} leaves in 3 hours`, body: [route, f.terminal ? `Terminal ${f.terminal}` : null].filter(Boolean).join(" · ") });
  }

  for (const r of bundle.reservations) {
    push({
      id: `res-${r.id}`,
      at: new Date(new Date(r.dateTime).getTime() - 2 * 60 * MIN),
      title: `${r.title} in 2 hours`,
      body: [r.locationName, r.confirmationNumber ? `Confirmation ${r.confirmationNumber}` : null].filter(Boolean).join(" · ") || "Booked",
    });
    if (r.cancellationDeadline) {
      push({
        id: `cancel-${r.id}`,
        at: new Date(new Date(r.cancellationDeadline).getTime() - 24 * 60 * MIN),
        title: `Free cancellation for ${r.title} ends tomorrow`,
        body: "Keep it, or cancel before then at no cost.",
      });
    }
  }

  for (const h of bundle.hotels) {
    push({ id: `checkin-${h.id}`, at: atKey(dayKey(h.checkIn), 9 * 60), title: `Check in at ${h.name} today`, body: h.confirmationNumber ? `Confirmation ${h.confirmationNumber}` : "Have your confirmation handy." });
    push({ id: `checkout-${h.id}`, at: atKey(dayKey(h.checkOut), 8 * 60), title: `Check out of ${h.name} today`, body: "Most hotels ask you to be out by late morning." });
  }

  // Soonest first; beyond the cap, the far ones wait for a later sync.
  return out.sort((a, b) => a.at.getTime() - b.at.getTime()).slice(0, MAX);
}
