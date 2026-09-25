import { requireUser } from "@/lib/auth";
import { handle, json } from "@/lib/api-helpers";
import { autocomplete, googleEnabled } from "@/lib/places/google";

/**
 * As-you-type place search for the planning interview.
 * GET ?q=gracery&kind=lodging|area|any&lat=35.68&lng=139.69
 * { google: false } when Google Places isn't connected: the app falls back
 * to typing a name.
 */
export async function GET(req: Request) {
  return handle(async () => {
    await requireUser();
    if (!googleEnabled()) return json({ google: false, predictions: [] });
    const sp = new URL(req.url).searchParams;
    const q = sp.get("q")?.trim() ?? "";
    if (q.length < 2) return json({ google: true, predictions: [] });
    const kind = sp.get("kind") === "area" ? "area" : sp.get("kind") === "any" ? "any" : "lodging";
    const lat = Number(sp.get("lat"));
    const lng = Number(sp.get("lng"));
    const near = Number.isFinite(lat) && Number.isFinite(lng) && (lat || lng) ? { lat, lng } : null;
    return json({ google: true, predictions: await autocomplete(q, near, kind) });
  });
}
