import { useEffect, useRef } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { daysUntil, fmtDay, GUTTER, useTheme } from "@/shared/theme";
import { dayKey, localKey, tripPhase, todayDayIndex } from "@/shared/trip";
import type { TripBundle } from "@/shared/types";
import { goBack } from "@/components/ui/Bars";
import { T } from "@/components/ui/T";

/** The trip masthead: where you are (which trip, which stage), how to leave. */
export function TripMasthead({ bundle }: { bundle: TripBundle }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { trip, destinations, days } = bundle;
  const phase = tripPhase(trip.startDate, trip.endDate);
  const place = destinations.map((d) => d.name).join(" · ") || trip.subtitle || "";
  const todayIdx = todayDayIndex(days);

  let status: string;
  if (phase === "before") {
    const n = daysUntil(trip.startDate);
    status = n === 1 ? "Tomorrow" : `In ${n} days`;
  } else if (phase === "during") {
    status = todayIdx != null ? `Day ${todayIdx + 1} of ${days.length}` : "Travelling";
  } else {
    status = "Finished";
  }

  return (
    <View style={{ paddingTop: insets.top, paddingHorizontal: GUTTER, backgroundColor: colors.paper }}>
      <View style={{ height: 44, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Pressable
          onPress={() => goBack("/trips")}
          accessibilityRole="button"
          accessibilityLabel="All trips"
          hitSlop={10}
          style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", marginLeft: -6, opacity: pressed ? 0.5 : 1 })}
        >
          <Ionicons name="chevron-back" size={22} color={colors.ink} />
          <T v="meta">Trips</T>
        </Pressable>
        <Pressable
          onPress={() => router.push(`/trips/${trip.id}/details`)}
          accessibilityRole="button"
          accessibilityLabel="Trip details, bookings and documents"
          hitSlop={10}
          style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 4, opacity: pressed ? 0.5 : 1 })}
        >
          <T v="meta">Trip</T>
          <Ionicons name="ellipsis-horizontal" size={18} color={colors.ink} />
        </Pressable>
      </View>
      <View style={{ paddingTop: 2, paddingBottom: 10 }}>
        <T v="title" numberOfLines={1}>
          {trip.title}
        </T>
        <T v="meta" c="ink2" num numberOfLines={1} style={{ marginTop: 2 }}>
          {place ? `${place} · ` : ""}
          {fmtDay(trip.startDate)} – {fmtDay(trip.endDate)} ·{" "}
          <T v="meta" c={phase === "during" ? "accent" : "ink2"}>
            {status}
          </T>
        </T>
      </View>
    </View>
  );
}

/**
 * The day selector, shared by Plan and Map (selection lives in the trip
 * context, so switching tabs keeps the day).
 */
export function DayStrip({ bundle, value, onChange }: { bundle: TripBundle; value: number; onChange: (i: number) => void }) {
  const { colors } = useTheme();
  const scroller = useRef<ScrollView>(null);
  const offsets = useRef<number[]>([]);
  const todayKey = localKey(new Date());

  useEffect(() => {
    const x = offsets.current[value];
    if (x != null) scroller.current?.scrollTo({ x: Math.max(0, x - GUTTER - 40), animated: true });
  }, [value]);

  if (bundle.days.length === 0) return null;

  return (
    <View style={{ borderBottomWidth: 1, borderBottomColor: colors.rule, backgroundColor: colors.paper }}>
      <ScrollView
        ref={scroller}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: GUTTER - 8 }}
        accessibilityRole="tablist"
      >
        {bundle.days.map((d, i) => {
          const on = i === value;
          const isToday = dayKey(d.date) === todayKey;
          return (
            <Pressable
              key={d.id}
              onLayout={(e) => (offsets.current[i] = e.nativeEvent.layout.x)}
              onPress={() => onChange(i)}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              accessibilityLabel={`Day ${i + 1}, ${fmtDay(d.date, { weekday: "long", month: "long", day: "numeric" })}${isToday ? ", today" : ""}`}
              style={{ width: 52, alignItems: "center", paddingTop: 6, paddingBottom: 8, marginHorizontal: 2 }}
            >
              <T v="label" c={on ? "ink" : "ink3"} style={{ fontSize: 10 }}>
                {fmtDay(d.date, { weekday: "short" })}
              </T>
              <T v="heading" num style={{ color: on ? colors.ink : colors.ink3, marginTop: 1 }}>
                {Number(dayKey(d.date).slice(8))}
              </T>
              <View style={{ height: 5, justifyContent: "center", marginTop: 2 }}>
                {isToday ? <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: colors.accent }} /> : null}
              </View>
              <View style={{ position: "absolute", bottom: -1, left: 10, right: 10, height: 2, backgroundColor: on ? colors.accent : "transparent" }} />
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}
