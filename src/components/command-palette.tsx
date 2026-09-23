"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  CalendarRange,
  CreditCard,
  FileText,
  MapPin,
  Search,
  Sparkles,
  Ticket,
} from "lucide-react";
import { api } from "@/lib/client-api";
import { cn } from "@/lib/utils";
import { Spinner } from "./ui";

type SearchResult = {
  type: "itinerary" | "expense" | "reservation" | "saved" | "document" | "journal" | "page";
  id: string;
  title: string;
  subtitle?: string;
  href: string;
};

const QUICK_PAGES = (base: string) => [
  { label: "Overview", icon: MapPin, href: base },
  { label: "Itinerary", icon: CalendarRange, href: `${base}/itinerary` },
  { label: "Map", icon: MapPin, href: `${base}/map` },
  { label: "Discover nearby", icon: Search, href: `${base}/discover` },
  { label: "Expenses & budget", icon: CreditCard, href: `${base}/expenses` },
  { label: "Reservations", icon: Ticket, href: `${base}/reservations` },
  { label: "Documents vault", icon: FileText, href: `${base}/documents` },
  { label: "Ask the Travel AI", icon: Sparkles, href: `${base}/ai` },
];

export function CommandPalette({
  open,
  onClose,
  tripId,
  tripBase,
}: {
  open: boolean;
  onClose: () => void;
  tripId: string;
  tripBase: string;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const quick = useMemo(() => {
    const q = query.trim().toLowerCase();
    return QUICK_PAGES(tripBase).filter((p) => !q || p.label.toLowerCase().includes(q));
  }, [query, tripBase]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setResults([]);
      setActiveIdx(0);
      setTimeout(() => inputRef.current?.focus(), 20);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const q = query.trim();
    if (!q) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const data = await api<{ results: SearchResult[] }>(
          `/api/trips/${tripId}/search?q=${encodeURIComponent(q)}`
        );
        setResults(data.results ?? []);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 180);
    return () => clearTimeout(t);
  }, [query, open, tripId]);

  useEffect(() => setActiveIdx(0), [results.length, quick.length]);

  const flat = useMemo(
    () => [...results.map((r) => ({ ...r })), ...quick.map((q) => ({
      type: "page" as const,
      id: q.href,
      title: q.label,
      href: q.href,
    }))],
    [results, quick]
  );

  if (!open) return null;

  const go = (href: string) => {
    onClose();
    router.push(href);
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, flat.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && flat[activeIdx]) {
      go(flat[activeIdx].href);
    } else if (e.key === "Escape") {
      onClose();
    }
  };

  const TYPE_ICON: Record<string, React.ReactNode> = {
    itinerary: <CalendarRange size={14} className="text-sky" />,
    expense: <CreditCard size={14} className="text-amber" />,
    reservation: <Ticket size={14} className="text-violet" />,
    saved: <MapPin size={14} className="text-coral" />,
    document: <FileText size={14} className="text-ink-3" />,
    journal: <FileText size={14} className="text-success" />,
  };

  return (
    <div
      className="fixed inset-0 z-[110] bg-black/50 px-4 pt-[12vh]"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
      aria-label="Search"
    >
      <div
        className="card mx-auto w-full max-w-xl overflow-hidden shadow-pop animate-scale-in"
        onKeyDown={onKey}
      >
        <div className="flex items-center gap-2.5 border-b border-line px-4">
          <Search size={16} className="text-ink-3 shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search places, expenses, itinerary, reservations…"
            className="h-12 flex-1 bg-transparent text-sm outline-none placeholder:text-ink-3"
          />
          {loading ? <Spinner /> : (
            <kbd className="rounded border border-line bg-surface-2 px-1.5 py-0.5 text-[10px] text-ink-3">esc</kbd>
          )}
        </div>

        <div ref={listRef} className="max-h-[46vh] overflow-y-auto p-2">
          {results.length > 0 && (
            <>
              <p className="px-2 pb-1 pt-1.5 text-[10px] font-semibold uppercase tracking-wider text-ink-3">
                Results
              </p>
              {results.map((r, i) => (
                <button
                  key={`${r.type}-${r.id}`}
                  onClick={() => go(r.href)}
                  onMouseEnter={() => setActiveIdx(i)}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors",
                    activeIdx === i ? "bg-surface-2" : ""
                  )}
                >
                  <span className="shrink-0">{TYPE_ICON[r.type] ?? <Search size={14} />}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium">{r.title}</span>
                    {r.subtitle ? (
                      <span className="block truncate text-xs text-ink-3">{r.subtitle}</span>
                    ) : null}
                  </span>
                  <ArrowRight size={13} className="text-ink-3 opacity-0 transition-opacity" style={{ opacity: activeIdx === i ? 1 : undefined }} />
                </button>
              ))}
            </>
          )}

          <p className="px-2 pb-1 pt-1.5 text-[10px] font-semibold uppercase tracking-wider text-ink-3">
            {query.trim() ? "Pages" : "Jump to"}
          </p>
          {quick.map((q, i) => {
            const idx = results.length + i;
            const Icon = q.icon;
            return (
              <button
                key={q.href}
                onClick={() => go(q.href)}
                onMouseEnter={() => setActiveIdx(idx)}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors",
                  activeIdx === idx ? "bg-surface-2" : ""
                )}
              >
                <Icon size={14} className="text-accent shrink-0" />
                <span className="text-[13px] font-medium">{q.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
