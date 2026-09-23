import "server-only";
import {
  TOOL_EXECUTORS,
  type ToolContext,
} from "./tools";
import { poisByCity, poiById } from "../data/pois";
import { haversineKm, fmtMinutes } from "../utils";
import { CURRENCY_SYMBOLS } from "../utils";

/**
 * The Local Brain — a deterministic intent engine that gives Wayfare full
 * assistant capability WITHOUT any external LLM configured. It routes natural
 * language to the same tools the real providers use, and composes grounded,
 * templated answers. When an API key is present the agent prefers the LLM;
 * this brain guarantees the product never feels dead.
 */

export type BrainResult = {
  content: string;
  data?: Record<string, unknown>;
};

function sym(c: string): string {
  return CURRENCY_SYMBOLS[c] ?? c + " ";
}

function money(n: number, c: string): string {
  return `${sym(c)}${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

const DAY_NAMES = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

/** Resolve a date phrase against the trip's actual days. */
async function resolveDate(text: string, ctx: ToolContext): Promise<string | null> {
  const res = (await TOOL_EXECUTORS.get_itinerary({}, ctx)) as {
    date: string;
    city: string;
    title: string | null;
    items: unknown[];
  }[];
  if (!res.length) return null;
  const t = text.toLowerCase();

  const dayN = t.match(/\bday\s*(\d+)\b/);
  if (dayN) {
    const idx = Math.min(Number(dayN[1]) - 1, res.length - 1);
    return res[Math.max(0, idx)]?.date ?? null;
  }
  if (/\btomorrow\b/.test(t)) {
    const target = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    return res.find((d) => d.date === target)?.date ?? res[0].date;
  }
  if (/\btoday\b|\btonight\b/.test(t)) {
    const today = new Date().toISOString().slice(0, 10);
    return res.find((d) => d.date === today)?.date ?? res[0].date;
  }
  for (let i = 0; i < DAY_NAMES.length; i++) {
    if (new RegExp(`\\b${DAY_NAMES[i]}\\b`).test(t)) {
      const found = res.find((d) => new Date(d.date + "T12:00:00").getDay() === i);
      if (found) return found.date;
    }
  }
  const monthMatch = t.match(
    /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+(\d{1,2})\b/
  );
  if (monthMatch) {
    const months = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
    const mIdx = months.indexOf(monthMatch[1]);
    const dayNum = Number(monthMatch[2]);
    const found = res.find((d) => {
      const dt = new Date(d.date + "T12:00:00");
      return dt.getMonth() === mIdx && dt.getDate() === dayNum;
    });
    if (found) return found.date;
  }
  return null;
}

function parseAmountLimit(text: string): number | undefined {
  const m =
    text.match(/(?:under|below|less than|max(?:imum)?|cheaper than|budget of)\s*[¥$₱€£]?\s*([\d,]{2,})/i) ??
    text.match(/[¥$₱€£]\s*([\d,]{3,})/);
  if (m) return Number(m[1].replace(/,/g, ""));
  return undefined;
}

function detectCurrency(text: string): string | undefined {
  if (/¥|jpy|yen/i.test(text)) return "JPY";
  if (/₱|\bphp\b|peso/i.test(text)) return "PHP";
  if (/\busd\b|\bdollar\b/i.test(text)) return "USD";
  if (/€|\beur\b|euro/i.test(text)) return "EUR";
  if (/£|\bgbp\b|pound/i.test(text)) return "GBP";
  if (/₩|\bkrw\b|won/i.test(text)) return "KRW";
  return undefined;
}

function detectMeal(text: string): "breakfast" | "lunch" | "dinner" | undefined {
  if (/\bbreakfast|morning food\b/i.test(text)) return "breakfast";
  if (/\blunch\b/i.test(text)) return "lunch";
  if (/\bdinner|supper|eat|hungry|food|ramen|sushi\b/i.test(text)) return "dinner";
  return undefined;
}

export async function runLocalBrain(
  message: string,
  ctx: ToolContext
): Promise<BrainResult> {
  const t = message.toLowerCase();

  try {
    // ---------------------------------------------------------------- optimize
    if (/\boptimiz|rearrange|reduce travel|minimize walking\b/.test(t)) {
      const date = (await resolveDate(t, ctx)) ?? (await firstItineraryDate(ctx));
      if (!date) return help("There is no itinerary yet to optimize.");
      const proposal = (await TOOL_EXECUTORS.optimize_day({ date }, ctx)) as {
        originalOrder: string[];
        optimizedOrder: string[];
        originalTravelMin: number;
        optimizedTravelMin: number;
        savedMin: number;
      };
      if (proposal.savedMin <= 2) {
        return {
          content: `I analyzed **${date}** and your current order is already efficient — total travel time is **${fmtMinutes(proposal.originalTravelMin)}**. No changes needed. 🎯`,
        };
      }
      return {
        content: [
          `Here's an optimization for **${date}**:`,
          ``,
          `**Current route** (${fmtMinutes(proposal.originalTravelMin)} travel)`,
          ...proposal.originalOrder.map((o, i) => `${i + 1}. ${o}`),
          ``,
          `**Optimized route** (${fmtMinutes(proposal.optimizedTravelMin)} travel)`,
          ...proposal.optimizedOrder.map((o, i) => `${i + 1}. ${o}`),
          ``,
          `⏱️ You'd save about **${fmtMinutes(proposal.savedMin)}** of travel time.`,
          ``,
          `Want me to apply this? Say "apply optimization".`,
        ].join("\n"),
        data: {
          kind: "optimization-proposal",
          date,
          savedMin: proposal.savedMin,
          originalTravelMin: proposal.originalTravelMin,
          optimizedTravelMin: proposal.optimizedTravelMin,
        },
      };
    }

    if (/\bapply (the )?(optimization|changes)\b/.test(t)) {
      const date = (await resolveDate(t, ctx)) ?? (await firstItineraryDate(ctx));
      if (!date) return help("No itinerary found to apply optimization to.");
      await TOOL_EXECUTORS.apply_optimization({ date, confirm: true }, ctx);
      return {
        content: `✅ Applied the optimized route for **${date}**. Your timeline is re-sorted to cut travel time.`,
        data: { kind: "itinerary-changed", date },
      };
    }

    // ---------------------------------------------------------------- restaurants
    if (
      /\b(restaurant|ramen|sushi|eat|food|lunch|dinner|hungry|izakaya|cafe|coffee)\b/.test(t) &&
      !/\badd\b/.test(t)
    ) {
      const hotels = (await TOOL_EXECUTORS.get_hotels({}, ctx)) as { name: string; lat: number | null; lng: number | null; checkIn: string }[];
      const maxCost = parseAmountLimit(t);
      const meal = detectMeal(t);
      const cuisine = /(ramen|sushi|tempura|tonkatsu|izakaya|sob|gyoza|curry)/.exec(t)?.[1];

      let nearLat: number | undefined;
      let nearLng: number | undefined;
      if (/\bnear (my )?hotel\b/.test(t) && hotels.length) {
        const relevantHotel = pickHotelForPhrase(t, hotels);
        nearLat = relevantHotel.lat ?? undefined;
        nearLng = relevantHotel.lng ?? undefined;
      }

      const recs = (await TOOL_EXECUTORS.search_restaurants(
        {
          cuisine,
          max_cost_per_person: maxCost,
          near_lat: nearLat,
          near_lng: nearLng,
          meal,
        },
        ctx
      )) as {
        poiId: string;
        name: string;
        neighborhood: string;
        rating: number;
        estCostPerPerson: number;
        currency: string;
        hours: string;
        why: string[];
        blurb: string;
      }[];

      if (!recs.length) {
        return help("I couldn't find restaurants matching those filters. Try widening the budget or cuisine.");
      }

      const lines = recs.map(
        (r, i) =>
          `${i + 1}. **${r.name}** · ${r.neighborhood}\n` +
          `   ${r.rating}★ · ~${money(r.estCostPerPerson, r.currency)} per person · ${r.hours}\n` +
          `   _Why:_ ${r.why.join(", ")}`
      );
      return {
        content: [
          `Here are my picks${meal ? ` for ${meal}` : ""}${maxCost ? ` under ${money(maxCost, detectCurrency(t) ?? "JPY")}` : ""}${nearLat != null ? " near your hotel" : ""}:`,
          ``,
          ...lines,
          ``,
          `_Say "add <name> to day N" and I'll put it on your itinerary._`,
        ].join("\n"),
        data: { kind: "restaurant-cards", items: recs },
      };
    }

    // ---------------------------------------------------------------- move item
    if (/\b(move|reschedule|push)\b/.test(t)) {
      return await handleMove(message, ctx);
    }

    // ---------------------------------------------------------------- add place
    if (/\b(add|book|put)\b/.test(t)) {
      return await handleAdd(message, ctx);
    }

    // ---------------------------------------------------------------- budget & expenses
    if (/\b(budget|spent|spend|expenses?|money left|how much|over budget|afford)\b/.test(t)) {
      const budget = (await TOOL_EXECUTORS.get_trip_budget({}, ctx)) as {
        budget: number;
        spent: number;
        remaining: number;
        homeCurrency: string;
        dailyAverage: number;
        projectedFinalSpend: number;
        projectedOverBudget: number;
        daysTotal: number;
      };
      const calc = (await TOOL_EXECUTORS.calculate_expenses({ group_by: "category" }, ctx)) as {
        byCategory: Record<string, number>;
      };
      const catLines = Object.entries(calc.byCategory)
        .sort((a, b) => b[1] - a[1])
        .map(([c, v]) => `- ${c.charAt(0)}${c.slice(1).toLowerCase()}: ${money(Math.round(v), budget.homeCurrency)}`);

      const pct = budget.budget > 0 ? Math.round((budget.spent / budget.budget) * 100) : 0;
      const insights: string[] = [];
      if (budget.projectedOverBudget > 0) {
        insights.push(
          `⚠️ At your current pace you'd finish around ${money(budget.projectedOverBudget, budget.homeCurrency)} over budget.`
        );
      } else if (budget.remaining > 0) {
        insights.push(
          `💡 You have ${money(budget.remaining, budget.homeCurrency)} left — about ${money(Math.round(budget.remaining / Math.max(1, budget.daysTotal)), budget.homeCurrency)} per remaining day.`
        );
      }

      return {
        content: [
          `💰 **Budget status**`,
          `- Spent: **${money(budget.spent, budget.homeCurrency)}** of ${money(budget.budget, budget.homeCurrency)} (${pct}%)`,
          `- Remaining: **${money(budget.remaining, budget.homeCurrency)}**`,
          `- Daily average: ${money(budget.dailyAverage, budget.homeCurrency)}`,
          ``,
          `**By category**`,
          ...catLines,
          ``,
          ...insights,
        ].join("\n"),
        data: { kind: "budget-report", ...budget },
      };
    }

    // ---------------------------------------------------------------- currency
    if (/\b(convert|exchange|rate|worth|in (php|usd|eur|jpy|gbp|krw))\b/.test(t)) {
      const amtMatch = t.match(/([\d,.]+)\s*(?:¥|jpy|yen|₱|php|pesos?|$|usd|dollars?|€|eur|euros?)?/);
      const amount = amtMatch ? Number(amtMatch[1].replace(/,/g, "")) || 10000 : 10000;
      const from = detectCurrency(t) ?? "JPY";
      const toCandidates = ["PHP", "USD", "EUR", "JPY", "GBP", "KRW"].filter(
        (c) => c !== from && new RegExp(c.toLowerCase(), "i").test(t.replace(from.toLowerCase(), ""))
      );
      const to = toCandidates[0] ?? "PHP";
      const rate = (await TOOL_EXECUTORS.get_exchange_rate({ amount, from, to }, ctx)) as {
        converted: number;
        updatedAt: string;
        source: string;
      };
      return {
        content: `${money(amount, from)} ≈ **${rate.converted.toLocaleString("en-US", { maximumFractionDigits: 2 })} ${to}**\n\n_Rates ${rate.source === "live" ? "updated" : "cached"} ${new Date(rate.updatedAt).toLocaleString()}._`,
      };
    }

    // ---------------------------------------------------------------- weather
    if (/\b(weather|rain|forecast|temperature)\b/.test(t)) {
      const weather = (await TOOL_EXECUTORS.get_weather({}, ctx)) as {
        city: string;
        date: string;
        minC: number;
        maxC: number;
        condition: string;
        rainProb: number;
      }[];
      const rainy = weather.filter((w) => w.rainProb >= 55);
      const lines = weather.slice(0, 6).map(
        (w) =>
          `- **${w.date}** (${w.city}): ${w.condition}, ${w.minC}–${w.maxC}°C, rain ${w.rainProb}%`
      );
      let extra = "";
      if (rainy.length) {
        extra = `\n\n🌧️ Rain likely on ${rainy.map((r) => r.date).join(", ")}. Indoor-friendly options those days: teamLab Planets, Tokyo National Museum, depachika food halls, or a long izakaya evening. Want me to rearrange?`;
      }
      return { content: [`🌦️ **Forecast for your trip**`, ...lines].join("\n") + extra };
    }

    // ---------------------------------------------------------------- what to do
    if (/\b(what should i do|recommend|suggest|ideas|plan (my|the) day|anything (else|to do)|free time)\b/.test(t)) {
      return await handleSuggest(message, ctx);
    }

    // ---------------------------------------------------------------- packing
    if (/\bpac(k|king)\b/.test(t)) {
      const trip = await TOOL_EXECUTORS.get_trip_budget({}, ctx);
      void trip;
      return {
        content: `Open the **Packing** page for your smart checklist — it adapts to destinations, season, and activities. You can ask me things like "do I need an umbrella?" anytime.`,
        data: { kind: "navigate", page: "packing" },
      };
    }

    // ---------------------------------------------------------------- reservations
    if (/\breserv|confirmation|booking\b/.test(t)) {
      return {
        content: `All your bookings live in the **Reservations** center — flights, hotels, timed tickets, with confirmation numbers and cancellation deadlines. I can add one for you: e.g. _"add reservation teamLab Planets March 17 10:00 ¥3,800 confirmation TLM88421"_.`,
        data: { kind: "navigate", page: "reservations" },
      };
    }

    // ---------------------------------------------------------------- default: trip brief
    const itinerary = (await TOOL_EXECUTORS.get_itinerary({}, ctx)) as {
      date: string;
      city: string;
      title: string | null;
      items: { title: string; time: string | null }[];
    }[];
    const budget = (await TOOL_EXECUTORS.get_trip_budget({}, ctx)) as {
      spent: number;
      budget: number;
      homeCurrency: string;
    };
    const nextDay = itinerary.find((d) => new Date(d.date + "T23:59") >= new Date()) ?? itinerary[0];
    return {
      content: [
        `Here's your trip at a glance 👇`,
        ``,
        nextDay
          ? `**Next up — ${nextDay.date} (${nextDay.city})**: ${
              nextDay.items
                .slice(0, 3)
                .map((i) => `${i.time ?? ""} ${i.title}`.trim())
                .join(" → ") || "nothing planned yet"
            }`
          : `Your itinerary is empty — try "build me a 5 day Tokyo itinerary".`,
        ``,
        `Spent ${money(budget.spent, budget.homeCurrency)} of ${money(budget.budget, budget.homeCurrency)}.`,
        ``,
        `Ask me to:`,
        `- _What should I do tomorrow?_`,
        `- _Find ramen near my hotel under ¥2,000_`,
        `- _Optimize day 4_`,
        `- _How much have I spent on food?_`,
        `- _Add Ichiran to day 2 at 19:00_`,
      ].join("\n"),
    };
  } catch (e) {
    return {
      content: `Something went sideways handling that: ${e instanceof Error ? e.message : "unknown error"}.\n\nTry rephrasing, or ask me about your itinerary, budget, restaurants, weather, or optimizations.`,
    };
  }
}

async function firstItineraryDate(ctx: ToolContext): Promise<string | null> {
  const days = (await TOOL_EXECUTORS.get_itinerary({}, ctx)) as { date: string }[];
  return days[0]?.date ?? null;
}

function pickHotelForPhrase(
  _text: string,
  hotels: { name: string; checkIn: string; lat: number | null; lng: number | null }[]
): { lat: number | null; lng: number | null } {
  void _text;
  return hotels[0] ?? { lat: null, lng: null };
}

// ------------------------------------------------------------- add handler

async function handleAdd(message: string, ctx: ToolContext): Promise<BrainResult> {
  const t = message.toLowerCase();
  // Find a matching POI by scanning dataset names mentioned in the message.
  const allPois = [...poisByCity("Tokyo"), ...poisByCity("Kyoto")];
  const mentioned =
    allPois.find((p) => p.name.length > 6 && t.includes(p.name.toLowerCase())) ??
    allPois.find((p) =>
      p.name
        .toLowerCase()
        .split(/[\s(]+/)[0]
        .length > 5 && t.includes(p.name.toLowerCase().split(/[\s(]+/)[0])
    );

  const date = await resolveDate(t, ctx);
  const timeMatch = t.match(/\bat\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/);

  if (!mentioned) {
    return help(
      `I couldn't tell which place you mean. Try naming it exactly, like "add teamLab Planets to day 2". Or ask me to search: "find art museums in Tokyo".`
    );
  }

  let startTime: string | undefined;
  if (timeMatch) {
    let h = Number(timeMatch[1]);
    const m = timeMatch[2] ? String(timeMatch[2]).padStart(2, "0") : "00";
    if (timeMatch[3] === "pm" && h < 12) h += 12;
    if (timeMatch[3] === "am" && h === 12) h = 0;
    startTime = `${String(h).padStart(2, "0")}:${m}`;
  }

  const created = (await TOOL_EXECUTORS.create_itinerary_item(
    {
      date: date ?? (await firstItineraryDate(ctx)) ?? new Date().toISOString().slice(0, 10),
      title: mentioned.name,
      type: mentioned.category === "RESTAURANT" ? "RESTAURANT" : "ACTIVITY",
      start_time: startTime,
      poi_id: mentioned.id,
    },
    ctx
  )) as { created: { title: string }; date: string };

  return {
    content: `✅ Added **${created.created.title}** to **${created.date}**${startTime ? ` at ${startTime}` : ""}. Estimated cost ~${money(mentioned.avgCost, mentioned.currency)} per person.`,
    data: { kind: "itinerary-changed", date: created.date },
  };
}

// ------------------------------------------------------------- move handler

async function handleMove(message: string, ctx: ToolContext): Promise<BrainResult> {
  const t = message.toLowerCase();
  const targetDate = await resolveDate(t.split(/\b(to|on)\b/).slice(-2).join(" ") || t, ctx);
  // Find the referenced existing item by keyword overlap
  const keywords = ["dinner", "lunch", "breakfast", "hotel"];
  const kw = keywords.find((k) => t.includes(k));
  const query = kw ?? t.replace(/\bmove\b|\bto\b|\bon\b|\bat\b|\d{1,2}(:\d{2})?\s*(am|pm)?|\btomorrow\b|\btoday\b/g, "").trim();
  const matches = (await TOOL_EXECUTORS.find_itinerary_items(
    { query: query.split(/\s+/).filter(Boolean)[0] ?? query },
    ctx
  )) as { itemId: string; title: string; date: string; type: string }[];
  if (!matches.length) {
    return help(`I couldn't find "${query}" in your itinerary. Which item did you mean?`);
  }
  if (!targetDate) return help(`Where should it go? E.g. "move dinner to day 3 at 8 PM".`);
  const timeMatch = t.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/);
  let startTime: string | undefined;
  if (timeMatch) {
    let h = Number(timeMatch[1]);
    const m = timeMatch[2] ?? "00";
    if (timeMatch[3] === "pm" && h < 12) h += 12;
    startTime = `${String(h).padStart(2, "0")}:${m}`;
  }
  const moved = (await TOOL_EXECUTORS.move_itinerary_item(
    { item_id: matches[0].itemId, to_date: targetDate, start_time: startTime },
    ctx
  )) as { nowOn: string };
  return {
    content: `✅ Moved **${matches[0].title}** to **${moved.nowOn}**${startTime ? `, now at ${startTime}` : ""}.`,
    data: { kind: "itinerary-changed", date: moved.nowOn },
  };
}

// ------------------------------------------------------------- suggest handler

async function handleSuggest(_message: string, ctx: ToolContext): Promise<BrainResult> {
  const itinerary = (await TOOL_EXECUTORS.get_itinerary({}, ctx)) as {
    date: string;
    city: string;
    items: { title: string; neighborhood: string | null; lat: number | null; lng: number | null; transportMin: number | null }[];
  }[];
  if (!itinerary.length) return help("Create a trip itinerary first and I'll fill your free time.");

  // Find the day with fewest scheduled items (the "light" day)
  const sorted = [...itinerary].sort((a, b) => a.items.length - b.items.length);
  const lightDay = sorted[0];
  const anchor = lightDay.items.find((i) => i.lat != null);

  const suggestions = (await TOOL_EXECUTORS.search_places(
    {
      city: lightDay.city,
      category: /\bmuseum|art\b/i.test(_message) ? "MUSEUM" : undefined,
      near_lat: anchor?.lat ?? undefined,
      near_lng: anchor?.lng ?? undefined,
      max_walk_min: 25,
    },
    ctx
  )) as { poiId: string; name: string; neighborhood: string; blurb: string; hours: string }[];

  const already = new Set(lightDay.items.map((i) => i.title));
  const fresh = suggestions.filter((s) => !already.has(s.name)).slice(0, 4);
  const costs = fresh.map((f) => poiById(f.poiId)?.avgCost ?? 0);

  return {
    content: [
      `**${lightDay.date} (${lightDay.city})** looks light — only ${lightDay.items.length} thing${lightDay.items.length === 1 ? "" : "s"} planned.`,
      ``,
      `Here's how I'd spend the day nearby${anchor?.neighborhood ? ` around ${anchor.neighborhood}` : ""}:`,
      ...fresh.map((f, i) => `${i + 1}. **${f.name}** (${f.neighborhood}) — ${f.blurb} · ${f.hours}`),
      ``,
      `Estimated additional cost: ~${money(costs.reduce((s, c) => s + c, 0), "JPY")} per person.`,
      ``,
      `_Tell me "add <name>" and I'll slot it in._`,
    ].join("\n"),
    data: { kind: "place-cards", items: fresh },
  };
}

function help(note?: string): BrainResult {
  return {
    content: [
      note ?? "Happy to help!",
      ``,
      `I can:`,
      `- Plan & edit your itinerary (_"add teamLab to day 2"_, _"move dinner to 8 PM"_)`,
      `- Optimize routes (_"optimize day 3"_)`,
      `- Find restaurants (_"cheap ramen near my hotel"_)`,
      `- Track budget (_"how much have I spent?"_)`,
      `- Convert currency (_"convert ¥10,000 to PHP"_)`,
      `- Check weather & adapt plans`,
    ].join("\n"),
  };
}
