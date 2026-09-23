import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
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
import { addJournalEntry, deleteJournalEntry, fetchJournal, fetchTripBundle } from "@/shared/api";
import { fmtDate, TABULAR_NUMS, TRAVEL_THEME } from "@/shared/theme";
import type { JournalEntry, TripBundle } from "@/shared/types";
import { Header } from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";
import { Card, Surface } from "@/components/ui/Surface";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { SheetHandle } from "@/components/GlassView";

const MOODS = [
  { key: "loved", label: "Loved It", icon: "heart-outline" },
  { key: "delicious", label: "Delicious", icon: "restaurant-outline" },
  { key: "scenic", label: "Scenic", icon: "image-outline" },
  { key: "adventurous", label: "Adventure", icon: "compass-outline" },
  { key: "peaceful", label: "Peaceful", icon: "leaf-outline" },
  { key: "photogenic", label: "Photogenic", icon: "camera-outline" },
];

export default function JournalScreen() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const insets = useSafeAreaInsets();
  const [bundle, setBundle] = useState<TripBundle | null>(null);
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Add Entry Modal
  const [modalVisible, setModalVisible] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [locationName, setLocationName] = useState("");
  const [mood, setMood] = useState("loved");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const [res, b] = await Promise.all([fetchJournal(tripId), fetchTripBundle(tripId)]);
      setEntries(res.journal);
      setBundle(b);
    } catch {} finally {
      setLoading(false);
    }
  }, [tripId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleAdd() {
    if (!title.trim()) {
      Alert.alert("Required", "Please give your journal entry a title.");
      return;
    }
    setSaving(true);
    try {
      const res = await addJournalEntry(tripId, {
        title: title.trim(),
        body: body.trim() || undefined,
        locationName: locationName.trim() || undefined,
        mood,
        date: new Date().toISOString(),
      });
      setEntries((prev) => [res.entry, ...prev]);
      setModalVisible(false);
      setTitle("");
      setBody("");
      setLocationName("");
    } catch {
      Alert.alert("Error", "Could not save entry.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string, entryTitle: string) {
    Alert.alert("Remove Memory", `Delete "${entryTitle}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          setEntries((prev) => prev.filter((e) => e.id !== id));
          try {
            await deleteJournalEntry(tripId, id);
          } catch {
            void load();
          }
        },
      },
    ]);
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Editorial Header */}
      <Header
        eyebrow="TRAVEL MEMORIES"
        title="Journal & Notes"
        rightAction={
          <Button
            label="Log Entry"
            iconLeft={<Ionicons name="create-outline" size={16} color="#FFFFFF" />}
            variant="primary"
            size="sm"
            onPress={() => setModalVisible(true)}
          />
        }
      />

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator color={TRAVEL_THEME.colors.terracotta} size="large" />
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
          {entries.length === 0 ? (
            <EmptyState
              icon={<Ionicons name="book-outline" size={44} color={TRAVEL_THEME.colors.terracotta} />}
              title="Your Travel Diary awaits"
              description="Capture spontaneous moments, hidden restaurant finds, and daily reflections throughout your trip."
              actionLabel="+ Write First Entry"
              onAction={() => setModalVisible(true)}
            />
          ) : (
            <View style={styles.entriesList}>
              {entries.map((entry) => (
                <Card key={entry.id} padding={18} style={styles.entryCard}>
                  {/* Top Metadata */}
                  <View style={styles.entryHeader}>
                    <View style={styles.headerLeft}>
                      <Text style={[styles.entryDate, TABULAR_NUMS]}>
                        {fmtDate(entry.date, { weekday: "short", month: "short", day: "numeric" })}
                      </Text>
                      {entry.mood && (
                        <Badge
                          label={getMoodLabel(entry.mood)}
                          variant="terracotta"
                          size="sm"
                        />
                      )}
                    </View>

                    <TouchableOpacity
                      onPress={() => handleDelete(entry.id, entry.title)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons name="trash-outline" size={15} color={TRAVEL_THEME.colors.inkDim} />
                    </TouchableOpacity>
                  </View>

                  {/* Title & Body */}
                  <Text style={styles.entryTitle}>{entry.title}</Text>
                  {entry.body && <Text style={styles.entryBody}>{entry.body}</Text>}

                  {/* Location Footnote */}
                  {entry.locationName && (
                    <View style={styles.entryFooter}>
                      <Ionicons name="location-outline" size={12} color={TRAVEL_THEME.colors.terracotta} />
                      <Text style={styles.locationText}>{entry.locationName}</Text>
                    </View>
                  )}
                </Card>
              ))}
            </View>
          )}
        </ScrollView>
      )}

      {/* Floating Bottom Nav */}
      <BottomNav tripId={tripId} activeTab="wallet" accentColor={TRAVEL_THEME.colors.terracotta} />

      {/* Add Entry Modal Bottom Sheet */}
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
              <Text style={styles.modalTitle}>Capture a Memory</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close" size={20} color={TRAVEL_THEME.colors.inkMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
              {/* Mood Selector */}
              <Text style={styles.fieldLabel}>HOW WAS IT?</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                <View style={{ flexDirection: "row", gap: 7 }}>
                  {MOODS.map((m) => {
                    const active = mood === m.key;
                    return (
                      <TouchableOpacity
                        key={m.key}
                        onPress={() => setMood(m.key)}
                        style={[
                          styles.moodChip,
                          active && styles.moodChipActive,
                        ]}
                      >
                        <Ionicons
                          name={m.icon as any}
                          size={13}
                          color={active ? TRAVEL_THEME.colors.terracottaDark : TRAVEL_THEME.colors.inkSecondary}
                        />
                        <Text
                          style={[
                            styles.moodText,
                            active && styles.moodTextActive,
                          ]}
                        >
                          {m.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </ScrollView>

              {/* Title */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>TITLE / HIGHLIGHT</Text>
                <TextInput
                  value={title}
                  onChangeText={setTitle}
                  placeholder="e.g. Sunset over Shibuya Crossing"
                  placeholderTextColor={TRAVEL_THEME.colors.inkDim}
                  style={styles.input}
                />
              </View>

              {/* Location */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>LOCATION / SPOT</Text>
                <TextInput
                  value={locationName}
                  onChangeText={setLocationName}
                  placeholder="e.g. Shibuya Sky, Tokyo"
                  placeholderTextColor={TRAVEL_THEME.colors.inkDim}
                  style={styles.input}
                />
              </View>

              {/* Body */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>JOURNAL REFLECTION</Text>
                <TextInput
                  value={body}
                  onChangeText={setBody}
                  placeholder="Write your impressions, scents, conversations, and discoveries…"
                  placeholderTextColor={TRAVEL_THEME.colors.inkDim}
                  multiline
                  numberOfLines={4}
                  style={[styles.input, { minHeight: 88, textAlignVertical: "top" }]}
                />
              </View>
            </ScrollView>

            <Button
              label="Save Memory"
              variant="primary"
              size="lg"
              loading={saving}
              onPress={handleAdd}
              style={{ marginTop: 14 }}
            />
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

function getMoodLabel(key: string): string {
  const match = MOODS.find((m) => m.key === key);
  return match?.label || key;
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
    paddingTop: 14,
    paddingBottom: 110,
  },
  entriesList: {
    gap: 14,
  },
  entryCard: {
    backgroundColor: TRAVEL_THEME.colors.surface,
    borderColor: TRAVEL_THEME.colors.border,
    ...TRAVEL_THEME.shadows.card,
  },
  entryHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  entryDate: {
    fontSize: 12,
    fontWeight: "600",
    color: TRAVEL_THEME.colors.inkMuted,
  },
  entryTitle: {
    fontFamily: "Georgia",
    fontSize: 18,
    fontWeight: "700",
    color: TRAVEL_THEME.colors.inkPrimary,
    letterSpacing: -0.2,
  },
  entryBody: {
    marginTop: 6,
    fontSize: 13.5,
    lineHeight: 20,
    color: TRAVEL_THEME.colors.inkSecondary,
  },
  entryFooter: {
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: TRAVEL_THEME.colors.borderSubtle,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  locationText: {
    fontSize: 11.5,
    fontWeight: "500",
    color: TRAVEL_THEME.colors.terracottaDark,
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
  fieldGroup: {
    marginBottom: 12,
  },
  fieldLabel: {
    fontSize: 9.5,
    fontWeight: "700",
    letterSpacing: 0.8,
    color: TRAVEL_THEME.colors.inkMuted,
    marginBottom: 5,
  },
  moodChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: TRAVEL_THEME.colors.surfaceWarm,
    borderWidth: 1,
    borderColor: TRAVEL_THEME.colors.border,
  },
  moodChipActive: {
    backgroundColor: TRAVEL_THEME.colors.terracottaLight,
    borderColor: "#F0D7D0",
  },
  moodText: {
    fontSize: 12,
    fontWeight: "500",
    color: TRAVEL_THEME.colors.inkSecondary,
  },
  moodTextActive: {
    fontWeight: "700",
    color: TRAVEL_THEME.colors.terracottaDark,
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
