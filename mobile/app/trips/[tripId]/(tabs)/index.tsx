import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, RefreshControl, ScrollView, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Animated from "react-native-reanimated";
import { ApiError, layOutDays, MAX_TRIP_DAYS, optimizeDay, reorderDay } from "@/shared/api";
import { fmtClock, fmtDay, fmtDuration, fmtMoney, GUTTER, radii, space, useTheme } from "@/shared/theme";
import { enterFrom, reflow } from "@/lib/motion";
import { Press } from "@/components/ui/Press";
import { SpineItem, type Mark } from "@/components/ui/Spine";
import { dayKey, dayStats, localKey, missingDays, moveInArray, suggestedStartAfter, transportLabel, tripPhase } from "@/shared/trip";
import { openDirections } from "@/lib/directions";
import type { ItineraryDay, ItineraryItem } from "@/shared/types";
import { useLoadedTrip } from "@/lib/trip";
import { DayStrip } from "@/components/trip/TripChrome";
import { AlertCards } from "@/components/trip/AlertCards";
import { tripAlerts } from "@/shared/alerts";
import { dismissAlert, useDismissedAlerts, useNow } from "@/lib/alerts";
import { Button } from "@/components/ui/Button";
import { Empty, Rule } from "@/components/ui/Primitives";
import { T } from "@/components/ui/T";
import { useToast } from "@/components/ui/Toast";


export default function PlanScreen() {
  const { colors } = useTheme();
  const toast = useToast();
  const { tripId, bundle, reload, refreshing, update, dayIndex, setDayIndex } = useLoadedTrip();
  const scroller = useRef<ScrollView>(null);
  const [reordering, setReordering] = useState(false);
  const [draftOrder, setDraftOrder] = useState<ItineraryItem[] | null>(null);
  const [tidying, setTidying] = useState(false);
  const [layingOut, setLayingOut] = useState(false);
  const clock = useNow();
  const dismissed = useDismissedAlerts();
  const alerts = useMemo(() => tripAlerts(bundle, clock), [bundle, clock]);

  const day: ItineraryDay | undefined = bundle.days[dayIndex];

  // A new day's page comes in from the side it sits on in the strip. The
  // page the plan opens on just appears.
  const shownDay = useRef(dayIndex);
  const dayEnter = dayIndex === shownDay.current ? undefined : enterFrom(dayIndex > shownDay.current ? 1 : -1);

  // A new day starts at the top, out of reorder mode. (changeDay saves a
  // pending order before the day changes, so nothing is lost here.)
  useEffect(() => {
    shownDay.current = dayIndex;
    scroller.current?.scrollTo({ y: 0, animated: false });
    setReordering(false);
    setDraftOrder(null);
  }, [dayIndex]);

  async function handleLayOut() {
    setLayingOut(true);
    try {
      await layOutDays(tripId, dayKey(bundle.trip.startDate), dayKey(bundle.trip.endDate), bundle.days, bundle.destinations.map((d) => d.name));
      await reload();
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Couldn't set up the days. Try again.", "error");
    } finally {
      setLayingOut(false);
    }
  }

  if (!day) {
    return (
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: GUTTER }}>
        <Empty
          title="No days laid out yet"
          body="Set up a page for each day of the trip, then fill them in yourself or let Wayfare draft a plan."
          action={layingOut ? "Setting up…" : "Set up my days"}
          onAction={handleLayOut}
          actionBusy={layingOut}
          secondary="Draft a whole plan"
          onSecondary={() => router.push(`/trips/${tripId}/suggest`)}
        />
      </ScrollView>
    );
  }

  const items = draftOrder ?? day.items;
  // Day set-up is one request per date; if it was interrupted, say so rather
  // than leave holes in the strip.
  const missing = missingDays(bundle.trip, bundle.days, MAX_TRIP_DAYS);
  const stats = dayStats(day, bundle.trip.homeCurrency);
  const weather = bundle.weather.find((w) => dayKey(w.date) === dayKey(day.date) && (!day.city || w.city === day.city)) ?? bundle.weather.find((w) => dayKey(w.date) === dayKey(day.date));
  const phase = tripPhase(bundle.trip.startDate, bundle.trip.endDate);
  const packed = bundle.checklist.filter((c) => c.checked).length;
  const isToday = dayKey(day.date) === localKey(new Date());
  const now = clock;
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const currency = bundle.trip.homeCurrency;

  function openAdd(after?: ItineraryItem) {
    const start = suggestedStartAfter(after ?? day!.items[day!.items.length - 1]);
    router.push({ pathname: "/trips/[tripId]/add-stop", params: { tripId, dayId: day!.id, time: fmtClock(start) } });
  }

  async function handleTidy() {
    if (!day) return;
    setTidying(true);
    try {
      const res = await optimizeDay(tripId, dayKey(day.date), true);
      await reload();
      toast(res.timeSavedMin ? `Route tidied. About ${res.timeSavedMin} min less travel` : res.summary || "Route tidied");
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Couldn't tidy this day. Nothing was changed.", "error");
    } finally {
      setTidying(false);
    }
  }

  // Switching days mid-reorder saves the new order, as tapping Done would.
  async function changeDay(i: number) {
    if (i === dayIndex) return;
    if (reordering) await finishReorder();
    setDayIndex(i);
  }

  function startReorder() {
    setDraftOrder(day!.items.slice());
    setReordering(true);
  }

  async function finishReorder() {
    const order = draftOrder;
    setReordering(false);
    setDraftOrder(null);
    if (!order || !day) return;
    const changed = order.some((it, i) => it.id !== day.items[i]?.id);
    if (!changed) return;
    const dayId = day.id;
    update((b) => ({ ...b, days: b.days.map((d) => (d.id === dayId ? { ...d, items: order } : d)) }));
    try {
      await reorderDay(tripId, dayId, order.map((i) => i.id));
      toast("New order saved");
    } catch {
      toast("Couldn't save the new order", "error");
      void reload();
    }
  }

  // Where to draw the "now" line on today's page: before the first stop that
  // hasn't started yet.
  const nowBefore = isToday ? items.findIndex((it) => it.startTime != null && it.startTime > nowMin) : -1;
  const upNext = isToday ? (nowBefore >= 0 ? items[nowBefore] : null) : null;

  // Today, the line shows what's done, what's next and what's to come.
  function markFor(item: ItineraryItem, i: number): Mark {
    if (!isToday) return "stop";
    if (i === nowBefore) return "next";
    const end = item.endTime ?? (item.startTime != null ? item.startTime + item.durationMin : null);
    return end != null && end <= nowMin ? "done" : "stop";
  }

  return (
    <View style={{ flex: 1 }}>
      <DayStrip bundle={bundle} value={dayIndex} onChange={(i) => void changeDay(i)} />
      {missing > 0 ? (
        <Pressable
          onPress={handleLayOut}
          disabled={layingOut}
          accessibilityRole="button"
          aria-busy={layingOut}
          style={({ pressed }) => ({ paddingHorizontal: GUTTER, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.rule, backgroundColor: pressed ? colors.sunk : colors.raised })}
        >
          <T v="meta" c="ink2">
            {missing === 1 ? "1 day of the trip isn't set up yet. " : `${missing} days of the trip aren't set up yet. `}
            <T v="meta" c="accent">
              {layingOut ? "Setting up…" : "Set them up"}
            </T>
          </T>
        </Pressable>
      ) : null}
      <ScrollView
        ref={scroller}
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: space.xxxl }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void reload()} tintColor={colors.ink3} />}
      >
        <Animated.View key={day.id} entering={dayEnter}>
          {/* What needs attention now, whichever day is open */}
          {!reordering && alerts.some((a) => !dismissed.has(a.id)) ? (
            <View style={{ paddingHorizontal: GUTTER, paddingTop: space.lg }}>
              <AlertCards tripId={tripId} alerts={alerts} dismissed={dismissed} onDismiss={dismissAlert} setDayIndex={setDayIndex} />
            </View>
          ) : null}
          {/* The day's heading */}
          <View style={{ paddingHorizontal: GUTTER, paddingTop: space.xl, paddingBottom: space.lg }}>
            <T v="label" c={isToday ? "accent" : "ink3"}>
              {isToday ? "Today · " : ""}Day {dayIndex + 1} · {fmtDay(day.date, { weekday: "long", month: "long", day: "numeric" })}
            </T>
            <T v="title" style={{ marginTop: 6 }} accessibilityRole="header">
              {day.title || day.city}
            </T>
            {day.title && day.city ? (
              <T v="aside" c="ink2" style={{ marginTop: 2 }}>
                {day.city}
              </T>
            ) : null}
            {stats.stops > 0 ? (
              <T v="meta" c="ink2" num style={{ marginTop: space.sm }}>
                {stats.stops} {stats.stops === 1 ? "stop" : "stops"}
                {stats.transitMin > 0 ? ` · ${fmtDuration(stats.transitMin)} getting around` : ""}
                {stats.planned.length ? ` · ${stats.planned.map(([c, v]) => fmtMoney(Math.round(v), c)).join(" + ")} planned` : ""}
              </T>
            ) : null}

            {weather ? (
              <T v="meta" c={weather.rainProb >= 50 ? "caution" : "ink2"} num style={{ marginTop: 4 }}>
                {Math.round(weather.tempMaxC)}° / {Math.round(weather.tempMinC)}° · {weather.condition}
                {weather.rainProb >= 30 ? ` · ${Math.round(weather.rainProb)}% chance of rain` : ""}
                {weather.rainProb >= 50 && stats.stops > 0 ? ". Ask below for indoor alternatives." : ""}
              </T>
            ) : null}

            {isToday ? (
              <View style={{ flexDirection: "row", gap: space.sm, marginTop: space.lg }}>
                <QuickAction
                  icon="navigate-outline"
                  label="Directions"
                  disabled={!upNext}
                  onPress={() => upNext && openDirections({ lat: upNext.lat, lng: upNext.lng, name: upNext.placeName || upNext.title, city: day.city })}
                />
                <QuickAction icon="create-outline" label="Journal" onPress={() => router.push(`/trips/${tripId}/journal`)} />
                <QuickAction icon="wallet-outline" label="Expense" onPress={() => router.push(`/trips/${tripId}/add-expense`)} />
              </View>
            ) : null}

            {phase === "before" && bundle.checklist.length > 0 ? (
              <Pressable onPress={() => router.push(`/trips/${tripId}/packing`)} accessibilityRole="button" hitSlop={6} style={{ marginTop: space.sm, alignSelf: "flex-start" }}>
                <T v="meta" c="ink2" num>
                  Packing {packed} of {bundle.checklist.length} ready ›
                </T>
              </Pressable>
            ) : null}

            {stats.stops > 0 ? (
              <View style={{ flexDirection: "row", gap: space.xl, marginTop: space.lg, flexWrap: "wrap" }}>
                {reordering ? (
                  <Button variant="quiet" label="Done" onPress={finishReorder} />
                ) : (
                  <>
                    <Button variant="quiet" label="Add stop" onPress={() => openAdd()} />
                    {stats.stops >= 2 ? <Button variant="quiet" label={tidying ? "Tidying…" : "Tidy route"} busy={tidying} onPress={handleTidy} accessibilityHint="Reorders stops to cut travel time" /> : null}
                    {stats.stops >= 2 ? <Button variant="quiet" label="Reorder" onPress={startReorder} /> : null}
                  </>
                )}
              </View>
            ) : null}
          </View>

          <Rule style={{ marginHorizontal: GUTTER }} />

          {items.length === 0 ? (
            <View style={{ paddingHorizontal: GUTTER }}>
              <Empty
                title="A free day"
                body={`Nothing planned for ${fmtDay(day.date, { weekday: "long" })} yet.`}
                action="Plan this day for me"
                onAction={() => router.push({ pathname: "/trips/[tripId]/suggest", params: { tripId, date: dayKey(day.date) } })}
                secondary="Add a stop"
                onSecondary={() => openAdd()}
              />
            </View>
          ) : (
            <View style={{ paddingTop: space.sm }}>
              {items.map((item, i) => (
                <Animated.View key={item.id} layout={reflow}>
                  {i === nowBefore ? <NowLine minutes={nowMin} /> : null}
                  <StopRow
                    item={item}
                    mark={markFor(item, i)}
                    currency={currency}
                    reordering={reordering}
                    canUp={i > 0}
                    canDown={i < items.length - 1}
                    onMove={(dir) => setDraftOrder((o) => (o ? moveInArray(o, i, i + dir) : o))}
                    onPress={() => router.push({ pathname: "/trips/[tripId]/stop/[itemId]", params: { tripId, itemId: item.id } })}
                  />
                  {i < items.length - 1 && !reordering ? <Leg item={item} onAdd={() => openAdd(item)} /> : null}
                </Animated.View>
              ))}
              {isToday && nowBefore === -1 && items.length > 0 ? <NowLine minutes={nowMin} /> : null}
              {!reordering ? (
                <SpineItem onPress={() => openAdd()} accessibilityLabel="Add a stop" markCenter={11}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Ionicons name="add" size={18} color={colors.accent} />
                    <T v="bodyStrong" c="accent">
                      Add a stop
                    </T>
                  </View>
                </SpineItem>
              ) : null}
            </View>
          )}

          {/* Ask — plain language changes to this day */}
          {!reordering ? (
            <View style={{ paddingHorizontal: GUTTER, marginTop: space.lg }}>
              <Press
                onPress={() => router.push({ pathname: "/trips/[tripId]/ask", params: { tripId, date: dayKey(day.date) } })}
                accessibilityRole="button"
                accessibilityLabel="Ask Wayfare to change this day"
                scaleTo={0.985}
                style={{
                  borderWidth: 1,
                  borderColor: colors.rule,
                  borderRadius: radii.md,
                  borderCurve: "continuous",
                  paddingHorizontal: 14,
                  paddingVertical: 14,
                  backgroundColor: colors.raised,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 10,
                }}
              >
                <Ionicons name="chatbubble-ellipses-outline" size={18} color={colors.ink3} />
                <T v="body" c="ink3" style={{ flex: 1 }} numberOfLines={1}>
                  Change this day… “make it more relaxed”
                </T>
              </Press>
            </View>
          ) : null}
        </Animated.View>
      </ScrollView>
    </View>
  );
}

/** A stop on the day's line: when (small), what (large), then the details. */
function StopRow({
  item,
  mark,
  currency,
  reordering,
  canUp,
  canDown,
  onMove,
  onPress,
}: {
  item: ItineraryItem;
  mark: Mark;
  currency: string;
  reordering: boolean;
  canUp: boolean;
  canDown: boolean;
  onMove: (dir: -1 | 1) => void;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const end = item.endTime ?? (item.startTime != null ? item.startTime + item.durationMin : null);
  const when = item.startTime != null ? `${fmtClock(item.startTime)}${end != null ? ` – ${fmtClock(end)}` : ""}` : "No set time";
  const meta = [item.neighborhood || item.placeName, fmtDuration(item.durationMin), item.cost ? fmtMoney(Math.round(item.cost), item.currency || currency) : null]
    .filter(Boolean)
    .join(" · ");

  return (
    <SpineItem
      mark={mark}
      label={mark === "next" ? `Next · ${when}` : when}
      labelColor={mark === "next" ? "accent" : "ink3"}
      onPress={reordering ? undefined : onPress}
      accessibilityLabel={`${item.startTime != null ? fmtClock(item.startTime) + ", " : ""}${item.title}${item.confirmed ? ", booked" : ""}`}
      style={{ paddingBottom: space.md }}
      right={
        reordering ? (
          <View style={{ alignSelf: "center", gap: 8 }}>
            <MoveButton icon="chevron-up" disabled={!canUp} onPress={() => onMove(-1)} label={`Move ${item.title} earlier`} />
            <MoveButton icon="chevron-down" disabled={!canDown} onPress={() => onMove(1)} label={`Move ${item.title} later`} />
          </View>
        ) : (
          <Ionicons name="chevron-forward" size={16} color={colors.ink3} style={{ alignSelf: "center" }} />
        )
      }
    >
      <T v="entry" c={mark === "done" ? "ink2" : "ink"} numberOfLines={2}>
        {item.title}
      </T>
      {meta ? (
        <T v="meta" c="ink2" num numberOfLines={1}>
          {meta}
        </T>
      ) : null}
      {item.confirmed ? (
        <T v="label" c="positive" style={{ marginTop: 2 }}>
          Booked
        </T>
      ) : null}
      {item.notes ? (
        <T v="aside" c="ink3" numberOfLines={1}>
          {item.notes}
        </T>
      ) : null}
    </SpineItem>
  );
}

function MoveButton({ icon, disabled, onPress, label }: { icon: "chevron-up" | "chevron-down"; disabled: boolean; onPress: () => void; label: string }) {
  const { colors } = useTheme();
  return (
    <Press
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      // 40 visible + 2 above and below = 44pt, without the pair's targets overlapping.
      hitSlop={{ top: 2, bottom: 2, left: 4, right: 4 }}
      scaleTo={0.92}
      style={{
        width: 40,
        height: 40,
        borderRadius: 6,
        borderCurve: "continuous",
        borderWidth: 1,
        borderColor: colors.edge,
        alignItems: "center",
        justifyContent: "center",
        opacity: disabled ? 0.3 : 1,
        backgroundColor: colors.raised,
      }}
    >
      <Ionicons name={icon} size={18} color={colors.ink} />
    </Press>
  );
}

/** The travel between two stops, along the line — and the place to insert a new one. */
function Leg({ item, onAdd }: { item: ItineraryItem; onAdd: () => void }) {
  const { colors } = useTheme();
  const text = item.transportMin ? `${fmtDuration(item.transportMin)} ${transportLabel(item.transportMode)}` : null;
  return (
    <SpineItem
      onPress={onAdd}
      accessibilityLabel={`${text ? text + ". " : ""}Add a stop after ${item.title}`}
      padTop={4}
      style={{ paddingBottom: 8, alignItems: "center" }}
      right={<Ionicons name="add" size={16} color={colors.ink3} />}
    >
      <T v="aside" c="ink3">
        {text ?? " "}
      </T>
    </SpineItem>
  );
}

/** Where today is up to: the breathing mark, and an accent rule across. */
function NowLine({ minutes }: { minutes: number }) {
  const { colors } = useTheme();
  return (
    <SpineItem mark="now" markCenter={7} padTop={6} style={{ paddingBottom: 6 }} accessibilityLabel={`Now, ${fmtClock(minutes)}`}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <T v="label" c="accent" num>
          Now · {fmtClock(minutes)}
        </T>
        <View style={{ flex: 1, height: 1, backgroundColor: colors.accent }} />
      </View>
    </SpineItem>
  );
}

function QuickAction({ icon, label, onPress, disabled }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void; disabled?: boolean }) {
  const { colors } = useTheme();
  return (
    <Press
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      style={{
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        height: 44,
        borderRadius: radii.md,
        borderCurve: "continuous",
        borderWidth: 1,
        borderColor: colors.rule,
        backgroundColor: colors.raised,
        opacity: disabled ? 0.4 : 1,
      }}
    >
      <Ionicons name={icon} size={16} color={colors.ink} />
      <T v="meta">{label}</T>
    </Press>
  );
}
