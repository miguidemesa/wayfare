"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BedDouble,
  Bus,
  CalendarPlus,
  Car,
  Check,
  Clock,
  Footprints,
  GripVertical,
  MapPin,
  Pencil,
  Plane,
  Plus,
  Route,
  Search,
  Train,
  Trash2,
  UtensilsCrossed,
  WandSparkles,
} from "lucide-react";
import type { TripBundle } from "@/lib/trip-service";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  Modal,
  Select,
  Spinner,
} from "@/components/ui";
import { cn, fmtMinutes, fmtMoney, fmtTime12 } from "@/lib/utils";
import { ITEM_TYPES } from "@/lib/types";
import { api, ApiError } from "@/lib/client-api";

type Day = TripBundle["days"][number];
type Item = Day["items"][number];

const TYPE_STYLE: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
  FLIGHT: { icon: <Plane size={13} />, color: "#059669", label: "Flight" },
  HOTEL: { icon: <BedDouble size={13} />, color: "#7c3aed", label: "Hotel" },
  RESTAURANT: { icon: <UtensilsCrossed size={13} />, color: "#d97706", label: "Restaurant" },
  ACTIVITY: { icon: <MapPin size={13} />, color: "#e11d48", label: "Activity" },
  TRANSPORT: { icon: <Route size={13} />, color: "#0284c7", label: "Transport" },
  RESERVATION: { icon: <Check size={13} />, color: "#6d28d9", label: "Reserved" },
  PERSONAL: { icon: <Clock size={13} />, color: "#475569", label: "Personal" },
};

function TransitLeg({ mode, min, cost }: { mode: string; min: number; cost?: number | null }) {
  const getIcon = () => {
    switch (mode) {
      case "WALK": return <Footprints size={11} className="text-ink-3" />;
      case "TRAIN": return <Train size={11} className="text-sky" />;
      case "BUS": return <Bus size={11} className="text-amber" />;
      case "TAXI":
      case "CAR": return <Car size={11} className="text-ink-2" />;
      case "FLIGHT": return <Plane size={11} className="text-emerald-500" />;
      default: return <Route size={11} className="text-accent" />;
    }
  };

  return (
    <div className="ml-16 my-1.5 flex items-center gap-2 pl-4 text-[11px] text-ink-3">
      <div className="flex items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 py-0.5 shadow-2xs">
        {getIcon()}
        <span className="font-medium text-ink-2 capitalize">{mode.toLowerCase()}</span>
        <span className="text-line-strong">·</span>
        <span className="tabular font-medium">{min} min</span>
        {cost ? <span className="tabular text-ink-3">· ¥{cost.toLocaleString()}</span> : null}
      </div>
    </div>
  );
}

export function ItineraryClient({ bundle }: { bundle: TripBundle }) {
  const router = useRouter();
  const { trip, days } = bundle;

  const initialDay = useMemo(() => days[0]?.id ?? "", [days]);
  const [selectedDayId, setSelectedDayId] = useState(initialDay);
  const day = days.find((d) => d.id === selectedDayId) ?? days[0];

  const [addOpen, setAddOpen] = useState(false);
  const [editItem, setEditItem] = useState<Item | null>(null);
  const [optimizing, setOptimizing] = useState(false);
  const [optimizeResult, setOptimizeResult] = useState<{
    date: string;
    originalOrder: string[];
    optimizedOrder: string[];
    originalTravelMin: number;
    optimizedTravelMin: number;
    savedMin: number;
  } | null>(null);

  // drag state
  const dragIndex = useRef<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const [order, setOrder] = useState<Item[]>(day?.items ?? []);
  const [draggedDayKey, setDraggedDayKey] = useState<string | null>(null);

  // keep local order in sync when day or data changes
  const itemsKey = `${selectedDayId}:${day?.items.map((i) => i.id).join(",")}`;
  const [lastKey, setLastKey] = useState(itemsKey);
  if (lastKey !== itemsKey) {
    setLastKey(itemsKey);
    setOrder(day?.items ?? []);
  }

  async function persistOrder(newItems: Item[]) {
    setOrder(newItems);
    try {
      await api(`/api/trips/${trip.id}/itinerary`, {
        method: "PATCH",
        json: { dayId: selectedDayId, itemIds: newItems.map((i) => i.id) },
      });
      router.refresh();
    } catch (e) {
      if (e instanceof ApiError && e.message.includes("offline")) {
        // queued — optimistic UI already updated
      }
    }
  }

  function onDrop(toIndex: number) {
    const from = dragIndex.current;
    dragIndex.current = null;
    setOverIndex(null);
    if (from == null || from === toIndex) return;
    const next = [...order];
    const [moved] = next.splice(from, 1);
    next.splice(toIndex, 0, moved);
    persistOrder(next);
  }

  async function deleteItem(item: Item) {
    setOrder((prev) => prev.filter((i) => i.id !== item.id));
    try {
      await api(`/api/items/${item.id}`, { method: "DELETE" });
      router.refresh();
    } catch {}
  }

  async function runOptimize() {
    if (!day) return;
    setOptimizing(true);
    try {
      const res = await api<typeof optimizeResult>(`/api/trips/${trip.id}/optimize`, {
        json: { date: new Date(day.date).toISOString().slice(0, 10) },
      });
      setOptimizeResult(res);
    } catch {} finally {
      setOptimizing(false);
    }
  }

  async function applyOptimize() {
    if (!day || !optimizeResult) return;
    await api(`/api/trips/${trip.id}/optimize`, {
      json: { date: new Date(day.date).toISOString().slice(0, 10), apply: true },
    }).catch(() => {});
    setOptimizeResult(null);
    router.refresh();
  }

  if (!day) {
    return (
      <div className="mx-auto max-w-3xl px-5 py-10">
        <EmptyState
          emoji="🗺️"
          title="No itinerary yet"
          description="Generate a smart geographic itinerary with the AI builder."
          action={
            <Button onClick={() => setAddOpen(true)}>
              <Plus size={15} /> Add your first item
            </Button>
          }
        />
        <AddItemModal open={addOpen} onClose={() => setAddOpen(false)} tripId={trip.id} days={days} defaultDayId={""} onCreated={() => { setAddOpen(false); router.refresh(); }} />
      </div>
    );
  }

  const dayDate = new Date(day.date);
  const totalTravel = order.reduce((s, i) => s + (i.transportMin ?? 0), 0);
  const totalCost = order.reduce((s, i) => s + (i.cost ?? 0), 0);

  return (
    <div className="mx-auto max-w-5xl px-4 pb-24 pt-5 sm:px-6">
      {/* ------------------------------------------------------ day selector */}
      <div className="mb-5 flex items-center justify-between gap-3 animate-fade-up">
        <div className="hide-scrollbar -mx-1 flex flex-1 gap-2 overflow-x-auto px-1 pb-1">
          {days.map((d, idx) => {
            const dt = new Date(d.date);
            const activeSel = d.id === selectedDayId;
            return (
              <button
                key={d.id}
                onClick={() => setSelectedDayId(d.id)}
                className={cn(
                  "group relative shrink-0 rounded-xl border px-3.5 py-2 text-left transition-all active:scale-[0.98]",
                  activeSel
                    ? "border-accent/50 bg-accent-soft/40 shadow-sm"
                    : "border-line bg-surface hover:border-line-strong"
                )}
                aria-current={activeSel ? "date" : undefined}
              >
                <p className="text-[10px] font-semibold text-ink-3">
                  Day {idx + 1}
                </p>
                <p className={cn("text-[13px] font-semibold", activeSel ? "text-accent-strong" : "")}>
                  {dt.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </p>
                <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5">
                  {d.items.length > 0 ? (
                    <span className="block h-full w-full rounded-full bg-accent" />
                  ) : (
                    <span className="block h-full w-full rounded-full border border-line-strong" />
                  )}
                </span>
              </button>
            );
          })}
        </div>
        <Button size="sm" variant="secondary" onClick={() => setAddOpen(true)} className="shrink-0">
          <CalendarPlus size={14} /> Add
        </Button>
      </div>

      {/* -------------------------------------------------------- day masthead */}
      <Card className="animate-fade-up relative mb-5 overflow-hidden">
        {/* destination atmosphere — inherits the trip's theme scope */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "linear-gradient(110deg, color-mix(in srgb, var(--dst-accent, #0f766e) 13%, transparent) 0%, transparent 55%), radial-gradient(90% 150% at 100% 0%, color-mix(in srgb, var(--dst-accent-2, #0369a1) 11%, transparent) 0%, transparent 60%)",
          }}
        />
        {/* oversized editorial day numeral */}
        <span
          aria-hidden
          className="pointer-events-none absolute -right-2 -top-7 select-none font-display text-[7.5rem] leading-none tracking-tighter text-ink/[0.06]"
        >
          {String(days.indexOf(day) + 1).padStart(2, "0")}
        </span>

        <div className="relative flex flex-wrap items-center gap-x-6 gap-y-3 px-5 py-5">
          <div>
            <p className="text-[11px] font-semibold text-ink-3">
              {dayDate.toLocaleDateString("en-US", { weekday: "long" })} ·{" "}
              {dayDate.toLocaleDateString("en-US", { month: "long", day: "numeric" })}
            </p>
            <h1 className="mt-1 font-display text-3xl leading-none tracking-tight">
              <span className="text-[11px] font-normal text-ink-3 align-top sm:mr-2">
                Day
              </span>
              {days.indexOf(day) + 1}{' '}
              <span className="font-display italic text-ink-2">· {day.title ?? day.city}</span>
            </h1>
            <p className="mt-1 text-xs text-ink-3">{day.city}</p>
          </div>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 sm:ml-auto">
            <MiniStat label="Stops" value={String(order.length)} />
            <MiniStat label="Transit" value={fmtMinutes(totalTravel)} />
            <MiniStat label="Entry costs" value={totalCost > 0 ? `¥${Math.round(totalCost).toLocaleString()}` : "—"} />
            <Button size="sm" onClick={runOptimize} disabled={optimizing || order.length < 2}>
              {optimizing ? <Spinner /> : <WandSparkles size={14} />}
              Optimize this day
            </Button>
          </div>
        </div>
      </Card>

      {/* ---------------------------------------------------------- timeline */}
      {order.length === 0 ? (
        <EmptyState
          emoji="🌤️"
          title="A blank canvas"
          description="Add activities, restaurants and transport — or let the AI suggest something for this day."
          action={
            <Button onClick={() => setAddOpen(true)}>
              <Plus size={15} /> Add an item
            </Button>
          }
        />
      ) : (
        <ol className="relative space-y-0" aria-label="Day timeline">
          {order.map((item, idx) => {
            const style = TYPE_STYLE[item.type] ?? TYPE_STYLE.PERSONAL;
            const conflict =
              idx > 0 &&
              item.startTime != null &&
              order[idx - 1].endTime != null &&
              item.startTime < order[idx - 1].endTime! - 5 &&
              order[idx - 1].startTime != null;
            return (
              <li key={item.id}>
                {/* travel leg */}
                {item.transportMode && item.transportMin ? (
                  <TransitLeg
                    mode={item.transportMode}
                    min={item.transportMin}
                    cost={item.transportCost}
                  />
                ) : null}

                <div
                  draggable
                  onDragStart={(e) => {
                    dragIndex.current = idx;
                    e.dataTransfer.effectAllowed = "move";
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setOverIndex(idx);
                  }}
                  onDragLeave={() => setOverIndex((o) => (o === idx ? null : o))}
                  onDrop={(e) => {
                    e.preventDefault();
                    onDrop(idx);
                  }}
                  className={cn(
                    "card group relative flex cursor-grab items-start gap-3 p-3.5 pr-9 transition-all active:cursor-grabbing",
                    overIndex === idx && dragIndex.current !== null && "border-accent/60 ring-2 ring-ring/25",
                    !item.confirmed && "border-dashed"
                  )}
                >
                  {/* time + dot */}
                  <div className="flex w-16 shrink-0 flex-col items-end pt-0.5">
                    <span className="tabular text-[13px] font-semibold">
                      {fmtTime12(item.startTime)}
                    </span>
                    {conflict && (
                      <Badge tone="danger" className="mt-1 !px-1.5 !py-0 !text-[9px]">
                        overlaps
                      </Badge>
                    )}
                  </div>

                  <span
                    className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg text-white shadow-sm"
                    style={{ background: style.color }}
                    title={style.label}
                  >
                    {style.icon}
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-2">
                      <p className="text-[14.5px] font-semibold leading-snug">{item.title}</p>
                      {!item.confirmed && (
                        <Badge tone="warning" className="!py-0 !text-[10px]">unconfirmed</Badge>
                      )}
                    </div>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-ink-3">
                      {item.neighborhood && (
                        <span className="inline-flex items-center gap-1">
                          <MapPin size={10} /> {item.neighborhood}
                        </span>
                      )}
                      <span>· {fmtMinutes(item.durationMin)}</span>
                      {item.cost ? (
                        <span>· ~{fmtMoney(item.cost, item.currency ?? "JPY")}</span>
                      ) : null}
                    </p>
                    {item.notes && (
                      <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-ink-2">{item.notes}</p>
                    )}
                  </div>

                  {/* actions */}
                  <div className="absolute right-2 top-2 flex opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                    <button
                      onClick={() => setEditItem(item)}
                      className="rounded-lg p-1.5 text-ink-3 hover:bg-surface-2 hover:text-ink"
                      aria-label={`Edit ${item.title}`}
                    >
                      <Pencil size={13.5} />
                    </button>
                    <button
                      onClick={() => deleteItem(item)}
                      className="rounded-lg p-1.5 text-ink-3 hover:bg-danger/10 hover:text-danger"
                      aria-label={`Delete ${item.title}`}
                    >
                      <Trash2 size={13.5} />
                    </button>
                    <span className="grid place-items-center px-0.5 text-ink-3/50" aria-hidden>
                      <GripVertical size={14} />
                    </span>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      <p className="mt-4 text-center text-[11px] text-ink-3">
        Drag cards to reorder · times are suggestions you can edit freely
      </p>

      {/* ------------------------------------------------------------ modals */}
      <AddItemModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        tripId={trip.id}
        days={days}
        defaultDayId={selectedDayId}
        onCreated={() => {
          setAddOpen(false);
          router.refresh();
        }}
      />

      <EditItemModal
        item={editItem}
        onClose={() => setEditItem(null)}
        days={days}
        currentDayId={selectedDayId}
        onSaved={() => {
          setEditItem(null);
          router.refresh();
        }}
        onDeleted={(id) => {
          setEditItem(null);
          const it = order.find((i) => i.id === id);
          if (it) deleteItem(it);
        }}
      />

      {/* optimize preview */}
      <Modal open={!!optimizeResult} onClose={() => setOptimizeResult(null)} title="Route optimization">
        {optimizeResult && (
          <div>
            {optimizeResult.savedMin <= 2 ? (
              <p className="text-sm text-ink-2">
                Your day is already efficient — total transit is{" "}
                <strong>{fmtMinutes(optimizeResult.originalTravelMin)}</strong>. No changes suggested.
              </p>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-line bg-surface-2/60 p-3">
                    <p className="text-[10px] font-medium text-ink-3">Current</p>
                    <p className="tabular mt-1 text-lg font-bold">{fmtMinutes(optimizeResult.originalTravelMin)}</p>
                    <p className="text-[11px] text-ink-3">travel time</p>
                  </div>
                  <div className="rounded-xl border border-accent/40 bg-accent-soft/30 p-3">
                    <p className="text-[10px] font-medium text-accent">Optimized</p>
                    <p className="tabular mt-1 text-lg font-bold text-accent-strong">{fmtMinutes(optimizeResult.optimizedTravelMin)}</p>
                    <p className="text-[11px] text-success">saves {fmtMinutes(optimizeResult.savedMin)}</p>
                  </div>
                </div>
                <ol className="mt-4 space-y-1.5">
                  {optimizeResult.optimizedOrder.map((t, i) => (
                    <li key={i} className="flex items-center gap-2.5 text-[13px]">
                      <span className="tabular grid h-5 w-5 place-items-center rounded-full bg-surface-2 text-[10px] font-bold">
                        {i + 1}
                      </span>
                      {t}
                    </li>
                  ))}
                </ol>
                <div className="mt-5 flex gap-2">
                  <Button className="flex-1" onClick={applyOptimize}>
                    <Check size={15} /> Apply optimization
                  </Button>
                  <Button variant="secondary" className="flex-1" onClick={() => setOptimizeResult(null)}>
                    Keep current plan
                  </Button>
                </div>
                <p className="mt-3 text-[11px] text-ink-3">
                  Nothing changes until you apply — your itinerary stays untouched.
                </p>
              </>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

/* ------------------------------------------------------------------ modals */

function AddItemModal({
  open,
  onClose,
  tripId,
  days,
  defaultDayId,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  tripId: string;
  days: Day[];
  defaultDayId: string;
  onCreated: () => void;
}) {
  const [mode, setMode] = useState<"search" | "manual">("search");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<TripPlace[]>([]);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [dayId, setDayId] = useState(defaultDayId);
  const [title, setTitle] = useState("");
  const [type, setType] = useState("ACTIVITY");
  const [startTime, setStartTime] = useState("10:00");
  const [durationMin, setDurationMin] = useState(90);

  async function search(q: string) {
    if (!q.trim()) return setResults([]);
    setSearching(true);
    setError(null);
    try {
      const data = await api<{ places: TripPlace[] }>(
        `/api/trips/${tripId}/places?q=${encodeURIComponent(q)}`
      );
      setResults(data.places.slice(0, 8));
    } catch {
      setError("Search failed — check your connection");
    } finally {
      setSearching(false);
    }
  }

  async function saveManual() {
    setSaving(true);
    setError(null);
    try {
      await api(`/api/trips/${tripId}/itinerary`, {
        json: {
          kind: "item",
          dayId: dayId || days[0]?.id,
          title: title.trim() || "New stop",
          type,
          startTime,
          durationMin,
        },
      });
      onCreated();
      setTitle("");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to add");
    } finally {
      setSaving(false);
    }
  }

  async function addFromDataset(place: TripPlace) {
    setSaving(true);
    try {
      await api(`/api/trips/${tripId}/itinerary`, {
        json: {
          kind: "item",
          dayId: dayId || days[0]?.id,
          title: place.name,
          type: place.category === "RESTAURANT" ? "RESTAURANT" : "ACTIVITY",
          startTime,
          durationMin: place.durationMin,
          poiId: place.poiId,
        },
      });
      onCreated();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to add");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Add to itinerary" wide>
      <div className="space-y-4">
        <Field label="Day">
          <Select value={dayId} onChange={(e) => setDayId(e.target.value)}>
            {days.map((d, i) => (
              <option key={d.id} value={d.id}>
                Day {i + 1} · {new Date(d.date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })} ({d.city})
              </option>
            ))}
          </Select>
        </Field>

        <div className="flex gap-1 rounded-xl bg-surface-2 p-1">
          {(
            [
              ["search", "Search places"],
              ["manual", "Custom entry"],
            ] as const
          ).map(([m, label]) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={cn(
                "flex-1 rounded-lg px-3 py-1.5 text-[13px] font-medium transition-all",
                mode === m ? "bg-surface shadow-sm border border-line" : "text-ink-3 hover:text-ink"
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {mode === "search" ? (
          <>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" />
              <Input
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  search(e.target.value);
                }}
                placeholder="Try 'ramen', 'temple', 'teamlab'…"
                className="pl-9"
              />
              {searching && <Spinner className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-3" />}
            </div>
            <ul className="max-h-72 space-y-1.5 overflow-y-auto">
              {results.map((p) => (
                <li key={p.poiId}>
                  <button
                    onClick={() => addFromDataset(p)}
                    disabled={saving}
                    className="w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-left transition-all hover:border-accent/40 hover:bg-accent-soft/20 disabled:opacity-50"
                  >
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="text-[13.5px] font-semibold">{p.name}</span>
                      <span className="shrink-0 text-[11px] text-ink-3">
                        {"¥".repeat(p.priceLevel)} · {p.rating}★
                      </span>
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-ink-3">
                      {p.neighborhood}, {p.city} · {p.hours}
                    </span>
                  </button>
                </li>
              ))}
              {!results.length && query && !searching && (
                <li className="py-6 text-center text-[13px] text-ink-3">
                  No matches — switch to “Custom entry” to add anything.
                </li>
              )}
            </ul>
          </>
        ) : (
          <>
            <Field label="Title">
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Sunset at Toppō bridge" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Type">
                <Select value={type} onChange={(e) => setType(e.target.value)}>
                  {ITEM_TYPES.filter((t) => t !== "FLIGHT").map((t) => (
                    <option key={t} value={t}>{t.charAt(0) + t.slice(1).toLowerCase()}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Start time">
                <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
              </Field>
            </div>
            <Field label={`Duration — ${durationMin} min`}>
              <input
                type="range" min={15} max={360} step={15}
                value={durationMin}
                onChange={(e) => setDurationMin(Number(e.target.value))}
                className="w-full accent-teal-600"
              />
            </Field>
            {error && <p className="rounded-lg bg-danger/10 px-3 py-2 text-[13px] text-danger">{error}</p>}
            <Button onClick={saveManual} loading={saving} className="w-full">
              <Plus size={15} /> Add to day
            </Button>
          </>
        )}
      </div>
    </Modal>
  );
}

function EditItemModal({
  item,
  onClose,
  days,
  currentDayId,
  onSaved,
  onDeleted,
}: {
  item: Item | null;
  onClose: () => void;
  days: Day[];
  currentDayId: string;
  onSaved: () => void;
  onDeleted: (id: string) => void;
}) {
  const [title, setTitle] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [durationMin, setDurationMin] = useState(60);
  const [cost, setCost] = useState("");
  const [notes, setNotes] = useState("");
  const [targetDayId, setTargetDayId] = useState(currentDayId);
  const [saving, setSaving] = useState(false);
  const initializedFor = useRef<Item | null>(null);

  if (item && initializedFor.current !== item) {
    initializedFor.current = item;
    setTitle(item.title);
    setStartTime(
      item.startTime != null
        ? `${String(Math.floor(item.startTime / 60)).padStart(2, "0")}:${String(item.startTime % 60).padStart(2, "0")}`
        : ""
    );
    setDurationMin(item.durationMin);
    setCost(item.cost != null ? String(item.cost) : "");
    setNotes(item.notes ?? "");
    setTargetDayId(currentDayId);
  }

  async function save() {
    if (!item) return;
    setSaving(true);
    try {
      await api(`/api/items/${item.id}`, {
        method: "PATCH",
        json: {
          title,
          startTime: startTime || null,
          durationMin,
          cost: cost === "" ? null : Number(cost),
          notes: notes || null,
        },
      });
      // cross-day move
      if (targetDayId && targetDayId !== currentDayId) {
        await api(`/api/items/${item.id}`, {
          method: "PATCH",
          json: { moveToDayId: targetDayId },
        }).catch(() => {});
      }
      onSaved();
    } catch {} finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={!!item} onClose={onClose} title="Edit itinerary item">
      <div className="space-y-4">
        <Field label="Title">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Start time">
            <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
          </Field>
          <Field label={`Duration — ${durationMin} min`}>
            <input
              type="range" min={15} max={480} step={15}
              value={durationMin}
              onChange={(e) => setDurationMin(Number(e.target.value))}
              className="mt-2.5 w-full accent-teal-600"
            />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Est. cost (local currency)">
            <Input type="number" min={0} value={cost} onChange={(e) => setCost(e.target.value)} placeholder="—" />
          </Field>
          <Field label="Move to day">
            <Select value={targetDayId} onChange={(e) => setTargetDayId(e.target.value)}>
              {days.map((d, i) => (
                <option key={d.id} value={d.id}>
                  Day {i + 1} · {new Date(d.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="Notes">
          <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Confirmation numbers, tips…" />
        </Field>
        <div className="flex gap-2 pt-1">
          <Button loading={saving} onClick={save} className="flex-1">
            Save changes
          </Button>
          <Button
            variant="danger"
            onClick={() => item && onDeleted(item.id)}
            aria-label="Delete item"
          >
            <Trash2 size={15} />
          </Button>
        </div>
      </div>
    </Modal>
  );
}

type TripPlace = {
  poiId: string;
  name: string;
  city: string;
  neighborhood: string;
  priceLevel: number;
  rating: number;
  hours: string;
  category: string;
  durationMin: number;
};

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-semibold text-ink-3">{label}</p>
      <p className="tabular text-sm font-bold">{value}</p>
    </div>
  );
}
