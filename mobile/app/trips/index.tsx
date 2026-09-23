import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { router, Stack } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/lib/auth";
import { deleteTrip, fetchTrips } from "@/shared/api";
import {
  daysUntil,
  fmtDate,
  fmtMoney,
  resolveDestinationTheme,
  TABULAR_NUMS,
  tripDayCount,
  TRAVEL_THEME,
  type DestinationTheme,
} from "@/shared/theme";
import { getDestinationImages } from "@/shared/images";
import type { TripSummary } from "@/shared/types";
import { Surface } from "@/components/ui/Surface";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";

export default function TripsScreen() {
  const { signOut } = useAuth();
  const insets = useSafeAreaInsets();
  const [trips, setTrips] = useState<TripSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setTrips(await fetchTrips());
      setError(null);
    } catch {
      setError("Couldn't load your journeys. Pull down to refresh.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleDelete(tripId: string, title: string) {
    Alert.alert(
      "Delete Journey",
      `Are you sure you want to remove "${title}"? All itinerary stops, budget entries, and vault notes will be deleted.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteTrip(tripId);
              setTrips((prev) => (prev ? prev.filter((t) => t.id !== tripId) : null));
            } catch {
              Alert.alert("Error", "Could not delete trip.");
            }
          },
        },
      ]
    );
  }

  const upcoming = (trips ?? []).filter((t) => t.status !== "COMPLETED");
  const past = (trips ?? []).filter((t) => t.status === "COMPLETED");

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Editorial Top Navigation Header */}
      <View style={styles.header}>
        <View>
          <View style={styles.eyebrowRow}>
            <Ionicons name="compass" size={13} color={TRAVEL_THEME.colors.terracotta} />
            <Text style={styles.eyebrowText}>WAYFARE</Text>
          </View>
          <Text style={styles.headerTitle}>Your Journeys</Text>
        </View>

        <View style={styles.headerActions}>
          <Button
            label="New Trip"
            iconLeft={<Ionicons name="add" size={16} color="#FFFFFF" />}
            variant="primary"
            size="sm"
            onPress={() => router.push("/trips/new")}
          />
          <TouchableOpacity
            onPress={() => void signOut().then(() => router.replace("/login"))}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={styles.profileBtn}
          >
            <Ionicons name="log-out-outline" size={17} color={TRAVEL_THEME.colors.inkSecondary} />
          </TouchableOpacity>
        </View>
      </View>

      {trips === null && !error ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={TRAVEL_THEME.colors.terracotta} size="large" />
          <Text style={styles.loadingText}>Loading journeys…</Text>
        </View>
      ) : (
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
          {error ? (
            <View style={styles.errorBanner}>
              <Ionicons name="alert-circle" size={16} color={TRAVEL_THEME.colors.danger} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {upcoming.length === 0 && past.length === 0 && !error ? (
            <EmptyState
              icon={<Ionicons name="map-outline" size={48} color={TRAVEL_THEME.colors.terracotta} />}
              title="No journeys planned yet"
              description="Craft your first itinerary with curated destination themes, smart transit routing, live FX, and an AI travel concierge."
              actionLabel="Create First Journey"
              onAction={() => router.push("/trips/new")}
            />
          ) : null}

          {/* Upcoming Journeys Section */}
          {upcoming.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionHeader}>UPCOMING ADVENTURES ({upcoming.length})</Text>
              <View style={styles.tripList}>
                {upcoming.map((t, idx) => (
                  <EditorialTripCard
                    key={t.id}
                    trip={t}
                    isHero={idx === 0}
                    onDelete={() => handleDelete(t.id, t.title)}
                  />
                ))}
              </View>
            </View>
          )}

          {/* Past Journeys Section */}
          {past.length > 0 && (
            <View style={[styles.section, { marginTop: 24 }]}>
              <Text style={styles.sectionHeader}>PAST MEMORIES ({past.length})</Text>
              <View style={styles.tripList}>
                {past.map((t) => (
                  <EditorialTripCard
                    key={t.id}
                    trip={t}
                    isHero={false}
                    onDelete={() => handleDelete(t.id, t.title)}
                  />
                ))}
              </View>
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

function EditorialTripCard({
  trip,
  isHero = false,
  onDelete,
}: {
  trip: TripSummary;
  isHero?: boolean;
  onDelete: () => void;
}) {
  const theme: DestinationTheme = resolveDestinationTheme(trip.destinations, trip.coverTheme);
  const destName = trip.destinations[0]?.name || theme.city || "Tokyo";
  const images = getDestinationImages(destName);
  const days = tripDayCount(trip.startDate, trip.endDate);
  const until = daysUntil(trip.startDate);
  const isActive = trip.status === "ACTIVE";
  const isCompleted = trip.status === "COMPLETED";

  return (
    <TouchableOpacity
      activeOpacity={0.88}
      onPress={() => router.push(`/trips/${trip.id}`)}
      style={styles.cardTouchable}
    >
      <Surface variant="card" borderRadius={20} style={styles.cardSurface}>
        {/* Cover Photo Header */}
        <View style={[styles.photoHeader, { height: isHero ? 190 : 135 }]}>
          <Image
            source={{ uri: isHero ? images.hero : images.thumb }}
            style={styles.coverImage}
            resizeMode="cover"
          />
          {/* Subtle Warm Gradient Shade */}
          <View style={styles.imageOverlay} />

          {/* Top Pill Row */}
          <View style={styles.photoTopRow}>
            <View style={styles.badgeCluster}>
              <Badge
                label={theme.country ? theme.country.toUpperCase() : "JOURNEY"}
                variant="dark"
                size="sm"
              />
              {isActive && (
                <Badge
                  label="LIVE NOW"
                  variant="forest"
                  size="sm"
                />
              )}
            </View>

            <TouchableOpacity
              onPress={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={styles.moreBtn}
            >
              <Ionicons name="ellipsis-horizontal" size={15} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          {/* Bottom Title on Image */}
          <View style={styles.photoBottomRow}>
            <Text style={styles.tripTitleOnPhoto} numberOfLines={1}>
              {trip.title}
            </Text>
            {trip.subtitle ? (
              <Text style={styles.tripSubtitleOnPhoto} numberOfLines={1}>
                {trip.subtitle}
              </Text>
            ) : null}
          </View>
        </View>

        {/* Card Body Details */}
        <View style={styles.cardBody}>
          <View style={styles.metaRow}>
            <View style={styles.dateRow}>
              <Ionicons name="calendar-outline" size={14} color={TRAVEL_THEME.colors.inkMuted} />
              <Text style={[styles.dateText, TABULAR_NUMS]}>
                {fmtDate(trip.startDate)} – {fmtDate(trip.endDate, { month: "short", day: "numeric", year: "numeric" })} · {days} days
              </Text>
            </View>

            <Text
              style={[
                styles.statusTag,
                {
                  color: isActive
                    ? TRAVEL_THEME.colors.forest
                    : isCompleted
                      ? TRAVEL_THEME.colors.inkMuted
                      : TRAVEL_THEME.colors.terracotta,
                },
              ]}
            >
              {isActive
                ? "● Active Journey"
                : isCompleted
                  ? "✓ Completed"
                  : `In ${until} days`}
            </Text>
          </View>

          {/* Quick Stats Footnote */}
          <View style={styles.footnoteRow}>
            <View style={styles.statItem}>
              <Ionicons name="map-outline" size={12} color={TRAVEL_THEME.colors.inkMuted} />
              <Text style={[styles.statText, TABULAR_NUMS]}>
                {trip._count.items} stops planned
              </Text>
            </View>
            <View style={styles.statItem}>
              <Ionicons name="wallet-outline" size={12} color={TRAVEL_THEME.colors.inkMuted} />
              <Text style={[styles.statText, TABULAR_NUMS]}>
                {fmtMoney(trip.spent, trip.homeCurrency)} spent
              </Text>
            </View>
            <View style={styles.statItem}>
              <Ionicons name="people-outline" size={12} color={TRAVEL_THEME.colors.inkMuted} />
              <Text style={[styles.statText, TABULAR_NUMS]}>
                {trip.travelersCount}
              </Text>
            </View>
          </View>
        </View>
      </Surface>
    </TouchableOpacity>
  );
}


const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: TRAVEL_THEME.colors.bg,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: TRAVEL_THEME.colors.border,
    backgroundColor: TRAVEL_THEME.colors.bg,
  },
  eyebrowRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  eyebrowText: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 2,
    color: TRAVEL_THEME.colors.terracotta,
  },
  headerTitle: {
    fontFamily: "Georgia",
    fontSize: 26,
    fontWeight: "700",
    color: TRAVEL_THEME.colors.inkPrimary,
    letterSpacing: -0.3,
    marginTop: 2,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  profileBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: TRAVEL_THEME.colors.surface,
    borderWidth: 1,
    borderColor: TRAVEL_THEME.colors.border,
    alignItems: "center",
    justifyContent: "center",
    ...TRAVEL_THEME.shadows.card,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 40,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  loadingText: {
    fontSize: 13,
    color: TRAVEL_THEME.colors.inkMuted,
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: TRAVEL_THEME.colors.dangerLight,
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#F4D2CE",
  },
  errorText: {
    fontSize: 13,
    color: TRAVEL_THEME.colors.danger,
    flex: 1,
  },
  section: {
    gap: 10,
  },
  sectionHeader: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.5,
    color: TRAVEL_THEME.colors.inkMuted,
    paddingHorizontal: 2,
  },
  tripList: {
    gap: 16,
  },
  cardTouchable: {
    borderRadius: 20,
    ...TRAVEL_THEME.shadows.card,
  },
  cardSurface: {
    backgroundColor: TRAVEL_THEME.colors.surface,
    borderColor: TRAVEL_THEME.colors.border,
  },
  photoHeader: {
    width: "100%",
    position: "relative",
  },
  coverImage: {
    width: "100%",
    height: "100%",
  },
  imageOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(28, 25, 23, 0.35)",
  },
  photoTopRow: {
    position: "absolute",
    top: 12,
    left: 12,
    right: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  badgeCluster: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  moreBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    alignItems: "center",
    justifyContent: "center",
  },
  photoBottomRow: {
    position: "absolute",
    bottom: 12,
    left: 14,
    right: 14,
  },
  tripTitleOnPhoto: {
    fontFamily: "Georgia",
    fontSize: 22,
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: -0.2,
  },
  tripSubtitleOnPhoto: {
    fontSize: 12,
    fontWeight: "500",
    color: "rgba(255, 255, 255, 0.8)",
    marginTop: 2,
  },
  cardBody: {
    padding: 14,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  dateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  dateText: {
    fontSize: 12,
    fontWeight: "500",
    color: TRAVEL_THEME.colors.inkSecondary,
  },
  statusTag: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  footnoteRow: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: TRAVEL_THEME.colors.borderSubtle,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  statItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  statText: {
    fontSize: 11.5,
    fontWeight: "500",
    color: TRAVEL_THEME.colors.inkMuted,
  },
});
