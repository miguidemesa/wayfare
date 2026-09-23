"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Loader2,
  MapPin,
  Sparkles,
  X,
} from "lucide-react";
import { Button, Card, Field, Input, Select, Badge, Spinner } from "@/components/ui";
import { CoverArt, COVER_THEME_KEYS } from "@/components/covers";
import { CITY_META } from "@/lib/data/pois";
import { INTEREST_OPTIONS } from "@/lib/types";
import { cn, fmtMoney } from "@/lib/utils";
import { api, ApiError } from "@/lib/client-api";

const STEPS = ["Where", "When", "Budget", "Travelers", "Interests", "Pace"] as const;

export default function NewTripPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [destQuery, setDestQuery] = useState("");
  const [destinations, setDestinations] = useState<{ name: string; country: string; lat: number; lng: number }[]>([]);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [budget, setBudget] = useState("100000");
  const [currency, setCurrency] = useState("PHP");
  const [travelers, setTravelers] = useState(2);
  const [interests, setInterests] = useState<string[]>(["Food"]);
  const [pace, setPace] = useState<"relaxed" | "balanced" | "packed">("balanced");
  const [coverTheme, setCoverTheme] = useState(COVER_THEME_KEYS[0]);
  const [phase, setPhase] = useState<"form" | "generating">("form");
  const [genStatus, setGenStatus] = useState("");
  const [error, setError] = useState<string | null>(null);

  const citySuggestions = useMemo(() => {
    const q = destQuery.toLowerCase().trim();
    if (!q) return Object.keys(CITY_META).slice(0, 6);
    return Object.keys(CITY_META).filter((c) => c.toLowerCase().includes(q)).slice(0, 8);
  }, [destQuery]);

  const daysCount =
    startDate && endDate && new Date(endDate) >= new Date(startDate)
      ? Math.round((new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000) + 1
      : 0;

  function addDestination(name: string) {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (destinations.some((d) => d.name.toLowerCase() === trimmed.toLowerCase())) return;
    const meta = CITY_META[trimmed];
    setDestinations((prev) => [
      ...prev,
      {
        name: trimmed,
        country: meta?.country ?? "",
        lat: meta?.lat ?? 0,
        lng: meta?.lng ?? 0,
      },
    ]);
    setDestQuery("");
    setCoverTheme(
      COVER_THEME_KEYS[
        (trimmed.length + destinations.length * 2) % COVER_THEME_KEYS.length
      ] ?? "teal"
    );
  }

  const canNext =
    (step === 0 && destinations.length > 0) ||
    (step === 1 && startDate && endDate && daysCount > 0) ||
    (step === 2 && Number(budget) >= 0) ||
    (step === 3 && travelers > 0) ||
    (step === 4 && interests.length > 0) ||
    step === 5;

  async function createTrip() {
    setError(null);
    setPhase("generating");
    try {
      setGenStatus("Creating your trip…");
      const { trip } = await api<{ trip: { id: string } }>("/api/trips", {
        json: {
          title: destinations.map((d) => d.name).join(" & "),
          subtitle: destinations.map((d) => d.name).join(" · "),
          destinations,
          startDate,
          endDate,
          budgetAmount: Number(budget),
          homeCurrency: currency,
          pace,
          interests,
          travelersCount: travelers,
          coverEmoji: destinations[0]?.country?.includes("Japan")
            ? "🇯🇵"
            : destinations[0]?.country?.includes("Korea")
              ? "🇰🇷"
              : destinations[0]?.country?.includes("Italy")
                ? "🇮🇹"
                : "🌍",
          coverTheme,
        },
      });

      setGenStatus("AI is sketching a geographic itinerary…");
      let generated = false;
      try {
        // Preview the plan, then persist it — a preview-only call discards the
        // result and the trip would be created with zero days.
        const { plan } = await api<{ plan: unknown[] }>(`/api/trips/${trip.id}/generate`, { json: {} });
        if (plan?.length) {
          await api(`/api/trips/${trip.id}/generate`, { json: { apply: true, plan } });
          generated = true;
        }
      } catch {
        // itinerary generation optional — trip still created
      }
      void generated;

      setGenStatus("Building budget dashboard…");
      router.push(`/t/${trip.id}`);
      router.refresh();
    } catch (e) {
      setPhase("form");
      setError(e instanceof ApiError ? e.message : "Failed to create trip");
    }
  }

  if (phase === "generating") {
    return (
      <div className="grid min-h-dvh place-items-center bg-bg px-6">
        <div className="text-center animate-fade-up">
          <div className="relative mx-auto h-24 w-24">
            <CoverArt theme={coverTheme} emoji="✈️" size="md" className="h-24 w-24 rounded-3xl shadow-pop" />
            <span className="absolute -right-2 -top-2 grid h-8 w-8 place-items-center rounded-full bg-surface shadow-md ring-1 ring-line">
              <Loader2 size={15} className="animate-spin text-accent" />
            </span>
          </div>
          <h2 className="mt-6 font-display text-2xl tracking-tight">
            {destinations.map((d) => d.name).join(" & ")}, here we come
          </h2>
          <p className="mt-2 flex items-center justify-center gap-2 text-sm text-ink-3">
            <Spinner /> {genStatus}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-5 pb-32 pt-8 sm:pt-14">
      {/* header */}
      <div className="mb-8 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 text-sm text-ink-3 transition-colors hover:text-ink">
          <ArrowLeft size={15} /> All trips
        </Link>
        <Badge tone="accent">
          Step {step + 1} of {STEPS.length}
        </Badge>
      </div>

      {/* progress */}
      <div className="mb-10 flex gap-1.5">
        {STEPS.map((s, i) => (
          <button
            key={s}
            onClick={() => i <= step && setStep(i)}
            aria-label={`Step ${i + 1}: ${s}`}
            className={cn(
              "h-1.5 flex-1 rounded-full transition-all",
              i < step ? "bg-accent cursor-pointer" : i === step ? "bg-gradient-to-r from-accent to-sky" : "bg-surface-3"
            )}
          />
        ))}
      </div>

      <div key={step} className="animate-fade-up">
        {/* ---------------------------------------------------------- STEP 0 */}
        {step === 0 && (
          <>
            <h1 className="font-display text-3xl tracking-tight">Where are you going?</h1>
            <p className="mt-1.5 text-sm text-ink-3">Add one or more cities — we know their coordinates.</p>

            {destinations.length > 0 && (
              <div className="mt-5 flex flex-wrap gap-2">
                {destinations.map((d, idx) => (
                  <span key={d.name} className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface py-1 pl-3 pr-1.5 text-[13px] font-medium">
                    <MapPin size={12} className="text-accent" />
                    {idx > 0 && <ArrowRight size={11} className="text-ink-3" />}
                    {d.name}
                    <button
                      onClick={() => setDestinations((p) => p.filter((x) => x.name !== d.name))}
                      className="rounded-full p-0.5 text-ink-3 hover:bg-surface-2 hover:text-ink"
                      aria-label={`Remove ${d.name}`}
                    >
                      <X size={13} />
                    </button>
                  </span>
                ))}
              </div>
            )}

            <Card className="mt-5 p-4">
              <Field label="City">
                <Input
                  value={destQuery}
                  onChange={(e) => setDestQuery(e.target.value)}
                  placeholder="e.g. Paris, Tokyo, London, Barcelona…"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      if (citySuggestions[0] && destQuery.toLowerCase() === citySuggestions[0].toLowerCase()) {
                        addDestination(citySuggestions[0]);
                      } else if (destQuery.trim()) {
                        addDestination(destQuery.trim());
                      }
                    }
                  }}
                />
              </Field>
              <div className="mt-3 flex flex-wrap gap-2">
                {destQuery.trim() && !citySuggestions.some((c) => c.toLowerCase() === destQuery.toLowerCase().trim()) && (
                  <button
                    onClick={() => addDestination(destQuery.trim())}
                    className="rounded-lg border border-accent/50 bg-accent-soft/40 px-3 py-1.5 text-[13px] font-semibold text-accent-strong transition-colors hover:bg-accent-soft/60 cursor-pointer"
                  >
                    + Add &ldquo;{destQuery.trim()}&rdquo;
                  </button>
                )}
                {citySuggestions.map((c) => (
                  <button
                    key={c}
                    onClick={() => addDestination(c)}
                    disabled={destinations.some((d) => d.name.toLowerCase() === c.toLowerCase())}
                    className="rounded-lg border border-line bg-surface-2 px-3 py-1.5 text-[13px] font-medium transition-colors hover:border-accent/40 hover:bg-accent-soft/30 disabled:opacity-40 cursor-pointer"
                  >
                    {c}
                    <span className="ml-1.5 text-[11px] font-normal text-ink-3">{CITY_META[c]?.country}</span>
                  </button>
                ))}
              </div>
              {destinations.length >= 2 && (
                <p className="mt-3 text-xs text-ink-3">
                  Multi-city trips get split day-by-day between cities automatically.
                </p>
              )}
            </Card>
          </>
        )}

        {/* ---------------------------------------------------------- STEP 1 */}
        {step === 1 && (
          <>
            <h1 className="font-display text-3xl tracking-tight">When?</h1>
            <p className="mt-1.5 text-sm text-ink-3">
              {daysCount > 0 && `${daysCount} day${daysCount !== 1 ? "s" : ""} of adventure`}
            </p>
            <Card className="mt-5 grid gap-4 p-4 sm:grid-cols-2">
              <Field label="Start date">
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </Field>
              <Field label="End date">
                <Input
                  type="date"
                  value={endDate}
                  min={startDate || undefined}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </Field>
            </Card>
          </>
        )}

        {/* ---------------------------------------------------------- STEP 2 */}
        {step === 2 && (
          <>
            <h1 className="font-display text-3xl tracking-tight">What&apos;s your budget?</h1>
            <p className="mt-1.5 text-sm text-ink-3">We track spending against this in real time.</p>
            <Card className="mt-5 space-y-4 p-4">
              <div className="grid gap-4 sm:grid-cols-[1fr_140px]">
                <Field label="Total budget">
                  <Input
                    type="number"
                    min={0}
                    value={budget}
                    onChange={(e) => setBudget(e.target.value)}
                  />
                </Field>
                <Field label="Home currency">
                  <Select value={currency} onChange={(e) => setCurrency(e.target.value)}>
                    {["PHP", "USD", "JPY", "EUR", "GBP", "KRW", "SGD", "AUD", "CAD", "THB"].map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </Select>
                </Field>
              </div>
              {daysCount > 0 && Number(budget) > 0 && (
                <div className="rounded-xl border border-accent/25 bg-accent-soft/25 px-4 py-3 text-sm">
                  ≈{" "}
                  <strong className="tabular">
                    {fmtMoney(Math.round(Number(budget) / daysCount), currency)}
                  </strong>{" "}
                  per day · all foreign-currency expenses convert into {currency} automatically.
                </div>
              )}
            </Card>
          </>
        )}

        {/* ---------------------------------------------------------- STEP 3 */}
        {step === 3 && (
          <>
            <h1 className="font-display text-3xl tracking-tight">Who&apos;s coming?</h1>
            <p className="mt-1.5 text-sm text-ink-3">Shared expenses get split evenly by default.</p>
            <Card className="mt-5 p-5">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{travelers} traveler{travelers !== 1 ? "s" : ""}</span>
                <div className="flex items-center gap-2">
                  <Button variant="secondary" size="icon" onClick={() => setTravelers(Math.max(1, travelers - 1))} aria-label="Fewer travelers">–</Button>
                  <Button variant="secondary" size="icon" onClick={() => setTravelers(Math.min(12, travelers + 1))} aria-label="More travelers">+</Button>
                </div>
              </div>
              <div className="mt-4 flex gap-1.5">
                {Array.from({ length: Math.min(travelers, 12) }).map((_, i) => (
                  <span key={i} className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-accent/70 to-sky/70 text-[11px] font-bold text-white">
                    T{i + 1}
                  </span>
                ))}
              </div>
            </Card>
          </>
        )}

        {/* ---------------------------------------------------------- STEP 4 */}
        {step === 4 && (
          <>
            <h1 className="font-display text-3xl tracking-tight">What do you love?</h1>
            <p className="mt-1.5 text-sm text-ink-3">The planner weights these when choosing places.</p>
            <div className="mt-5 flex flex-wrap gap-2">
              {INTEREST_OPTIONS.map((interest) => {
                const on = interests.includes(interest);
                return (
                  <button
                    key={interest}
                    onClick={() =>
                      setInterests((prev) =>
                        on ? prev.filter((i) => i !== interest) : [...prev, interest]
                      )
                    }
                    aria-pressed={on}
                    className={cn(
                      "rounded-xl border px-3.5 py-2 text-[13.5px] font-medium transition-all active:scale-[0.97]",
                      on
                        ? "border-accent/50 bg-accent-soft/50 text-accent-strong shadow-sm"
                        : "border-line bg-surface text-ink-2 hover:border-line-strong"
                    )}
                  >
                    {on && <Check size={12} className="mr-1 inline" />}
                    {interest}
                  </button>
                );
              })}
            </div>
          </>
        )}

        {/* ---------------------------------------------------------- STEP 5 */}
        {step === 5 && (
          <>
            <h1 className="font-display text-3xl tracking-tight">Pick your pace</h1>
            <p className="mt-1.5 text-sm text-ink-3">
              This controls how many stops each day gets. You can always change it later.
            </p>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              {(
                [
                  { id: "relaxed", emoji: "🐢", title: "Relaxed", desc: "2 anchors/day. Long lunches, slow mornings." },
                  { id: "balanced", emoji: "🚶", title: "Balanced", desc: "3 anchors/day. See the highlights without rushing." },
                  { id: "packed", emoji: "🏃", title: "Packed", desc: "4+ anchors/day. Maximize every hour." },
                ] as const
              ).map((p) => (
                <button
                  key={p.id}
                  onClick={() => setPace(p.id)}
                  aria-pressed={pace === p.id}
                  className={cn(
                    "card p-4 text-left transition-all active:scale-[0.98]",
                    pace === p.id ? "!border-accent/60 ring-2 ring-ring/30" : "hover:border-line-strong"
                  )}
                >
                  <span className="text-2xl">{p.emoji}</span>
                  <p className="mt-2 text-sm font-semibold">{p.title}</p>
                  <p className="mt-1 text-xs leading-relaxed text-ink-3">{p.desc}</p>
                </button>
              ))}
            </div>

            <Card className="mt-6 p-5">
              <div className="flex items-start gap-3">
                <Sparkles size={18} className="mt-0.5 shrink-0 text-accent" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold">Ready for liftoff</p>
                  <p className="mt-1 text-[13px] leading-relaxed text-ink-2">
                    {destinations.map((d) => d.name).join(" → ")} · {daysCount} days ·{" "}
                    {fmtMoney(Number(budget), currency)} · {travelers} traveler{travelers !== 1 ? "s" : ""} ·{" "}
                    {interests.slice(0, 3).join(", ")}
                    {interests.length > 3 ? ` +${interests.length - 3}` : ""}. The AI groups each day by
                    neighborhood so you spend time exploring, not commuting.
                  </p>
                </div>
              </div>
            </Card>
          </>
        )}
      </div>

      {error && (
        <p role="alert" className="mt-4 rounded-lg border border-danger/25 bg-danger/10 px-3 py-2 text-[13px] text-danger">
          {error}
        </p>
      )}

      {/* footer nav */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line glass px-5 py-3">
        <div className="mx-auto flex max-w-2xl items-center justify-between">
          <Button variant="ghost" onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0}>
            <ArrowLeft size={15} /> Back
          </Button>
          {step < STEPS.length - 1 ? (
            <Button onClick={() => setStep(step + 1)} disabled={!canNext} size="lg">
              Continue <ArrowRight size={15} />
            </Button>
          ) : (
            <Button onClick={createTrip} size="lg" className="bg-gradient-to-r from-accent to-sky text-white">
              <Sparkles size={15} /> Generate my trip
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
