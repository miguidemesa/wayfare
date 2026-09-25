import { View } from "react-native";
import { Image } from "expo-image";
import { fmtDate, fmtDay, fmtDistance, fmtMoney, GUTTER, radii, space, useTheme } from "@/shared/theme";
import { byCategory, categoryLabel, groupByDay, routeKm, totalSpent, tripPhase } from "@/shared/trip";
import { destinationPhoto } from "@/shared/images";
import { useTrip } from "@/lib/trip";
import { SubScreen } from "@/components/trip/SubScreen";
import { Rule } from "@/components/ui/Primitives";
import { T } from "@/components/ui/T";

export { ErrorFallback as ErrorBoundary } from "@/components/ErrorFallback";

// The trip in numbers — every figure here is counted from what you logged,
// nothing estimated.
export default function Recap() {
  const { colors } = useTheme();
  const { bundle } = useTrip();
  if (!bundle) return <SubScreen title="Recap">{null}</SubScreen>;

  const { trip, days, expenses, journal, destinations, flights } = bundle;
  const home = trip.homeCurrency;
  const phase = tripPhase(trip.startDate, trip.endDate);
  const stops = days.reduce((s, d) => s + d.items.length, 0);
  const booked = days.reduce((s, d) => s + d.items.filter((i) => i.confirmed).length, 0);
  const km = days.reduce((s, d) => s + routeKm(d.items), 0);
  const spent = totalSpent(expenses);
  const cats = byCategory(expenses);
  const byDay = groupByDay(expenses);
  const biggest = byDay.reduce<(typeof byDay)[number] | null>((m, g) => (!m || g.total > m.total ? g : m), null);
  const meal = expenses.filter((e) => e.category === "FOOD").sort((a, b) => b.amountHome - a.amountHome)[0];
  const img = destinationPhoto(destinations[0]?.name || trip.title);

  const figures: [string, string][] = [
    [String(days.length), days.length === 1 ? "day" : "days"],
    [String(stops), stops === 1 ? "stop planned" : "stops planned"],
    [String(destinations.length), destinations.length === 1 ? "city" : "cities"],
    ...(km > 0 ? ([[`~${fmtDistance(km)}`, "between stops, as the crow flies"]] as [string, string][]) : []),
    ...(flights.length ? ([[String(flights.length), flights.length === 1 ? "flight" : "flights"]] as [string, string][]) : []),
    ...(journal.length ? ([[String(journal.length), journal.length === 1 ? "journal entry" : "journal entries"]] as [string, string][]) : []),
  ];

  return (
    <SubScreen title="Recap" intro={phase === "after" ? "How it went." : "This fills in as you travel — here's the story so far."}>
      <View style={{ paddingHorizontal: GUTTER }}>
        {img ? <Image source={{ uri: img.hero }} style={{ width: "100%", aspectRatio: 3 / 2, borderRadius: radii.sm, backgroundColor: colors.sunk }} contentFit="cover" transition={200} cachePolicy="memory-disk" /> : null}
        <T v="display" style={{ marginTop: img ? space.lg : 0 }}>
          {trip.title}
        </T>
        <T v="aside" c="ink2" style={{ marginTop: 4 }}>
          {destinations.map((d) => d.name).join(", ")} · {fmtDay(trip.startDate, { month: "long", day: "numeric" })} – {fmtDay(trip.endDate, { month: "long", day: "numeric", year: "numeric" })}
        </T>

        <View style={{ flexDirection: "row", flexWrap: "wrap", marginTop: space.xl, borderTopWidth: 1, borderTopColor: colors.rule }}>
          {figures.map(([n, label]) => (
            <View key={label} style={{ width: "50%", paddingVertical: space.lg, borderBottomWidth: 1, borderBottomColor: colors.rule }}>
              <T v="title" num>
                {n}
              </T>
              <T v="small" c="ink3">
                {label}
              </T>
            </View>
          ))}
        </View>

        <T v="label" c="ink3" style={{ marginTop: space.xxl }}>
          Money
        </T>
        <T v="figure" num style={{ marginTop: 4 }}>
          {fmtMoney(Math.round(spent), home)}
        </T>
        <T v="meta" c="ink2" num>
          {trip.budgetAmount > 0 ? `${Math.round((spent / trip.budgetAmount) * 100)}% of a ${fmtMoney(trip.budgetAmount, home)} budget` : `${expenses.length} expenses logged`}
        </T>
        <Rule style={{ marginTop: space.lg }} />
        {cats[0] ? <Line label="Most went on" value={`${categoryLabel(cats[0][0])} · ${fmtMoney(Math.round(cats[0][1]), home)}`} /> : null}
        {biggest ? <Line label="Biggest day" value={`${fmtDate(biggest.key + "T12:00:00", { weekday: "short", month: "short", day: "numeric" })} · ${fmtMoney(Math.round(biggest.total), home)}`} /> : null}
        {meal ? <Line label="Most expensive meal" value={`${meal.merchant} · ${fmtMoney(meal.amount, meal.currency)}`} /> : null}
        {stops ? <Line label="Booked ahead" value={`${booked} of ${stops} stops`} /> : null}
        {!expenses.length && !stops ? (
          <T v="body" c="ink2" style={{ marginTop: space.lg }}>
            Nothing to count yet. Plan some days and log what you spend, and this page tells the story.
          </T>
        ) : null}
      </View>
    </SubScreen>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ paddingVertical: space.md, borderBottomWidth: 1, borderBottomColor: colors.rule }}>
      <T v="small" c="ink3">
        {label}
      </T>
      <T v="bodyStrong" num style={{ marginTop: 2 }}>
        {value}
      </T>
    </View>
  );
}
