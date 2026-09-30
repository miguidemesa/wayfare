import { useMemo } from "react";
import { Pressable, RefreshControl, ScrollView, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { fmtDate, fmtMoney, GUTTER, motion, space, useTheme } from "@/shared/theme";
import { byCategory, categoryLabel, dailyAllowance, dayKey, groupByDay, localKey, spentOn, totalSpent, tripPhase } from "@/shared/trip";
import { useLoadedTrip } from "@/lib/trip";
import { Empty, Meter, SectionLabel } from "@/components/ui/Primitives";
import { SpineItem } from "@/components/ui/Spine";
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
            <Meter
              value={pct}
              color={barColor}
              track={colors.rule}
              style={{ marginTop: space.md }}
              accessibilityLabel={`${Math.round(pct * 100)} percent of budget used`}
            />
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
            body="Log what you spend as you go, in any currency. Totals convert to your home currency automatically."
            action="Log an expense"
            onAction={() => router.push(`/trips/${tripId}/add-expense`)}
          />
        </View>
      ) : (
        <>
          <View style={{ paddingHorizontal: GUTTER, marginTop: space.xl }}>
            <SectionLabel>Where it went</SectionLabel>
            {cats.map(([cat, amount], i) => (
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
                {/* Scaled to the biggest category, so the bars compare with each other. */}
                <Meter value={amount / Math.max(cats[0][1], 1)} color={colors.ink2} height={2} delay={80 + i * motion.stagger} style={{ marginTop: 6 }} />
              </View>
            ))}
          </View>

          <View style={{ marginTop: space.xl }}>
            {groups.map((g) => {
              const n = dayNumber.get(g.key);
              return (
                // Each day of spending hangs from the same line as the plan.
                <View key={g.key}>
                  <SpineItem
                    mark={g.key === today ? "now" : "day"}
                    label={[g.key === today ? "Today" : fmtDate(g.key + "T12:00:00", { weekday: "short", month: "short", day: "numeric" }), n ? `Day ${n}` : null]
                      .filter(Boolean)
                      .join(" · ")}
                    labelColor={g.key === today ? "accent" : "ink3"}
                    right={
                      <T v="meta" c="ink2" num>
                        {fmtMoney(Math.round(g.total), home)}
                      </T>
                    }
                    style={{ paddingBottom: space.xs }}
                  />
                  {g.items.map((e) => (
                    <SpineItem
                      key={e.id}
                      onPress={() => router.push({ pathname: "/trips/[tripId]/add-expense", params: { tripId, expenseId: e.id } })}
                      accessibilityLabel={`${e.merchant}, ${fmtMoney(e.amount, e.currency)}`}
                      accessibilityHint="Opens it to edit or delete"
                      padTop={10}
                      style={{ paddingBottom: 10 }}
                      right={
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
                      }
                    >
                      <T v="bodyStrong" numberOfLines={1}>
                        {e.merchant}
                      </T>
                      <T v="small" c="ink3" numberOfLines={1}>
                        {[categoryLabel(e.category), e.paymentMethod === "CASH" ? "Cash" : e.paymentMethod ? "Card" : null, e.description].filter(Boolean).join(" · ")}
                      </T>
                    </SpineItem>
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
