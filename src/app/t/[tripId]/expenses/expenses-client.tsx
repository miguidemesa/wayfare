"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
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
  BedDouble,
  Camera,
  Film,
  Lightbulb,
  Pencil,
  Plane,
  Plus,
  Receipt,
  ScanLine,
  ShoppingBag,
  Ticket,
  Train,
  Trash2,
  TriangleAlert,
  UtensilsCrossed,
} from "lucide-react";
import type { TripBundle } from "@/lib/trip-service";
import {
  AnimatedNumber,
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  Field,
  Input,
  Modal,
  Select,
  Spinner,
} from "@/components/ui";
import { EXPENSE_CATEGORIES, EXPENSE_CATEGORY_META, type ExpenseCategory } from "@/lib/types";
import { cn, convertCurrency, fmtMoney } from "@/lib/utils";
import { api, ApiError } from "@/lib/client-api";

type Expense = TripBundle["expenses"][number];

export function ExpensesClient({
  bundle,
  rates,
  ratesUpdatedAt,
  ratesSource,
}: {
  bundle: TripBundle;
  rates: Record<string, number>;
  ratesUpdatedAt: string;
  ratesSource: string;
}) {
  const router = useRouter();
  const { trip, expenses } = bundle;

  const totalSpent = expenses.reduce((s, e) => s + e.amountHome, 0);
  const remaining = trip.budgetAmount - totalSpent;
  const budgetPct = trip.budgetAmount > 0 ? Math.min(100, (totalSpent / trip.budgetAmount) * 100) : 0;

  const dayCount =
    Math.round((trip.endDate.getTime() - trip.startDate.getTime()) / 86400000) + 1;
  const elapsedDays = Math.max(
    1,
    Math.min(dayCount, Math.ceil((Date.now() - trip.startDate.getTime()) / 86400000) || 1)
  );
  const dailyAvg = totalSpent / elapsedDays;
  const projected = dailyAvg * dayCount;
  const overBy = projected - trip.budgetAmount;

  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);

  // charts data
  const timeSeries = useMemo(() => {
    const byDay = new Map<string, number>();
    for (const e of expenses) {
      const k = e.date.toISOString().slice(0, 10);
      byDay.set(k, (byDay.get(k) ?? 0) + e.amountHome);
    }
    let cum = 0;
    return [...byDay.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, amt]) => {
        cum += amt;
        return { date: date.slice(5), amount: Math.round(amt), cumulative: Math.round(cum) };
      });
  }, [expenses]);

  const categoryData = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of expenses) m.set(e.category, (m.get(e.category) ?? 0) + e.amountHome);
    return [...m.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([cat, value]) => ({
        name: EXPENSE_CATEGORY_META[cat as ExpenseCategory]?.label ?? cat,
        value: Math.round(value),
        color: EXPENSE_CATEGORY_META[cat as ExpenseCategory]?.color ?? "#94A3B8",
      }));
  }, [expenses]);

  const insights = useMemo(() => {
    const out: React.ReactNode[] = [];
    if (overBy > 0) {
      out.push(
        <Insight key="proj" tone="warning" icon={<TriangleAlert size={13} />}>
          At your current pace ({fmtMoney(dailyAvg, trip.homeCurrency)}/day), you&apos;re projected to finish{" "}
          <strong>{fmtMoney(overBy, trip.homeCurrency)} over budget</strong>.
        </Insight>
      );
    }
    const foodTotal = expenses.filter((e) => e.category === "FOOD").reduce((s, e) => s + e.amountHome, 0);
    const foodBudgetShare = trip.budgetAmount * 0.25;
    if (foodTotal > foodBudgetShare && elapsedDays > 1) {
      out.push(
        <Insight key="food" tone="info" icon={<Lightbulb size={13} />}>
          Food is your biggest category at {fmtMoney(foodTotal, trip.homeCurrency)} — that&apos;s{" "}
          {Math.round((foodTotal / Math.max(totalSpent, 1)) * 100)}% of all spending.
        </Insight>
      );
    }
    if (remaining > 0) {
      out.push(
        <Insight key="left" tone="success" icon={<Lightbulb size={13} />}>
          {fmtMoney(remaining, trip.homeCurrency)} left — about{" "}
          <strong>{fmtMoney(Math.max(0, remaining) / Math.max(1, dayCount - elapsedDays + 1), trip.homeCurrency)}</strong> per remaining day.
        </Insight>
      );
    }
    return out.slice(0, 3);
  }, [overBy, remaining, dailyAvg, trip.homeCurrency, expenses, elapsedDays, totalSpent, dayCount]);

  // group expenses by date for the list
  const grouped = useMemo(() => {
    const m = new Map<string, Expense[]>();
    for (const e of expenses) {
      const k = e.date.toISOString().slice(0, 10);
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(e);
    }
    return [...m.entries()];
  }, [expenses]);

  async function deleteExpense(id: string) {
    try {
      await api(`/api/expenses/${id}`, { method: "DELETE" });
      router.refresh();
    } catch {}
  }

  return (
    <div className="mx-auto max-w-6xl px-4 pb-24 pt-5 sm:px-6">
      {/* ------------------------------------------------------- header row */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 animate-fade-up">
        <div>
          <h1 className="font-display text-3xl tracking-tight">Expenses & budget</h1>
          <p className="mt-0.5 text-[13px] text-ink-3">
            Rates {ratesSource === "live" ? "live" : "cached"} · updated{" "}
            {new Date(ratesUpdatedAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "numeric" })}
          </p>
        </div>
        <Button onClick={() => setAddOpen(true)}>
          <Plus size={15} /> Add expense
        </Button>
      </div>

      {/* ------------------------------------------------------ stat cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Trip budget"
          value={trip.budgetAmount}
          currency={trip.homeCurrency}
        />
        <StatCard label="Spent so far" value={totalSpent} currency={trip.homeCurrency} accent />
        <StatCard
          label={remaining >= 0 ? "Remaining" : "Over budget"}
          value={Math.abs(remaining)}
          currency={trip.homeCurrency}
          tone={remaining >= 0 ? "success" : "danger"}
          suffix={
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-2">
              <div
                className={cn("h-full rounded-full transition-all duration-700", budgetPct >= 100 ? "bg-danger" : "bg-gradient-to-r from-accent to-sky")}
                style={{ width: `${budgetPct}%` }}
              />
            </div>
          }
        />
      </div>

      {/* --------------------------------------------------------- insights */}
      {insights.length > 0 && (
        <Card className="animate-fade-up mt-4 border-accent/30 p-4">
          <div className="space-y-2">{insights}</div>
        </Card>
      )}

      {/* ----------------------------------------------------------- charts */}
      <div className="mt-4 grid gap-4 lg:grid-cols-5">
        <Card className="animate-fade-up lg:col-span-3">
          <CardHeader title="Spending over time" subtitle={`Cumulative · ${trip.homeCurrency}`} />
          <div className="px-3 pb-4 pt-2">
            {timeSeries.length > 1 ? (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={timeSeries} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                  <defs>
                    <linearGradient id="spendFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: "var(--ink-3)" }} axisLine={false} tickLine={false} />
                  <YAxis
                    tick={{ fontSize: 10, fill: "var(--ink-3)" }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v: number) =>
                      v >= 1000 ? `${Math.round(v / 1000)}k` : String(v)
                    }
                  />
                  <Tooltip
                    contentStyle={{
                      background: "var(--surface)",
                      border: "1px solid var(--border)",
                      borderRadius: 12,
                      fontSize: 12,
                    }}
                    formatter={(value) => fmtMoney(Number(value ?? 0), trip.homeCurrency)}
                  />
                  <Area
                    type="monotone"
                    dataKey="cumulative"
                    stroke="var(--accent)"
                    strokeWidth={2.5}
                    fill="url(#spendFill)"
                    animationDuration={900}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <p className="py-16 text-center text-sm text-ink-3">
                Add expenses on 2+ days to see the trend.
              </p>
            )}
          </div>
        </Card>

        <Card className="animate-fade-up lg:col-span-2">
          <CardHeader title="By category" subtitle={`${categoryData.length} categories`} />
          <div className="grid grid-cols-[auto_1fr] items-center gap-3 px-4 pb-5 pt-2">
            {categoryData.length > 0 ? (
              <>
                <ResponsiveContainer width={150} height={150}>
                  <PieChart>
                    <Pie
                      data={categoryData}
                      dataKey="value"
                      innerRadius={44}
                      outerRadius={70}
                      paddingAngle={3}
                      strokeWidth={0}
                      animationDuration={800}
                    >
                      {categoryData.map((c) => (
                        <Cell key={c.name} fill={c.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        background: "var(--surface)",
                        border: "1px solid var(--border)",
                        borderRadius: 12,
                        fontSize: 12,
                      }}
                      formatter={(value) => fmtMoney(Number(value ?? 0), trip.homeCurrency)}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <ul className="space-y-1.5 text-xs">
                  {categoryData.slice(0, 6).map((c) => (
                    <li key={c.name} className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full shrink-0" style={{ background: c.color }} />
                      <span className="flex-1 truncate text-ink-2">{c.name}</span>
                      <span className="tabular font-semibold">{fmtMoney(c.value, trip.homeCurrency)}</span>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="col-span-2 py-16 text-center text-sm text-ink-3">No expenses yet.</p>
            )}
          </div>
        </Card>
      </div>

      {/* ----------------------------------------------------- expense list */}
      <Card className="animate-fade-up mt-4 overflow-hidden">
        <CardHeader
          title="All expenses"
          subtitle={`${expenses.length} logged`}
        />
        {grouped.length === 0 ? (
          <EmptyState
            emoji="🧾"
            title="Nothing logged yet"
            description="Add your first expense — foreign currencies convert automatically."
            action={<Button onClick={() => setAddOpen(true)}><Plus size={15} /> Add expense</Button>}
          />
        ) : (
          <div className="divide-y divide-line pb-2">
            {grouped.map(([date, list]) => {
              const dayTotal = list.reduce((s, e) => s + e.amountHome, 0);
              return (
                <div key={date}>
                  <div className="sticky top-14 z-10 flex items-center justify-between bg-surface/90 px-5 py-1.5 backdrop-blur">
                    <p className="text-[11px] font-semibold text-ink-3">
                      {new Date(date + "T12:00").toLocaleDateString("en-US", {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                      })}
                    </p>
                    <p className="tabular text-[11px] font-semibold text-ink-3">
                      {fmtMoney(Math.round(dayTotal), trip.homeCurrency)}
                    </p>
                  </div>
                  {list.map((e) => {
                    const meta = EXPENSE_CATEGORY_META[e.category as ExpenseCategory];
                    return (
                      <div key={e.id} className="group flex items-center gap-3 px-5 py-2.5 transition-colors hover:bg-surface-2/60">
                        <span
                          className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-base"
                          style={{ background: `${meta?.color ?? "#94A3B8"}22` }}
                        >
                          {categoryIcon(e.category)}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13.5px] font-medium leading-snug">{e.merchant}</p>
                          <p className="text-xs text-ink-3">
                            {meta?.label ?? e.category}
                            {e.locationName ? ` · ${e.locationName}` : ""}
                            {" · "}
                            {e.paymentMethod.toLowerCase()}
                            {e.aiCategorized ? " · auto-categorized" : ""}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="tabular text-[13.5px] font-semibold">
                            {fmtMoney(e.amount, e.currency)}
                          </p>
                          {e.currency !== trip.homeCurrency && (
                            <p className="tabular text-[11px] text-ink-3">
                              ≈ {fmtMoney(e.amountHome, trip.homeCurrency)}
                            </p>
                          )}
                        </div>
                        <div className="ml-1 flex opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                          <button
                            onClick={() => setEditing(e)}
                            className="rounded-lg p-1.5 text-ink-3 hover:bg-surface-2 hover:text-ink"
                            aria-label={`Edit ${e.merchant}`}
                          >
                            <Pencil size={13} />
                          </button>
                          <button
                            onClick={() => deleteExpense(e.id)}
                            className="rounded-lg p-1.5 text-ink-3 hover:bg-danger/10 hover:text-danger"
                            aria-label={`Delete ${e.merchant}`}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <AddExpenseModal open={addOpen} onClose={() => setAddOpen(false)} bundle={bundle} rates={rates} onSaved={() => router.refresh()} />
      <EditExpenseModal expense={editing} onClose={() => setEditing(null)} rates={rates} homeCurrency={trip.homeCurrency} onSaved={() => router.refresh()} />
    </div>
  );
}

/* ---------------------------------------------------------------- pieces */

function Insight({ children, tone, icon }: { children: React.ReactNode; tone: "warning" | "info" | "success"; icon?: React.ReactNode }) {
  return (
    <p
      className={cn(
        "flex items-start gap-2 rounded-xl px-3 py-2.5 text-[13px] leading-relaxed",
        tone === "warning" && "bg-warning/10 text-warning",
        tone === "info" && "bg-sky/10 text-sky",
        tone === "success" && "bg-success/10 text-success"
      )}
    >
      <span className="mt-0.5 shrink-0">{icon}</span>
      <span className="[&_strong]:font-bold">{children}</span>
    </p>
  );
}

function categoryIcon(category: string): React.ReactNode {
  switch (category) {
    case "FOOD": return <UtensilsCrossed size={16} className="text-amber" />;
    case "TRANSPORT": return <Train size={16} className="text-sky" />;
    case "HOTEL": return <BedDouble size={16} className="text-violet" />;
    case "FLIGHT": return <Plane size={16} className="text-emerald-500" />;
    case "ACTIVITY": return <Ticket size={16} className="text-rose-500" />;
    case "SHOPPING": return <ShoppingBag size={16} className="text-fuchsia-500" />;
    case "ENTERTAINMENT": return <Film size={16} className="text-amber-500" />;
    default: return <Receipt size={16} className="text-ink-3" />;
  }
}

function StatCard({
  label,
  value,
  currency,
  tone,
  accent,
  suffix,
}: {
  label: string;
  value: number;
  currency: string;
  tone?: "success" | "danger";
  accent?: boolean;
  suffix?: React.ReactNode;
}) {
  return (
    <Card className="animate-fade-up p-5">
      <p className="text-[11px] font-semibold text-ink-3">{label}</p>
      <p
        className={cn(
          "tabular mt-1.5 text-[26px] font-bold tracking-tight",
          accent && "text-gradient",
          tone === "danger" && "text-danger",
          tone === "success" && "text-success"
        )}
      >
        <AnimatedNumber value={value} format={(v) => fmtMoney(v, currency)} />
      </p>
      {suffix}
    </Card>
  );
}

function AddExpenseModal({
  open,
  onClose,
  bundle,
  rates,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  bundle: TripBundle;
  rates: Record<string, number>;
  onSaved: () => void;
}) {
  const trip = bundle.trip;
  const [tab, setTab] = useState<"manual" | "receipt">("manual");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("JPY");
  const [merchant, setMerchant] = useState("");
  const [category, setCategory] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("CARD");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // receipt scan state
  const fileRef = useRef<HTMLInputElement>(null);
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<{
    available: boolean;
    reason?: string;
    extracted?: { merchant: string; total: number; currency: string; date: string; category: string };
  } | null>(null);

  const converted =
    Number(amount) > 0 ? convertCurrency(Number(amount), currency, trip.homeCurrency, rates) : null;

  async function scan(file: File) {
    setScanning(true);
    setScanResult(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/trips/${trip.id}/receipt-scan`, { method: "POST", body: fd });
      const data = await res.json();
      setScanResult(data);
    } catch {
      setScanResult({ available: false, reason: "Upload failed." });
    } finally {
      setScanning(false);
    }
  }

  function reset() {
    setAmount("");
    setMerchant("");
    setCategory("");
    setScanResult(null);
    setError(null);
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await api(`/api/trips/${trip.id}/expenses`, {
        json: {
          amount: Number(amount),
          currency,
          merchant: merchant.trim(),
          category: category || undefined,
          paymentMethod,
        },
      });
      reset();
      onClose();
      onSaved();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function confirmScanned() {
    if (!scanResult?.extracted) return;
    const ex = scanResult.extracted;
    setSaving(true);
    try {
      await api(`/api/trips/${trip.id}/expenses`, {
        json: {
          amount: ex.total,
          currency: ex.currency,
          merchant: ex.merchant,
          category: ex.category,
          date: new Date(ex.date),
        },
      });
      reset();
      onClose();
      onSaved();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Add expense" wide>
      <div className="mb-4 flex gap-1 rounded-xl bg-surface-2 p-1">
        {(
          [
            ["manual", "Manual entry"],
            ["receipt", "📸 Scan receipt"],
          ] as const
        ).map(([t, label]) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "flex-1 rounded-lg px-3 py-1.5 text-[13px] font-medium transition-all",
              tab === t ? "border border-line bg-surface shadow-sm" : "text-ink-3 hover:text-ink"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "manual" ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Amount">
              <Input type="number" min={0} step="any" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="2500" />
            </Field>
            <Field label="Currency">
              <Select value={currency} onChange={(e) => setCurrency(e.target.value)}>
                {Object.keys(rates).map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </Select>
            </Field>
          </div>
          {converted != null && (
            <p className="-mt-1 text-right text-xs text-accent-strong">
              ≈ {fmtMoney(converted, trip.homeCurrency)} {trip.homeCurrency}
            </p>
          )}
          <Field label="Merchant / description" hint="Categories are detected automatically from the name">
            <Input value={merchant} onChange={(e) => setMerchant(e.target.value)} placeholder="Ichiran Ramen Shibuya" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Category (optional)">
              <Select value={category} onChange={(e) => setCategory(e.target.value)}>
                <option value="">Auto-detect</option>
                {EXPENSE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {EXPENSE_CATEGORY_META[c].emoji} {EXPENSE_CATEGORY_META[c].label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Payment method">
              <Select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
                {["CARD", "CASH", "EWALLET", "TRANSFER"].map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </Select>
            </Field>
          </div>
          {error && <p className="rounded-lg bg-danger/10 px-3 py-2 text-[13px] text-danger">{error}</p>}
          <Button onClick={save} loading={saving} disabled={!Number(amount) || !merchant.trim()} className="w-full">
            Save expense
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <button
            onClick={() => fileRef.current?.click()}
            disabled={scanning}
            className="flex w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-line-strong bg-surface-2/50 px-6 py-10 transition-colors hover:border-accent/50 hover:bg-accent-soft/20 disabled:opacity-60"
          >
            {scanning ? (
              <>
                <Spinner className="h-6 w-6 text-accent" />
                <span className="text-sm font-medium">Extracting…</span>
              </>
            ) : (
              <>
                <Camera size={26} className="text-ink-3" />
                <span className="text-sm font-medium">Upload or drop a receipt photo</span>
                <span className="text-xs text-ink-3">JPG/PNG · merchant, total and category get extracted</span>
              </>
            )}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) scan(f);
            }}
          />

          {scanResult && (
            <div className="rounded-xl border border-line p-4 animate-fade-up">
              {!scanResult.available ? (
                <p className="flex items-start gap-2 text-[13px] text-ink-2">
                  <ScanLine size={15} className="mt-0.5 shrink-0 text-ink-3" />
                  {scanResult.reason}
                </p>
              ) : scanResult.extracted && (
                <>
                  <Badge tone="accent" className="mb-2">Found an expense — review before saving</Badge>
                  <div className="space-y-1.5 text-[13px]">
                    <p><strong>{scanResult.extracted.merchant}</strong></p>
                    <p className="tabular">
                      {fmtMoney(scanResult.extracted.total ?? 0, scanResult.extracted.currency)}
                      {rates[scanResult.extracted.currency] && rates[trip.homeCurrency] && scanResult.extracted.total
                        ? ` ≈ ${fmtMoney(convertCurrency(scanResult.extracted.total, scanResult.extracted.currency, trip.homeCurrency, rates), trip.homeCurrency)}`
                        : ""}
                    </p>
                    <p className="text-ink-3">{scanResult.extracted.date} · {scanResult.extracted.category.toLowerCase()}</p>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <Button onClick={confirmScanned} loading={saving} className="flex-1">Add expense</Button>
                    <Button variant="secondary" onClick={() => setScanResult(null)}>Discard</Button>
                  </div>
                </>
              )}
            </div>
          )}

          {tab === "receipt" && (
            <p className="text-center text-xs text-ink-3">
              Nothing is saved until you tap “Add expense” — always review first.
            </p>
          )}
        </div>
      )}
    </Modal>
  );
}

function EditExpenseModal({
  expense,
  onClose,
  rates,
  homeCurrency,
  onSaved,
}: {
  expense: Expense | null;
  onClose: () => void;
  rates: Record<string, number>;
  homeCurrency: string;
  onSaved: () => void;
}) {
  const [amount, setAmount] = useState("0");
  const [currency, setCurrency] = useState("JPY");
  const [merchant, setMerchant] = useState("");
  const [category, setCategory] = useState("");
  const [initializedFor, setInitializedFor] = useState<string | null>(null);

  if (expense && initializedFor !== expense.id) {
    setInitializedFor(expense.id);
    setAmount(String(expense.amount));
    setCurrency(expense.currency);
    setMerchant(expense.merchant);
    setCategory(expense.category);
  }

  const [saving, setSaving] = useState(false);

  async function save() {
    if (!expense) return;
    setSaving(true);
    try {
      await api(`/api/expenses/${expense.id}`, {
        method: "PATCH",
        json: { amount: Number(amount), currency, merchant, category },
      });
      onClose();
      onSaved();
    } catch {} finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!expense) return;
    setSaving(true);
    await api(`/api/expenses/${expense.id}`, { method: "DELETE" }).catch(() => {});
    setSaving(false);
    onClose();
    onSaved();
  }

  return (
    <Modal open={!!expense} onClose={onClose} title="Edit expense">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Amount">
            <Input type="number" min={0} step="any" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </Field>
          <Field label="Currency">
            <Select value={currency} onChange={(e) => setCurrency(e.target.value)}>
              {Object.keys(rates).map((c) => (
                <option key={c}>{c}</option>
              ))}
            </Select>
          </Field>
        </div>
        {Number(amount) > 0 && (
          <p className="-mt-1 text-right text-xs text-accent-strong">
            ≈ {fmtMoney(convertCurrency(Number(amount), currency, homeCurrency, rates), homeCurrency)}
          </p>
        )}
        <Field label="Merchant">
          <Input value={merchant} onChange={(e) => setMerchant(e.target.value)} />
        </Field>
        <Field label="Category">
          <Select value={category} onChange={(e) => setCategory(e.target.value)}>
            {EXPENSE_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {EXPENSE_CATEGORY_META[c].emoji} {EXPENSE_CATEGORY_META[c].label}
              </option>
            ))}
          </Select>
        </Field>
        <div className="flex gap-2">
          <Button onClick={save} loading={saving} className="flex-1">Save</Button>
          <Button variant="danger" onClick={remove}><Trash2 size={15} /></Button>
        </div>
      </div>
    </Modal>
  );
}
