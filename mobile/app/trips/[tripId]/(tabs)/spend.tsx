import { useMemo } from "react";
import { Pressable, RefreshControl, ScrollView, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { fmtDate, fmtMoney, GUTTER, space, useTheme } from "@/shared/theme";
import { byCategory, categoryLabel, dailyAllowance, dayKey, groupByDay, localKey, spentOn, totalSpent, tripPhase } from "@/shared/trip";
import { useLoadedTrip } from "@/lib/trip";
import { Empty, Rule, SectionLabel } from "@/components/ui/Primitives";
import { T } from "@/components/ui/T";

export default function SpendScreen() {
  const { colors } = useTheme();
  const { tripId, bundle, reload, refreshing } = useLoadedTrip();
  const { trip, expenses, days } = bundle;
  const home = trip.homeCurrency;

  const total = totalSpent(expenses);
  const budget = trip.budgetAmount;
  const left = budget - total;
  const pct = budget > 0 ? total / budget : 0;
  const phase = tripPhase(trip.startDate, trip.endDate);
  const allowance = dailyAllowance({ budget, spent: total, startIso: trip.startDate, endIso: trip.endDate });
  const today = localKey(new Date());
  const groups = useMemo(() => groupByDay(expenses), [expenses]);
  const cats = useMemo(() => byCategory(expenses), [expenses]);
  const dayNumber = useMemo(() => new Map(days.map((d, i) => [dayKey(d.date), i + 1])), [days]);

  const barColor = pct > 1 ? colors.danger : pct > 0.85 ? colors.caution : colors.ink;

  // Two figures that answer "how am I doing" for the stage the trip is in.
  const side: [string, string][] =
    phase === "during"
      ? [
          ["Today", fmtMoney(Math.round(spentOn(expenses, today)), home)],
          ["Per day to stay on budget", allowance != null ? fmtMoney(Math.round(allowance), home) : "—"],
        ]
      : phase === "before"
        ? [
            ["Paid before you go", fmtMoney(Math.round(total), home)],
            ["Per day, once there", allowance != null ? fmtMoney(Math.round(allowance), home) : "—"],
          ]
        : [
            ["Per day, on average", fmtMoney(Math.round(total / Math.max(1, days.length)), home)],
            ["Biggest day", groups.length ? fmtMoney(Math.round(Math.max(...groups.map((g) => g.total))), home) : "—"],
          ];

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ paddingBottom: space.xxxl }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void reload()} tintColor={colors.ink3} />}
    >
      <View style={{ paddingHorizontal: GUTTER, paddingTop: space.xl }}>
        <T v="label" c="ink3">
          Spent so far
        </T>
        <T v="figure" num style={{ marginTop: 4 }} accessibilityLabel={`Spent ${fmtMoney(Math.round(total), home)}`}>
          {fmtMoney(Math.round(total), home)}
        </T>
        {budget > 0 ? (
          <>
            <T v="meta" c={left < 0 ? "danger" : "ink2"} num style={{ marginTop: 2 }}>
              {left < 0 ? `${fmtMoney(Math.round(-left), home)} over a ${fmtMoney(budget, home)} budget` : `${fmtMoney(Math.round(left), home)} left of ${fmtMoney(budget, home)}`}
            </T>
            <View style={{ height: 3, backgroundColor: colors.rule, marginTop: space.md, borderRadius: 2, overflow: "hidden" }} accessibilityLabel={`${Math.round(pct * 100)} percent of budget used`}>
              <View style={{ width: `${Math.min(100, pct * 100)}%`, height: 3, backgroundColor: barColor }} />
            </View>
          </>
        ) : (
          <T v="meta" c="ink3" style={{ marginTop: 2 }}>
            No budget set for this trip
          </T>
        )}

        <View style={{ flexDirection: "row", marginTop: space.xl, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.rule }}>
          {side.map(([label, value], i) => (
            <View key={label} style={{ flex: 1, paddingVertical: space.md, paddingLeft: i === 0 ? 0 : space.lg, borderLeftWidth: i === 0 ? 0 : 1, borderLeftColor: colors.rule }}>
              <T v="small" c="ink3">
                {label}
              </T>
              <T v="heading" num style={{ marginTop: 2 }}>
                {value}
              </T>
            </View>
          ))}
        </View>
      </View>

      {expenses.length === 0 ? (
        <View style={{ paddingHorizontal: GUTTER }}>
          <Empty
            title="Nothing logged yet"
            body="Log what you spend as you go — in any currency. Totals convert to your home currency automatically."
            action="Log an expense"
            onAction={() => router.push(`/trips/${tripId}/add-expense`)}
          />
        </View>
      ) : (
        <>
          <View style={{ paddingHorizontal: GUTTER, marginTop: space.xl }}>
            <SectionLabel>Where it went</SectionLabel>
            {cats.map(([cat, amount]) => (
              <View key={cat} style={{ paddingVertical: 7 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <T v="meta">{categoryLabel(cat)}</T>
                  <T v="meta" num>
                    {fmtMoney(Math.round(amount), home)}
                    <T v="meta" c="ink3" num>
                      {"  "}
                      {Math.round((amount / Math.max(total, 1)) * 100)}%
                    </T>
                  </T>
                </View>
                <View style={{ height: 2, backgroundColor: colors.rule, marginTop: 6 }}>
                  <View style={{ width: `${(amount / Math.max(cats[0][1], 1)) * 100}%`, height: 2, backgroundColor: colors.ink2 }} />
                </View>
              </View>
            ))}
          </View>

          <View style={{ marginTop: space.xl }}>
            {groups.map((g) => {
              const n = dayNumber.get(g.key);
              return (
                <View key={g.key} style={{ marginBottom: space.md }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", paddingHorizontal: GUTTER, paddingVertical: space.sm }}>
                    <T v="entry">
                      {g.key === today ? "Today" : fmtDate(g.key + "T12:00:00", { weekday: "short", month: "short", day: "numeric" })}
                      {n ? (
                        <T v="aside" c="ink3">
                          {"  "}Day {n}
                        </T>
                      ) : null}
                    </T>
                    <T v="meta" c="ink2" num>
                      {fmtMoney(Math.round(g.total), home)}
                    </T>
                  </View>
                  <Rule style={{ marginHorizontal: GUTTER }} />
                  {g.items.map((e) => (
                    <Pressable
                      key={e.id}
                      onPress={() => router.push({ pathname: "/trips/[tripId]/add-expense", params: { tripId, expenseId: e.id } })}
                      accessibilityRole="button"
                      accessibilityLabel={`${e.merchant}, ${fmtMoney(e.amount, e.currency)}`}
                      accessibilityHint="Opens it to edit or delete"
                      style={({ pressed }) => ({ flexDirection: "row", paddingHorizontal: GUTTER, paddingVertical: 11, gap: 12, backgroundColor: pressed ? colors.sunk : "transparent" })}
                    >
                      <View style={{ flex: 1 }}>
                        <T v="bodyStrong" numberOfLines={1}>
                          {e.merchant}
                        </T>
                        <T v="small" c="ink3" numberOfLines={1}>
                          {[categoryLabel(e.category), e.paymentMethod === "CASH" ? "Cash" : e.paymentMethod ? "Card" : null, e.description].filter(Boolean).join(" · ")}
                        </T>
                      </View>
                      <View style={{ alignItems: "flex-end" }}>
                        <T v="bodyStrong" num>
                          {fmtMoney(e.amount, e.currency)}
                        </T>
                        {e.currency !== home ? (
                          <T v="small" c="ink3" num>
                            {fmtMoney(Math.round(e.amountHome * 100) / 100, home)}
                          </T>
                        ) : null}
                      </View>
                    </Pressable>
                  ))}
                </View>
              );
            })}
          </View>
        </>
      )}

      <Pressable
        onPress={() => router.push(`/trips/${tripId}/currency`)}
        accessibilityRole="button"
        style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: GUTTER, paddingVertical: space.lg, opacity: pressed ? 0.5 : 1 })}
      >
        <Ionicons name="swap-horizontal-outline" size={18} color={colors.ink2} />
        <T v="meta" c="ink2">
          Currency converter
        </T>
      </Pressable>
    </ScrollView>
  );
}
