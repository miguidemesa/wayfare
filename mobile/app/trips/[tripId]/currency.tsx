import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
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
import { fetchCurrencyRates, fetchTripBundle } from "@/shared/api";
import { fmtMoney, TABULAR_NUMS, TRAVEL_THEME } from "@/shared/theme";
import { SUPPORTED_CURRENCIES, type TripBundle } from "@/shared/types";
import { Header } from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";
import { Card, Surface } from "@/components/ui/Surface";
import { Badge } from "@/components/ui/Badge";

const DENOMINATIONS = [100, 500, 1000, 2000, 5000, 10000, 50000];

export { ErrorFallback as ErrorBoundary } from "@/components/ErrorFallback";

export default function CurrencyScreen() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const insets = useSafeAreaInsets();
  const [bundle, setBundle] = useState<TripBundle | null>(null);
  const [rates, setRates] = useState<Record<string, number>>({});
  const [source, setSource] = useState("live");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Calculator State
  const [fromCurrency, setFromCurrency] = useState("JPY");
  const [toCurrency, setToCurrency] = useState("USD");
  const [inputAmount, setInputAmount] = useState("1000");

  const load = useCallback(async () => {
    try {
      const [b, fx] = await Promise.all([fetchTripBundle(tripId), fetchCurrencyRates()]);
      setBundle(b);
      setRates(fx.rates);
      setSource(fx.source);
      setToCurrency(b.trip.homeCurrency);

      if (b.destinations[0]) {
        const c = b.destinations[0].country.toLowerCase();
        if (c.includes("japan")) setFromCurrency("JPY");
        else if (c.includes("france") || c.includes("italy")) setFromCurrency("EUR");
        else if (c.includes("korea")) setFromCurrency("KRW");
        else if (c.includes("philippines")) setFromCurrency("PHP");
      }
    } catch {} finally {
      setLoading(false);
    }
  }, [tripId]);

  useEffect(() => {
    void load();
  }, [load]);

  function convert(amount: number, from: string, to: string): number {
    if (!rates[from] || !rates[to]) return amount;
    const usd = amount / rates[from];
    return usd * rates[to];
  }

  function swapCurrencies() {
    setFromCurrency(toCurrency);
    setToCurrency(fromCurrency);
  }

  const parsedInput = parseFloat(inputAmount) || 0;
  const convertedResult = convert(parsedInput, fromCurrency, toCurrency);
  const singleUnitRate = convert(1, fromCurrency, toCurrency);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={[styles.container, { paddingTop: insets.top }]}
    >
      <Stack.Screen options={{ headerShown: false }} />

      {/* Editorial Header */}
      <Header
        eyebrow="EXCHANGE RATES"
        title="Live Currency & FX"
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
          {/* Main Interactive Calculator Card */}
          <Card padding={20} style={styles.calcCard}>
            <View style={styles.calcHeader}>
              <Text style={styles.calcLabel}>INSTANT TRAVEL CONVERTER</Text>
              <Badge label={`SOURCE: ${source.toUpperCase()}`} variant="forest" size="sm" />
            </View>

            <View style={styles.calcBody}>
              {/* From Block */}
              <View style={styles.currencyBlock}>
                <View style={styles.amountInputRow}>
                  <TextInput
                    value={inputAmount}
                    onChangeText={setInputAmount}
                    placeholder="0"
                    placeholderTextColor={TRAVEL_THEME.colors.inkDim}
                    keyboardType="numeric"
                    style={[styles.amountInput, TABULAR_NUMS]}
                  />
                  <Text style={styles.currencyTag}>{fromCurrency}</Text>
                </View>

                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pickerScroll}>
                  <View style={styles.pickerRow}>
                    {SUPPORTED_CURRENCIES.slice(0, 6).map((cur) => (
                      <TouchableOpacity
                        key={cur}
                        onPress={() => setFromCurrency(cur)}
                        style={[
                          styles.chip,
                          fromCurrency === cur && styles.chipActive,
                        ]}
                      >
                        <Text style={[styles.chipText, fromCurrency === cur && styles.chipTextActive]}>
                          {cur}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
              </View>

              {/* Swap Button */}
              <View style={styles.swapRow}>
                <View style={styles.swapLine} />
                <TouchableOpacity
                  onPress={swapCurrencies}
                  activeOpacity={0.8}
                  style={styles.swapBtn}
                >
                  <Ionicons name="swap-vertical" size={18} color={TRAVEL_THEME.colors.terracotta} />
                </TouchableOpacity>
                <View style={styles.swapLine} />
              </View>

              {/* To Block */}
              <View style={styles.currencyBlock}>
                <View style={styles.amountInputRow}>
                  <Text style={[styles.convertedAmount, TABULAR_NUMS]}>
                    {fmtMoney(convertedResult, toCurrency)}
                  </Text>
                  <Text style={styles.currencyTag}>{toCurrency}</Text>
                </View>

                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pickerScroll}>
                  <View style={styles.pickerRow}>
                    {SUPPORTED_CURRENCIES.slice(0, 6).map((cur) => (
                      <TouchableOpacity
                        key={cur}
                        onPress={() => setToCurrency(cur)}
                        style={[
                          styles.chip,
                          toCurrency === cur && styles.chipActive,
                        ]}
                      >
                        <Text style={[styles.chipText, toCurrency === cur && styles.chipTextActive]}>
                          {cur}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
              </View>
            </View>

            {/* Benchmark baseline */}
            <View style={styles.benchmarkRow}>
              <Text style={styles.benchmarkLabel}>BENCHMARK</Text>
              <Text style={[styles.benchmarkValue, TABULAR_NUMS]}>
                1 {fromCurrency} = {fmtMoney(singleUnitRate, toCurrency)}
              </Text>
            </View>
          </Card>

          {/* Denomination Cheat Sheet */}
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionLabel}>DENOMINATION CHEAT SHEET</Text>
            <Card padding={14} style={styles.tableCard}>
              <View style={styles.tableHeader}>
                <Text style={styles.thCol}>LOCAL AMOUNT ({fromCurrency})</Text>
                <Text style={[styles.thCol, { textAlign: "right" }]}>ESTIMATED HOME ({toCurrency})</Text>
              </View>

              {DENOMINATIONS.map((val, idx) => {
                const converted = convert(val, fromCurrency, toCurrency);
                return (
                  <View
                    key={val}
                    style={[
                      styles.tableRow,
                      idx > 0 && styles.tableRowBorder,
                    ]}
                  >
                    <Text style={[styles.tdVal, TABULAR_NUMS]}>
                      {fmtMoney(val, fromCurrency)}
                    </Text>
                    <Text style={[styles.tdHome, TABULAR_NUMS]}>
                      {fmtMoney(converted, toCurrency)}
                    </Text>
                  </View>
                );
              })}
            </Card>
          </View>
        </ScrollView>
      )}

      {/* Floating Bottom Nav */}
      <BottomNav tripId={tripId} activeTab="wallet" accentColor={TRAVEL_THEME.colors.terracotta} />
    </KeyboardAvoidingView>
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
  calcCard: {
    backgroundColor: TRAVEL_THEME.colors.surface,
    borderColor: TRAVEL_THEME.colors.border,
    ...TRAVEL_THEME.shadows.card,
  },
  calcHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  calcLabel: {
    fontSize: 9.5,
    fontWeight: "800",
    letterSpacing: 1.2,
    color: TRAVEL_THEME.colors.inkMuted,
  },
  calcBody: {
    marginTop: 14,
    gap: 10,
  },
  currencyBlock: {
    backgroundColor: TRAVEL_THEME.colors.surfaceWarm,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: TRAVEL_THEME.colors.border,
  },
  amountInputRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  amountInput: {
    fontFamily: "Georgia",
    fontSize: 28,
    fontWeight: "700",
    color: TRAVEL_THEME.colors.inkPrimary,
    flex: 1,
    padding: 0,
  },
  convertedAmount: {
    fontFamily: "Georgia",
    fontSize: 28,
    fontWeight: "700",
    color: TRAVEL_THEME.colors.terracotta,
    flex: 1,
  },
  currencyTag: {
    fontSize: 14,
    fontWeight: "800",
    color: TRAVEL_THEME.colors.inkMuted,
    marginLeft: 8,
  },
  pickerScroll: {
    marginTop: 10,
  },
  pickerRow: {
    flexDirection: "row",
    gap: 6,
  },
  chip: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 7,
    backgroundColor: TRAVEL_THEME.colors.surface,
    borderWidth: 1,
    borderColor: TRAVEL_THEME.colors.border,
  },
  chipActive: {
    backgroundColor: TRAVEL_THEME.colors.terracotta,
    borderColor: TRAVEL_THEME.colors.terracotta,
  },
  chipText: {
    fontSize: 11.5,
    fontWeight: "600",
    color: TRAVEL_THEME.colors.inkSecondary,
  },
  chipTextActive: {
    color: "#FFFFFF",
  },
  swapRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginVertical: -2,
  },
  swapLine: {
    flex: 1,
    height: 1,
    backgroundColor: TRAVEL_THEME.colors.borderSubtle,
  },
  swapBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: TRAVEL_THEME.colors.surface,
    borderWidth: 1,
    borderColor: TRAVEL_THEME.colors.border,
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 10,
    ...TRAVEL_THEME.shadows.card,
  },
  benchmarkRow: {
    marginTop: 14,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: TRAVEL_THEME.colors.borderSubtle,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  benchmarkLabel: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.8,
    color: TRAVEL_THEME.colors.inkMuted,
  },
  benchmarkValue: {
    fontSize: 12.5,
    fontWeight: "600",
    color: TRAVEL_THEME.colors.inkPrimary,
  },
  sectionContainer: {
    gap: 8,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.2,
    color: TRAVEL_THEME.colors.inkMuted,
    paddingHorizontal: 2,
  },
  tableCard: {
    backgroundColor: TRAVEL_THEME.colors.surface,
    borderColor: TRAVEL_THEME.colors.border,
  },
  tableHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: TRAVEL_THEME.colors.borderSubtle,
    marginBottom: 4,
  },
  thCol: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.8,
    color: TRAVEL_THEME.colors.inkMuted,
  },
  tableRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 9,
  },
  tableRowBorder: {
    borderTopWidth: 1,
    borderTopColor: TRAVEL_THEME.colors.borderSubtle,
  },
  tdVal: {
    fontSize: 13,
    fontWeight: "600",
    color: TRAVEL_THEME.colors.inkPrimary,
  },
  tdHome: {
    fontSize: 13,
    fontWeight: "600",
    color: TRAVEL_THEME.colors.terracotta,
  },
});
