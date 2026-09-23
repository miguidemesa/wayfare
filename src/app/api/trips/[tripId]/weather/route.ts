import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { handle, json } from "@/lib/api-helpers";
import { getWeatherForTrip } from "@/lib/weather";
import { CITY_META } from "@/lib/data/pois";

export async function GET(_req: Request, { params }: { params: Promise<{ tripId: string }> }) {
  return handle(async () => {
    const user = await requireUser();
    const { tripId } = await params;
    const trip = await db.trip.findFirst({
      where: { id: tripId, userId: user.id },
      include: { destinations: true },
    });
    if (!trip) return json({ error: "Trip not found" }, 404);

    const cities = trip.destinations.length
      ? trip.destinations.map((d) => ({
          name: d.name,
          lat: CITY_META[d.name]?.lat ?? d.lat,
          lng: CITY_META[d.name]?.lng ?? d.lng,
        }))
      : [{ name: trip.subtitle ?? "Trip", lat: 35.68, lng: 139.69 }];

    const weather = await getWeatherForTrip(tripId, cities, trip.startDate, trip.endDate);
    return json({ weather });
  });
}
