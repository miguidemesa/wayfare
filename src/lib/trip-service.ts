import "server-only";
import { cache } from "react";
import { db } from "./db";
import { HttpError } from "./auth";

export const requireTrip = cache(async (tripId: string, userId: string) => {
  const user = await db.user.findUnique({ where: { id: userId }, select: { email: true } });
  const trip = await db.trip.findFirst({
    where: {
      id: tripId,
      OR: [
        { userId },
        ...(user?.email ? [{ travelers: { some: { email: user.email } } }] : []),
      ],
    },
  });
  if (!trip) throw new HttpError(404, "Trip not found");
  return trip;
});

export async function listTrips(userId: string) {
  const user = await db.user.findUnique({ where: { id: userId }, select: { email: true } });
  const trips = await db.trip.findMany({
    where: {
      OR: [
        { userId },
        ...(user?.email ? [{ travelers: { some: { email: user.email } } }] : []),
      ],
    },
    orderBy: { startDate: "asc" },
    include: {
      _count: { select: { days: true, items: true, expenses: true } },
      destinations: { orderBy: { order: "asc" } },
      expenses: { select: { amountHome: true } },
      travelers: { select: { name: true, email: true, isOwner: true } },
    },
  });
  return trips.map((t) => ({
    ...t,
    spent: t.expenses.reduce((s, e) => s + e.amountHome, 0),
    expenses: undefined,
  }));
}

export type TripBundle = Awaited<ReturnType<typeof getTripBundle>>;

export const getTripBundle = cache(async (tripId: string, userId: string) => {
  const trip = await requireTrip(tripId, userId);
  const [destinations, hotels, flights, days, expenses, reservations, savedPlaces, journal, documents, checklist, travelers, weather] =
    await Promise.all([
      db.destination.findMany({ where: { tripId }, orderBy: { order: "asc" } }),
      db.hotel.findMany({ where: { tripId }, orderBy: { checkIn: "asc" } }),
      db.flight.findMany({ where: { tripId }, orderBy: { departAt: "asc" } }),
      db.itineraryDay.findMany({
        where: { tripId },
        orderBy: { date: "asc" },
        include: { items: { orderBy: [{ order: "asc" }, { startTime: "asc" }] } },
      }),
      db.expense.findMany({ where: { tripId }, orderBy: { date: "desc" } }),
      db.reservation.findMany({ where: { tripId }, orderBy: { dateTime: "asc" } }),
      db.savedPlace.findMany({ where: { tripId }, orderBy: { createdAt: "desc" } }),
      db.journalEntry.findMany({ where: { tripId }, orderBy: { date: "desc" } }),
      db.documentFile.findMany({ where: { tripId }, orderBy: { createdAt: "desc" } }),
      db.checklistItem.findMany({ where: { tripId }, orderBy: [{ section: "asc" }, { order: "asc" }] }),
      db.traveler.findMany({ where: { tripId }, orderBy: { createdAt: "asc" } }),
      db.weatherSnapshot.findMany({ where: { tripId }, orderBy: { date: "asc" } }),
    ]);

  return {
    trip,
    destinations,
    hotels,
    flights,
    days,
    expenses,
    reservations,
    savedPlaces,
    journal,
    documents,
    checklist,
    travelers,
    weather,
  };
});

export async function computeAnalytics(tripId: string, userId: string) {
  const bundle = await getTripBundle(tripId, userId);
  const { trip, expenses, days, flights, hotels } = bundle;

  const total = expenses.reduce((s, e) => s + e.amountHome, 0);
  const byCategory: Record<string, number> = {};
  const byDay: Record<string, number> = {};
  const byCity: Record<string, number> = {};
  const dayCity = new Map(days.map((d) => [d.date.toISOString().slice(0, 10), d.city]));

  for (const e of expenses) {
    byCategory[e.category] = (byCategory[e.category] ?? 0) + e.amountHome;
    const k = e.date.toISOString().slice(0, 10);
    byDay[k] = (byDay[k] ?? 0) + e.amountHome;
    const city = e.locationName ? dayCity.get(k) : dayCity.get(k);
    if (city) byCity[city] = (byCity[city] ?? 0) + e.amountHome;
  }

  const sortedDays = Object.entries(byDay).sort((a, b) => b[1] - a[1]);
  const mostExpensiveDay = sortedDays[0]?.[0] ?? null;
  const cheapestDay = sortedDays.length ? sortedDays[sortedDays.length - 1][0] : null;

  const meals = expenses.filter((e) => e.category === "FOOD");
  const priciestMeal = [...meals].sort((a, b) => b.amountHome - a.amountHome)[0] ?? null;

  // Most visited neighborhood from itinerary items
  const hoodCount: Record<string, number> = {};
  for (const d of days)
    for (const i of d.items)
      if (i.neighborhood) hoodCount[i.neighborhood] = (hoodCount[i.neighborhood] ?? 0) + 1;
  const topHood = Object.entries(hoodCount).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  // Distance traveled from transport legs + flight great-circle estimates
  let kmTraveled = 0;
  for (const d of days) {
    const geoItems = d.items.filter((i) => i.lat != null && i.lng != null);
    for (let i = 0; i < geoItems.length - 1; i++) {
      kmTraveled += Math.hypot(
        (geoItems[i + 1].lat! - geoItems[i].lat!) * 111,
        ((geoItems[i + 1].lng! - geoItems[i].lng!) * 91.2)
      );
    }
    kmTraveled += d.items.reduce((s, i) => s + (i.transportMode === "TRAIN" ? 8 : 0), 0);
  }
  for (const f of flights) kmTraveled += 3000;

  const favoriteCategory =
    Object.entries(byCategory).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  const placesVisited = days.reduce(
    (s, d) => s + d.items.filter((i) => ["ACTIVITY", "RESTAURANT", "ATTRACTION"].includes(i.type)).length,
    0
  );

  const dayCount =
    Math.round((trip.endDate.getTime() - trip.startDate.getTime()) / 86400000) + 1;

  return {
    days: dayCount,
    cities: new Set(days.map((d) => d.city)).size,
    placesVisited,
    totalSpent: Math.round(total * 100) / 100,
    homeCurrency: trip.homeCurrency,
    budget: trip.budgetAmount,
    byCategory,
    byDay,
    byCity,
    mostExpensiveDay,
    cheapestDay,
    priciestMeal: priciestMeal
      ? { merchant: priciestMeal.merchant, amount: priciestMeal.amountHome }
      : null,
    topNeighborhood: topHood,
    kmTraveled: Math.round(kmTraveled),
    favoriteCategory,
    hotelsStayed: hotels.length,
    flightsTaken: flights.length,
  };
}
