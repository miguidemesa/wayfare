import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { handle, json, readJson } from "@/lib/api-helpers";
import { TOOL_EXECUTORS } from "@/lib/ai/tools";

/**
 * Day optimization endpoint.
 * POST { date, apply?: boolean }
 * Without apply â†’ preview only (never mutates). With apply:true â†’ persists new order.
 */
export async function POST(req: Request, { params }: { params: Promise<{ tripId: string }> }) {
  return handle(async () => {
    const user = await requireUser();
    const { tripId } = await params;
    const trip = await db.trip.findFirst({ where: { id: tripId, userId: user.id } });
    if (!trip) return json({ error: "Trip not found" }, 404);

    const body = await readJson<{ date?: string; apply?: boolean }>(req);
    if (!body.date) return json({ error: "date required" }, 400);

    const ctx = { tripId, userId: user.id };
    const exec = TOOL_EXECUTORS[body.apply ? "apply_optimization" : "optimize_day"];
    try {
      const result =
        body.apply
          ? await exec({ date: body.date, confirm: true }, ctx)
          : await exec({ date: body.date }, ctx);
      return json(result);
    } catch (e) {
      return json({ error: e instanceof Error ? e.message : "Optimization failed" }, 400);
    }
  });
}
