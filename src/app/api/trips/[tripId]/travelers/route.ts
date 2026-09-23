import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { handle, json, readJson } from "@/lib/api-helpers";

export async function POST(req: Request, { params }: { params: Promise<{ tripId: string }> }) {
  return handle(async () => {
    const user = await requireUser();
    const { tripId } = await params;
    const trip = await db.trip.findFirst({ where: { id: tripId, userId: user.id } });
    if (!trip) return json({ error: "Trip not found" }, 404);
    const body = await readJson<{ name?: string; email?: string }>(req);
    const name = body.name?.trim();
    if (!name) return json({ error: "name required" }, 400);
    if (!body.email && !/^\S+@\S+\.\S+$/.test(body.email ?? "")) {
      // allow name-only travelers (companions without accounts)
    }
    const traveler = await db.traveler.create({
      data: {
        tripId,
        name,
        email: body.email?.toLowerCase().trim() || null,
      },
    });
    await db.trip.update({
      where: { id: tripId },
      data: { travelersCount: { increment: 1 } },
    });
    return json({ traveler }, 201);
  });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ tripId: string }> }) {
  return handle(async () => {
    const user = await requireUser();
    const { tripId } = await params;
    const id = new URL(req.url).searchParams.get("id");
    if (!id) return json({ error: "id required" }, 400);
    const t = await db.traveler.findFirst({
      where: {
        id,
        tripId,
        isOwner: false,
        trip: { userId: user.id },
      },
    });
    if (!t) return json({ error: "Not found or owner cannot be removed" }, 404);
    await db.traveler.delete({ where: { id } });
    await db.trip.update({
      where: { id: tripId },
      data: { travelersCount: { decrement: 1 } },
    });
    return json({ ok: true });
  });
}
