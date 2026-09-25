import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { requireTrip } from "@/lib/trip-access";
import { handle, json, readJson } from "@/lib/api-helpers";
import { generateItinerary, localDateKey, type PlannedDay } from "@/lib/planner";
import { normalizeInterests, readStoredBrief } from "@/lib/brief";

/**
 * AI itinerary generation.
 * POST { apply: false } → preview plan
 * POST { apply: true, plan } → persist the given plan into itinerary days/items
 */
export async function POST(req: Request, { params }: { params: Promise<{ tripId: string }> }) {
  return handle(async () => {
    const user = await requireUser();
    const { tripId } = await params;
    const trip = await requireTrip(tripId, user.id);

    const body = await readJson<{
      apply?: boolean;
      plan?: PlannedDay[];
      pace?: "relaxed" | "balanced" | "packed";
    }>(req);

    if (body.apply) {
      const plan = body.plan;
      if (!Array.isArray(plan) || !plan.length) {
        return json({ error: "plan required for apply" }, 400);
      }
      // Caps: a malicious or malformed client must not be able to create
      // thousands of rows in one request.
      if (plan.length > 31) return json({ error: "plan exceeds 31 days" }, 400);
      const totalItems = plan.reduce((s, d) => s + (d.items?.length ?? 0), 0);
      if (totalItems > 500) return json({ error: "plan exceeds 500 items" }, 400);

      const created: string[] = [];
      await db.$transaction(async (tx) => {
        let dayIndex = (await tx.itineraryDay.aggregate({ where: { tripId }, _max: { dayIndex: true } }))._max.dayIndex ?? 0;
        for (const d of plan) {
          const date = new Date(d.date);
          if (isNaN(date.getTime())) throw new Error("Invalid date in plan");
          date.setHours(0, 0, 0, 0);
          let day = await tx.itineraryDay.findFirst({ where: { tripId, date } });
          if (!day) {
            dayIndex += 1;
            day = await tx.itineraryDay.create({
              data: {
                tripId,
                date,
                city: d.city ?? trip.subtitle?.split("·")[0]?.trim() ?? "Trip",
                title: d.title ?? null,
                dayIndex,
              },
            });
          }
          let i = await tx.itineraryItem.count({ where: { dayId: day.id } });
          for (const it of d.items ?? []) {
            if (!it?.title) continue;
            await tx.itineraryItem.create({
              data: {
                tripId,
                dayId: day.id,
                type: it.type === "RESTAURANT" ? "RESTAURANT" : "ACTIVITY",
                title: String(it.title).slice(0, 200),
                startTime: it.startTime ?? null,
                endTime: it.endTime ?? null,
                durationMin: Math.max(5, Math.min(720, it.durationMin || 60)),
                placeName: it.placeName ?? null,
                neighborhood: it.neighborhood ?? null,
                lat: it.lat ?? null,
                lng: it.lng ?? null,
                cost: it.cost ?? null,
                currency: it.currency ?? null,
                notes: it.notes ?? null,
                reason: it.reason ? String(it.reason).slice(0, 300) : null,
                confirmed: false,
                transportMode: it.transportMode,
                transportMin: it.transportMin,
                transportCost: it.transportCost,
                order: i++,
              },
            });
          }
          created.push(day.id);
        }
      });
      return json({ appliedDays: created.length }, 201);
    }

    // Preview generation
    const dates: Date[] = [];
    const start = new Date(trip.startDate);
    while (start <= trip.endDate && dates.length < 21) {
      dates.push(new Date(start));
      start.setDate(start.getDate() + 1);
    }
    const destinations = await db.destination.findMany({ where: { tripId }, orderBy: { order: "asc" } });
    const cities = destinations.map((d) => d.name).filter(Boolean);
    if (!cities.length) return json({ error: "Add at least one destination first" }, 400);

    // Everything the planner plans around: the brief, where they're sleeping,
    // the forecast, and anything already booked.
    const brief = readStoredBrief(trip.brief);
    const [hotels, weather, reservations] = await Promise.all([
      db.hotel.findMany({ where: { tripId, lat: { not: null }, lng: { not: null } } }),
      db.weatherSnapshot.findMany({ where: { tripId } }),
      db.reservation.findMany({ where: { tripId } }),
    ]);
    const rain: Record<string, number> = {};
    for (const w of weather) rain[`${w.city}|${localDateKey(w.date)}`] = w.rainProb;

    const plan = generateItinerary({
      cities,
      dates,
      interests: brief ? brief.interests : normalizeInterests(JSON.parse(trip.interests || "[]")),
      pace: body.pace ?? brief?.pace ?? (trip.pace as "relaxed" | "balanced" | "packed") ?? "balanced",
      currency: trip.homeCurrency,
      startLate: true,
      endEarly: true,
      brief,
      hotels: hotels.map((h) => ({ name: h.name, lat: h.lat!, lng: h.lng!, checkIn: h.checkIn, checkOut: h.checkOut })),
      rain,
      fixed: reservations.map((r) => {
        const start = r.dateTime.getHours() * 60 + r.dateTime.getMinutes();
        return { date: localDateKey(r.dateTime), start, end: start + 90 };
      }),
    });

    // Must-dos the plan couldn't place (not in the guide, or no room), so the
    // app can say so rather than let them silently vanish.
    const placed = new Set(plan.flatMap((d) => d.items.map((i) => i.poiId)));
    const unplacedMustDos = (brief?.mustDos ?? []).filter((m) => !m.poiId || !placed.has(m.poiId)).map((m) => m.name);

    const totalTravelMin = plan.reduce((s, d) => s + d.estTravelMin, 0);
    const estCost = plan.reduce(
      (s, d) =>
        s +
        d.items.reduce((ss, i) => ss + (i.cost ?? 0), 0),
      0
    );

    return json({ plan, totalTravelMin, estCost, unplacedMustDos });
  });
}
