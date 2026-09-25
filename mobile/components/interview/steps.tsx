// The planning interview's questions, one component each. Each edits a slice
// of the Draft; app/trips/new.tsx decides the order and what's required.
// The same components are reused by the "Your trip brief" screen.

import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ApiError, fetchStayAreas, searchCities, searchGuide, type GuidePlace, type Place, type StayArea } from "@/shared/api";
import { AVOIDS, DIETS, INTERESTS, type MustDo, type Pace, type Stay, type TripBrief } from "@/shared/brief";
import { fmtClock, fmtDay, radii, space, useTheme } from "@/shared/theme";
import { Button } from "@/components/ui/Button";
import { Counter } from "@/components/ui/Counter";
import { Choices, Field, Rule, Toggles } from "@/components/ui/Primitives";
import { RangeCalendar } from "@/components/ui/RangeCalendar";
import { T } from "@/components/ui/T";

type SetBrief = (fn: (b: TripBrief) => TripBrief) => void;

// ----------------------------------------------------------------- where

// Quick picks; the emoji and theme feed the web app's trip covers.
export const POPULAR: (Place & { emoji: string; theme: string })[] = [
  { name: "Tokyo", country: "Japan", admin: null, lat: 35.6762, lng: 139.6503, emoji: "⛩️", theme: "japan" },
  { name: "Kyoto", country: "Japan", admin: null, lat: 35.0116, lng: 135.7681, emoji: "🌸", theme: "japan" },
  { name: "Seoul", country: "South Korea", admin: null, lat: 37.5665, lng: 126.978, emoji: "🌆", theme: "korea" },
  { name: "Rome", country: "Italy", admin: null, lat: 41.9028, lng: 12.4964, emoji: "🍝", theme: "italy" },
  { name: "Paris", country: "France", admin: null, lat: 48.8566, lng: 2.3522, emoji: "🥐", theme: "france" },
  { name: "Manila", country: "Philippines", admin: null, lat: 14.5995, lng: 120.9842, emoji: "🏝️", theme: "philippines" },
];

export function WhereStep({ places, onChange }: { places: Place[]; onChange: (places: Place[]) => void }) {
  const { colors } = useTheme();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Place[]>([]);
  const [searching, setSearching] = useState(false);
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
          setError(null);
        }
      } catch (e) {
        if (live) setError(e instanceof ApiError ? e.message : "City search isn't available.");
      } finally {
        if (live) setSearching(false);
      }
    }, 300);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [query]);

  function add(p: Place) {
    if (!places.some((x) => x.name === p.name && x.country === p.country)) onChange([...places, p].slice(0, 4));
    setQuery("");
    setResults([]);
  }

  return (
    <View style={{ gap: space.md }}>
      {places.map((p, i) => (
        <View key={`${p.name}-${i}`} style={{ flexDirection: "row", alignItems: "center", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.rule }}>
          <View style={{ flex: 1 }}>
            <T v="entry">{p.name}</T>
            <T v="small" c="ink3">
              {[p.admin, p.country].filter(Boolean).join(", ")}
            </T>
          </View>
          <Pressable onPress={() => onChange(places.filter((_, j) => j !== i))} accessibilityRole="button" accessibilityLabel={`Remove ${p.name}`} hitSlop={12}>
            <Ionicons name="close" size={20} color={colors.ink3} />
          </Pressable>
        </View>
      ))}
      <View>
        <Field
          value={query}
          onChangeText={setQuery}
          placeholder={places.length ? "Add another city" : "Search for a city"}
          autoCorrect={false}
          returnKeyType="search"
          accessibilityLabel={places.length ? "Add another city" : "Search for a city"}
        />
        {searching ? <ActivityIndicator size="small" color={colors.ink3} style={{ position: "absolute", right: 14, top: 14 }} /> : null}
      </View>
      {error ? (
        <T v="small" c="danger">
          {error}
        </T>
      ) : null}
      {results.length ? (
        <View style={{ borderWidth: 1, borderColor: colors.edge, borderRadius: radii.md, backgroundColor: colors.raised }}>
          {results.map((r, i) => (
            <Pressable
              key={`${r.name}-${r.lat}`}
              onPress={() => add(r)}
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
      {!places.length && !query.trim() ? (
        <View style={{ gap: 8 }}>
          <T v="label" c="ink3">
            Popular
          </T>
          <Choices options={POPULAR.map((p) => ({ key: p.name, label: p.name }))} value={null} onChange={(name) => add(POPULAR.find((p) => p.name === name)!)} />
        </View>
      ) : null}
    </View>
  );
}

// ------------------------------------------------------------------ when

export function WhenStep({ start, end, onChange }: { start: string | null; end: string | null; onChange: (start: string | null, end: string | null) => void }) {
  const days = start && end ? Math.round((Date.parse(end + "T00:00:00Z") - Date.parse(start + "T00:00:00Z")) / 86400000) + 1 : null;
  return (
    <View style={{ gap: space.md }}>
      <T v="meta" c={start && end ? "ink" : "ink3"} num accessibilityLiveRegion="polite">
        {start && end
          ? `${fmtDay(start, { weekday: "short", month: "short", day: "numeric" })} – ${fmtDay(end, { weekday: "short", month: "short", day: "numeric" })} · ${days} ${days === 1 ? "day" : "days"}`
          : start
            ? "Now tap the last day"
            : "Tap the first day, then the last"}
      </T>
      <RangeCalendar start={start} end={end} onChange={onChange} />
    </View>
  );
}

// ------------------------------------------------------------------ stay

function blankStay(city: string): Stay {
  return { city, hotelName: null, hotelId: null, placeId: null, lat: null, lng: null, area: null, booked: false };
}

export function StayStep({ cities, stays, setBrief }: { cities: string[]; stays: Stay[]; setBrief: SetBrief }) {
  function update(city: string, patch: Partial<Stay>) {
    setBrief((b) => {
      const existing = b.stays.find((s) => s.city === city) ?? blankStay(city);
      const next = { ...existing, ...patch };
      return { ...b, stays: [...b.stays.filter((s) => s.city !== city), next] };
    });
  }
  return (
    <View style={{ gap: space.xl }}>
      {cities.map((city) => (
        <CityStay key={city} city={city} stay={stays.find((s) => s.city === city) ?? blankStay(city)} showCity={cities.length > 1} onChange={(p) => update(city, p)} />
      ))}
    </View>
  );
}

function CityStay({ city, stay, showCity, onChange }: { city: string; stay: Stay; showCity: boolean; onChange: (patch: Partial<Stay>) => void }) {
  const [areas, setAreas] = useState<StayArea[] | null>(null);
  useEffect(() => {
    let live = true;
    fetchStayAreas(city)
      .then((a) => live && setAreas(a))
      .catch(() => live && setAreas([]));
    return () => {
      live = false;
    };
  }, [city]);

  // Which question is open. Kept locally: "not booked, no area yet" and
  // "hasn't answered" look the same in the stay itself.
  const [mode, setMode] = useState<"booked" | "area" | null>(stay.booked ? "booked" : stay.area || stay.hotelName ? "area" : null);
  const pickArea = (name: string) => {
    const a = areas?.find((x) => x.name === name);
    if (!a) return;
    // Picking the area it's already in clears it.
    if (stay.area === a.name) onChange({ area: null, lat: null, lng: null });
    else onChange({ area: a.name, lat: a.lat, lng: a.lng });
  };

  return (
    <View style={{ gap: space.md }}>
      {showCity ? <T v="heading">{city}</T> : null}
      <Choices
        options={[
          { key: "booked" as const, label: "I've booked" },
          { key: "area" as const, label: "Not booked yet" },
        ]}
        value={mode}
        onChange={(k) => {
          setMode(k);
          onChange({ booked: k === "booked" });
        }}
      />
      {mode === "booked" ? (
        <Field label="Hotel name" value={stay.hotelName ?? ""} onChangeText={(t) => onChange({ hotelName: t || null })} placeholder="e.g. Hotel Gracery Shinjuku" autoCapitalize="words" />
      ) : null}
      {mode ? (
        areas === null ? (
          <ActivityIndicator />
        ) : areas.length ? (
          <View style={{ gap: 8 }}>
            <T v="label" c="ink3">
              {mode === "booked" ? "Which area is it in?" : "Where would you like to stay?"}
            </T>
            {areas.map((a) => (
              <AreaRow key={a.name} area={a} on={stay.area === a.name} onPress={() => pickArea(a.name)} />
            ))}
            <T v="small" c="ink3">
              Wayfare plans each day starting near here.
            </T>
          </View>
        ) : (
          <Field
            label="Neighbourhood"
            value={stay.area ?? ""}
            onChangeText={(t) => onChange({ area: t || null })}
            placeholder="Optional"
            hint={`Wayfare doesn't have a map of ${city}'s areas yet, so this is kept as a note.`}
          />
        )
      ) : null}
    </View>
  );
}

function AreaRow({ area, on, onPress }: { area: StayArea; on: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      aria-checked={on}
      accessibilityLabel={`${area.name}. ${area.note}`}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        padding: 12,
        borderRadius: radii.md,
        borderWidth: 1,
        borderColor: on ? colors.ink : colors.edge,
        backgroundColor: on ? colors.sunk : pressed ? colors.sunk : colors.raised,
      })}
    >
      <Ionicons name={on ? "radio-button-on" : "radio-button-off"} size={20} color={on ? colors.ink : colors.ink3} />
      <View style={{ flex: 1 }}>
        <T v="bodyStrong">{area.name}</T>
        <T v="small" c="ink3">
          {area.note}
        </T>
      </View>
    </Pressable>
  );
}

// ------------------------------------------------------------------- who

export function WhoStep({ party, setBrief }: { party: TripBrief["party"]; setBrief: SetBrief }) {
  const set = (p: Partial<TripBrief["party"]>) => setBrief((b) => ({ ...b, party: { ...b.party, ...p } }));
  return (
    <View style={{ gap: space.lg }}>
      <Counter label="Adults" value={party.adults} min={0} max={20} onChange={(n) => set({ adults: n })} />
      <Rule />
      <Counter label="Older travellers" detail="Wayfare keeps walking shorter and adds rests" value={party.seniors} min={0} max={10} onChange={(n) => set({ seniors: n })} />
      <Rule />
      {party.childrenAges.map((age, i) => (
        <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <View style={{ flex: 1 }}>
            <Counter
              label={`Child ${i + 1}`}
              value={age}
              min={0}
              max={17}
              format={(n) => (n === 0 ? "<1" : String(n))}
              onChange={(n) => set({ childrenAges: party.childrenAges.map((a, j) => (j === i ? n : a)) })}
            />
          </View>
          <Button variant="quiet" label="Remove" onPress={() => set({ childrenAges: party.childrenAges.filter((_, j) => j !== i) })} />
        </View>
      ))}
      <Button variant="secondary" label={party.childrenAges.length ? "Add another child" : "Travelling with children? Add a child"} onPress={() => set({ childrenAges: [...party.childrenAges, 8] })} style={{ alignSelf: "flex-start" }} />
      {party.childrenAges.length ? (
        <T v="small" c="ink3">
          Ages help Wayfare pick family-friendly places, plan earlier dinners and leave time for breaks.
        </T>
      ) : null}
    </View>
  );
}

// ------------------------------------------------------------- interests

export function InterestsStep({ interests, setBrief }: { interests: TripBrief["interests"]; setBrief: SetBrief }) {
  return <Toggles options={INTERESTS} values={interests} onChange={(v) => setBrief((b) => ({ ...b, interests: v }))} />;
}

// -------------------------------------------------------------- must-dos

export function MustDoStep({ cities, mustDos, setBrief }: { cities: string[]; mustDos: MustDo[]; setBrief: SetBrief }) {
  const { colors } = useTheme();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GuidePlace[]>([]);
  const [covered, setCovered] = useState<string[] | null>(null);

  useEffect(() => {
    let live = true;
    const t = setTimeout(async () => {
      try {
        const r = await searchGuide(cities, query.trim());
        if (live) {
          setResults(r.places.filter((p) => !mustDos.some((m) => m.poiId === p.poiId)).slice(0, query.trim() ? 8 : 5));
          setCovered(r.covered);
        }
      } catch {
        if (live) setResults([]);
      }
    }, query ? 250 : 0);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [query, cities, mustDos]);

  const add = (m: MustDo) => {
    setBrief((b) => ({ ...b, mustDos: [...b.mustDos, m] }));
    setQuery("");
  };
  const remove = (i: number) => setBrief((b) => ({ ...b, mustDos: b.mustDos.filter((_, j) => j !== i) }));
  const uncovered = covered ? cities.filter((c) => !covered.includes(c)) : [];

  return (
    <View style={{ gap: space.md }}>
      {mustDos.map((m, i) => (
        <View key={`${m.name}-${i}`} style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.rule }}>
          <Ionicons name="star" size={16} color={colors.accent} />
          <View style={{ flex: 1 }}>
            <T v="bodyStrong">{m.name}</T>
            <T v="small" c="ink3">
              {m.poiId ? [m.city, "From the guide: Wayfare will fit it in"].filter(Boolean).join(" · ") : "Your own: kept on your list"}
            </T>
          </View>
          <Pressable onPress={() => remove(i)} accessibilityRole="button" accessibilityLabel={`Remove ${m.name}`} hitSlop={12}>
            <Ionicons name="close" size={20} color={colors.ink3} />
          </Pressable>
        </View>
      ))}
      <Field value={query} onChangeText={setQuery} placeholder="A place, a dish, an experience…" autoCorrect={false} accessibilityLabel="Add a must-do" />
      {query.trim() ? (
        <Pressable onPress={() => add({ name: query.trim(), city: cities.length === 1 ? cities[0] : null, poiId: null, placeId: null })} accessibilityRole="button" hitSlop={6}>
          <T v="meta" c="accent">
            Add “{query.trim()}”
          </T>
        </Pressable>
      ) : null}
      {results.length ? (
        <View style={{ gap: 6 }}>
          <T v="label" c="ink3">
            {query.trim() ? "In the guide" : "Popular in the guide"}
          </T>
          {results.map((p) => (
            <Pressable
              key={p.poiId}
              onPress={() => add({ name: p.name, city: p.city, poiId: p.poiId, placeId: null })}
              accessibilityRole="button"
              accessibilityLabel={`Add ${p.name}, ${p.neighborhood}`}
              style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, opacity: pressed ? 0.6 : 1 })}
            >
              <Ionicons name="add-circle-outline" size={20} color={colors.accent} />
              <View style={{ flex: 1 }}>
                <T v="body">{p.name}</T>
                <T v="small" c="ink3" num>
                  {[p.neighborhood, cities.length > 1 ? p.city : null, `★ ${p.rating.toFixed(1)}`].filter(Boolean).join(" · ")}
                </T>
              </View>
            </Pressable>
          ))}
        </View>
      ) : null}
      {uncovered.length ? (
        <T v="small" c="ink3">
          Wayfare’s guide doesn’t cover {uncovered.join(" or ")} yet. Add what you’d like to do there in your own words and it stays on your list.
        </T>
      ) : null}
    </View>
  );
}

// ------------------------------------------------------------------ pace

const PACES: { key: Pace; label: string; hint: string }[] = [
  { key: "relaxed", label: "Relaxed", hint: "Two or three things a day, long lunches, early evenings." },
  { key: "balanced", label: "Balanced", hint: "A full day with room to wander." },
  { key: "packed", label: "Packed", hint: "See as much as possible. Comfortable shoes." },
];

const RHYTHMS = [
  { key: "early", label: "Early bird", rhythm: { dayStart: 8 * 60, dayEnd: 20 * 60, lateNights: false } },
  { key: "steady", label: "Steady", rhythm: { dayStart: 9 * 60, dayEnd: 21 * 60, lateNights: false } },
  { key: "late", label: "Night owl", rhythm: { dayStart: 10 * 60 + 30, dayEnd: 23 * 60, lateNights: true } },
] as const;

export function PaceStep({ pace, rhythm, setBrief }: { pace: Pace; rhythm: TripBrief["rhythm"]; setBrief: SetBrief }) {
  const current = RHYTHMS.find((r) => r.rhythm.dayStart === rhythm.dayStart && r.rhythm.dayEnd === rhythm.dayEnd)?.key ?? null;
  return (
    <View style={{ gap: space.xl }}>
      <View style={{ gap: 8 }}>
        <Choices options={PACES} value={pace} onChange={(p) => setBrief((b) => ({ ...b, pace: p }))} />
        <T v="small" c="ink3">
          {PACES.find((p) => p.key === pace)?.hint}
        </T>
      </View>
      <View style={{ gap: 8 }}>
        <T v="label" c="ink3">
          Your days
        </T>
        <Choices
          options={RHYTHMS.map((r) => ({ key: r.key, label: r.label }))}
          value={current}
          onChange={(k) => setBrief((b) => ({ ...b, rhythm: { ...RHYTHMS.find((r) => r.key === k)!.rhythm } }))}
        />
        <T v="small" c="ink3" num>
          Out from {fmtClock(rhythm.dayStart)}, back by {fmtClock(rhythm.dayEnd)}
          {rhythm.lateNights ? ", with something for the evening" : ""}.
        </T>
      </View>
    </View>
  );
}

// ------------------------------------------------------------------ food

const PRICE_LEVELS = [
  { key: "1", label: "Cheap eats" },
  { key: "2", label: "Mid-range" },
  { key: "3", label: "Nice" },
  { key: "4", label: "Splurge" },
];

export function FoodStep({ food, setBrief }: { food: TripBrief["food"]; setBrief: SetBrief }) {
  const set = (p: Partial<TripBrief["food"]>) => setBrief((b) => ({ ...b, food: { ...b.food, ...p } }));
  const [mustTry, setMustTry] = useState(food.mustTry.join(", "));
  return (
    <View style={{ gap: space.xl }}>
      <View style={{ gap: 8 }}>
        <T v="label" c="ink3">
          Any dietary needs?
        </T>
        <Toggles options={DIETS} values={food.diet} onChange={(diet) => set({ diet })} />
      </View>
      <View style={{ gap: 8 }}>
        <T v="label" c="ink3">
          Usual spend on meals
        </T>
        <Choices
          options={PRICE_LEVELS}
          value={food.priceLevel ? String(food.priceLevel) : null}
          onChange={(k) => set({ priceLevel: food.priceLevel === Number(k) ? null : (Number(k) as 1 | 2 | 3 | 4) })}
        />
      </View>
      <Field
        label="Anything you want to try?"
        value={mustTry}
        onChangeText={(t) => {
          setMustTry(t);
          set({ mustTry: t.split(",").map((x) => x.trim()).filter(Boolean).slice(0, 12) });
        }}
        placeholder="Ramen, okonomiyaki, a kaiseki dinner"
        hint="Separate with commas."
      />
    </View>
  );
}

// ------------------------------------------------------------ getting around

const WALKS = [
  { key: "any", label: "No limit", value: null },
  { key: "10", label: "10 min", value: 10 },
  { key: "15", label: "15 min", value: 15 },
  { key: "20", label: "20 min", value: 20 },
  { key: "30", label: "30 min", value: 30 },
];

export function GettingAroundStep({ mobility, avoid, setBrief }: { mobility: TripBrief["mobility"]; avoid: TripBrief["avoid"]; setBrief: SetBrief }) {
  const walkKey = mobility.maxWalkMin == null ? "any" : String(mobility.maxWalkMin);
  return (
    <View style={{ gap: space.xl }}>
      <View style={{ gap: 8 }}>
        <T v="label" c="ink3">
          Longest walk between stops
        </T>
        <Choices
          options={WALKS}
          value={WALKS.some((w) => w.key === walkKey) ? walkKey : null}
          onChange={(k) => setBrief((b) => ({ ...b, mobility: { ...b.mobility, maxWalkMin: WALKS.find((w) => w.key === k)!.value } }))}
        />
        <T v="small" c="ink3">
          Anything further, Wayfare plans a train or a taxi.
        </T>
      </View>
      <View style={{ gap: 8 }}>
        <T v="label" c="ink3">
          Rather avoid
        </T>
        <Toggles
          options={AVOIDS}
          values={avoid}
          onChange={(v) => setBrief((b) => ({ ...b, avoid: v, mobility: { ...b.mobility, avoidStairs: v.includes("stairs") } }))}
        />
      </View>
    </View>
  );
}

// ------------------------------------------------------ arrival & departure

const ARRIVALS = [
  { key: "morning", label: "Morning", time: 9 * 60 },
  { key: "midday", label: "Midday", time: 12 * 60 },
  { key: "afternoon", label: "Afternoon", time: 15 * 60 },
  { key: "evening", label: "Evening", time: 19 * 60 },
];

function nearestSlot(time: number | null): string | null {
  if (time == null) return null;
  return ARRIVALS.reduce((a, b) => (Math.abs(b.time - time) < Math.abs(a.time - time) ? b : a)).key;
}

export function ArrivalStep({
  start,
  end,
  arrival,
  departure,
  setBrief,
}: {
  start: string;
  end: string;
  arrival: TripBrief["arrival"];
  departure: TripBrief["departure"];
  setBrief: SetBrief;
}) {
  const setMoment = (which: "arrival" | "departure", date: string, key: string | null, where?: string) =>
    setBrief((b) => {
      const prev = b[which];
      const time = key ? ARRIVALS.find((a) => a.key === key)!.time : null;
      return { ...b, [which]: { date, time, where: where !== undefined ? where || null : (prev?.where ?? null) } };
    });
  return (
    <View style={{ gap: space.xl }}>
      <View style={{ gap: 8 }}>
        <T v="label" c="ink3">
          You arrive · {fmtDay(start, { weekday: "long", month: "short", day: "numeric" })}
        </T>
        <Choices
          options={ARRIVALS.map((a) => ({ key: a.key, label: a.label }))}
          value={nearestSlot(arrival?.time ?? null)}
          onChange={(k) => setMoment("arrival", start, nearestSlot(arrival?.time ?? null) === k ? null : k)}
        />
        <Field value={arrival?.where ?? ""} onChangeText={(t) => setMoment("arrival", start, nearestSlot(arrival?.time ?? null), t)} placeholder="Airport or station (optional)" accessibilityLabel="Where you arrive" />
      </View>
      <View style={{ gap: 8 }}>
        <T v="label" c="ink3">
          You leave · {fmtDay(end, { weekday: "long", month: "short", day: "numeric" })}
        </T>
        <Choices
          options={ARRIVALS.map((a) => ({ key: a.key, label: a.label }))}
          value={nearestSlot(departure?.time ?? null)}
          onChange={(k) => setMoment("departure", end, nearestSlot(departure?.time ?? null) === k ? null : k)}
        />
        <Field value={departure?.where ?? ""} onChangeText={(t) => setMoment("departure", end, nearestSlot(departure?.time ?? null), t)} placeholder="Airport or station (optional)" accessibilityLabel="Where you leave from" />
      </View>
      <T v="small" c="ink3">
        Wayfare keeps the first and last day light around these, with time to get to and from the airport.
      </T>
    </View>
  );
}
