import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { requireTrip } from "@/lib/trip-access";
import { handle, json, readJson } from "@/lib/api-helpers";
import { poiById } from "@/lib/data/pois";
import { parseTimeToMinutes } from "@/lib/utils";
import { ITEM_TYPES, type ItemType } from "@/lib/types";

/** Itinerary mutations: create days/items, bulk reorder. */

type CreateBody = {
  kind: "day" | "item";
  date?: string; // for day
  city?: string;
  title?: string;
  dayId?: string; // for item
  type?: string;
  startTime?: string; // HH:MM
  durationMin?: number;
  poiId?: string;
  cost?: number;
  currency?: string;
  notes?: string;
};

export async function POST(req: Request, { params }: { params: Promise<{ tripId: string }> }) {
  return handle(async () => {
    const user = await requireUser();
    const { tripId } = await params;
    const trip = await requireTrip(tripId, user.id);
    const body = await readJson<CreateBody>(req);

    if (body.kind === "day") {
      if (!body.date) return json({ error: "date required" }, 400);
      const date = new Date(body.date + "T00:00:00");
      if (isNaN(date.getTime())) return json({ error: "Invalid date" }, 400);

      const day = await db.$transaction(async (tx) => {
        const count = await tx.itineraryDay.count({ where: { tripId } });
        const maxIndex = await tx.itineraryDay.aggregate({
          where: { tripId },
          _max: { dayIndex: true },
        });
        return tx.itineraryDay.create({
          data: {
            tripId,
            date,
            city: body.city ?? trip.subtitle?.split("·")[0]?.trim() ?? "Trip",
            title: body.title ?? null,
            dayIndex: (maxIndex._max.dayIndex ?? count) + 1,
          },
        });
      });
      return json({ day }, 201);
    }

    // item
    if (!body.dayId) return json({ error: "dayId required" }, 400);
    const day = await db.itineraryDay.findFirst({ where: { id: body.dayId, tripId } });
    if (!day) return json({ error: "Day not found" }, 404);

    if (body.type != null && !ITEM_TYPES.includes(body.type as ItemType)) {
      return json({ error: "Invalid item type" }, 400);
    }

    const poi = body.poiId ? poiById(body.poiId) : undefined;
    const startTime = body.startTime ? parseTimeToMinutes(body.startTime) : null;
    const durationMin = Math.max(5, Math.min(720, Number(body.durationMin) || poi?.durationMin || 60));
    const order = await db.itineraryItem.count({ where: { dayId: day.id } });

    const item = await db.itineraryItem.create({
      data: {
        tripId,
        dayId: day.id,
        type: body.type ?? (poi?.category === "RESTAURANT" ? "RESTAURANT" : "ACTIVITY"),
        title: (body.title ?? poi?.name ?? "New item").slice(0, 200),
        startTime,
        endTime: startTime != null ? startTime + durationMin : null,
        durationMin,
        placeName: poi?.name ?? null,
        lat: poi?.lat,
        lng: poi?.lng,
        neighborhood: poi?.neighborhood,
        cost: body.cost ?? (poi?.avgCost || undefined),
        currency: body.currency ?? poi?.currency,
        notes: body.notes ?? null,
        confirmed: false,
        order,
      },
    });
    return json({ item }, 201);
  });
}

type ReorderBody = {
  dayId: string;
  /** Full ordered list of item ids for the day */
  itemIds: string[];
};

export async function PATCH(req: Request, { params }: { params: Promise<{ tripId: string }> }) {
  return handle(async () => {
    const user = await requireUser();
    const { tripId } = await params;
    await requireTrip(tripId, user.id);
    const body = await readJson<ReorderBody>(req);
    if (!Array.isArray(body.itemIds) || body.itemIds.length === 0 || body.itemIds.length > 200) {
      return json({ error: "itemIds must be a non-empty array" }, 400);
    }

    const day = await db.itineraryDay.findFirst({ where: { id: body.dayId, tripId } });
    if (!day) return json({ error: "Day not found" }, 404);

    // Verify every id belongs to this day before writing anything — prevents
    // cross-trip ids from being silently re-parented.
    const owned = await db.itineraryItem.findMany({
      where: { id: { in: body.itemIds }, dayId: day.id, tripId },
      select: { id: true },
    });
    const ownedIds = new Set(owned.map((o) => o.id));
    if (body.itemIds.some((id) => !ownedIds.has(id))) {
      return json({ error: "One or more items do not belong to this day" }, 400);
    }

    await db.$transaction(
      body.itemIds.map((id, i) =>
        db.itineraryItem.update({ where: { id }, data: { order: i } })
      )
    );
    return json({ ok: true });
  });
}
