import { db } from "@/lib/db";
import { requireUser, HttpError } from "@/lib/auth";
import { handle, json, readJson } from "@/lib/api-helpers";

export async function GET(_req: Request, { params }: { params: Promise<{ tripId: string }> }) {
  return handle(async () => {
    const user = await requireUser();
    const { tripId } = await params;
    const reservations = await db.reservation.findMany({
      where: { tripId, trip: { userId: user.id } },
      orderBy: { dateTime: "asc" },
    });
    return json({ reservations });
  });
}

type Body = {
  type?: string;
  title?: string;
  dateTime?: string;
  confirmationNumber?: string;
  locationName?: string;
  cost?: number;
  currency?: string;
  cancellationDeadline?: string;
  notes?: string;
};

async function assertOwned(tripId: string, userId: string) {
  const t = await db.trip.findFirst({ where: { id: tripId, userId }, select: { id: true } });
  if (!t) throw new HttpError(404, "Trip not found");
}

export async function POST(req: Request, { params }: { params: Promise<{ tripId: string }> }) {
  return handle(async () => {
    const user = await requireUser();
    const { tripId } = await params;
    await assertOwned(tripId, user.id);
    const body = await readJson<Body>(req);
    if (!body.title?.trim() || !body.dateTime) {
      return json({ error: "title and dateTime are required" }, 400);
    }
    const dt = new Date(body.dateTime);
    if (isNaN(dt.getTime())) return json({ error: "Invalid dateTime" }, 400);

    const reservation = await db.reservation.create({
      data: {
        tripId,
        type: body.type ?? "ACTIVITY",
        title: body.title.trim(),
        dateTime: dt,
        confirmationNumber: body.confirmationNumber?.trim() || null,
        locationName: body.locationName?.trim() || null,
        cost: body.cost != null ? Number(body.cost) : null,
        currency: body.currency ?? null,
        cancellationDeadline: body.cancellationDeadline
          ? new Date(body.cancellationDeadline)
          : null,
        notes: body.notes ?? null,
      },
    });
    return json({ reservation }, 201);
  });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ tripId: string }> }) {
  return handle(async () => {
    const user = await requireUser();
    const { tripId } = await params;
    const body = await readJson<Body & { id: string }>(req);
    const existing = await db.reservation.findFirst({
      where: { id: body.id, tripId, trip: { userId: user.id } },
    });
    if (!existing) return json({ error: "Not found" }, 404);

    const patch: Record<string, unknown> = {};
    if (body.title != null) patch.title = body.title.trim();
    if (body.type != null) patch.type = body.type;
    if (body.dateTime) patch.dateTime = new Date(body.dateTime);
    if (body.confirmationNumber !== undefined)
      patch.confirmationNumber = body.confirmationNumber || null;
    if (body.locationName !== undefined) patch.locationName = body.locationName || null;
    if (body.cost !== undefined) patch.cost = body.cost == null ? null : Number(body.cost);
    if (body.notes !== undefined) patch.notes = body.notes;

    const reservation = await db.reservation.update({ where: { id: body.id }, data: patch });
    return json({ reservation });
  });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ tripId: string }> }) {
  return handle(async () => {
    const user = await requireUser();
    const { tripId } = await params;
    const id = new URL(req.url).searchParams.get("id");
    if (!id) return json({ error: "id required" }, 400);
    const r = await db.reservation.findFirst({
      where: { id, tripId, trip: { userId: user.id } },
    });
    if (!r) return json({ error: "Not found" }, 404);
    await db.reservation.delete({ where: { id } });
    return json({ ok: true });
  });
}
