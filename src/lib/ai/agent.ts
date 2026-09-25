import "server-only";
import { db } from "../db";
import { getProvider, type ChatMessage } from "./providers";
import { runTool, toolDefsList, type ToolContext } from "./tools";
import { runLocalBrain } from "./local-brain";
import { normalizeInterests } from "../brief";

const SYSTEM_BASE = `You are Wayfare AI — a proactive, grounded travel concierge embedded in a trip-planning app. You help the traveler manage ONE specific trip.

Rules:
- ALWAYS use tools to read real trip state before answering factual questions (itinerary, budget, weather, places). Never invent places, prices, or bookings.
- When the user asks for changes, make them with tools when intent is clear ("add X", "move Y"). For destructive or ambiguous changes, confirm first.
- Be concise and warm. Use short markdown. Times as HH:MM. Show money in local currency, with home-currency equivalents when helpful.
- Prefer geographically grouped suggestions; mention walking/transit times.
- If a tool fails, tell the user plainly and suggest an alternative.`;

async function buildSystemPrompt(ctx: ToolContext): Promise<string> {
  const [trip] = await db.trip.findMany({
    where: { id: ctx.tripId, userId: ctx.userId },
    take: 1,
  });
  if (!trip) throw new Error("Trip not found");
  const days = await db.itineraryDay.findMany({
    where: { tripId: trip.id },
    orderBy: { date: "asc" },
    include: { items: { orderBy: { order: "asc" } } },
  });
  const hotels = await db.hotel.findMany({ where: { tripId: trip.id } });
  const weather = await db.weatherSnapshot.findMany({
    where: { tripId: trip.id },
    orderBy: { date: "asc" },
    take: 10,
  });

  const context = {
    trip: {
      title: trip.title,
      destinations: trip.subtitle,
      dates: `${trip.startDate.toISOString().slice(0, 10)} → ${trip.endDate.toISOString().slice(0, 10)}`,
      budget: trip.budgetAmount,
      homeCurrency: trip.homeCurrency,
      pace: trip.pace,
      interests: normalizeInterests(JSON.parse(trip.interests || "[]")),
    },
    itinerarySummary: days.map((d) => ({
      date: d.date.toISOString().slice(0, 10),
      city: d.city,
      items: d.items.map((i) => ({
        id: i.id,
        title: i.title,
        type: i.type,
        time:
          i.startTime != null
            ? `${String(Math.floor(i.startTime / 60)).padStart(2, "0")}:${String(i.startTime % 60).padStart(2, "0")}`
            : null,
        neighborhood: i.neighborhood,
      })),
    })),
    hotels: hotels.map((h) => ({ name: h.name, area: h.destinationName, checkIn: h.checkIn.toISOString().slice(0, 10) })),
    upcomingWeather: weather.map((w) => ({
      date: w.date.toISOString().slice(0, 10),
      city: w.city,
      condition: w.condition,
      rainProb: w.rainProb,
      minC: w.tempMinC,
      maxC: w.tempMaxC,
    })),
  };

  return `${SYSTEM_BASE}\n\nTRIP CONTEXT (ground truth):\n${JSON.stringify(context)}`;
}

export type AgentResult = {
  conversationId: string;
  content: string;
  data: Record<string, unknown> | null;
  toolsUsed: string[];
};

export async function runAgent(opts: {
  tripId: string;
  userId: string;
  message: string;
  conversationId?: string | null;
}): Promise<AgentResult> {
  const ctx: ToolContext = { tripId: opts.tripId, userId: opts.userId };

  let conversation = opts.conversationId
    ? await db.aIConversation.findFirst({ where: { id: opts.conversationId, tripId: ctx.tripId } })
    : null;
  if (!conversation) {
    conversation = await db.aIConversation.create({
      data: {
        tripId: ctx.tripId,
        title: opts.message.slice(0, 48),
      },
    });
  }

  await db.aIMessage.create({
    data: { conversationId: conversation.id, role: "user", content: opts.message },
  });

  const history = await db.aIMessage.findMany({
    where: { conversationId: conversation.id, role: { in: ["user", "assistant"] } },
    orderBy: { createdAt: "asc" },
    take: 24,
  });

  const provider = getProvider();
  let content: string;
  let data: Record<string, unknown> | null = null;
  const toolsUsed: string[] = [];

  if (!provider.configured()) {
    // Deterministic local path — same tools, no LLM.
    const brain = await runLocalBrain(opts.message, ctx);
    content = brain.content;
    data = brain.data ?? null;
    toolsUsed.push("local-brain");
  } else {
    try {
      const system = await buildSystemPrompt(ctx);
      const messages: ChatMessage[] = history.map((m) => ({
        role: m.role === "user" ? "user" : "assistant",
        content: m.content,
      }));

      for (let iter = 0; iter < 5; iter++) {
        const res = await provider.complete({
          system,
          messages: messages.length ? messages : [{ role: "user", content: opts.message }],
          tools: toolDefsList(),
        });

        if (!res.toolCalls.length) {
          content = res.content ?? "(no response)";
          break;
        }

        messages.push({
          role: "assistant",
          content: res.content ?? "",
          toolCalls: res.toolCalls,
        });

        for (const tc of res.toolCalls) {
          toolsUsed.push(tc.name);
          const result = await runTool(tc.name, safeJson(tc.argsJson), ctx);
          messages.push({
            role: "tool",
            toolCallId: tc.id,
            content: JSON.stringify(result.ok ? result.result : { error: result.error }),
          });
        }
        if (iter === 4) content = "I ran into complexity processing that request. Try splitting it into smaller steps.";
      }
    } catch (e) {
      // Provider failed mid-flight — degrade gracefully to local brain.
      console.error("[ai] provider error, falling back to local brain:", e);
      const brain = await runLocalBrain(opts.message, ctx);
      content = brain.content + `\n\n_(answered offline: ${provider.id} unavailable)_`;
      data = brain.data ?? null;
    }
  }

  await db.aIMessage.create({
    data: {
      conversationId: conversation.id,
      role: "assistant",
      content: content!,
      toolCalls: toolsUsed.length ? JSON.stringify(toolsUsed) : null,
      data: data ? JSON.stringify(data) : null,
    },
  });
  await db.aIConversation.update({
    where: { id: conversation.id },
    data: { updatedAt: new Date() },
  });

  return {
    conversationId: conversation.id,
    content: content!,
    data,
    toolsUsed,
  };
}

function safeJson(s: string): Record<string, unknown> {
  try {
    const v = JSON.parse(s);
    return typeof v === "object" && v !== null ? v : {};
  } catch {
    return {};
  }
}

/** Compact context used by non-chat AI features (status endpoint etc.). */
export async function aiStatus() {
  const p = getProvider();
  return {
    provider: p.configured() ? p.id : "local",
    model: p.configured() ? p.model : "wayfare-local-v1",
    live: p.configured(),
  };
}
