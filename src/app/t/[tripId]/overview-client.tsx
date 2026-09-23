"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  BedDouble,
  BookOpen,
  CloudRain,
  Compass,
  CreditCard,
  Film,
  MapPin,
  MoonStar,
  PackageCheck,
  Plane,
  Receipt,
  ShoppingBag,
  Sparkles,
  Sun,
  Ticket,
  Train,
  Sunrise,
  UtensilsCrossed,
} from "lucide-react";
import type { TripBundle } from "@/lib/trip-service";
import { Badge, AnimatedNumber, Card, CardHeader } from "@/components/ui";
import { resolveDestinationTheme } from "@/lib/destination-themes";
import { DestinationHero } from "@/components/destination-hero";
import { EXPENSE_CATEGORY_META, type ExpenseCategory } from "@/lib/types";
import { cn, fmtMinutes, fmtMoney } from "@/lib/utils";
import { api } from "@/lib/client-api";
import { TripSettingsModal } from "@/components/trip-settings-modal";

const TZ_BY_CITY: Record<string, string> = {
  Tokyo: "Asia/Tokyo",
  Kyoto: "Asia/Tokyo",
  Seoul: "Asia/Seoul",
  Rome: "Europe/Rome",
  Florence: "Europe/Rome",
  Venice: "Europe/Rome",
};

const WEATHER_ICON: Record<string, React.ReactNode> = {
  clear: <Sun size={16} className="text-amber" />,
  partly: <Sunrise size={16} className="text-amber" />,
  cloudy: <MoonStar size={16} className="text-ink-3" />,
  rain: <CloudRain size={16} className="text-sky" />,
};

export function OverviewClient({
  bundle,
  aiLive,
}: {
  bundle: TripBundle;
  aiLive: boolean;
}) {
  const { trip, destinations, days, expenses, weather, reservations, checklist, journal, travelers } = bundle;

  const now = new Date();
  const totalSpent = expenses.reduce((s, e) => s + e.amountHome, 0);
  const remaining = trip.budgetAmount - totalSpent;
  const isOverBudget = totalSpent > trip.budgetAmount;
  const budgetPct = trip.budgetAmount > 0 ? (totalSpent / trip.budgetAmount) * 100 : 0;
  // Clamp to 100 for the SVG ring fill, but show actual % in the label
  const ringPct = Math.min(100, budgetPct);

  const dayCount = days.length || Math.round((trip.endDate.getTime() - trip.startDate.getTime()) / 86400000) + 1;
  const plannedDays = days.filter((d) => d.items.length > 0).length;
  const tripProgress = Math.min(100, Math.round((plannedDays / Math.max(dayCount, 1)) * 100));

  // Which "day" are we on?
  const todayIso = now.toISOString().slice(0, 10);
  const isBefore = trip.startDate > now;
  const isAfter = trip.endDate < now;
  const activeDay =
    days.find((d) => d.date.toISOString().slice(0, 10) === todayIso) ??
    (isAfter ? days[days.length - 1] : days[0]);
  const cityForTz = activeDay?.city ?? destinations[0]?.name ?? "";
  const timeZone = TZ_BY_CITY[cityForTz] ?? "UTC";

  // Next up: first upcoming item today, else first item tomorrow-ish
  const nextUp = useMemo(() => {
    const allItems = days.flatMap((d) =>
      d.items
        .filter((i) => i.startTime != null)
        .map((i) => ({ ...i, date: d.date.toISOString().slice(0, 10), cityName: d.city }))
    );
    if (!isBefore && !isAfter) {
      return (
        allItems.find(
          (i) => i.date === todayIso && i.startTime! >= now.getHours() * 60 + now.getMinutes() - 30
        ) ?? null
      );
    }
    return allItems[0] ?? null;
  }, [days, isBefore, isAfter, todayIso]);

  const byCategory = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of expenses) m.set(e.category, (m.get(e.category) ?? 0) + e.amountHome);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [expenses]);

  const upcomingReservations = reservations.filter((r) => r.dateTime >= now).slice(0, 3);
  const packingDone = checklist.filter((c) => c.section === "PACKING" && c.checked).length;
  const packingTotal = checklist.filter((c) => c.section === "PACKING").length;

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [ticker, setTicker] = useState<{ rates: Record<string, number>; source: string } | null>(null);
  const [tickerAge, setTickerAge] = useState<string>("");
  useEffect(() => {
    api<{ rates: Record<string, number>; updatedAt: string; source: string }>("/api/currency")
      .then((d) => {
        setTicker(d);
        const mins = Math.max(1, Math.round((Date.now() - new Date(d.updatedAt).getTime()) / 60000));
        setTickerAge(mins < 60 ? `${mins} min ago` : `${Math.round(mins / 60)}h ago`);
      })
      .catch(() => {});
  }, []);

  const localCurrency = destinations[0]?.name === "Kyoto" || destinations[0]?.name === "Tokyo" ? "JPY" : trip.homeCurrency;

  // Smart suggestions derived from real state
  const suggestions = useMemo(() => {
    const out: { icon: React.ReactNode; text: string; href: string; cta: string }[] = [];
    const rainy = weather.filter((w) => w.rainProb >= 55);
    if (rainy.length) {
      out.push({
        icon: <CloudRain size={16} className="text-sky shrink-0" />,
        text: `Rain predicted on ${rainy[0].date.toLocaleDateString("en-US", { month: "short", day: "numeric" })} — optimize itinerary for indoor experiences.`,
        href: `/t/${trip.id}/ai`,
        cta: "Optimize for weather",
      });
    }
    if (budgetPct >= 70 && !isBefore) {
      out.push({
        icon: <CreditCard size={16} className="text-amber shrink-0" />,
        text: `You've utilized ${Math.round(budgetPct)}% of the target budget — review spending breakdown.`,
        href: `/t/${trip.id}/expenses`,
        cta: "Open expenses",
      });
    }
    if (plannedDays < dayCount) {
      out.push({
        icon: <Compass size={16} className="text-accent shrink-0" />,
        text: `${dayCount - plannedDays} day${dayCount - plannedDays !== 1 ? "s" : ""} still flexible. Curate stops with the AI planner.`,
        href: `/t/${trip.id}/itinerary`,
        cta: "Plan stops",
      });
    }
    if (packingTotal > 0 && packingDone < packingTotal) {
      out.push({
        icon: <PackageCheck size={16} className="text-accent shrink-0" />,
        text: `Packing folio is ${packingDone}/${packingTotal} complete${isBefore && daysUntil(trip.startDate) <= 7 ? " — departure is approaching." : "."}`,
        href: `/t/${trip.id}/packing`,
        cta: "View checklist",
      });
    }
    return out.slice(0, 2);
  }, [weather, budgetPct, plannedDays, dayCount, packingTotal, packingDone, isBefore, trip.id, trip.startDate]);

  const dateFmt = `${trip.startDate.toLocaleDateString("en-US", { month: "long", day: "numeric" })} – ${trip.endDate.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`;

  const dstTheme = useMemo(
    () => resolveDestinationTheme(destinations, trip.coverTheme),
    [destinations, trip.coverTheme]
  );

  return (
    <div className="mx-auto max-w-6xl px-4 pb-24 pt-5 sm:px-6">
      {/* ------------------------------------------------------------ hero */}
      <DestinationHero
        theme={dstTheme}
        title={trip.title}
        country={dstTheme.country}
        city={dstTheme.city}
        dateFmt={dateFmt}
        daysUntil={daysUntil(trip.startDate)}
        isBefore={isBefore}
        isAfter={isAfter}
        statusLabel={
          trip.status === "PLANNING"
            ? "Planning"
            : isBefore
              ? `In ${daysUntil(trip.startDate)} days`
              : isAfter
                ? "Completed"
                : "Happening now"
        }
        dayCount={dayCount}
        travelers={trip.travelersCount}
        tripProgress={tripProgress}
        timeZone={timeZone}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      {/* --------------------------------------------------------- bento grid */}
      <div id="trip-overview" className="mt-5 grid scroll-mt-6 gap-4 pt-5 lg:grid-cols-3">
        {/* TODAY */}
        <Card className="animate-fade-up lg:col-span-1">
          <CardHeader
            title={
              isBefore
                ? `Day 1 · ${activeDay?.title ?? "Kickoff"}`
                : isAfter
                  ? "Final day recap"
                  : `Today · ${activeDay?.title ?? ""}`
            }
            subtitle={activeDay ? `${activeDay.date.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })} · ${activeDay.city}` : undefined}
            action={
              <Link href={`/t/${trip.id}/itinerary`} className="text-accent hover:text-accent-strong" aria-label="Open itinerary">
                <ArrowUpRight size={16} />
              </Link>
            }
          />
          <div className="px-5 pb-4 pt-2">
            {(activeDay?.items.length ?? 0) === 0 ? (
              <p className="py-4 text-center text-[13px] text-ink-3">
                Nothing scheduled yet — ask the AI to plan this day.
              </p>
            ) : (
              <ol className="space-y-2.5">
                {activeDay!.items.slice(0, 4).map((item) => (
                  <li key={item.id} className="flex items-center gap-3 text-[13px]">
                    <span className="tabular w-11 shrink-0 text-right text-ink-3">
                      {fmtClock(item.startTime)}
                    </span>
                    <ItemTypeDot type={item.type} />
                    <span className="min-w-0 truncate font-medium">{item.title}</span>
                  </li>
                ))}
                {activeDay!.items.length > 4 && (
                  <li className="pl-14 text-xs text-accent">+{activeDay!.items.length - 4} more</li>
                )}
              </ol>
            )}
          </div>
        </Card>

        {/* NEXT UP */}
        <Card className="animate-fade-up bg-gradient-to-br from-accent/8 via-surface to-surface lg:col-span-1">
          <CardHeader title="Next up" subtitle={nextUp ? nextUp.cityName : undefined} icon={<Sparkles size={15} />} />
          <div className="px-5 pb-5 pt-1">
            {nextUp ? (
              <>
                <p className="text-lg font-semibold leading-snug flex items-center gap-1.5">{iconForType(nextUp.type)} {nextUp.title}</p>
                <p className="mt-1 flex items-center gap-2 text-[13px] text-ink-2">
                  <span className="tabular">{fmtClock(nextUp.startTime)}</span>
                  {nextUp.placeName && (
                    <>
                      <span className="text-line-strong">·</span>
                      <MapPin size={12} className="shrink-0" />
                      <span className="truncate">{nextUp.neighborhood ?? nextUp.placeName}</span>
                    </>
                  )}
                </p>
                {nextUp.cost ? (
                  <Badge tone="neutral" className="mt-2.5">
                    ~{fmtMoney(nextUp.cost, nextUp.currency ?? "JPY")} pp
                  </Badge>
                ) : null}
              </>
            ) : (
              <div className="flex flex-col items-start gap-2 py-1">
                <p className="text-[13px] text-ink-2">
                  {isBefore
                    ? `Your adventure starts in ${daysUntil(trip.startDate)} days. Time to pack!`
                    : "No upcoming items scheduled."}
                </p>
              </div>
            )}
          </div>
        </Card>

        {/* WEATHER */}
        <Card className="animate-fade-up">
          <CardHeader
            title="Forecast"
            subtitle={weather.some((w) => w.source === "seasonal-estimate") ? "Seasonal estimate — live forecast unlocks closer to travel" : "Live"}
            action={
              <Link href={`/t/${trip.id}/discover`} className="text-accent hover:text-accent-strong" aria-label="Weather-aware discovery">
                <ArrowUpRight size={16} />
              </Link>
            }
          />
          <div className="grid grid-cols-5 gap-1 px-4 pb-4 pt-1.5">
            {weather.slice(0, 5).map((w) => (
              <div key={w.id} className="rounded-xl py-2 text-center transition-colors hover:bg-surface-2">
                <p className="text-[10px] font-medium text-ink-3">
                  {w.date.toLocaleDateString("en-US", { weekday: "short" })}
                </p>
                <div className="mt-1 flex justify-center">{WEATHER_ICON[w.condition] ?? WEATHER_ICON.cloudy}</div>
                <p className="tabular mt-1 text-xs font-semibold">{w.tempMaxC}°</p>
                <p className="tabular text-[10px] text-ink-3">{w.tempMinC}°</p>
                <p className={cn("mt-0.5 text-[9px]", w.rainProb >= 55 ? "font-semibold text-sky" : "text-ink-3")}>
                  {w.rainProb}%
                </p>
              </div>
            ))}
          </div>
        </Card>

        {/* BUDGET */}
        <Card className="animate-fade-up lg:col-span-2">
          <CardHeader
            title="Budget pulse"
            subtitle={`Home currency ${trip.homeCurrency}`}
            action={
              <Link href={`/t/${trip.id}/expenses`} className="inline-flex items-center gap-1 rounded-lg border border-line px-2.5 py-1 text-xs font-medium transition-colors hover:bg-surface-2">
                Details <ArrowUpRight size={12} />
              </Link>
            }
          />
          <div className="grid gap-5 px-5 pb-5 pt-2 sm:grid-cols-[auto_1fr]">
            {/* ring */}
            <div className="relative mx-auto h-32 w-32 shrink-0">
              <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
                <circle cx="60" cy="60" r="52" fill="none" strokeWidth="10" className="stroke-surface-2" />
                <circle
                  cx="60" cy="60" r="52" fill="none" strokeWidth="10" strokeLinecap="round"
                  strokeDasharray={`${2 * Math.PI * 52}`}
                  strokeDashoffset={`${2 * Math.PI * 52 * (1 - ringPct / 100)}`}
                  className={cn("transition-all duration-1000", isOverBudget ? "stroke-danger" : "stroke-accent")}
                />
              </svg>
              <div className="absolute inset-0 grid place-items-center text-center">
                <div>
                  <p className={cn("tabular text-xl font-bold leading-none", isOverBudget && "text-danger")}>
                    <AnimatedNumber value={budgetPct} format={(v) => `${Math.round(v)}%`} />
                  </p>
                  <p className="mt-1 text-[10px] text-ink-3">of budget</p>
                  {isOverBudget && (
                    <p className="mt-0.5 text-[9px] font-semibold text-danger">
                      +{Math.round(budgetPct - 100)}% over
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="min-w-0">
              <div className="grid grid-cols-2 gap-3">
                <Stat label="Spent" value={<AnimatedNumber value={totalSpent} format={(v) => fmtMoney(v, trip.homeCurrency)} />} tone="default" />
                <Stat label="Remaining" value={<AnimatedNumber value={Math.abs(remaining)} format={(v) => `${remaining < 0 ? "-" : ""}${fmtMoney(v, trip.homeCurrency)}`} />} tone={isOverBudget ? "danger" : "success"} />
              </div>
              <div className="mt-4 space-y-1.5">
                {byCategory.slice(0, 4).map(([cat, amt]) => {
                  const meta = EXPENSE_CATEGORY_META[cat as ExpenseCategory];
                  const pct = totalSpent > 0 ? (amt / totalSpent) * 100 : 0;
                  return (
                    <div key={cat} className="flex items-center gap-2 text-xs">
                      <span>{categoryIcon(cat)}</span>
                      <span className="w-20 shrink-0 text-ink-2">{meta?.label ?? cat}</span>
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
                        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: meta?.color }} />
                      </div>
                      <span className="tabular w-16 text-right text-ink-2">{fmtMoney(amt, trip.homeCurrency)}</span>
                    </div>
                  );
                })}
                {byCategory.length === 0 && (
                  <p className="text-xs text-ink-3">No expenses yet — add your first one in Expenses.</p>
                )}
              </div>
            </div>
          </div>
        </Card>

        {/* CURRENCY TICKER */}
        <Card className="animate-fade-up">
          <CardHeader
            title="Currency"
            subtitle={ticker ? `${localCurrency} → ${trip.homeCurrency}` : undefined}
            icon={<CreditCard size={15} />}
          />
          <div className="px-5 pb-5 pt-1">
            {ticker ? (
              <>
                <div className="flex items-baseline justify-between">
                  <span className="text-sm text-ink-2">
                    {ticker.source === "live" ? "Live rate" : "Cached rate"} · updated {tickerAge}
                  </span>
                </div>
                <p className="mt-2 tabular text-2xl font-bold tracking-tight text-gradient">
                  {ticker.rates[localCurrency] && ticker.rates[trip.homeCurrency]
                    ? (ticker.rates[trip.homeCurrency] / ticker.rates[localCurrency]).toLocaleString("en-US", { maximumFractionDigits: 2 })
                    : "—"}
                  <span className="ml-1.5 text-sm font-semibold text-ink">{trip.homeCurrency}</span>
                </p>
                <p className="mt-1 text-[11px] text-ink-3">per 1 {localCurrency}</p>
                <div className="mt-3 space-y-1.5 text-[13px]">
                  <QuickConvert ticker={ticker} from="JPY" amount={10000} home={trip.homeCurrency} />
                  <QuickConvert ticker={ticker} from="USD" amount={100} home={trip.homeCurrency} />
                </div>
              </>
            ) : (
              <div className="space-y-2 pt-1">
                <div className="skeleton h-4 w-24 rounded" />
                <div className="skeleton h-8 w-32 rounded" />
              </div>
            )}
          </div>
        </Card>

        {/* AI SUGGESTIONS */}
        {suggestions.length > 0 && (
          <Card className="animate-fade-up border-accent/30 bg-gradient-to-br from-accent/8 via-transparent to-sky/5 lg:col-span-2">
            <CardHeader
              title="Smart suggestions"
              subtitle={aiLive ? "Travel AI connected" : "Built-in intelligence — connect an LLM key for full chat"}
              icon={<Sparkles size={15} />}
            />
            <div className="space-y-2 px-5 pb-5 pt-1">
              {suggestions.map((s, i) => (
                <Link
                  key={i}
                  href={s.href}
                  className="group flex items-center gap-3 rounded-xl border border-line bg-surface/80 px-3.5 py-2.5 transition-all hover:border-accent/40 hover:shadow-2xs"
                >
                  <div className="grid h-8 w-8 place-items-center rounded-lg bg-surface-2 shrink-0 shadow-2xs border border-line">
                    {s.icon}
                  </div>
                  <span className="flex-1 text-[13px] leading-snug text-ink">{s.text}</span>
                  <span className="inline-flex items-center gap-1 whitespace-nowrap text-xs font-semibold text-accent">
                    {s.cta}
                    <ArrowRight size={12} className="transition-transform group-hover:translate-x-0.5" />
                  </span>
                </Link>
              ))}
            </div>
          </Card>
        )}

        {/* RESERVATIONS */}
        <Card className={cn("animate-fade-up", suggestions.length === 0 && "lg:col-span-2")}>
          <CardHeader
            title="Upcoming reservations"
            subtitle={`${reservations.filter((r) => r.dateTime >= now).length} upcoming`}
            icon={<Ticket size={15} />}
            action={
              <Link href={`/t/${trip.id}/reservations`} className="text-accent hover:text-accent-strong" aria-label="All reservations">
                <ArrowUpRight size={16} />
              </Link>
            }
          />
          <div className="divide-y divide-line px-5 pb-3 pt-0.5">
            {upcomingReservations.map((r) => (
              <div key={r.id} className="flex items-center gap-3 py-2.5 text-[13px]">
                <ResIcon type={r.type} />
                <span className="min-w-0 flex-1 truncate font-medium">{r.title}</span>
                <span className="tabular shrink-0 text-ink-3">
                  {r.dateTime.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  {" · "}
                  {r.dateTime.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false })}
                </span>
              </div>
            ))}
            {upcomingReservations.length === 0 && (
              <p className="pb-3 pt-1 text-[13px] text-ink-3">Nothing booked ahead.</p>
            )}
          </div>
        </Card>

        {/* QUICK STATS ROW */}
        <Card className="animate-fade-up grid grid-cols-2 gap-px overflow-hidden bg-line lg:col-span-3 lg:grid-cols-4">
          <MiniStat icon={<MapPin size={18} className="text-coral" />} value={String(days.reduce((s, d) => s + d.items.filter((i) => ["ACTIVITY", "RESTAURANT"].includes(i.type)).length, 0))} label="places on itinerary" />
          <MiniStat icon={<Train size={18} className="text-sky" />} value={fmtMinutes(days.reduce((s, d) => s + d.items.reduce((ss, i) => ss + (i.transportMin ?? 0), 0), 0))} label="estimated transit" />
          <MiniStat icon={<PackageCheck size={18} className="text-accent" />} value={`${packingDone}/${packingTotal}`} label="packing done" href={`/t/${trip.id}/packing`} />
          <MiniStat icon={<BookOpen size={18} className="text-violet" />} value={String(journal.length)} label="journal entries" href={`/t/${trip.id}/journal`} />
        </Card>
      </div>

      <TripSettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        trip={trip}
        travelers={travelers}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ bits */

function Stat({ label, value, tone }: { label: string; value: React.ReactNode; tone?: "default" | "success" | "danger" }) {
  return (
    <div className="rounded-xl border border-line bg-surface-2/50 px-3.5 py-3">
      <p className="text-[10px] font-semibold text-ink-3">{label}</p>
      <p className={cn("tabular mt-1 text-lg font-bold tracking-tight", tone === "success" && "text-success", tone === "danger" && "text-danger")}>
        {value}
      </p>
    </div>
  );
}

function MiniStat({ icon, value, label, href }: { icon: React.ReactNode; value: string; label: string; href?: string }) {
  const content = (
    <div className="flex items-center gap-3 bg-surface px-4 py-3.5">
      <span className="shrink-0">{icon}</span>
      <div className="min-w-0">
        <p className="tabular truncate text-sm font-bold">{value}</p>
        <p className="text-[11px] text-ink-3">{label}</p>
      </div>
    </div>
  );
  return href ? (
    <Link href={href} className="transition-colors hover:bg-surface-2/60">
      {content}
    </Link>
  ) : (
    content
  );
}

export function ItemTypeDot({ type }: { type: string }) {
  const styles: Record<string, string> = {
    FLIGHT: "bg-success",
    HOTEL: "bg-violet",
    RESTAURANT: "bg-amber",
    ACTIVITY: "bg-coral",
    TRANSPORT: "bg-sky",
    RESERVATION: "bg-violet",
    PERSONAL: "bg-ink-3",
  };
  return <span className={cn("h-2 w-2 shrink-0 rounded-full", styles[type] ?? "bg-ink-3")} aria-hidden />;
}

function categoryIcon(category: string): React.ReactNode {
  switch (category) {
    case "FOOD": return <UtensilsCrossed size={13} className="text-amber shrink-0" />;
    case "TRANSPORT": return <Train size={13} className="text-sky shrink-0" />;
    case "HOTEL": return <BedDouble size={13} className="text-violet shrink-0" />;
    case "FLIGHT": return <Plane size={13} className="text-success shrink-0" />;
    case "ACTIVITY": return <Ticket size={13} className="text-coral shrink-0" />;
    case "SHOPPING": return <ShoppingBag size={13} className="text-fuchsia-400 shrink-0" />;
    case "ENTERTAINMENT": return <Film size={13} className="text-amber shrink-0" />;
    default: return <Receipt size={13} className="text-ink-3 shrink-0" />;
  }
}

function iconForType(type: string): React.ReactNode {
  switch (type) {
    case "FLIGHT": return <Plane size={14} className="text-success" />;
    case "HOTEL": return <BedDouble size={14} className="text-violet" />;
    case "RESTAURANT": return <UtensilsCrossed size={14} className="text-amber" />;
    case "TRANSPORT": return <Train size={14} className="text-sky" />;
    default: return <MapPin size={14} className="text-coral" />;
  }
}

function ResIcon({ type }: { type: string }) {
  const icons: Record<string, React.ReactNode> = {
    FLIGHT: <Plane size={14} className="text-success" />,
    HOTEL: <BedDouble size={14} className="text-violet" />,
    RESTAURANT: <UtensilsCrossed size={14} className="text-amber" />,
    TRAIN: <Train size={14} className="text-sky" />,
    TOUR: <Compass size={14} className="text-accent" />,
    EVENT: <Ticket size={14} className="text-coral" />,
    ACTIVITY: <MapPin size={14} className="text-coral" />,
  };
  return <span className="grid h-6 w-6 place-items-center rounded-lg bg-surface-2">{icons[type] ?? <MapPin size={14} className="text-ink-3" />}</span>;
}

function fmtClock(minutes: number | null): string {
  if (minutes == null) return "--:--";
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

function daysUntil(d: Date): number {
  return Math.max(0, Math.ceil((d.getTime() - Date.now()) / 86400000));
}

function QuickConvert({
  ticker,
  from,
  amount,
  home,
}: {
  ticker: { rates: Record<string, number> };
  from: string;
  amount: number;
  home: string;
}) {
  const rate = ticker.rates[from] && ticker.rates[home] ? ticker.rates[home] / ticker.rates[from] : null;
  return (
    <div className="flex items-center justify-between text-ink-2">
      <span>
        {from === "JPY" ? "¥" : "$"}
        {amount.toLocaleString()}
      </span>
      <span className="tabular font-semibold text-ink">
        ≈ {rate ? fmtMoney(Math.round(amount * rate), home) : "—"}
      </span>
    </div>
  );
}
