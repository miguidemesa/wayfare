import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
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
import { createTrip, ApiError } from "@/shared/api";
import { TABULAR_NUMS, TRAVEL_THEME } from "@/shared/theme";
import { SUPPORTED_CURRENCIES } from "@/shared/types";
import { Header } from "@/components/Header";
import { Card } from "@/components/ui/Surface";
import { Button } from "@/components/ui/Button";
import { SegmentedControl } from "@/components/ui/SegmentedControl";

const POPULAR_DESTINATIONS = [
  { name: "Tokyo", country: "Japan", lat: 35.6762, lng: 139.6503, emoji: "⛩️", theme: "japan" },
  { name: "Kyoto", country: "Japan", lat: 35.0116, lng: 135.7681, emoji: "🌸", theme: "japan" },
  { name: "Paris", country: "France", lat: 48.8566, lng: 2.3522, emoji: "🥐", theme: "france" },
  { name: "Rome", country: "Italy", lat: 41.9028, lng: 12.4964, emoji: "🍝", theme: "italy" },
  { name: "Manila", country: "Philippines", lat: 14.5995, lng: 120.9842, emoji: "🏝️", theme: "philippines" },
  { name: "Seoul", country: "South Korea", lat: 37.5665, lng: 126.978, emoji: "🌆", theme: "korea" },
];

const INTEREST_OPTIONS = [
  "Food & Dining",
  "Historic Sites",
  "Cafes & Coffee",
  "Photography",
  "Art & Museums",
  "Shopping",
  "Nature & Parks",
  "Nightlife",
  "Hidden Gems",
];

export { ErrorFallback as ErrorBoundary } from "@/components/ErrorFallback";

export default function NewTripScreen() {
  const insets = useSafeAreaInsets();

  const defaultStart = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);
  const defaultEnd = new Date(Date.now() + 21 * 86400000).toISOString().slice(0, 10);

  const [destCity, setDestCity] = useState("Tokyo");
  const [destCountry, setDestCountry] = useState("Japan");
  const [lat, setLat] = useState(35.6762);
  const [lng, setLng] = useState(139.6503);
  const [title, setTitle] = useState("Tokyo Autumn");
  const [startDate, setStartDate] = useState(defaultStart);
  const [endDate, setEndDate] = useState(defaultEnd);
  const [budgetAmount, setBudgetAmount] = useState("120000");
  const [homeCurrency, setHomeCurrency] = useState("USD");
  const [pace, setPace] = useState<"relaxed" | "balanced" | "packed">("balanced");
  const [travelersCount, setTravelersCount] = useState(1);
  const [interests, setInterests] = useState<string[]>([
    "Food & Dining",
    "Historic Sites",
    "Photography",
  ]);
  const [coverEmoji, setCoverEmoji] = useState("⛩️");
  const [coverTheme, setCoverTheme] = useState("japan");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function selectPreset(preset: (typeof POPULAR_DESTINATIONS)[0]) {
    setDestCity(preset.name);
    setDestCountry(preset.country);
    setLat(preset.lat);
    setLng(preset.lng);
    setTitle(`${preset.name} Adventure`);
    setCoverEmoji(preset.emoji);
    setCoverTheme(preset.theme);
  }

  function toggleInterest(item: string) {
    setInterests((prev) =>
      prev.includes(item) ? prev.filter((i) => i !== item) : [...prev, item]
    );
  }

  async function handleCreate() {
    if (!destCity.trim()) {
      setError("Please specify a destination city.");
      return;
    }
    if (!startDate || !endDate) {
      setError("Start date and end date are required.");
      return;
    }
    if (new Date(endDate) < new Date(startDate)) {
      setError("End date must be on or after start date.");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const res = await createTrip({
        title: title.trim() || `${destCity} Journey`,
        subtitle: `${destCity} · ${destCountry}`,
        destinations: [{ name: destCity.trim(), country: destCountry.trim(), lat, lng }],
        startDate,
        endDate,
        budgetAmount: Number(budgetAmount) || 0,
        homeCurrency,
        pace,
        interests,
        travelersCount,
        coverEmoji,
        coverTheme,
      });
      router.replace(`/trips/${res.trip.id}`);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not create trip. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={[styles.container, { paddingTop: insets.top }]}
    >
      <Stack.Screen options={{ headerShown: false }} />

      <Header
        eyebrow="NEW JOURNEY"
        title="Plan a Chapter"
        onBack={() => router.back()}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Destination Presets */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>POPULAR DESTINATIONS</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.presetsRow}
          >
            {POPULAR_DESTINATIONS.map((preset) => {
              const isSelected = destCity === preset.name;
              return (
                <TouchableOpacity
                  key={preset.name}
                  onPress={() => selectPreset(preset)}
                  activeOpacity={0.8}
                  style={[
                    styles.presetCard,
                    isSelected && styles.presetCardSelected,
                  ]}
                >
                  <Text style={styles.presetEmoji}>{preset.emoji}</Text>
                  <Text
                    style={[
                      styles.presetName,
                      isSelected && styles.presetNameSelected,
                    ]}
                  >
                    {preset.name}
                  </Text>
                  <Text style={styles.presetCountry}>{preset.country}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Journey Details Form Card */}
        <Card padding={20} style={styles.formCard}>
          {/* Destination inputs */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>DESTINATION CITY & COUNTRY</Text>
            <View style={styles.rowTwoCols}>
              <TextInput
                value={destCity}
                onChangeText={setDestCity}
                placeholder="City (e.g. Kyoto)"
                placeholderTextColor={TRAVEL_THEME.colors.inkDim}
                style={[styles.input, { flex: 1 }]}
              />
              <TextInput
                value={destCountry}
                onChangeText={setDestCountry}
                placeholder="Country (e.g. Japan)"
                placeholderTextColor={TRAVEL_THEME.colors.inkDim}
                style={[styles.input, { flex: 1 }]}
              />
            </View>
          </View>

          {/* Journey Title */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>JOURNEY TITLE</Text>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="e.g. Tokyo Autumn Expedition"
              placeholderTextColor={TRAVEL_THEME.colors.inkDim}
              style={styles.input}
            />
          </View>

          {/* Dates */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>TRAVEL DATES (YYYY-MM-DD)</Text>
            <View style={styles.rowTwoCols}>
              <View style={{ flex: 1 }}>
                <Text style={styles.inputSubLabel}>DEPARTURE</Text>
                <TextInput
                  value={startDate}
                  onChangeText={setStartDate}
                  placeholder="2026-10-14"
                  placeholderTextColor={TRAVEL_THEME.colors.inkDim}
                  style={[styles.input, TABULAR_NUMS]}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.inputSubLabel}>RETURN</Text>
                <TextInput
                  value={endDate}
                  onChangeText={setEndDate}
                  placeholder="2026-10-22"
                  placeholderTextColor={TRAVEL_THEME.colors.inkDim}
                  style={[styles.input, TABULAR_NUMS]}
                />
              </View>
            </View>
          </View>

          {/* Budget & Currency */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>BUDGET & CURRENCY</Text>
            <View style={styles.rowTwoCols}>
              <TextInput
                value={budgetAmount}
                onChangeText={setBudgetAmount}
                placeholder="Amount"
                keyboardType="numeric"
                placeholderTextColor={TRAVEL_THEME.colors.inkDim}
                style={[styles.input, { flex: 1.5 }, TABULAR_NUMS]}
              />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }}>
                <View style={styles.currencyRow}>
                  {SUPPORTED_CURRENCIES.slice(0, 5).map((cur) => (
                    <TouchableOpacity
                      key={cur}
                      onPress={() => setHomeCurrency(cur)}
                      style={[
                        styles.curChip,
                        homeCurrency === cur && styles.curChipSelected,
                      ]}
                    >
                      <Text
                        style={[
                          styles.curText,
                          homeCurrency === cur && styles.curTextSelected,
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

          {/* Travel Pace */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>TRAVEL PACE</Text>
            <SegmentedControl
              options={[
                { key: "relaxed", label: "Relaxed" },
                { key: "balanced", label: "Balanced" },
                { key: "packed", label: "Packed" },
              ]}
              value={pace}
              onChange={setPace}
              accentColor={TRAVEL_THEME.colors.terracotta}
            />
          </View>

          {/* Travelers Count */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>TRAVELERS</Text>
            <View style={styles.travelerCounter}>
              <TouchableOpacity
                onPress={() => setTravelersCount((c) => Math.max(1, c - 1))}
                style={styles.counterBtn}
              >
                <Ionicons name="remove" size={16} color={TRAVEL_THEME.colors.inkPrimary} />
              </TouchableOpacity>
              <Text style={[styles.counterVal, TABULAR_NUMS]}>
                {travelersCount} traveler{travelersCount > 1 ? "s" : ""}
              </Text>
              <TouchableOpacity
                onPress={() => setTravelersCount((c) => c + 1)}
                style={styles.counterBtn}
              >
                <Ionicons name="add" size={16} color={TRAVEL_THEME.colors.inkPrimary} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Interests Chips */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>INTERESTS & FOCUS</Text>
            <View style={styles.interestChipsWrap}>
              {INTEREST_OPTIONS.map((item) => {
                const active = interests.includes(item);
                return (
                  <TouchableOpacity
                    key={item}
                    onPress={() => toggleInterest(item)}
                    activeOpacity={0.8}
                    style={[
                      styles.interestChip,
                      active && styles.interestChipActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.interestText,
                        active && styles.interestTextActive,
                      ]}
                    >
                      {item}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {error ? (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle" size={14} color={TRAVEL_THEME.colors.danger} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <Button
            label="Create Journey"
            variant="primary"
            size="lg"
            loading={busy}
            onPress={handleCreate}
            iconLeft={<Ionicons name="airplane-outline" size={18} color="#FFFFFF" />}
            style={{ marginTop: 8 }}
          />
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: TRAVEL_THEME.colors.bg,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 40,
    gap: 16,
  },
  section: {
    gap: 8,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.2,
    color: TRAVEL_THEME.colors.inkMuted,
    paddingHorizontal: 2,
  },
  presetsRow: {
    gap: 10,
    paddingVertical: 2,
  },
  presetCard: {
    width: 100,
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 16,
    backgroundColor: TRAVEL_THEME.colors.surface,
    borderWidth: 1,
    borderColor: TRAVEL_THEME.colors.border,
    alignItems: "center",
    ...TRAVEL_THEME.shadows.card,
  },
  presetCardSelected: {
    borderColor: TRAVEL_THEME.colors.terracotta,
    backgroundColor: TRAVEL_THEME.colors.terracottaLight,
  },
  presetEmoji: {
    fontSize: 24,
    marginBottom: 4,
  },
  presetName: {
    fontSize: 13,
    fontWeight: "700",
    color: TRAVEL_THEME.colors.inkPrimary,
  },
  presetNameSelected: {
    color: TRAVEL_THEME.colors.terracottaDark,
  },
  presetCountry: {
    fontSize: 10.5,
    color: TRAVEL_THEME.colors.inkMuted,
    marginTop: 1,
  },
  formCard: {
    gap: 16,
  },
  fieldGroup: {
    gap: 6,
  },
  fieldLabel: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.8,
    color: TRAVEL_THEME.colors.inkMuted,
  },
  inputSubLabel: {
    fontSize: 9.5,
    fontWeight: "600",
    color: TRAVEL_THEME.colors.inkMuted,
    marginBottom: 3,
  },
  input: {
    backgroundColor: TRAVEL_THEME.colors.surfaceWarm,
    borderWidth: 1,
    borderColor: TRAVEL_THEME.colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 14,
    color: TRAVEL_THEME.colors.inkPrimary,
  },
  rowTwoCols: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
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
  curChipSelected: {
    backgroundColor: TRAVEL_THEME.colors.terracotta,
    borderColor: TRAVEL_THEME.colors.terracotta,
  },
  curText: {
    fontSize: 12,
    fontWeight: "700",
    color: TRAVEL_THEME.colors.inkSecondary,
  },
  curTextSelected: {
    color: "#FFFFFF",
  },
  travelerCounter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: TRAVEL_THEME.colors.surfaceWarm,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: TRAVEL_THEME.colors.border,
  },
  counterBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: TRAVEL_THEME.colors.surface,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: TRAVEL_THEME.colors.border,
  },
  counterVal: {
    fontSize: 14,
    fontWeight: "600",
    color: TRAVEL_THEME.colors.inkPrimary,
  },
  interestChipsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
  },
  interestChip: {
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: TRAVEL_THEME.colors.surfaceWarm,
    borderWidth: 1,
    borderColor: TRAVEL_THEME.colors.border,
  },
  interestChipActive: {
    backgroundColor: TRAVEL_THEME.colors.terracottaLight,
    borderColor: "#F0D7D0",
  },
  interestText: {
    fontSize: 12,
    fontWeight: "500",
    color: TRAVEL_THEME.colors.inkSecondary,
  },
  interestTextActive: {
    fontWeight: "600",
    color: TRAVEL_THEME.colors.terracottaDark,
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: TRAVEL_THEME.colors.dangerLight,
    borderWidth: 1,
    borderColor: "#F4D2CE",
  },
  errorText: {
    fontSize: 12,
    color: TRAVEL_THEME.colors.danger,
    flex: 1,
  },
});
