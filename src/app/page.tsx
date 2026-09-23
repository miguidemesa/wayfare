import Link from "next/link";
import { getAuthUser } from "@/lib/auth";
import { listTrips } from "@/lib/trip-service";
import { statusForDates } from "@/lib/types";
import { resolveDestinationTheme, destinationGradient } from "@/lib/destination-themes";
import { NewTripButton } from "./new-trip-button";
import { ThemeToggleClient } from "@/components/theme-toggle-client";
import { UserNav } from "@/components/user-nav";
import {
  CalendarRange,
  Compass,
  CreditCard,
  Sparkles,
  ShieldCheck,
  ArrowRight,
  BookOpen,
} from "lucide-react";
import { fmtMoney } from "@/lib/utils";
import { Badge, Button, Card } from "@/components/ui";
import { GlobeOrb } from "@/components/three/globe-loader";

export const dynamic = "force-dynamic";

type TripCardData = Awaited<ReturnType<typeof listTrips>>[number] & { liveStatus: string };

export default async function Home() {
  const user = await getAuthUser();
  if (!user) {
    return <LandingPage />;
  }

  const rawTrips = await listTrips(user.id);
  const trips: TripCardData[] = rawTrips.map((t) => ({
    ...t,
    liveStatus: t.status === "PLANNING" ? "PLANNING" : statusForDates(t.startDate, t.endDate),
  }));

  const active = trips.filter((t) => t.liveStatus === "ACTIVE");
  const upcoming = trips.filter((t) => t.liveStatus === "UPCOMING" || t.liveStatus === "PLANNING");
  const past = trips.filter((t) => t.liveStatus === "COMPLETED");

  const globeMarkers = trips.flatMap((t) =>
    t.destinations.map((d) => ({
      lat: d.lat,
      lng: d.lng,
      label: d.name,
      active: t.liveStatus === "ACTIVE",
    }))
  );

  return (
    <div className="mx-auto max-w-6xl px-5 pb-24 pt-8 sm:px-8">
      <header className="relative mb-10 flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-line pb-8 animate-fade-up">
        <div className="relative z-10 max-w-xl">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-ink-3">
            <span className="grid h-6 w-6 place-items-center rounded-lg bg-gradient-to-br from-accent to-accent-strong text-white shadow-2xs">
              <Compass size={13} strokeWidth={2.4} />
            </span>
            Wayfare · Travel Planner
          </p>
          <h1 className="mt-3 font-display text-4xl leading-none tracking-tight sm:text-5xl">
            Your journeys
          </h1>
          <p className="mt-2 text-xs text-ink-3">
            {trips.length} {trips.length === 1 ? "trip" : "trips"} · {active.length > 0 ? `${active.length} happening now` : "Ready to explore"}
          </p>
          <div className="mt-4 flex items-center gap-2.5 lg:hidden">
            <ThemeToggleClient />
            <NewTripButton />
            <UserNav user={{ name: user.name, email: user.email }} />
          </div>
        </div>

        {/* living globe — your world of destinations */}
        <GlobeOrb
          markers={globeMarkers}
          className="pointer-events-none absolute -right-2 -top-6 hidden h-56 w-56 lg:block xl:h-64 xl:w-64"
        />

        <div className="relative z-10 hidden items-center gap-2.5 lg:flex">
          <ThemeToggleClient />
          <NewTripButton />
          <UserNav user={{ name: user.name, email: user.email }} />
        </div>
      </header>

      {trips.length === 0 ? (
        <div className="card flex flex-col items-center py-20 text-center animate-fade-up border-dashed">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-surface-2 text-accent text-xl">
            <Compass size={24} />
          </span>
          <h2 className="mt-4 font-display text-2xl font-normal">No journeys recorded yet</h2>
          <p className="mt-1 max-w-sm text-xs text-ink-3 leading-relaxed">
            Create your first trip and let the AI planner lay out a geographically smart
            itinerary in seconds.
          </p>
          <div className="mt-6">
            <NewTripButton large />
          </div>
        </div>
      ) : (
        <div className="space-y-12">
          {(
            [
              ["Active Now", active],
              ["Upcoming & Planning", upcoming],
              ["Past Expeditions", past],
            ] as [string, TripCardData[]][]
          )
            .filter(([, list]) => list.length > 0)
            .map(([label, list]) => (
              <section key={label} className="animate-fade-up space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-[11px] font-bold uppercase tracking-widest text-ink-3">
                    {label}
                  </h2>
                  <span className="text-[11px] font-mono text-ink-3">
                    ({list.length})
                  </span>
                </div>
                <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                  {list.map((trip) => (
                    <TripCard key={trip.id} trip={trip} currentUserId={user.id} />
                  ))}
                </div>
              </section>
            ))}
        </div>
      )}
    </div>
  );
}

function TripCard({ trip, currentUserId }: { trip: TripCardData; currentUserId?: string }) {
  const days =
    Math.round((trip.endDate.getTime() - trip.startDate.getTime()) / 86400000) + 1;
  const dateFmt = `${trip.startDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${trip.endDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
  const budgetPct =
    trip.budgetAmount > 0
      ? Math.min(100, Math.round((trip.spent / trip.budgetAmount) * 100))
      : 0;
  const isOverBudget = trip.budgetAmount > 0 && trip.spent > trip.budgetAmount;

  // Destination identity drives the card's atmosphere
  const theme = resolveDestinationTheme(trip.destinations, trip.coverTheme);
  const now = new Date();
  const daysUntil = Math.ceil((trip.startDate.getTime() - now.getTime()) / 86400000);
  const plannedPct = Math.min(
    100,
    Math.round((trip._count.items / Math.max(days * 3, 1)) * 100)
  );

  return (
    <Link href={`/t/${trip.id}`} className="group block focus-visible:outline-none">
      <article
        className="relative isolate h-full min-h-[280px] overflow-hidden rounded-2xl text-white ring-1 ring-inset ring-white/10 transition-all duration-300 group-hover:-translate-y-1.5 group-hover:shadow-pop group-focus-visible:ring-2 group-focus-visible:ring-accent/50"
        style={{ background: destinationGradient(theme) }}
      >
        {/* atmosphere: grain + motif glow that lifts on hover */}
        <svg className="absolute inset-0 h-full w-full opacity-[0.13] mix-blend-overlay pointer-events-none" aria-hidden>
          <filter id={`grain-${trip.id}`}>
            <feTurbulence type="fractalNoise" baseFrequency="0.75" numOctaves="2" />
            <feColorMatrix type="saturate" values="0" />
          </filter>
          <rect width="100%" height="100%" filter={`url(#grain-${trip.id})`} />
        </svg>
        <div
          className="absolute -bottom-20 left-1/2 h-44 w-[130%] -translate-x-1/2 rounded-[100%] blur-3xl opacity-50 transition-all duration-500 group-hover:opacity-80 pointer-events-none"
          style={{ background: theme.glowA }}
          aria-hidden
        />

        {/* status chips */}
        <div className="absolute left-4 top-4 z-10 flex items-center gap-1.5">
          <Badge
            tone={trip.liveStatus === "ACTIVE" ? "success" : trip.liveStatus === "COMPLETED" ? "neutral" : "accent"}
            className="border-white/20 bg-black/30 !text-white backdrop-blur-md"
          >
            {trip.liveStatus === "ACTIVE"
              ? "● Live"
              : trip.liveStatus.charAt(0) + trip.liveStatus.slice(1).toLowerCase()}
          </Badge>
          {currentUserId && trip.userId !== currentUserId && (
            <Badge tone="info" className="border-white/20 bg-black/30 !text-white backdrop-blur-md">
              Shared
            </Badge>
          )}
        </div>
        {/* editorial destination masthead */}
        <div className="relative z-10 flex h-full min-h-[280px] flex-col justify-end p-5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/55">
            {theme.country || theme.motifs.slice(0, 2).join(" · ")}
          </p>
          <h3 className="mt-1 font-display text-[2rem] uppercase leading-[0.95] tracking-tight drop-shadow-sm">
            {trip.title}
          </h3>
          <p className="mt-2 flex flex-wrap items-center gap-x-2 text-xs text-white/70">
            <span className="flex items-center gap-1">
              <CalendarRange size={11} className="text-white/50" />
              {dateFmt}
            </span>
            <span className="text-white/35">·</span>
            <span>{days} days</span>
            <span className="text-white/35">·</span>
            <span className="truncate">
              {trip.destinations.map((d) => d.name).join(" · ") || trip.subtitle || "Flexible route"}
            </span>
          </p>

          {/* countdown / live marker */}
          <p className="tabular mt-3 text-xs font-semibold uppercase tracking-widest" style={{ color: theme.glowA }}>
            {trip.liveStatus === "ACTIVE"
              ? "● Happening now"
              : trip.liveStatus === "COMPLETED"
                ? "✓ Journey complete"
                : `Departs in ${daysUntil} day${daysUntil === 1 ? "" : "s"}`}
          </p>

          {/* planning + budget meters */}
          <div className="mt-4 space-y-2.5 border-t border-white/10 pt-3.5">
            <div>
              <div className="flex items-baseline justify-between text-[10px] font-semibold uppercase tracking-widest text-white/50">
                <span>Planned</span>
                <span className="tabular">{plannedPct}%</span>
              </div>
              <div className="mt-1 h-1 overflow-hidden rounded-full bg-white/15">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${plannedPct}%`, background: `linear-gradient(90deg, ${theme.accent}, ${theme.glowA})` }}
                />
              </div>
            </div>
            {trip.budgetAmount > 0 && (
              <div>
                <div className="flex items-baseline justify-between text-[10px] font-semibold uppercase tracking-widest text-white/50">
                  <span>Budget</span>
                  <span className="tabular normal-case tracking-normal text-white/70">
                    {fmtMoney(trip.spent, trip.homeCurrency)} / {fmtMoney(trip.budgetAmount, trip.homeCurrency)}
                    {isOverBudget && (
                      <span className="ml-1.5 text-[9px] font-semibold text-danger">
                        +{Math.round(((trip.spent - trip.budgetAmount) / trip.budgetAmount) * 100)}% over
                      </span>
                    )}
                  </span>
                </div>
                <div className="mt-1 h-1 overflow-hidden rounded-full bg-white/15">
                  <div
                    className={`h-full rounded-full transition-all ${budgetPct >= 100 ? "bg-danger" : ""}`}
                    style={
                      budgetPct >= 100
                        ? undefined
                        : { width: `${budgetPct}%`, background: `linear-gradient(90deg, ${theme.accent2}, ${theme.glowA})` }
                    }
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </article>
    </Link>
  );
}

function LandingPage() {
  return (
    <div className="min-h-dvh flex flex-col bg-bg text-ink selection:bg-accent/20">
      {/* ------------------------------------------------------------ topbar */}
      <header className="sticky top-0 z-40 border-b border-line bg-surface/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-8">
          <Link href="/" className="flex items-center gap-2.5 group">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-accent to-accent-strong text-white shadow-2xs transition-transform group-hover:scale-105">
              <Compass size={18} strokeWidth={2.3} />
            </span>
            <span className="font-display text-xl font-normal tracking-tight">Wayfare</span>
          </Link>
          <div className="flex items-center gap-3">
            <ThemeToggleClient />
            <Link
              href="/login"
              className="text-xs font-semibold uppercase tracking-wider text-ink-3 hover:text-ink transition-colors px-3 py-1.5"
            >
              Sign In
            </Link>
            <Link href="/login">
              <Button variant="brand" size="sm">
                Get Started
                <ArrowRight size={13} />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* -------------------------------------------------------------- hero */}
      <main className="flex-1">
        <section className="relative overflow-hidden pt-16 pb-20 sm:pt-24 sm:pb-28">
          <div className="mx-auto max-w-4xl px-5 text-center sm:px-8 animate-fade-up">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-accent/25 bg-accent/10 px-3 py-1 text-[11px] font-semibold tracking-wide uppercase text-accent shadow-2xs">
              <Sparkles size={12} className="text-accent" />
              The AI Travel Planner
            </span>

            <h1 className="mt-6 font-display text-4xl sm:text-6xl sm:leading-[1.08] tracking-tight font-normal">
              Your journey, curated with
              <br />
              <span className="italic text-gradient-accent">quiet precision.</span>
            </h1>

            <p className="mx-auto mt-6 max-w-2xl text-sm sm:text-base text-ink-2 leading-relaxed font-normal">
              Geographic itinerary planning, real-time multi-currency budgets, offline document vaulting,
              and a typed AI concierge that acts directly on your trip data.
            </p>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link href="/login">
                <Button variant="brand" size="lg" className="shadow-xs">
                  Try Demo Account
                  <ArrowRight size={15} />
                </Button>
              </Link>
              <Link href="/login">
                <Button variant="secondary" size="lg">
                  Create Account
                </Button>
              </Link>
            </div>

            <div className="mt-6 inline-flex items-center gap-2 rounded-xl border border-line bg-surface px-4 py-2 text-xs text-ink-2 shadow-2xs">
              <span className="font-semibold text-ink">Demo credentials prefilled:</span>
              <code className="font-mono text-accent text-[11px]">demo@wayfare.app · wanderlust</code>
            </div>
          </div>

          {/* ------------------------------------------------- bento grid preview */}
          <div className="mx-auto mt-16 max-w-5xl px-5 sm:px-8">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Card className="p-6 space-y-3.5 hover:border-accent/40 transition-colors">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-accent/10 text-accent border border-accent/20 shadow-2xs">
                  <Compass size={19} />
                </div>
                <h3 className="font-semibold text-base tracking-tight">Geographic Route Planning</h3>
                <p className="text-xs text-ink-2 leading-relaxed">
                  Smart neighborhood clustering, walking transit estimates, and 2-opt route optimization so you spend time exploring rather than backtracking.
                </p>
              </Card>

              <Card className="p-6 space-y-3.5 hover:border-accent/40 transition-colors">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-amber/10 text-amber border border-amber/20 shadow-2xs">
                  <CreditCard size={19} />
                </div>
                <h3 className="font-semibold text-base tracking-tight">Live FX Multi-Currency</h3>
                <p className="text-xs text-ink-2 leading-relaxed">
                  Track expenses across JPY, PHP, USD, and EUR in real time. Automatic split shares for companion travelers with offline outbox durability.
                </p>
              </Card>

              <Card className="p-6 space-y-3.5 hover:border-accent/40 transition-colors">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-accent/10 text-accent border border-accent/20 shadow-2xs">
                  <Sparkles size={19} />
                </div>
                <h3 className="font-semibold text-base tracking-tight">Tool-Using AI Concierge</h3>
                <p className="text-xs text-ink-2 leading-relaxed">
                  An AI assistant equipped with 18 typed tools that modifies real database items: “move dinner to 8 PM”, “find an izakaya in Shinjuku”, or “optimize Day 2”.
                </p>
              </Card>

              <Card className="p-6 space-y-3.5 hover:border-accent/40 transition-colors">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-sky/10 text-sky border border-sky/20 shadow-2xs">
                  <ShieldCheck size={19} />
                </div>
                <h3 className="font-semibold text-base tracking-tight">Offline Document Vault</h3>
                <p className="text-xs text-ink-2 leading-relaxed">
                  Store flight confirmations, boarding passes, and passport notes securely. Fully available offline in-flight with automatic background sync.
                </p>
              </Card>

              <Card className="p-6 space-y-3.5 hover:border-accent/40 transition-colors">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-violet/10 text-violet border border-violet/20 shadow-2xs">
                  <BookOpen size={19} />
                </div>
                <h3 className="font-semibold text-base tracking-tight">Journal & Trip Wrapped</h3>
                <p className="text-xs text-ink-2 leading-relaxed">
                  Capture daily memories and photos, then review your trip with interactive charts, kilometers traveled, and top neighborhoods explored.
                </p>
              </Card>

              <Card className="p-6 space-y-3.5 bg-gradient-to-br from-accent/10 via-surface to-surface border-accent/30 flex flex-col justify-between shadow-2xs">
                <div>
                  <div className="grid h-10 w-10 place-items-center rounded-xl bg-accent text-white shadow-2xs">
                    <Compass size={19} />
                  </div>
                  <h3 className="mt-3.5 font-semibold text-base tracking-tight">Ready to explore?</h3>
                  <p className="mt-1 text-xs text-ink-2 leading-relaxed">
                    Test the pre-seeded Tokyo, Kyoto, and Seoul demo trips instantly.
                  </p>
                </div>
                <Link href="/login" className="mt-4">
                  <Button variant="brand" size="sm" className="w-full">
                    Launch Demo
                    <ArrowRight size={13} />
                  </Button>
                </Link>
              </Card>
            </div>
          </div>
        </section>
      </main>

      {/* ------------------------------------------------------------ footer */}
      <footer className="border-t border-line py-8 text-center text-xs text-ink-3 bg-surface-2/30">
        <div className="mx-auto max-w-6xl px-5 sm:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="flex items-center gap-1.5 font-medium text-ink-2">
            <Compass size={14} className="text-accent" />
            Wayfare
          </p>
          <p className="text-ink-3">
            Offline-first · Zero tracking scripts · Secure cookie sessions
          </p>
          <Link href="/login" className="text-accent hover:underline font-medium">
            Sign in →
          </Link>
        </div>
      </footer>
    </div>
  );
}
