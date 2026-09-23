import { requireUser } from "@/lib/auth";
import { handle, json } from "@/lib/api-helpers";
import { POIS } from "@/lib/data/pois";
import { haversineKm, estimateTransit } from "@/lib/utils";
import { db } from "@/lib/db";

/**
 * Place discovery over the curated dataset.
 * Query params: lat, lng (nearby anchor), city, category, q, maxWalkMin,
 * minRating, maxPrice (price level), openNow=1, cuisine
 */
export async function GET(req: Request) {
  return handle(async () => {
    await requireUser();
    const sp = new URL(req.url).searchParams;

    let pool = [...POIS];
    const city = sp.get("city");
    if (city && city !== "all") pool = pool.filter((p) => p.city === city);

    const category = sp.get("category");
    if (category && category !== "all") {
      if (category === "FOOD") {
        pool = pool.filter((p) => ["RESTAURANT", "CAFE", "BAR"].includes(p.category));
      } else {
        pool = pool.filter((p) => p.category === category);
      }
    }

    const q = sp.get("q")?.toLowerCase().trim();
    if (q) {
      pool = pool.filter((p) =>
        `${p.name} ${p.cuisine ?? ""} ${p.neighborhood} ${p.tags.join(" ")} ${p.blurb}`
          .toLowerCase()
          .includes(q)
      );
    }

    const cuisine = sp.get("cuisine")?.toLowerCase();
    if (cuisine && cuisine !== "all") {
      pool = pool.filter((p) => (p.cuisine ?? "").toLowerCase().includes(cuisine));
    }

    const minRating = Number(sp.get("minRating") ?? "0");
    if (minRating > 0) pool = pool.filter((p) => p.rating >= minRating);

    const maxPrice = Number(sp.get("maxPrice") ?? "0");
    if (maxPrice > 0) pool = pool.filter((p) => p.priceLevel <= maxPrice);

    const openNow = sp.get("openNow") === "1";
    if (openNow) {
      // Honest heuristic: places that are 24h or currently within stated hours.
      const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
      pool = pool.filter((p) => {
        if (p.hours.toLowerCase().includes("24")) return true;
        const m = p.hours.match(/(\d{1,2})(?::(\d{2}))?\s*(AM|PM)/i);
        if (!m) return true;
        let closeH = Number(m[1]) % 12;
        if ((m[3] ?? "").toUpperCase() === "PM" && Number(m[1]) !== 12) closeH += 12;
        else if ((m[3] ?? "").toUpperCase() === "AM" && Number(m[1]) === 12) closeH = 0;
        const closeMin = closeH * 60 + Number(m[2] ?? "0");
        return nowMin <= closeMin || closeMin < 6 * 60; // late-night venues count as open
      });
    }

    const lat = sp.get("lat") != null ? Number(sp.get("lat")) : null;
    const lng = sp.get("lng") != null ? Number(sp.get("lng")) : null;
    const maxWalkMin = Number(sp.get("maxWalkMin") ?? "0");

    let results = pool.map((p) => {
      let walkMin: number | null = null;
      if (lat != null && lng != null) {
        const km = haversineKm(lat, lng, p.lat, p.lng);
        walkMin = estimateTransit(km).minutes;
      }
      return { ...p, walkMin };
    });

    if (lat != null && lng != null) {
      if (maxWalkMin > 0) results = results.filter((r) => r.walkMin != null && r.walkMin <= maxWalkMin);
      results.sort((a, b) => (a.walkMin ?? 9999) - (b.walkMin ?? 9999));
    } else {
      results.sort((a, b) => b.rating - a.rating);
    }

    // Merge saved status for this trip
    const tripId = sp.get("tripId");
    let savedNames = new Set<string>();
    if (tripId) {
      const saved = await db.savedPlace.findMany({
        where: { tripId, trip: { userId: (await requireUser()).id } },
        select: { name: true },
      });
      savedNames = new Set(saved.map((s) => s.name));
    }

    return json({
      places: results.slice(0, 60).map((p) => ({
        poiId: p.id,
        name: p.name,
        category: p.category,
        city: p.city,
        neighborhood: p.neighborhood,
        lat: p.lat,
        lng: p.lng,
        rating: p.rating,
        priceLevel: p.priceLevel,
        avgCost: p.avgCost,
        currency: p.currency,
        hours: p.hours,
        cuisine: p.cuisine,
        blurb: p.blurb,
        durationMin: p.durationMin,
        walkMin: p.walkMin,
        saved: savedNames.has(p.name),
      })),
    });
  });
}
