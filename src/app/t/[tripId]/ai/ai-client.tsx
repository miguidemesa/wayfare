"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowUpRight,
  Copy,
  Loader2,
  MapPin,
  MessageSquareMore,
  Send,
  Sparkles,
  Trash2,
  UtensilsCrossed,
  X,
} from "lucide-react";
import type { TripBundle } from "@/lib/trip-service";
import { Badge, Button, Card, EmptyState, Input, Modal, Spinner } from "@/components/ui";
import { cn, fmtMoney } from "@/lib/utils";
import { api, ApiError } from "@/lib/client-api";

const SUGGESTIONS = [
  "What should I do tomorrow?",
  "Find cheap ramen near my hotel",
  "How much have I spent on food?",
  "Optimize day 3",
  "Move dinner to 8 PM",
  "What's the weather like?",
  "Add Sushi Dai to day 2",
  "Convert ¥10,000 to PHP",
];

export function AIClient({ tripId, bundle }: { tripId: string; bundle: TripBundle }) {
  const { trip } = bundle;
  const [messages, setMessages] = useState<Array<{ id: string; role: "user" | "assistant"; content: string; data?: unknown; loading?: boolean }>>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Contextual intelligence — derived from real trip state, no extra requests.
  const ctx = useMemo(() => {
    const { days, expenses, weather } = bundle;
    const now = new Date();
    const hour = now.getHours();
    const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

    const todayIso = now.toISOString().slice(0, 10);
    const upcoming = days
      .flatMap((d) =>
        d.items
          .filter((i) => i.startTime != null)
          .map((i) => ({ ...i, date: d.date.toISOString().slice(0, 10), cityName: d.city }))
      )
      .find(
        (i) =>
          i.date > todayIso ||
          (i.date === todayIso && i.startTime! >= now.getHours() * 60 + now.getMinutes() - 30)
      );

    const totalSpent = expenses.reduce((s, e) => s + e.amountHome, 0);
    const rainy = weather.find((w) => w.rainProb >= 55);
    const isBefore = trip.startDate > now;
    const daysUntil = Math.max(0, Math.ceil((trip.startDate.getTime() - now.getTime()) / 86400000));

    const lines: string[] = [];
    if (isBefore) {
      lines.push(`You depart for ${trip.title} in ${daysUntil} day${daysUntil === 1 ? "" : "s"}.`);
    } else if (upcoming) {
      const mins = upcoming.startTime!;
      lines.push(
        `Next up: ${upcoming.title} at ${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")} in ${upcoming.cityName}.`
      );
    } else {
      lines.push("Your itinerary is behind you — ask me to relive or rebuild any day.");
    }
    if (trip.budgetAmount > 0) {
      lines.push(
        `You've spent ${fmtMoney(Math.round(totalSpent), trip.homeCurrency)} of ${fmtMoney(trip.budgetAmount, trip.homeCurrency)}.`
      );
    }
    if (rainy) {
      lines.push(`Rain is likely on ${rainy.date.toLocaleDateString("en-US", { month: "short", day: "numeric" })} — want an indoor plan?`);
    }

    const chips = [
      upcoming ? `Tell me about ${upcoming.title}` : "What should I do tomorrow?",
      ...(rainy ? ["Plan a rainy-day itinerary"] : []),
      ...(trip.budgetAmount > 0 ? ["How much have I spent on food?"] : []),
      "Find something nearby",
    ];

    return { greeting, lines, chips };
  }, [bundle, trip]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send() {
    if (!input.trim() || loading) return;
    const userMsg = input.trim();
    setInput("");
    setShowSuggestions(false);
    setLoading(true);
    setMessages((prev) => [
      ...prev,
      { id: `u-${Date.now()}`, role: "user", content: userMsg },
      { id: `a-${Date.now()}`, role: "assistant", content: "", loading: true },
    ]);

    try {
      const res = await api<{ conversationId: string; content: string; data: unknown }>(`/api/trips/${tripId}/ai`, {
        json: { message: userMsg, conversationId },
      });
      setConversationId(res.conversationId);
      setMessages((prev) =>
        prev.map((m) => (m.loading ? { ...m, content: res.content, data: res.data, loading: false } : m))
      );
    } catch (e) {
      setMessages((prev) =>
        prev.map((m) =>
          m.loading ? { ...m, content: e instanceof ApiError ? e.message : "Something went wrong. Try again.", loading: false } : m
        )
      );
    } finally {
      setLoading(false);
    }
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  function insertSuggestion(s: string) {
    setInput(s);
    inputRef.current?.focus();
  }

  function copyCode(code: string) {
    navigator.clipboard.writeText(code);
  }

  return (
    <div className="flex h-[calc(100dvh-6.5rem)] flex-col pb-16 lg:pb-0">
      {/* header */}
      <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-line bg-bg/95 px-4 py-3 backdrop-blur">
        <div className="flex items-center gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-accent to-sky text-white">
            <Sparkles size={18} strokeWidth={2.2} />
          </span>
          <div>
            <h1 className="font-semibold text-[15px]">Concierge</h1>
            <p className="text-[11px] text-ink-3">Your trip concierge — it knows your itinerary, budget, and places.</p>
          </div>
        </div>
        <Button variant="ghost" size="icon" className="text-ink-3 hover:text-ink" aria-label="New conversation">
          <MessageSquareMore size={16} />
        </Button>
      </div>

      {/* messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.length === 0 && showSuggestions && (
          <div className="mx-auto max-w-md space-y-4 pt-10">
            <div className="text-center">
              <p className="font-display text-3xl tracking-tight">
                {ctx.greeting}.
              </p>
              <div className="mt-3 space-y-1 text-left">
                {ctx.lines.map((l) => (
                  <p key={l} className="flex items-start gap-2 text-[13px] leading-relaxed text-ink-2">
                    <Sparkles size={13} className="mt-0.5 shrink-0 text-accent" />
                    {l}
                  </p>
                ))}
              </div>
            </div>
            <div className="grid gap-2">
              {ctx.chips.map((s) => (
                <button
                  key={s}
                  onClick={() => insertSuggestion(s)}
                  className="text-left rounded-xl border border-line bg-surface p-3 text-sm transition-colors hover:border-accent/40 hover:bg-accent-soft/30"
                >
                  {s}
                </button>
              ))}
            </div>
            <p className="text-center text-xs text-ink-3">
              Or ask anything — itinerary changes, restaurants, weather, packing.
            </p>
            <div className="mx-auto grid max-w-xs gap-2">
              {SUGGESTIONS.slice(0, 3).map((s) => (
                <button
                  key={s}
                  onClick={() => insertSuggestion(s)}
                  className="text-left rounded-xl border border-dashed border-line bg-transparent p-2.5 text-[12.5px] text-ink-3 transition-colors hover:border-accent/40 hover:text-ink"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={cn("flex gap-3", msg.role === "user" && "flex-row-reverse")}
          >
            <div
              className={cn(
                "grid h-8 w-8 shrink-0 place-items-center rounded-xl",
                msg.role === "user" ? "bg-gradient-to-br from-accent to-sky text-white" : "bg-surface-2 text-ink-3"
              )}
            >
              {msg.role === "user" ? <ArrowUpRight size={15} /> : <Sparkles size={16} />}
            </div>
            <div className={cn("max-w-[75%] flex flex-col gap-1.5", msg.role === "user" && "items-end")}>
              <div
                className={cn(
                  "rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap",
                  msg.role === "user"
                    ? "bg-accent-soft/50 text-ink"
                    : "bg-surface border border-line text-ink"
                )}
              >
                {msg.content}
              </div>

              {msg.data ? (
                <DataCard data={msg.data} tripId={tripId} homeCurrency={trip.homeCurrency} />
              ) : null}

              {msg.loading && (
                <div className="flex items-center gap-2 px-1 text-xs text-ink-3">
                  <Spinner className="h-3 w-3" />
                  <span>Thinking…</span>
                </div>
              )}
            </div>
          </div>
        ))}

        <div ref={messagesEndRef} />
      </div>

      {/* input */}
      <div className="sticky bottom-0 border-t border-line bg-bg/95 px-4 py-3 backdrop-blur">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Ask me anything…"
            disabled={loading}
            rows={1}
            className="flex-1 min-h-[44px] max-h-40 w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm resize-none outline-none focus:border-accent/50 placeholder:text-ink-3 disabled:opacity-50"
          />
          <Button
            onClick={send}
            disabled={loading || !input.trim()}
            className="shrink-0 h-10 bg-gradient-to-r from-accent to-sky text-white"
            aria-label="Send"
          >
            <Send size={16} />
          </Button>
        </div>
        <p className="mt-1.5 text-center text-[11px] text-ink-3">
          ⌘Enter to send · Data stays in your trip ·{" "}
          <a href="#" className="text-accent hover:underline">Privacy</a>
        </p>
      </div>
    </div>
  );
}

function DataCard({ data, tripId, homeCurrency }: { data: unknown; tripId: string; homeCurrency: string }) {
  const d = data as Record<string, unknown>;
  if (!d || !d.kind) return null;

  const s = (v: unknown, k: string): string | undefined =>
    typeof v === "object" && v !== null && typeof (v as Record<string, unknown>)[k] === "string"
      ? ((v as Record<string, unknown>)[k] as string)
      : undefined;
  const sa = (v: unknown, k: string): string[] | undefined => {
    const o = typeof v === "object" && v !== null ? (v as Record<string, unknown>) : {};
    const val = o[k];
    return Array.isArray(val) ? val.filter((x): x is string => typeof x === "string") : undefined;
  };

  if (d.kind === "optimization-proposal") {
    return (
      <Card className="mt-2 border-accent/30 bg-gradient-to-br from-accent/8 via-transparent to-sky/5">
        <p className="px-4 py-3 text-sm leading-relaxed">
          Optimization for <strong>{d.date as string}</strong> saves <strong>{fmtMinutes(Number(d.savedMin))}</strong> of travel time.
        </p>
        <div className="flex gap-2 px-4 pb-3">
          <Button className="flex-1" onClick={() => fetch(`/api/trips/${tripId}/optimize`, { method: "POST", body: JSON.stringify({ date: d.date, apply: true }), headers: { "Content-Type": "application/json" } }).then(() => location.reload())}>
            Apply optimization
          </Button>
          <Button variant="secondary" className="flex-1">Keep current plan</Button>
        </div>
      </Card>
    );
  }

  if (d.kind === "restaurant-cards" || d.kind === "place-cards") {
    const items = (d.items as Array<Record<string, unknown>>) ?? [];
    return (
      <Card className="mt-2">
        <div className="grid gap-2 px-4 py-3">
          {items.slice(0, 3).map((item, i) => (
            <button key={i} className="group flex items-center gap-3 rounded-xl border border-line bg-surface p-3 text-left transition-colors hover:border-accent/40 hover:bg-accent-soft/30">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-surface-2 shrink-0">
                {d.kind === "restaurant-cards" ? (
                  <UtensilsCrossed size={16} className="text-amber" />
                ) : (
                  <MapPin size={16} className="text-coral" />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-medium truncate">{s(item, "name")}</p>
                <p className="text-xs text-ink-3">{sa(item, "why")?.join(", ") ?? s(item, "blurb")}</p>
              </div>
              <Badge tone="accent" className="self-start shrink-0">Add</Badge>
            </button>
          ))}
        </div>
      </Card>
    );
  }

  if (d.kind === "budget-report") {
    return (
      <Card className="mt-2">
        <div className="grid gap-2 px-4 py-3">
          <p className="font-semibold">Budget status</p>
          <p className="text-sm text-ink-2">
            Spent <strong>{fmtMoney(Number(d.spent), String(d.homeCurrency))}</strong> of{" "}
            <strong>{fmtMoney(Number(d.budget), String(d.homeCurrency))}</strong>
          </p>
        </div>
      </Card>
    );
  }

  if (d.kind === "itinerary-changed") {
    return (
      <Badge tone="success" className="mt-2">
        ✓ Updated {String(d.date)} itinerary
      </Badge>
    );
  }

  return null;
}

function fmtMinutes(min: number): string {
  if (min < 60) return `${Math.round(min)} min`;
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return m ? `${h}h ${m}m` : `${h}h`;
}