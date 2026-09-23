import "server-only";
import { db } from "../db";
import { getRates, convert } from "../currency";
import { poisByCity, poiById } from "../data/pois";
import { optimizeDay, categorizeExpenseText, type OptimizeItemIn } from "../planner";
import {
  haversineKm,
  estimateTransit,
  parseTimeToMinutes,
} from "../utils";

/**
 * Tool registry — the AI agent's hands over structured trip data.
 * Every tool validates its own args defensively and returns plain JSON.
 */

export type ToolContext = { tripId: string; userId: string };

export type ToolDef = {
  name: string;
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
};

const str = (v: unknown): string | undefined =>
  typeof v === "string" && v.trim() ? v.trim() : undefined;
const num = (v: unknown): number | undefined =>
  typeof v === "number" && Number.isFinite(v) ? v : typeof v === "string" && v.trim() !== "" && !isNaN(Number(v)) ? Number(v) : undefined;

function toDate(v: unknown, fallback?: Date): Date | undefined {
  const s = str(v);
  if (!s) return fallback;
  const d = new Date(s);
  return isNaN(d.getTime()) ? fallback : d;
}

async function assertTrip(ctx: ToolContext) {
  const trip = await db.trip.findFirst({
    where: { id: ctx.tripId, userId: ctx.userId },
  });
  if (!trip) throw new Error("Trip not found");
  return trip;
}

async function daysWithItems(tripId: string) {
  const days = await db.itineraryDay.findMany({
    where: { tripId },
    orderBy: { date: "asc" },
    include: { items: { orderBy: { order: "asc" } } },
  });
  return days;
}

function compactItem(it: {
  id: string;
  type: string;
  title: string;
  startTime: number | null;
  endTime: number | null;
  durationMin: number;
  placeName: string | null;
  neighborhood: string | null;
  lat: number | null;
  lng: number | null;
  cost: number | null;
  currency: string | null;
  transportMode: string | null;
  transportMin: number | null;
  confirmed: boolean;
}) {
  return {
    itemId: it.id,
    type: it.type,
    title: it.title,
    time: it.startTime != null ? `${String(Math.floor(it.startTime / 60)).padStart(2, "0")}:${String(it.startTime % 60).padStart(2, "0")}` : null,
    durationMin: it.durationMin,
    place: it.placeName,
    neighborhood: it.neighborhood,
    lat: it.lat,
    lng: it.lng,
    cost: it.cost,
    currency: it.currency,
    travelToNextMin: it.transportMin,
    confirmed: it.confirmed,
  };
}

async function spentSummary(tripId: string, homeCurrency: string) {
  const expenses = await db.expense.findMany({ where: { tripId } });
  const total = expenses.reduce((s, e) => s + e.amountHome, 0);
  const byCategory: Record<string, number> = {};
  const byDay: Record<string, number> = {};
  for (const e of expenses) {
    byCategory[e.category] = (byCategory[e.category] ?? 0) + e.amountHome;
    const k = e.date.toISOString().slice(0, 10);
    byDay[k] = (byDay[k] ?? 0) + e.amountHome;
  }
  return { expenses, total, byCategory, byDay };
}

export const TOOL_DEFS: Record<string, ToolDef> = {};
export const TOOL_EXECUTORS: Record<
  string,
  (args: Record<string, unknown>, ctx: ToolContext) => Promise<unknown>
> = {};

function tool(def: ToolDef, exec: (args: Record<string, unknown>, ctx: ToolContext) => Promise<unknown>) {
  TOOL_DEFS[def.name] = def;
  TOOL_EXECUTORS[def.name] = exec;
}

// ---------------------------------------------------------------- itinerary

tool(
  {
    name: "get_itinerary",
    description:
      "Get the full day-by-day itinerary (optionally filtered to one date). Use this before suggesting changes.",
    parameters: {
      type: "object",
      properties: { date: { type: "string", description: "ISO date like 2027-03-15 (optional)" } },
    },
  },
  async (args, ctx) => {
    const dateFilter = str(args.date);
    const days = await daysWithItems(ctx.tripId);
    return days
      .filter((d) => !dateFilter || d.date.toISOString().slice(0, 10) === dateFilter)
      .map((d) => ({
        dayId: d.id,
        date: d.date.toISOString().slice(0, 10),
        city: d.city,
        title: d.title,
        items: d.items.map(compactItem),
      }));
  }
);

tool(
  {
    name: "find_itinerary_items",
    description: "Search existing itinerary items by keyword (e.g. 'dinner', 'teamlab', 'sushi').",
    parameters: {
      type: "object",
      properties: { query: { type: "string" } },
      required: ["query"],
    },
  },
  async (args, ctx) => {
    const q = (str(args.query) ?? "").toLowerCase();
    const days = await daysWithItems(ctx.tripId);
    return days.flatMap((d) =>
      d.items
        .filter((it) =>
          `${it.title} ${it.placeName ?? ""} ${it.type}`.toLowerCase().includes(q)
        )
        .map((it) => ({ ...compactItem(it), date: d.date.toISOString().slice(0, 10), dayId: d.id }))
    );
  }
);

tool(
  {
    name: "create_itinerary_item",
    description:
      "Add a new item to the itinerary on a given date. Times are minutes-from-midnight OR 'HH:MM' strings.",
    parameters: {
      type: "object",
      properties: {
        date: { type: "string", description: "ISO date YYYY-MM-DD" },
        title: { type: "string" },
        type: { type: "string", enum: ["FLIGHT", "HOTEL", "RESTAURANT", "ACTIVITY", "TRANSPORT", "RESERVATION", "PERSONAL"] },
        start_time: { type: "string", description: "'HH:MM'" },
        duration_min: { type: "number" },
        place_name: { type: "string" },
        poi_id: { type: "string", description: "If known, links coordinates/costs from the places database" },
        city_hint: { type: "string", description: "City name, used if a new day must be created" },
        cost: { type: "number" },
        notes: { type: "string" },
      },
      required: ["date", "title"],
    },
  },
  async (args, ctx) => {
    const trip = await assertTrip(ctx);
    const date = toDate(args.date);
    if (!date) throw new Error("Invalid date");
    let day = await db.itineraryDay.findFirst({
      where: { tripId: ctx.tripId, date: { gte: new Date(date.getFullYear(), date.getMonth(), date.getDate()), lt: new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1) } },
    });
    if (!day) {
      const count = await db.itineraryDay.count({ where: { tripId: ctx.tripId } });
      day = await db.itineraryDay.create({
        data: {
          tripId: ctx.tripId,
          date,
          city: str(args.city_hint) ?? trip.subtitle?.split("·")[0]?.trim() ?? "Trip",
          dayIndex: count + 1,
          title: null,
        },
      });
    }
    const poi = str(args.poi_id) ? poiById(str(args.poi_id)!) : undefined;
    const startTime =
      args.start_time != null ? parseTimeToMinutes(String(args.start_time)) : null;
    const durationMin = num(args.duration_min) ?? poi?.durationMin ?? 60;
    const order = await db.itineraryItem.count({ where: { dayId: day.id } });
    const item = await db.itineraryItem.create({
      data: {
        tripId: ctx.tripId,
        dayId: day.id,
        type: str(args.type) ?? (poi?.category === "RESTAURANT" ? "RESTAURANT" : "ACTIVITY"),
        title: str(args.title)!,
        startTime,
        endTime: startTime != null ? startTime + durationMin : null,
        durationMin,
        placeName: poi?.name ?? str(args.place_name),
        lat: poi?.lat,
        lng: poi?.lng,
        neighborhood: poi?.neighborhood,
        cost: num(args.cost) ?? (poi?.avgCost || undefined),
        currency: poi?.currency ?? trip.homeCurrency,
        notes: str(args.notes),
        order,
      },
    });
    return { created: compactItem(item), date: day.date.toISOString().slice(0, 10) };
  }
);

tool(
  {
    name: "update_itinerary_item",
    description: "Update time/duration/title/cost of an existing itinerary item.",
    parameters: {
      type: "object",
      properties: {
        item_id: { type: "string" },
        title: { type: "string" },
        start_time: { type: "string", description: "'HH:MM'" },
        duration_min: { type: "number" },
        cost: { type: "number" },
        notes: { type: "string" },
      },
      required: ["item_id"],
    },
  },
  async (args, ctx) => {
    await assertTrip(ctx);
    const existing = await db.itineraryItem.findFirst({
      where: { id: str(args.item_id)!, tripId: ctx.tripId },
    });
    if (!existing) throw new Error("Item not found");
    const patch: Record<string, unknown> = {};
    if (str(args.title)) patch.title = str(args.title);
    if (str(args.start_time)) {
      const st = parseTimeToMinutes(str(args.start_time)!);
      patch.startTime = st;
      patch.endTime = st + (num(args.duration_min) ?? 60);
    }
    if (num(args.duration_min) != null) patch.durationMin = num(args.duration_min);
    if (str(args.notes)) patch.notes = str(args.notes);
    if (num(args.cost) != null) patch.cost = num(args.cost);
    const item = await db.itineraryItem.update({
      where: { id: existing.id },
      data: patch,
    });
    return { updated: compactItem(item) };
  }
);

tool(
  {
    name: "delete_itinerary_item",
    description: "Remove an item from the itinerary.",
    parameters: {
      type: "object",
      properties: { item_id: { type: "string" } },
      required: ["item_id"],
    },
  },
  async (args, ctx) => {
    await assertTrip(ctx);
    const existing = await db.itineraryItem.findFirst({
      where: { id: str(args.item_id)!, tripId: ctx.tripId },
    });
    if (!existing) throw new Error("Item not found");
    await db.itineraryItem.delete({ where: { id: existing.id } });
    return { deleted: str(args.item_id) };
  }
);

tool(
  {
    name: "move_itinerary_item",
    description: "Move an itinerary item to another date (and optionally set a new time).",
    parameters: {
      type: "object",
      properties: {
        item_id: { type: "string" },
        to_date: { type: "string", description: "ISO date YYYY-MM-DD" },
        start_time: { type: "string", description: "'HH:MM' optional" },
      },
      required: ["item_id", "to_date"],
    },
  },
  async (args, ctx) => {
    await assertTrip(ctx);
    const existing = await db.itineraryItem.findFirst({
      where: { id: str(args.item_id)!, tripId: ctx.tripId },
    });
    if (!existing) throw new Error("Item not found");
    const target = toDate(args.to_date)!;
    let day = await db.itineraryDay.findFirst({
      where: {
        tripId: ctx.tripId,
        date: {
          gte: new Date(target.getFullYear(), target.getMonth(), target.getDate()),
          lt: new Date(target.getFullYear(), target.getMonth(), target.getDate() + 1),
        },
      },
    });
    if (!day) {
      const trip = await assertTrip(ctx);
      const count = await db.itineraryDay.count({ where: { tripId: ctx.tripId } });
      day = await db.itineraryDay.create({
        data: {
          tripId: ctx.tripId,
          date: target,
          city: trip.subtitle?.split("·")[0]?.trim() ?? "Trip",
          dayIndex: count + 1,
        },
      });
    }
    const order = await db.itineraryItem.count({ where: { dayId: day.id } });
    const patch: Record<string, unknown> = { dayId: day.id, order };
    if (str(args.start_time)) {
      const st = parseTimeToMinutes(str(args.start_time)!);
      patch.startTime = st;
      patch.endTime = st + 60;
    }
    const item = await db.itineraryItem.update({ where: { id: existing.id }, data: patch });
    return { moved: compactItem(item), nowOn: day.date.toISOString().slice(0, 10) };
  }
);

// ---------------------------------------------------------------- optimization

tool(
  {
    name: "optimize_day",
    description:
      "Compute an optimized visiting order for one itinerary day to minimize travel time. Returns a preview; nothing is changed.",
    parameters: {
      type: "object",
      properties: { date: { type: "string", description: "ISO date" } },
      required: ["date"],
    },
  },
  async (args, ctx) => {
    const dateStr = str(args.date)!;
    const day = (await daysWithItems(ctx.tripId)).find(
      (d) => d.date.toISOString().slice(0, 10) === dateStr
    );
    if (!day) throw new Error(`No itinerary found for ${dateStr}`);
    const geoItems: OptimizeItemIn[] = day.items.map((it) => ({
      id: it.id,
      title: it.title,
      lat: it.lat,
      lng: it.lng,
      startTime: it.startTime,
      durationMin: it.durationMin,
      fixed: it.confirmed === false ? false : it.type === "RESTAURANT" && !!it.notes?.includes("reserved"),
    }));
    const result = optimizeDay(geoItems);
    return {
      date: dateStr,
      originalOrder: day.items.map((i) => i.title),
      optimizedOrder: result.order.map((o) => o.title),
      originalTravelMin: result.originalTravelMin,
      optimizedTravelMin: result.optimizedTravelMin,
      savedMin: result.savedMin,
      applied: false,
    };
  }
);

tool(
  {
    name: "apply_optimization",
    description: "Apply the optimized order produced by optimize_day to the actual itinerary.",
    parameters: {
      type: "object",
      properties: { date: { type: "string" }, confirm: { type: "boolean" } },
      required: ["date", "confirm"],
    },
  },
  async (args, ctx) => {
    if (args.confirm !== true) {
      return { applied: false, reason: "User has not confirmed. Ask them to confirm before applying." };
    }
    const dateStr = str(args.date)!;
    const day = (await daysWithItems(ctx.tripId)).find(
      (d) => d.date.toISOString().slice(0, 10) === dateStr
    );
    if (!day) throw new Error(`No itinerary found for ${dateStr}`);
    const geoItems: OptimizeItemIn[] = day.items.map((it) => ({
      id: it.id,
      title: it.title,
      lat: it.lat,
      lng: it.lng,
      startTime: it.startTime,
      durationMin: it.durationMin,
      fixed: false,
    }));
    const result = optimizeDay(geoItems);
    let i = 0;
    for (const o of result.order) {
      await db.itineraryItem.update({
        where: { id: o.id },
        data: { order: i++, startTime: o.startTime, endTime: o.startTime != null ? o.startTime! + o.durationMin : null },
      });
    }
    return { applied: true, newOrder: result.order.map((o) => o.title) };
  }
);

// ---------------------------------------------------------------- places

tool(
  {
    name: "search_places",
    description:
      "Search the curated places database (attractions, restaurants, cafes, bars, shopping, essentials) by query/category/city/location.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string" },
        category: { type: "string", enum: ["RESTAURANT", "ATTRACTION", "CAFE", "BAR", "SHOPPING", "ESSENTIAL", "PARK", "MUSEUM", "TEMPLE"] },
        city: { type: "string" },
        near_lat: { type: "number" },
        near_lng: { type: "number" },
        max_walk_min: { type: "number" },
      },
    },
  },
  async (args) => {
    const q = (str(args.query) ?? "").toLowerCase();
    let pool = str(args.city) ? poisByCity(str(args.city)!) : Object.values(poisByCity("Tokyo")).concat(poisByCity("Kyoto"));
    if (str(args.category)) pool = pool.filter((p) => p.category === str(args.category));
    if (q) {
      pool = pool.filter((p) =>
        `${p.name} ${p.cuisine ?? ""} ${p.neighborhood} ${p.tags.join(" ")}`.toLowerCase().includes(q)
      );
    }
    if (num(args.near_lat) != null && num(args.near_lng) != null) {
      const la = num(args.near_lat)!;
      const ln = num(args.near_lng)!;
      const maxKm = ((num(args.max_walk_min) ?? 15) / 60) * 4.8;
      pool = pool
        .map((p) => ({ p, km: haversineKm(la, ln, p.lat, p.lng) }))
        .filter(({ km }) => km <= Math.max(maxKm, 0.4))
        .sort((a, b) => a.km - b.km)
        .map(({ p }) => p);
    }
    return pool.slice(0, 8).map((p) => ({
      poiId: p.id,
      name: p.name,
      category: p.category,
      city: p.city,
      neighborhood: p.neighborhood,
      rating: p.rating,
      priceLevel: p.priceLevel,
      avgCost: p.avgCost,
      currency: p.currency,
      hours: p.hours,
      cuisine: p.cuisine,
      blurb: p.blurb,
    }));
  }
);

tool(
  {
    name: "search_restaurants",
    description:
      "Find suitable restaurants ranked by fit (location, budget, cuisine, rating). Returns reasons for each pick.",
    parameters: {
      type: "object",
      properties: {
        city: { type: "string" },
        cuisine: { type: "string" },
        max_cost_per_person: { type: "number" },
        near_lat: { type: "number" },
        near_lng: { type: "number" },
        meal: { type: "string", enum: ["breakfast", "lunch", "dinner"] },
      },
    },
  },
  async (args) => {
    const cities = str(args.city) ? [str(args.city)!] : ["Tokyo", "Kyoto"];
    let pool = cities.flatMap(poisByCity).filter((p) => p.category === "RESTAURANT");
    if (str(args.cuisine)) {
      const c = str(args.cuisine)!.toLowerCase();
      pool = pool.filter(
        (p) => (p.cuisine ?? "").toLowerCase().includes(c) || p.name.toLowerCase().includes(c)
      );
    }
    const maxCost = num(args.max_cost_per_person);
    if (maxCost != null) pool = pool.filter((p) => p.avgCost <= maxCost);

    const nearLat = num(args.near_lat);
    const nearLng = num(args.near_lng);

    const scored = pool.map((p) => {
      let score = p.rating * 2;
      const reasons: string[] = [];
      if (nearLat != null && nearLng != null) {
        const km = haversineKm(nearLat, nearLng, p.lat, p.lng);
        score -= km * 2.2;
        if (km < 1) reasons.push(`${Math.round((km / 4.8) * 60)} min walk away`);
        else if (km < 5) reasons.push(`${estimateTransit(km, "TRAIN").minutes} min transit`);
      }
      if (maxCost != null && p.avgCost <= maxCost * 0.7) reasons.push("well under your budget");
      if (p.rating >= 4.5) reasons.push(`highly rated (${p.rating}★)`);
      if (str(args.meal) === "lunch" && p.hours.includes("AM")) reasons.push("open for lunch");
      if (str(args.meal) === "dinner" && (p.hours.includes("late") || p.priceLevel >= 2))
        reasons.push("great dinner spot");
      if (!reasons.length) reasons.push(p.blurb.slice(0, 60));
      return { p, score, reasons };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, 5).map(({ p, reasons }) => ({
      poiId: p.id,
      name: p.name,
      cuisine: p.cuisine,
      neighborhood: p.neighborhood,
      rating: p.rating,
      priceLevel: p.priceLevel,
      estCostPerPerson: p.avgCost,
      currency: p.currency,
      hours: p.hours,
      why: reasons.slice(0, 2),
      blurb: p.blurb,
    }));
  }
);

tool(
  {
    name: "get_place_details",
    description: "Get full details for a single place from the curated database.",
    parameters: {
      type: "object",
      properties: { poi_id: { type: "string" } },
      required: ["poi_id"],
    },
  },
  async (args) => {
    const p = poiById(str(args.poi_id)!);
    if (!p) throw new Error("Place not found");
    return { ...p };
  }
);

tool(
  {
    name: "save_place",
    description: "Save a place from the curated database to the trip's saved places.",
    parameters: {
      type: "object",
      properties: { poi_id: { type: "string" } },
      required: ["poi_id"],
    },
  },
  async (args, ctx) => {
    await assertTrip(ctx);
    const p = poiById(str(args.poi_id)!);
    if (!p) throw new Error("Place not found");
    const exists = await db.savedPlace.findFirst({
      where: { tripId: ctx.tripId, name: p.name },
    });
    if (exists) return { alreadySaved: true, savedPlaceId: exists.id };
    const sp = await db.savedPlace.create({
      data: {
        tripId: ctx.tripId,
        name: p.name,
        category: p.category,
        cuisine: p.cuisine,
        lat: p.lat,
        lng: p.lng,
        address: `${p.neighborhood}, ${p.city}`,
        rating: p.rating,
        priceLevel: p.priceLevel,
        openHours: p.hours,
      },
    });
    return { saved: sp.name, savedPlaceId: sp.id };
  }
);

// ---------------------------------------------------------------- money

tool(
  {
    name: "add_expense",
    description:
      "Record an expense for the trip. Category auto-detected from merchant text when omitted.",
    parameters: {
      type: "object",
      properties: {
        amount: { type: "number" },
        currency: { type: "string", description: "ISO code like JPY" },
        merchant: { type: "string" },
        category: { type: "string", enum: ["FOOD", "TRANSPORT", "HOTEL", "FLIGHT", "ACTIVITY", "SHOPPING", "ENTERTAINMENT", "MISC"] },
        date: { type: "string", description: "ISO datetime, defaults to today" },
        description: { type: "string" },
      },
      required: ["amount", "merchant"],
    },
  },
  async (args, ctx) => {
    const trip = await assertTrip(ctx);
    const amount = num(args.amount)!;
    const currency = str(args.currency) ?? trip.homeCurrency;
    const merchant = str(args.merchant)!;
    const category = str(args.category) ?? categorizeExpenseText(merchant);
    const { rates } = await getRates();
    const amountHome = convert(amount, currency, trip.homeCurrency, rates);
    const exp = await db.expense.create({
      data: {
        tripId: ctx.tripId,
        category,
        amount,
        currency,
        amountHome,
        date: toDate(args.date, new Date())!,
        merchant,
        description: str(args.description),
        aiCategorized: !str(args.category),
      },
    });
    return { expenseId: exp.id, category, amountHome: Math.round(amountHome * 100) / 100, homeCurrency: trip.homeCurrency };
  }
);

tool(
  {
    name: "calculate_expenses",
    description: "Summarize spending grouped by category or day, converted into home currency.",
    parameters: {
      type: "object",
      properties: { group_by: { type: "string", enum: ["category", "day"] } },
    },
  },
  async (_args, ctx) => {
    const trip = await assertTrip(ctx);
    const { total, byCategory, byDay } = await spentSummary(ctx.tripId, trip.homeCurrency);
    return { totalHome: Math.round(total * 100) / 100, homeCurrency: trip.homeCurrency, byCategory, byDay };
  }
);

tool(
  {
    name: "get_trip_budget",
    description:
      "Budget status: total budget, spent, remaining, daily average, and projected final spend.",
    parameters: { type: "object", properties: {} },
  },
  async (_args, ctx) => {
    const trip = await assertTrip(ctx);
    const { total } = await spentSummary(ctx.tripId, trip.homeCurrency);
    const dayCount =
      Math.round((trip.endDate.getTime() - trip.startDate.getTime()) / 86400000) + 1;
    const elapsedDays = Math.min(
      dayCount,
      Math.max(
        1,
        Math.ceil((Date.now() - trip.startDate.getTime()) / 86400000) || 1
      )
    );
    const dailyAvg = total / elapsedDays;
    const projected = dailyAvg * dayCount;
    return {
      budget: trip.budgetAmount,
      homeCurrency: trip.homeCurrency,
      spent: Math.round(total * 100) / 100,
      remaining: Math.round((trip.budgetAmount - total) * 100) / 100,
      daysTotal: dayCount,
      dailyAverage: Math.round(dailyAvg),
      projectedFinalSpend: Math.round(projected),
      projectedOverBudget: Math.round(Math.max(0, projected - trip.budgetAmount)),
    };
  }
);

tool(
  {
    name: "get_exchange_rate",
    description: "Convert an amount between currencies using cached exchange rates.",
    parameters: {
      type: "object",
      properties: {
        amount: { type: "number" },
        from: { type: "string" },
        to: { type: "string" },
      },
      required: ["amount", "from", "to"],
    },
  },
  async (args) => {
    const { rates, updatedAt, source } = await getRates();
    const amount = num(args.amount)!;
    const out = convert(amount, str(args.from)!, str(args.to)!, rates);
    return {
      amount,
      from: str(args.from),
      to: str(args.to),
      converted: Math.round(out * 100) / 100,
      updatedAt,
      source,
    };
  }
);

// ---------------------------------------------------------------- context

tool(
  {
    name: "get_weather",
    description: "Weather forecast/snapshot for trip dates (optionally one specific date).",
    parameters: {
      type: "object",
      properties: { date: { type: "string", description: "optional ISO date" } },
    },
  },
  async (args, ctx) => {
    let weather = await db.weatherSnapshot.findMany({
      where: { tripId: ctx.tripId },
      orderBy: { date: "asc" },
    });
    const d = str(args.date);
    if (d) weather = weather.filter((w) => w.date.toISOString().slice(0, 10) === d);
    return weather.map((w) => ({
      city: w.city,
      date: w.date.toISOString().slice(0, 10),
      minC: w.tempMinC,
      maxC: w.tempMaxC,
      condition: w.condition,
      rainProb: w.rainProb,
      source: w.source,
    }));
  }
);

tool(
  {
    name: "get_hotels",
    description: "Hotels booked for this trip with addresses and coordinates.",
    parameters: { type: "object", properties: {} },
  },
  async (_args, ctx) => {
    const hotels = await db.hotel.findMany({ where: { tripId: ctx.tripId } });
    return hotels.map((h) => ({
      hotelId: h.id,
      name: h.name,
      area: h.destinationName,
      address: h.address,
      lat: h.lat,
      lng: h.lng,
      checkIn: h.checkIn.toISOString().slice(0, 10),
      checkOut: h.checkOut.toISOString().slice(0, 10),
      nights: h.nights,
    }));
  }
);

tool(
  {
    name: "add_reservation",
    description: "Add a reservation (restaurant, activity, tour, train, event) to the reservation center.",
    parameters: {
      type: "object",
      properties: {
        type: { type: "string", enum: ["RESTAURANT", "ACTIVITY", "TRAIN", "TOUR", "EVENT"] },
        title: { type: "string" },
        date_time: { type: "string", description: "ISO datetime" },
        confirmation_number: { type: "string" },
        location_name: { type: "string" },
        cost: { type: "number" },
        currency: { type: "string" },
      },
      required: ["type", "title", "date_time"],
    },
  },
  async (args, ctx) => {
    const trip = await assertTrip(ctx);
    const r = await db.reservation.create({
      data: {
        tripId: ctx.tripId,
        type: str(args.type)!,
        title: str(args.title)!,
        dateTime: toDate(args.date_time, new Date())!,
        confirmationNumber: str(args.confirmation_number),
        locationName: str(args.location_name),
        cost: num(args.cost),
        currency: str(args.currency) ?? trip.homeCurrency,
      },
    });
    return { reservationId: r.id, title: r.title };
  }
);

export function toolDefsList(): ToolDef[] {
  return Object.values(TOOL_DEFS);
}

export async function runTool(
  name: string,
  args: Record<string, unknown>,
  ctx: ToolContext
): Promise<{ ok: true; result: unknown } | { ok: false; error: string }> {
  const exec = TOOL_EXECUTORS[name];
  if (!exec) return { ok: false, error: `Unknown tool ${name}` };
  try {
    return { ok: true, result: await exec(args, ctx) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
