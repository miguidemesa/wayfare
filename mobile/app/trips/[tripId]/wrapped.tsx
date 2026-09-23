import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { fetchTripBundle } from "@/shared/api";
import {
  resolveDestinationTheme,
  fmtMoney,
  tripDayCount,
  TABULAR_NUMS,
  TRAVEL_THEME,
} from "@/shared/theme";
import { getDestinationImages } from "@/shared/images";
import { EXPENSE_CATEGORY_LABELS, type TripBundle } from "@/shared/types";
import { Header } from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";
import { Card, Surface } from "@/components/ui/Surface";
import { Badge } from "@/components/ui/Badge";

export default function WrappedScreen() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const insets = useSafeAreaInsets();
  const [bundle, setBundle] = useState<TripBundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await fetchTripBundle(tripId);
      setBundle(data);
    } catch {} finally {
      setLoading(false);
    }
  }, [tripId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading || !bundle) {
    return (
      <View style={[styles.centerContainer, { paddingTop: insets.top }]}>
        <ActivityIndicator color={TRAVEL_THEME.colors.terracotta} size="large" />
      </View>
    );
  }

  const { trip, destinations, days, expenses, hotels, flights, journal } = bundle;
  const theme = resolveDestinationTheme(destinations, trip.coverTheme);
  const cityName = destinations[0]?.name || theme.city || "Tokyo";
  const images = getDestinationImages(cityName);

  const totalDays = Math.max(days.length, tripDayCount(trip.startDate, trip.endDate));
  const totalSpent = expenses.reduce((s, e) => s + e.amountHome, 0);

  // Category aggregations
  const catTotals: Record<string, number> = {};
  for (const e of expenses) catTotals[e.category] = (catTotals[e.category] ?? 0) + e.amountHome;
  const topCat = Object.entries(catTotals).sort((a, b) => b[1] - a[1])[0];

  // Stops & Cities
  const totalStops = days.reduce((s, d) => s + d.items.length, 0);

  // Most expensive meal
  const foodExpenses = expenses.filter((e) => e.category === "FOOD");
  const priciestMeal = [...foodExpenses].sort((a, b) => b.amountHome - a.amountHome)[0];

  // Footprint estimates
  const estKm = totalStops * 4.2 + flights.length * 2800;
  const estSteps = totalStops * 4800 + totalDays * 6200;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Editorial Header */}
      <Header
        eyebrow="JOURNEY RECAP"
        title="Wayfare Wrapped"
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
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
        {/* Card 1: Cinematic Poster Story Card */}
        <Surface variant="card" borderRadius={24} style={styles.posterCard}>
          <View style={styles.posterImageWrapper}>
            <Image source={{ uri: images.hero }} style={styles.posterImage} resizeMode="cover" />
            <View style={styles.posterOverlay} />

            <View style={styles.posterBadgeWrapper}>
              <Badge label="WAYFARE WRAPPED · RECAP" variant="dark" size="sm" />
            </View>

            <View style={styles.posterTextContent}>
              <Text style={styles.posterTitle}>{trip.title}</Text>
              <Text style={styles.posterSubtitle}>
                {cityName} in {totalDays} unforgettable days.
              </Text>
            </View>
          </View>
        </Surface>

        {/* Card 2: Exploration Footprint */}
        <Card padding={20} style={styles.footprintCard}>
          <Text style={styles.sectionEyebrow}>EXPLORATION FOOTPRINT</Text>

          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={[styles.statNumber, { color: TRAVEL_THEME.colors.terracotta }, TABULAR_NUMS]}>
                {totalStops}
              </Text>
              <Text style={styles.statLabel}>Curated Stops</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={[styles.statNumber, TABULAR_NUMS]}>
                {Math.round(estKm)}
              </Text>
              <Text style={styles.statLabel}>Kilometers</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={[styles.statNumber, { color: TRAVEL_THEME.colors.ocean }, TABULAR_NUMS]}>
                {Math.round(estSteps / 1000)}k
              </Text>
              <Text style={styles.statLabel}>Total Steps</Text>
            </View>
          </View>
        </Card>

        {/* Card 3: Financial Investment */}
        <Card padding={20} style={styles.financeCard}>
          <Text style={styles.sectionEyebrow}>FINANCIAL INVESTMENT</Text>
          <Text style={[styles.bigFinanceNum, TABULAR_NUMS]}>
            {fmtMoney(Math.round(totalSpent), trip.homeCurrency)}
          </Text>
          <Text style={styles.financeSub}>Total Journey Investment</Text>

          {topCat && (
            <View style={styles.highlightRow}>
              <View style={styles.highlightIconBubble}>
                <Ionicons name="pie-chart-outline" size={16} color={TRAVEL_THEME.colors.terracotta} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.highlightLabel}>TOP SPEND CATEGORY</Text>
                <Text style={[styles.highlightValue, TABULAR_NUMS]}>
                  {EXPENSE_CATEGORY_LABELS[topCat[0]] ?? topCat[0]} · {fmtMoney(Math.round(topCat[1]), trip.homeCurrency)}
                </Text>
              </View>
            </View>
          )}

          {priciestMeal && (
            <View style={[styles.highlightRow, { marginTop: 8 }]}>
              <View style={[styles.highlightIconBubble, { backgroundColor: TRAVEL_THEME.colors.amberLight }]}>
                <Ionicons name="restaurant-outline" size={16} color={TRAVEL_THEME.colors.amberDark} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.highlightLabel}>TOP DINING EXPERIENCE</Text>
                <Text style={[styles.highlightValue, TABULAR_NUMS]}>
                  {priciestMeal.merchant} · {fmtMoney(priciestMeal.amountHome, trip.homeCurrency)}
                </Text>
              </View>
            </View>
          )}
        </Card>

        {/* Card 4: Logistics Conquered */}
        <Card padding={20} style={styles.logisticsCard}>
          <Text style={styles.sectionEyebrow}>LOGISTICS & MEMORIES CONQUERED</Text>

          <View style={styles.logisticsRow}>
            <View style={styles.logisticsBox}>
              <Ionicons name="bed-outline" size={22} color={TRAVEL_THEME.colors.ocean} />
              <Text style={[styles.logisticsNum, TABULAR_NUMS]}>{hotels.length}</Text>
              <Text style={styles.logisticsLabel}>Stays</Text>
            </View>
            <View style={styles.logisticsBox}>
              <Ionicons name="airplane-outline" size={22} color={TRAVEL_THEME.colors.terracotta} />
              <Text style={[styles.logisticsNum, TABULAR_NUMS]}>{flights.length}</Text>
              <Text style={styles.logisticsLabel}>Flights</Text>
            </View>
            <View style={styles.logisticsBox}>
              <Ionicons name="journal-outline" size={22} color={TRAVEL_THEME.colors.forest} />
              <Text style={[styles.logisticsNum, TABULAR_NUMS]}>{journal.length}</Text>
              <Text style={styles.logisticsLabel}>Memories</Text>
            </View>
          </View>
        </Card>
      </ScrollView>

      {/* Floating Bottom Nav */}
      <BottomNav tripId={tripId} activeTab="wallet" accentColor={TRAVEL_THEME.colors.terracotta} />
    </View>
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
    backgroundColor: TRAVEL_THEME.colors.bg,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 110,
    gap: 16,
  },
  posterCard: {
    overflow: "hidden",
    ...TRAVEL_THEME.shadows.card,
  },
  posterImageWrapper: {
    height: 230,
    width: "100%",
    position: "relative",
  },
  posterImage: {
    width: "100%",
    height: "100%",
  },
  posterOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(28, 25, 23, 0.42)",
  },
  posterBadgeWrapper: {
    position: "absolute",
    top: 14,
    left: 14,
  },
  posterTextContent: {
    position: "absolute",
    bottom: 16,
    left: 16,
    right: 16,
  },
  posterTitle: {
    fontFamily: "Georgia",
    fontSize: 30,
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: -0.3,
  },
  posterSubtitle: {
    fontSize: 13,
    fontWeight: "500",
    color: "rgba(255, 255, 255, 0.85)",
    marginTop: 3,
  },
  sectionEyebrow: {
    fontSize: 9.5,
    fontWeight: "800",
    letterSpacing: 1.2,
    color: TRAVEL_THEME.colors.inkMuted,
  },
  footprintCard: {
    backgroundColor: TRAVEL_THEME.colors.surface,
    borderColor: TRAVEL_THEME.colors.border,
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 14,
  },
  statBox: {
    flex: 1,
  },
  statNumber: {
    fontFamily: "Georgia",
    fontSize: 32,
    fontWeight: "700",
    color: TRAVEL_THEME.colors.inkPrimary,
  },
  statLabel: {
    fontSize: 12,
    color: TRAVEL_THEME.colors.inkMuted,
    marginTop: 2,
  },
  financeCard: {
    backgroundColor: TRAVEL_THEME.colors.surface,
    borderColor: TRAVEL_THEME.colors.border,
  },
  bigFinanceNum: {
    fontFamily: "Georgia",
    fontSize: 34,
    fontWeight: "700",
    color: TRAVEL_THEME.colors.inkPrimary,
    marginTop: 8,
    letterSpacing: -0.5,
  },
  financeSub: {
    fontSize: 12.5,
    color: TRAVEL_THEME.colors.inkMuted,
    marginTop: 2,
  },
  highlightRow: {
    marginTop: 14,
    backgroundColor: TRAVEL_THEME.colors.surfaceWarm,
    borderRadius: 12,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: TRAVEL_THEME.colors.border,
  },
  highlightIconBubble: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: TRAVEL_THEME.colors.terracottaLight,
    alignItems: "center",
    justifyContent: "center",
  },
  highlightLabel: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.8,
    color: TRAVEL_THEME.colors.inkMuted,
  },
  highlightValue: {
    fontSize: 13.5,
    fontWeight: "700",
    color: TRAVEL_THEME.colors.inkPrimary,
    marginTop: 1,
  },
  logisticsCard: {
    backgroundColor: TRAVEL_THEME.colors.surface,
    borderColor: TRAVEL_THEME.colors.border,
  },
  logisticsRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 14,
  },
  logisticsBox: {
    flex: 1,
    backgroundColor: TRAVEL_THEME.colors.surfaceWarm,
    borderRadius: 14,
    padding: 12,
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    borderColor: TRAVEL_THEME.colors.border,
  },
  logisticsNum: {
    fontFamily: "Georgia",
    fontSize: 20,
    fontWeight: "700",
    color: TRAVEL_THEME.colors.inkPrimary,
    marginTop: 2,
  },
  logisticsLabel: {
    fontSize: 11,
    fontWeight: "500",
    color: TRAVEL_THEME.colors.inkMuted,
  },
});
