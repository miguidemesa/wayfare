import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { addChecklistItem, ApiError, deleteChecklistItem, fetchChecklist, generatePackingList, toggleChecklistItem } from "@/shared/api";
import { GUTTER, space, useTheme } from "@/shared/theme";
import type { ChecklistItem } from "@/shared/types";
import { useTrip } from "@/lib/trip";
import { SubScreen } from "@/components/trip/SubScreen";
import { Button } from "@/components/ui/Button";
import { Choices, Empty, Field, SectionLabel } from "@/components/ui/Primitives";
import { T } from "@/components/ui/T";
import { useToast } from "@/components/ui/Toast";

export { ErrorFallback as ErrorBoundary } from "@/components/ErrorFallback";

type Section = "PACKING" | "BEFORE_TRIP";
const CATEGORIES = ["Essentials", "Clothing", "Toiletries", "Electronics", "Documents", "Medication", "Other"].map((c) => ({ key: c, label: c }));

const SECTIONS: { key: Section; label: string }[] = [
  { key: "PACKING", label: "Packing" },
  { key: "BEFORE_TRIP", label: "Before you go" },
];

export default function Packing() {
  const { colors } = useTheme();
  const toast = useToast();
  const { tripId, reload: reloadTrip } = useTrip();
  const [items, setItems] = useState<ChecklistItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [section, setSection] = useState<Section>("PACKING");
  const [text, setText] = useState("");
  const [category, setCategory] = useState("Essentials");
  const [adding, setAdding] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetchChecklist(tripId);
      setItems(res.checklist);
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't load your lists.");
    }
  }, [tripId]);

  useEffect(() => {
    void load();
  }, [load]);

  const visible = useMemo(() => (items ?? []).filter((i) => i.section === section), [items, section]);
  const groups = useMemo(() => {
    const m = new Map<string, ChecklistItem[]>();
    for (const i of visible) {
      const k = i.category || "General";
      m.set(k, [...(m.get(k) ?? []), i]);
    }
    return [...m.entries()];
  }, [visible]);
  const done = visible.filter((i) => i.checked).length;

  async function toggle(item: ChecklistItem) {
    setItems((xs) => xs?.map((x) => (x.id === item.id ? { ...x, checked: !x.checked } : x)) ?? null);
    try {
      await toggleChecklistItem(tripId, item.id, !item.checked);
      void reloadTrip();
    } catch {
      toast("Couldn't update that", "error");
      void load();
    }
  }

  async function remove(item: ChecklistItem) {
    setItems((xs) => xs?.filter((x) => x.id !== item.id) ?? null);
    try {
      await deleteChecklistItem(tripId, item.id);
    } catch {
      toast("Couldn't remove that", "error");
      void load();
    }
  }

  async function add() {
    const t = text.trim();
    if (!t || adding) return;
    setAdding(true);
    try {
      const res = await addChecklistItem(tripId, { text: t, section, category: section === "PACKING" ? category : undefined });
      setItems((xs) => [...(xs ?? []), res.item]);
      setText("");
      void reloadTrip();
    } catch {
      toast("Couldn't add that", "error");
    } finally {
      setAdding(false);
    }
  }

  async function generate() {
    setGenerating(true);
    try {
      const res = await generatePackingList(tripId);
      await load();
      void reloadTrip();
      toast(res.generated ? `Added ${res.generated} items for your trip` : "Your lists already cover it");
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Couldn't suggest items right now", "error");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <SubScreen
      title="Packing & to-dos"
      intro={visible.length ? `${done} of ${visible.length} done` : undefined}
      refreshing={refreshing}
      onRefresh={async () => {
        setRefreshing(true);
        await load();
        setRefreshing(false);
      }}
    >
      <View style={{ paddingHorizontal: GUTTER, gap: space.md }}>
        <Choices options={SECTIONS} value={section} onChange={setSection} />
        <View style={{ flexDirection: "row", gap: space.sm, alignItems: "flex-start" }}>
          <View style={{ flex: 1 }}>
            <Field value={text} onChangeText={setText} placeholder={section === "PACKING" ? "Add something to pack" : "Add a to-do"} onSubmitEditing={add} returnKeyType="done" accessibilityLabel="New item" />
          </View>
          <Button label="Add" onPress={add} loading={adding} style={{ height: 46 }} />
        </View>
        {section === "PACKING" && text.trim() ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <Choices options={CATEGORIES} value={category} onChange={setCategory} wrap={false} />
          </ScrollView>
        ) : null}
      </View>

      {error ? (
        <T v="meta" c="danger" style={{ paddingHorizontal: GUTTER, marginTop: space.lg }}>
          {error}
        </T>
      ) : items && visible.length === 0 ? (
        <View style={{ paddingHorizontal: GUTTER }}>
          <Empty
            title={section === "PACKING" ? "Nothing on the list" : "No to-dos"}
            body="Add your own, or let Wayfare suggest a list from the destination, the season and how long you're away."
            action={generating ? "Suggesting…" : "Suggest a list"}
            onAction={generating ? undefined : generate}
          />
        </View>
      ) : (
        <View style={{ marginTop: space.lg }}>
          {groups.map(([cat, list]) => (
            <View key={cat} style={{ marginBottom: space.lg }}>
              <SectionLabel style={{ paddingHorizontal: GUTTER }}>{cat}</SectionLabel>
              {list.map((i) => (
                <View key={i.id} style={{ flexDirection: "row", alignItems: "center", borderBottomWidth: 1, borderBottomColor: colors.rule, marginHorizontal: GUTTER }}>
                  <Pressable
                    onPress={() => toggle(i)}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: i.checked }}
                    style={({ pressed }) => ({ flex: 1, flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, opacity: pressed ? 0.6 : 1 })}
                  >
                    <Ionicons name={i.checked ? "checkbox" : "square-outline"} size={22} color={i.checked ? colors.ink3 : colors.ink} />
                    <T v="body" c={i.checked ? "ink3" : "ink"} style={{ flex: 1, textDecorationLine: i.checked ? "line-through" : "none" }}>
                      {i.text}
                    </T>
                  </Pressable>
                  <Pressable onPress={() => remove(i)} hitSlop={10} accessibilityRole="button" accessibilityLabel={`Remove ${i.text}`} style={{ padding: 6 }}>
                    <Ionicons name="close" size={18} color={colors.ink3} />
                  </Pressable>
                </View>
              ))}
            </View>
          ))}
          {visible.length ? (
            <View style={{ paddingHorizontal: GUTTER }}>
              <Button variant="quiet" label={generating ? "Suggesting…" : "Suggest more items"} onPress={generating ? undefined : generate} />
            </View>
          ) : null}
        </View>
      )}
    </SubScreen>
  );
}
