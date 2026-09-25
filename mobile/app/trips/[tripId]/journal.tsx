import { useState } from "react";
import { Pressable, View } from "react-native";
import { addJournalEntry, ApiError, deleteJournalEntry } from "@/shared/api";
import { fmtDate, GUTTER, space, useTheme } from "@/shared/theme";
import { dayKey, localKey } from "@/shared/trip";
import { useTrip } from "@/lib/trip";
import { confirmDestructive } from "@/lib/confirm";
import { SubScreen } from "@/components/trip/SubScreen";
import { Button } from "@/components/ui/Button";
import { Choices, Empty, Field } from "@/components/ui/Primitives";
import { T } from "@/components/ui/T";
import { useToast } from "@/components/ui/Toast";

export { ErrorFallback as ErrorBoundary } from "@/components/ErrorFallback";

const MOODS = [
  { key: "loved", label: "Loved it" },
  { key: "delicious", label: "Delicious" },
  { key: "scenic", label: "Scenic" },
  { key: "adventurous", label: "Adventure" },
  { key: "peaceful", label: "Peaceful" },
  { key: "photogenic", label: "Photogenic" },
];
const moodLabel = (k: string | null) => MOODS.find((m) => m.key === k)?.label ?? null;

export default function Journal() {
  const { colors } = useTheme();
  const toast = useToast();
  const { tripId, bundle, reload } = useTrip();
  const [writing, setWriting] = useState(false);

  const entries = [...(bundle?.journal ?? [])].sort((a, b) => (a.date < b.date ? 1 : -1));
  const dayOf = new Map((bundle?.days ?? []).map((d, i) => [dayKey(d.date), i + 1]));

  function remove(id: string, title: string) {
    confirmDestructive({
      title: `Delete “${title}”?`,
      confirm: "Delete",
      onConfirm: async () => {
        try {
          await deleteJournalEntry(tripId, id);
          await reload();
          toast("Entry deleted");
        } catch {
          toast("Couldn't delete it", "error");
        }
      },
    });
  }

  return (
    <SubScreen title="Journal" intro="A line or two a day is enough to remember it by." right={!writing ? <Button variant="quiet" label="Write" onPress={() => setWriting(true)} /> : undefined}>
      {writing ? <Compose onDone={() => setWriting(false)} /> : null}

      {entries.length === 0 && !writing ? (
        <View style={{ paddingHorizontal: GUTTER }}>
          <Empty title="Nothing written yet" body="What you ate, who you met, the view from the train. Future you will be glad." action="Write the first entry" onAction={() => setWriting(true)} />
        </View>
      ) : null}

      {entries.map((e) => {
        const n = dayOf.get(localKey(e.date));
        let photos = 0;
        try {
          photos = (JSON.parse(e.photos || "[]") as unknown[]).length;
        } catch {}
        return (
          <View key={e.id} style={{ paddingHorizontal: GUTTER, paddingVertical: space.lg, borderTopWidth: 1, borderTopColor: colors.rule }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <T v="label" c="ink3">
                {fmtDate(e.date, { weekday: "short", month: "short", day: "numeric" })}
                {n ? ` · Day ${n}` : ""}
              </T>
              <Pressable onPress={() => remove(e.id, e.title)} hitSlop={10} accessibilityRole="button" accessibilityLabel={`Delete ${e.title}`}>
                <T v="small" c="ink3">
                  Delete
                </T>
              </Pressable>
            </View>
            <T v="heading" style={{ marginTop: 6 }}>
              {e.title}
            </T>
            {e.locationName || moodLabel(e.mood) ? (
              <T v="aside" c="ink2" style={{ marginTop: 2 }}>
                {[e.locationName, moodLabel(e.mood)].filter(Boolean).join(" — ")}
              </T>
            ) : null}
            {e.body ? (
              <T v="body" style={{ marginTop: space.sm }}>
                {e.body}
              </T>
            ) : null}
            {photos ? (
              <T v="small" c="ink3" style={{ marginTop: space.sm }}>
                {photos} {photos === 1 ? "photo" : "photos"} (view on the web)
              </T>
            ) : null}
          </View>
        );
      })}
    </SubScreen>
  );
}

function Compose({ onDone }: { onDone: () => void }) {
  const { colors } = useTheme();
  const toast = useToast();
  const { tripId, reload } = useTrip();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [where, setWhere] = useState("");
  const [mood, setMood] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!title.trim()) return setError("Give the entry a title.");
    setSaving(true);
    try {
      await addJournalEntry(tripId, { title: title.trim(), body: body.trim() || undefined, locationName: where.trim() || undefined, mood: mood ?? undefined });
      await reload();
      toast("Saved to your journal");
      onDone();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't save it.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={{ marginHorizontal: GUTTER, marginBottom: space.xl, padding: space.lg, gap: space.lg, borderWidth: 1, borderColor: colors.rule, borderRadius: 8, backgroundColor: colors.raised }}>
      <Field label="Title" value={title} onChangeText={setTitle} placeholder="The night market" autoFocus />
      <Field label="What happened" value={body} onChangeText={setBody} multiline placeholder="Optional" style={{ minHeight: 120, textAlignVertical: "top" }} />
      <Field label="Where" value={where} onChangeText={setWhere} placeholder="Optional" />
      <Choices options={MOODS} value={mood} onChange={(k) => setMood(k === mood ? null : k)} />
      {error ? (
        <T v="small" c="danger">
          {error}
        </T>
      ) : null}
      <View style={{ flexDirection: "row", gap: space.md }}>
        <Button label="Save" loading={saving} onPress={save} style={{ flex: 1 }} />
        <Button variant="secondary" label="Cancel" onPress={onDone} />
      </View>
    </View>
  );
}
