import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Haversine distance in km. */
export function haversineKm(
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number
): number {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) *
      Math.cos((bLat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/**
 * Rough transit time estimate between two points in a dense Asian city.
 * Walking at ~4.5km/h; train effective speed ~20km/h incl. stops + fixed overhead.
 */
export function estimateTransit(
  km: number,
  mode: "WALK" | "TRAIN" | "TAXI" = km < 0.9 ? "WALK" : "TRAIN"
): { mode: "WALK" | "TRAIN" | "TAXI"; minutes: number } {
  if (mode === "WALK") return { mode, minutes: Math.max(2, Math.round((km / 4.5) * 60)) };
  if (mode === "TAXI")
    return { mode, minutes: Math.max(6, Math.round(8 + (km / 18) * 60)) };
  return {
    mode,
    minutes: Math.max(10, Math.round(12 + (km / 20) * 60)),
  };
}

export const CURRENCY_SYMBOLS: Record<string, string> = {
  PHP: "₱",
  USD: "$",
  JPY: "¥",
  EUR: "€",
  GBP: "£",
  KRW: "₩",
  SGD: "S$",
  AUD: "A$",
  CAD: "C$",
  THB: "฿",
  TWD: "NT$",
  HKD: "HK$",
  CNY: "¥",
  INR: "₹",
  CHF: "CHF ",
  NZD: "NZ$",
  VND: "₫",
  IDR: "Rp",
  MYR: "RM",
};

export function fmtMoney(amount: number, currency: string, opts?: { compact?: boolean }): string {
  const symbol = CURRENCY_SYMBOLS[currency] ?? currency + " ";
  const abs = Math.abs(amount);
  let body: string;
  if (opts?.compact && abs >= 1000) {
    if (abs >= 1_000_000) body = (amount / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
    else body = (amount / 1000).toFixed(abs >= 10000 ? 0 : 1).replace(/\.0$/, "") + "k";
  } else {
    body = amount.toLocaleString("en-US", { maximumFractionDigits: abs % 1 === 0 ? 0 : 2 });
  }
  return `${symbol}${body}`;
}

/** Convert between currencies via USD-cross rates (client mirror of lib/currency). */
export function convertCurrency(
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

export function fmtMinutes(min: number): string {
  if (min < 60) return `${Math.round(min)} min`;
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return m ? `${h}h ${m}m` : `${h}h`;
}

export function fmtMinutesFromMidnight(t: number | null | undefined): string {
  if (t == null) return "";
  const h = Math.floor(t / 60);
  const m = t % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function fmtTime12(minutes: number | null | undefined): string {
  if (minutes == null) return "--:--";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}

export function parseTimeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + (m || 0);
}

export function dateKey(d: Date | string): string {
  const dd = typeof d === "string" ? new Date(d) : d;
  return dd.toISOString().slice(0, 10);
}

export function addDays(d: Date, days: number): Date {
  const nd = new Date(d);
  nd.setDate(nd.getDate() + days);
  return nd;
}

export function eachDay(start: Date, end: Date): Date[] {
  const out: Date[] = [];
  let cur = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const last = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  while (cur <= last) {
    out.push(new Date(cur));
    cur = addDays(cur, 1);
  }
  return out;
}

/** Deterministic pseudo-random in [0,1) from a string seed. */
export function seededRand(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  h ^= h >>> 15;
  return ((h >>> 0) % 100000) / 100000;
}
