import { useCallback, useState } from "react";
import { Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { ApiError, deleteTrip, fetchTripBundle, fetchTrips } from "@/shared/api";
import { daysUntil, fmtClock, fmtDay, fmtDuration, fmtMoney, GUTTER, space, TABULAR_NUMS, type, useTheme } from "@/shared/theme";
import { dailyAllowance, dayKey, dayStats, localKey, nextStop, spentOn, todayDayIndex, totalSpent, tripPhase } from "@/shared/trip";
import type { TripBundle, TripSummary } from "@/shared/types";
import { useAuth } from "@/lib/auth";
import { peekBundle } from "@/lib/trip";
import { confirmDestructive } from "@/lib/confirm";
import { dismissAlert, useDismissedAlerts, useNow } from "@/lib/alerts";
import { openDirections } from "@/lib/directions";
import { enterUp, fadeOut, reflow } from "@/lib/motion";
import { tripAlerts } from "@/shared/alerts";
import { AlertCards } from "@/components/trip/AlertCards";
import { Button } from "@/components/ui/Button";
import { Failure, Skeleton } from "@/components/ui/Primitives";
import { SpineBreak, SpineItem } from "@/components/ui/Spine";
import { T } from "@/components/ui/T";
import { useToast } from "@/components/ui/Toast";

export { ErrorFallback as ErrorBoundary } from "@/components/ErrorFallback";

// Home is a timeline: today set large, then what's happening now and next,
// the trips to come, and the ones behind you, all hanging from one line.
export default function Home() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const { signOut } = useAuth();
  const [trips, setTrips] = useState<TripSummary[] | null>(null);
  const [featured, setFeatured] = useState<TripBundle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const list = await fetchTrips();
      setTrips(list);
      setError(null);
      const pick = pickFeatured(list);
      if (pick) {
        setFeatured(peekBundle(pick.id));
        fetchTripBundle(pick.id).then(setFeatured).catch(() => {});
      } else {
        setFeatured(null);
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't load your trips.");
    }
  }, []);

  // Refresh whenever Home comes back into view — a trip may have been
  // created, changed or deleted in the meantime.
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  if (!trips) return error ? <Failure title="Your trips didn't load" message={error} onRetry={load} /> : <HomeSkeleton />;

  const featuredSummary = pickFeatured(trips);
  const bundle = featured?.trip.id === featuredSummary?.id ? featured : null;
  const upcoming = trips.filter((t) => tripPhase(t.startDate, t.endDate) !== "after" && t.id !== featuredSummary?.id).sort((a, b) => (a.startDate < b.startDate ? -1 : 1));
  const past = trips.filter((t) => tripPhase(t.startDate, t.endDate) === "after" && t.id !== featuredSummary?.id).sort((a, b) => (a.startDate < b.startDate ? 1 : -1));

  function remove(t: TripSummary) {
    confirmDestructive({
      title: `Delete “${t.title}”?`,
      message: "Its plan, expenses, bookings and notes are deleted with it. This can't be undone.",
      confirm: "Delete trip",
      onConfirm: async () => {
        try {
          await deleteTrip(t.id);
          toast("Trip deleted");
          void load();
        } catch {
          toast("Couldn't delete the trip", "error");
        }
      },
    });
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.paper }}
      contentContainerStyle={{ paddingTop: insets.top, paddingBottom: insets.bottom + space.xxxl }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={async () => {
            setRefreshing(true);
            await load();
            setRefreshing(false);
          }}
          tintColor={colors.ink3}
        />
      }
    >
      <View style={{ height: 52, paddingHorizontal: GUTTER, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <T v="entry" style={{ letterSpacing: 0.2 }}>
          Wayfare
        </T>
        <Button variant="quiet" label="New trip" icon={<Ionicons name="add" size={18} color={colors.accent} />} onPress={() => router.push("/trips/new")} />
      </View>

      <DateHero summary={featuredSummary} bundle={bundle} hasTrips={trips.length > 0} />
      {featuredSummary && bundle ? <Alerts tripId={featuredSummary.id} bundle={bundle} /> : null}

      {trips.length === 0 ? (
        <FirstTrip />
      ) : (
        <View style={{ marginTop: space.xl }}>
          {!featuredSummary ? (
            <NothingNext />
          ) : tripPhase(featuredSummary.startDate, featuredSummary.endDate) === "during" ? (
            <Travelling summary={featuredSummary} bundle={bundle} />
          ) : (
            <NextTrip summary={featuredSummary} bundle={bundle} />
          )}
          {upcoming.length ? <SpineBreak>Later</SpineBreak> : null}
          {upcoming.map((t, i) => (
            <TripEntry key={t.id} trip={t} i={i} onLongPress={() => remove(t)} />
          ))}
          {past.length ? <SpineBreak>Earlier</SpineBreak> : null}
          {past.map((t, i) => (
            <TripEntry key={t.id} trip={t} i={upcoming.length + i} past onLongPress={() => remove(t)} />
          ))}
        </View>
      )}

      <View style={{ paddingHorizontal: GUTTER, marginTop: space.lg, flexDirection: "row", alignItems: "center", gap: space.lg }}>
        <T v="small" c="ink3" style={{ flex: 1 }}>
          {trips.length > 0 ? "Press and hold a trip to delete it." : ""}
        </T>
        {/* Rarely needed, so it waits at the bottom rather than beside New trip. */}
        <Pressable
          onPress={() => confirmDestructive({ title: "Sign out of Wayfare?", confirm: "Sign out", onConfirm: () => void signOut() })}
          accessibilityRole="button"
          hitSlop={13}
          style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}
        >
          <T v="meta" c="ink2">
            Sign out
          </T>
        </Pressable>
      </View>
    </ScrollView>
  );
}

/** The trip that matters now: the one you're on, else the next one. */
function pickFeatured(trips: TripSummary[]): TripSummary | null {
  const live = trips.find((t) => tripPhase(t.startDate, t.endDate) === "during");
  if (live) return live;
  return trips.filter((t) => tripPhase(t.startDate, t.endDate) === "before").sort((a, b) => (a.startDate < b.startDate ? -1 : 1))[0] ?? null;
}

const dayLabel = (iso: string) => `${fmtDay(iso, { weekday: "short" })} ${Number(dayKey(iso).slice(8))}`;
const tripDates = (t: TripSummary) => `${fmtDay(t.startDate)} – ${fmtDay(t.endDate, { month: "short", day: "numeric", year: "numeric" })}`;

/** Today, set large, and where it sits in your travels. */
function DateHero({ summary, bundle, hasTrips }: { summary: TripSummary | null; bundle: TripBundle | null; hasTrips: boolean }) {
  const { colors } = useTheme();
  const now = useNow();
  let status = hasTrips ? "No trips coming up" : "Nothing planned yet";
  let travelling = false;
  if (summary) {
    if (tripPhase(summary.startDate, summary.endDate) === "during") {
      travelling = true;
      const idx = bundle ? todayDayIndex(bundle.days) : null;
      const city = (idx != null && bundle?.days[idx]?.city) || summary.destinations[0]?.name;
      status = idx != null && bundle ? `Day ${idx + 1} of ${bundle.days.length}${city ? ` · ${city}` : ""}` : `Travelling${city ? ` · ${city}` : ""}`;
    } else {
      const n = daysUntil(summary.startDate);
      status = n <= 1 ? `${summary.title} starts tomorrow` : `${summary.title} in ${n} days`;
    }
  }
  const weekday = now.toLocaleDateString("en-US", { weekday: "long" });
  const month = now.toLocaleDateString("en-US", { month: "long" });
  return (
    <Animated.View
      entering={enterUp(0)}
      accessible
      accessibilityRole="header"
      accessibilityLabel={`${weekday}, ${month} ${now.getDate()}. ${status}`}
      style={{ flexDirection: "row", alignItems: "flex-end", gap: space.lg, paddingHorizontal: GUTTER, paddingTop: space.lg }}
    >
      <Text style={[type.figure, TABULAR_NUMS, { fontSize: 88, lineHeight: 92, letterSpacing: -3, color: colors.ink }]}>{now.getDate()}</Text>
      <View style={{ flex: 1, gap: 2, paddingBottom: 10 }}>
        <T v="label" c="ink3">
          {weekday}
        </T>
        <T v="heading">{month}</T>
        <T v="meta" c={travelling ? "accent" : "ink2"} numberOfLines={1}>
          {status}
        </T>
      </View>
    </Animated.View>
  );
}

/** The most urgent thing about the trip, if anything needs attention. */
function Alerts({ tripId, bundle }: { tripId: string; bundle: TripBundle }) {
  const clock = useNow();
  const dismissed = useDismissedAlerts();
  const alerts = tripAlerts(bundle, clock);
  if (!alerts.some((a) => !dismissed.has(a.id))) return null;
  return (
    <Animated.View entering={enterUp(1)} style={{ paddingHorizontal: GUTTER, marginTop: space.lg }}>
      <AlertCards tripId={tripId} alerts={alerts} dismissed={dismissed} onDismiss={dismissAlert} max={1} />
    </Animated.View>
  );
}

/** On a trip: now and next, what's left today, and tomorrow. */
function Travelling({ summary, bundle }: { summary: TripSummary; bundle: TripBundle | null }) {
  const { colors } = useTheme();
  const clock = useNow();
  const nowMin = clock.getHours() * 60 + clock.getMinutes();
  const open = () => router.push(`/trips/${summary.id}`);
  const home = summary.homeCurrency;
  const next = bundle ? nextStop(bundle.days) : null;
  const todayIdx = bundle ? todayDayIndex(bundle.days) : null;
  const today = bundle && todayIdx != null ? bundle.days[todayIdx] : null;
  const after = today && next && next.dayIndex === todayIdx ? today.items.indexOf(next.item) + 1 : -1;
  const later = today && after > 0 ? today.items.slice(after, after + 2) : [];
  const tomorrow = bundle && todayIdx != null ? bundle.days[todayIdx + 1] : undefined;
  const tomorrowStats = tomorrow ? dayStats(tomorrow, home) : null;
  const spentToday = bundle ? spentOn(bundle.expenses, localKey(clock)) : null;
  const allowance = bundle
    ? dailyAllowance({ budget: bundle.trip.budgetAmount, spent: totalSpent(bundle.expenses), startIso: bundle.trip.startDate, endIso: bundle.trip.endDate })
    : null;

  return (
    <>
      <Animated.View entering={enterUp(1)}>
        <SpineItem mark="now" label={`Now · ${fmtClock(nowMin)}`} labelColor="accent">
          {next ? (
            <>
              <T v="title" style={{ marginTop: 2 }}>
                Next, {next.item.title}
              </T>
              <T v="meta" c="ink2" num>
                {[fmtClock(next.item.startTime), next.dayIndex !== todayIdx ? fmtDay(next.day.date, { weekday: "long" }) : null, next.item.neighborhood || next.day.city].filter(Boolean).join(" · ")}
              </T>
              {next.leaveInMin != null ? (
                <T v="bodyStrong" c={next.leaveInMin <= 15 ? "accent" : "ink"}>
                  {next.leaveInMin === 0 ? "Time to go" : `Leave in ${fmtDuration(next.leaveInMin)}`}
                </T>
              ) : null}
            </>
          ) : (
            <T v="heading" style={{ marginTop: 2 }}>
              {bundle ? "Nothing else today. Enjoy the free time." : " "}
            </T>
          )}
          {spentToday != null ? (
            <T v="meta" c="ink2" num style={{ marginTop: 4 }}>
              Spent today {fmtMoney(Math.round(spentToday), home)}
              {allowance != null ? ` of about ${fmtMoney(Math.round(allowance), home)} a day` : ""}
            </T>
          ) : null}
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm, marginTop: space.md }}>
            {next ? (
              <Button
                label="Directions"
                icon={<Ionicons name="navigate-outline" size={16} color={colors.onInk} />}
                onPress={() => openDirections({ lat: next.item.lat, lng: next.item.lng, name: next.item.placeName || next.item.title, city: next.day.city })}
              />
            ) : (
              <Button label="Today's plan" onPress={open} />
            )}
            <Button variant="accent" label="Log expense" onPress={() => router.push(`/trips/${summary.id}/add-expense`)} />
          </View>
          {next ? <Button variant="quiet" label="Today's plan" onPress={open} style={{ alignSelf: "flex-start", marginTop: space.md }} /> : null}
        </SpineItem>
      </Animated.View>

      {later.map((it, i) => (
        <Animated.View key={it.id} entering={enterUp(2 + i)}>
          <SpineItem
            mark="stop"
            label={`${it.startTime != null ? fmtClock(it.startTime) : "Later"} · Later today`}
            onPress={() => router.push({ pathname: "/trips/[tripId]/stop/[itemId]", params: { tripId: summary.id, itemId: it.id } })}
            accessibilityLabel={`${it.startTime != null ? fmtClock(it.startTime) + ", " : ""}${it.title}${it.confirmed ? ", booked" : ""}`}
          >
            <T v="entry" numberOfLines={2}>
              {it.title}
            </T>
            {it.confirmed ? (
              <T v="label" c="positive">
                Booked
              </T>
            ) : null}
          </SpineItem>
        </Animated.View>
      ))}

      {tomorrow && tomorrowStats ? (
        <Animated.View entering={enterUp(4)}>
          <SpineItem mark="day" label={`Tomorrow · ${dayLabel(tomorrow.date)}`} onPress={open} accessibilityLabel={`Tomorrow: ${tomorrow.title || tomorrow.city}`}>
            <T v="entry">{tomorrow.title || tomorrow.city}</T>
            <T v="meta" c="ink2" num>
              {tomorrowStats.stops === 0
                ? "Nothing planned yet"
                : `${tomorrowStats.stops} ${tomorrowStats.stops === 1 ? "stop" : "stops"}${tomorrowStats.transitMin > 0 ? ` · ${fmtDuration(tomorrowStats.transitMin)} getting around` : ""}`}
            </T>
          </SpineItem>
        </Animated.View>
      ) : null}
    </>
  );
}

/** Before the next trip: how soon, and how ready. */
function NextTrip({ summary, bundle }: { summary: TripSummary; bundle: TripBundle | null }) {
  const n = daysUntil(summary.startDate);
  const place = summary.destinations.map((d) => d.name).join(" · ") || summary.subtitle || "";
  const plannedDays = bundle ? bundle.days.filter((d) => d.items.length > 0).length : null;
  const totalDays = bundle ? Math.max(bundle.days.length, 1) : null;
  const home = summary.homeCurrency;
  return (
    <Animated.View entering={enterUp(1)}>
      <SpineItem mark="trip" label={n <= 1 ? "Tomorrow" : `In ${n} days`} labelColor="accent">
        <T v="title" style={{ marginTop: 2 }}>
          {summary.title}
        </T>
        <T v="meta" c="ink2" num>
          {[place, tripDates(summary)].filter(Boolean).join(" · ")}
        </T>
        {bundle ? (
          <T v="meta" c="ink2" num>
            {plannedDays === 0 ? "No days planned yet" : `${plannedDays} of ${totalDays} days planned`}
            {bundle.hotels.length ? ` · ${bundle.hotels.length} ${bundle.hotels.length === 1 ? "stay" : "stays"} booked` : ""}
            {bundle.trip.budgetAmount > 0 ? ` · ${fmtMoney(bundle.trip.budgetAmount, home)} budget` : ""}
          </T>
        ) : null}
        <Button
          label={plannedDays === 0 ? "Start planning" : "Open the plan"}
          onPress={() => router.push(`/trips/${summary.id}`)}
          style={{ alignSelf: "flex-start", marginTop: space.md }}
        />
      </SpineItem>
    </Animated.View>
  );
}

/** Trips exist, but none ahead. */
function NothingNext() {
  return (
    <Animated.View entering={enterUp(1)}>
      <SpineItem mark="now" label="Today">
        <T v="heading" style={{ marginTop: 2 }}>
          No trips coming up.
        </T>
        <T v="body" c="ink2">
          Start one and Wayfare will lay out the days for you.
        </T>
        <Button label="Start a trip" onPress={() => router.push("/trips/new")} style={{ alignSelf: "flex-start", marginTop: space.md }} />
      </SpineItem>
    </Animated.View>
  );
}

/** No trips at all yet. */
function FirstTrip() {
  return (
    <View style={{ paddingHorizontal: GUTTER, paddingTop: space.xxl }}>
      <Animated.View entering={enterUp(1)}>
        <T v="display" accessibilityRole="header">
          Where to next?
        </T>
      </Animated.View>
      <Animated.View entering={enterUp(2)}>
        <T v="body" c="ink2" style={{ marginTop: space.md, maxWidth: 340 }}>
          Wayfare keeps your plan, your map and your spending in one place. Start with where you&apos;re going.
        </T>
      </Animated.View>
      <Animated.View entering={enterUp(3)}>
        <Button size="lg" label="Start a trip" onPress={() => router.push("/trips/new")} style={{ marginTop: space.xl, alignSelf: "flex-start" }} />
      </Animated.View>
    </View>
  );
}

function TripEntry({ trip, i, past, onLongPress }: { trip: TripSummary; i: number; past?: boolean; onLongPress: () => void }) {
  const n = daysUntil(trip.startDate);
  const label = past
    ? fmtDay(trip.startDate, { month: "short", year: "numeric" })
    : n <= 1
      ? "Tomorrow"
      : n <= 60
        ? `In ${n} days`
        : fmtDay(trip.startDate, { month: "long", year: "numeric" });
  const place = trip.destinations.map((d) => d.name).join(" · ");
  return (
    // A deleted trip fades out and the rest close the gap.
    <Animated.View entering={enterUp(2 + i)} exiting={fadeOut} layout={reflow}>
      <SpineItem
        mark={past ? "past" : "trip"}
        label={label}
        onPress={() => router.push(`/trips/${trip.id}`)}
        onLongPress={onLongPress}
        accessibilityLabel={`${trip.title}, ${fmtDay(trip.startDate, { month: "long", day: "numeric", year: "numeric" })}`}
        accessibilityHint="Opens the trip. Press and hold to delete."
      >
        <T v={past ? "entry" : "heading"} c={past ? "ink2" : "ink"} numberOfLines={2}>
          {trip.title}
        </T>
        <T v="small" c="ink3" num numberOfLines={1}>
          {[place, tripDates(trip)].filter(Boolean).join(" · ")}
        </T>
      </SpineItem>
    </Animated.View>
  );
}

/** Home while the trips load: the page's shape, breathing. */
function HomeSkeleton() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, paddingTop: insets.top, backgroundColor: colors.paper }}>
      <View style={{ height: 52, paddingHorizontal: GUTTER, justifyContent: "center" }}>
        <T v="entry" style={{ letterSpacing: 0.2 }}>
          Wayfare
        </T>
      </View>
      <View accessible accessibilityLabel="Loading your trips" accessibilityState={{ busy: true }}>
        <View style={{ flexDirection: "row", alignItems: "flex-end", gap: space.lg, paddingHorizontal: GUTTER, paddingTop: space.lg }}>
          <Skeleton width={96} height={84} />
          <View style={{ flex: 1, gap: 8, paddingBottom: 10 }}>
            <Skeleton width="30%" height={11} />
            <Skeleton width="52%" height={22} />
            <Skeleton width="70%" height={13} />
          </View>
        </View>
        <View style={{ marginTop: space.xl }}>
          {(["72%", "56%", "64%"] as const).map((w) => (
            <SpineItem key={w} mark="past">
              <Skeleton width="28%" height={11} />
              <Skeleton width={w} height={24} />
            </SpineItem>
          ))}
        </View>
      </View>
    </View>
  );
}
