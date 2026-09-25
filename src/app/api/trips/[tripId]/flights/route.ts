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
      airline?: string;
      flightNumber?: string;
      originCode?: string;
      originCity?: string;
      destCode?: string;
      destCity?: string;
      departAt?: string;
      arriveAt?: string;
      seat?: string;
      terminal?: string;
      gate?: string;
      confirmation?: string;
      price?: number;
      currency?: string;
    }>(req);

    if (!body.airline?.trim() || !body.departAt || !body.arriveAt) {
      return json({ error: "airline, departAt and arriveAt are required" }, 400);
    }
    const flight = await db.flight.create({
      data: {
        tripId,
        airline: body.airline.trim(),
        flightNumber: body.flightNumber?.trim() ?? "",
        originCode: body.originCode?.trim() ?? "",
        originCity: body.originCity?.trim() ?? "",
        destCode: body.destCode?.trim() ?? "",
        destCity: body.destCity?.trim() ?? "",
        departAt: new Date(body.departAt),
        arriveAt: new Date(body.arriveAt),
        seat: body.seat?.trim() || null,
        terminal: body.terminal?.trim() || null,
        gate: body.gate?.trim() || null,
        confirmation: body.confirmation?.trim() || null,
        price: Number(body.price) || 0,
        currency: body.currency ?? trip.homeCurrency,
      },
    });
    return json({ flight }, 201);
  });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ tripId: string }> }) {
  return handle(async () => {
    const user = await requireUser();
    const { tripId } = await params;
    const id = new URL(req.url).searchParams.get("id");
    if (!id) return json({ error: "id required" }, 400);
    const flight = await db.flight.findFirst({ where: { id, tripId, trip: { userId: user.id } } });
    if (!flight) return json({ error: "Not found" }, 404);
    await db.flight.delete({ where: { id } });
    return json({ ok: true });
  });
}
