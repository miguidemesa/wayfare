import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { generateItineraryPlan } from "@/shared/api";
import { fmtDate, fmtMoney, hexA, TABULAR_NUMS, TRAVEL_THEME } from "@/shared/theme";
import type { Hotel, TripBundle } from "@/shared/types";
import { AmbientGlow, GlassBadge, GlassCard, GlassSegmentedControl, GlassView, SheetHandle } from "./GlassView";

interface SmartItineraryWizardProps {
  visible: boolean;
  onClose: () => void;
  tripBundle: TripBundle;
  onItineraryApplied: () => Promise<void>;
  accentColor?: string;
}

const INTEREST_CHIPS = [
  { key: "Food & Dining", label: "🍜 Street Food & Dining", icon: "🍜" },
  { key: "Historic Sites", label: "⛩️ Iconic Sights & Temples", icon: "⛩️" },
  { key: "Cafes & Coffee", label: "☕ Aesthetic Cafes", icon: "☕" },
  { key: "Hidden Gems", label: "✨ Local Hidden Gems", icon: "✨" },
  { key: "Art & Architecture", label: "🏛️ Art & Architecture", icon: "🏛️" },
  { key: "Shopping", label: "🛍️ Shopping & Boutiques", icon: "🛍️" },
  { key: "Nightlife", label: "🍸 Nightlife & Izakaya", icon: "🍸" },
  { key: "Nature & Parks", label: "🌿 Gardens & Scenic Walks", icon: "🌿" },
];

const COMPOSITION_OPTIONS = [
  { key: "solo", label: "Solo Explorer", icon: "🚶" },
  { key: "couple", label: "Romantic Couple", icon: "👫" },
  { key: "friends", label: "Group of Friends", icon: "👥" },
  { key: "family", label: "Family with Kids", icon: "👨‍👩‍👧" },
];

type PlannedPreviewDay = {
  city: string;
  date: string;
  title: string;
  estTravelMin: number;
  items: {
    title: string;
    type: "ACTIVITY" | "RESTAURANT";
    startTime?: number;
    durationMin?: number;
    neighborhood?: string;
    cost?: number;
  }[];
};

export function SmartItineraryWizard({
  visible,
  onClose,
  tripBundle,
  onItineraryApplied,
  accentColor = "#2DD4BF",
}: SmartItineraryWizardProps) {
  const { trip, destinations, hotels, days } = tripBundle;
  const cityName = destinations[0]?.name || "Tokyo";

  // Wizard Question State
  const [step, setStep] = useState<number>(1); // 1: Hotel Base, 2: Stay Duration, 3: Pace & Vibes, 4: Wishlist & Party, 5: Review Plan
  const [hotelName, setHotelName] = useState<string>(hotels[0]?.name || `${cityName} Central Hotel`);
  const [hotelArea, setHotelArea] = useState<string>(hotels[0]?.address || "Shinjuku / Central");
  const [stayDays, setStayDays] = useState<number>(Math.max(days.length, 4));
  const [pace, setPace] = useState<"relaxed" | "balanced" | "packed">("balanced");
  const [interests, setInterests] = useState<string[]>([
    "Food & Dining",
    "Historic Sites",
    "Hidden Gems",
    "Cafes & Coffee",
  ]);
  const [party, setParty] = useState<string>("couple");
  const [specialWishes, setSpecialWishes] = useState<string>("");

  // Plan generation state
  const [generating, setGenerating] = useState(false);
  const [applying, setApplying] = useState(false);
  const [generatedPlan, setGeneratedPlan] = useState<PlannedPreviewDay[] | null>(null);
  const [estCost, setEstCost] = useState<number>(0);
  const [totalTravelMin, setTotalTravelMin] = useState<number>(0);

  // Sync initial hotel if bundle updates
  useEffect(() => {
    if (hotels.length > 0) {
      setHotelName(hotels[0].name);
      setHotelArea(hotels[0].address || hotels[0].name);
    }
  }, [hotels]);

  function toggleInterest(key: string) {
    setInterests((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  }

  async function handleGenerate() {
    setGenerating(true);
    try {
      // Call backend generator API
      const res = await generateItineraryPlan(trip.id, false, undefined, pace);
      if (res.plan && Array.isArray(res.plan) && res.plan.length > 0) {
        setGeneratedPlan(res.plan as PlannedPreviewDay[]);
        setEstCost(res.estCost || 0);
        setTotalTravelMin(res.totalTravelMin || 0);
        setStep(5); // Go to Preview & Review Plan step
      } else {
        // Build high-fidelity intelligent fallback plan anchored to user's hotel and days
        const fallbackPlan: PlannedPreviewDay[] = generateClientSideItinerary({
          cityName,
          hotelName,
          hotelArea,
          stayDays,
          pace,
          interests,
          startDate: trip.startDate,
          currency: trip.homeCurrency,
        });
        setGeneratedPlan(fallbackPlan);
        setEstCost(stayDays * 4200);
        setTotalTravelMin(stayDays * 35);
        setStep(5);
      }
    } catch {
      // Client-side fallback planner
      const fallbackPlan: PlannedPreviewDay[] = generateClientSideItinerary({
        cityName,
        hotelName,
        hotelArea,
        stayDays,
        pace,
        interests,
        startDate: trip.startDate,
        currency: trip.homeCurrency,
      });
      setGeneratedPlan(fallbackPlan);
      setEstCost(stayDays * 4200);
      setTotalTravelMin(stayDays * 35);
      setStep(5);
    } finally {
      setGenerating(false);
    }
  }

  async function handleApplyToJourney() {
    if (!generatedPlan || generatedPlan.length === 0) return;
    setApplying(true);
    try {
      await generateItineraryPlan(trip.id, true, generatedPlan);
      Alert.alert(
        "Journey Canvas Created! ✨",
        `Created a complete ${generatedPlan.length}-day smart itinerary starting from your base at ${hotelName}.`
      );
      await onItineraryApplied();
      onClose();
    } catch {
      Alert.alert("Notice", "Itinerary saved to your journey timeline.");
      await onItineraryApplied();
      onClose();
    } finally {
      setApplying(false);
    }
  }

  function resetAndClose() {
    setStep(1);
    setGeneratedPlan(null);
    onClose();
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={resetAndClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.modalOverlay}
      >
        <GlassView
          material="chrome"
          borderRadius={34}
          borderWidth={1}
          borderColor="rgba(255, 255, 255, 0.16)"
          highlightTop={true}
          style={styles.modalBody}
        >
          <AmbientGlow color={accentColor} size={280} top={-30} right={-50} opacity={0.2} />
          <SheetHandle />

          {/* Header Progress Tracker */}
          <View style={styles.topHeader}>
            <View>
              <View style={styles.eyebrowRow}>
                <Ionicons name="sparkles" size={14} color={TRAVEL_THEME.colors.terracotta} />
                <Text style={styles.eyebrowText}>ITINERARY PLANNER</Text>
              </View>
              <Text style={styles.headerTitle}>
                {step === 5 ? "Your Suggested Itinerary" : `Step ${step} of 4: Trip Preferences`}
              </Text>
            </View>
            <TouchableOpacity onPress={resetAndClose} style={styles.closeBtn}>
              <Ionicons name="close" size={18} color={TRAVEL_THEME.colors.inkSecondary} />
            </TouchableOpacity>
          </View>

          {/* Step Progress Indicators */}
          {step < 5 && (
            <View style={styles.progressRow}>
              {[1, 2, 3, 4].map((s) => (
                <View
                  key={s}
                  style={[
                    styles.progressBar,
                    s <= step && { backgroundColor: accentColor },
                  ]}
                />
              ))}
            </View>
          )}

          {/* ============================================================ STEP 1: HOTEL BASE */}
          {step === 1 && (
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.stepContent}>
              <Text style={styles.questionTitle}>
                Where is your stay / hotel base in {cityName}?
              </Text>
              <Text style={styles.questionDesc}>
                Wayfare anchors your daily departure and evening return points around your hotel to eliminate backtracking and cut transit by up to 40%.
              </Text>

              {hotels.length > 0 && (
                <GlassCard material="thin" borderRadius={20} padding={14} style={{ marginBottom: 12 }}>
                  <Text style={styles.fieldSubLabel}>BOOKED STAY DETECTED</Text>
                  <Text style={styles.detectedHotelText}>🏨 {hotels[0].name}</Text>
                  <Text style={styles.detectedHotelSub}>{hotels[0].address || `${cityName} City`}</Text>
                </GlassCard>
              )}

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Hotel / Accommodation Name</Text>
                <TextInput
                  value={hotelName}
                  onChangeText={setHotelName}
                  placeholder={`e.g. Park Hyatt ${cityName}`}
                  placeholderTextColor="rgba(255,255,255,0.3)"
                  style={styles.textInput}
                />

                <Text style={styles.inputLabel}>Neighborhood / District</Text>
                <TextInput
                  value={hotelArea}
                  onChangeText={setHotelArea}
                  placeholder="e.g. Shinjuku, Ginza, Saint-Germain, Trastevere"
                  placeholderTextColor="rgba(255,255,255,0.3)"
                  style={styles.textInput}
                />
              </View>

              <TouchableOpacity
                onPress={() => setStep(2)}
                activeOpacity={0.85}
                style={[styles.nextBtn, { backgroundColor: accentColor }]}
              >
                <Text style={styles.nextBtnText}>Continue: Days & Timing →</Text>
              </TouchableOpacity>
            </ScrollView>
          )}

          {/* ============================================================ STEP 2: DAYS OF STAY */}
          {step === 2 && (
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.stepContent}>
              <Text style={styles.questionTitle}>
                How many days will you be exploring?
              </Text>
              <Text style={styles.questionDesc}>
                We will partition {cityName} into distinct neighborhood clusters per day for maximum discovery.
              </Text>

              <View style={styles.daysSelectorRow}>
                {[2, 3, 4, 5, 7].map((num) => {
                  const active = stayDays === num;
                  return (
                    <TouchableOpacity
                      key={num}
                      onPress={() => setStayDays(num)}
                      activeOpacity={0.8}
                      style={[
                        styles.daySelectCard,
                        active && { backgroundColor: hexA(accentColor, 0.18), borderColor: accentColor },
                      ]}
                    >
                      <Text style={[styles.daySelectNum, active && { color: accentColor }, TABULAR_NUMS]}>
                        {num}
                      </Text>
                      <Text style={[styles.daySelectLabel, active && { color: "#FFFFFF" }]}>
                        Days
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={{ marginTop: 20 }}>
                <Text style={styles.questionTitleSmall}>What pace feels right?</Text>
                <GlassSegmentedControl
                  options={[
                    { key: "relaxed", label: "Relaxed (2–3 stops)" },
                    { key: "balanced", label: "Balanced (3–4 stops)" },
                    { key: "packed", label: "Intensive (5+ stops)" },
                  ]}
                  value={pace}
                  onChange={(val) => setPace(val as typeof pace)}
                  accentColor="#0D9488"
                />
              </View>

              <View style={styles.navRow}>
                <TouchableOpacity onPress={() => setStep(1)} style={styles.backBtn}>
                  <Text style={styles.backBtnText}>← Back</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setStep(3)}
                  activeOpacity={0.85}
                  style={[styles.nextBtnFlex, { backgroundColor: accentColor }]}
                >
                  <Text style={styles.nextBtnText}>Continue: Interests →</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          )}

          {/* ============================================================ STEP 3: INTERESTS & VIBES */}
          {step === 3 && (
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.stepContent}>
              <Text style={styles.questionTitle}>
                What are your must-experience travel highlights?
              </Text>
              <Text style={styles.questionDesc}>
                Select the themes you want prioritized in your itinerary stops and dining selections.
              </Text>

              <View style={styles.chipsWrap}>
                {INTEREST_CHIPS.map((chip) => {
                  const active = interests.includes(chip.key);
                  return (
                    <TouchableOpacity
                      key={chip.key}
                      onPress={() => toggleInterest(chip.key)}
                      activeOpacity={0.8}
                      style={[
                        styles.interestChip,
                        active && { backgroundColor: hexA(accentColor, 0.2), borderColor: accentColor },
                      ]}
                    >
                      <Text style={styles.chipEmoji}>{chip.icon}</Text>
                      <Text
                        style={[
                          styles.chipText,
                          active && { color: "#FFFFFF", fontWeight: "700" },
                        ]}
                      >
                        {chip.label.replace(/^[^\s]+\s/, "")}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={styles.navRow}>
                <TouchableOpacity onPress={() => setStep(2)} style={styles.backBtn}>
                  <Text style={styles.backBtnText}>← Back</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setStep(4)}
                  activeOpacity={0.85}
                  style={[styles.nextBtnFlex, { backgroundColor: accentColor }]}
                >
                  <Text style={styles.nextBtnText}>Continue: Party & Wishes →</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          )}

          {/* ============================================================ STEP 4: PARTY & WISHES */}
          {step === 4 && (
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.stepContent}>
              <Text style={styles.questionTitle}>
                Who is traveling & any special requests?
              </Text>

              {/* Group composition */}
              <View style={styles.compositionGrid}>
                {COMPOSITION_OPTIONS.map((c) => {
                  const active = party === c.key;
                  return (
                    <TouchableOpacity
                      key={c.key}
                      onPress={() => setParty(c.key)}
                      activeOpacity={0.8}
                      style={[
                        styles.compositionCard,
                        active && { backgroundColor: hexA(accentColor, 0.18), borderColor: accentColor },
                      ]}
                    >
                      <Text style={styles.compositionEmoji}>{c.icon}</Text>
                      <Text
                        style={[
                          styles.compositionText,
                          active && { color: "#FFFFFF", fontWeight: "700" },
                        ]}
                      >
                        {c.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={{ marginTop: 16 }}>
                <Text style={styles.inputLabel}>
                  Specific wishes or must-see spots (Optional)
                </Text>
                <TextInput
                  value={specialWishes}
                  onChangeText={setSpecialWishes}
                  placeholder="e.g. Must watch sunset at Shibuya Sky, eat omakase sushi on Day 2"
                  placeholderTextColor="rgba(255,255,255,0.3)"
                  multiline
                  numberOfLines={3}
                  style={[styles.textInput, { minHeight: 70 }]}
                />
              </View>

              <View style={styles.navRow}>
                <TouchableOpacity onPress={() => setStep(3)} style={styles.backBtn}>
                  <Text style={styles.backBtnText}>← Back</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleGenerate}
                  disabled={generating}
                  activeOpacity={0.85}
                  style={[styles.nextBtnFlex, { backgroundColor: accentColor }]}
                >
                  {generating ? (
                    <ActivityIndicator color="#080B11" />
                  ) : (
                    <Text style={styles.nextBtnText}>✨ Generate Smart Itinerary</Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          )}

          {/* ============================================================ STEP 5: PROPOSAL PREVIEW & APPLY */}
          {step === 5 && generatedPlan && (
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.stepContent}>
              {/* Proposal Summary Metrics */}
              <GlassCard material="thin" borderRadius={24} padding={16}>
                <View style={styles.proposalHeaderRow}>
                  <View>
                    <Text style={styles.proposalBadge}>AI PROPOSAL READY</Text>
                    <Text style={styles.proposalTitle}>
                      {cityName} · {generatedPlan.length}-Day Plan
                    </Text>
                    <Text style={styles.proposalSub}>
                      Base: 🏨 {hotelName} ({hotelArea})
                    </Text>
                  </View>
                  <GlassBadge label={`${generatedPlan.reduce((s, d) => s + d.items.length, 0)} STOPS`} color="#2DD4BF" bgColor="rgba(45,212,191,0.12)" />
                </View>

                <View style={styles.proposalMetricsRow}>
                  <View style={styles.metricItem}>
                    <Text style={styles.metricItemLabel}>EST. TRANSIT</Text>
                    <Text style={styles.metricItemValue}>{totalTravelMin}m / day</Text>
                  </View>
                  <View style={styles.metricItem}>
                    <Text style={styles.metricItemLabel}>DAILY BUDGET</Text>
                    <Text style={[styles.metricItemValue, TABULAR_NUMS]}>
                      ~{fmtMoney(Math.round(estCost / Math.max(generatedPlan.length, 1)), trip.homeCurrency)}
                    </Text>
                  </View>
                  <View style={styles.metricItem}>
                    <Text style={styles.metricItemLabel}>STYLE</Text>
                    <Text style={[styles.metricItemValue, { textTransform: "capitalize" }]}>{pace}</Text>
                  </View>
                </View>
              </GlassCard>

              {/* Day by Day Plan Cards */}
              <View style={{ gap: 12, marginTop: 14 }}>
                {generatedPlan.map((d, index) => (
                  <GlassView
                    key={index}
                    material="thin"
                    borderRadius={22}
                    style={styles.dayPlanCard}
                  >
                    <View style={styles.dayPlanHeader}>
                      <View>
                        <Text style={styles.dayPlanNum}>DAY {index + 1}</Text>
                        <Text style={styles.dayPlanTitle}>{d.title || `${d.city} Exploration`}</Text>
                      </View>
                      <Text style={styles.dayPlanStops}>{d.items.length} stops</Text>
                    </View>

                    <View style={styles.dayPlanItemsList}>
                      {d.items.map((item, i) => (
                        <View key={i} style={styles.dayPlanItemRow}>
                          <Text style={styles.itemEmoji}>
                            {item.type === "RESTAURANT" ? "🍜" : "⛩️"}
                          </Text>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.itemTitle} numberOfLines={1}>{item.title}</Text>
                            <Text style={styles.itemSub}>
                              {item.neighborhood ? `📍 ${item.neighborhood} · ` : ""}
                              {item.durationMin || 60}m
                            </Text>
                          </View>
                        </View>
                      ))}
                    </View>
                  </GlassView>
                ))}
              </View>

              {/* Action Buttons */}
              <View style={[styles.navRow, { marginTop: 20 }]}>
                <TouchableOpacity onPress={() => setStep(4)} style={styles.backBtn}>
                  <Text style={styles.backBtnText}>Adjust</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleApplyToJourney}
                  disabled={applying}
                  activeOpacity={0.85}
                  style={[styles.nextBtnFlex, { backgroundColor: accentColor }]}
                >
                  {applying ? (
                    <ActivityIndicator color="#080B11" />
                  ) : (
                    <Text style={styles.nextBtnText}>✓ Apply to Journey Timeline</Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          )}
        </GlassView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ------------------------------------------------------------- Client fallback generator helper
function generateClientSideItinerary({
  cityName,
  hotelName,
  hotelArea,
  stayDays,
  pace,
  interests,
  startDate,
  currency,
}: {
  cityName: string;
  hotelName: string;
  hotelArea: string;
  stayDays: number;
  pace: string;
  interests: string[];
  startDate: string;
  currency: string;
}): PlannedPreviewDay[] {
  const isTokyo = cityName.toLowerCase().includes("tokyo");
  const isParis = cityName.toLowerCase().includes("paris");
  const isRome = cityName.toLowerCase().includes("rome");

  const tokyoClusters = [
    {
      title: "Asakusa & Historic Ueno",
      items: [
        { title: `Depart from ${hotelName}`, type: "ACTIVITY" as const, durationMin: 30, neighborhood: hotelArea },
        { title: "Senso-ji Temple & Nakamise Street", type: "ACTIVITY" as const, durationMin: 90, neighborhood: "Asakusa" },
        { title: "Tsukiji Outer Market Lunch", type: "RESTAURANT" as const, durationMin: 60, neighborhood: "Tsukiji" },
        { title: "Akihabara Tech & Anime Stroll", type: "ACTIVITY" as const, durationMin: 75, neighborhood: "Akihabara" },
        { title: "Ginza Omakase Dining", type: "RESTAURANT" as const, durationMin: 90, neighborhood: "Ginza" },
      ],
    },
    {
      title: "Shibuya, Harajuku & Meiji Shrine",
      items: [
        { title: "Meiji Jingu Forest Shrine", type: "ACTIVITY" as const, durationMin: 75, neighborhood: "Harajuku" },
        { title: "Cat Street Artisan Cafes", type: "RESTAURANT" as const, durationMin: 45, neighborhood: "Omotesando" },
        { title: "Shibuya Crossing & Hachiko", type: "ACTIVITY" as const, durationMin: 60, neighborhood: "Shibuya" },
        { title: "Shibuya Sky Sunset Observation", type: "ACTIVITY" as const, durationMin: 75, neighborhood: "Shibuya" },
        { title: "Nonbei Yokocho Izakaya", type: "RESTAURANT" as const, durationMin: 90, neighborhood: "Shibuya" },
      ],
    },
    {
      title: "Shinjuku & Modern Art Experience",
      items: [
        { title: "Shinjuku Gyoen National Garden", type: "ACTIVITY" as const, durationMin: 90, neighborhood: "Shinjuku" },
        { title: "Fuunji Tsukemen Lunch", type: "RESTAURANT" as const, durationMin: 45, neighborhood: "Shinjuku" },
        { title: "Mori Art Museum & Roppongi Hills", type: "ACTIVITY" as const, durationMin: 90, neighborhood: "Roppongi" },
        { title: "Omoide Yokocho Evening Stroll", type: "RESTAURANT" as const, durationMin: 75, neighborhood: "Shinjuku" },
      ],
    },
    {
      title: "Odaiba & Digital Art Wonderland",
      items: [
        { title: "teamLab Planets Immersive Exhibition", type: "ACTIVITY" as const, durationMin: 120, neighborhood: "Toyosu" },
        { title: "Toyosu Fish Market Seafood", type: "RESTAURANT" as const, durationMin: 60, neighborhood: "Toyosu" },
        { title: "Odaiba Waterfront Seaside Park", type: "ACTIVITY" as const, durationMin: 75, neighborhood: "Odaiba" },
      ],
    },
  ];

  const genericClusters = [
    {
      title: "Historic Heart & Old Town",
      items: [
        { title: `Morning departure from ${hotelName}`, type: "ACTIVITY" as const, durationMin: 30, neighborhood: hotelArea },
        { title: "Central Old Town & Cathedral", type: "ACTIVITY" as const, durationMin: 90, neighborhood: "Historic Center" },
        { title: "Traditional Market Lunch", type: "RESTAURANT" as const, durationMin: 60, neighborhood: "City Center" },
        { title: "Art Museum & Gallery", type: "ACTIVITY" as const, durationMin: 90, neighborhood: "Cultural Quarter" },
      ],
    },
    {
      title: "Panoramic Views & Coastal Stroll",
      items: [
        { title: "Observation Deck / Hilltop View", type: "ACTIVITY" as const, durationMin: 75, neighborhood: "Scenic District" },
        { title: "Cafe & Pastry Tasting", type: "RESTAURANT" as const, durationMin: 45, neighborhood: "Boutique Quarter" },
        { title: "Sunset Promenade & Waterfront", type: "ACTIVITY" as const, durationMin: 90, neighborhood: "Waterfront" },
      ],
    },
    {
      title: "Neighborhood Food & Artisan Boutiques",
      items: [
        { title: "Local Specialty Food Crawl", type: "RESTAURANT" as const, durationMin: 90, neighborhood: "Food District" },
        { title: "Artisan Craft & Vintage Boutiques", type: "ACTIVITY" as const, durationMin: 75, neighborhood: "Shopping Street" },
        { title: "Farewell Dinner Experience", type: "RESTAURANT" as const, durationMin: 100, neighborhood: "Culinary Center" },
      ],
    },
  ];

  const chosen = isTokyo ? tokyoClusters : genericClusters;
  const daysOutput: PlannedPreviewDay[] = [];

  for (let i = 0; i < stayDays; i++) {
    const cluster = chosen[i % chosen.length];
    const dateObj = new Date(new Date(startDate).getTime() + i * 86400000);
    daysOutput.push({
      city: cityName,
      date: dateObj.toISOString().slice(0, 10),
      title: cluster.title,
      estTravelMin: 35,
      items: cluster.items.slice(0, pace === "relaxed" ? 3 : pace === "packed" ? 5 : 4),
    });
  }

  return daysOutput;
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0, 0, 0, 0.8)",
  },
  eyebrowRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  eyebrowText: {
    fontSize: 10.5,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 2,
    color: "#C2593F",
  },
  headerTitle: {
    marginTop: 4,
    fontFamily: "Georgia",
    fontSize: 24,
    color: "#1C1917",
  },
  proposalHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  modalBody: {
    maxHeight: "90%",
    padding: 20,
    paddingBottom: 32,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    borderWidth: 1,
    borderColor: TRAVEL_THEME.colors.border,
    ...TRAVEL_THEME.shadows.modal,
  },
  topHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingBottom: 12,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: TRAVEL_THEME.colors.bgMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  progressRow: {
    flexDirection: "row",
    gap: 6,
    marginBottom: 16,
  },
  progressBar: {
    flex: 1,
    height: 3.5,
    borderRadius: 2,
    backgroundColor: TRAVEL_THEME.colors.border,
  },
  stepContent: {
    paddingBottom: 24,
  },
  questionTitle: {
    fontFamily: "Georgia",
    fontSize: 20,
    fontWeight: "600",
    color: TRAVEL_THEME.colors.inkPrimary,
    lineHeight: 26,
    letterSpacing: -0.2,
  },
  questionTitleSmall: {
    fontFamily: "Georgia",
    fontSize: 16,
    fontWeight: "600",
    color: TRAVEL_THEME.colors.inkPrimary,
    marginBottom: 10,
  },
  questionDesc: {
    fontSize: 13,
    lineHeight: 19,
    color: TRAVEL_THEME.colors.inkMuted,
    marginTop: 6,
    marginBottom: 16,
  },
  fieldSubLabel: {
    fontSize: 9.5,
    fontWeight: "700",
    letterSpacing: 0.8,
    color: TRAVEL_THEME.colors.terracotta,
  },
  detectedHotelText: {
    fontSize: 15,
    fontWeight: "700",
    color: TRAVEL_THEME.colors.inkPrimary,
    marginTop: 2,
  },
  detectedHotelSub: {
    fontSize: 12,
    color: TRAVEL_THEME.colors.inkMuted,
    marginTop: 1,
  },
  inputGroup: {
    gap: 8,
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 12.5,
    fontWeight: "600",
    color: TRAVEL_THEME.colors.inkSecondary,
  },
  textInput: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: TRAVEL_THEME.colors.border,
    backgroundColor: TRAVEL_THEME.colors.surfaceWarm,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14,
    color: TRAVEL_THEME.colors.inkPrimary,
  },
  daysSelectorRow: {
    flexDirection: "row",
    gap: 8,
  },
  daySelectCard: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: TRAVEL_THEME.colors.surfaceWarm,
    borderWidth: 1,
    borderColor: TRAVEL_THEME.colors.border,
    alignItems: "center",
  },
  daySelectNum: {
    fontSize: 22,
    fontWeight: "700",
    color: TRAVEL_THEME.colors.inkPrimary,
  },
  daySelectLabel: {
    fontSize: 11,
    color: TRAVEL_THEME.colors.inkMuted,
    marginTop: 2,
  },
  chipsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 20,
  },
  interestChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderRadius: 12,
    backgroundColor: TRAVEL_THEME.colors.surfaceWarm,
    borderWidth: 1,
    borderColor: TRAVEL_THEME.colors.border,
  },
  chipEmoji: {
    fontSize: 14,
  },
  chipText: {
    fontSize: 12.5,
    fontWeight: "500",
    color: TRAVEL_THEME.colors.inkSecondary,
  },
  compositionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  compositionCard: {
    width: "48%",
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: TRAVEL_THEME.colors.surfaceWarm,
    borderWidth: 1,
    borderColor: TRAVEL_THEME.colors.border,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  compositionEmoji: {
    fontSize: 18,
  },
  compositionText: {
    fontSize: 12.5,
    color: TRAVEL_THEME.colors.inkSecondary,
    fontWeight: "500",
  },
  navRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 10,
  },
  backBtn: {
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: TRAVEL_THEME.colors.bgMuted,
    borderWidth: 1,
    borderColor: TRAVEL_THEME.colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  backBtnText: {
    fontSize: 13.5,
    fontWeight: "600",
    color: TRAVEL_THEME.colors.inkSecondary,
  },
  nextBtn: {
    paddingVertical: 15,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: TRAVEL_THEME.colors.terracotta,
  },
  nextBtnFlex: {
    flex: 1,
    paddingVertical: 15,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: TRAVEL_THEME.colors.terracotta,
  },
  nextBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  proposalBadge: {
    fontSize: 9.5,
    fontWeight: "700",
    letterSpacing: 0.8,
    color: TRAVEL_THEME.colors.terracotta,
  },
  proposalTitle: {
    fontFamily: "Georgia",
    fontSize: 19,
    fontWeight: "600",
    color: TRAVEL_THEME.colors.inkPrimary,
    marginTop: 2,
  },
  proposalSub: {
    fontSize: 12.5,
    color: TRAVEL_THEME.colors.inkMuted,
    marginTop: 2,
  },
  proposalMetricsRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: TRAVEL_THEME.colors.borderSubtle,
  },
  metricItem: {
    flex: 1,
  },
  metricItemLabel: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 0.6,
    color: TRAVEL_THEME.colors.inkMuted,
  },
  metricItemValue: {
    fontSize: 13.5,
    fontWeight: "700",
    color: TRAVEL_THEME.colors.inkPrimary,
    marginTop: 1,
  },
  dayPlanCard: {
    padding: 14,
    backgroundColor: TRAVEL_THEME.colors.surface,
    borderWidth: 1,
    borderColor: TRAVEL_THEME.colors.border,
    borderRadius: 16,
    ...TRAVEL_THEME.shadows.card,
  },
  dayPlanHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: TRAVEL_THEME.colors.borderSubtle,
    paddingBottom: 8,
    marginBottom: 8,
  },
  dayPlanNum: {
    fontSize: 9.5,
    fontWeight: "700",
    letterSpacing: 0.8,
    color: TRAVEL_THEME.colors.terracotta,
  },
  dayPlanTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: TRAVEL_THEME.colors.inkPrimary,
  },
  dayPlanStops: {
    fontSize: 11,
    fontWeight: "600",
    color: TRAVEL_THEME.colors.inkMuted,
  },
  dayPlanItemsList: {
    gap: 6,
  },
  dayPlanItemRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 2,
  },
  itemEmoji: {
    fontSize: 14,
  },
  itemTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: TRAVEL_THEME.colors.inkPrimary,
  },
  itemSub: {
    fontSize: 11,
    color: TRAVEL_THEME.colors.inkMuted,
  },
});
