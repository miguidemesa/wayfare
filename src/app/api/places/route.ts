import { requireUser } from "@/lib/auth";
import { handle, json } from "@/lib/api-helpers";
import { CITY_META, POIS } from "@/lib/data/pois";
import { googleEnabled, searchText } from "@/lib/places/google";

/**
 * Search the place guide before a trip exists (the planning interview's
 * must-dos). GET ?cities=Tokyo,Kyoto&q=temple → up to 20 matches.
 * Also reports which of the cities the guide covers at all.
 */
export async function GET(req: Request) {
  return handle(async () => {
    await requireUser();
    const sp = new URL(req.url).searchParams;
    const cities = (sp.get("cities") ?? "")
      .split(",")
      .map((c) => c.trim().toLowerCase())
      .filter(Boolean);
    const q = sp.get("q")?.trim().toLowerCase() ?? "";

    const covered = Object.keys(CITY_META).filter((c) => cities.includes(c.toLowerCase()));
    let pool = POIS.filter((p) => !cities.length || cities.includes(p.city.toLowerCase()));
    if (q) {
      pool = pool.filter((p) => `${p.name} ${p.neighborhood} ${p.cuisine ?? ""} ${p.tags.join(" ")}`.toLowerCase().includes(q));
    }
    const places: { poiId: string | null; placeId: string | null; name: string; city: string; neighborhood: string; category: string; rating: number }[] = pool
      .sort((a, b) => b.rating - a.rating)
      .slice(0, 20)
      .map((p) => ({ poiId: p.id, placeId: null, name: p.name, city: p.city, neighborhood: p.neighborhood, category: p.category, rating: p.rating }));

    // Cities the guide doesn't cover: search Google, when it's connected.
    const google = googleEnabled();
    const names = (sp.get("cities") ?? "").split(",").map((c) => c.trim()).filter(Boolean);
    const uncovered = names.filter((c) => !covered.some((k) => k.toLowerCase() === c.toLowerCase()));
    if (google && q && uncovered.length) {
      const found = await Promise.all(uncovered.map((c) => searchText(q, c, null, 8)));
      for (const p of found.flat()) {
        places.push({ poiId: null, placeId: p.id.slice(2), name: p.name, city: p.city, neighborhood: p.neighborhood, category: p.category, rating: p.rating });
      }
    }
    return json({ places, covered, google });
  });
}
