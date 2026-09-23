import { useCallback, useEffect, useState } from "react";
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
import { Stack, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import {
  addItineraryItem,
  deleteSavedPlace,
  fetchPlaces,
  fetchTripBundle,
  savePlace,
} from "@/shared/api";
import { resolveDestinationTheme, TABULAR_NUMS, TRAVEL_THEME } from "@/shared/theme";
import { CATEGORY_PLACEHOLDERS } from "@/shared/images";
import type { POI, SavedPlace, TripBundle } from "@/shared/types";
import { Header } from "@/components/Header";
import { TravelMap, getPlaceId } from "@/components/TravelMap";
import { DraggableSheet } from "@/components/DraggableSheet";
import { BottomNav } from "@/components/BottomNav";
import { Card } from "@/components/ui/Surface";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { EmptyState } from "@/components/ui/EmptyState";

const CATEGORY_CHIPS = [
  { key: "all", label: "All Spots", icon: "compass-outline" },
  { key: "FOOD", label: "Dining", icon: "restaurant-outline" },
  { key: "ATTRACTION", label: "Sights", icon: "sparkles-outline" },
  { key: "CAFE", label: "Cafes", icon: "cafe-outline" },
  { key: "SHOPPING", label: "Shopping", icon: "bag-handle-outline" },
  { key: "PARK", label: "Nature", icon: "leaf-outline" },
];

export default function DiscoverScreen() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const insets = useSafeAreaInsets();
  const [bundle, setBundle] = useState<TripBundle | null>(null);
  const [places, setPlaces] = useState<POI[]>([]);
  const [savedPlaces, setSavedPlaces] = useState<SavedPlace[]>([]);
  const [selectedPlace, setSelectedPlace] = useState<POI | SavedPlace | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [activeTab, setActiveTab] = useState<"MAP" | "EXPLORE" | "SAVED">("MAP");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");

  const load = useCallback(async () => {
    try {
      const b = await fetchTripBundle(tripId);
      setBundle(b);
      setSavedPlaces(b.savedPlaces);

      const res = await fetchPlaces(tripId, {
        category: category !== "all" ? category : undefined,
        q: search.trim() || undefined,
      });
      setPlaces(res.places);
      if (res.places.length > 0 && !selectedPlace) {
        setSelectedPlace(res.places[0]);
      }
    } catch {} finally {
      setLoading(false);
    }
  }, [tripId, category, search]);

  useEffect(() => {
    void load();
  }, [load]);

  const cityName = bundle?.destinations[0]?.name || "Tokyo";

  async function handleToggleSave(poi: POI | SavedPlace) {
    try {
      const isPoi = "poiId" in poi;
      const isSaved = isPoi ? poi.saved : true;

      if (isSaved) {
        const saved = savedPlaces.find((s) => s.name === poi.name);
        if (saved) {
          setSavedPlaces((prev) => prev.filter((s) => s.id !== saved.id));
          setPlaces((prev) => prev.map((p) => (p.name === poi.name ? { ...p, saved: false } : p)));
          await deleteSavedPlace(tripId, saved.id);
        }
      } else if (isPoi) {
        setPlaces((prev) => prev.map((p) => (p.poiId === poi.poiId ? { ...p, saved: true } : p)));
        const res = await savePlace(tripId, poi.poiId);
        setSavedPlaces((prev) => [res.savedPlace, ...prev]);
      }
    } catch {
      void load();
    }
  }

  async function handleAddToItinerary(poi: POI | SavedPlace) {
    if (!bundle || bundle.days.length === 0) {
      Alert.alert("Notice", "Please create an itinerary day chapter first.");
      return;
    }
    const day = bundle.days[0];
    try {
      await addItineraryItem(tripId, {
        dayId: day.id,
        title: poi.name,
        type:
          "category" in poi && (poi.category === "RESTAURANT" || poi.category === "CAFE")
            ? "RESTAURANT"
            : "ACTIVITY",
        durationMin: 60,
        placeName: poi.name,
      });
      Alert.alert("Stop Added!", `"${poi.name}" was added to Day 1 of your journey.`);
    } catch {
      Alert.alert("Error", "Could not add to itinerary.");
    }
  }

  const isSavedSelected =
    selectedPlace != null && savedPlaces.some((s) => s.name === selectedPlace.name);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Editorial Header */}
      <Header
        eyebrow={`${cityName.toUpperCase()} · EXPLORATION`}
        title="Map & Places"
      />

      {/* Top Search & Filter Bar */}
      <View style={styles.topControlBar}>
        {/* Search Input */}
        <View style={styles.searchRow}>
          <Ionicons name="search" size={16} color={TRAVEL_THEME.colors.inkMuted} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder={`Search places in ${cityName}…`}
            placeholderTextColor={TRAVEL_THEME.colors.inkDim}
            style={styles.searchInput}
          />
          {search ? (
            <TouchableOpacity onPress={() => setSearch("")} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close-circle" size={16} color={TRAVEL_THEME.colors.inkMuted} />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* View Mode Segmented Control */}
        <SegmentedControl
          options={[
            {
              key: "MAP",
              label: "Map Canvas",
              icon: <Ionicons name="map-outline" size={14} color={TRAVEL_THEME.colors.inkPrimary} />,
            },
            {
              key: "EXPLORE",
              label: `Explore (${places.length})`,
              icon: <Ionicons name="list-outline" size={14} color={TRAVEL_THEME.colors.inkPrimary} />,
            },
            {
              key: "SAVED",
              label: `Saved (${savedPlaces.length})`,
              icon: <Ionicons name="bookmark-outline" size={14} color={TRAVEL_THEME.colors.inkPrimary} />,
            },
          ]}
          value={activeTab}
          onChange={setActiveTab}
          accentColor={TRAVEL_THEME.colors.terracotta}
        />

        {/* Category Filter Chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsScroll}
        >
          {CATEGORY_CHIPS.map((c) => {
            const isSelected = category === c.key;
            return (
              <TouchableOpacity
                key={c.key}
                onPress={() => setCategory(c.key)}
                activeOpacity={0.8}
                style={[
                  styles.chip,
                  isSelected && styles.chipSelected,
                ]}
              >
                <Ionicons
                  name={c.icon as any}
                  size={12}
                  color={isSelected ? TRAVEL_THEME.colors.terracottaDark : TRAVEL_THEME.colors.inkMuted}
                />
                <Text
                  style={[
                    styles.chipText,
                    isSelected && styles.chipTextSelected,
                  ]}
                >
                  {c.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Main Content Surface */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={TRAVEL_THEME.colors.terracotta} size="large" />
          <Text style={styles.loadingText}>Locating places in {cityName}…</Text>
        </View>
      ) : activeTab === "MAP" ? (
        <View style={styles.mapViewArea}>
          <TravelMap
            places={places}
            selectedPlaceId={selectedPlace ? getPlaceId(selectedPlace) : undefined}
            onSelectPlace={(p) => setSelectedPlace(p)}
            accentColor={TRAVEL_THEME.colors.terracotta}
            cityName={cityName}
          />

          {/* Place Inspection Bottom Drawer */}
          {selectedPlace && (
            <DraggableSheet
              place={selectedPlace}
              onClose={() => setSelectedPlace(null)}
              onAddToItinerary={handleAddToItinerary}
              onToggleSave={handleToggleSave}
              isSaved={isSavedSelected}
              accentColor={TRAVEL_THEME.colors.terracotta}
              homeCurrency={bundle?.trip.homeCurrency}
            />
          )}
        </View>
      ) : activeTab === "EXPLORE" ? (
        <ScrollView
          contentContainerStyle={styles.listScroll}
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
          {places.length === 0 ? (
            <EmptyState
              icon={<Ionicons name="search-outline" size={40} color={TRAVEL_THEME.colors.terracotta} />}
              title="No matching spots found"
              description={`No places found for "${search}" in ${cityName}. Try changing your category filter.`}
            />
          ) : (
            places.map((p) => {
              const isSaved = savedPlaces.some((s) => s.name === p.name);
              const img =
                CATEGORY_PLACEHOLDERS[p.category] || CATEGORY_PLACEHOLDERS.ATTRACTION;

              return (
                <Card key={p.poiId} padding={12} style={styles.poiCard}>
                  <View style={styles.poiRow}>
                    <Image source={{ uri: img }} style={styles.poiImage} resizeMode="cover" />
                    <View style={styles.poiBody}>
                      <View style={styles.poiTitleRow}>
                        <Text style={styles.poiTitle} numberOfLines={1}>
                          {p.name}
                        </Text>
                        <TouchableOpacity
                          onPress={() => handleToggleSave(p)}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Ionicons
                            name={isSaved ? "bookmark" : "bookmark-outline"}
                            size={18}
                            color={isSaved ? TRAVEL_THEME.colors.terracotta : TRAVEL_THEME.colors.inkMuted}
                          />
                        </TouchableOpacity>
                      </View>

                      <Text style={styles.poiBlurb} numberOfLines={2}>
                        {p.blurb}
                      </Text>

                      <View style={styles.poiFooterRow}>
                        <View style={styles.poiMetaLeft}>
                          <Badge
                            label={`${(p.rating || 4.8).toFixed(1)} ★`}
                            variant="amber"
                            size="sm"
                          />
                          <Text style={[styles.poiWalkText, TABULAR_NUMS]}>
                            {p.walkMin ?? 12}m walk
                          </Text>
                        </View>
                        <Button
                          label="Add"
                          iconLeft={<Ionicons name="add" size={14} color="#FFFFFF" />}
                          variant="primary"
                          size="sm"
                          onPress={() => handleAddToItinerary(p)}
                        />
                      </View>
                    </View>
                  </View>
                </Card>
              );
            })
          )}
        </ScrollView>
      ) : (
        /* SAVED PLACES TAB */
        <ScrollView contentContainerStyle={styles.listScroll} showsVerticalScrollIndicator={false}>
          {savedPlaces.length === 0 ? (
            <EmptyState
              icon={<Ionicons name="bookmark-outline" size={40} color={TRAVEL_THEME.colors.terracotta} />}
              title="No saved places yet"
              description="Tap the bookmark icon on any place in the map or explore list to keep it in your saved favorites."
            />
          ) : (
            savedPlaces.map((sp) => (
              <Card key={sp.id} padding={14} style={styles.poiCard}>
                <View style={styles.savedCardRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.poiTitle}>{sp.name}</Text>
                    {sp.address ? (
                      <Text style={styles.poiBlurb} numberOfLines={1}>
                        {sp.address}
                      </Text>
                    ) : null}
                    <View style={{ flexDirection: "row", gap: 6, marginTop: 6 }}>
                      <Badge label={sp.category || "SAVED"} variant="terracotta" size="sm" />
                      {sp.rating && (
                        <Badge label={`${sp.rating.toFixed(1)} ★`} variant="amber" size="sm" />
                      )}
                    </View>
                  </View>

                  <View style={styles.savedActions}>
                    <Button
                      label="Add to Day"
                      variant="primary"
                      size="sm"
                      onPress={() => handleAddToItinerary(sp)}
                    />
                    <TouchableOpacity
                      onPress={() => handleToggleSave(sp)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      style={styles.savedDeleteBtn}
                    >
                      <Ionicons name="trash-outline" size={16} color={TRAVEL_THEME.colors.danger} />
                    </TouchableOpacity>
                  </View>
                </View>
              </Card>
            ))
          )}
        </ScrollView>
      )}

      {/* Floating Bottom Nav */}
      <BottomNav tripId={tripId} activeTab="map" accentColor={TRAVEL_THEME.colors.terracotta} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: TRAVEL_THEME.colors.bg,
  },
  topControlBar: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    gap: 8,
    backgroundColor: TRAVEL_THEME.colors.bg,
    borderBottomWidth: 1,
    borderBottomColor: TRAVEL_THEME.colors.border,
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: TRAVEL_THEME.colors.surfaceWarm,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: TRAVEL_THEME.colors.border,
  },
  searchInput: {
    flex: 1,
    fontSize: 13.5,
    color: TRAVEL_THEME.colors.inkPrimary,
    padding: 0,
  },
  chipsScroll: {
    gap: 7,
    paddingVertical: 2,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: TRAVEL_THEME.colors.surfaceWarm,
    borderWidth: 1,
    borderColor: TRAVEL_THEME.colors.border,
  },
  chipSelected: {
    backgroundColor: TRAVEL_THEME.colors.terracottaLight,
    borderColor: "#F0D7D0",
  },
  chipText: {
    fontSize: 11.5,
    fontWeight: "500",
    color: TRAVEL_THEME.colors.inkSecondary,
  },
  chipTextSelected: {
    fontWeight: "700",
    color: TRAVEL_THEME.colors.terracottaDark,
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
  mapViewArea: {
    flex: 1,
    paddingHorizontal: 14,
    paddingTop: 12,
    position: "relative",
  },
  listScroll: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 110,
    gap: 12,
  },
  poiCard: {
    backgroundColor: TRAVEL_THEME.colors.surface,
    borderColor: TRAVEL_THEME.colors.border,
  },
  poiRow: {
    flexDirection: "row",
    gap: 12,
  },
  poiImage: {
    width: 80,
    height: 80,
    borderRadius: 12,
  },
  poiBody: {
    flex: 1,
    justifyContent: "space-between",
  },
  poiTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  poiTitle: {
    fontFamily: "Georgia",
    fontSize: 15,
    fontWeight: "600",
    color: TRAVEL_THEME.colors.inkPrimary,
    flex: 1,
    paddingRight: 6,
  },
  poiBlurb: {
    fontSize: 12,
    lineHeight: 16,
    color: TRAVEL_THEME.colors.inkMuted,
    marginTop: 2,
  },
  poiFooterRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 6,
  },
  poiMetaLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  poiWalkText: {
    fontSize: 11.5,
    color: TRAVEL_THEME.colors.inkMuted,
  },
  savedCardRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  savedActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  savedDeleteBtn: {
    padding: 6,
  },
});
