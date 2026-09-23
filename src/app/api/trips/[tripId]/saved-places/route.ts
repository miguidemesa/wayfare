import { db } from "@/lib/db";
import { requireUser, HttpError } from "@/lib/auth";
import { handle, json, readJson } from "@/lib/api-helpers";

async function assertOwnedTrip(tripId: string, userId: string) {
  const trip = await db.trip.findFirst({ where: { id: tripId, userId }, select: { id: true } });
  if (!trip) throw new HttpError(404, "Trip not found");
}

export async function GET(_req: Request, { params }: { params: Promise<{ tripId: string }> }) {
  return handle(async () => {
    const user = await requireUser();
    const { tripId } = await params;
    const saved = await db.savedPlace.findMany({
      where: { tripId, trip: { userId: user.id } },
      orderBy: { createdAt: "desc" },
    });
    return json({ savedPlaces: saved });
  });
}

type Body = {
  poiId?: string;
  name?: string;
  category?: string;
  lat?: number;
  lng?: number;
  address?: string;
  rating?: number;
  priceLevel?: number;
  openHours?: string;
  notes?: string;
};

export async function POST(req: Request, { params }: { params: Promise<{ tripId: string }> }) {
  return handle(async () => {
    const user = await requireUser();
    const { tripId } = await params;
    await assertOwnedTrip(tripId, user.id);
    const body = await readJson<Body>(req);

    if (body.poiId) {
      // Save from the curated dataset
      const { poiById } = await import("@/lib/data/pois");
      const p = poiById(body.poiId);
      if (!p) return json({ error: "Unknown place" }, 404);
      const dupe = await db.savedPlace.findFirst({ where: { tripId, name: p.name } });
      if (dupe) return json({ savedPlace: dupe, alreadySaved: true });
      const sp = await db.savedPlace.create({
        data: {
          tripId,
          name: p.name,
          category: p.category,
          cuisine: p.cuisine,
          lat: p.lat,
          lng: p.lng,
          address: `${p.neighborhood}, ${p.city}`,
          rating: p.rating,
          priceLevel: p.priceLevel,
          openHours: p.hours,
        },
      });
      return json({ savedPlace: sp }, 201);
    }

    if (!body.name || body.lat == null || body.lng == null) {
      return json({ error: "name, lat and lng required" }, 400);
    }
    const sp = await db.savedPlace.create({
      data: {
        tripId,
        name: body.name.trim(),
        category: body.category ?? "OTHER",
        lat: Number(body.lat),
        lng: Number(body.lng),
        address: body.address ?? null,
        rating: body.rating ?? null,
        priceLevel: body.priceLevel ?? null,
        openHours: body.openHours ?? null,
        notes: body.notes ?? null,
      },
    });
    return json({ savedPlace: sp }, 201);
  });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ tripId: string }> }) {
  return handle(async () => {
    const user = await requireUser();
    const { tripId } = await params;
    const id = new URL(req.url).searchParams.get("id");
    if (!id) return json({ error: "id query param required" }, 400);
    const sp = await db.savedPlace.findFirst({ where: { id, tripId, trip: { userId: user.id } } });
    if (!sp) return json({ error: "Not found" }, 404);
    await db.savedPlace.delete({ where: { id } });
    return json({ ok: true });
  });
}
