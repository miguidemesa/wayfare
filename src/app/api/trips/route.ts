import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { handle, json, readJson } from "@/lib/api-helpers";
import { listTrips } from "@/lib/trip-service";
import { statusForDates } from "@/lib/types";

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
        pace: body.pace ?? "balanced",
        interests: JSON.stringify((body.interests ?? []).slice(0, 12)),
        travelersCount: Math.max(1, Math.min(20, Number(body.travelersCount) || 1)),
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

    return json({ trip }, 201);
  });
}
