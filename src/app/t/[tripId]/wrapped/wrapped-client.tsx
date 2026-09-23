"use client";

import { useMemo } from "react";
import {
  Area,
  AreaChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  CalendarRange,
  Circle,
  MapPin,
  UtensilsCrossed,
  Wallet,
  Star,
  CircleDollarSign,
  Route,
  Camera,
  Heart,
} from "lucide-react";
import type { TripBundle } from "@/lib/trip-service";
import { Card, AnimatedNumber, Badge } from "@/components/ui";
import { CoverArt } from "@/components/covers";
import { EXPENSE_CATEGORY_META, type ExpenseCategory } from "@/lib/types";
import { fmtMoney, fmtMinutes } from "@/lib/utils";

export function WrappedClient({ bundle, analytics }: { bundle: TripBundle; analytics: Awaited<ReturnType<typeof import("@/lib/trip-service").computeAnalytics>> }) {
  const { trip, days, hotels } = bundle;
  const { days: dayCount, cities, placesVisited, totalSpent, homeCurrency, byCategory, byDay, mostExpensiveDay, cheapestDay, priciestMeal, topNeighborhood, kmTraveled, favoriteCategory, flightsTaken } = analytics;

  const categoryData = useMemo(() =>
    Object.entries(byCategory)
      .sort((a, b) => b[1] - a[1])
      .map(([cat, value]) => ({
        name: EXPENSE_CATEGORY_META[cat as ExpenseCategory]?.label ?? cat,
        value: Math.round(value),
        color: EXPENSE_CATEGORY_META[cat as ExpenseCategory]?.color ?? "#94A3B8",
        emoji: EXPENSE_CATEGORY_META[cat as ExpenseCategory]?.emoji ?? "🧾",
      }))
  , [byCategory]);

  const daySeries = useMemo(() => {
    let cum = 0;
    return [...Object.entries(byDay)].sort((a, b) => a[0].localeCompare(b[0])).map(([date, amt]) => {
      cum += amt;
      return { date: date.slice(5), amount: Math.round(amt), cumulative: Math.round(cum) };
    });
  }, [byDay]);

  return (
    <div className="mx-auto max-w-4xl px-4 pb-24 pt-5 sm:px-6">
      {/* Hero */}
      <CoverArt theme={trip.coverTheme} emoji={trip.coverEmoji} size="lg" className="animate-fade-up rounded-2xl">
        <div className="relative z-10 p-6 sm:p-8 text-white">
          <Badge tone="accent" className="mb-3 border-white/25 bg-white/15 !text-white backdrop-blur">
            Trip Wrapped · {trip.startDate.getFullYear()}
          </Badge>
          <h1 className="font-display text-[44px] leading-none tracking-tight mb-2">{trip.title}</h1>
          <p className="text-white/75 text-lg">
            {trip.startDate.toLocaleDateString("en-US", { month: "long", day: "numeric" })} –{" "}
            {trip.endDate.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
            · {dayCount} days · {cities} cit{cities !== 1 ? "ies" : "y"}
          </p>
        </div>
      </CoverArt>

      {/* Stat row */}
      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 animate-fade-up">
        <StatCard label="Days traveled" value={dayCount} icon={<CalendarRange size={18} />} />
        <StatCard label="Places visited" value={placesVisited} icon={<MapPin size={18} />} />
        <StatCard label="Total spent" value={totalSpent} currency={homeCurrency} icon={<Wallet size={18} />} />
        <StatCard label="Distance" value={Math.round(kmTraveled)} suffix=" km" icon={<Route size={18} />} />
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2 animate-fade-up">
        {/* Spending over time */}
        <Card className="lg:col-span-2">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-ink-3">Spending over time</h3>
          <div className="h-64">
            {daySeries.length > 1 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={daySeries} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                  <defs>
                    <linearGradient id="wrappedFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: "var(--ink-3)" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "var(--ink-3)" }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 12 }} formatter={(v) => fmtMoney(Number(v ?? 0), homeCurrency)} />
                  <Area type="monotone" dataKey="cumulative" stroke="var(--accent)" strokeWidth={2.5} fill="url(#wrappedFill)" animationDuration={1200} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <p className="h-full flex items-center justify-center text-sm text-ink-3">Not enough data</p>
            )}
          </div>
        </Card>

        {/* Category pie + stats */}
        <Card>
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-ink-3">By category</h3>
          <div className="grid grid-cols-[auto_1fr] items-center gap-3">
            <ResponsiveContainer width={150} height={150}>
              <PieChart>
                <Pie data={categoryData} dataKey="value" innerRadius={44} outerRadius={70} paddingAngle={3} strokeWidth={0} animationDuration={1000}>
                  {categoryData.map((c) => <Cell key={c.name} fill={c.color} />)}
                </Pie>
                <Tooltip contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 12 }} formatter={(v) => fmtMoney(Number(v ?? 0), homeCurrency)} />
              </PieChart>
            </ResponsiveContainer>
            <ul className="space-y-1.5 text-xs">
              {categoryData.slice(0, 6).map((c) => (
                <li key={c.name} className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full shrink-0" style={{ background: c.color }} />
                  <span className="flex-1 truncate text-ink-2">{c.emoji} {c.name}</span>
                  <span className="tabular font-semibold">{fmtMoney(c.value, homeCurrency)}</span>
                </li>
              ))}
            </ul>
          </div>
        </Card>

        {/* Fun stats */}
        <Card className="lg:col-span-2">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-ink-3">Trip highlights</h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Highlight icon={<UtensilsCrossed size={18} />} label="Priciest meal" value={priciestMeal ? `${priciestMeal.merchant} — ${fmtMoney(priciestMeal.amount, homeCurrency)}` : "—"} />
            <Highlight icon={<CircleDollarSign size={18} />} label="Most expensive day" value={mostExpensiveDay ? `${mostExpensiveDay} — ${fmtMoney(byDay[mostExpensiveDay] ?? 0, homeCurrency)}` : "—"} />
            <Highlight icon={<Heart size={18} />} label="Cheapest day" value={cheapestDay ? `${cheapestDay} — ${fmtMoney(byDay[cheapestDay] ?? 0, homeCurrency)}` : "—"} />
            <Highlight icon={<Star size={18} />} label="Top neighborhood" value={topNeighborhood ?? "—"} />
            <Highlight icon={<Wallet size={18} />} label="Favorite category" value={favoriteCategory ? EXPENSE_CATEGORY_META[favoriteCategory as ExpenseCategory]?.label ?? favoriteCategory : "—"} />
            <Highlight icon={<Camera size={18} />} label="Hotels" value={String(hotels.length)} />
            <Highlight icon={<Circle size={18} />} label="Flights" value={String(flightsTaken)} />
            <Highlight icon={<Route size={18} />} label="Est. transit" value={fmtMinutes(days.reduce((s, d) => s + d.items.reduce((ss, i) => ss + (i.transportMin ?? 0), 0), 0))} />
          </div>
        </Card>
      </div>

      <p className="mt-8 text-center text-sm text-ink-3">
        Generated from your Wayfare trip data · {new Date().toLocaleDateString()}
      </p>
    </div>
  );
}

function StatCard({ label, value, currency, suffix, icon }: { label: string; value: number | string; currency?: string; suffix?: string; icon: React.ReactNode }) {
  return (
    <Card className="p-4 animate-fade-up">
      <div className="flex items-baseline justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-3">{label}</p>
          <p className="tabular mt-1 text-2xl font-bold tracking-tight">
            <AnimatedNumber value={typeof value === "number" ? value : Number(value)} format={(v) => currency ? fmtMoney(v, currency) : String(v)} />
            {suffix}
          </p>
        </div>
        <span className="text-ink-3">{icon}</span>
      </div>
    </Card>
  );
}

function Highlight({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-4 transition-colors hover:border-line-strong">
      <div className="flex items-center gap-2 mb-1">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-accent-soft/50 text-accent-strong">{icon}</span>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-3">{label}</p>
      </div>
      <p className="text-sm font-semibold leading-snug">{value}</p>
    </div>
  );
}