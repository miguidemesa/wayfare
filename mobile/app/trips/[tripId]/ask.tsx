import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, TextInput, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { useReducedMotion } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { enterUp, fadeIn } from "@/lib/motion";
import { Press } from "@/components/ui/Press";
import { ApiError, askConcierge, fetchConversation } from "@/shared/api";
import { fmtClock, fmtDay, fmtMoney, fonts, GUTTER, radii, space, useTheme } from "@/shared/theme";
import { dailyAllowance, dayKey, localKey, nextStop, totalSpent } from "@/shared/trip";
import { useTrip } from "@/lib/trip";
import { SheetBar } from "@/components/ui/Bars";
import { Rule } from "@/components/ui/Primitives";
import { T } from "@/components/ui/T";

export { ErrorFallback as ErrorBoundary } from "@/components/ErrorFallback";

// Tools that change the trip — when any ran, the plan on screen is stale.
const CHANGES_PLAN = new Set([
  "create_itinerary_item",
  "update_itinerary_item",
  "delete_itinerary_item",
  "move_itinerary_item",
  "apply_optimization",
  "save_place",
]);

type Turn = { id: string; role: "user" | "assistant"; content: string; changed?: boolean; failed?: boolean };

// The day being viewed is passed along as a bracketed prefix so requests like
// "make it more relaxed" land on the right day; it's hidden when shown back.
const CONTEXT_PREFIX = /^\[Viewing [^\]]+\]\s*/;

// The concierge's quick prompts, kept from the previous version.
const EXAMPLES = ["Relax the schedule, we need rest", "Rainy afternoon alternatives", "Dinner near our hotel", "A scenic morning walking route", "Move the museum to tomorrow"];

export default function Ask() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  // prompt: a suggested question (from an alert), put in the box unsent.
  const { date, prompt } = useLocalSearchParams<{ date?: string; prompt?: string }>();
  const { tripId, bundle, reload } = useTrip();
  const [turns, setTurns] = useState<Turn[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [input, setInput] = useState(prompt ?? "");
  const [sending, setSending] = useState(false);
  const scroller = useRef<ScrollView>(null);
  const inputRef = useRef<TextInput>(null);

  // Examples go into the box, not straight to Wayfare: some of them change
  // the plan, so the traveller gets to read and edit first.
  function fillExample(text: string) {
    setInput(text);
    inputRef.current?.focus();
  }

  const viewedIdx = date && bundle ? bundle.days.findIndex((d) => dayKey(d.date) === date) : -1;

  useEffect(() => {
    let live = true;
    fetchConversation(tripId)
      .then((res) => {
        if (!live) return;
        setConversationId(res.activeConversationId);
        setTurns(
          res.messages.slice(-12).map((m) => ({ id: m.id, role: m.role, content: m.role === "user" ? m.content.replace(CONTEXT_PREFIX, "") : m.content }))
        );
      })
      .catch(() => {})
      .finally(() => live && setLoadingHistory(false));
    return () => {
      live = false;
    };
  }, [tripId]);

  async function send(text?: string) {
    const message = (text ?? input).trim();
    if (!message || sending) return;
    setInput("");
    setSending(true);
    const userTurn: Turn = { id: `u${Date.now()}`, role: "user", content: message };
    setTurns((t) => [...t, userTurn]);
    const context = date ? `[Viewing ${viewedIdx >= 0 ? `Day ${viewedIdx + 1}, ` : ""}${date}] ` : "";
    try {
      const res = await askConcierge(tripId, context + message, conversationId);
      setConversationId(res.conversationId);
      const changed = res.toolsUsed.some((t) => CHANGES_PLAN.has(t));
      setTurns((t) => [...t, { id: `a${Date.now()}`, role: "assistant", content: res.content, changed }]);
      if (changed) void reload();
    } catch (e) {
      setTurns((t) => [
        ...t,
        { id: `e${Date.now()}`, role: "assistant", failed: true, content: e instanceof ApiError ? e.message : "That didn't go through. Check your connection and try again." },
      ]);
    } finally {
      setSending(false);
      setTimeout(() => scroller.current?.scrollToEnd({ animated: true }), 60);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.paper }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <SheetBar title={viewedIdx >= 0 && bundle ? `Day ${viewedIdx + 1} · ${fmtDay(bundle.days[viewedIdx].date, { weekday: "short" })}` : "Ask Wayfare"} cancelLabel="Close" />

      <ScrollView
        ref={scroller}
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: GUTTER, paddingVertical: space.xl, gap: space.lg }}
        onContentSizeChange={() => scroller.current?.scrollToEnd({ animated: false })}
        keyboardShouldPersistTaps="handled"
      >
        <Briefing />
        {loadingHistory ? (
          <ActivityIndicator color={colors.ink3} />
        ) : turns.length === 0 ? (
          <View style={{ gap: space.md }}>
            <T v="title" style={{ marginTop: space.sm }}>What should change?</T>
            <T v="body" c="ink2">
              Ask in your own words. Wayfare can move, add or remove stops, tidy a day’s route, and find places to eat or see nearby.
            </T>
            <View style={{ marginTop: space.sm }}>
              {EXAMPLES.map((ex) => (
                <View key={ex}>
                  <Pressable
                    onPress={() => fillExample(ex)}
                    accessibilityRole="button"
                    accessibilityHint="Puts this request in the message box"
                    style={({ pressed }) => ({ paddingVertical: 12, opacity: pressed ? 0.5 : 1 })}
                  >
                    <T v="aside" c="ink">
                      “{ex}”
                    </T>
                  </Pressable>
                  <Rule />
                </View>
              ))}
            </View>
          </View>
        ) : (
          turns.map((t) =>
            t.role === "user" ? (
              <Animated.View key={t.id} entering={enterUp(0)}>
                <T v="aside" c="ink2" style={{ fontSize: 17, lineHeight: 23, marginTop: space.sm }}>
                  “{t.content}”
                </T>
              </Animated.View>
            ) : (
              <Animated.View key={t.id} entering={enterUp(0)} style={{ gap: space.sm }}>
                <T v="body" c={t.failed ? "danger" : "ink"}>
                  {t.content}
                </T>
                {t.changed ? (
                  <Pressable
                    onPress={() => router.back()}
                    accessibilityRole="button"
                    hitSlop={13}
                    style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 6, opacity: pressed ? 0.5 : 1 })}
                  >
                    <Ionicons name="checkmark" size={16} color={colors.positive} />
                    <T v="meta" c="positive">
                      Your plan was updated. See it
                    </T>
                  </Pressable>
                ) : null}
              </Animated.View>
            )
          )
        )}
        {sending ? (
          <Animated.View entering={fadeIn} style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
            <TypingDots />
            <T v="meta" c="ink3">
              Working on it…
            </T>
          </Animated.View>
        ) : null}
      </ScrollView>

      {turns.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" style={{ flexGrow: 0 }} contentContainerStyle={{ paddingHorizontal: GUTTER, paddingVertical: 8, gap: 6 }}>
          {EXAMPLES.map((ex) => (
            <Pressable
              key={ex}
              onPress={() => fillExample(ex)}
              disabled={sending}
              accessibilityRole="button"
              accessibilityHint="Puts this request in the message box"
              style={({ pressed }) => ({ paddingHorizontal: 12, height: 34, justifyContent: "center", borderRadius: radii.sm, borderWidth: 1, borderColor: colors.rule, backgroundColor: pressed ? colors.sunk : colors.raised, opacity: sending ? 0.5 : 1 })}
            >
              <T v="small" c="ink2">
                {ex}
              </T>
            </Pressable>
          ))}
        </ScrollView>
      ) : null}
      <View style={{ borderTopWidth: 1, borderTopColor: colors.rule, paddingHorizontal: GUTTER, paddingTop: 10, paddingBottom: Math.max(insets.bottom, 10), flexDirection: "row", alignItems: "flex-end", gap: 10 }}>
        <TextInput
          ref={inputRef}
          value={input}
          onChangeText={setInput}
          placeholder="Ask to change the plan…"
          placeholderTextColor={colors.ink3}
          selectionColor={colors.accent}
          multiline
          maxLength={2000}
          onSubmitEditing={() => void send()}
          blurOnSubmit={false}
          accessibilityLabel="Your request"
          style={{
            flex: 1,
            fontFamily: fonts.sans,
            fontSize: 16,
            color: colors.ink,
            backgroundColor: colors.raised,
            borderWidth: 1,
            borderColor: colors.rule,
            borderRadius: radii.md,
            paddingHorizontal: 12,
            paddingTop: 10,
            paddingBottom: 10,
            maxHeight: 120,
          }}
        />
        <Press
          onPress={() => void send()}
          disabled={!input.trim() || sending}
          accessibilityRole="button"
          accessibilityLabel="Send"
          scaleTo={0.92}
          style={{
            width: 44,
            height: 44,
            borderRadius: radii.md,
            borderCurve: "continuous",
            backgroundColor: colors.ink,
            alignItems: "center",
            justifyContent: "center",
            opacity: !input.trim() || sending ? 0.35 : 1,
          }}
        >
          <Ionicons name="arrow-up" size={20} color={colors.onInk} />
        </Press>
      </View>
    </KeyboardAvoidingView>
  );
}


const BREATH = { "0%": { opacity: 0.3 }, "40%": { opacity: 1 }, "80%": { opacity: 0.3 }, "100%": { opacity: 0.3 } };

/** Wayfare is thinking: three dots breathing in turn (still under Reduce Motion). */
function TypingDots() {
  const { colors } = useTheme();
  const reduce = useReducedMotion();
  return (
    <View style={{ flexDirection: "row", gap: 5 }} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
      {[0, 160, 320].map((delay) => (
        <Animated.View
          key={delay}
          style={[
            { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.ink3, opacity: reduce ? 0.6 : 1 },
            !reduce && {
              animationName: BREATH,
              animationDuration: 1200,
              animationDelay: delay,
              animationIterationCount: "infinite",
              animationTimingFunction: "ease-in-out",
            },
          ]}
        />
      ))}
    </View>
  );
}

/** Travel briefing from real trip state: what's next, weather, budget pace. */
function Briefing() {
  const { colors } = useTheme();
  const { bundle } = useTrip();
  if (!bundle) return null;
  const { days, weather, expenses, trip } = bundle;
  const next = nextStop(days);
  const rainy = weather.find((w) => dayKey(w.date) >= localKey(new Date()) && w.rainProb >= 50);
  const spent = totalSpent(expenses);
  const allowance = dailyAllowance({ budget: trip.budgetAmount, spent, startIso: trip.startDate, endIso: trip.endDate });
  const rows: [string, string][] = [
    ["Next", next ? `${next.item.title} · ${fmtDay(next.day.date, { weekday: "short" })} ${next.item.startTime != null ? fmtClock(next.item.startTime) : ""}`.trim() : "Nothing scheduled yet"],
    ["Weather", rainy ? `Rain likely ${fmtDay(rainy.date, { weekday: "long" })} in ${rainy.city} (${Math.round(rainy.rainProb)}%)` : weather.length ? "No rain in the forecast" : "Forecast not available yet"],
    [
      "Budget",
      trip.budgetAmount > 0
        ? spent > trip.budgetAmount
          ? `${fmtMoney(Math.round(spent - trip.budgetAmount), trip.homeCurrency)} over budget`
          : allowance != null
            ? `About ${fmtMoney(Math.round(allowance), trip.homeCurrency)} a day left to spend`
            : `${fmtMoney(Math.round(trip.budgetAmount - spent), trip.homeCurrency)} left`
        : "No budget set",
    ],
  ];
  return (
    <View style={{ borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.rule, paddingVertical: space.sm }}>
      <T v="label" c="ink3" style={{ marginBottom: 4 }}>
        Briefing · {bundle.destinations.map((d) => d.name).join(" · ")}
      </T>
      {rows.map(([k, v]) => (
        <View key={k} style={{ flexDirection: "row", paddingVertical: 5, gap: 12 }}>
          <T v="meta" c="ink3" style={{ width: 64 }}>
            {k}
          </T>
          <T v="meta" style={{ flex: 1 }}>
            {v}
          </T>
        </View>
      ))}
    </View>
  );
}

