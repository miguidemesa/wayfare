import "server-only";
import { db } from "./db";

/**
 * Currency service.
 * Rates are stored relative to USD. Live rates are attempted from open.er-api.com
 * (no key required) and cached in the CurrencyRate table with a TTL. When the API is
 * unreachable, we fall back to the last cached snapshot, then to bundled reference rates —
 * and we always expose `updatedAt` so the UI can honestly display staleness.
 */

export const FALLBACK_RATES_TO_USD: Record<string, number> = {
  PHP: 58.3,
  USD: 1,
  JPY: 156.4,
  EUR: 0.92,
  GBP: 0.78,
  KRW: 1382,
  SGD: 1.34,
  AUD: 1.52,
  CAD: 1.37,
  THB: 36.1,
  TWD: 32.4,
  HKD: 7.81,
  CNY: 7.24,
  INR: 83.6,
  CHF: 0.88,
  NZD: 1.64,
  VND: 25400,
  IDR: 16250,
  MYR: 4.72,
};

export const SUPPORTED_CURRENCIES = Object.keys(FALLBACK_RATES_TO_USD);

const RATE_TTL_MS = 30 * 60 * 1000; // 30 minutes

let lastLiveAttempt = 0;
const LIVE_RETRY_MS = 10 * 60 * 1000;

export async function getRates(): Promise<{
  rates: Record<string, number>;
  updatedAt: Date;
  source: "live" | "cached" | "reference";
}> {
  const rows = await db.currencyRate.findMany();
  const freshest = rows.reduce<Date | null>(
    (acc, r) => (acc == null || r.updatedAt > acc ? r.updatedAt : acc),
    null
  );

  const stale =
    !freshest || Date.now() - freshest.getTime() > RATE_TTL_MS;

  if (stale && Date.now() - lastLiveAttempt > LIVE_RETRY_MS) {
    lastLiveAttempt = Date.now();
    try {
      const res = await fetch("https://open.er-api.com/v6/latest/USD", {
        next: { revalidate: 1800 },
      });
      if (res.ok) {
        const json = (await res.json()) as {
          result?: string;
          rates?: Record<string, number>;
        };
        if (json.result === "success" && json.rates) {
          const now = new Date();
          const updates = SUPPORTED_CURRENCIES.filter((c) => json.rates![c] != null).map(
            (code) => ({ code, rateToUsd: json.rates![code], updatedAt: now })
          );
          for (const u of updates) {
            await db.currencyRate.upsert({
              where: { code: u.code },
              create: u,
              update: { rateToUsd: u.rateToUsd, updatedAt: now },
            });
          }
          return { rates: toMap(updates), updatedAt: now, source: "live" };
        }
      }
    } catch {
      // network unavailable — fall through
    }
  }

  if (rows.length > 0) {
    return {
      rates: toMap(rows.map((r) => ({ code: r.code, rateToUsd: r.rateToUsd }))),
      updatedAt: freshest!,
      source: freshest && Date.now() - freshest.getTime() <= RATE_TTL_MS ? "live" : "cached",
    };
  }

  // No DB snapshot at all — persist reference rates so timestamps stay honest.
  const now = new Date();
  const ref = Object.entries(FALLBACK_RATES_TO_USD).map(([code, rateToUsd]) => ({
    code,
    rateToUsd,
    updatedAt: now,
  }));
  for (const u of ref) {
    await db.currencyRate.upsert({
      where: { code: u.code },
      create: u,
      update: {},
    });
  }
  return { rates: FALLBACK_RATES_TO_USD, updatedAt: now, source: "reference" };
}

function toMap(list: { code: string; rateToUsd: number }[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const { code, rateToUsd } of list) out[code] = rateToUsd;
  return out;
}

/** Convert between any two supported currencies via USD cross-rate. */
export function convert(
  amount: number,
  from: string,
  to: string,
  rates: Record<string, number>
): number {
  const f = rates[from];
  const t = rates[to];
  if (!f || !t) return amount;
  return (amount / f) * t;
}
