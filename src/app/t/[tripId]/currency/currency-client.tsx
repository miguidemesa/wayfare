"use client";

import { useMemo, useState } from "react";
import { ArrowLeftRight, RefreshCcw } from "lucide-react";
import { Card, CardHeader, Input, Select } from "@/components/ui";
import { CURRENCY_NAMES, currencyLabel } from "@/lib/currency-meta";
import { cn, convertCurrency, CURRENCY_SYMBOLS } from "@/lib/utils";

const QUICK_AMOUNTS = [1000, 5000, 10000, 50000];

export function CurrencyClient({
  homeCurrency,
  rates,
  updatedAt,
  source,
}: {
  tripId: string;
  homeCurrency: string;
  rates: Record<string, number>;
  updatedAt: string;
  source: "live" | "cached" | "reference";
}) {
  const [amountStr, setAmountStr] = useState("10000");
  const [from, setFrom] = useState(homeCurrency === "JPY" ? "PHP" : "JPY");
  const [to, setTo] = useState(homeCurrency);

  const amount = Number(amountStr.replace(/,/g, "")) || 0;
  const converted = convertCurrency(amount, from, to, rates);
  const rate = convertCurrency(1, from, to, rates);
  const inverseRate = convertCurrency(1, to, from, rates);

  const ageMins = Math.max(1, Math.round((Date.now() - new Date(updatedAt).getTime()) / 60000));

  const popular = useMemo(
    () => ["JPY", "PHP", "USD", "EUR", "KRW", "GBP", "SGD", "AUD"].filter((c) => c !== from),
    [from]
  );

  return (
    <div className="mx-auto max-w-3xl px-4 pb-24 pt-5 sm:px-6">
      <div className="mb-5 animate-fade-up">
        <h1 className="font-display text-3xl tracking-tight">Currency converter</h1>
        <p className="mt-0.5 flex items-center gap-2 text-[13px] text-ink-3">
          {source === "live" ? "Live mid-market rates" : source === "cached" ? "Cached rates (offline-safe)" : "Reference rates"}
          · updated{" "}
          {ageMins < 60
            ? `${ageMins} min ago`
            : `${new Date(updatedAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "numeric" })}`}
          <span
            className={cn(
              "inline-block h-1.5 w-1.5 rounded-full",
              source === "live" ? "bg-success" : "bg-warning"
            )}
            title={source === "live" ? "Live data" : "Cached — will refresh when online"}
          />
        </p>
      </div>

      {/* ------------------------------------------------------- converter */}
      <Card className="animate-fade-up overflow-visible p-5 sm:p-6">
        <div className="grid gap-2 sm:gap-3">
          <div className="rounded-2xl border border-line bg-surface-2/50 p-4 transition-colors focus-within:border-accent/50">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[11px] font-semibold text-ink-3">From</span>
              <Select value={from} onChange={(e) => setFrom(e.target.value)} className="!w-auto !border-none !bg-transparent !pr-6 font-semibold">
                {Object.keys(rates).map((c) => (
                  <option key={c} value={c}>{currencyLabel(c)}</option>
                ))}
              </Select>
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-xl font-bold text-ink-3">{CURRENCY_SYMBOLS[from] ?? from}</span>
              <input
                inputMode="decimal"
                value={amountStr}
                onChange={(e) => setAmountStr(e.target.value.replace(/[^\d.,]/g, ""))}
                className="tabular w-full bg-transparent text-3xl font-bold tracking-tight outline-none placeholder:text-ink-3"
                placeholder="0"
                aria-label={`Amount in ${from}`}
              />
            </div>
          </div>

          {/* swap */}
          <button
            onClick={() => {
              setFrom(to);
              setTo(from);
            }}
            aria-label="Swap currencies"
            className="group relative z-10 mx-auto -my-3 grid h-9 w-9 place-items-center rounded-full border border-line bg-surface shadow-sm transition-all hover:border-accent/50 hover:bg-accent-soft/30 active:scale-95"
          >
            <ArrowLeftRight size={15} className="text-accent transition-transform group-hover:rotate-180" />
          </button>

          <div className="rounded-2xl border border-accent/40 bg-accent-soft/20 p-4">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[11px] font-semibold text-accent">To</span>
              <Select value={to} onChange={(e) => setTo(e.target.value)} className="!w-auto !border-none !bg-transparent !pr-6 font-semibold">
                {Object.keys(rates).map((c) => (
                  <option key={c} value={c}>{currencyLabel(c)}</option>
                ))}
              </Select>
            </div>
            <p className="tabular mt-1 truncate text-3xl font-bold tracking-tight text-gradient" title={`${converted.toLocaleString()} ${to}`}>
              {converted.toLocaleString("en-US", { maximumFractionDigits: converted < 100 ? 2 : 0 })}
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-[13px]">
          <p className="text-ink-2">
            <span className="tabular font-semibold">1 {from}</span> ={" "}
            <span className="tabular font-semibold text-ink">{rate.toLocaleString("en-US", { maximumFractionDigits: 4 })}</span> {to}
            {" · "}
            <span className="tabular">1 {to}</span> ={" "}
            <span className="tabular">{inverseRate.toLocaleString("en-US", { maximumFractionDigits: 4 })}</span> {from}
          </p>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {QUICK_AMOUNTS.map((a) => (
            <button
              key={a}
              onClick={() => setAmountStr(String(a))}
              className={cn(
                "rounded-lg border px-3 py-1.5 text-[12.5px] font-medium tabular transition-colors",
                amount === a
                  ? "border-accent/50 bg-accent-soft/40 text-accent-strong"
                  : "border-line bg-surface text-ink-2 hover:border-line-strong"
              )}
            >
              {a.toLocaleString()}
            </button>
          ))}
        </div>
      </Card>

      {/* ------------------------------------------------------ rate table */}
      <Card className="animate-fade-up mt-4 overflow-hidden">
        <CardHeader
          title="All rates"
          subtitle={`Base ${from} · tap to flip`}
          action={
            <a
              href="/api/currency"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 rounded-lg border border-line px-2 py-1 text-xs text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink"
            >
              <RefreshCcw size={11} /> JSON
            </a>
          }
        />
        <div className="divide-y divide-line pb-2">
          {[...popular, ...Object.keys(rates).filter((c) => !popular.includes(c))]
            .slice(0, 16)
            .map((code) => (
              <button
                key={code}
                onClick={() => setTo(code)}
                className="flex w-full items-center gap-3 px-5 py-2.5 text-left transition-colors hover:bg-surface-2/60"
              >
                <span className="w-10 shrink-0 text-sm font-bold">{code}</span>
                <span className="min-w-0 flex-1 truncate text-xs text-ink-3">{CURRENCY_NAMES[code] ?? code}</span>
                <span className="tabular text-sm font-semibold">
                  {convertCurrency(1, from, code, rates).toLocaleString("en-US", { maximumFractionDigits: code === "JPY" || code === "KRW" || code === "VND" || code === "IDR" ? 2 : 4 })}
                </span>
                <span className="w-8 text-right text-[11px] text-ink-3">/{from}</span>
              </button>
            ))}
        </div>
      </Card>

      <p className="mt-4 text-center text-[11px] leading-relaxed text-ink-3">
        Rates refresh every 30 minutes while online and are cached for offline travel mode.
        Card issuers typically add 1–3% on top of the mid-market rate.
      </p>
    </div>
  );
}
