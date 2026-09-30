import { useEffect, useRef } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { daysUntil, fmtDay, GUTTER, space, useTheme } from "@/shared/theme";
import { useTransition } from "@/lib/motion";
import { Skeleton } from "@/components/ui/Primitives";
import { dayKey, localKey, tripPhase, todayDayIndex } from "@/shared/trip";
import type { TripBundle } from "@/shared/types";
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
          // Out of the trip, whichever tab is showing: back() would only step to the previous tab.
          onPress={() => router.dismissTo("/trips")}
          accessibilityRole="button"
          accessibilityLabel="All trips"
          hitSlop={10}
          style={({ pressed }) => ({ height: 44, flexDirection: "row", alignItems: "center", marginLeft: -6, opacity: pressed ? 0.5 : 1 })}
        >
          <Ionicons name="chevron-back" size={22} color={colors.ink} />
          <T v="meta">Trips</T>
        </Pressable>
        <Pressable
          onPress={() => router.push(`/trips/${trip.id}/details`)}
          accessibilityRole="button"
          accessibilityLabel="Trip details, bookings and documents"
          hitSlop={10}
          style={({ pressed }) => ({ height: 44, flexDirection: "row", alignItems: "center", gap: 4, opacity: pressed ? 0.5 : 1 })}
        >
          <T v="meta">Trip</T>
          <Ionicons name="ellipsis-horizontal" size={18} color={colors.ink} />
        </Pressable>
      </View>
      <View style={{ paddingTop: 2, paddingBottom: 10 }}>
        <T v="title" numberOfLines={1} accessibilityRole="header">
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

/** A trip while it opens: the way back out, and the shape of the page to come. */
export function TripSkeleton() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, paddingTop: insets.top, backgroundColor: colors.paper }}>
      <View style={{ height: 44, paddingHorizontal: GUTTER, flexDirection: "row", alignItems: "center" }}>
        <Pressable
          onPress={() => router.dismissTo("/trips")}
          accessibilityRole="button"
          accessibilityLabel="All trips"
          hitSlop={10}
          style={({ pressed }) => ({ height: 44, flexDirection: "row", alignItems: "center", marginLeft: -6, opacity: pressed ? 0.5 : 1 })}
        >
          <Ionicons name="chevron-back" size={22} color={colors.ink} />
          <T v="meta">Trips</T>
        </Pressable>
      </View>
      <View accessible accessibilityLabel="Opening your trip" accessibilityState={{ busy: true }} style={{ flex: 1 }}>
        <View style={{ paddingHorizontal: GUTTER, paddingTop: 6, paddingBottom: 14, gap: 8 }}>
          <Skeleton width="62%" height={28} />
          <Skeleton width="78%" height={13} />
        </View>
        <View style={{ flexDirection: "row", gap: 2 * CELL_GAP, paddingHorizontal: STRIP_PAD + CELL_GAP, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.rule, overflow: "hidden" }}>
          {Array.from({ length: 7 }, (_, i) => (
            <Skeleton key={i} width={CELL} height={46} />
          ))}
        </View>
        <View style={{ paddingHorizontal: GUTTER, paddingTop: space.xl, gap: 10 }}>
          <Skeleton width="46%" height={12} />
          <Skeleton width="58%" height={30} />
          <Skeleton width="70%" height={12} />
          <View style={{ height: 1, marginVertical: space.md, backgroundColor: colors.rule }} />
          {(["68%", "52%", "74%", "60%"] as const).map((w) => (
            <View key={w} style={{ flexDirection: "row", gap: 14, paddingVertical: space.md }}>
              <Skeleton width={44} height={14} />
              <View style={{ flex: 1, gap: 8 }}>
                <Skeleton width={w} height={18} />
                <Skeleton width="40%" height={12} />
              </View>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

// Day cells are a fixed width, so the underline's place is arithmetic.
const STRIP_PAD = GUTTER - 8;
const CELL = 52;
const CELL_GAP = 2;
const UNDERLINE = 32;

/**
 * The day selector, shared by Plan and Map (selection lives in the trip
 * context, so switching tabs keeps the day). One underline glides to the
 * chosen day rather than jumping.
 */
export function DayStrip({ bundle, value, onChange }: { bundle: TripBundle; value: number; onChange: (i: number) => void }) {
  const { colors } = useTheme();
  const scroller = useRef<ScrollView>(null);
  const offsets = useRef<number[]>([]);
  const todayKey = localKey(new Date());
  const glide = useTransition("transform");
  const underlineX = STRIP_PAD + value * (CELL + 2 * CELL_GAP) + CELL_GAP + (CELL - UNDERLINE) / 2;

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
        contentContainerStyle={{ paddingHorizontal: STRIP_PAD }}
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
              aria-selected={on}
              accessibilityLabel={`Day ${i + 1}, ${fmtDay(d.date, { weekday: "long", month: "long", day: "numeric" })}${isToday ? ", today" : ""}`}
              style={{ width: CELL, alignItems: "center", paddingTop: 6, paddingBottom: 8, marginHorizontal: CELL_GAP }}
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
            </Pressable>
          );
        })}
        <Animated.View
          pointerEvents="none"
          style={[
            { position: "absolute", left: 0, bottom: 0, width: UNDERLINE, height: 2, backgroundColor: colors.accent, transform: [{ translateX: underlineX }] },
            glide,
          ]}
        />
      </ScrollView>
    </View>
  );
}
