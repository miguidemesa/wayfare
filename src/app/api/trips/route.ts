import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { handle, json, readJson } from "@/lib/api-helpers";
import { listTrips } from "@/lib/trip-service";
import { statusForDates } from "@/lib/types";
import { normalizeInterests, parseBrief, partySize, preferencesFrom, type TripBrief } from "@/lib/brief";

export async function GET() {
  return handle(async () => {
    const user = await requireUser();
    const rawTrips = await listTrips(user.id);
    const trips = rawTrips.map((t) => ({
      ...t,
      status: t.status === "PLANNING" ? "PLANNING" : statusForDates(t.startDate, t.endDate),
    }));
    return json({ trips });
  });
}

type CreateBody = {
  title?: string;
  subtitle?: string;
  destinations?: { name: string; country?: string; lat?: number; lng?: number }[];
  startDate?: string;
  endDate?: string;
  budgetAmount?: number;
  homeCurrency?: string;
  pace?: string;
  interests?: string[];
  travelersCount?: number;
  /** The planning interview's answers (src/lib/brief.ts). */
  brief?: unknown;
  coverEmoji?: string;
  coverTheme?: string;
};

export async function POST(req: Request) {
  return handle(async () => {
    const user = await requireUser();
    const body = await readJson<CreateBody>(req);
    if (!body.startDate || !body.endDate) {
      return json({ error: "startDate and endDate are required" }, 400);
    }
    const start = new Date(body.startDate + "T00:00:00");
    const end = new Date(body.endDate + "T23:59:59");
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) {
      return json({ error: "Invalid date range" }, 400);
    }
    let brief: TripBrief | null = null;
    if (body.brief !== undefined) {
      const parsed = parseBrief(body.brief);
      if (!parsed.ok) return json({ error: parsed.error }, 400);
      brief = parsed.brief;
    }
    const dests = (body.destinations ?? []).filter((d) => d.name?.trim());
    if (!dests.length) return json({ error: "At least one destination is required" }, 400);

    const trip = await db.trip.create({
      data: {
        userId: user.id,
        title:
          body.title?.trim() ||
          dests.map((d) => d.name.trim()).join(" & "),
        subtitle: dests.map((d) => d.name.trim()).join(" · "),
        coverEmoji: body.coverEmoji ?? "🌍",
        coverTheme: body.coverTheme ?? "teal",
        status: "PLANNING",
        startDate: start,
        endDate: end,
        budgetAmount: Number(body.budgetAmount) || 0,
        homeCurrency: body.homeCurrency ?? user.homeCurrency,
        // With a brief, it is the source of truth; pace, interests and the
        // head count mirror it for everything that reads the older fields.
        pace: brief?.pace ?? body.pace ?? "balanced",
        interests: JSON.stringify(brief ? brief.interests : normalizeInterests(body.interests).slice(0, 12)),
        travelersCount: Math.min(30, brief ? partySize(brief) : Math.max(1, Number(body.travelersCount) || 1)),
        brief: brief ? JSON.stringify(brief) : null,
        destinations: {
          create: dests.map((d, i) => ({
            name: d.name.trim(),
            country: d.country ?? "",
            lat: d.lat ?? 0,
            lng: d.lng ?? 0,
            order: i,
          })),
        },
        travelers: {
          create: [{ name: user.name, email: user.email, isOwner: true }],
        },
      },
      include: { destinations: true },
    });
    if (brief) {
      await db.user.update({ where: { id: user.id }, data: { preferences: JSON.stringify(preferencesFrom(brief)) } });
    }

    return json({ trip }, 201);
  });
}
