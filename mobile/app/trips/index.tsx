import { useCallback, useState } from "react";
import { Pressable, RefreshControl, ScrollView, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ApiError, deleteTrip, fetchTripBundle, fetchTrips } from "@/shared/api";
import { daysUntil, fmtClock, fmtDay, fmtDuration, fmtMoney, GUTTER, radii, space, useTheme } from "@/shared/theme";
import { dailyAllowance, localKey, nextStop, spentOn, todayDayIndex, totalSpent, tripPhase } from "@/shared/trip";
import { destinationPhoto } from "@/shared/images";
import type { TripBundle, TripSummary } from "@/shared/types";
import { useAuth } from "@/lib/auth";
import { peekBundle } from "@/lib/trip";
import { confirmDestructive } from "@/lib/confirm";
import { dismissAlert, useDismissedAlerts, useNow } from "@/lib/alerts";
import { tripAlerts } from "@/shared/alerts";
import { AlertCards } from "@/components/trip/AlertCards";
import { Button } from "@/components/ui/Button";
import { Failure, Loading, Rule, SectionLabel } from "@/components/ui/Primitives";
import { T } from "@/components/ui/T";
import { useToast } from "@/components/ui/Toast";

export { ErrorFallback as ErrorBoundary } from "@/components/ErrorFallback";

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

  if (!trips) return error ? <Failure title="Your trips didn't load" message={error} onRetry={load} /> : <Loading />;

  const featuredSummary = pickFeatured(trips);
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
        <View style={{ flexDirection: "row", gap: space.xl }}>
          <Button variant="quiet" label="New trip" onPress={() => router.push("/trips/new")} />
          <Button
            variant="quiet"
            label="Sign out"
            onPress={() => confirmDestructive({ title: "Sign out of Wayfare?", confirm: "Sign out", onConfirm: () => void signOut() })}
          />
        </View>
      </View>

      {!featuredSummary ? (
        <View style={{ paddingHorizontal: GUTTER, paddingTop: space.xxl }}>
          <T v="display" accessibilityRole="header">Where to next?</T>
          <T v="body" c="ink2" style={{ marginTop: space.md, maxWidth: 340 }}>
            {trips.length ? "No trips coming up. Start one and Wayfare will lay out the days for you." : "Wayfare keeps your plan, your map and your spending in one place. Start with where you're going."}
          </T>
          <Button size="lg" label="Start a trip" onPress={() => router.push("/trips/new")} style={{ marginTop: space.xl, alignSelf: "flex-start" }} />
        </View>
      ) : (
        <Featured summary={featuredSummary} bundle={featured?.trip.id === featuredSummary.id ? featured : null} />
      )}

      {upcoming.length ? (
        <View style={{ marginTop: space.xxl }}>
          <SectionLabel style={{ paddingHorizontal: GUTTER }}>Coming up</SectionLabel>
          <Rule style={{ marginHorizontal: GUTTER }} />
          {upcoming.map((t) => (
            <TripRow key={t.id} trip={t} onLongPress={() => remove(t)} />
          ))}
        </View>
      ) : null}

      {past.length ? (
        <View style={{ marginTop: space.xxl }}>
          <SectionLabel style={{ paddingHorizontal: GUTTER }}>Past trips</SectionLabel>
          <Rule style={{ marginHorizontal: GUTTER }} />
          {past.map((t) => (
            <TripRow key={t.id} trip={t} onLongPress={() => remove(t)} />
          ))}
        </View>
      ) : null}

      {trips.length > 0 ? (
        <T v="small" c="ink3" style={{ paddingHorizontal: GUTTER, marginTop: space.lg }}>
          Press and hold a trip to delete it.
        </T>
      ) : null}
    </ScrollView>
  );
}

/** The trip that matters now: the one you're on, else the next one. */
function pickFeatured(trips: TripSummary[]): TripSummary | null {
  const live = trips.find((t) => tripPhase(t.startDate, t.endDate) === "during");
  if (live) return live;
  return trips.filter((t) => tripPhase(t.startDate, t.endDate) === "before").sort((a, b) => (a.startDate < b.startDate ? -1 : 1))[0] ?? null;
}

function Featured({ summary, bundle }: { summary: TripSummary; bundle: TripBundle | null }) {
  const { colors } = useTheme();
  const clock = useNow();
  const dismissed = useDismissedAlerts();
  const alerts = bundle ? tripAlerts(bundle, clock) : [];
  const phase = tripPhase(summary.startDate, summary.endDate);
  const place = summary.destinations.map((d) => d.name).join(" · ") || summary.subtitle || summary.title;
  const img = destinationPhoto(summary.destinations[0]?.name || summary.destinations[0]?.country || summary.title);
  const open = () => router.push(`/trips/${summary.id}`);

  const next = bundle ? nextStop(bundle.days) : null;
  const plannedDays = bundle ? bundle.days.filter((d) => d.items.length > 0).length : null;
  const totalDays = bundle ? Math.max(bundle.days.length, 1) : null;
  const spentToday = bundle ? spentOn(bundle.expenses, localKey(new Date())) : null;
  const allowance = bundle
    ? dailyAllowance({ budget: bundle.trip.budgetAmount, spent: totalSpent(bundle.expenses), startIso: bundle.trip.startDate, endIso: bundle.trip.endDate })
    : null;
  const home = summary.homeCurrency;

  return (
    <View style={{ paddingHorizontal: GUTTER, paddingTop: space.lg }}>
      <T v="label" c={phase === "during" ? "accent" : "ink3"}>
        {phase === "during" ? "You're travelling" : daysUntil(summary.startDate) <= 1 ? "Leaving tomorrow" : `In ${daysUntil(summary.startDate)} days`}
      </T>
      <Pressable onPress={open} accessibilityRole="button" accessibilityLabel={`Open ${summary.title}`}>
        <T v="display" style={{ marginTop: space.sm }} accessibilityRole="header">
          {phase === "during" ? `Now in ${summary.destinations[0]?.name ?? place}` : summary.title}
        </T>
        <T v="meta" c="ink2" num style={{ marginTop: 4 }}>
          {place} · {fmtDay(summary.startDate)} – {fmtDay(summary.endDate, { month: "short", day: "numeric", year: "numeric" })}
        </T>
        {img ? (
        <Image
          source={{ uri: img.hero }}
          style={{ width: "100%", aspectRatio: 16 / 10, marginTop: space.lg, borderRadius: radii.sm, backgroundColor: colors.sunk }}
          contentFit="cover"
          transition={220}
          cachePolicy="memory-disk"
          accessibilityIgnoresInvertColors
        />
        ) : null}
      </Pressable>

      {alerts.length ? (
        <View style={{ marginTop: space.lg }}>
          <AlertCards tripId={summary.id} alerts={alerts} dismissed={dismissed} onDismiss={dismissAlert} max={1} />
        </View>
      ) : null}

      {phase === "during" ? (
        <View style={{ marginTop: space.lg }}>
          {next ? (
            <Pressable
              onPress={() => router.push({ pathname: "/trips/[tripId]/stop/[itemId]", params: { tripId: summary.id, itemId: next.item.id } })}
              accessibilityRole="button"
              style={({ pressed }) => ({ paddingVertical: space.md, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.rule, backgroundColor: pressed ? colors.sunk : "transparent" })}
            >
              <T v="label" c="ink3">
                Next · {fmtClock(next.item.startTime)}
                {next.dayIndex !== todayDayIndex(bundle!.days) ? ` · ${fmtDay(next.day.date, { weekday: "short" })}` : ""}
              </T>
              <T v="heading" style={{ marginTop: 4 }}>
                {next.item.title}
              </T>
              <T v="meta" c={next.leaveInMin != null && next.leaveInMin <= 15 ? "accent" : "ink2"} num style={{ marginTop: 2 }}>
                {next.leaveInMin == null ? next.item.neighborhood || next.day.city : next.leaveInMin === 0 ? "Time to go" : `Leave in ${fmtDuration(next.leaveInMin)}`}
              </T>
            </Pressable>
          ) : bundle ? (
            <T v="meta" c="ink2" style={{ paddingVertical: space.md }}>
              Nothing else scheduled. Enjoy the free time.
            </T>
          ) : null}
          {spentToday != null ? (
            <T v="meta" c="ink2" num style={{ marginTop: space.md }}>
              Spent today {fmtMoney(Math.round(spentToday), home)}
              {allowance != null ? ` of about ${fmtMoney(Math.round(allowance), home)} a day` : ""}
            </T>
          ) : null}
          <View style={{ flexDirection: "row", gap: space.md, marginTop: space.lg }}>
            <Button label="Today's plan" onPress={open} style={{ flex: 1 }} />
            <Button variant="accent" label="Log expense" onPress={() => router.push(`/trips/${summary.id}/add-expense`)} style={{ flex: 1 }} />
          </View>
        </View>
      ) : (
        <View style={{ marginTop: space.lg }}>
          {bundle ? (
            <T v="meta" c="ink2" num>
              {plannedDays === 0 ? "No days planned yet" : `${plannedDays} of ${totalDays} days planned`}
              {bundle.hotels.length ? ` · ${bundle.hotels.length} ${bundle.hotels.length === 1 ? "stay" : "stays"} booked` : ""}
              {bundle.trip.budgetAmount > 0 ? ` · ${fmtMoney(bundle.trip.budgetAmount, home)} budget` : ""}
            </T>
          ) : null}
          <Button label={plannedDays === 0 ? "Start planning" : "Open the plan"} onPress={open} style={{ marginTop: space.lg, alignSelf: "flex-start" }} />
        </View>
      )}
    </View>
  );
}

function TripRow({ trip, onLongPress }: { trip: TripSummary; onLongPress: () => void }) {
  const { colors } = useTheme();
  const img = destinationPhoto(trip.destinations[0]?.name || trip.destinations[0]?.country || trip.title);
  const place = trip.destinations.map((d) => d.name).join(" · ");
  return (
    <Pressable
      onPress={() => router.push(`/trips/${trip.id}`)}
      onLongPress={onLongPress}
      accessibilityRole="button"
      accessibilityLabel={`${trip.title}, ${fmtDay(trip.startDate, { month: "long", day: "numeric", year: "numeric" })}`}
      accessibilityHint="Opens the trip. Press and hold to delete."
      style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: space.lg, paddingHorizontal: GUTTER, paddingVertical: space.md, backgroundColor: pressed ? colors.sunk : "transparent", borderBottomWidth: 1, borderBottomColor: colors.rule })}
    >
      <View style={{ flex: 1 }}>
        <T v="entry" numberOfLines={1}>
          {trip.title}
        </T>
        <T v="small" c="ink3" num numberOfLines={1} style={{ marginTop: 2 }}>
          {[place, `${fmtDay(trip.startDate)} – ${fmtDay(trip.endDate, { month: "short", day: "numeric", year: "numeric" })}`].filter(Boolean).join(" · ")}
        </T>
      </View>
      {img ? <Image source={{ uri: img.thumb }} style={{ width: 52, height: 52, borderRadius: radii.sm, backgroundColor: colors.sunk }} contentFit="cover" transition={160} cachePolicy="memory-disk" /> : null}
    </Pressable>
  );
}
