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
  addChecklistItem,
  deleteChecklistItem,
  fetchChecklist,
  generatePackingList,
  toggleChecklistItem,
} from "@/shared/api";
import { TABULAR_NUMS, TRAVEL_THEME } from "@/shared/theme";
import type { ChecklistItem } from "@/shared/types";
import { Header } from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";
import { Card, Surface } from "@/components/ui/Surface";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { EmptyState } from "@/components/ui/EmptyState";
import { SheetHandle } from "@/components/GlassView";

const CATEGORIES = ["Essentials", "Clothing", "Toiletries", "Electronics", "Documents", "Medication", "Other"];

export default function PackingScreen() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<"PACKING" | "BEFORE_TRIP">("PACKING");
  const [generating, setGenerating] = useState(false);

  // Add Item Modal
  const [modalVisible, setModalVisible] = useState(false);
  const [newText, setNewText] = useState("");
  const [newCategory, setNewCategory] = useState("Essentials");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetchChecklist(tripId);
      setItems(res.checklist);
    } catch {} finally {
      setLoading(false);
    }
  }, [tripId]);

  useEffect(() => {
    void load();
  }, [load]);

  const filteredItems = items.filter((i) =>
    activeTab === "PACKING" ? i.section !== "BEFORE_TRIP" : i.section === "BEFORE_TRIP"
  );

  const total = filteredItems.length;
  const packedCount = filteredItems.filter((i) => i.checked).length;
  const pct = total > 0 ? Math.round((packedCount / total) * 100) : 0;

  async function handleToggle(item: ChecklistItem) {
    const updated = !item.checked;
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, checked: updated } : i)));
    try {
      await toggleChecklistItem(tripId, item.id, updated);
    } catch {
      void load();
    }
  }

  async function handleDelete(id: string, text: string) {
    setItems((prev) => prev.filter((i) => i.id !== id));
    try {
      await deleteChecklistItem(tripId, id);
    } catch {
      void load();
    }
  }

  async function handleAdd() {
    if (!newText.trim()) return;
    setSaving(true);
    try {
      const res = await addChecklistItem(tripId, {
        text: newText.trim(),
        category: newCategory,
        section: activeTab,
      });
      setItems((prev) => [...prev, res.item]);
      setModalVisible(false);
      setNewText("");
    } catch {
      Alert.alert("Error", "Could not add item.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSmartGenerate() {
    setGenerating(true);
    try {
      await generatePackingList(tripId);
      await load();
      Alert.alert("Smart Checklist Ready!", "Tailored packing recommendations generated for your trip destination and weather.");
    } catch {
      Alert.alert("Notice", "Checklist updated.");
    } finally {
      setGenerating(false);
    }
  }

  // Group items by category
  const grouped = filteredItems.reduce<Record<string, ChecklistItem[]>>((acc, item) => {
    const cat = item.category || "General";
    acc[cat] = acc[cat] || [];
    acc[cat].push(item);
    return acc;
  }, {});

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Editorial Header */}
      <Header
        eyebrow="TRIP PREPARATION"
        title="Smart Checklist"
        rightAction={
          <Button
            label="Add"
            iconLeft={<Ionicons name="add" size={16} color="#FFFFFF" />}
            variant="primary"
            size="sm"
            onPress={() => setModalVisible(true)}
          />
        }
      />

      {/* Filter Tabs */}
      <View style={styles.tabBar}>
        <SegmentedControl
          options={[
            { key: "PACKING", label: `Luggage (${items.filter((i) => i.section !== "BEFORE_TRIP").length})` },
            { key: "BEFORE_TRIP", label: `Before Trip Tasks (${items.filter((i) => i.section === "BEFORE_TRIP").length})` },
          ]}
          value={activeTab}
          onChange={setActiveTab}
          accentColor={TRAVEL_THEME.colors.terracotta}
        />
      </View>

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
          {/* Progress Card */}
          <Card padding={16} style={styles.progressCard}>
            <View style={styles.progressHeader}>
              <View>
                <Text style={styles.progressEyebrow}>PACKING COMPLETION</Text>
                <Text style={[styles.progressPct, TABULAR_NUMS]}>{pct}% Ready</Text>
                <Text style={styles.progressSub}>
                  {packedCount} of {total} items checked
                </Text>
              </View>

              <Button
                label="AI Suggest"
                iconLeft={<Ionicons name="sparkles" size={14} color="#FFFFFF" />}
                variant="primary"
                size="sm"
                loading={generating}
                onPress={handleSmartGenerate}
              />
            </View>

            <View style={styles.progressTrack}>
              <View style={[styles.progressBar, { width: `${pct}%` }]} />
            </View>
          </Card>

          {total === 0 ? (
            <EmptyState
              icon={<Ionicons name="bag-outline" size={44} color={TRAVEL_THEME.colors.terracotta} />}
              title="No items on this checklist"
              description="Keep your bags organized and avoid leaving essentials behind. Generate a weather-aware packing list or add custom items."
              actionLabel="✨ AI Smart Packing List"
              onAction={handleSmartGenerate}
              secondaryLabel="+ Add Custom Item"
              onSecondaryAction={() => setModalVisible(true)}
            />
          ) : (
            <View style={styles.categoriesList}>
              {Object.entries(grouped).map(([categoryName, catItems]) => (
                <View key={categoryName} style={styles.categoryBlock}>
                  <Text style={styles.categoryTitle}>{categoryName.toUpperCase()}</Text>
                  <Card padding={10} style={styles.itemsCard}>
                    {catItems.map((item) => (
                      <TouchableOpacity
                        key={item.id}
                        onPress={() => handleToggle(item)}
                        activeOpacity={0.7}
                        style={[
                          styles.itemRow,
                          item.checked && styles.itemRowChecked,
                        ]}
                      >
                        <View
                          style={[
                            styles.checkbox,
                            item.checked && styles.checkboxChecked,
                          ]}
                        >
                          {item.checked && (
                            <Ionicons name="checkmark" size={13} color="#FFFFFF" />
                          )}
                        </View>

                        <Text
                          style={[
                            styles.itemText,
                            item.checked && styles.itemTextChecked,
                          ]}
                          numberOfLines={2}
                        >
                          {item.text}
                        </Text>

                        {item.aiGenerated && (
                          <Badge label="AI" variant="forest" size="sm" />
                        )}

                        <TouchableOpacity
                          onPress={() => handleDelete(item.id, item.text)}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          style={styles.deleteBtn}
                        >
                          <Ionicons name="close" size={15} color={TRAVEL_THEME.colors.inkDim} />
                        </TouchableOpacity>
                      </TouchableOpacity>
                    ))}
                  </Card>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      )}

      {/* Floating Bottom Nav */}
      <BottomNav tripId={tripId} activeTab="wallet" accentColor={TRAVEL_THEME.colors.terracotta} />

      {/* Add Item Modal Bottom Sheet */}
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
              <Text style={styles.modalTitle}>Add Checklist Item</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close" size={20} color={TRAVEL_THEME.colors.inkMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 380 }} showsVerticalScrollIndicator={false}>
              {/* Category Picker */}
              <Text style={styles.fieldLabel}>CATEGORY</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                <View style={{ flexDirection: "row", gap: 6 }}>
                  {CATEGORIES.map((c) => (
                    <TouchableOpacity
                      key={c}
                      onPress={() => setNewCategory(c)}
                      style={[
                        styles.catChip,
                        newCategory === c && styles.catChipActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.catChipText,
                          newCategory === c && styles.catChipTextActive,
                        ]}
                      >
                        {c}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>

              {/* Item Text */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>ITEM DESCRIPTION</Text>
                <TextInput
                  value={newText}
                  onChangeText={setNewText}
                  placeholder="e.g. Universal power adapter, Noise-cancelling headphones"
                  placeholderTextColor={TRAVEL_THEME.colors.inkDim}
                  style={styles.input}
                />
              </View>
            </ScrollView>

            <Button
              label="Add to Checklist"
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
  tabBar: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: TRAVEL_THEME.colors.bg,
    borderBottomWidth: 1,
    borderBottomColor: TRAVEL_THEME.colors.border,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 110,
    gap: 16,
  },
  progressCard: {
    backgroundColor: TRAVEL_THEME.colors.surface,
    borderColor: TRAVEL_THEME.colors.border,
    ...TRAVEL_THEME.shadows.card,
  },
  progressHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  progressEyebrow: {
    fontSize: 9.5,
    fontWeight: "800",
    letterSpacing: 1.2,
    color: TRAVEL_THEME.colors.inkMuted,
  },
  progressPct: {
    fontFamily: "Georgia",
    fontSize: 22,
    fontWeight: "700",
    color: TRAVEL_THEME.colors.inkPrimary,
    marginTop: 2,
  },
  progressSub: {
    fontSize: 12,
    color: TRAVEL_THEME.colors.inkMuted,
    marginTop: 1,
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: TRAVEL_THEME.colors.bgMuted,
    overflow: "hidden",
    marginTop: 12,
  },
  progressBar: {
    height: "100%",
    borderRadius: 3,
    backgroundColor: TRAVEL_THEME.colors.forest,
  },
  categoriesList: {
    gap: 14,
  },
  categoryBlock: {
    gap: 6,
  },
  categoryTitle: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.2,
    color: TRAVEL_THEME.colors.inkMuted,
    paddingHorizontal: 2,
  },
  itemsCard: {
    backgroundColor: TRAVEL_THEME.colors.surface,
    paddingVertical: 4,
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderBottomWidth: 1,
    borderBottomColor: TRAVEL_THEME.colors.borderSubtle,
    gap: 10,
  },
  itemRowChecked: {
    opacity: 0.6,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: TRAVEL_THEME.colors.borderStrong,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },
  checkboxChecked: {
    backgroundColor: TRAVEL_THEME.colors.forest,
    borderColor: TRAVEL_THEME.colors.forest,
  },
  itemText: {
    fontSize: 14,
    color: TRAVEL_THEME.colors.inkPrimary,
    flex: 1,
  },
  itemTextChecked: {
    textDecorationLine: "line-through",
    color: TRAVEL_THEME.colors.inkMuted,
  },
  deleteBtn: {
    padding: 4,
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
  catChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: TRAVEL_THEME.colors.surfaceWarm,
    borderWidth: 1,
    borderColor: TRAVEL_THEME.colors.border,
  },
  catChipActive: {
    backgroundColor: TRAVEL_THEME.colors.terracottaLight,
    borderColor: "#F0D7D0",
  },
  catChipText: {
    fontSize: 12,
    fontWeight: "500",
    color: TRAVEL_THEME.colors.inkSecondary,
  },
  catChipTextActive: {
    fontWeight: "700",
    color: TRAVEL_THEME.colors.terracottaDark,
  },
  fieldGroup: {
    marginBottom: 12,
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
