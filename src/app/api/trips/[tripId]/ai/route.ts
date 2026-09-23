import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { handle, json, rateLimit, readJson } from "@/lib/api-helpers";
import { runAgent } from "@/lib/ai/agent";

export async function GET(_req: Request, { params }: { params: Promise<{ tripId: string }> }) {
  return handle(async () => {
    const user = await requireUser();
    const { tripId } = await params;
    const trip = await db.trip.findFirst({ where: { id: tripId, userId: user.id } });
    if (!trip) return json({ error: "Trip not found" }, 404);

    const conversations = await db.aIConversation.findMany({
      where: { tripId },
      orderBy: { updatedAt: "desc" },
      take: 20,
      include: { messages: { orderBy: { createdAt: "asc" } } },
    });

    const latest = conversations[0] ?? null;
    return json({
      conversations: conversations.map((c) => ({
        id: c.id,
        title: c.title,
        updatedAt: c.updatedAt,
        messageCount: c.messages.length,
      })),
      activeConversationId: latest?.id ?? null,
      messages:
        latest?.messages.map((m) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          data: m.data ? JSON.parse(m.data) : null,
          createdAt: m.createdAt,
        })) ?? [],
    });
  });
}

export async function POST(req: Request, { params }: { params: Promise<{ tripId: string }> }) {
  return handle(async () => {
    const user = await requireUser();
    if (!rateLimit(`chat:${user.id}`, 30, 60_000)) {
      return json({ error: "Slow down a little â€” try again in a minute" }, 429);
    }
    const { tripId } = await params;
    const body = await readJson<{ message?: string; conversationId?: string | null }>(req);
    const message = body.message?.trim();
    if (!message) return json({ error: "message required" }, 400);
    if (message.length > 2000) return json({ error: "Message too long" }, 400);

    // Verify ownership
    const trip = await db.trip.findFirst({ where: { id: tripId, userId: user.id } });
    if (!trip) return json({ error: "Trip not found" }, 404);

    const result = await runAgent({
      tripId,
      userId: user.id,
      message,
      conversationId: body.conversationId ?? null,
    });

    return json(result);
  });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ tripId: string }> }) {
  return handle(async () => {
    const user = await requireUser();
    const { tripId } = await params;
    const id = new URL(req.url).searchParams.get("id");
    if (id) {
      await db.aIConversation.deleteMany({ where: { id, tripId, trip: { userId: user.id } } });
    } else {
      await db.aIConversation.deleteMany({ where: { tripId, trip: { userId: user.id } } });
    }
    return json({ ok: true });
  });
}
