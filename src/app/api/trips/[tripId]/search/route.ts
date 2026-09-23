import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { handle, json } from "@/lib/api-helpers";
import { POIS } from "@/lib/data/pois";

export async function GET(req: Request, { params }: { params: Promise<{ tripId: string }> }) {
  return handle(async () => {
    const user = await requireUser();
    const { tripId } = await params;
    const trip = await db.trip.findFirst({ where: { id: tripId, userId: user.id } });
    if (!trip) return json({ error: "Trip not found" }, 404);

    const q = (new URL(req.url).searchParams.get("q") ?? "").toLowerCase().trim();
    if (!q) return json({ results: [] });
    const limit = 12;

    type Row = { type: "itinerary" | "expense" | "reservation" | "saved" | "document" | "journal"; id: string; title: string; subtitle?: string; href: string; date?: Date };

    const [items, expenses, reservations, saved, documents, journal] = await Promise.all([
      db.itineraryItem.findMany({
        where: {
          tripId,
          OR: [
            { title: { contains: q } },
            { placeName: { contains: q } },
            { neighborhood: { contains: q } },
            { notes: { contains: q } },
          ],
        },
        include: { day: true },
        take: limit,
      }),
      db.expense.findMany({
        where: {
          tripId,
          OR: [{ merchant: { contains: q } }, { description: { contains: q } }],
        },
        take: limit,
      }),
      db.reservation.findMany({
        where: {
          tripId,
          OR: [{ title: { contains: q } }, { confirmationNumber: { contains: q } }, { locationName: { contains: q } }],
        },
        take: limit,
      }),
      db.savedPlace.findMany({
        where: { tripId, name: { contains: q } },
        take: limit,
      }),
      db.documentFile.findMany({
        where: { tripId, name: { contains: q } },
        take: limit,
      }),
      db.journalEntry.findMany({
        where: { tripId, title: { contains: q } },
        take: limit,
      }),
    ]);

    const results: Row[] = [];
    for (const it of items)
      results.push({
        type: "itinerary",
        id: it.id,
        title: it.title,
        subtitle: `${it.day.date.toLocaleDateString("en-US", { month: "short", day: "numeric" })} Â· ${it.type.toLowerCase()}`,
        href: `/t/${tripId}/itinerary?day=${it.day.date.toISOString().slice(0, 10)}`,
        date: it.day.date,
      });
    for (const e of expenses)
      results.push({
        type: "expense",
        id: e.id,
        title: e.merchant,
        subtitle: `${e.category.toLowerCase()} Â· ${Math.round(e.amountHome).toLocaleString()} ${trip.homeCurrency}`,
        href: `/t/${tripId}/expenses?highlight=${e.id}`,
        date: e.date,
      });
    for (const r of reservations)
      results.push({
        type: "reservation",
        id: r.id,
        title: r.title,
        subtitle: [r.confirmationNumber ? `#${r.confirmationNumber}` : null, r.locationName].filter(Boolean).join(" Â· "),
        href: `/t/${tripId}/reservations`,
        date: r.dateTime,
      });
    for (const s of saved)
      results.push({
        type: "saved",
        id: s.id,
        title: s.name,
        subtitle: `${s.category.toLowerCase()}${s.rating ? ` Â· ${s.rating}â˜…` : ""}`,
        href: `/t/${tripId}/discover?q=${encodeURIComponent(s.name)}`,
      });
    for (const d of documents)
      results.push({
        type: "document",
        id: d.id,
        title: d.name,
        subtitle: d.kind.toLowerCase().replace("_", " "),
        href: `/t/${tripId}/documents`,
      });
    for (const j of journal)
      results.push({
        type: "journal",
        id: j.id,
        title: j.title,
        subtitle: j.locationName ?? undefined,
        href: `/t/${tripId}/journal`,
        date: j.date,
      });

    // Curated dataset matches (helpful for discovery)
    const poiMatches = POIS.filter(
      (p) => p.name.toLowerCase().includes(q) || p.cuisine?.toLowerCase().includes(q)
    ).slice(0, 4);
    for (const p of poiMatches) {
      results.push({
        type: "saved",
        id: p.id,
        title: p.name,
        subtitle: `${p.city} Â· ${p.category.toLowerCase()} Â· ${p.rating}â˜… â€” search in Discover`,
        href: `/t/${tripId}/discover?q=${encodeURIComponent(p.name)}`,
      });
    }

    results.sort((a, b) => (b.date?.getTime() ?? 0) - (a.date?.getTime() ?? 0));
    return json({ results: results.slice(0, limit + 4) });
  });
}
