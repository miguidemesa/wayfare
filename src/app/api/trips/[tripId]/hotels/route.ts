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

// Check-in and check-out are stored at the same wall-clock times POST uses.
function stayDate(value: string, time: string): Date {
  return new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T${time}` : value);
}

export async function PATCH(req: Request, { params }: { params: Promise<{ tripId: string }> }) {
  return handle(async () => {
    const user = await requireUser();
    const { tripId } = await params;
    const body = await readJson<{
      id?: string;
      name?: string;
      destinationName?: string | null;
      address?: string | null;
      lat?: number | null;
      lng?: number | null;
      checkIn?: string;
      checkOut?: string;
      confirmationNumber?: string | null;
      phone?: string | null;
      costPerNight?: number;
      currency?: string;
    }>(req);
    if (!body.id) return json({ error: "id required" }, 400);
    const existing = await db.hotel.findFirst({ where: { id: body.id, tripId, trip: { userId: user.id } } });
    if (!existing) return json({ error: "Not found" }, 404);

    const patch: Record<string, unknown> = {};
    if (body.name != null) {
      if (!body.name.trim()) return json({ error: "name can't be empty" }, 400);
      patch.name = body.name.trim();
    }
    if (body.destinationName !== undefined) patch.destinationName = body.destinationName?.trim() || null;
    if (body.address !== undefined) patch.address = body.address?.trim() || null;
    if (body.lat !== undefined) patch.lat = body.lat;
    if (body.lng !== undefined) patch.lng = body.lng;
    if (body.confirmationNumber !== undefined) patch.confirmationNumber = body.confirmationNumber?.trim() || null;
    if (body.phone !== undefined) patch.phone = body.phone?.trim() || null;
    if (body.costPerNight != null) patch.costPerNight = Math.max(0, Number(body.costPerNight) || 0);
    if (body.currency != null) patch.currency = body.currency;

    if (body.checkIn || body.checkOut) {
      const ci = body.checkIn ? stayDate(body.checkIn, "15:00:00") : existing.checkIn;
      const co = body.checkOut ? stayDate(body.checkOut, "11:00:00") : existing.checkOut;
      if (isNaN(ci.getTime()) || isNaN(co.getTime()) || co <= ci) {
        return json({ error: "Invalid stay dates" }, 400);
      }
      patch.checkIn = ci;
      patch.checkOut = co;
      patch.nights = Math.max(1, Math.round((co.getTime() - ci.getTime()) / 86400000));
    }

    const hotel = await db.hotel.update({ where: { id: body.id }, data: patch });
    return json({ hotel });
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
