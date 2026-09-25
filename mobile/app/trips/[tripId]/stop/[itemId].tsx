import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { ApiError, deleteItineraryItem, updateItineraryItem } from "@/shared/api";
import { fmtClock, fmtDay, fmtDuration, fmtMoney, GUTTER, space, useTheme } from "@/shared/theme";
import { categoryForItemType, isLocated, ITEM_TYPES, itemTypeLabel, parseClock } from "@/shared/trip";
import { useLoadedTrip, useTrip } from "@/lib/trip";
import { openDirections } from "@/lib/directions";
import { confirmDestructive } from "@/lib/confirm";
import { TopBar } from "@/components/ui/Bars";
import { Button } from "@/components/ui/Button";
import { Choices, Empty, Field, Loading, Rule, SectionLabel } from "@/components/ui/Primitives";
import { T } from "@/components/ui/T";
import { useToast } from "@/components/ui/Toast";

export { ErrorFallback as ErrorBoundary } from "@/components/ErrorFallback";

export default function StopScreen() {
  const { bundle } = useTrip();
  if (!bundle) return <Loading />;
  return <StopDetail />;
}

function StopDetail() {
  const { colors } = useTheme();
  const toast = useToast();
  const { itemId } = useLocalSearchParams<{ itemId: string }>();
  const { tripId, bundle, reload, update, setDayIndex, setSelectedItemId } = useLoadedTrip();
  const [mode, setMode] = useState<"view" | "edit" | "move">("view");

  const dayIdx = bundle.days.findIndex((d) => d.items.some((i) => i.id === itemId));
  const day = bundle.days[dayIdx];
  const item = day?.items.find((i) => i.id === itemId);

  if (!day || !item) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.paper }}>
        <TopBar fallback={`/trips/${tripId}`} backLabel="Plan" />
        <View style={{ paddingHorizontal: GUTTER }}>
          <Empty title="This stop is gone" body="It may have been moved or removed from the plan." />
        </View>
      </View>
    );
  }

  const stop = item;
  const end = stop.endTime ?? (stop.startTime != null ? stop.startTime + stop.durationMin : null);
  const located = isLocated(stop);

  async function toggleBooked() {
    const next = !stop.confirmed;
    update((b) => ({
      ...b,
      days: b.days.map((d) => ({ ...d, items: d.items.map((i) => (i.id === stop.id ? { ...i, confirmed: next } : i)) })),
    }));
    try {
      await updateItineraryItem(stop.id, { confirmed: next });
    } catch {
      toast("Couldn't update this stop", "error");
      void reload();
    }
  }

  function remove() {
    confirmDestructive({
      title: "Remove this stop?",
      message: `“${stop.title}” will be taken off ${fmtDay(day.date, { weekday: "long" })}.`,
      confirm: "Remove",
      cancel: "Keep",
      onConfirm: async () => {
        try {
          await deleteItineraryItem(stop.id);
          router.back();
          toast("Stop removed");
          void reload();
        } catch (e) {
          toast(e instanceof ApiError ? e.message : "Couldn't remove this stop", "error");
        }
      },
    });
  }

  function showOnMap() {
    setDayIndex(dayIdx);
    setSelectedItemId(stop.id);
    router.navigate(`/trips/${tripId}/map`);
  }

  if (mode === "edit") return <EditStop onDone={() => setMode("view")} />;

  return (
    <View style={{ flex: 1, backgroundColor: colors.paper }}>
      <TopBar fallback={`/trips/${tripId}`} backLabel={`Day ${dayIdx + 1}`} right={<Button variant="quiet" label="Edit" onPress={() => setMode("edit")} />} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: GUTTER, paddingBottom: space.xxxl }}>
        <T v="label" c="ink3" style={{ marginTop: space.md }}>
          {itemTypeLabel(stop.type)} · {fmtDay(day.date, { weekday: "long", month: "short", day: "numeric" })}
        </T>
        <T v="display" style={{ marginTop: space.sm }}>
          {stop.title}
        </T>
        {stop.placeName && stop.placeName !== stop.title ? (
          <T v="aside" c="ink2" style={{ marginTop: 4 }}>
            {stop.placeName}
          </T>
        ) : null}

        <View style={{ marginTop: space.xl, gap: 2 }}>
          <T v="heading" num>
            {stop.startTime != null ? `${fmtClock(stop.startTime)}${end != null ? ` – ${fmtClock(end)}` : ""}` : "No set time"}
          </T>
          <T v="meta" c="ink2" num>
            {[fmtDuration(stop.durationMin), stop.neighborhood, stop.cost ? fmtMoney(Math.round(stop.cost), stop.currency || bundle.trip.homeCurrency) : null].filter(Boolean).join(" · ")}
          </T>
        </View>

        <Pressable
          onPress={toggleBooked}
          accessibilityRole="switch"
          accessibilityState={{ checked: stop.confirmed }}
          style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 10, marginTop: space.lg, paddingVertical: 8, opacity: pressed ? 0.6 : 1 })}
        >
          <Ionicons name={stop.confirmed ? "checkmark-circle" : "ellipse-outline"} size={22} color={stop.confirmed ? colors.positive : colors.ink3} />
          <T v="body" c={stop.confirmed ? "positive" : "ink2"}>
            {stop.confirmed ? "Booked" : "Not booked yet — tap when it is"}
          </T>
        </Pressable>

        {stop.notes ? (
          <View style={{ marginTop: space.lg }}>
            <SectionLabel>Notes</SectionLabel>
            <T v="body">{stop.notes}</T>
          </View>
        ) : null}

        <View style={{ marginTop: space.xl }}>
          <Rule />
          <Action icon="navigate-outline" label="Directions" detail={located ? undefined : "Searches by name — this stop has no pin"} onPress={() => openDirections({ lat: stop.lat, lng: stop.lng, name: stop.placeName || stop.title, city: day.city })} />
          <Rule />
          {located ? (
            <>
              <Action icon="map-outline" label="Show on map" onPress={showOnMap} />
              <Rule />
            </>
          ) : null}
          <Action
            icon="wallet-outline"
            label="Log an expense here"
            onPress={() =>
              router.push({
                pathname: "/trips/[tripId]/add-expense",
                params: { tripId, merchant: stop.placeName || stop.title, category: categoryForItemType(stop.type), location: stop.neighborhood ?? "" },
              })
            }
          />
          <Rule />
          <Action icon="swap-horizontal-outline" label="Move to another day" onPress={() => setMode(mode === "move" ? "view" : "move")} />
          {mode === "move" ? <MoveToDay currentDayId={day.id} itemId={stop.id} onMoved={() => setMode("view")} /> : null}
          <Rule />
          <Action icon="trash-outline" label="Remove from plan" danger onPress={remove} />
          <Rule />
        </View>
      </ScrollView>
    </View>
  );
}

function Action({ icon, label, detail, onPress, danger }: { icon: keyof typeof Ionicons.glyphMap; label: string; detail?: string; onPress: () => void; danger?: boolean }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 15, backgroundColor: pressed ? colors.sunk : "transparent" })}
    >
      <Ionicons name={icon} size={20} color={danger ? colors.danger : colors.ink} />
      <View style={{ flex: 1 }}>
        <T v="body" c={danger ? "danger" : "ink"}>
          {label}
        </T>
        {detail ? (
          <T v="small" c="ink3">
            {detail}
          </T>
        ) : null}
      </View>
    </Pressable>
  );
}

function MoveToDay({ currentDayId, itemId, onMoved }: { currentDayId: string; itemId: string; onMoved: () => void }) {
  const toast = useToast();
  const { bundle, reload, setDayIndex } = useLoadedTrip();
  const [busy, setBusy] = useState(false);

  async function move(dayId: string) {
    if (dayId === currentDayId || busy) return;
    setBusy(true);
    try {
      await updateItineraryItem(itemId, { moveToDayId: dayId });
      await reload();
      const idx = bundle.days.findIndex((d) => d.id === dayId);
      if (idx >= 0) setDayIndex(idx);
      toast(`Moved to Day ${idx + 1}`);
      onMoved();
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Couldn't move this stop", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={{ paddingBottom: space.lg }}>
      <Choices
        options={bundle.days.map((d, i) => ({ key: d.id, label: `Day ${i + 1} · ${fmtDay(d.date, { weekday: "short" })}` }))}
        value={currentDayId}
        onChange={move}
      />
    </View>
  );
}

function EditStop({ onDone }: { onDone: () => void }) {
  const { colors } = useTheme();
  const toast = useToast();
  const { itemId } = useLocalSearchParams<{ itemId: string }>();
  const { bundle, reload } = useLoadedTrip();
  const item = bundle.days.flatMap((d) => d.items).find((i) => i.id === itemId)!;

  const [title, setTitle] = useState(item.title);
  const [time, setTime] = useState(item.startTime != null ? fmtClock(item.startTime) : "");
  const [duration, setDuration] = useState(String(item.durationMin));
  const [cost, setCost] = useState(item.cost != null ? String(item.cost) : "");
  const [notes, setNotes] = useState(item.notes ?? "");
  const [kind, setKind] = useState(item.type);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  async function save() {
    const next: Record<string, string> = {};
    if (!title.trim()) next.title = "Give the stop a name.";
    if (time.trim() && parseClock(time) == null) next.time = "Use 24-hour time, like 09:30.";
    const dur = Number(duration);
    if (!Number.isInteger(dur) || dur < 5 || dur > 720) next.duration = "Between 5 and 720 minutes.";
    const costNum = cost.trim() ? Number(cost) : null;
    if (costNum != null && (!Number.isFinite(costNum) || costNum < 0)) next.cost = "A positive amount, or leave empty.";
    setErrors(next);
    if (Object.keys(next).length) return;

    setSaving(true);
    try {
      await updateItineraryItem(item.id, {
        title: title.trim(),
        startTime: time.trim() ? time.trim().padStart(5, "0") : null,
        durationMin: dur,
        cost: costNum,
        notes: notes.trim() || null,
        type: kind,
      });
      await reload();
      toast("Stop updated");
      onDone();
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Couldn't save changes", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.paper }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <TopBar fallback="/trips" backLabel="Cancel" onBack={onDone} right={<Button variant="quiet" label={saving ? "Saving…" : "Save"} onPress={saving ? undefined : save} />} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: GUTTER, paddingBottom: space.xxxl, gap: space.lg }} keyboardShouldPersistTaps="handled">
        <T v="title" style={{ marginTop: space.md }}>
          Edit stop
        </T>
        <Field label="Name" value={title} onChangeText={setTitle} error={errors.title} />
        <View style={{ flexDirection: "row", gap: space.md }}>
          <View style={{ flex: 1 }}>
            <Field label="Starts" value={time} onChangeText={setTime} placeholder="10:00" numeric error={errors.time} hint="Empty = no set time" />
          </View>
          <View style={{ flex: 1 }}>
            <Field label="Minutes" value={duration} onChangeText={setDuration} keyboardType="number-pad" numeric error={errors.duration} />
          </View>
        </View>
        <View style={{ gap: 6 }}>
          <T v="label" c="ink3">
            Kind
          </T>
          <Choices options={ITEM_TYPES} value={kind} onChange={setKind} />
        </View>
        <Field label={`Cost (${item.currency || bundle.trip.homeCurrency})`} value={cost} onChangeText={setCost} keyboardType="decimal-pad" numeric placeholder="Optional" error={errors.cost} />
        <Field label="Notes" value={notes} onChangeText={setNotes} multiline placeholder="Opening hours, what to order, who's meeting you…" style={{ minHeight: 96, textAlignVertical: "top" }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
