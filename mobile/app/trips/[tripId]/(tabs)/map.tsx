import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FlatList, Pressable, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { fmtClock, fmtDistance, GUTTER, radii, space, useTheme } from "@/shared/theme";
import { dayKey, isLocated, routeKm } from "@/shared/trip";
import type { ItineraryItem } from "@/shared/types";
import { useLoadedTrip } from "@/lib/trip";
import { DayStrip } from "@/components/trip/TripChrome";
import { RouteMap } from "@/components/map/RouteMap";
import type { MapData } from "@/components/map/mapHtml";
import { Button } from "@/components/ui/Button";
import { Rule } from "@/components/ui/Primitives";
import { T } from "@/components/ui/T";

export default function MapScreen() {
  const { colors } = useTheme();
  const { tripId, bundle, dayIndex, setDayIndex, selectedItemId, setSelectedItemId } = useLoadedTrip();
  const [expanded, setExpanded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const list = useRef<FlatList<ItineraryItem>>(null);

  const day = bundle.days[dayIndex];
  const items = useMemo(() => day?.items ?? [], [day]);

  // Stops are numbered by their order among those that have a pin, so the
  // numbers on the map and in the list always match the drawn route.
  const numbers = useMemo(() => {
    const m = new Map<string, number>();
    let n = 0;
    for (const it of items) if (isLocated(it)) m.set(it.id, ++n);
    return m;
  }, [items]);

  const data = useMemo<MapData>(() => {
    const key = day ? dayKey(day.date) : null;
    const anchors = bundle.hotels
      .filter((h) => h.lat != null && h.lng != null && key != null && dayKey(h.checkIn) <= key && key < dayKey(h.checkOut))
      .map((h) => ({ id: h.id, lat: h.lat!, lng: h.lng!, title: h.name }));
    const dest = bundle.destinations.find((d) => d.name === day?.city) ?? bundle.destinations[0];
    return {
      stops: items.filter(isLocated).map((it) => ({
        id: it.id,
        n: numbers.get(it.id)!,
        lat: it.lat,
        lng: it.lng,
        title: it.title,
        time: it.startTime != null ? fmtClock(it.startTime) : undefined,
      })),
      anchors,
      center: dest && !(dest.lat === 0 && dest.lng === 0) ? { lat: dest.lat, lng: dest.lng } : null,
    };
  }, [bundle.hotels, bundle.destinations, day, items, numbers]);

  const dataKey = `${day?.id}:${items.map((i) => `${i.id}@${i.lat},${i.lng}`).join("|")}`;

  // Pin tapped → bring its row into view.
  useEffect(() => {
    if (!selectedItemId) return;
    const idx = items.findIndex((i) => i.id === selectedItemId);
    if (idx >= 0) list.current?.scrollToIndex({ index: idx, animated: true, viewPosition: 0.3 });
  }, [selectedItemId, items]);

  const onSelect = useCallback((id: string) => setSelectedItemId(id), [setSelectedItemId]);
  const onError = useCallback(() => setFailed(true), []);

  const located = data.stops.length;
  const km = routeKm(items);

  return (
    <View style={{ flex: 1 }}>
      <DayStrip bundle={bundle} value={dayIndex} onChange={setDayIndex} />

      <View style={{ flex: expanded ? 1 : 1.25, minHeight: 240, borderBottomWidth: 1, borderBottomColor: colors.rule }}>
        {failed ? (
          <View style={{ flex: 1, alignItems: "flex-start", justifyContent: "center", paddingHorizontal: GUTTER, backgroundColor: colors.sunk, gap: space.sm }}>
            <T v="heading">The map didn’t load</T>
            <T v="body" c="ink2">
              It needs a connection. Your stops are all still listed below.
            </T>
            <Button
              variant="secondary"
              label="Try again"
              onPress={() => {
                setFailed(false);
                setAttempt((a) => a + 1);
              }}
              style={{ marginTop: space.sm }}
            />
          </View>
        ) : (
          <RouteMap key={attempt} data={data} dataKey={dataKey} selectedId={selectedItemId} onSelect={onSelect} onError={onError} style={{ flex: 1 }} />
        )}

        {!failed ? (
          <View style={{ position: "absolute", top: 12, right: 12, gap: 8 }}>
            <MapButton icon={expanded ? "contract-outline" : "expand-outline"} label={expanded ? "Show the list" : "Enlarge the map"} onPress={() => setExpanded((e) => !e)} />
            {selectedItemId ? <MapButton icon="scan-outline" label="Show the whole day" onPress={() => setSelectedItemId(null)} /> : null}
          </View>
        ) : null}

        {!failed && located === 0 ? (
          <View pointerEvents="none" style={{ position: "absolute", left: 12, right: 12, bottom: 12, backgroundColor: colors.raised, borderRadius: radii.md, padding: 12, borderWidth: 1, borderColor: colors.rule }}>
            <T v="meta" c="ink2">
              {items.length === 0 ? "Nothing planned this day." : "None of this day's stops has a pin yet. Stops added from place search appear here."}
            </T>
          </View>
        ) : null}
      </View>

      {!expanded ? (
        <View style={{ flex: 1 }}>
        <FlatList
          ref={list}
          data={items}
          keyExtractor={(i) => i.id}
          onScrollToIndexFailed={() => {}}
          ListHeaderComponent={
            <View style={{ paddingHorizontal: GUTTER, paddingTop: space.md, paddingBottom: space.sm, flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" }}>
              <T v="label" c="ink3">
                {items.length} {items.length === 1 ? "stop" : "stops"}
                {located < items.length && items.length > 0 ? ` · ${items.length - located} without a pin` : ""}
              </T>
              {km > 0 ? (
                <T v="small" c="ink3" num>
                  ~{fmtDistance(km)} point to point
                </T>
              ) : null}
            </View>
          }
          ItemSeparatorComponent={() => <Rule inset={GUTTER + 36} />}
          renderItem={({ item }) => {
            const n = numbers.get(item.id);
            const on = item.id === selectedItemId;
            return (
              <Pressable
                onPress={() => (n ? setSelectedItemId(on ? null : item.id) : router.push({ pathname: "/trips/[tripId]/stop/[itemId]", params: { tripId, itemId: item.id } }))}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                accessibilityLabel={`${n ? `Stop ${n}, ` : ""}${item.title}${n ? "" : ", no pin"}`}
                style={({ pressed }) => ({
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 12,
                  paddingHorizontal: GUTTER,
                  paddingVertical: 12,
                  backgroundColor: on ? colors.accentSoft : pressed ? colors.sunk : "transparent",
                })}
              >
                <View
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: 12,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: n ? (on ? colors.accent : colors.ink) : "transparent",
                    borderWidth: n ? 0 : 1,
                    borderColor: colors.ruleStrong,
                  }}
                >
                  <T v="small" num style={{ color: n ? colors.onInk : colors.ink3, fontSize: 11 }}>
                    {n ?? "–"}
                  </T>
                </View>
                <View style={{ flex: 1 }}>
                  <T v="bodyStrong" numberOfLines={1}>
                    {item.title}
                  </T>
                  <T v="small" c="ink3" num numberOfLines={1}>
                    {[item.startTime != null ? fmtClock(item.startTime) : null, item.neighborhood, n ? null : "No pin"].filter(Boolean).join(" · ")}
                  </T>
                </View>
                <Pressable
                  onPress={() => router.push({ pathname: "/trips/[tripId]/stop/[itemId]", params: { tripId, itemId: item.id } })}
                  accessibilityRole="button"
                  accessibilityLabel={`Open ${item.title}`}
                  hitSlop={10}
                  style={({ pressed }) => ({ padding: 4, opacity: pressed ? 0.5 : 1 })}
                >
                  <Ionicons name="chevron-forward" size={18} color={colors.ink3} />
                </Pressable>
              </Pressable>
            );
          }}
          contentContainerStyle={{ paddingBottom: space.xxl }}
        />
        </View>
      ) : null}
    </View>
  );
}

function MapButton({ icon, label, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => ({
        width: 40,
        height: 40,
        borderRadius: radii.md,
        backgroundColor: colors.raised,
        borderWidth: 1,
        borderColor: colors.rule,
        alignItems: "center",
        justifyContent: "center",
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Ionicons name={icon} size={18} color={colors.ink} />
    </Pressable>
  );
}
