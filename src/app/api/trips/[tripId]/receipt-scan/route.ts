import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { requireTrip } from "@/lib/trip-access";
import { handle, json, rateLimit } from "@/lib/api-helpers";
import { categorizeExpenseText } from "@/lib/planner";

/**
 * Receipt scanning.
 * If an OpenAI-compatible VISION model is configured we extract merchant/total/date
 * from the uploaded image. Otherwise we respond honestly that scanning isn't
 * available and the client falls back to the confirm-manually flow.
 * Nothing is saved without explicit user confirmation (product rule).
 */
export async function POST(req: Request, { params }: { params: Promise<{ tripId: string }> }) {
  const response = await handle(async () => {
    const user = await requireUser();
    if (!rateLimit(`vision:${user.id}`, 10, 60_000)) {
      return json({ error: "Rate limit — try again in a minute" }, 429);
    }
    const { tripId } = await params;
    const trip = await requireTrip(tripId, user.id);

    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      return json({ error: "Invalid multipart form body" }, 400);
    }
    const file = form.get("file");
    if (!(file instanceof File)) return json({ error: "file required" }, 400);

    const openaiKey =
      process.env.OPENAI_API_KEY ?? process.env.NIM_API_KEY ?? process.env.OPENROUTER_API_KEY;
    const openaiBase =
      process.env.OPENAI_BASE_URL ??
      process.env.NIM_BASE_URL ??
      process.env.OPENROUTER_BASE_URL ??
      (process.env.OPENAI_API_KEY ? "https://api.openai.com/v1" : null);

    const geminiKey = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY;
    const anthropicKey = process.env.ANTHROPIC_API_KEY;

    if (!openaiKey && !geminiKey && !anthropicKey) {
      return json({
        available: false,
        reason:
          "No vision model configured. Set OPENAI_API_KEY, GEMINI_API_KEY, or ANTHROPIC_API_KEY to enable receipt extraction. You can add the expense manually below.",
      });
    }

    const buf = Buffer.from(await file.arrayBuffer());
    if (buf.length > 6 * 1024 * 1024) {
      return json({ error: "Image too large (max 6MB)" }, 400);
    }
    const mimeType = file.type || "image/jpeg";
    const base64Data = buf.toString("base64");
    const dataUrl = `data:${mimeType};base64,${base64Data}`;

    try {
      let raw = "";

      if (openaiKey && openaiBase) {
        const model = process.env.AI_VISION_MODEL ?? "gpt-4o-mini";
        const res = await fetch(`${openaiBase}/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${openaiKey}`,
          },
          body: JSON.stringify({
            model,
            messages: [
              {
                role: "system",
                content:
                  'Extract receipt data. Respond with ONLY JSON: {"merchant": string, "total": number, "currency": string(ISO code), "date": string(YYYY-MM-DD), "category": one of FOOD|TRANSPORT|HOTEL|FLIGHT|ACTIVITY|SHOPPING|ENTERTAINMENT|MISC}. If unclear, best guess.',
              },
              {
                role: "user",
                content: [
                  { type: "text", text: "This is a receipt photo." },
                  { type: "image_url", image_url: { url: dataUrl } },
                ],
              },
            ],
            max_tokens: 300,
          }),
        });
        if (!res.ok) throw new Error(`OpenAI Vision API ${res.status}`);
        const responseJson = (await res.json()) as {
          choices?: { message?: { content?: string } }[];
        };
        raw = responseJson.choices?.[0]?.message?.content ?? "";
      } else if (geminiKey) {
        const geminiModel = process.env.AI_VISION_MODEL ?? "gemini-1.5-flash";
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${geminiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [
                {
                  parts: [
                    {
                      text: 'Extract receipt data. Respond with ONLY valid JSON: {"merchant": string, "total": number, "currency": string(ISO code), "date": string(YYYY-MM-DD), "category": one of FOOD|TRANSPORT|HOTEL|FLIGHT|ACTIVITY|SHOPPING|ENTERTAINMENT|MISC}. If unclear, best guess.',
                    },
                    {
                      inlineData: {
                        mimeType,
                        data: base64Data,
                      },
                    },
                  ],
                },
              ],
            }),
          }
        );
        if (!res.ok) throw new Error(`Gemini Vision API ${res.status}`);
        const responseJson = (await res.json()) as {
          candidates?: { content?: { parts?: { text?: string }[] } }[];
        };
        raw = responseJson.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
      } else if (anthropicKey) {
        const anthropicModel = process.env.AI_VISION_MODEL ?? "claude-3-5-haiku-20241022";
        const res = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": anthropicKey,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model: anthropicModel,
            max_tokens: 300,
            messages: [
              {
                role: "user",
                content: [
                  {
                    type: "image",
                    source: {
                      type: "base64",
                      media_type: mimeType,
                      data: base64Data,
                    },
                  },
                  {
                    type: "text",
                    text: 'Extract receipt data. Respond with ONLY valid JSON: {"merchant": string, "total": number, "currency": string(ISO code), "date": string(YYYY-MM-DD), "category": one of FOOD|TRANSPORT|HOTEL|FLIGHT|ACTIVITY|SHOPPING|ENTERTAINMENT|MISC}.',
                  },
                ],
              },
            ],
          }),
        });
        if (!res.ok) throw new Error(`Anthropic Vision API ${res.status}`);
        const responseJson = (await res.json()) as {
          content?: { text?: string }[];
        };
        raw = responseJson.content?.[0]?.text ?? "";
      }

      const match = raw.match(/\{[\s\S]*\}/);
      if (!match) throw new Error("Unparseable response");
      const parsed = JSON.parse(match[0]) as Record<string, unknown>;
      const total = Number(parsed.total);
      return json({
        available: true,
        extracted: {
          merchant: String(parsed.merchant ?? "Unknown"),
          total: Number.isFinite(total) && total > 0 ? total : null,
          currency: String(parsed.currency ?? trip.homeCurrency).toUpperCase().slice(0, 3),
          date: typeof parsed.date === "string" ? parsed.date : new Date().toISOString().slice(0, 10),
          category: String(parsed.category ?? categorizeExpenseText(String(parsed.merchant ?? ""))),
        },
        requiresConfirmation: true,
      });
    } catch (e) {
      return json({
        available: false,
        reason: `Receipt scan failed (${e instanceof Error ? e.message : "error"}). Add it manually below.`,
      });
    }
  });
  return response;
}
