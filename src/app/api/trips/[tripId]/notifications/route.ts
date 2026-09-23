import { requireUser } from "@/lib/auth";
import { handle, json } from "@/lib/api-helpers";
import { getTripBundle } from "@/lib/trip-service";
import { computeNotifications } from "@/lib/notifications";

export async function GET(_req: Request, { params }: { params: Promise<{ tripId: string }> }) {
  return handle(async () => {
    const user = await requireUser();
    const { tripId } = await params;
    const bundle = await getTripBundle(tripId, user.id);
    return json({ notifications: computeNotifications(bundle) });
  });
}
