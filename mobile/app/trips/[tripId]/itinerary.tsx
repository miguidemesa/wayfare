import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
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
  ApiError,
  deleteItineraryItem,
  fetchTripBundle,
  optimizeDay,
  updateItineraryItem,
} from "@/shared/api";
import { fmtDate, TABULAR_NUMS, TRAVEL_THEME } from "@/shared/theme";
import type { ItineraryItem, TripBundle } from "@/shared/types";
import { Header } from "@/components/Header";
import { TimelineStop } from "@/components/TimelineStop";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { BottomNav } from "@/components/BottomNav";
import { SmartItineraryWizard } from "@/components/SmartItineraryWizard";
import { SheetHandle } from "@/components/GlassView";

const ITEM_TYPES: { key: string; label: string; icon: keyof typeof Ionicons.glyphMap; color: string }[] = [
  { key: "ACTIVITY", label: "Activity", icon: "sparkles", color: TRAVEL_THEME.colors.terracotta },
  { key: "RESTAURANT", label: "Dining", icon: "restaurant", color: TRAVEL_THEME.colors.amber },
  { key: "HOTEL", label: "Stay", icon: "bed", color: TRAVEL_THEME.colors.oceanDark },
  { key: "TRANSPORT", label: "Transit", icon: "subway", color: TRAVEL_THEME.colors.ocean },
  { key: "FLIGHT", label: "Flight", icon: "airplane", color: TRAVEL_THEME.colors.ocean },
  { key: "PERSONAL", label: "Free Time", icon: "create-outline", color: TRAVEL_THEME.colors.inkSecondary },
];

export { ErrorFallback as ErrorBoundary } from "@/components/ErrorFallback";

export default function ItineraryScreen() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const insets = useSafeAreaInsets();
  const [bundle, setBundle] = useState<TripBundle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dayIdx, setDayIdx] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [optimizing, setOptimizing] = useState(false);
  const [wizardVisible, setWizardVisible] = useState(false);

  // Add Item Modal state
  const [modalVisible, setModalVisible] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newType, setNewType] = useState("ACTIVITY");
  const [newTime, setNewTime] = useState("10:00");
  const [newDuration, setNewDuration] = useState("60");
  const [newPlace, setNewPlace] = useState("");
  const [newCost, setNewCost] = useState("");
  const [newNotes, setNewNotes] = useState("");
  const [savingItem, setSavingItem] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await fetchTripBundle(tripId);
      setBundle(data);
      setError(null);
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "Your itinerary couldn't be loaded. Please try again.");
    }
  }, [tripId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!bundle) {
    return (
      <View style={[styles.centerContainer, { paddingTop: insets.top }]}>
        {error ? (
          <EmptyState
            title="Your itinerary is unavailable"
            description={error}
            actionLabel="Try again"
            onAction={() => void load()}
          />
        ) : (
          <ActivityIndicator accessibilityLabel="Loading itinerary" color={TRAVEL_THEME.colors.terracotta} size="large" />
        )}
      </View>
    );
  }

  const days = bundle.days;
  const day = days[Math.min(dayIdx, Math.max(0, days.length - 1))];

  async function handleToggleConfirmed(item: ItineraryItem) {
    try {
      const updated = !item.confirmed;
      setBundle((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          days: prev.days.map((d) =>
            d.id === day?.id
              ? {
                  ...d,
                  items: d.items.map((i) => (i.id === item.id ? { ...i, confirmed: updated } : i)),
                }
              : d
          ),
        };
      });
      await updateItineraryItem(item.id, { confirmed: updated });
    } catch {
      void load();
    }
  }

  async function handleDeleteItem(itemId: string, title: string) {
    Alert.alert("Remove Stop", `Remove "${title}" from this day's journey?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          try {
            setBundle((prev) => {
              if (!prev) return null;
              return {
                ...prev,
                days: prev.days.map((d) =>
                  d.id === day?.id ? { ...d, items: d.items.filter((i) => i.id !== itemId) } : d
                ),
              };
            });
            await deleteItineraryItem(itemId);
          } catch {
            void load();
          }
        },
      },
    ]);
  }

  async function handleAddItem() {
    if (!day || savingItem) return;
    if (!newTitle.trim()) {
      Alert.alert("Name this stop", "Add an activity, reservation, or place name.");
      return;
    }
    if (newTime.trim() && !/^([01]\d|2[0-3]):[0-5]\d$/.test(newTime.trim())) {
      Alert.alert("Check the time", "Use a 24-hour time, such as 09:30, or leave it blank.");
      return;
    }
    const duration = Number(newDuration);
    const cost = newCost.trim() ? Number(newCost) : undefined;
    if (!Number.isInteger(duration) || duration < 1 || duration > 1440) {
      Alert.alert("Check the duration", "Enter a whole number from 1 to 1,440 minutes.");
      return;
    }
    if (cost !== undefined && (!Number.isFinite(cost) || cost < 0)) {
      Alert.alert("Check the cost", "Enter a non-negative amount or leave it blank.");
      return;
    }
    setSavingItem(true);
    try {
      await addItineraryItem(tripId, {
        dayId: day.id,
        title: newTitle.trim(),
        type: newType,
        startTime: newTime.trim() || undefined,
        durationMin: duration,
        placeName: newPlace.trim() || undefined,
        cost,
        currency: bundle?.trip.homeCurrency,
        notes: newNotes.trim() || undefined,
      });
      setModalVisible(false);
      setNewTitle("");
      setNewPlace("");
      setNewCost("");
      setNewNotes("");
      await load();
    } catch {
      Alert.alert("Error", "Could not add stop.");
    } finally {
      setSavingItem(false);
    }
  }

  async function handleOptimizeDay() {
    if (!day || optimizing) return;
    setOptimizing(true);
    try {
      const dateStr = day.date.slice(0, 10);
      const res = await optimizeDay(tripId, dateStr, true);
      Alert.alert(
        "Route Optimized",
        res.summary || `Sequenced for minimal transit${res.timeSavedMin ? ` — about ${res.timeSavedMin} minutes saved.` : "."}`
      );
      await load();
    } catch (cause) {
      Alert.alert("Couldn't optimize this day", cause instanceof ApiError ? cause.message : "Please try again. Your existing route hasn't been replaced on this screen.");
    } finally {
      setOptimizing(false);
    }
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Editorial Header */}
      <Header
        eyebrow="JOURNEY TIMELINE"
        title={day ? `Day ${dayIdx + 1} · ${day.city}` : "Timeline"}
        rightAction={
          <Button
            label="Stop"
            iconLeft={<Ionicons name="add" size={16} color="#FFFFFF" />}
            variant="primary"
            size="sm"
            onPress={() => setModalVisible(true)}
          />
        }
      />

      {/* Horizontal Day Chapters Strip */}
      <View style={styles.daysStripWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.daysScroll}
        >
          {days.map((d, i) => {
            const isSelected = i === dayIdx;
            return (
              <TouchableOpacity
                key={d.id}
                onPress={() => setDayIdx(i)}
                activeOpacity={0.78}
                style={[
                  styles.dayPill,
                  isSelected && styles.dayPillSelected,
                ]}
              >
                <Text
                  style={[
                    styles.dayPillIndex,
                    isSelected && styles.dayPillIndexSelected,
                  ]}
                >
                  DAY {i + 1}
                </Text>
                <Text
                  style={[
                    styles.dayPillDate,
                    isSelected && styles.dayPillDateSelected,
                    TABULAR_NUMS,
                  ]}
                >
                  {fmtDate(d.date)}
                </Text>
                <Text
                  style={[
                    styles.dayPillStops,
                    isSelected && styles.dayPillStopsSelected,
                  ]}
                >
                  {d.items.length} stop{d.items.length !== 1 ? "s" : ""}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Main Timeline Scroll */}
      <ScrollView
        contentContainerStyle={styles.timelineScroll}
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
        {day ? (
          <>
            {/* Day Chapter Briefing Banner */}
            <View style={styles.chapterHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.chapterTitle}>
                  {day.title || `${day.city} Exploration`}
                </Text>
                <Text style={[styles.chapterSubtitle, TABULAR_NUMS]}>
                  {fmtDate(day.date, { weekday: "long", month: "long", day: "numeric" })} · {day.items.length} stops
                </Text>
              </View>

              <View style={styles.chapterActions}>
                <TouchableOpacity
                  onPress={() => setWizardVisible(true)}
                  activeOpacity={0.8}
                  style={styles.aiPlannerBtn}
                >
                  <Ionicons name="sparkles" size={13} color={TRAVEL_THEME.colors.terracotta} />
                  <Text style={styles.aiPlannerText}>AI Plan</Text>
                </TouchableOpacity>

                {day.items.length >= 2 && (
                  <TouchableOpacity
                    onPress={handleOptimizeDay}
                    disabled={optimizing}
                    activeOpacity={0.8}
                    style={styles.optimizeBtn}
                  >
                    {optimizing ? (
                      <ActivityIndicator size="small" color={TRAVEL_THEME.colors.forest} />
                    ) : (
                      <>
                        <Ionicons name="flash-outline" size={13} color={TRAVEL_THEME.colors.forest} />
                        <Text style={styles.optimizeText}>Optimize</Text>
                      </>
                    )}
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* Empty Day State */}
            {day.items.length === 0 ? (
              <EmptyState
                icon={<Ionicons name="calendar-outline" size={44} color={TRAVEL_THEME.colors.terracotta} />}
                title="Blank Day Chapter"
                description="No stops planned for this date yet. You can manually add stops or let the AI Architect plan a balanced itinerary around your stay."
                actionLabel="+ Add Stop"
                onAction={() => setModalVisible(true)}
                secondaryLabel="✨ AI Smart Wizard"
                onSecondaryAction={() => setWizardVisible(true)}
              />
            ) : (
              <View style={styles.stopsTimelineContainer}>
                {day.items.map((item, idx) => (
                  <TimelineStop
                    key={item.id}
                    item={item}
                    isFirst={idx === 0}
                    currency={bundle.trip.homeCurrency}
                    onToggleConfirm={handleToggleConfirmed}
                    onDelete={handleDeleteItem}
                  />
                ))}
              </View>
            )}
          </>
        ) : (
          <EmptyState
            title="No Itinerary Days Configured"
            description="Add your first day chapter to start sequencing your travel itinerary."
          />
        )}
      </ScrollView>

      {/* Floating Bottom Nav */}
      <BottomNav tripId={tripId} activeTab="itinerary" accentColor={TRAVEL_THEME.colors.terracotta} />

      {/* Add Stop Modal Bottom Sheet */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.modalBackdrop}
        >
          <View style={[styles.modalSheet, { paddingBottom: Math.max(insets.bottom, 16) + 8 }]}>
            <SheetHandle />

            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>Add Stop to Day {dayIdx + 1}</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close" size={20} color={TRAVEL_THEME.colors.inkMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
              {/* Type Picker */}
              <Text style={styles.fieldLabel}>ACTIVITY TYPE</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.typeScroll}>
                <View style={styles.typeRow}>
                  {ITEM_TYPES.map((t) => {
                    const active = newType === t.key;
                    return (
                      <TouchableOpacity
                        key={t.key}
                        onPress={() => setNewType(t.key)}
                        style={[
                          styles.typeChip,
                          active && {
                            backgroundColor: TRAVEL_THEME.colors.terracottaLight,
                            borderColor: TRAVEL_THEME.colors.terracotta,
                          },
                        ]}
                      >
                        <Ionicons
                          name={t.icon}
                          size={14}
                          color={active ? TRAVEL_THEME.colors.terracotta : TRAVEL_THEME.colors.inkSecondary}
                        />
                        <Text
                          style={[
                            styles.typeChipText,
                            active && { color: TRAVEL_THEME.colors.terracottaDark, fontWeight: "700" },
                          ]}
                        >
                          {t.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </ScrollView>

              {/* Stop Title */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>TITLE / NAME</Text>
                <TextInput
                  value={newTitle}
                  onChangeText={setNewTitle}
                  placeholder="e.g. Meiji Shrine Morning Stroll"
                  placeholderTextColor={TRAVEL_THEME.colors.inkDim}
                  style={styles.input}
                />
              </View>

              {/* Time & Duration */}
              <View style={styles.fieldGroup}>
                <View style={styles.rowTwoCols}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.fieldLabel}>TIME (HH:MM)</Text>
                    <TextInput
                      value={newTime}
                      onChangeText={setNewTime}
                      placeholder="10:00"
                      placeholderTextColor={TRAVEL_THEME.colors.inkDim}
                      style={[styles.input, TABULAR_NUMS]}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.fieldLabel}>DURATION (MIN)</Text>
                    <TextInput
                      value={newDuration}
                      onChangeText={setNewDuration}
                      placeholder="60"
                      keyboardType="numeric"
                      placeholderTextColor={TRAVEL_THEME.colors.inkDim}
                      style={[styles.input, TABULAR_NUMS]}
                    />
                  </View>
                </View>
              </View>

              {/* Place & Cost */}
              <View style={styles.fieldGroup}>
                <View style={styles.rowTwoCols}>
                  <View style={{ flex: 1.5 }}>
                    <Text style={styles.fieldLabel}>NEIGHBORHOOD / ADDRESS</Text>
                    <TextInput
                      value={newPlace}
                      onChangeText={setNewPlace}
                      placeholder="e.g. Harajuku / Shibuya"
                      placeholderTextColor={TRAVEL_THEME.colors.inkDim}
                      style={styles.input}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.fieldLabel}>COST ({bundle.trip.homeCurrency})</Text>
                    <TextInput
                      value={newCost}
                      onChangeText={setNewCost}
                      placeholder="0"
                      keyboardType="numeric"
                      placeholderTextColor={TRAVEL_THEME.colors.inkDim}
                      style={[styles.input, TABULAR_NUMS]}
                    />
                  </View>
                </View>
              </View>

              {/* Notes */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>NOTES & TIPS</Text>
                <TextInput
                  value={newNotes}
                  onChangeText={setNewNotes}
                  placeholder="e.g. Try to arrive right when gates open"
                  placeholderTextColor={TRAVEL_THEME.colors.inkDim}
                  style={styles.input}
                />
              </View>
            </ScrollView>

            <Button
              label="Add Stop to Timeline"
              variant="primary"
              size="lg"
              loading={savingItem}
              onPress={handleAddItem}
              style={{ marginTop: 14 }}
            />
          </View>
        </KeyboardAvoidingView>
      </Modal>

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
  daysStripWrapper: {
    backgroundColor: TRAVEL_THEME.colors.bg,
    borderBottomWidth: 1,
    borderBottomColor: TRAVEL_THEME.colors.border,
    paddingVertical: 8,
  },
  daysScroll: {
    paddingHorizontal: 16,
    gap: 8,
  },
  dayPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: TRAVEL_THEME.colors.surface,
    borderWidth: 1,
    borderColor: TRAVEL_THEME.colors.border,
    alignItems: "center",
    minWidth: 78,
    ...TRAVEL_THEME.shadows.card,
  },
  dayPillSelected: {
    backgroundColor: TRAVEL_THEME.colors.terracotta,
    borderColor: TRAVEL_THEME.colors.terracotta,
  },
  dayPillIndex: {
    fontSize: 9.5,
    fontWeight: "800",
    letterSpacing: 1,
    color: TRAVEL_THEME.colors.inkMuted,
  },
  dayPillIndexSelected: {
    color: "rgba(255, 255, 255, 0.85)",
  },
  dayPillDate: {
    fontSize: 13,
    fontWeight: "700",
    color: TRAVEL_THEME.colors.inkPrimary,
    marginTop: 2,
  },
  dayPillDateSelected: {
    color: "#FFFFFF",
  },
  dayPillStops: {
    fontSize: 10,
    color: TRAVEL_THEME.colors.inkDim,
    marginTop: 1,
  },
  dayPillStopsSelected: {
    color: "rgba(255, 255, 255, 0.75)",
  },
  timelineScroll: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 110,
  },
  chapterHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: TRAVEL_THEME.colors.border,
  },
  chapterTitle: {
    fontFamily: "Georgia",
    fontSize: 20,
    fontWeight: "700",
    color: TRAVEL_THEME.colors.inkPrimary,
    letterSpacing: -0.2,
  },
  chapterSubtitle: {
    fontSize: 12,
    color: TRAVEL_THEME.colors.inkMuted,
    marginTop: 2,
  },
  chapterActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  aiPlannerBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: TRAVEL_THEME.colors.terracottaLight,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#F0D7D0",
  },
  aiPlannerText: {
    fontSize: 11.5,
    fontWeight: "700",
    color: TRAVEL_THEME.colors.terracottaDark,
  },
  optimizeBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: TRAVEL_THEME.colors.forestLight,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#D6E5DC",
  },
  optimizeText: {
    fontSize: 11.5,
    fontWeight: "700",
    color: TRAVEL_THEME.colors.forestDark,
  },
  stopsTimelineContainer: {
    gap: 0,
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(28, 25, 23, 0.45)",
  },
  modalSheet: {
    backgroundColor: TRAVEL_THEME.colors.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 8,
    borderWidth: 1,
    borderColor: TRAVEL_THEME.colors.border,
    ...TRAVEL_THEME.shadows.modal,
  },
  modalHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: TRAVEL_THEME.colors.borderSubtle,
    marginBottom: 10,
  },
  modalTitle: {
    fontFamily: "Georgia",
    fontSize: 18,
    fontWeight: "700",
    color: TRAVEL_THEME.colors.inkPrimary,
  },
  fieldLabel: {
    fontSize: 9.5,
    fontWeight: "700",
    letterSpacing: 0.8,
    color: TRAVEL_THEME.colors.inkMuted,
    marginBottom: 5,
  },
  typeScroll: {
    marginBottom: 12,
  },
  typeRow: {
    flexDirection: "row",
    gap: 8,
  },
  typeChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: TRAVEL_THEME.colors.surfaceWarm,
    borderWidth: 1,
    borderColor: TRAVEL_THEME.colors.border,
  },
  typeChipText: {
    fontSize: 12,
    fontWeight: "500",
    color: TRAVEL_THEME.colors.inkSecondary,
  },
  fieldGroup: {
    marginBottom: 12,
  },
  rowTwoCols: {
    flexDirection: "row",
    gap: 10,
  },
  input: {
    backgroundColor: TRAVEL_THEME.colors.surfaceWarm,
    borderWidth: 1,
    borderColor: TRAVEL_THEME.colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13.5,
    color: TRAVEL_THEME.colors.inkPrimary,
  },
});