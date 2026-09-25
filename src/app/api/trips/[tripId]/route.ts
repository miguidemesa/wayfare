import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { handle, json, readJson } from "@/lib/api-helpers";
import { getTripBundle } from "@/lib/trip-service";
import { getWeatherForTrip } from "@/lib/weather";
import { CITY_META } from "@/lib/data/pois";
import { normalizeInterests, parseBrief, partySize, preferencesFrom, readStoredBrief } from "@/lib/brief";

export async function GET(_req: Request, { params }: { params: Promise<{ tripId: string }> }) {
  return handle(async () => {
    const user = await requireUser();
    const { tripId } = await params;
    const bundle = await getTripBundle(tripId, user.id);
    // Lazily backfill weather snapshots.
    const cities = bundle.destinations.length
      ? bundle.destinations.map((d) => ({
          name: d.name,
          lat: CITY_META[d.name]?.lat ?? d.lat,
          lng: CITY_META[d.name]?.lng ?? d.lng,
        }))
      : [{ name: bundle.trip.subtitle ?? "Trip", lat: 35.68, lng: 139.69 }];
    if (bundle.weather.length === 0) {
      await getWeatherForTrip(tripId, cities, bundle.trip.startDate, bundle.trip.endDate);
      bundle.weather = await db.weatherSnapshot.findMany({
        where: { tripId },
        orderBy: { date: "asc" },
      });
    }
    return json({ ...bundle, brief: readStoredBrief(bundle.trip.brief) });
  });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ tripId: string }> }) {
  return handle(async () => {
    const user = await requireUser();
    const { tripId } = await params;
    const body = await readJson<{
      title?: string;
      subtitle?: string;
      coverEmoji?: string;
      coverTheme?: string;
      budgetAmount?: number;
      homeCurrency?: string;
      pace?: string;
      interests?: string[];
      status?: string;
      notes?: string | null;
      startDate?: string;
      endDate?: string;
      /** A whole TripBrief; replaces the stored one. */
      brief?: unknown;
    }>(req);

    const trip = await db.trip.findFirst({ where: { id: tripId, userId: user.id } });
    if (!trip) return json({ error: "Trip not found" }, 404);

    const patch: Record<string, unknown> = {};
    if (body.title != null) patch.title = body.title.trim();
    if (body.subtitle != null) patch.subtitle = body.subtitle.trim();
    if (body.coverEmoji != null) patch.coverEmoji = body.coverEmoji;
    if (body.coverTheme != null) patch.coverTheme = body.coverTheme;
    if (body.budgetAmount != null) patch.budgetAmount = Math.max(0, Number(body.budgetAmount) || 0);
    if (body.homeCurrency != null) patch.homeCurrency = body.homeCurrency;
    if (body.pace != null) patch.pace = body.pace;
    if (body.interests != null) patch.interests = JSON.stringify(normalizeInterests(body.interests));
    if (body.status != null) patch.status = body.status;
    // undefined leaves notes alone; null or "" clears them.
    if (body.notes !== undefined) patch.notes = body.notes?.trim() || null;

    if (body.startDate || body.endDate) {
      const s = body.startDate ? new Date(body.startDate + "T00:00:00") : trip.startDate;
      const e = body.endDate ? new Date(body.endDate + "T23:59:59") : trip.endDate;
      if (isNaN(s.getTime()) || isNaN(e.getTime()) || e < s) {
        return json({ error: "Invalid date range" }, 400);
      }
      if (body.startDate) patch.startDate = s;
      if (body.endDate) patch.endDate = e;
    }

    let savedPreferences: string | null = null;
    if (body.brief !== undefined) {
      const parsed = parseBrief(body.brief);
      if (!parsed.ok) return json({ error: parsed.error }, 400);
      const brief = parsed.brief;
      patch.brief = JSON.stringify(brief);
      patch.pace = brief.pace;
      patch.interests = JSON.stringify(brief.interests);
      patch.travelersCount = Math.min(30, partySize(brief));
      savedPreferences = JSON.stringify(preferencesFrom(brief));
    }

    const updated = await db.trip.update({ where: { id: tripId }, data: patch });
    if (savedPreferences) await db.user.update({ where: { id: user.id }, data: { preferences: savedPreferences } });
    return json({ trip: updated });
  });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ tripId: string }> }) {
  return handle(async () => {
    const user = await requireUser();
    const { tripId } = await params;
    const trip = await db.trip.findFirst({ where: { id: tripId, userId: user.id } });
    if (!trip) return json({ error: "Trip not found" }, 404);
    await db.trip.delete({ where: { id: tripId } });
    return json({ ok: true });
  });
}
