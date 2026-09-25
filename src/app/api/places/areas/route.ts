import { requireUser } from "@/lib/auth";
import { handle, json } from "@/lib/api-helpers";
import { stayAreasFor } from "@/lib/data/stay-areas";

/** GET ?city=Tokyo → where people usually stay there, with each area's centre. */
export async function GET(req: Request) {
  return handle(async () => {
    await requireUser();
    const city = new URL(req.url).searchParams.get("city") ?? "";
    return json({ areas: stayAreasFor(city) });
  });
}
