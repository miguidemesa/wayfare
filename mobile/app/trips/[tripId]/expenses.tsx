import { useCallback, useEffect, useMemo, useState } from "react";
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
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { addExpense, deleteExpense, fetchTripBundle } from "@/shared/api";
import { fmtMoney, fmtDate, TABULAR_NUMS, TRAVEL_THEME } from "@/shared/theme";
import {
  EXPENSE_CATEGORY_COLORS,
  EXPENSE_CATEGORY_LABELS,
  SUPPORTED_CURRENCIES,
  type TripBundle,
} from "@/shared/types";
import { Header } from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";
import { Card, Surface } from "@/components/ui/Surface";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { SheetHandle } from "@/components/GlassView";

const CATEGORIES: { key: string; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: "FOOD", label: "Dining", icon: "restaurant-outline" },
  { key: "TRANSPORT", label: "Transit", icon: "subway-outline" },
  { key: "HOTEL", label: "Stays", icon: "bed-outline" },
  { key: "ACTIVITY", label: "Activities", icon: "sparkles-outline" },
  { key: "SHOPPING", label: "Shopping", icon: "bag-handle-outline" },
  { key: "ENTERTAINMENT", label: "Nightlife", icon: "wine-outline" },
  { key: "FLIGHT", label: "Flights", icon: "airplane-outline" },
  { key: "MISC", label: "Other", icon: "cube-outline" },
];

export default function ExpensesScreen() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const insets = useSafeAreaInsets();
  const [bundle, setBundle] = useState<TripBundle | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Add Expense Modal
  const [modalVisible, setModalVisible] = useState(false);
  const [merchant, setMerchant] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [category, setCategory] = useState("FOOD");
  const [paymentMethod, setPaymentMethod] = useState("CARD");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await fetchTripBundle(tripId);
      setBundle(data);
      if (data.destinations[0]) {
        const c = data.destinations[0].country.toLowerCase();
        if (c.includes("japan")) setCurrency("JPY");
        else if (c.includes("france") || c.includes("italy")) setCurrency("EUR");
        else if (c.includes("korea")) setCurrency("KRW");
        else if (c.includes("philippines")) setCurrency("PHP");
        else setCurrency(data.trip.homeCurrency);
      }
    } catch {}
  }, [tripId]);

  useEffect(() => {
    void load();
  }, [load]);

  const byCategory = useMemo(() => {
    if (!bundle) return [];
    const m = new Map<string, number>();
    for (const e of bundle.expenses) m.set(e.category, (m.get(e.category) ?? 0) + e.amountHome);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [bundle]);

  if (!bundle) {
    return (
      <View style={[styles.centerContainer, { paddingTop: insets.top }]}>
        <ActivityIndicator color={TRAVEL_THEME.colors.terracotta} size="large" />
      </View>
    );
  }

  const { trip, expenses } = bundle;
  const total = expenses.reduce((s, e) => s + e.amountHome, 0);
  const remaining = Math.max(0, trip.budgetAmount - total);
  const pct = trip.budgetAmount > 0 ? Math.min(100, Math.round((total / trip.budgetAmount) * 100)) : 0;
  const isOver = total > trip.budgetAmount && trip.budgetAmount > 0;
  const maxCat = byCategory[0]?.[1] ?? 1;

  async function handleAddExpense() {
    const num = parseFloat(amount);
    if (!merchant.trim() || isNaN(num) || num <= 0) {
      Alert.alert("Invalid Input", "Please enter a merchant name and valid positive amount.");
      return;
    }

    setSaving(true);
    try {
      await addExpense(tripId, {
        merchant: merchant.trim(),
        amount: num,
        currency,
        category,
        paymentMethod,
        description: description.trim() || undefined,
      });
      setModalVisible(false);
      setMerchant("");
      setAmount("");
      setDescription("");
      await load();
    } catch {
      Alert.alert("Error", "Could not save expense.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteExpense(id: string, name: string) {
    Alert.alert("Delete Expense", `Remove "${name}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            setBundle((prev) =>
              prev ? { ...prev, expenses: prev.expenses.filter((e) => e.id !== id) } : null
            );
            await deleteExpense(id);
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
        eyebrow="TRIP BUDGET"
        title="Expenses & FX"
        rightAction={
          <Button
            label="Log Expense"
            iconLeft={<Ionicons name="add" size={16} color="#FFFFFF" />}
            variant="primary"
            size="sm"
            onPress={() => setModalVisible(true)}
          />
        }
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
        {/* Main Travel Budget Card */}
        <Card padding={18} style={styles.summaryCard}>
          <View style={styles.summaryHeader}>
            <Text style={styles.summaryEyebrow}>TOTAL INVESTMENT</Text>
            <Badge
              label={isOver ? "OVER BUDGET" : pct > 80 ? "NEAR LIMIT" : "ON TRACK"}
              variant={isOver ? "terracotta" : pct > 80 ? "amber" : "forest"}
              size="sm"
            />
          </View>

          <Text style={[styles.spentAmount, TABULAR_NUMS]}>
            {fmtMoney(Math.round(total), trip.homeCurrency)}
          </Text>

          <Text style={[styles.remainingText, TABULAR_NUMS]}>
            {trip.budgetAmount > 0
              ? `${fmtMoney(Math.round(remaining), trip.homeCurrency)} remaining of ${fmtMoney(trip.budgetAmount, trip.homeCurrency)}`
              : "No overall limit set"}
          </Text>

          {trip.budgetAmount > 0 && (
            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressBar,
                  {
                    width: `${pct}%`,
                    backgroundColor: isOver
                      ? TRAVEL_THEME.colors.danger
                      : pct > 80
                        ? TRAVEL_THEME.colors.amber
                        : TRAVEL_THEME.colors.terracotta,
                  },
                ]}
              />
            </View>
          )}

          <View style={styles.summaryFooter}>
            <Text style={styles.summaryPaceText}>
              {isOver
                ? "You have exceeded your target budget."
                : "Your daily spending is balanced and on track."}
            </Text>
            <TouchableOpacity
              onPress={() => router.push(`/trips/${tripId}/currency`)}
              style={styles.fxLink}
            >
              <Text style={styles.fxLinkText}>Live FX Rates →</Text>
            </TouchableOpacity>
          </View>
        </Card>

        {/* Category Breakdown */}
        {byCategory.length > 0 && (
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>SPENDING BY CATEGORY</Text>
            <Card padding={16} style={styles.categoriesCard}>
              {byCategory.map(([cat, amountHome]) => {
                const catPct = Math.min(100, Math.round((amountHome / maxCat) * 100));
                const label = EXPENSE_CATEGORY_LABELS[cat] ?? cat;

                return (
                  <View key={cat} style={styles.catRow}>
                    <View style={styles.catHeader}>
                      <Text style={styles.catName}>{label}</Text>
                      <Text style={[styles.catAmount, TABULAR_NUMS]}>
                        {fmtMoney(Math.round(amountHome), trip.homeCurrency)}
                      </Text>
                    </View>
                    <View style={styles.catTrack}>
                      <View style={[styles.catBar, { width: `${catPct}%` }]} />
                    </View>
                  </View>
                );
              })}
            </Card>
          </View>
        )}

        {/* Transactions List */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>RECENT TRANSACTIONS ({expenses.length})</Text>

          {expenses.length === 0 ? (
            <EmptyState
              icon={<Ionicons name="receipt-outline" size={44} color={TRAVEL_THEME.colors.terracotta} />}
              title="No expenses logged"
              description="Keep your travel budget calm and clear. Log meals, transit, tickets, and stays in any local currency."
              actionLabel="+ Log First Expense"
              onAction={() => setModalVisible(true)}
            />
          ) : (
            <View style={styles.transactionsList}>
              {expenses.map((e) => (
                <Card key={e.id} padding={14} style={styles.transactionCard}>
                  <View style={styles.txRow}>
                    <View style={styles.txIconBubble}>
                      <Ionicons
                        name="wallet-outline"
                        size={15}
                        color={TRAVEL_THEME.colors.terracotta}
                      />
                    </View>

                    <View style={styles.txInfo}>
                      <Text style={styles.txMerchant}>{e.merchant}</Text>
                      <View style={styles.txMetaRow}>
                        <Text style={styles.txDate}>{fmtDate(e.date)}</Text>
                        <Text style={styles.txDot}>·</Text>
                        <Text style={styles.txCategory}>
                          {EXPENSE_CATEGORY_LABELS[e.category] ?? e.category}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.txAmountColumn}>
                      <Text style={[styles.txAmountHome, TABULAR_NUMS]}>
                        {fmtMoney(e.amountHome, trip.homeCurrency)}
                      </Text>
                      {e.currency !== trip.homeCurrency && (
                        <Text style={[styles.txOriginalAmount, TABULAR_NUMS]}>
                          {fmtMoney(e.amount, e.currency)}
                        </Text>
                      )}
                    </View>

                    <TouchableOpacity
                      onPress={() => handleDeleteExpense(e.id, e.merchant)}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      style={styles.txDeleteBtn}
                    >
                      <Ionicons name="trash-outline" size={15} color={TRAVEL_THEME.colors.inkDim} />
                    </TouchableOpacity>
                  </View>
                </Card>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Floating Bottom Nav */}
      <BottomNav tripId={tripId} activeTab="wallet" accentColor={TRAVEL_THEME.colors.terracotta} />

      {/* Add Expense Modal Bottom Sheet */}
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
              <Text style={styles.modalTitle}>Log Travel Expense</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close" size={20} color={TRAVEL_THEME.colors.inkMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
              {/* Merchant / Place */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>MERCHANT / ESTABLISHMENT</Text>
                <TextInput
                  value={merchant}
                  onChangeText={setMerchant}
                  placeholder="e.g. Ichiran Ramen, JR Metro, Cafe de Flore"
                  placeholderTextColor={TRAVEL_THEME.colors.inkDim}
                  style={styles.input}
                />
              </View>

              {/* Amount & Currency */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>AMOUNT & LOCAL CURRENCY</Text>
                <View style={styles.rowTwoCols}>
                  <TextInput
                    value={amount}
                    onChangeText={setAmount}
                    placeholder="0.00"
                    keyboardType="numeric"
                    placeholderTextColor={TRAVEL_THEME.colors.inkDim}
                    style={[styles.input, { flex: 1.5 }, TABULAR_NUMS]}
                  />
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }}>
                    <View style={styles.currencyRow}>
                      {SUPPORTED_CURRENCIES.slice(0, 5).map((cur) => (
                        <TouchableOpacity
                          key={cur}
                          onPress={() => setCurrency(cur)}
                          style={[
                            styles.curChip,
                            currency === cur && styles.curChipActive,
                          ]}
                        >
                          <Text
                            style={[
                              styles.curText,
                              currency === cur && styles.curTextActive,
                            ]}
                          >
                            {cur}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </ScrollView>
                </View>
              </View>

              {/* Category Picker Chips */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>CATEGORY</Text>
                <View style={styles.categoriesWrap}>
                  {CATEGORIES.map((c) => {
                    const active = category === c.key;
                    return (
                      <TouchableOpacity
                        key={c.key}
                        onPress={() => setCategory(c.key)}
                        style={[
                          styles.catChip,
                          active && styles.catChipActive,
                        ]}
                      >
                        <Ionicons
                          name={c.icon}
                          size={13}
                          color={active ? TRAVEL_THEME.colors.terracottaDark : TRAVEL_THEME.colors.inkSecondary}
                        />
                        <Text
                          style={[
                            styles.catChipText,
                            active && styles.catChipTextActive,
                          ]}
                        >
                          {c.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Optional Notes */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>NOTES (OPTIONAL)</Text>
                <TextInput
                  value={description}
                  onChangeText={setDescription}
                  placeholder="e.g. Lunch with Maya, paid by card"
                  placeholderTextColor={TRAVEL_THEME.colors.inkDim}
                  style={styles.input}
                />
              </View>
            </ScrollView>

            <Button
              label="Save Expense"
              variant="primary"
              size="lg"
              loading={saving}
              onPress={handleAddExpense}
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
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 110,
    gap: 16,
  },
  summaryCard: {
    backgroundColor: TRAVEL_THEME.colors.surface,
    borderColor: TRAVEL_THEME.colors.border,
    ...TRAVEL_THEME.shadows.card,
  },
  summaryHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  summaryEyebrow: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.2,
    color: TRAVEL_THEME.colors.inkMuted,
  },
  spentAmount: {
    fontFamily: "Georgia",
    fontSize: 34,
    fontWeight: "700",
    color: TRAVEL_THEME.colors.inkPrimary,
    letterSpacing: -0.5,
    marginTop: 4,
  },
  remainingText: {
    fontSize: 13,
    color: TRAVEL_THEME.colors.inkSecondary,
    marginTop: 2,
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
  },
  summaryFooter: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: TRAVEL_THEME.colors.borderSubtle,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  summaryPaceText: {
    fontSize: 12,
    color: TRAVEL_THEME.colors.inkMuted,
    flex: 1,
    paddingRight: 8,
  },
  fxLink: {
    paddingVertical: 2,
  },
  fxLinkText: {
    fontSize: 12,
    fontWeight: "700",
    color: TRAVEL_THEME.colors.terracotta,
  },
  sectionContainer: {
    gap: 10,
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.2,
    color: TRAVEL_THEME.colors.inkMuted,
    paddingHorizontal: 2,
  },
  categoriesCard: {
    backgroundColor: TRAVEL_THEME.colors.surface,
    gap: 12,
  },
  catRow: {
    gap: 5,
  },
  catHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  catName: {
    fontSize: 13,
    fontWeight: "600",
    color: TRAVEL_THEME.colors.inkPrimary,
  },
  catAmount: {
    fontSize: 13,
    fontWeight: "600",
    color: TRAVEL_THEME.colors.inkSecondary,
  },
  catTrack: {
    height: 4.5,
    borderRadius: 2.5,
    backgroundColor: TRAVEL_THEME.colors.surfaceWarm,
    overflow: "hidden",
  },
  catBar: {
    height: "100%",
    borderRadius: 2.5,
    backgroundColor: TRAVEL_THEME.colors.terracotta,
  },
  transactionsList: {
    gap: 8,
  },
  transactionCard: {
    backgroundColor: TRAVEL_THEME.colors.surface,
    borderColor: TRAVEL_THEME.colors.border,
  },
  txRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  txIconBubble: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: TRAVEL_THEME.colors.terracottaLight,
    alignItems: "center",
    justifyContent: "center",
  },
  txInfo: {
    flex: 1,
  },
  txMerchant: {
    fontSize: 14,
    fontWeight: "600",
    color: TRAVEL_THEME.colors.inkPrimary,
  },
  txMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
  txDate: {
    fontSize: 11.5,
    color: TRAVEL_THEME.colors.inkMuted,
  },
  txDot: {
    fontSize: 11,
    color: TRAVEL_THEME.colors.inkDim,
  },
  txCategory: {
    fontSize: 11.5,
    color: TRAVEL_THEME.colors.inkMuted,
  },
  txAmountColumn: {
    alignItems: "flex-end",
  },
  txAmountHome: {
    fontSize: 14,
    fontWeight: "700",
    color: TRAVEL_THEME.colors.inkPrimary,
  },
  txOriginalAmount: {
    fontSize: 11,
    color: TRAVEL_THEME.colors.inkMuted,
    marginTop: 1,
  },
  txDeleteBtn: {
    padding: 4,
    marginLeft: 4,
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
    marginBottom: 14,
    gap: 6,
  },
  fieldLabel: {
    fontSize: 9.5,
    fontWeight: "700",
    letterSpacing: 0.8,
    color: TRAVEL_THEME.colors.inkMuted,
  },
  rowTwoCols: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
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
  currencyRow: {
    flexDirection: "row",
    gap: 4,
    paddingLeft: 4,
  },
  curChip: {
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: TRAVEL_THEME.colors.surfaceWarm,
    borderWidth: 1,
    borderColor: TRAVEL_THEME.colors.border,
  },
  curChipActive: {
    backgroundColor: TRAVEL_THEME.colors.terracotta,
    borderColor: TRAVEL_THEME.colors.terracotta,
  },
  curText: {
    fontSize: 12,
    fontWeight: "700",
    color: TRAVEL_THEME.colors.inkSecondary,
  },
  curTextActive: {
    color: "#FFFFFF",
  },
  categoriesWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
  },
  catChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
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
});