import { useEffect, useMemo, useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, TextInput, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { ApiError, addExpense, deleteExpense, updateExpense } from "@/shared/api";
import { fmtDate, fmtDay, fmtMoney, fonts, GUTTER, space, TABULAR_NUMS, useTheme } from "@/shared/theme";
import { convert, dayKey, EXPENSE_CATEGORIES, localCurrency, localKey } from "@/shared/trip";
import { SUPPORTED_CURRENCIES, type Expense } from "@/shared/types";
import { useLoadedTrip, useTrip } from "@/lib/trip";
import { confirmDestructive } from "@/lib/confirm";
import { SheetBar } from "@/components/ui/Bars";
import { Button } from "@/components/ui/Button";
import { Choices, Empty, Field, Loading } from "@/components/ui/Primitives";
import { T } from "@/components/ui/T";
import { useToast } from "@/components/ui/Toast";

export { ErrorFallback as ErrorBoundary } from "@/components/ErrorFallback";

// Logs a new expense, or edits one when opened with ?expenseId.
export default function AddExpense() {
  const { colors } = useTheme();
  const { bundle } = useTrip();
  const { expenseId } = useLocalSearchParams<{ expenseId?: string }>();
  if (!bundle) return <Loading />;
  if (!expenseId) return <ExpenseForm />;
  const existing = bundle.expenses.find((e) => e.id === expenseId);
  if (!existing) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.paper }}>
        <SheetBar title="Expense" cancelLabel="Close" />
        <View style={{ paddingHorizontal: GUTTER }}>
          <Empty title="This expense is gone" body="It may have been deleted." />
        </View>
      </View>
    );
  }
  return <ExpenseForm existing={existing} />;
}

function ExpenseForm({ existing }: { existing?: Expense }) {
  const { colors } = useTheme();
  const toast = useToast();
  const params = useLocalSearchParams<{ merchant?: string; category?: string; location?: string }>();
  const { tripId, bundle, reload, rates, ensureRates } = useLoadedTrip();
  const home = bundle.trip.homeCurrency;
  const local = localCurrency(bundle);

  const today = localKey(new Date());
  const initialDate = existing ? localKey(existing.date) : today;
  const [amount, setAmount] = useState(existing ? String(existing.amount) : "");
  const [currency, setCurrency] = useState(existing?.currency ?? local);
  const [showAll, setShowAll] = useState(false);
  const [merchant, setMerchant] = useState(existing?.merchant ?? params.merchant ?? "");
  const [category, setCategory] = useState<string | null>(existing?.category ?? (params.category || null));
  const [method, setMethod] = useState<"CARD" | "CASH">(existing?.paymentMethod === "CASH" ? "CASH" : "CARD");
  const [note, setNote] = useState(existing?.description ?? "");
  const [dateKey, setDateKey] = useState(initialDate);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const amountRef = useRef<TextInput>(null);

  useEffect(() => {
    void ensureRates();
  }, [ensureRates]);

  const value = Number(amount.replace(",", "."));
  const valid = Number.isFinite(value) && value > 0;
  const preview = valid && currency !== home && rates ? convert(value, currency, home, rates.rates) : null;

  const quick = Array.from(new Set([local, home, ...(existing ? [existing.currency] : [])]));
  const currencyOptions = (showAll ? Array.from(new Set([...quick, ...SUPPORTED_CURRENCIES])) : quick).map((c) => ({ key: c, label: c }));

  const dateOptions = useMemo(() => {
    const opts = [{ key: today, label: "Today" }];
    bundle.days.forEach((d, i) => {
      const k = dayKey(d.date);
      if (k !== today) opts.push({ key: k, label: `Day ${i + 1} · ${fmtDay(d.date, { month: "short", day: "numeric" })}` });
    });
    // An expense being edited may sit outside the trip's days.
    if (!opts.some((o) => o.key === initialDate)) opts.push({ key: initialDate, label: fmtDay(initialDate, { month: "short", day: "numeric" }) });
    return opts;
  }, [bundle.days, today, initialDate]);

  async function save() {
    const next: Record<string, string> = {};
    if (!valid) next.amount = "Enter an amount above zero.";
    if (!merchant.trim()) next.merchant = "What was it for? A place or a word is enough.";
    setErrors(next);
    if (Object.keys(next).length) {
      if (next.amount) amountRef.current?.focus();
      return;
    }
    setSaving(true);
    if (existing) return saveEdit(existing);
    try {
      await addExpense(tripId, {
        amount: value,
        currency,
        merchant: merchant.trim(),
        // Left empty, the server files it by what you typed.
        category: category ?? "",
        paymentMethod: method,
        date: new Date(`${dateKey}T12:00:00`).toISOString(),
        description: note.trim() || undefined,
        locationName: params.location || undefined,
      });
      toast(`Logged ${fmtMoney(value, currency)} · ${merchant.trim()}`);
      router.back();
      void reload();
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Couldn't save. Check your connection and try again.", "error");
    } finally {
      setSaving(false);
    }
  }

  async function saveEdit(e: Expense) {
    // Only what changed: re-sending the amount would re-convert it at today's
    // rate, and re-sending the date would move it to noon.
    const patch: Parameters<typeof updateExpense>[1] = {};
    if (value !== e.amount) patch.amount = value;
    if (currency !== e.currency) patch.currency = currency;
    if (merchant.trim() !== e.merchant) patch.merchant = merchant.trim();
    if (category && category !== e.category) patch.category = category;
    if (method !== (e.paymentMethod === "CASH" ? "CASH" : "CARD")) patch.paymentMethod = method;
    if (dateKey !== initialDate) patch.date = new Date(`${dateKey}T12:00:00`).toISOString();
    if ((note.trim() || null) !== (e.description || null)) patch.description = note.trim() || null;
    try {
      if (Object.keys(patch).length) await updateExpense(e.id, patch);
      toast("Expense updated");
      router.back();
      void reload();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "Couldn't save. Check your connection and try again.", "error");
    } finally {
      setSaving(false);
    }
  }

  function remove(e: Expense) {
    confirmDestructive({
      title: `Delete “${e.merchant}”?`,
      message: `${fmtMoney(e.amount, e.currency)} on ${fmtDate(e.date, { month: "long", day: "numeric" })}`,
      confirm: "Delete",
      onConfirm: async () => {
        try {
          await deleteExpense(e.id);
          toast("Expense deleted");
          router.back();
          void reload();
        } catch (err) {
          toast(err instanceof ApiError ? err.message : "Couldn't delete it", "error");
        }
      },
    });
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.paper }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <SheetBar title={existing ? "Edit expense" : "Log expense"} right={<Button variant="quiet" label={saving ? "Saving…" : "Save"} busy={saving} onPress={save} />} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: GUTTER, paddingBottom: space.xxxl, gap: space.xl }} keyboardShouldPersistTaps="handled">
        <View style={{ paddingTop: space.xl }}>
          <View style={{ flexDirection: "row", alignItems: "baseline", gap: 10 }}>
            <T v="heading" c="ink3">
              {currency}
            </T>
            <TextInput
              ref={amountRef}
              value={amount}
              onChangeText={(t) => setAmount(t.replace(/[^0-9.,]/g, ""))}
              placeholder="0"
              placeholderTextColor={colors.ink3}
              keyboardType="decimal-pad"
              autoFocus={!existing}
              selectionColor={colors.accent}
              accessibilityLabel={`Amount in ${currency}`}
              style={[{ flex: 1, fontFamily: fonts.serifMedium, fontSize: 52, lineHeight: 60, color: colors.ink, padding: 0 }, TABULAR_NUMS]}
            />
          </View>
          <View style={{ height: 1, backgroundColor: errors.amount ? colors.danger : colors.ruleStrong, marginTop: 4 }} />
          <T v="meta" c={errors.amount ? "danger" : "ink3"} num style={{ marginTop: 6, minHeight: 18 }}>
            {errors.amount ?? (preview != null ? `≈ ${fmtMoney(Math.round(preview * 100) / 100, home)}${rates?.source === "reference" ? " (reference rate)" : ""}` : " ")}
          </T>
        </View>

        <View style={{ gap: 8 }}>
          <Choices options={currencyOptions} value={currency} onChange={setCurrency} />
          {!showAll ? (
            <Pressable onPress={() => setShowAll(true)} accessibilityRole="button" hitSlop={8}>
              <T v="meta" c="accent">
                Other currency
              </T>
            </Pressable>
          ) : null}
        </View>

        <Field label="What for" value={merchant} onChangeText={setMerchant} placeholder="Ramen at Ichiran" error={errors.merchant} returnKeyType="done" />

        <View style={{ gap: 8 }}>
          <T v="label" c="ink3">
            Category
          </T>
          <Choices options={EXPENSE_CATEGORIES} value={category} onChange={(k) => setCategory(k === category ? null : k)} />
          <T v="small" c="ink3">
            {category ? " " : "Skip it and Wayfare files it from what you typed."}
          </T>
        </View>

        <View style={{ gap: 8 }}>
          <T v="label" c="ink3">
            Paid with
          </T>
          <Choices
            options={[
              { key: "CARD", label: "Card" },
              { key: "CASH", label: "Cash" },
            ]}
            value={method}
            onChange={setMethod}
          />
        </View>

        <View style={{ gap: 8 }}>
          <T v="label" c="ink3">
            When
          </T>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <Choices options={dateOptions} value={dateKey} onChange={setDateKey} wrap={false} />
          </ScrollView>
        </View>

        <Field label="Note" value={note} onChangeText={setNote} placeholder="Optional" />

        <Button variant="accent" size="lg" label={existing ? "Save changes" : "Save expense"} loading={saving} onPress={save} />
        {existing ? <Button variant="quiet" label="Delete expense" onPress={() => remove(existing)} style={{ alignSelf: "center" }} /> : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
