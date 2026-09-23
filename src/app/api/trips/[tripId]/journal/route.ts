import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { handle, json, readJson } from "@/lib/api-helpers";

export async function GET(_req: Request, { params }: { params: Promise<{ tripId: string }> }) {
  return handle(async () => {
    const user = await requireUser();
    const { tripId } = await params;
    const entries = await db.journalEntry.findMany({
      where: { tripId, trip: { userId: user.id } },
      orderBy: { date: "desc" },
    });
    return json({ journal: entries });
  });
}

export async function POST(req: Request, { params }: { params: Promise<{ tripId: string }> }) {
  return handle(async () => {
    const user = await requireUser();
    const { tripId } = await params;
    const trip = await db.trip.findFirst({
      where: { id: tripId, userId: user.id },
      select: { id: true },
    });
    if (!trip) return json({ error: "Trip not found" }, 404);
    const body = await readJson<{
      title?: string;
      body?: string;
      date?: string;
      locationName?: string;
      mood?: string;
      photos?: string[];
    }>(req);
    if (!body.title?.trim()) return json({ error: "title required" }, 400);
    const entry = await db.journalEntry.create({
      data: {
        tripId,
        title: body.title.trim(),
        body: body.body?.trim() || null,
        date: body.date ? new Date(body.date) : new Date(),
        locationName: body.locationName?.trim() || null,
        mood: body.mood ?? null,
        photos: JSON.stringify((body.photos ?? []).slice(0, 12)),
      },
    });
    return json({ entry }, 201);
  });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ tripId: string }> }) {
  return handle(async () => {
    const user = await requireUser();
    const { tripId } = await params;
    const id = new URL(req.url).searchParams.get("id");
    if (!id) return json({ error: "id required" }, 400);
    const entry = await db.journalEntry.findFirst({
      where: { id, tripId, trip: { userId: user.id } },
    });
    if (!entry) return json({ error: "Not found" }, 404);
    await db.journalEntry.delete({ where: { id } });
    return json({ ok: true });
  });
}
