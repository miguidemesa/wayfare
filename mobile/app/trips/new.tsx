import { useEffect, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { ApiError, createTrip, layOutDays, searchCities, type Place } from "@/shared/api";
import { fmtDate, GUTTER, radii, space, useTheme } from "@/shared/theme";
import { SheetBar } from "@/components/ui/Bars";
import { Button } from "@/components/ui/Button";
import { Choices, Field, Rule } from "@/components/ui/Primitives";
import { RangeCalendar } from "@/components/ui/RangeCalendar";
import { T } from "@/components/ui/T";

export { ErrorFallback as ErrorBoundary } from "@/components/ErrorFallback";

const HOME_CURRENCIES = ["USD", "EUR", "GBP", "PHP", "JPY", "AUD", "CAD", "SGD", "KRW"].map((c) => ({ key: c, label: c }));
const PACES = [
  { key: "relaxed" as const, label: "Relaxed" },
  { key: "balanced" as const, label: "Balanced" },
  { key: "packed" as const, label: "Packed" },
];
// Quick picks from the previous version; the emoji and theme feed the web
// app's trip covers.
const POPULAR: (Place & { emoji: string; theme: string })[] = [
  { name: "Tokyo", country: "Japan", admin: null, lat: 35.6762, lng: 139.6503, emoji: "⛩️", theme: "japan" },
  { name: "Kyoto", country: "Japan", admin: null, lat: 35.0116, lng: 135.7681, emoji: "🌸", theme: "japan" },
  { name: "Paris", country: "France", admin: null, lat: 48.8566, lng: 2.3522, emoji: "🥐", theme: "france" },
  { name: "Rome", country: "Italy", admin: null, lat: 41.9028, lng: 12.4964, emoji: "🍝", theme: "italy" },
  { name: "Manila", country: "Philippines", admin: null, lat: 14.5995, lng: 120.9842, emoji: "🏝️", theme: "philippines" },
  { name: "Seoul", country: "South Korea", admin: null, lat: 37.5665, lng: 126.978, emoji: "🌆", theme: "korea" },
];

const INTERESTS = ["Food & Dining", "Historic Sites", "Cafes & Coffee", "Art & Museums", "Nature & Parks", "Shopping", "Nightlife", "Photography", "Hidden Gems"];

export default function NewTrip() {
  const { colors } = useTheme();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Place[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [places, setPlaces] = useState<Place[]>([]);
  const [start, setStart] = useState<string | null>(null);
  const [end, setEnd] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [budget, setBudget] = useState("");
  const [home, setHome] = useState("USD");
  const [pace, setPace] = useState<"relaxed" | "balanced" | "packed">("balanced");
  const [interests, setInterests] = useState<string[]>(["Food & Dining", "Historic Sites"]);
  const [travelers, setTravelers] = useState(1);
  const [status, setStatus] = useState<"idle" | "creating" | "laying">("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    let live = true;
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const r = await searchCities(q);
        if (live) {
          setResults(r);
          setSearchError(null);
        }
      } catch (e) {
        if (live) setSearchError(e instanceof ApiError ? e.message : "City search isn't available.");
      } finally {
        if (live) setSearching(false);
      }
    }, 300);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [query]);

  function addPlace(p: Place) {
    setPlaces((ps) => (ps.some((x) => x.name === p.name && x.country === p.country) ? ps : [...ps, p].slice(0, 4)));
    setQuery("");
    setResults([]);
  }

  const suggestedTitle = places.length
    ? `${places.map((p) => p.name).join(" & ")}${start ? ` in ${new Date(start + "T00:00:00").toLocaleDateString("en-US", { month: "long" })}` : ""}`
    : "";

  async function create() {
    if (!places.length) return setError("Choose where you're going.");
    if (!start || !end) return setError("Pick the first and last day of the trip.");
    const budgetNum = budget.trim() ? Number(budget.replace(/,/g, "")) : 0;
    if (!Number.isFinite(budgetNum) || budgetNum < 0) return setError("Budget should be a number, or leave it empty.");
    setError(null);
    setStatus("creating");
    try {
      const res = await createTrip({
        title: title.trim() || suggestedTitle,
        destinations: places.map((p) => ({ name: p.name, country: p.country, lat: p.lat, lng: p.lng })),
        startDate: start,
        endDate: end,
        budgetAmount: budgetNum,
        homeCurrency: home,
        pace,
        interests,
        travelersCount: travelers,
        ...coverFor(places[0]),
      });
      // Lay out a day for every date so the plan is ready to fill.
      setStatus("laying");
      try {
        await layOutDays(res.trip.id, start, end, [], places.map((p) => p.name));
      } catch {
        // The Plan tab offers to finish this if it didn't complete.
      }
      router.replace(`/trips/${res.trip.id}`);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't create the trip. Try again.");
      setStatus("idle");
    }
  }

  const nights = start && end ? Math.round((new Date(end + "T00:00:00").getTime() - new Date(start + "T00:00:00").getTime()) / 86400000) : null;

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.paper }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <SheetBar title="New trip" />
      <ScrollView contentContainerStyle={{ paddingHorizontal: GUTTER, paddingBottom: space.xxxl }} keyboardShouldPersistTaps="handled">
        <T v="title" style={{ marginTop: space.xl }} accessibilityRole="header">
          Where are you going?
        </T>

        {places.length ? (
          <View style={{ marginTop: space.lg }}>
            {places.map((p, i) => (
              <View key={`${p.name}-${i}`} style={{ flexDirection: "row", alignItems: "center", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.rule }}>
                <View style={{ flex: 1 }}>
                  <T v="entry">{p.name}</T>
                  <T v="small" c="ink3">
                    {[p.admin, p.country].filter(Boolean).join(", ")}
                  </T>
                </View>
                <Pressable onPress={() => setPlaces((ps) => ps.filter((_, j) => j !== i))} accessibilityRole="button" accessibilityLabel={`Remove ${p.name}`} hitSlop={10}>
                  <Ionicons name="close" size={20} color={colors.ink3} />
                </Pressable>
              </View>
            ))}
          </View>
        ) : null}

        <View style={{ marginTop: space.lg }}>
          <Field
            value={query}
            onChangeText={setQuery}
            placeholder={places.length ? "Add another city" : "Search for a city"}
            autoFocus
            autoCorrect={false}
            returnKeyType="search"
            accessibilityLabel="Search for a city"
          />
          {searching ? <ActivityIndicator size="small" color={colors.ink3} style={{ position: "absolute", right: 14, top: 14 }} /> : null}
          {searchError ? (
            <T v="small" c="danger" style={{ marginTop: 6 }}>
              {searchError}
            </T>
          ) : null}
          {!places.length && !query.trim() ? (
            <View style={{ marginTop: space.md, gap: 8 }}>
              <T v="label" c="ink3">
                Popular
              </T>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                {POPULAR.map((p) => (
                  <Pressable
                    key={p.name}
                    onPress={() => addPlace(p)}
                    accessibilityRole="button"
                    accessibilityLabel={`${p.name}, ${p.country}`}
                    style={({ pressed }) => ({ paddingHorizontal: 12, height: 36, justifyContent: "center", borderRadius: radii.sm, borderWidth: 1, borderColor: colors.rule, backgroundColor: pressed ? colors.sunk : colors.raised })}
                  >
                    <T v="meta" c="ink2">
                      {p.name}
                    </T>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null}
          {results.length ? (
            <View style={{ marginTop: 6, borderWidth: 1, borderColor: colors.rule, borderRadius: radii.md, backgroundColor: colors.raised }}>
              {results.map((r, i) => (
                <Pressable
                  key={`${r.name}-${r.lat}`}
                  onPress={() => addPlace(r)}
                  accessibilityRole="button"
                  style={({ pressed }) => ({ paddingHorizontal: 14, paddingVertical: 11, borderTopWidth: i ? 1 : 0, borderTopColor: colors.rule, backgroundColor: pressed ? colors.sunk : "transparent" })}
                >
                  <T v="bodyStrong">{r.name}</T>
                  <T v="small" c="ink3">
                    {[r.admin, r.country].filter(Boolean).join(", ")}
                  </T>
                </Pressable>
              ))}
            </View>
          ) : null}
        </View>

        <T v="title" style={{ marginTop: space.xxl }} accessibilityRole="header">
          When?
        </T>
        <T v="meta" c={start && end ? "ink" : "ink3"} num style={{ marginTop: 4, marginBottom: space.md }}>
          {start && end
            ? `${fmtDate(start + "T00:00:00", { weekday: "short", month: "short", day: "numeric" })} – ${fmtDate(end + "T00:00:00", { weekday: "short", month: "short", day: "numeric" })} · ${nights! + 1} days`
            : start
              ? "Now tap the last day"
              : "Tap the first day, then the last"}
        </T>
        <RangeCalendar
          start={start}
          end={end}
          onChange={(s, e) => {
            setStart(s);
            setEnd(e);
          }}
        />

        <Rule style={{ marginTop: space.xl }} />

        <View style={{ gap: space.xl, marginTop: space.xl }}>
          <Field label="Name" value={title} onChangeText={setTitle} placeholder={suggestedTitle || "Name the trip"} />

          <View style={{ gap: 8 }}>
            <Field label="Budget" value={budget} onChangeText={setBudget} placeholder="Optional" keyboardType="decimal-pad" numeric />
            <Choices options={HOME_CURRENCIES} value={home} onChange={setHome} />
            <T v="small" c="ink3">
              Your home currency. Everything you spend is totalled in it.
            </T>
          </View>

          <View style={{ gap: 8 }}>
            <T v="label" c="ink3">
              Pace
            </T>
            <Choices options={PACES} value={pace} onChange={setPace} />
          </View>

          <View style={{ gap: 8 }}>
            <T v="label" c="ink3">
              Interested in
            </T>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
              {INTERESTS.map((i) => {
                const on = interests.includes(i);
                return (
                  <Pressable
                    key={i}
                    onPress={() => setInterests((xs) => (on ? xs.filter((x) => x !== i) : [...xs, i]))}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: on }}
                    style={{ paddingHorizontal: 12, height: 36, justifyContent: "center", borderRadius: radii.sm, borderWidth: 1, borderColor: on ? colors.ink : colors.rule, backgroundColor: on ? colors.ink : colors.raised }}
                  >
                    <T v="meta" style={{ color: on ? colors.onInk : colors.ink2 }}>
                      {i}
                    </T>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <View>
              <T v="label" c="ink3">
                Travellers
              </T>
              <T v="heading" num style={{ marginTop: 2 }}>
                {travelers}
              </T>
            </View>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Stepper icon="remove" label="Fewer travellers" disabled={travelers <= 1} onPress={() => setTravelers((n) => Math.max(1, n - 1))} />
              <Stepper icon="add" label="More travellers" disabled={travelers >= 20} onPress={() => setTravelers((n) => Math.min(20, n + 1))} />
            </View>
          </View>

          {error ? (
            <T v="meta" c="danger" accessibilityLiveRegion="polite">
              {error}
            </T>
          ) : null}
          <Button size="lg" label={status === "laying" ? "Laying out your days…" : "Create trip"} loading={status === "creating"} disabled={status !== "idle"} onPress={create} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Stepper({ icon, label, disabled, onPress }: { icon: "add" | "remove"; label: string; disabled: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => ({ width: 44, height: 44, borderRadius: radii.md, borderWidth: 1, borderColor: colors.rule, alignItems: "center", justifyContent: "center", backgroundColor: pressed ? colors.sunk : colors.raised, opacity: disabled ? 0.35 : 1 })}
    >
      <Ionicons name={icon} size={20} color={colors.ink} />
    </Pressable>
  );
}

function coverFor(p: Place): { coverEmoji?: string; coverTheme?: string } {
  const hit = POPULAR.find((x) => x.country === p.country) ?? null;
  return hit ? { coverEmoji: hit.emoji, coverTheme: hit.theme } : {};
}
