import { requireUser } from "@/lib/auth";
import { handle, json } from "@/lib/api-helpers";
import { googleEnabled, placeDetails } from "@/lib/places/google";

/** GET ?placeId=…&city=Tokyo → where it is, for a hotel or must-do picked from search. */
export async function GET(req: Request) {
  return handle(async () => {
    await requireUser();
    const sp = new URL(req.url).searchParams;
    const placeId = sp.get("placeId");
    if (!placeId) return json({ error: "placeId required" }, 400);
    if (!googleEnabled()) return json({ error: "Place search isn't connected" }, 404);
    const place = await placeDetails(placeId, sp.get("city") ?? "");
    if (!place) return json({ error: "Place not found" }, 404);
    return json({ place: { placeId, name: place.name, lat: place.lat, lng: place.lng, neighborhood: place.neighborhood, address: place.blurb } });
  });
}
