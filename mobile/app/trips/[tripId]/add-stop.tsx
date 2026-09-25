import { useEffect, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { addItineraryItem, ApiError, fetchPlaces } from "@/shared/api";
import { fmtDay, fmtDuration, GUTTER, space, useTheme } from "@/shared/theme";
import { ITEM_TYPES, parseClock } from "@/shared/trip";
import type { POI } from "@/shared/types";
import { useLoadedTrip, useTrip } from "@/lib/trip";
import { SheetBar } from "@/components/ui/Bars";
import { Button } from "@/components/ui/Button";
import { Choices, Field, Loading, Rule, SectionLabel } from "@/components/ui/Primitives";
import { T } from "@/components/ui/T";
import { useToast } from "@/components/ui/Toast";

export { ErrorFallback as ErrorBoundary } from "@/components/ErrorFallback";

const DURATIONS = [30, 60, 90, 120, 180].map((m) => ({ key: String(m), label: fmtDuration(m) }));

export default function AddStop() {
  const { bundle } = useTrip();
  if (!bundle) return <Loading />;
  return <AddStopFlow />;
}

type Picked = { kind: "place"; poi: POI } | { kind: "own"; title: string };

function AddStopFlow() {
  const { colors } = useTheme();
  const toast = useToast();
  const { dayId, time } = useLocalSearchParams<{ dayId: string; time?: string }>();
  const { tripId, bundle, reload } = useLoadedTrip();
  const dayIdx = Math.max(0, bundle.days.findIndex((d) => d.id === dayId));
  const day = bundle.days[dayIdx];
  const city = day?.city || bundle.destinations[0]?.name || "";

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<POI[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [picked, setPicked] = useState<Picked | null>(null);

  const [title, setTitle] = useState("");
  const [start, setStart] = useState(time ?? "10:00");
  const [duration, setDuration] = useState("60");
  const [kind, setKind] = useState("ACTIVITY");
  const [notes, setNotes] = useState("");
  const [cost, setCost] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  // Debounced search of the place guide; with no query, show what's there.
  useEffect(() => {
    if (picked) return;
    let live = true;
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetchPlaces(tripId, { city, q: query.trim() || undefined });
        if (live) {
          setResults(res.places.slice(0, 30));
          setSearchError(null);
        }
      } catch (e) {
        if (live) setSearchError(e instanceof ApiError ? e.message : "Place search isn't available right now.");
      } finally {
        if (live) setSearching(false);
      }
    }, query ? 280 : 0);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [query, city, tripId, picked]);

  function pickPlace(poi: POI) {
    setPicked({ kind: "place", poi });
    setTitle(poi.name);
    setDuration(String([30, 60, 90, 120, 180].reduce((a, b) => (Math.abs(b - poi.durationMin) < Math.abs(a - poi.durationMin) ? b : a))));
    setKind(["RESTAURANT", "CAFE", "BAR"].includes(poi.category) ? "RESTAURANT" : "ACTIVITY");
  }

  function pickOwn() {
    setPicked({ kind: "own", title: query.trim() });
    setTitle(query.trim());
  }

  async function save() {
    const next: Record<string, string> = {};
    if (!title.trim()) next.title = "Give the stop a name.";
    if (start.trim() && parseClock(start) == null) next.start = "Use 24-hour time, like 09:30.";
    const costNum = cost.trim() ? Number(cost) : undefined;
    if (costNum != null && (!Number.isFinite(costNum) || costNum < 0)) next.cost = "A positive amount, or leave empty.";
    setErrors(next);
    if (Object.keys(next).length || !day) return;
    setSaving(true);
    try {
      await addItineraryItem(tripId, {
        dayId: day.id,
        title: title.trim(),
        type: kind,
        startTime: start.trim() ? start.trim().padStart(5, "0") : undefined,
        durationMin: Number(duration),
        poiId: picked?.kind === "place" ? picked.poi.poiId : undefined,
        notes: notes.trim() || undefined,
        cost: cost.trim() ? Number(cost) : undefined,
        currency: cost.trim() ? bundle.trip.homeCurrency : undefined,
      });
      toast(`Added to Day ${dayIdx + 1}`);
      router.back();
      void reload();
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Couldn't add the stop. Try again.", "error");
    } finally {
      setSaving(false);
    }
  }

  const heading = day ? `Day ${dayIdx + 1} · ${fmtDay(day.date, { weekday: "short", month: "short", day: "numeric" })}` : "Add a stop";

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.paper }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <SheetBar title="Add a stop" right={picked ? <Button variant="quiet" label={saving ? "Adding…" : "Add"} busy={saving} onPress={save} /> : undefined} />

      {!picked ? (
        <View style={{ flex: 1 }}>
          <View style={{ paddingHorizontal: GUTTER, paddingTop: space.lg, paddingBottom: space.md, gap: space.sm }}>
            <T v="label" c="ink3">
              {heading}
            </T>
            <Field value={query} onChangeText={setQuery} placeholder={city ? `Search places in ${city}` : "Search places"} autoFocus returnKeyType="search" autoCorrect={false} accessibilityLabel="Search places" />
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: space.xxxl }}>
            {query.trim() ? (
              <>
                <Pressable
                  onPress={pickOwn}
                  accessibilityRole="button"
                  style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: GUTTER, paddingVertical: 14, backgroundColor: pressed ? colors.sunk : "transparent" })}
                >
                  <Ionicons name="create-outline" size={20} color={colors.accent} />
                  <View style={{ flex: 1 }}>
                    <T v="bodyStrong" c="accent" numberOfLines={1}>
                      Add “{query.trim()}”
                    </T>
                    <T v="small" c="ink3">
                      As your own stop — it won’t have a map pin
                    </T>
                  </View>
                </Pressable>
                <Rule />
              </>
            ) : null}

            <View style={{ paddingHorizontal: GUTTER, paddingTop: space.lg }}>
              <SectionLabel action={searching ? <ActivityIndicator size="small" color={colors.ink3} /> : undefined}>{query.trim() ? "Places" : `In ${city || "the guide"}`}</SectionLabel>
            </View>

            {searchError ? (
              <T v="meta" c="ink2" style={{ paddingHorizontal: GUTTER }}>
                {searchError} You can still add your own stop.
              </T>
            ) : results && results.length === 0 && !searching ? (
              <T v="meta" c="ink2" style={{ paddingHorizontal: GUTTER }}>
                {query.trim() ? `Nothing in the guide matches “${query.trim()}”. Add it as your own stop above.` : `The place guide doesn't cover ${city || "this city"} yet. Type a name to add your own stop.`}
              </T>
            ) : null}

            {results?.map((p) => (
              <Pressable
                key={p.poiId}
                onPress={() => pickPlace(p)}
                accessibilityRole="button"
                accessibilityLabel={`${p.name}, ${p.neighborhood}`}
                style={({ pressed }) => ({ paddingHorizontal: GUTTER, paddingVertical: 12, backgroundColor: pressed ? colors.sunk : "transparent", borderBottomWidth: 1, borderBottomColor: colors.rule })}
              >
                <T v="entry" numberOfLines={1}>
                  {p.name}
                </T>
                <T v="small" c="ink3" num numberOfLines={1} style={{ marginTop: 2 }}>
                  {[p.cuisine || p.category.charAt(0) + p.category.slice(1).toLowerCase(), p.neighborhood, `★ ${p.rating.toFixed(1)}`, "$".repeat(Math.max(1, p.priceLevel))].join(" · ")}
                </T>
                {p.blurb ? (
                  <T v="small" c="ink2" numberOfLines={2} style={{ marginTop: 4 }}>
                    {p.blurb}
                  </T>
                ) : null}
              </Pressable>
            ))}
          </ScrollView>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingHorizontal: GUTTER, paddingBottom: space.xxxl, gap: space.xl }} keyboardShouldPersistTaps="handled">
          <View style={{ paddingTop: space.lg }}>
            <T v="label" c="ink3">
              {heading}
            </T>
            {picked.kind === "place" ? (
              <View style={{ marginTop: space.sm }}>
                <T v="aside" c="ink2">
                  {picked.poi.neighborhood} · {picked.poi.hours}
                </T>
              </View>
            ) : null}
            <Pressable onPress={() => setPicked(null)} accessibilityRole="button" hitSlop={8} style={{ marginTop: space.sm }}>
              <T v="meta" c="accent">
                Choose a different place
              </T>
            </Pressable>
          </View>

          <Field label="Name" value={title} onChangeText={setTitle} error={errors.title} />
          <Field label="Starts at" value={start} onChangeText={setStart} placeholder="10:00" numeric error={errors.start} hint="24-hour time. Leave empty for no set time." />
          <View style={{ gap: 8 }}>
            <T v="label" c="ink3">
              How long
            </T>
            <Choices options={DURATIONS} value={duration} onChange={setDuration} />
          </View>
          <View style={{ gap: 8 }}>
            <T v="label" c="ink3">
              Kind
            </T>
            <Choices options={ITEM_TYPES} value={kind} onChange={setKind} />
          </View>
          <Field label={`Cost (${bundle.trip.homeCurrency})`} value={cost} onChangeText={setCost} keyboardType="decimal-pad" numeric placeholder="Optional" error={errors.cost} />
          <Field label="Notes" value={notes} onChangeText={setNotes} placeholder="Optional" multiline style={{ minHeight: 80, textAlignVertical: "top" }} />
          <Button variant="primary" size="lg" label="Add to the day" loading={saving} onPress={save} />
        </ScrollView>
      )}
    </KeyboardAvoidingView>
  );
}
