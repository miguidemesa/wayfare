// What needs the traveller's attention now, worked out on the phone from the
// trip itself: it knows the traveller's own clock, and it works offline.
// Pure, like trip.ts; covered by alerts.test.ts.
//
// Deliberately few and conservative: each alert changes what someone does
// next, and says only what the data supports.

import type { TripBundle } from "./types";
import { addDays, dayKey, localKey, nextStop, totalSpent, tripPhase, daysBetween } from "./trip";

export type AlertTone = "info" | "warning" | "danger";

/** Where an alert's one action goes. */
export type AlertAction =
  | { kind: "bookings" }
  | { kind: "packing" }
  | { kind: "spend" }
  | { kind: "plan"; dayIndex: number }
  | { kind: "stop"; itemId: string }
  | { kind: "ask"; date: string; prompt: string }
  | { kind: "directions"; lat: number | null; lng: number | null; name: string; city?: string };

export type TripAlert = {
  id: string;
  tone: AlertTone;
  title: string;
  body: string;
  action: { label: string; to: AlertAction };
  /** For ordering: how soon it matters. */
  inMin: number;
};

const H = 60;

function hoursLabel(min: number): string {
  if (min < 60) return `${Math.max(1, Math.round(min))} min`;
  const h = Math.round(min / 60);
  return `${h}h`;
}

function dayLabel(key: string, today: string): string {
  if (key === today) return "today";
  if (key === addDays(today, 1)) return "tomorrow";
  return new Date(key + "T12:00:00").toLocaleDateString("en-US", { weekday: "long" });
}

export function tripAlerts(bundle: TripBundle, now: Date = new Date()): TripAlert[] {
  const { trip, flights, reservations, hotels, weather, expenses, days, checklist } = bundle;
  const out: TripAlert[] = [];
  const today = localKey(now);
  const minsTo = (iso: string) => (new Date(iso).getTime() - now.getTime()) / 60000;
  const phase = tripPhase(trip.startDate, trip.endDate, now);

  // Flights in the next 48 hours.
  for (const f of flights) {
    const m = minsTo(f.departAt);
    if (m <= 0 || m > 48 * H) continue;
    const where = [f.terminal ? `Terminal ${f.terminal}` : null, f.gate ? `Gate ${f.gate}` : null].filter(Boolean).join(", ");
    out.push({
      id: `flight-${f.id}`,
      tone: m < 5 * H ? "danger" : "info",
      title: `${[f.airline, f.flightNumber].filter(Boolean).join(" ")} leaves in ${hoursLabel(m)}`,
      body: [`${f.originCode || f.originCity} → ${f.destCode || f.destCity}`, where || null, f.confirmation ? `Confirmation ${f.confirmation}` : null].filter(Boolean).join(" · "),
      action: { label: "See booking", to: { kind: "bookings" } },
      inMin: m,
    });
  }

  // Reservations in the next 24 hours, and free cancellation about to end.
  for (const r of reservations) {
    const m = minsTo(r.dateTime);
    if (m > 0 && m <= 24 * H) {
      out.push({
        id: `res-${r.id}`,
        tone: m < H ? "danger" : "info",
        title: `${r.title} in ${hoursLabel(m)}`,
        body: [r.locationName, r.confirmationNumber ? `Confirmation ${r.confirmationNumber}` : null].filter(Boolean).join(" · ") || "Booked",
        action: r.locationName
          ? { label: "Directions", to: { kind: "directions", lat: r.lat ?? null, lng: r.lng ?? null, name: r.locationName } }
          : { label: "See booking", to: { kind: "bookings" } },
        inMin: m,
      });
    }
    if (r.cancellationDeadline) {
      const c = minsTo(r.cancellationDeadline);
      if (c > 0 && c <= 48 * H) {
        out.push({
          id: `cancel-${r.id}`,
          tone: "warning",
          title: `Free cancellation for ${r.title} ends in ${hoursLabel(c)}`,
          body: "Keep it, or cancel before then at no cost.",
          action: { label: "See booking", to: { kind: "bookings" } },
          inMin: c,
        });
      }
    }
  }

  // Checking in or out today.
  for (const h of hotels) {
    if (dayKey(h.checkIn) === today) {
      out.push({
        id: `checkin-${h.id}`,
        tone: "info",
        title: `Check in at ${h.name} today`,
        body: [h.address, h.confirmationNumber ? `Confirmation ${h.confirmationNumber}` : null].filter(Boolean).join(" · ") || "Have your confirmation handy.",
        action: { label: "Directions", to: { kind: "directions", lat: h.lat, lng: h.lng, name: h.name, city: h.destinationName ?? undefined } },
        inMin: 0,
      });
    }
    if (dayKey(h.checkOut) === today) {
      out.push({
        id: `checkout-${h.id}`,
        tone: "info",
        title: `Check out of ${h.name} today`,
        body: "Most hotels ask you to be out by late morning.",
        action: { label: "See booking", to: { kind: "bookings" } },
        inMin: 0,
      });
    }
  }

  // Leave soon for the next stop.
  if (phase === "during") {
    const next = nextStop(days, now);
    if (next && next.leaveInMin != null && next.leaveInMin <= 45) {
      out.push({
        id: `leave-${next.item.id}`,
        tone: next.leaveInMin <= 10 ? "danger" : "warning",
        title: next.leaveInMin === 0 ? `Time to go: ${next.item.title}` : `Leave in ${hoursLabel(next.leaveInMin)} for ${next.item.title}`,
        body: next.day.items.indexOf(next.item) > 0 ? "Counting the time to get there." : "It's your next stop.",
        action: {
          label: "Directions",
          to: { kind: "directions", lat: next.item.lat ?? null, lng: next.item.lng ?? null, name: next.item.placeName || next.item.title, city: next.day.city },
        },
        inMin: next.leaveInMin,
      });
    }
  }

  // Rain today or tomorrow: real forecasts only, never seasonal estimates.
  for (const w of weather) {
    const key = dayKey(w.date);
    if (w.source !== "live-open-meteo" || w.rainProb < 55) continue;
    if (key !== today && key !== addDays(today, 1)) continue;
    const idx = days.findIndex((d) => dayKey(d.date) === key);
    if (idx < 0 || !days[idx].items.length) continue;
    const when = dayLabel(key, today);
    out.push({
      id: `rain-${w.city}-${key}`,
      tone: "warning",
      title: `${Math.round(w.rainProb)}% chance of rain ${when} in ${w.city}`,
      body: "Anything outdoors on the plan? Wayfare can suggest indoor swaps.",
      action: { label: "Ask for indoor options", to: { kind: "ask", date: key, prompt: `It might rain ${when}. What could we swap for indoor options?` } },
      inMin: key === today ? 0 : 12 * H,
    });
  }

  // Budget, once the trip has started.
  if (trip.budgetAmount > 0 && phase !== "before") {
    const spent = totalSpent(expenses);
    const pct = spent / trip.budgetAmount;
    if (pct >= 0.8) {
      out.push({
        id: pct >= 1 ? "budget-over" : "budget-80",
        tone: pct >= 1 ? "danger" : "warning",
        title: pct >= 1 ? "You're over budget" : `You've used ${Math.round(pct * 100)}% of the budget`,
        body: "See where it went and what's left per day.",
        action: { label: "Open Spend", to: { kind: "spend" } },
        inMin: 24 * H,
      });
    }
  }

  // Getting ready: two weeks out.
  if (phase === "before") {
    const until = daysBetween(today, dayKey(trip.startDate));
    if (until <= 14) {
      const packing = checklist.filter((c) => c.section === "PACKING");
      const left = packing.filter((c) => !c.checked).length;
      const empty = days.findIndex((d) => d.items.length === 0);
      if (empty >= 0 && until <= 7) {
        out.push({
          id: "unplanned",
          tone: "info",
          title: `Day ${empty + 1} has nothing planned yet`,
          body: `You leave in ${until} ${until === 1 ? "day" : "days"}.`,
          action: { label: "Plan it", to: { kind: "plan", dayIndex: empty } },
          inMin: until * 24 * H,
        });
      }
      if (left > 0) {
        out.push({
          id: "packing",
          tone: until <= 3 ? "warning" : "info",
          title: until === 1 ? "You leave tomorrow" : `You leave in ${until} days`,
          body: `${left} ${left === 1 ? "thing" : "things"} still to pack.`,
          action: { label: "Packing list", to: { kind: "packing" } },
          inMin: until * 24 * H + 1,
        });
      }
    }
  }

  return out.sort((a, b) => a.inMin - b.inMin);
}
