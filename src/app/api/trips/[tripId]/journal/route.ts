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

export async function PATCH(req: Request, { params }: { params: Promise<{ tripId: string }> }) {
  return handle(async () => {
    const user = await requireUser();
    const { tripId } = await params;
    const body = await readJson<{
      id?: string;
      title?: string;
      body?: string | null;
      date?: string;
      locationName?: string | null;
      mood?: string | null;
      photos?: string[];
    }>(req);
    if (!body.id) return json({ error: "id required" }, 400);
    const existing = await db.journalEntry.findFirst({
      where: { id: body.id, tripId, trip: { userId: user.id } },
    });
    if (!existing) return json({ error: "Not found" }, 404);

    const patch: Record<string, unknown> = {};
    if (body.title != null) {
      if (!body.title.trim()) return json({ error: "title can't be empty" }, 400);
      patch.title = body.title.trim();
    }
    if (body.body !== undefined) patch.body = body.body?.trim() || null;
    if (body.locationName !== undefined) patch.locationName = body.locationName?.trim() || null;
    if (body.mood !== undefined) patch.mood = body.mood || null;
    if (body.photos !== undefined) patch.photos = JSON.stringify(body.photos.slice(0, 12));
    if (body.date) {
      const d = new Date(body.date);
      if (isNaN(d.getTime())) return json({ error: "Invalid date" }, 400);
      patch.date = d;
    }

    const entry = await db.journalEntry.update({ where: { id: body.id }, data: patch });
    return json({ entry });
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
