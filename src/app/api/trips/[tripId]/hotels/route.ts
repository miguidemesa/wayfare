import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { handle, json, readJson } from "@/lib/api-helpers";

export async function POST(req: Request, { params }: { params: Promise<{ tripId: string }> }) {
  return handle(async () => {
    const user = await requireUser();
    const { tripId } = await params;
    const trip = await db.trip.findFirst({ where: { id: tripId, userId: user.id } });
    if (!trip) return json({ error: "Trip not found" }, 404);
    const body = await readJson<{
      name?: string;
      destinationName?: string;
      address?: string;
      lat?: number;
      lng?: number;
      checkIn?: string;
      checkOut?: string;
      confirmationNumber?: string;
      phone?: string;
      costPerNight?: number;
      currency?: string;
    }>(req);

    if (!body.name?.trim() || !body.checkIn || !body.checkOut) {
      return json({ error: "name, checkIn and checkOut are required" }, 400);
    }
    const ci = new Date(body.checkIn + "T15:00:00");
    const co = new Date(body.checkOut + "T11:00:00");
    if (isNaN(ci.getTime()) || isNaN(co.getTime()) || co <= ci) {
      return json({ error: "Invalid stay dates" }, 400);
    }
    const nights = Math.max(1, Math.round((co.getTime() - ci.getTime()) / 86400000));

    const hotel = await db.hotel.create({
      data: {
        tripId,
        destinationName: body.destinationName?.trim() || null,
        name: body.name.trim(),
        address: body.address?.trim() || null,
        lat: body.lat ?? null,
        lng: body.lng ?? null,
        checkIn: ci,
        checkOut: co,
        nights,
        confirmationNumber: body.confirmationNumber?.trim() || null,
        phone: body.phone?.trim() || null,
        costPerNight: Number(body.costPerNight) || 0,
        currency: body.currency ?? trip.homeCurrency,
      },
    });
    return json({ hotel }, 201);
  });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ tripId: string }> }) {
  return handle(async () => {
    const user = await requireUser();
    const { tripId } = await params;
    const id = new URL(req.url).searchParams.get("id");
    if (!id) return json({ error: "id required" }, 400);
    const hotel = await db.hotel.findFirst({ where: { id, tripId, trip: { userId: user.id } } });
    if (!hotel) return json({ error: "Not found" }, 404);
    await db.hotel.delete({ where: { id } });
    return json({ ok: true });
  });
}
