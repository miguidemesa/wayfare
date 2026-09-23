import { db } from "@/lib/db";
import { requireUser, HttpError } from "@/lib/auth";
import { handle, json, readJson } from "@/lib/api-helpers";
import { ITEM_TYPES, type ItemType } from "@/lib/types";

async function assertOwned(itemId: string, userId: string) {
  const item = await db.itineraryItem.findFirst({
    where: { id: itemId, trip: { userId } },
  });
  if (!item) throw new HttpError(404, "Item not found");
  return item;
}

export async function PATCH(req: Request, { params }: { params: Promise<{ itemId: string }> }) {
  return handle(async () => {
    const user = await requireUser();
    const { itemId } = await params;
    const item = await assertOwned(itemId, user.id);
    const body = await readJson<{
      title?: string;
      startTime?: string | null;
      durationMin?: number;
      cost?: number | null;
      notes?: string | null;
      confirmed?: boolean;
      type?: string;
      moveToDayId?: string;
    }>(req);

    if (body.type != null && !ITEM_TYPES.includes(body.type as ItemType)) {
      return json({ error: "Invalid item type" }, 400);
    }

    const patch: Record<string, unknown> = {};
    if (body.title != null) patch.title = body.title.trim().slice(0, 200) || item.title;
    if (body.startTime !== undefined) {
      if (body.startTime === null || body.startTime === "") {
        patch.startTime = null;
        patch.endTime = null;
      } else {
        const [h, m] = String(body.startTime).split(":").map(Number);
        if (Number.isNaN(h) || h < 0 || h > 23 || m < 0 || m > 59) {
          return json({ error: "Invalid start time" }, 400);
        }
        const st = h * 60 + (m || 0);
        patch.startTime = st;
        patch.endTime = st + (Number(body.durationMin) || 60);
      }
    }
    if (body.durationMin != null) {
      const dur = Math.max(5, Math.min(720, Number(body.durationMin)));
      patch.durationMin = dur;
      if (patch.startTime != null) patch.endTime = (patch.startTime as number) + dur;
    }
    if (body.cost !== undefined) {
      patch.cost =
        body.cost == null ? null : Math.max(0, Number(body.cost)) || null;
    }
    if (body.notes !== undefined) patch.notes = body.notes;
    if (body.confirmed != null) patch.confirmed = !!body.confirmed;
    if (body.type != null) patch.type = body.type;

    // Cross-day move: the target day must belong to the SAME trip as the item
    // (a previous version only checked ownership, letting items be re-parented
    // across trips).
    if (body.moveToDayId) {
      const targetDay = await db.itineraryDay.findFirst({
        where: { id: body.moveToDayId, tripId: item.tripId },
      });
      if (!targetDay) return json({ error: "Target day not found" }, 404);
      patch.dayId = targetDay.id;
      patch.order = await db.itineraryItem.count({ where: { dayId: targetDay.id } });
    }

    const updated = await db.itineraryItem.update({ where: { id: itemId }, data: patch });
    return json({ item: updated });
  });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ itemId: string }> }) {
  return handle(async () => {
    const user = await requireUser();
    const { itemId } = await params;
    await assertOwned(itemId, user.id);
    await db.itineraryItem.delete({ where: { id: itemId } });
    return json({ ok: true });
  });
}
