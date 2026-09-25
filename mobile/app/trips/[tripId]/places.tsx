import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { addItineraryItem, ApiError, deleteSavedPlace, fetchPlaces, savePlace } from "@/shared/api";
import { fmtDay, GUTTER, space, useTheme } from "@/shared/theme";
import type { POI } from "@/shared/types";
import { useTrip } from "@/lib/trip";
import { SubScreen } from "@/components/trip/SubScreen";
import { RouteMap } from "@/components/map/RouteMap";
import type { MapData } from "@/components/map/mapHtml";
import { Choices, Field, Rule } from "@/components/ui/Primitives";
import { T } from "@/components/ui/T";
import { useToast } from "@/components/ui/Toast";

export { ErrorFallback as ErrorBoundary } from "@/components/ErrorFallback";

const FILTERS = [
  { key: "saved", label: "Saved" },
  { key: "all", label: "Everything" },
  { key: "FOOD", label: "Eat & drink" },
  { key: "ATTRACTION", label: "Sights" },
  { key: "TEMPLE", label: "Temples" },
  { key: "MUSEUM", label: "Museums" },
  { key: "PARK", label: "Parks" },
  { key: "SHOPPING", label: "Shops" },
];

// Places from Wayfare's guide for the trip's cities: search, save for later,
// or drop straight onto a day.
export default function Places() {
  const { colors } = useTheme();
  const toast = useToast();
  const { tripId, bundle, reload } = useTrip();
  const cities = bundle?.destinations.map((d) => d.name) ?? [];
  const [city, setCity] = useState<string>(cities[0] ?? "");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [results, setResults] = useState<POI[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [placing, setPlacing] = useState<string | null>(null);
  const [view, setView] = useState<"list" | "map">("list");
  const [mapFailed, setMapFailed] = useState(false);
  const [picked, setPicked] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetchPlaces(tripId, { city: city || undefined, q: query.trim() || undefined, category: filter === "saved" ? "all" : filter });
        if (live) {
          setResults(res.places);
          setError(null);
        }
      } catch (e) {
        if (live) setError(e instanceof ApiError ? e.message : "Couldn't load places.");
      } finally {
        if (live) setLoading(false);
      }
    }, query ? 280 : 0);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [tripId, city, query, filter]);

  const saved = bundle?.savedPlaces ?? [];
  const savedByName = new Map(saved.map((s) => [s.name, s]));
  // "Saved" shows what you've bookmarked, matched against the guide so the
  // same actions (add to a day, unsave) work on them.
  const shown = filter === "saved" ? (results ?? []).filter((p) => savedByName.has(p.name)) : results;
  const savedElsewhere = filter === "saved" ? saved.filter((sp) => !(results ?? []).some((p) => p.name === sp.name)) : [];
  const firstDest = bundle?.destinations[0];
  const mapData: MapData = {
    stops: (shown ?? []).slice(0, 40).map((p, i) => ({ id: p.poiId, n: i + 1, lat: p.lat, lng: p.lng, title: p.name })),
    anchors: [],
    center: firstDest ? { lat: firstDest.lat, lng: firstDest.lng } : null,
  };

  async function toggleSave(p: POI) {
    const existing = savedByName.get(p.name);
    try {
      if (existing) {
        await deleteSavedPlace(tripId, existing.id);
        toast("Removed from saved");
      } else {
        await savePlace(tripId, p.poiId);
        toast("Saved for later");
      }
      void reload();
    } catch {
      toast("Couldn't update saved places", "error");
    }
  }

  async function addToDay(p: POI, dayId: string, idx: number) {
    try {
      await addItineraryItem(tripId, { dayId, title: p.name, poiId: p.poiId, type: ["RESTAURANT", "CAFE", "BAR"].includes(p.category) ? "RESTAURANT" : "ACTIVITY" });
      setPlacing(null);
      void reload();
      toast(`Added to Day ${idx + 1}`);
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Couldn't add it", "error");
    }
  }

  return (
    <SubScreen title="Places" intro={saved.length ? `${saved.length} saved for this trip` : "Search the guide and save what you'd like to see."}>
      <View style={{ paddingHorizontal: GUTTER, gap: space.md }}>
        {cities.length > 1 ? <Choices options={cities.map((c) => ({ key: c, label: c }))} value={city} onChange={setCity} /> : null}
        <Field value={query} onChangeText={setQuery} placeholder={`Search ${city || "places"}`} autoCorrect={false} returnKeyType="search" accessibilityLabel="Search places" />
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <Choices options={FILTERS} value={filter} onChange={setFilter} wrap={false} />
        </ScrollView>
        <Choices
          options={[
            { key: "list" as const, label: "List" },
            { key: "map" as const, label: "Map" },
          ]}
          value={view}
          onChange={setView}
        />
      </View>

      {view === "map" ? (
        <View style={{ height: 320, marginTop: space.lg, marginHorizontal: GUTTER, borderRadius: 8, overflow: "hidden", borderWidth: 1, borderColor: colors.rule }}>
          {mapFailed ? (
            <View style={{ flex: 1, justifyContent: "center", padding: space.lg, backgroundColor: colors.sunk }}>
              <T v="meta" c="ink2">The map needs a connection. The list below still works.</T>
            </View>
          ) : (
            <RouteMap
              data={{ ...mapData, stops: mapData.stops }}
              dataKey={`places:${mapData.stops.map((s) => s.id).join(",")}`}
              selectedId={picked}
              onSelect={setPicked}
              onError={() => setMapFailed(true)}
              style={{ flex: 1 }}
              showRoute={false}
            />
          )}
        </View>
      ) : null}

      <View style={{ marginTop: space.lg }}>
        {loading && !results ? <ActivityIndicator color={colors.ink3} /> : null}
        {error ? (
          <T v="meta" c="danger" style={{ paddingHorizontal: GUTTER }}>
            {error}
          </T>
        ) : shown && shown.length === 0 && savedElsewhere.length === 0 ? (
          <T v="meta" c="ink2" style={{ paddingHorizontal: GUTTER, paddingBottom: space.md }}>
            {filter === "saved" ? "Nothing saved here yet. Tap the bookmark on any place to keep it." : query ? `Nothing matches “${query}”.` : `The guide doesn't cover ${city || "this destination"} yet.`}
          </T>
        ) : null}
        <Rule style={{ marginHorizontal: GUTTER }} />
        {savedElsewhere.map((sp) => (
          <View key={sp.id} style={{ paddingHorizontal: GUTTER, paddingVertical: space.md, borderBottomWidth: 1, borderBottomColor: colors.rule, flexDirection: "row", gap: 12 }}>
            <View style={{ flex: 1 }}>
              <T v="entry">{sp.name}</T>
              <T v="small" c="ink3" num style={{ marginTop: 2 }}>
                {[sp.cuisine || sp.category, sp.rating ? `★ ${sp.rating.toFixed(1)}` : null, sp.address, sp.openHours].filter(Boolean).join(" · ")}
              </T>
              {sp.notes ? (
                <T v="meta" c="ink2" style={{ marginTop: 6 }}>
                  {sp.notes}
                </T>
              ) : null}
            </View>
            <Pressable
              onPress={async () => {
                try {
                  await deleteSavedPlace(tripId, sp.id);
                  void reload();
                  toast("Removed from saved");
                } catch {
                  toast("Couldn't update saved places", "error");
                }
              }}
              accessibilityRole="button"
              accessibilityLabel={`Unsave ${sp.name}`}
              hitSlop={10}
              style={{ paddingTop: 4 }}
            >
              <Ionicons name="bookmark" size={20} color={colors.accent} />
            </Pressable>
          </View>
        ))}
        {shown?.map((p, i) => {
          const isSaved = savedByName.has(p.name);
          return (
            <View key={p.poiId} style={{ paddingHorizontal: GUTTER, paddingVertical: space.md, borderBottomWidth: 1, borderBottomColor: colors.rule, backgroundColor: picked === p.poiId ? colors.accentSoft : "transparent" }}>
              <View style={{ flexDirection: "row", gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <T v="entry">
                    {view === "map" ? `${i + 1}. ` : ""}
                    {p.name}
                  </T>
                  <T v="small" c="ink3" num style={{ marginTop: 2 }}>
                    {[p.cuisine || p.category.charAt(0) + p.category.slice(1).toLowerCase(), p.neighborhood, `★ ${p.rating.toFixed(1)}`, "$".repeat(Math.max(1, p.priceLevel)), p.walkMin ? `${p.walkMin} min walk` : null, p.hours].filter(Boolean).join(" · ")}
                  </T>
                  {p.blurb ? (
                    <T v="meta" c="ink2" style={{ marginTop: 6 }}>
                      {p.blurb}
                    </T>
                  ) : null}
                </View>
                <Pressable onPress={() => toggleSave(p)} accessibilityRole="button" accessibilityLabel={isSaved ? `Unsave ${p.name}` : `Save ${p.name}`} hitSlop={10} style={{ paddingTop: 4 }}>
                  <Ionicons name={isSaved ? "bookmark" : "bookmark-outline"} size={20} color={isSaved ? colors.accent : colors.ink3} />
                </Pressable>
              </View>
              <Pressable onPress={() => setPlacing(placing === p.poiId ? null : p.poiId)} accessibilityRole="button" hitSlop={6} style={{ marginTop: space.sm, alignSelf: "flex-start" }}>
                <T v="meta" c="accent">
                  {placing === p.poiId ? "Cancel" : "Add to a day"}
                </T>
              </Pressable>
              {placing === p.poiId ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: space.sm }}>
                  <Choices
                    options={(bundle?.days ?? []).map((d, i) => ({ key: d.id, label: `Day ${i + 1} · ${fmtDay(d.date, { weekday: "short" })}` }))}
                    value={null}
                    onChange={(id) => addToDay(p, id, bundle!.days.findIndex((d) => d.id === id))}
                    wrap={false}
                  />
                </ScrollView>
              ) : null}
            </View>
          );
        })}
      </View>
    </SubScreen>
  );
}
