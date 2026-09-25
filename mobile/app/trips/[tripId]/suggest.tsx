import { useMemo, useState } from "react";
import { ActivityIndicator, ScrollView, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { ApiError, generateItineraryPlan } from "@/shared/api";
import { fmtClock, fmtDay, fmtDuration, fmtMoney, GUTTER, space, useTheme } from "@/shared/theme";
import { dayKey, transportLabel } from "@/shared/trip";
import { useLoadedTrip, useTrip } from "@/lib/trip";
import { SheetBar } from "@/components/ui/Bars";
import { Button } from "@/components/ui/Button";
import { Choices, Empty, Loading, Rule } from "@/components/ui/Primitives";
import { T } from "@/components/ui/T";
import { useToast } from "@/components/ui/Toast";

export { ErrorFallback as ErrorBoundary } from "@/components/ErrorFallback";

type Pace = "relaxed" | "balanced" | "packed";

// Shape of a drafted day from /generate (server-side PlannedDay, serialized).
type DraftItem = {
  title: string;
  type: string;
  startTime: number;
  endTime: number;
  durationMin: number;
  neighborhood: string;
  cost: number;
  currency: string;
  transportMode: string | null;
  transportMin: number | null;
};
type DraftDay = { date: string; city: string; title: string; items: DraftItem[]; estTravelMin: number };

const PACES: { key: Pace; label: string; hint: string }[] = [
  { key: "relaxed", label: "Relaxed", hint: "A few things a day, long lunches, early evenings." },
  { key: "balanced", label: "Balanced", hint: "A full day with room to wander." },
  { key: "packed", label: "Packed", hint: "See as much as possible. Comfortable shoes." },
];

export default function Suggest() {
  const { bundle } = useTrip();
  if (!bundle) return <Loading />;
  return <SuggestFlow />;
}

function SuggestFlow() {
  const { colors } = useTheme();
  const toast = useToast();
  const { date } = useLocalSearchParams<{ date?: string }>();
  const { tripId, bundle, reload, setDayIndex } = useLoadedTrip();
  const { trip, destinations, days } = bundle;

  const [pace, setPace] = useState<Pace>(((trip.pace as Pace) || "balanced") as Pace);
  const [draft, setDraft] = useState<DraftDay[] | null>(null);
  const [totals, setTotals] = useState<{ travel: number; cost: number }>({ travel: 0, cost: 0 });
  const [phase, setPhase] = useState<"setup" | "drafting" | "preview" | "applying">("setup");
  const [error, setError] = useState<string | null>(null);

  const interests = useMemo<string[]>(() => {
    try {
      return JSON.parse(trip.interests || "[]");
    } catch {
      return [];
    }
  }, [trip.interests]);

  const single = date ? days.find((d) => dayKey(d.date) === date) : undefined;
  const singleIdx = single ? days.indexOf(single) : -1;
  const cities = destinations.map((d) => d.name).join(" and ");

  // Stops already on the days this draft would touch (the server adds, it
  // doesn't replace — say so before applying).
  const existing = draft
    ? days.filter((d) => draft.some((x) => dayKey(x.date) === dayKey(d.date))).reduce((s, d) => s + d.items.length, 0)
    : 0;
  const draftStops = draft?.reduce((s, d) => s + d.items.length, 0) ?? 0;

  async function run() {
    setPhase("drafting");
    setError(null);
    try {
      const res = await generateItineraryPlan(tripId, false, undefined, pace);
      let plan = (res.plan ?? []) as DraftDay[];
      if (date) plan = plan.filter((d) => dayKey(d.date) === date);
      setDraft(plan);
      const travel = plan.reduce((s, d) => s + (d.estTravelMin || 0), 0);
      const cost = plan.reduce((s, d) => s + d.items.reduce((c, i) => c + (i.cost || 0), 0), 0);
      setTotals({ travel, cost });
      setPhase("preview");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't draft a plan right now.");
      setPhase("setup");
    }
  }

  async function apply() {
    if (!draft?.length) return;
    setPhase("applying");
    try {
      await generateItineraryPlan(tripId, true, draft);
      await reload();
      if (singleIdx >= 0) setDayIndex(singleIdx);
      toast(`Added ${draftStops} stops to your plan`);
      router.back();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't save the plan. Nothing was added.");
      setPhase("preview");
    }
  }

  const title = single ? `Plan Day ${singleIdx + 1}` : "Draft a plan";

  return (
    <View style={{ flex: 1, backgroundColor: colors.paper }}>
      <SheetBar title={title} />

      {phase === "drafting" ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: space.md }}>
          <ActivityIndicator color={colors.ink3} />
          <T v="aside" c="ink2">
            Arranging {single ? "the day" : `${days.length || "your"} days`} around {cities || "your destination"}…
          </T>
        </View>
      ) : phase === "setup" ? (
        <ScrollView contentContainerStyle={{ paddingHorizontal: GUTTER, paddingBottom: space.xxxl, gap: space.xl }}>
          <View style={{ paddingTop: space.xl, gap: space.sm }}>
            <T v="title">{single ? `A plan for ${fmtDay(single.date, { weekday: "long" })}` : `A plan for ${cities || "your trip"}`}</T>
            <T v="body" c="ink2">
              Wayfare picks places from its guide, keeps each day to one part of town so you’re not crossing the city, and fits meals in at sensible times. You’ll see it before anything changes.
            </T>
          </View>

          <View style={{ gap: 8 }}>
            <T v="label" c="ink3">
              Pace
            </T>
            <Choices options={PACES} value={pace} onChange={setPace} />
            <T v="small" c="ink3">
              {PACES.find((p) => p.key === pace)?.hint}
            </T>
          </View>

          {interests.length ? (
            <View style={{ gap: 4 }}>
              <T v="label" c="ink3">
                Leaning towards
              </T>
              <T v="meta" c="ink2">
                {interests.join(", ")}
              </T>
            </View>
          ) : null}

          {error ? (
            <T v="meta" c="danger">
              {error}
            </T>
          ) : null}

          <Button size="lg" label={error ? "Try again" : "Draft it"} onPress={run} />
        </ScrollView>
      ) : draft && draftStops === 0 ? (
        <View style={{ paddingHorizontal: GUTTER }}>
          <Empty
            title="Nothing to suggest yet"
            body={`Wayfare's place guide doesn't cover ${cities || "this destination"} yet, so it can't draft a plan. You can still add stops yourself.`}
            action="Back to the plan"
            onAction={() => router.back()}
          />
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: space.xxxl }}>
          <View style={{ paddingHorizontal: GUTTER, paddingTop: space.xl, paddingBottom: space.lg, gap: 6 }}>
            <T v="title">Here’s a draft</T>
            <T v="meta" c="ink2" num>
              {draftStops} stops
              {totals.travel ? ` · about ${fmtDuration(totals.travel)} getting around` : ""}
              {totals.cost ? ` · ~${fmtMoney(Math.round(totals.cost), trip.homeCurrency)} in entry and meals` : ""}
            </T>
            {existing > 0 ? (
              <T v="meta" c="caution">
                These are added alongside the {existing} {existing === 1 ? "stop" : "stops"} already on {draft!.length === 1 ? "that day" : "these days"}.
              </T>
            ) : null}
          </View>

          {draft!.map((d) => {
            const idx = days.findIndex((x) => dayKey(x.date) === dayKey(d.date));
            return (
              <View key={d.date} style={{ marginBottom: space.lg }}>
                <View style={{ paddingHorizontal: GUTTER, paddingVertical: space.sm }}>
                  <T v="label" c="ink3">
                    {idx >= 0 ? `Day ${idx + 1} · ` : ""}
                    {fmtDay(d.date, { weekday: "long", month: "short", day: "numeric" })}
                  </T>
                  <T v="heading" style={{ marginTop: 2 }}>
                    {d.title || d.city}
                  </T>
                </View>
                <Rule style={{ marginHorizontal: GUTTER }} />
                {d.items.map((it, i) => (
                  <View key={`${d.date}-${i}`} style={{ paddingHorizontal: GUTTER }}>
                    <View style={{ flexDirection: "row", paddingVertical: 10 }}>
                      <T v="meta" num style={{ width: 58 }}>
                        {fmtClock(it.startTime)}
                      </T>
                      <View style={{ flex: 1 }}>
                        <T v="bodyStrong">{it.title}</T>
                        <T v="small" c="ink3">
                          {[it.neighborhood, fmtDuration(it.durationMin)].filter(Boolean).join(" · ")}
                        </T>
                      </View>
                    </View>
                    {it.transportMin && i < d.items.length - 1 ? (
                      <T v="aside" c="ink3" style={{ paddingLeft: 58, fontSize: 13 }}>
                        {fmtDuration(it.transportMin)} {transportLabel(it.transportMode)}
                      </T>
                    ) : null}
                  </View>
                ))}
              </View>
            );
          })}

          <View style={{ paddingHorizontal: GUTTER, gap: space.md }}>
            {error ? (
              <T v="meta" c="danger">
                {error}
              </T>
            ) : null}
            <Button size="lg" label="Add to my trip" loading={phase === "applying"} onPress={apply} />
            <Button variant="secondary" label="Change the pace" onPress={() => setPhase("setup")} disabled={phase === "applying"} />
          </View>
        </ScrollView>
      )}
    </View>
  );
}
