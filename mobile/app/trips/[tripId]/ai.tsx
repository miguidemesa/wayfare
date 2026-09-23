import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
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
import { addItineraryItem, api } from "@/shared/api";
import { resolveDestinationTheme, fmtClock, fmtMoney, TABULAR_NUMS, TRAVEL_THEME } from "@/shared/theme";
import type { TripBundle } from "@/shared/types";
import { Header } from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";
import { Card, Surface } from "@/components/ui/Surface";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { SmartItineraryWizard } from "@/components/SmartItineraryWizard";

type ProposalData = {
  type: "RELAX" | "RAIN_SWAP" | "DINING";
  title: string;
  summary: string;
  beforeStops: number;
  afterStops: number;
  timeSavedMin?: number;
  proposedItems: { title: string; type: string; time: string; neighborhood: string }[];
};

type Msg = {
  id: string;
  role: "user" | "assistant";
  content: string;
  proposal?: ProposalData;
  loading?: boolean;
};

const SUGGESTED_PROMPTS = [
  { label: "Relax schedule & rest", icon: "cafe-outline" },
  { label: "Rainy afternoon alternatives", icon: "rainy-outline" },
  { label: "Curated dinner near hotel", icon: "restaurant-outline" },
  { label: "Scenic morning walking route", icon: "walk-outline" },
];

export default function AiScreen() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const insets = useSafeAreaInsets();
  const [bundle, setBundle] = useState<TripBundle | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [applyingProposal, setApplyingProposal] = useState(false);
  const [wizardVisible, setWizardVisible] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const loadBundle = () => {
    api
      .get<TripBundle>(`/api/trips/${tripId}`)
      .then(setBundle)
      .catch(() => {});
  };

  useEffect(() => {
    loadBundle();
  }, [tripId]);

  // Contextual briefing from real trip state
  const briefing = (() => {
    if (!bundle) return null;
    const { days, expenses, weather, trip } = bundle;
    const hour = new Date().getHours();
    const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
    const now = new Date();
    const todayIso = now.toISOString().slice(0, 10);
    const next = days
      .flatMap((d) =>
        d.items
          .filter((i) => i.startTime != null)
          .map((i) => ({ ...i, date: d.date.slice(0, 10), city: d.city }))
      )
      .find(
        (i) =>
          i.date > todayIso ||
          (i.date === todayIso && i.startTime! >= now.getHours() * 60 + now.getMinutes() - 30)
      );
    const spent = expenses.reduce((s, e) => s + e.amountHome, 0);
    const rainy = weather.find((w) => w.rainProb >= 50);

    return {
      greeting,
      city: bundle.destinations[0]?.name || trip.title,
      nextStop: next ? `${next.title} at ${fmtClock(next.startTime)}` : "Itinerary open for creation",
      budgetPace:
        trip.budgetAmount > 0
          ? `${fmtMoney(Math.round(spent), trip.homeCurrency)} of ${fmtMoney(trip.budgetAmount, trip.homeCurrency)} spent`
          : "Budget on track",
      weatherAlert: rainy
        ? `Rain likely on ${rainy.date.slice(0, 10)} (${rainy.rainProb}% chance)`
        : "Clear skies expected today",
    };
  })();

  async function send(text?: string) {
    const message = (text ?? input).trim();
    if (!message || sending) return;
    setInput("");
    setSending(true);
    const aiId = `a-${Date.now()}`;

    let proposal: ProposalData | undefined;
    if (message.toLowerCase().includes("relax") || message.toLowerCase().includes("tired") || message.toLowerCase().includes("rest")) {
      proposal = {
        type: "RELAX",
        title: "Relaxed Day Schedule Proposal",
        summary: "I've trimmed 2 high-transit walking stops and allocated an extra 60 minutes for a relaxed cafe pause.",
        beforeStops: 5,
        afterStops: 3,
        timeSavedMin: 90,
        proposedItems: [
          { title: "Omotesando Morning Coffee & Bakery", type: "RESTAURANT", time: "10:30", neighborhood: "Omotesando" },
          { title: "Meiji Jingu Forest Stroll", type: "ACTIVITY", time: "12:30", neighborhood: "Harajuku" },
          { title: "Shibuya Sky Indoor Observatory", type: "ACTIVITY", time: "16:00", neighborhood: "Shibuya" },
        ],
      };
    } else if (message.toLowerCase().includes("rain") || message.toLowerCase().includes("indoor") || message.toLowerCase().includes("weather")) {
      proposal = {
        type: "RAIN_SWAP",
        title: "Indoor Weather Alternative Route",
        summary: "Afternoon rain forecast. Swapped outdoor gardens for covered arcades and museum galleries.",
        beforeStops: 4,
        afterStops: 4,
        proposedItems: [
          { title: "Covered Outer Market Tasting", type: "RESTAURANT", time: "10:00", neighborhood: "Tsukiji" },
          { title: "Mori Art Museum & Indoor Gallery", type: "ACTIVITY", time: "13:30", neighborhood: "Roppongi" },
          { title: "Underground Ramen Street Dining", type: "RESTAURANT", time: "18:00", neighborhood: "Central" },
        ],
      };
    }

    setMessages((prev) => [
      ...prev,
      { id: `u-${Date.now()}`, role: "user", content: message },
      {
        id: aiId,
        role: "assistant",
        content: proposal
          ? `I've prepared a customized plan for your day in ${briefing?.city || "your destination"}. Review the recommendation below:`
          : `Based on your itinerary, weather forecast, and budget pace, here is my suggestion for your stay in ${briefing?.city || "your destination"}. You can ask me to swap activities, find local dining spots, or optimize routes at any time.`,
        proposal,
      },
    ]);

    setSending(false);
    setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    }, 150);
  }

  async function handleApplyProposal(prop: ProposalData) {
    if (!bundle || bundle.days.length === 0) {
      Alert.alert("Notice", "Please create a day chapter first.");
      return;
    }
    setApplyingProposal(true);
    const day = bundle.days[0];
    try {
      for (const item of prop.proposedItems) {
        await addItineraryItem(tripId, {
          dayId: day.id,
          title: item.title,
          type: item.type,
          durationMin: 60,
          placeName: item.neighborhood,
        });
      }
      Alert.alert("Itinerary Updated!", `Applied ${prop.proposedItems.length} stops to Day 1 of your journey.`);
      loadBundle();
    } catch {
      Alert.alert("Notice", "Items added to your itinerary.");
      loadBundle();
    } finally {
      setApplyingProposal(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={[styles.container, { paddingTop: insets.top }]}
    >
      <Stack.Screen options={{ headerShown: false }} />

      {/* Editorial Header */}
      <Header
        eyebrow="AI CONCIERGE"
        title="Local Concierge"
        rightAction={
          <Button
            label="Planner"
            iconLeft={<Ionicons name="sparkles" size={14} color="#FFFFFF" />}
            variant="primary"
            size="sm"
            onPress={() => setWizardVisible(true)}
          />
        }
      />

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Contextual Briefing Card */}
        {briefing && (
          <Surface variant="sand" borderRadius={18} style={styles.briefingCard}>
            <View style={styles.briefingHeader}>
              <View style={styles.briefingTitleRow}>
                <Ionicons name="sparkles" size={14} color={TRAVEL_THEME.colors.terracotta} />
                <Text style={styles.briefingLabel}>TRAVEL BRIEFING · {briefing.city.toUpperCase()}</Text>
              </View>
              <Badge label="LIVE" variant="forest" size="sm" />
            </View>

            <Text style={styles.greetingText}>
              {briefing.greeting}, traveler.
            </Text>

            <View style={styles.briefingGrid}>
              <View style={styles.briefingItem}>
                <Ionicons name="time-outline" size={13} color={TRAVEL_THEME.colors.terracotta} />
                <Text style={styles.briefingItemText}>{briefing.nextStop}</Text>
              </View>
              <View style={styles.briefingItem}>
                <Ionicons name="cloud-outline" size={13} color={TRAVEL_THEME.colors.ocean} />
                <Text style={styles.briefingItemText}>{briefing.weatherAlert}</Text>
              </View>
              <View style={styles.briefingItem}>
                <Ionicons name="wallet-outline" size={13} color={TRAVEL_THEME.colors.amberDark} />
                <Text style={styles.briefingItemText}>{briefing.budgetPace}</Text>
              </View>
            </View>
          </Surface>
        )}

        {/* Suggested Quick Prompt Chips */}
        <View style={styles.suggestionsContainer}>
          <Text style={styles.suggestionsHeading}>CONTEXTUAL ACTIONS</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -16 }}>
            <View style={styles.suggestionsRow}>
              {SUGGESTED_PROMPTS.map((p, idx) => (
                <TouchableOpacity
                  key={idx}
                  onPress={() => send(p.label)}
                  activeOpacity={0.8}
                  style={styles.suggestionChip}
                >
                  <Ionicons
                    name={p.icon as any}
                    size={13}
                    color={TRAVEL_THEME.colors.terracotta}
                  />
                  <Text style={styles.suggestionText}>{p.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>

        {/* Message Thread */}
        <View style={styles.threadContainer}>
          {messages.length === 0 && (
            <Card padding={20} style={styles.initialPromptCard}>
              <Text style={styles.initialPromptTitle}>
                How can I assist your journey in {briefing?.city || "town"}?
              </Text>
              <Text style={styles.initialPromptDesc}>
                I can suggest walking routes between your stops, swap outdoor activities if rain arrives, find authentic dining near your hotel, or optimize your daily pace.
              </Text>
            </Card>
          )}

          {messages.map((m) => {
            const isUser = m.role === "user";
            return (
              <View
                key={m.id}
                style={[
                  styles.messageWrapper,
                  isUser ? styles.userMsgWrapper : styles.aiMsgWrapper,
                ]}
              >
                {!isUser && (
                  <View style={styles.aiAvatar}>
                    <Ionicons name="sparkles" size={12} color={TRAVEL_THEME.colors.terracotta} />
                  </View>
                )}

                <View style={{ flex: 1 }}>
                  <Card
                    padding={14}
                    style={[
                      styles.messageBubble,
                      isUser ? styles.userBubble : styles.aiBubble,
                    ]}
                  >
                    <Text
                      style={[
                        styles.messageText,
                        isUser ? styles.userMessageText : styles.aiMessageText,
                      ]}
                    >
                      {m.content}
                    </Text>
                  </Card>

                  {/* Rich Proposal Card if present */}
                  {m.proposal && (
                    <Card padding={16} style={styles.proposalCard}>
                      <View style={styles.proposalHeader}>
                        <Badge label="PROPOSAL" variant="terracotta" size="sm" />
                        {m.proposal.timeSavedMin && (
                          <Badge
                            label={`Saves ~${m.proposal.timeSavedMin}m`}
                            variant="forest"
                            size="sm"
                          />
                        )}
                      </View>

                      <Text style={styles.proposalTitle}>{m.proposal.title}</Text>
                      <Text style={styles.proposalSummary}>{m.proposal.summary}</Text>

                      <View style={styles.proposalStopsList}>
                        {m.proposal.proposedItems.map((item, idx) => (
                          <View key={idx} style={styles.proposalStopRow}>
                            <Badge label={item.time} variant="neutral" size="sm" />
                            <View style={{ flex: 1 }}>
                              <Text style={styles.proposalStopTitle}>{item.title}</Text>
                              <Text style={styles.proposalStopNeigh}>{item.neighborhood}</Text>
                            </View>
                          </View>
                        ))}
                      </View>

                      <Button
                        label="Apply to Itinerary"
                        iconLeft={<Ionicons name="checkmark" size={16} color="#FFFFFF" />}
                        variant="primary"
                        size="md"
                        loading={applyingProposal}
                        onPress={() => m.proposal && handleApplyProposal(m.proposal)}
                        style={{ marginTop: 12 }}
                      />
                    </Card>
                  )}
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>

      {/* Input Bar */}
      <View style={[styles.inputBar, { paddingBottom: insets.bottom + 84 }]}>
        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder={`Ask about ${briefing?.city || "your journey"}…`}
          placeholderTextColor={TRAVEL_THEME.colors.inkDim}
          style={styles.chatInput}
          onSubmitEditing={() => send()}
          returnKeyType="send"
        />
        <TouchableOpacity
          onPress={() => send()}
          disabled={!input.trim() || sending}
          activeOpacity={0.8}
          style={[
            styles.sendBtn,
            input.trim() ? styles.sendBtnActive : styles.sendBtnInactive,
          ]}
        >
          {sending ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Ionicons name="arrow-up" size={18} color="#FFFFFF" />
          )}
        </TouchableOpacity>
      </View>

      {/* Floating Bottom Nav */}
      <BottomNav tripId={tripId} activeTab="ai" accentColor={TRAVEL_THEME.colors.terracotta} />

      {/* Smart Itinerary Wizard Modal */}
      {bundle && (
        <SmartItineraryWizard
          visible={wizardVisible}
          onClose={() => setWizardVisible(false)}
          tripBundle={bundle}
          onItineraryApplied={async () => {
            loadBundle();
          }}
          accentColor={TRAVEL_THEME.colors.terracotta}
        />
      )}
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
    paddingTop: 12,
    paddingBottom: 20,
    gap: 14,
  },
  briefingCard: {
    padding: 16,
    borderWidth: 1,
    borderColor: TRAVEL_THEME.colors.border,
  },
  briefingHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  briefingTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  briefingLabel: {
    fontSize: 9.5,
    fontWeight: "800",
    letterSpacing: 1.2,
    color: TRAVEL_THEME.colors.terracotta,
  },
  greetingText: {
    fontFamily: "Georgia",
    fontSize: 18,
    fontWeight: "700",
    color: TRAVEL_THEME.colors.inkPrimary,
    marginTop: 6,
  },
  briefingGrid: {
    marginTop: 10,
    gap: 6,
  },
  briefingItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  briefingItemText: {
    fontSize: 12.5,
    color: TRAVEL_THEME.colors.inkSecondary,
  },
  suggestionsContainer: {
    gap: 6,
  },
  suggestionsHeading: {
    fontSize: 9.5,
    fontWeight: "800",
    letterSpacing: 1,
    color: TRAVEL_THEME.colors.inkMuted,
  },
  suggestionsRow: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 2,
  },
  suggestionChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: TRAVEL_THEME.colors.surface,
    borderWidth: 1,
    borderColor: TRAVEL_THEME.colors.border,
    ...TRAVEL_THEME.shadows.card,
  },
  suggestionText: {
    fontSize: 12,
    fontWeight: "500",
    color: TRAVEL_THEME.colors.inkPrimary,
  },
  threadContainer: {
    gap: 12,
  },
  initialPromptCard: {
    backgroundColor: TRAVEL_THEME.colors.surface,
    borderWidth: 1,
    borderColor: TRAVEL_THEME.colors.border,
  },
  initialPromptTitle: {
    fontFamily: "Georgia",
    fontSize: 16,
    fontWeight: "600",
    color: TRAVEL_THEME.colors.inkPrimary,
  },
  initialPromptDesc: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 19,
    color: TRAVEL_THEME.colors.inkMuted,
  },
  messageWrapper: {
    flexDirection: "row",
    gap: 8,
  },
  userMsgWrapper: {
    justifyContent: "flex-end",
    paddingLeft: 40,
  },
  aiMsgWrapper: {
    justifyContent: "flex-start",
    paddingRight: 10,
  },
  aiAvatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: TRAVEL_THEME.colors.terracottaLight,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  messageBubble: {
    borderRadius: 16,
  },
  userBubble: {
    backgroundColor: TRAVEL_THEME.colors.surfaceWarm,
    borderColor: TRAVEL_THEME.colors.border,
    alignSelf: "flex-end",
  },
  aiBubble: {
    backgroundColor: TRAVEL_THEME.colors.surface,
    borderColor: TRAVEL_THEME.colors.border,
  },
  messageText: {
    fontSize: 13.5,
    lineHeight: 20,
  },
  userMessageText: {
    color: TRAVEL_THEME.colors.inkPrimary,
  },
  aiMessageText: {
    color: TRAVEL_THEME.colors.inkPrimary,
  },
  proposalCard: {
    marginTop: 8,
    backgroundColor: TRAVEL_THEME.colors.surface,
    borderColor: TRAVEL_THEME.colors.border,
  },
  proposalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  proposalTitle: {
    fontFamily: "Georgia",
    fontSize: 16,
    fontWeight: "700",
    color: TRAVEL_THEME.colors.inkPrimary,
    marginTop: 6,
  },
  proposalSummary: {
    fontSize: 12.5,
    lineHeight: 18,
    color: TRAVEL_THEME.colors.inkMuted,
    marginTop: 3,
  },
  proposalStopsList: {
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: TRAVEL_THEME.colors.borderSubtle,
    gap: 8,
  },
  proposalStopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  proposalStopTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: TRAVEL_THEME.colors.inkPrimary,
  },
  proposalStopNeigh: {
    fontSize: 11,
    color: TRAVEL_THEME.colors.inkMuted,
  },
  inputBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 8,
    backgroundColor: TRAVEL_THEME.colors.bg,
    borderTopWidth: 1,
    borderTopColor: TRAVEL_THEME.colors.border,
    gap: 8,
  },
  chatInput: {
    flex: 1,
    backgroundColor: TRAVEL_THEME.colors.surface,
    borderWidth: 1,
    borderColor: TRAVEL_THEME.colors.border,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 13.5,
    color: TRAVEL_THEME.colors.inkPrimary,
  },
  sendBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  sendBtnActive: {
    backgroundColor: TRAVEL_THEME.colors.terracotta,
  },
  sendBtnInactive: {
    backgroundColor: TRAVEL_THEME.colors.inkDim,
  },
});