import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated from "react-native-reanimated";
import { enterFrom } from "@/lib/motion";
import { addHotel, ApiError, createTrip, fetchPreferences, layOutDays, saveTripBrief, type Place } from "@/shared/api";
import { AVOIDS, briefFromPreferences, describeParty, DIETS, emptyBrief, INTERESTS, type TripBrief } from "@/shared/brief";
import { fmtClock, fmtDay, fmtMoney, GUTTER, space, useTheme } from "@/shared/theme";
import { SheetBar } from "@/components/ui/Bars";
import { Button } from "@/components/ui/Button";
import { Choices, Field, Meter, Rule } from "@/components/ui/Primitives";
import { T } from "@/components/ui/T";
import {
  ArrivalStep,
  FoodStep,
  GettingAroundStep,
  InterestsStep,
  MustDoStep,
  PaceStep,
  POPULAR,
  StayStep,
  WhenStep,
  WhereStep,
  WhoStep,
} from "@/components/interview/steps";

export { ErrorFallback as ErrorBoundary } from "@/components/ErrorFallback";

// The questions preferences answer; the rest are about this trip.
const PREFILLED_STEPS = new Set(["who", "interests", "pace", "food", "around"]);

const HOME_CURRENCIES = ["USD", "EUR", "GBP", "PHP", "JPY", "AUD", "CAD", "SGD", "KRW"].map((c) => ({ key: c, label: c }));

type Draft = {
  places: Place[];
  start: string | null;
  end: string | null;
  title: string;
  budget: string;
  home: string;
};

type Step = {
  key: string;
  /** The question, in Wayfare's voice. */
  ask: string;
  why?: string;
  /** Can't continue until this holds. Steps without it can be skipped. */
  ready?: boolean;
  /** Whether the traveller has answered, so Next reads "Next" rather than "Skip". */
  answered: boolean;
  body: ReactNode;
};

// The planning interview: one question per screen, anything but where and
// when can be skipped, and every answer lands in the trip brief the planner
// and the concierge work from. Ends by creating the trip and going straight
// into a drafted plan to preview.
export default function NewTrip() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const scroller = useRef<ScrollView>(null);
  const [draft, setDraft] = useState<Draft>({ places: [], start: null, end: null, title: "", budget: "", home: "USD" });
  const [brief, setBriefState] = useState<TripBrief>(emptyBrief);
  const [prefilled, setPrefilled] = useState(false);
  const [index, setIndex] = useState(0);
  // Which way the last move went, so the next question comes from that side.
  // Null until the first move: the opening question arrives with the sheet.
  const [dir, setDir] = useState<1 | -1 | null>(null);
  const [status, setStatus] = useState<"idle" | "creating" | "laying">("idle");
  const [error, setError] = useState<string | null>(null);

  const setBrief = useCallback((fn: (b: TripBrief) => TripBrief) => setBriefState(fn), []);
  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));
  const cities = useMemo(() => draft.places.map((p) => p.name), [draft.places]);
  // Stable between renders: place search re-runs whenever this changes.
  const near = useMemo(() => Object.fromEntries(draft.places.map((p) => [p.name, { lat: p.lat, lng: p.lng }])), [draft.places]);

  // Start from what this traveller told us last time.
  useEffect(() => {
    let live = true;
    fetchPreferences()
      .then((prefs) => {
        if (live && prefs) {
          setBriefState(briefFromPreferences(prefs));
          setPrefilled(true);
        }
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);

  const suggestedTitle = draft.places.length
    ? `${cities.join(" & ")}${draft.start ? ` in ${new Date(draft.start + "T12:00:00").toLocaleDateString("en-US", { month: "long" })}` : ""}`
    : "";
  const stays = brief.stays.filter((s) => cities.includes(s.city));
  const stayAnswered = stays.some((s) => s.booked || s.area || s.hotelName);

  const steps: Step[] = [
    {
      key: "where",
      ask: "Where are you going?",
      why: "Up to four cities, in the order you'll visit.",
      ready: draft.places.length > 0,
      answered: draft.places.length > 0,
      body: <WhereStep places={draft.places} onChange={(places) => set({ places })} />,
    },
    {
      key: "when",
      ask: "When?",
      ready: !!(draft.start && draft.end),
      answered: !!(draft.start && draft.end),
      body: <WhenStep start={draft.start} end={draft.end} onChange={(start, end) => set({ start, end })} />,
    },
    {
      key: "stay",
      ask: cities.length === 1 ? `Where are you staying in ${cities[0]}?` : "Where are you staying?",
      why: "Each day starts and ends near your hotel, so this matters most.",
      answered: stayAnswered,
      body: <StayStep cities={cities} stays={stays} setBrief={setBrief} near={near} />,
    },
    {
      key: "who",
      ask: "Who's coming?",
      answered: brief.party.adults !== 1 || brief.party.childrenAges.length > 0 || brief.party.seniors > 0,
      body: <WhoStep party={brief.party} setBrief={setBrief} />,
    },
    {
      key: "interests",
      ask: "What are you into?",
      why: "Pick as many as you like. Wayfare favours places that match.",
      answered: brief.interests.length > 0,
      body: <InterestsStep interests={brief.interests} setBrief={setBrief} />,
    },
    {
      key: "must",
      ask: "Anything you can't miss?",
      why: "Wayfare builds the days around these first.",
      answered: brief.mustDos.length > 0,
      body: <MustDoStep cities={cities} mustDos={brief.mustDos} setBrief={setBrief} />,
    },
    {
      key: "pace",
      ask: "How do you like your days?",
      answered: true,
      body: <PaceStep pace={brief.pace} rhythm={brief.rhythm} setBrief={setBrief} />,
    },
    {
      key: "food",
      ask: "And food?",
      answered: brief.food.diet.length > 0 || brief.food.priceLevel != null || brief.food.mustTry.length > 0,
      body: <FoodStep food={brief.food} setBrief={setBrief} />,
    },
    {
      key: "around",
      ask: "Getting around",
      answered: brief.mobility.maxWalkMin != null || brief.avoid.length > 0,
      body: <GettingAroundStep mobility={brief.mobility} avoid={brief.avoid} setBrief={setBrief} />,
    },
    {
      key: "arrive",
      ask: "When do you arrive and leave?",
      why: "Roughly is fine.",
      answered: brief.arrival?.time != null || brief.departure?.time != null,
      body:
        draft.start && draft.end ? (
          <ArrivalStep start={draft.start} end={draft.end} arrival={brief.arrival} departure={brief.departure} setBrief={setBrief} />
        ) : null,
    },
    {
      key: "budget",
      ask: "Is there a budget?",
      why: "Everything you spend is totalled in your home currency.",
      answered: !!draft.budget.trim(),
      body: (
        <View style={{ gap: space.md }}>
          <Field label="Budget for the trip" value={draft.budget} onChangeText={(budget) => set({ budget })} placeholder="Optional" keyboardType="decimal-pad" numeric />
          <T v="label" c="ink3">
            Home currency
          </T>
          <Choices options={HOME_CURRENCIES} value={draft.home} onChange={(home) => set({ home })} />
        </View>
      ),
    },
    {
      key: "review",
      ask: "Here's your trip",
      why: "Next, Wayfare drafts your days from this. You'll see the plan before any of it is added.",
      answered: true,
      body: <Review draft={draft} brief={{ ...brief, stays }} suggestedTitle={suggestedTitle} onTitle={(title) => set({ title })} onEdit={(key) => goTo(key)} />,
    },
  ];

  const step = steps[index];
  const last = index === steps.length - 1;

  function goTo(key: string) {
    const i = steps.findIndex((s) => s.key === key);
    if (i >= 0) move(i);
  }

  function move(i: number) {
    setDir(i < index ? -1 : 1);
    setIndex(i);
    setError(null);
    scroller.current?.scrollTo({ y: 0, animated: false });
  }

  async function create() {
    const { places, start, end } = draft;
    if (!places.length || !start || !end) return;
    const budgetNum = draft.budget.trim() ? Number(draft.budget.replace(/,/g, "")) : 0;
    if (!Number.isFinite(budgetNum) || budgetNum < 0) {
      setError("The budget should be a number, or leave it empty.");
      goTo("budget");
      return;
    }
    setError(null);
    setStatus("creating");
    const finalBrief: TripBrief = { ...brief, stays };
    try {
      const res = await createTrip({
        title: draft.title.trim() || suggestedTitle,
        destinations: places.map((p) => ({ name: p.name, country: p.country, lat: p.lat, lng: p.lng })),
        startDate: start,
        endDate: end,
        budgetAmount: budgetNum,
        homeCurrency: draft.home,
        brief: finalBrief,
        ...coverFor(places[0]),
      });
      const tripId = res.trip.id;
      setStatus("laying");
      // A single-city stay that's booked becomes a real booking, dated for
      // the whole trip, so it shows up in Bookings and on the map.
      const booked = stays.length === 1 && places.length === 1 ? stays.find((s) => s.booked && s.hotelName) : undefined;
      if (booked) {
        try {
          const { hotel } = await addHotel(tripId, {
            name: booked.hotelName!,
            destinationName: booked.city,
            checkIn: start,
            checkOut: end,
            ...(booked.lat != null && booked.lng != null ? { lat: booked.lat, lng: booked.lng } : {}),
          });
          await saveTripBrief(tripId, { ...finalBrief, stays: finalBrief.stays.map((s) => (s === booked ? { ...s, hotelId: hotel.id } : s)) });
        } catch {
          // The brief still has the hotel; it can be added in Bookings.
        }
      }
      try {
        await layOutDays(tripId, start, end, [], cities);
      } catch {
        // The Plan tab offers to finish setting up days.
      }
      // Straight into a drafted plan, with the trip's tabs underneath.
      router.replace({ pathname: "/trips/[tripId]/suggest", params: { tripId, auto: "1" } });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't create the trip. Try again.");
      setStatus("idle");
    }
  }

  // Required questions never offer to skip; the button waits, disabled, as "Next".
  const nextLabel = last ? (status === "laying" ? "Setting up your days…" : "Create trip and draft my days") : step.answered || step.ready !== undefined ? "Next" : "Skip";

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.paper }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <SheetBar title="New trip" />
      <Meter
        value={(index + 1) / steps.length}
        color={colors.accent}
        track={colors.rule}
        style={{ borderRadius: 0 }}
        accessibilityRole="progressbar"
        accessibilityValue={{ min: 1, max: steps.length, now: index + 1, text: `Question ${index + 1} of ${steps.length}` }}
      />
      <ScrollView ref={scroller} contentContainerStyle={{ paddingHorizontal: GUTTER, paddingTop: space.xl, paddingBottom: space.xxxl }} keyboardShouldPersistTaps="handled">
        <Animated.View key={step.key} entering={dir ? enterFrom(dir, 28, 260) : undefined}>
          <T v="label" c="ink3" num>
            {index + 1} of {steps.length}
            {prefilled && PREFILLED_STEPS.has(step.key) ? " · Filled in from your last trip" : ""}
          </T>
          <T v="title" accessibilityRole="header" style={{ marginTop: 6 }}>
            {step.ask}
          </T>
          {step.why ? (
            <T v="body" c="ink2" style={{ marginTop: 6 }}>
              {step.why}
            </T>
          ) : null}
          <View style={{ marginTop: space.xl }}>{step.body}</View>
        </Animated.View>
        {error ? (
          <T v="meta" c="danger" style={{ marginTop: space.lg }} accessibilityLiveRegion="polite">
            {error}
          </T>
        ) : null}
      </ScrollView>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: space.md,
          paddingHorizontal: GUTTER,
          paddingTop: space.md,
          paddingBottom: Math.max(insets.bottom, space.md),
          borderTopWidth: 1,
          borderTopColor: colors.rule,
          backgroundColor: colors.paper,
        }}
      >
        {index > 0 ? <Button variant="quiet" label="Back" onPress={() => move(index - 1)} disabled={status !== "idle"} /> : null}
        <View style={{ flex: 1 }} />
        <Button
          variant={last ? "accent" : step.answered ? "primary" : "secondary"}
          label={nextLabel}
          loading={status === "creating"}
          busy={status === "laying"}
          disabled={step.ready === false}
          onPress={last ? create : () => move(index + 1)}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

/** Everything the traveller said, each line one tap from changing it. */
function Review({ draft, brief, suggestedTitle, onTitle, onEdit }: { draft: Draft; brief: TripBrief; suggestedTitle: string; onTitle: (t: string) => void; onEdit: (key: string) => void }) {
  const label = <K extends string>(list: readonly { key: K; label: string }[], keys: readonly K[]) => keys.map((k) => list.find((x) => x.key === k)?.label ?? k).join(", ");
  const moment = (m: TripBrief["arrival"]) => (m?.time != null ? `${fmtClock(m.time)}${m.where ? ` at ${m.where}` : ""}` : null);
  const stayLine = brief.stays
    .map((s) => [brief.stays.length > 1 ? `${s.city}:` : null, s.hotelName, s.area ? (s.hotelName ? `(${s.area})` : `around ${s.area}`) : null].filter(Boolean).join(" "))
    .filter((l) => l.trim() && !l.endsWith(":"))
    .join(" · ");

  const rows: [string, string, string | null][] = [
    ["where", "Where", draft.places.map((p) => p.name).join(" → ")],
    ["when", "When", draft.start && draft.end ? `${fmtDay(draft.start, { month: "short", day: "numeric" })} – ${fmtDay(draft.end, { month: "short", day: "numeric", year: "numeric" })}` : null],
    ["stay", "Staying", stayLine || null],
    ["who", "Who", describeParty(brief.party)],
    ["interests", "Into", brief.interests.length ? label(INTERESTS, brief.interests) : null],
    ["must", "Must-dos", brief.mustDos.map((m) => m.name).join(", ") || null],
    ["pace", "Pace", `${brief.pace[0].toUpperCase()}${brief.pace.slice(1)}, ${fmtClock(brief.rhythm.dayStart)}–${fmtClock(brief.rhythm.dayEnd)}`],
    [
      "food",
      "Food",
      [brief.food.diet.length ? label(DIETS, brief.food.diet) : null, brief.food.priceLevel ? ["Cheap eats", "Mid-range", "Nice", "Splurge"][brief.food.priceLevel - 1] : null, brief.food.mustTry.length ? `try ${brief.food.mustTry.join(", ")}` : null]
        .filter(Boolean)
        .join(" · ") || null,
    ],
    ["around", "Getting around", [brief.mobility.maxWalkMin ? `walks up to ${brief.mobility.maxWalkMin} min` : null, brief.avoid.length ? `avoid ${label(AVOIDS, brief.avoid).toLowerCase()}` : null].filter(Boolean).join(" · ") || null],
    ["arrive", "Arrive / leave", [moment(brief.arrival) && `arrive ${moment(brief.arrival)}`, moment(brief.departure) && `leave ${moment(brief.departure)}`].filter(Boolean).join(" · ") || null],
    ["budget", "Budget", draft.budget.trim() && Number(draft.budget.replace(/,/g, "")) > 0 ? fmtMoney(Number(draft.budget.replace(/,/g, "")), draft.home) : null],
  ];

  return (
    <View>
      <Field label="Name the trip" value={draft.title} onChangeText={onTitle} placeholder={suggestedTitle || "Name the trip"} />
      <View style={{ marginTop: space.xl }}>
        <Rule />
        {rows.map(([key, name, value]) => (
          <Pressable
            key={key}
            onPress={() => onEdit(key)}
            accessibilityRole="button"
            accessibilityLabel={`${name}: ${value ?? "not set"}. Change`}
            style={({ pressed }) => ({ flexDirection: "row", alignItems: "flex-start", gap: 12, paddingVertical: 12, opacity: pressed ? 0.6 : 1 })}
          >
            <T v="meta" c="ink3" style={{ width: 104 }}>
              {name}
            </T>
            <T v="meta" c={value ? "ink" : "ink3"} style={{ flex: 1 }}>
              {value ?? "Not set"}
            </T>
            <T v="meta" c="accent">
              Change
            </T>
          </Pressable>
        ))}
        <Rule />
      </View>
    </View>
  );
}

function coverFor(p: Place): { coverEmoji?: string; coverTheme?: string } {
  const hit = POPULAR.find((x) => x.country === p.country) ?? null;
  return hit ? { coverEmoji: hit.emoji, coverTheme: hit.theme } : {};
}
