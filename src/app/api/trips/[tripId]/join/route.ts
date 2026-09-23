import { db } from "@/lib/db";
import { requireUser, HttpError } from "@/lib/auth";
import { handle, json } from "@/lib/api-helpers";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ tripId: string }> }
) {
  return handle(async () => {
    const user = await requireUser();
    const { tripId } = await params;

    const trip = await db.trip.findUnique({
      where: { id: tripId },
      include: { user: { select: { id: true, name: true } } },
    });

    if (!trip) throw new HttpError(404, "Trip not found");

    // If already owner, return success immediately
    if (trip.userId === user.id) {
      return json({ ok: true, isOwner: true });
    }

    // Check if traveler already registered
    const existing = await db.traveler.findFirst({
      where: {
        tripId,
        OR: [{ email: user.email }, { name: user.name }],
      },
    });

    if (!existing) {
      await db.traveler.create({
        data: {
          tripId,
          name: user.name,
          email: user.email,
          isOwner: false,
        },
      });
      await db.trip.update({
        where: { id: tripId },
        data: { travelersCount: { increment: 1 } },
      });
    }

    return json({ ok: true });
  });
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ tripId: string }> }
) {
  return handle(async () => {
    const { tripId } = await params;
    const trip = await db.trip.findUnique({
      where: { id: tripId },
      select: {
        id: true,
        title: true,
        subtitle: true,
        coverEmoji: true,
        coverTheme: true,
        startDate: true,
        endDate: true,
        user: { select: { name: true } },
      },
    });

    if (!trip) throw new HttpError(404, "Trip not found");
    return json({ trip });
  });
}
