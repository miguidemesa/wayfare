import { requireUser } from "@/lib/auth";
import { handle, json } from "@/lib/api-helpers";
import { getRates, SUPPORTED_CURRENCIES } from "@/lib/currency";

export async function GET() {
  return handle(async () => {
    await requireUser();
    const { rates, updatedAt, source } = await getRates();
    return json({
      rates,
      currencies: SUPPORTED_CURRENCIES,
      updatedAt: updatedAt.toISOString(),
      source, // "live" | "cached" | "reference" — surfaced honestly in the UI
    });
  });
}
