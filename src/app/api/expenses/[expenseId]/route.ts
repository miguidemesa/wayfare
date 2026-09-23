import { db } from "@/lib/db";
import { requireUser, HttpError } from "@/lib/auth";
import { handle, json, readJson } from "@/lib/api-helpers";
import { getRates, convert } from "@/lib/currency";

async function assertOwned(expenseId: string, userId: string) {
  const expense = await db.expense.findFirst({
    where: { id: expenseId, trip: { userId } },
  });
  if (!expense) throw new HttpError(404, "Expense not found");
  return expense;
}

export async function PATCH(req: Request, { params }: { params: Promise<{ expenseId: string }> }) {
  return handle(async () => {
    const user = await requireUser();
    const { expenseId } = await params;
    const existing = await assertOwned(expenseId, user.id);
    const body = await readJson<{
      amount?: number;
      currency?: string;
      category?: string;
      merchant?: string;
      date?: string;
      paymentMethod?: string;
      description?: string;
    }>(req);

    const patch: Record<string, unknown> = {};
    if (body.merchant != null) patch.merchant = body.merchant.trim();
    if (body.category != null) patch.category = body.category;
    if (body.paymentMethod != null) patch.paymentMethod = body.paymentMethod;
    if (body.description !== undefined) patch.description = body.description;
    if (body.date) patch.date = new Date(body.date);

    if (body.amount != null || body.currency != null) {
      const amount = Number(body.amount ?? existing.amount);
      const currency = body.currency ?? existing.currency;
      const { rates } = await getRates();
      const trip = await db.trip.findUnique({ where: { id: existing.tripId } });
      patch.amount = amount;
      patch.currency = currency;
      patch.amountHome =
        trip != null
          ? Math.round(convert(amount, currency, trip.homeCurrency, rates) * 100) / 100
          : existing.amountHome;
    }

    const expense = await db.expense.update({ where: { id: expenseId }, data: patch });
    return json({ expense });
  });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ expenseId: string }> }) {
  return handle(async () => {
    const user = await requireUser();
    const { expenseId } = await params;
    await assertOwned(expenseId, user.id);
    await db.expense.delete({ where: { id: expenseId } });
    return json({ ok: true });
  });
}
