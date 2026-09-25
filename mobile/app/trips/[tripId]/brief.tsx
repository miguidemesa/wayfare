import { useMemo, useState, type ReactNode } from "react";
import { View } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ApiError, saveTripBrief } from "@/shared/api";
import { briefForTrip, type TripBrief } from "@/shared/brief";
import { GUTTER, space, useTheme } from "@/shared/theme";
import { dayKey } from "@/shared/trip";
import { useTrip } from "@/lib/trip";
import { SubScreen } from "@/components/trip/SubScreen";
import { Button } from "@/components/ui/Button";
import { Rule } from "@/components/ui/Primitives";
import { T } from "@/components/ui/T";
import { useToast } from "@/components/ui/Toast";
import { ArrivalStep, FoodStep, GettingAroundStep, InterestsStep, MustDoStep, PaceStep, StayStep, WhoStep } from "@/components/interview/steps";

export { ErrorFallback as ErrorBoundary } from "@/components/ErrorFallback";

// Everything the traveller told Wayfare about this trip, editable in one
// place. Saving changes nothing already planned; "Re-plan" drafts days from
// the new answers and shows them before anything is added.
export default function BriefScreen() {
  const { bundle } = useTrip();
  if (!bundle) return <SubScreen title="Your trip brief">{null}</SubScreen>;
  return <BriefEditor key={bundle.trip.id} />;
}

function BriefEditor() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const { tripId, bundle, reload } = useTrip();
  const initial = useMemo(() => briefForTrip(bundle!), [bundle]);
  const [brief, setBriefState] = useState<TripBrief>(initial);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const setBrief = (fn: (b: TripBrief) => TripBrief) => {
    setBriefState(fn);
    setSaved(false);
  };

  const { trip, destinations } = bundle!;
  const cities = useMemo(() => destinations.map((d) => d.name), [destinations]);
  const stays = brief.stays.filter((s) => cities.includes(s.city));
  const dirty = JSON.stringify({ ...brief, stays }) !== JSON.stringify(initial);
  const start = dayKey(trip.startDate);
  const end = dayKey(trip.endDate);

  async function save() {
    setSaving(true);
    try {
      await saveTripBrief(tripId, { ...brief, stays });
      await reload();
      setSaved(true);
      toast("Saved");
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Couldn't save. Try again.", "error");
    } finally {
      setSaving(false);
    }
  }

  const footer =
    dirty || saved ? (
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
        {saved && !dirty ? (
          <>
            <T v="meta" c="ink2" style={{ flex: 1 }}>
              Saved. Your plan hasn’t changed.
            </T>
            <Button label="Re-plan with these answers" onPress={() => router.push({ pathname: "/trips/[tripId]/suggest", params: { tripId, auto: "1" } })} />
          </>
        ) : (
          <>
            <Button variant="quiet" label="Undo changes" onPress={() => setBrief(() => initial)} disabled={saving} />
            <View style={{ flex: 1 }} />
            <Button variant="accent" label="Save" loading={saving} onPress={save} />
          </>
        )}
      </View>
    ) : null;

  return (
    <SubScreen
      title="Your trip brief"
      intro={bundle!.brief ? "What you told Wayfare while planning. The plan and the concierge both work from this." : "Tell Wayfare a little more and it can plan days that fit. Nothing already planned changes."}
      footer={footer}
    >
      <View style={{ paddingHorizontal: GUTTER, gap: space.xxl, paddingBottom: space.xl }}>
        <Section title={cities.length === 1 ? `Where you’re staying in ${cities[0]}` : "Where you’re staying"}>
          <StayStep cities={cities} stays={stays} setBrief={setBrief} />
        </Section>
        <Section title="Who’s coming">
          <WhoStep party={brief.party} setBrief={setBrief} />
        </Section>
        <Section title="What you’re into">
          <InterestsStep interests={brief.interests} setBrief={setBrief} />
        </Section>
        <Section title="Must-dos">
          <MustDoStep cities={cities} mustDos={brief.mustDos} setBrief={setBrief} />
        </Section>
        <Section title="Your days">
          <PaceStep pace={brief.pace} rhythm={brief.rhythm} setBrief={setBrief} />
        </Section>
        <Section title="Food">
          <FoodStep food={brief.food} setBrief={setBrief} />
        </Section>
        <Section title="Getting around">
          <GettingAroundStep mobility={brief.mobility} avoid={brief.avoid} setBrief={setBrief} />
        </Section>
        <Section title="Arriving and leaving">
          <ArrivalStep start={start} end={end} arrival={brief.arrival} departure={brief.departure} setBrief={setBrief} />
        </Section>
      </View>
    </SubScreen>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={{ gap: space.lg }}>
      <View style={{ gap: space.sm }}>
        <Rule />
        <T v="heading" accessibilityRole="header">
          {title}
        </T>
      </View>
      {children}
    </View>
  );
}
