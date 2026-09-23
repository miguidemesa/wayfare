import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { requireTrip } from "@/lib/trip-access";
import { handle, json, readJson } from "@/lib/api-helpers";
import { generatePackingList } from "@/lib/planner";

export async function GET(_req: Request, { params }: { params: Promise<{ tripId: string }> }) {
  return handle(async () => {
    const user = await requireUser();
    const { tripId } = await params;
    await requireTrip(tripId, user.id);
    const items = await db.checklistItem.findMany({
      where: { tripId, trip: { userId: user.id } },
      orderBy: [{ section: "asc" }, { order: "asc" }],
    });
    return json({ checklist: items });
  });
}

export async function POST(req: Request, { params }: { params: Promise<{ tripId: string }> }) {
  return handle(async () => {
    const user = await requireUser();
    const { tripId } = await params;
    await requireTrip(tripId, user.id);
    const trip = await requireTrip(tripId, user.id);
    const body = await readJson<{ action?: string; text?: string; section?: string; category?: string }>(req);

    if (body.action === "generate") {
      const daysCount =
        Math.round((trip.endDate.getTime() - trip.startDate.getTime()) / 86400000) + 1;
      const weather = await db.weatherSnapshot.findMany({ where: { tripId } });
      const rainyDaysExpected = weather.some((w) => w.rainProb >= 55);
      const dests = await db.destination.findMany({ where: { tripId }, orderBy: { order: "asc" } });
      const generated = generatePackingList({
        daysCount,
        cities: dests.map((d) => d.name),
        interests: JSON.parse(trip.interests || "[]"),
        rainyDaysExpected,
      });
      // Avoid duplicating texts that already exist
      const existing = new Set(
        (await db.checklistItem.findMany({ where: { tripId }, select: { text: true } })).map(
          (i) => i.text
        )
      );
      let order = 100;
      for (const g of generated) {
        if (existing.has(g.text)) continue;
        await db.checklistItem.create({
          data: {
            tripId,
            section: g.section,
            text: g.text,
            category: g.category,
            aiGenerated: true,
            order: order++,
          },
        });
      }
      return json({ generated: generated.length }, 201);
    }

    if (!body.text?.trim()) return json({ error: "text required" }, 400);
    const count = await db.checklistItem.count({ where: { tripId } });
    const item = await db.checklistItem.create({
      data: {
        tripId,
        section: body.section === "PACKING" ? "PACKING" : "BEFORE_TRIP",
        text: body.text.trim(),
        category: body.category ?? "Other",
        order: count + 10,
      },
    });
    return json({ item }, 201);
  });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ tripId: string }> }) {
  return handle(async () => {
    const user = await requireUser();
    const { tripId } = await params;
    await requireTrip(tripId, user.id);
    const body = await readJson<{ id: string; checked?: boolean; text?: string }>(req);
    const item = await db.checklistItem.findFirst({
      where: { id: body.id, tripId, trip: { userId: user.id } },
    });
    if (!item) return json({ error: "Not found" }, 404);
    const updated = await db.checklistItem.update({
      where: { id: body.id },
      data: {
        ...(body.checked != null ? { checked: !!body.checked } : {}),
        ...(body.text != null ? { text: body.text.trim() } : {}),
      },
    });
    return json({ item: updated });
  });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ tripId: string }> }) {
  return handle(async () => {
    const user = await requireUser();
    const { tripId } = await params;
    await requireTrip(tripId, user.id);
    const id = new URL(req.url).searchParams.get("id");
    if (!id) return json({ error: "id required" }, 400);
    const item = await db.checklistItem.findFirst({
      where: { id, tripId, trip: { userId: user.id } },
    });
    if (!item) return json({ error: "Not found" }, 404);
    await db.checklistItem.delete({ where: { id } });
    return json({ ok: true });
  });
}
