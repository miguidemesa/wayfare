import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { fetchTripBundle, ApiError } from "@/shared/api";
import {
  resolveDestinationTheme,
  daysUntil,
  tripDayCount,
  fmtMoney,
  fmtDate,
  fmtClock,
  TABULAR_NUMS,
  TRAVEL_THEME,
  type DestinationTheme,
} from "@/shared/theme";
import { getDestinationImages } from "@/shared/images";
import type { TripBundle } from "@/shared/types";
import { Card, Surface } from "@/components/ui/Surface";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { BottomNav } from "@/components/BottomNav";
import { SmartItineraryWizard } from "@/components/SmartItineraryWizard";

export default function TripOverviewScreen() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const insets = useSafeAreaInsets();
  const [bundle, setBundle] = useState<TripBundle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [wizardVisible, setWizardVisible] = useState(false);

  async function load() {
    try {
      const data = await fetchTripBundle(tripId);
      setBundle(data);
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't load this journey.");
    }
  }

  useEffect(() => {
    void load();
  }, [tripId]);

  if (error) {
    return (
      <View style={[styles.centerContainer, { paddingTop: insets.top }]}>
        <Ionicons name="cloud-offline-outline" size={44} color={TRAVEL_THEME.colors.danger} />
        <Text style={styles.errorTitle}>Connection Issue</Text>
        <Text style={styles.errorDesc}>{error}</Text>
        <Button
          label="Retry Connection"
          variant="primary"
          onPress={load}
          style={{ marginTop: 14 }}
        />
      </View>
    );
  }

  if (!bundle) {
    return (
      <View style={[styles.centerContainer, { paddingTop: insets.top }]}>
        <ActivityIndicator color={TRAVEL_THEME.colors.terracotta} size="large" />
        <Text style={styles.loadingText}>Opening your travel canvas…</Text>
      </View>
    );
  }

  const {
    trip,
    destinations,
    days,
    expenses,
    weather,
    checklist,
    documents,
    reservations,
    hotels,
    flights,
    journal,
  } = bundle;

  const theme: DestinationTheme = resolveDestinationTheme(destinations, trip.coverTheme);
  const destName = destinations[0]?.name || theme.city || "Tokyo";
  const images = getDestinationImages(destName);

  const totalSpent = expenses.reduce((s, e) => s + e.amountHome, 0);
  const dayCount = Math.max(days.length, tripDayCount(trip.startDate, trip.endDate));
  const totalStops = days.reduce((s, d) => s + d.items.length, 0);
  const until = daysUntil(trip.startDate);
  const isBefore = new Date(trip.startDate) > new Date();
  const isAfter = new Date(trip.endDate) < new Date();
  const isLive = !isBefore && !isAfter;

  // Packing stats
  const totalChecklist = checklist.length;
  const checkedCount = checklist.filter((c) => c.checked).length;
  const packPct = totalChecklist > 0 ? Math.round((checkedCount / totalChecklist) * 100) : 0;

  // Next upcoming stop
  const now = new Date();
  const todayIso = now.toISOString().slice(0, 10);
  const nextUp =
    days
      .flatMap((d) =>
        d.items
          .filter((i) => i.startTime != null)
          .map((i) => ({ ...i, date: d.date.slice(0, 10), cityName: d.city }))
      )
      .find(
        (i) =>
          i.date > todayIso ||
          (i.date === todayIso && i.startTime! >= now.getHours() * 60 + now.getMinutes() - 30)
      ) ||
    (days[0]?.items[0]
      ? { ...days[0].items[0], date: days[0].date.slice(0, 10), cityName: days[0].city }
      : null);

  const todayWeather = weather.find((w) => w.date.slice(0, 10) >= todayIso) || weather[0];

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      <ScrollView
        contentContainerStyle={{ paddingBottom: 110 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await load();
              setRefreshing(false);
            }}
            tintColor={TRAVEL_THEME.colors.terracotta}
          />
        }
      >
        {/* -------------------------------------------------- HERO CANVAS */}
        <View style={styles.heroWrapper}>
          <Image
            source={{ uri: images.hero }}
            style={styles.heroImage}
            resizeMode="cover"
          />
          {/* Subtle Warm Gradient Overlay */}
          <View style={styles.heroOverlay} />

          {/* Top Bar on Hero: Back & Action */}
          <View style={[styles.heroTopBar, { paddingTop: Math.max(insets.top, 16) + 4 }]}>
            <TouchableOpacity
              onPress={() => router.replace("/trips")}
              activeOpacity={0.75}
              style={styles.heroCircleBtn}
            >
              <Ionicons name="arrow-back" size={18} color="#FFFFFF" />
            </TouchableOpacity>

            <View style={styles.heroTopRight}>
              <TouchableOpacity
                onPress={() => setWizardVisible(true)}
                activeOpacity={0.8}
                style={styles.heroActionBtn}
              >
                <Ionicons name="sparkles" size={13} color="#FFFFFF" />
                <Text style={styles.heroActionText}>Smart Plan</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Destination Hero Text */}
          <View style={styles.heroTextContainer}>
            <View style={styles.heroBadgeRow}>
              <Badge
                label={destinations[0]?.country ? destinations[0].country.toUpperCase() : "DESTINATION"}
                variant="dark"
                size="sm"
              />
              <Badge
                label={
                  isBefore
                    ? `DEPARTS IN ${until} DAYS`
                    : isLive
                      ? "LIVE JOURNEY"
                      : "COMPLETED"
                }
                variant={isLive ? "forest" : "terracotta"}
                size="sm"
              />
            </View>

            <Text style={styles.heroCityTitle}>{trip.title}</Text>
            {theme.tagline ? (
              <Text style={styles.heroTagline}>{theme.tagline}</Text>
            ) : null}

            {/* Date & Weather Row */}
            <View style={styles.heroMetaRow}>
              <View style={styles.heroDateItem}>
                <Ionicons name="calendar" size={13} color="rgba(255, 255, 255, 0.9)" />
                <Text style={[styles.heroDateText, TABULAR_NUMS]}>
                  {fmtDate(trip.startDate, { month: "short", day: "numeric" })} —{" "}
                  {fmtDate(trip.endDate, { month: "short", day: "numeric", year: "numeric" })} · {dayCount} DAYS
                </Text>
              </View>

              {todayWeather && (
                <View style={styles.weatherBadge}>
                  <Text style={[styles.weatherTemp, TABULAR_NUMS]}>
                    {Math.round(todayWeather.tempMaxC)}°C
                  </Text>
                  <Text style={styles.weatherCond}>
                    {todayWeather.condition}
                  </Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* ------------------------------------------- NEXT UP / TRAVEL PULSE */}
        <View style={styles.pulseCardWrapper}>
          <Card padding={16} style={styles.pulseCard}>
            <View style={styles.pulseHeader}>
              <View style={styles.pulseLabelRow}>
                <View style={styles.pulseDot} />
                <Text style={styles.pulseLabel}>
                  {isLive ? "LIVE NOW · NEXT STOP" : "UPCOMING MILESTONE"}
                </Text>
              </View>
              {nextUp?.startTime != null && (
                <Badge
                  label={fmtClock(nextUp.startTime)}
                  variant="terracotta"
                  size="sm"
                />
              )}
            </View>

            {nextUp ? (
              <View style={styles.pulseBody}>
                <Text style={styles.pulseTitle} numberOfLines={1}>
                  {nextUp.title}
                </Text>
                <View style={styles.pulseMetaRow}>
                  <View style={styles.pulseMetaItem}>
                    <Ionicons name="location-outline" size={12} color={TRAVEL_THEME.colors.inkMuted} />
                    <Text style={styles.pulseMetaText}>
                      {nextUp.cityName || destName} · {nextUp.neighborhood || "Central"}
                    </Text>
                  </View>
                  <View style={styles.pulseMetaItem}>
                    <Ionicons name="time-outline" size={12} color={TRAVEL_THEME.colors.inkMuted} />
                    <Text style={styles.pulseMetaText}>
                      {nextUp.durationMin || 60}m duration
                    </Text>
                  </View>
                </View>
              </View>
            ) : (
              <View style={styles.pulseEmpty}>
                <Text style={styles.pulseEmptyText}>
                  No stops planned for today yet. Use the Smart Planner to design your day.
                </Text>
              </View>
            )}

            <View style={styles.pulseFooter}>
              <TouchableOpacity
                onPress={() => router.push(`/trips/${trip.id}/itinerary`)}
                activeOpacity={0.75}
                style={styles.pulseActionLink}
              >
                <Text style={styles.pulseActionLinkText}>
                  Open Timeline ({totalStops} stops) →
                </Text>
              </TouchableOpacity>
              <Button
                label="View on Map"
                iconLeft={<Ionicons name="map-outline" size={14} color={TRAVEL_THEME.colors.inkPrimary} />}
                variant="secondary"
                size="sm"
                onPress={() => router.push(`/trips/${trip.id}/discover`)}
              />
            </View>
          </Card>
        </View>

        {/* ------------------------------------------- CONTEXTUAL CONCIERGE BRIEFING */}
        <View style={styles.sectionContainer}>
          <TouchableOpacity
            activeOpacity={0.88}
            onPress={() => router.push(`/trips/${trip.id}/ai`)}
          >
            <Surface variant="sand" borderRadius={18} style={styles.conciergeCard}>
              <View style={styles.conciergeHeader}>
                <View style={styles.conciergeIconTitle}>
                  <Ionicons name="sparkles" size={15} color={TRAVEL_THEME.colors.terracotta} />
                  <Text style={styles.conciergeLabel}>LOCAL TRAVEL CONCIERGE</Text>
                </View>
                <Badge label="ACTIVE" variant="forest" size="sm" />
              </View>

              <Text style={styles.conciergeQuote}>
                {isBefore
                  ? `Your journey to ${destName} has ${totalStops} stops planned across ${dayCount} days. Tap to optimize walking routes or discover curated neighborhood gems.`
                  : `Ideal weather in ${destName} this afternoon. 3 curated local dining spots nearby open at 17:30.`}
              </Text>

              <View style={styles.conciergeActionRow}>
                <Text style={styles.conciergeActionText}>Ask Concierge for recommendations →</Text>
              </View>
            </Surface>
          </TouchableOpacity>
        </View>

        {/* ------------------------------------------- QUICK METRICS ROW */}
        <View style={styles.metricsRow}>
          {/* Budget Widget */}
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => router.push(`/trips/${trip.id}/expenses`)}
            style={{ flex: 1 }}
          >
            <Card padding={14} style={styles.metricCard}>
              <View style={styles.metricHeader}>
                <Text style={styles.metricLabel}>BUDGET SPENT</Text>
                <Ionicons name="wallet-outline" size={14} color={TRAVEL_THEME.colors.terracotta} />
              </View>
              <Text style={[styles.metricVal, TABULAR_NUMS]}>
                {fmtMoney(Math.round(totalSpent), trip.homeCurrency)}
              </Text>
              <Text style={[styles.metricSub, TABULAR_NUMS]}>
                of {fmtMoney(trip.budgetAmount, trip.homeCurrency)}
              </Text>
            </Card>
          </TouchableOpacity>

          {/* Packing Readiness Widget */}
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => router.push(`/trips/${trip.id}/packing`)}
            style={{ flex: 1 }}
          >
            <Card padding={14} style={styles.metricCard}>
              <View style={styles.metricHeader}>
                <Text style={styles.metricLabel}>PACK READINESS</Text>
                <Ionicons name="bag-check-outline" size={14} color={TRAVEL_THEME.colors.forest} />
              </View>
              <Text style={[styles.metricVal, { color: TRAVEL_THEME.colors.forest }, TABULAR_NUMS]}>
                {packPct}%
              </Text>
              <Text style={styles.metricSub}>
                {checkedCount} of {totalChecklist} items packed
              </Text>
            </Card>
          </TouchableOpacity>
        </View>

        {/* ------------------------------------------- TRAVEL COMPANION MODULES */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionHeading}>TRAVEL COMPANION MODULES</Text>

          <View style={styles.moduleGrid}>
            <ModuleItem
              icon="calendar-outline"
              title="Timeline"
              subtitle={`${totalStops} planned stops`}
              onPress={() => router.push(`/trips/${trip.id}/itinerary`)}
            />
            <ModuleItem
              icon="map-outline"
              title="Explore Map"
              subtitle="Places & navigation"
              onPress={() => router.push(`/trips/${trip.id}/discover`)}
            />
            <ModuleItem
              icon="card-outline"
              title="Expenses"
              subtitle="Daily spend & receipts"
              onPress={() => router.push(`/trips/${trip.id}/expenses`)}
            />
            <ModuleItem
              icon="document-text-outline"
              title="Travel Vault"
              subtitle={`${documents.length} docs & tickets`}
              onPress={() => router.push(`/trips/${trip.id}/documents`)}
            />
            <ModuleItem
              icon="bed-outline"
              title="Stays & Flights"
              subtitle={`${hotels.length + flights.length} bookings`}
              onPress={() => router.push(`/trips/${trip.id}/reservations`)}
            />
            <ModuleItem
              icon="cash-outline"
              title="Live FX"
              subtitle="Real-time currency"
              onPress={() => router.push(`/trips/${trip.id}/currency`)}
            />
            <ModuleItem
              icon="journal-outline"
              title="Travel Diary"
              subtitle={`${journal.length} memories logged`}
              onPress={() => router.push(`/trips/${trip.id}/journal`)}
            />
            <ModuleItem
              icon="trophy-outline"
              title="Trip Wrapped"
              subtitle="Milestone story"
              onPress={() => router.push(`/trips/${trip.id}/wrapped`)}
            />
          </View>
        </View>
      </ScrollView>

      {/* Floating Bottom Nav */}
      <BottomNav tripId={tripId} activeTab="home" accentColor={TRAVEL_THEME.colors.terracotta} />

      {/* Smart Itinerary Wizard Modal */}
      <SmartItineraryWizard
        visible={wizardVisible}
        onClose={() => setWizardVisible(false)}
        tripBundle={bundle}
        onItineraryApplied={load}
        accentColor={TRAVEL_THEME.colors.terracotta}
      />
    </View>
  );
}

function ModuleItem({
  icon,
  title,
  subtitle,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      style={styles.moduleCardWrapper}
    >
      <Card padding={14} style={styles.moduleCard}>
        <View style={styles.moduleIconContainer}>
          <Ionicons name={icon} size={18} color={TRAVEL_THEME.colors.terracotta} />
        </View>
        <Text style={styles.moduleTitle} numberOfLines={1}>
          {title}
        </Text>
        <Text style={styles.moduleSubtitle} numberOfLines={1}>
          {subtitle}
        </Text>
      </Card>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: TRAVEL_THEME.colors.bg,
  },
  centerContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    backgroundColor: TRAVEL_THEME.colors.bg,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 13,
    color: TRAVEL_THEME.colors.inkMuted,
  },
  errorTitle: {
    fontFamily: "Georgia",
    fontSize: 20,
    fontWeight: "700",
    color: TRAVEL_THEME.colors.inkPrimary,
    marginTop: 12,
  },
  errorDesc: {
    fontSize: 13.5,
    color: TRAVEL_THEME.colors.inkMuted,
    textAlign: "center",
    marginTop: 6,
    maxWidth: 280,
  },
  heroWrapper: {
    height: 320,
    width: "100%",
    position: "relative",
  },
  heroImage: {
    width: "100%",
    height: "100%",
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(28, 25, 23, 0.42)",
  },
  heroTopBar: {
    position: "absolute",
    top: 0,
    left: 16,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    zIndex: 10,
  },
  heroCircleBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(0, 0, 0, 0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
  heroTopRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  heroActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(0, 0, 0, 0.55)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
  },
  heroActionText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  heroTextContainer: {
    position: "absolute",
    bottom: 28,
    left: 16,
    right: 16,
  },
  heroBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 6,
  },
  heroCityTitle: {
    fontFamily: "Georgia",
    fontSize: 32,
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: -0.3,
  },
  heroTagline: {
    fontSize: 12.5,
    color: "rgba(255, 255, 255, 0.82)",
    fontStyle: "italic",
    marginTop: 2,
  },
  heroMetaRow: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  heroDateItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  heroDateText: {
    fontSize: 12,
    fontWeight: "600",
    color: "rgba(255, 255, 255, 0.9)",
  },
  weatherBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(0, 0, 0, 0.45)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.15)",
  },
  weatherTemp: {
    fontSize: 12,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  weatherCond: {
    fontSize: 11,
    color: "rgba(255, 255, 255, 0.75)",
  },
  pulseCardWrapper: {
    paddingHorizontal: 16,
    marginTop: -16,
    zIndex: 20,
  },
  pulseCard: {
    backgroundColor: TRAVEL_THEME.colors.surface,
    borderColor: TRAVEL_THEME.colors.border,
    ...TRAVEL_THEME.shadows.hover,
  },
  pulseHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  pulseLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  pulseDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: TRAVEL_THEME.colors.terracotta,
  },
  pulseLabel: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.2,
    color: TRAVEL_THEME.colors.terracotta,
  },
  pulseBody: {
    marginTop: 8,
  },
  pulseTitle: {
    fontFamily: "Georgia",
    fontSize: 18,
    fontWeight: "700",
    color: TRAVEL_THEME.colors.inkPrimary,
  },
  pulseMetaRow: {
    marginTop: 4,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  pulseMetaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3.5,
  },
  pulseMetaText: {
    fontSize: 12,
    color: TRAVEL_THEME.colors.inkMuted,
  },
  pulseEmpty: {
    marginTop: 6,
  },
  pulseEmptyText: {
    fontSize: 13,
    color: TRAVEL_THEME.colors.inkMuted,
    lineHeight: 18,
  },
  pulseFooter: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: TRAVEL_THEME.colors.borderSubtle,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  pulseActionLink: {
    paddingVertical: 4,
  },
  pulseActionLinkText: {
    fontSize: 12.5,
    fontWeight: "700",
    color: TRAVEL_THEME.colors.terracotta,
  },
  sectionContainer: {
    paddingHorizontal: 16,
    marginTop: 16,
  },
  sectionHeading: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.2,
    color: TRAVEL_THEME.colors.inkMuted,
    marginBottom: 10,
    paddingHorizontal: 2,
  },
  conciergeCard: {
    padding: 16,
    borderWidth: 1,
    borderColor: TRAVEL_THEME.colors.border,
    backgroundColor: TRAVEL_THEME.colors.surfaceWarm,
  },
  conciergeHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  conciergeIconTitle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  conciergeLabel: {
    fontSize: 10.5,
    fontWeight: "800",
    letterSpacing: 1,
    color: TRAVEL_THEME.colors.terracotta,
  },
  conciergeQuote: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 19,
    color: TRAVEL_THEME.colors.inkSecondary,
  },
  conciergeActionRow: {
    marginTop: 10,
  },
  conciergeActionText: {
    fontSize: 12,
    fontWeight: "700",
    color: TRAVEL_THEME.colors.terracotta,
  },
  metricsRow: {
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 16,
    marginTop: 14,
  },
  metricCard: {
    backgroundColor: TRAVEL_THEME.colors.surface,
  },
  metricHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  metricLabel: {
    fontSize: 9.5,
    fontWeight: "800",
    letterSpacing: 0.8,
    color: TRAVEL_THEME.colors.inkMuted,
  },
  metricVal: {
    fontFamily: "Georgia",
    fontSize: 20,
    fontWeight: "700",
    color: TRAVEL_THEME.colors.inkPrimary,
    marginTop: 4,
  },
  metricSub: {
    fontSize: 11,
    color: TRAVEL_THEME.colors.inkMuted,
    marginTop: 2,
  },
  moduleGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  moduleCardWrapper: {
    width: "48.4%",
  },
  moduleCard: {
    backgroundColor: TRAVEL_THEME.colors.surface,
    borderRadius: 16,
  },
  moduleIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: TRAVEL_THEME.colors.surfaceWarm,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  moduleTitle: {
    fontSize: 13.5,
    fontWeight: "700",
    color: TRAVEL_THEME.colors.inkPrimary,
  },
  moduleSubtitle: {
    fontSize: 11,
    color: TRAVEL_THEME.colors.inkMuted,
    marginTop: 2,
  },
});
