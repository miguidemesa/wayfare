import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { requireTrip } from "@/lib/trip-access";
import { handle, json, readJson } from "@/lib/api-helpers";
import { getRates, convert } from "@/lib/currency";
import { categorizeExpenseText } from "@/lib/planner";

export async function GET(_req: Request, { params }: { params: Promise<{ tripId: string }> }) {
  return handle(async () => {
    const user = await requireUser();
    const { tripId } = await params;
    const expenses = await db.expense.findMany({
      where: { tripId, trip: { userId: user.id } },
      orderBy: { date: "desc" },
    });
    return json({ expenses });
  });
}

type Body = {
  amount?: number;
  currency?: string;
  category?: string;
  merchant?: string;
  date?: string;
  paymentMethod?: string;
  description?: string;
  locationName?: string;
  paidById?: string;
  splitWithAll?: boolean;
  receiptUrl?: string;
  aiCategorized?: boolean;
};

export async function POST(req: Request, { params }: { params: Promise<{ tripId: string }> }) {
  return handle(async () => {
    const user = await requireUser();
    const { tripId } = await params;
    const trip = await requireTrip(tripId, user.id);

    const body = await readJson<Body>(req);
    const amount = Number(body.amount);
    if (!amount || amount <= 0 || !Number.isFinite(amount)) {
      return json({ error: "A positive amount is required" }, 400);
    }
    const merchant = body.merchant?.trim();
    if (!merchant) return json({ error: "Merchant is required" }, 400);

    const currency = body.currency ?? trip.homeCurrency;
    const category =
      body.category && body.category !== "" ? body.category : categorizeExpenseText(merchant);
    const { rates } = await getRates();
    const amountHome = Math.round(convert(amount, currency, trip.homeCurrency, rates) * 100) / 100;

    // Validate paidById against this trip's travelers — a foreign id would
    // otherwise attach someone else's traveler row to this expense.
    let paidById: string | null = null;
    if (body.paidById) {
      const payer = await db.traveler.findFirst({ where: { id: body.paidById, tripId } });
      if (!payer) return json({ error: "Unknown payer for this trip" }, 400);
      paidById = payer.id;
    }

    const { expense, splits } = await db.$transaction(async (tx) => {
      const created = await tx.expense.create({
        data: {
          tripId,
          category,
          amount,
          currency,
          amountHome,
          date: body.date ? new Date(body.date) : new Date(),
          merchant,
          description: body.description?.trim() || null,
          locationName: body.locationName?.trim() || null,
          paymentMethod: body.paymentMethod ?? "CARD",
          paidById,
          splitWith: body.splitWithAll ? "ALL" : null,
          receiptUrl: body.receiptUrl ?? null,
          aiCategorized: !!body.aiCategorized,
        },
      });

      // Equal split among all travelers when requested
      const splits: { travelerId: string; amount: number }[] = [];
      if (body.splitWithAll) {
        const travelers = await tx.traveler.findMany({ where: { tripId } });
        if (travelers.length > 1) {
          const share = Math.round((created.amountHome / travelers.length) * 100) / 100;
          for (const t of travelers) {
            await tx.expenseSplit.create({
              data: { expenseId: created.id, travelerId: t.id, amount: share },
            });
            splits.push({ travelerId: t.id, amount: share });
          }
        }
      }
      return { expense: created, splits };
    });

    return json({ expense, splits }, 201);
  });
}
