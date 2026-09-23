import "server-only";
import type { TripBundle } from "./trip-service";

export type TripNotification = {
  id: string;
  icon: string;
  title: string;
  body: string;
  tone: "info" | "warning" | "danger" | "success";
  minutesUntil?: number;
};

/**
 * Smart notifications computed from real trip state. Deliberately conservative —
 * only surface things that change what the traveler does next.
 */
export function computeNotifications(bundle: TripBundle, now = new Date()): TripNotification[] {
  const { trip, flights, reservations, expenses, weather, days, hotels } = bundle;
  const out: TripNotification[] = [];
  const isUpcoming = trip.startDate > now;
  const daysUntilStart = Math.ceil((trip.startDate.getTime() - now.getTime()) / 86400000);
  const dayOfTrip = Math.floor((now.getTime() - trip.startDate.getTime()) / 86400000) + 1;

  // Flights within 48h
  for (const f of flights) {
    const mins = (f.departAt.getTime() - now.getTime()) / 60000;
    if (mins > 0 && mins <= 2880) {
      out.push({
        id: `flight-${f.id}`,
        icon: "✈️",
        title: `${f.airline} ${f.flightNumber} departs in ${Math.round(mins / 60)}h`,
        body: `${f.originCode} → ${f.destCode} · Confirmation ${f.confirmation ?? "—"}`,
        tone: mins < 300 ? "danger" : "info",
        minutesUntil: mins,
      });
    }
  }

  // Reservations within 24h
  for (const r of reservations) {
    const mins = (r.dateTime.getTime() - now.getTime()) / 60000;
    if (mins > 0 && mins <= 1440 && r.type !== "FLIGHT") {
      out.push({
        id: `res-${r.id}`,
        icon: r.type === "RESTAURANT" ? "🍣" : r.type === "TRAIN" ? "🚆" : "🎟️",
        title: `${r.title} in ${Math.round(mins / 60)}h`,
        body: [r.locationName, r.confirmationNumber ? `Conf #${r.confirmationNumber}` : null]
          .filter(Boolean)
          .join(" · "),
        tone: mins < 60 ? "danger" : "info",
        minutesUntil: mins,
      });
    }
  }

  // Hotel check-in today
  if (!isUpcoming) {
    for (const h of hotels) {
      const ci = h.checkIn;
      if (
        ci.getFullYear() === now.getFullYear() &&
        ci.getMonth() === now.getMonth() &&
        ci.getDate() === now.getDate()
      ) {
        const hours = (ci.getTime() - now.getTime()) / 3600000 + 15; // standard 3pm check-in
        out.push({
          id: `hotel-${h.id}`,
          icon: "🏨",
          title: `Hotel check-in: ${h.name}`,
          body: `Confirmation ${h.confirmationNumber ?? "—"}${hours > 0 ? ` · check-in opens ~3 PM` : ""}`,
          tone: "info",
        });
      }
    }
  }

  // Rain during an activity window
  const rainyDays = weather.filter((w) => w.rainProb >= 55).slice(0, 2);
  for (const w of rainyDays) {
    const affected = days
      .find((d) => d.date.toISOString().slice(0, 10) === w.date.toISOString().slice(0, 10))
      ?.items.filter((i) => ["ACTIVITY", "ATTRACTION"].includes(i.type))
      .slice(0, 1);
    out.push({
      id: `weather-${w.id}`,
      icon: "🌧️",
      title: `${w.rainProb}% rain on ${w.date.toLocaleDateString("en-US", { month: "short", day: "numeric" })} (${w.city})`,
      body: affected?.length
        ? `${affected[0].title} may be affected — ask AI to optimize for weather`
        : "Mostly indoor-friendly alternatives available",
      tone: "warning",
    });
  }

  // Budget thresholds
  const spent = expenses.reduce((s, e) => s + e.amountHome, 0);
  const pct = trip.budgetAmount > 0 ? spent / trip.budgetAmount : 0;
  if (pct >= 0.8 && !isUpcoming) {
    out.push({
      id: "budget-80",
      icon: "💳",
      title: `You've used ${Math.round(pct * 100)}% of your budget`,
      body: `${Math.round(trip.budgetAmount - spent).toLocaleString()} ${trip.homeCurrency} remaining`,
      tone: pct >= 1 ? "danger" : "warning",
    });
  }

  // Trip start countdown
  if (isUpcoming && daysUntilStart <= 14) {
    out.push({
      id: "countdown",
      icon: "🧳",
      title: `Trip starts in ${daysUntilStart} day${daysUntilStart === 1 ? "" : "s"}`,
      body:
        daysUntilStart <= 3
          ? "Time to finish packing and check flight check-in"
          : "Check the Before-Trip checklist to stay ahead",
      tone: "success",
    });
  }

  void dayOfTrip;
  return out.sort((a, b) => (a.minutesUntil ?? Infinity) - (b.minutesUntil ?? Infinity));
}
