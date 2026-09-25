import { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { addDocumentNote, ApiError, deleteDocument, fetchDocuments } from "@/shared/api";
import { fmtDate, GUTTER, space, useTheme } from "@/shared/theme";
import type { DocumentFile } from "@/shared/types";
import { useTrip } from "@/lib/trip";
import { confirmDestructive } from "@/lib/confirm";
import { SubScreen } from "@/components/trip/SubScreen";
import { Button } from "@/components/ui/Button";
import { Choices, Empty, Field, Rule } from "@/components/ui/Primitives";
import { T } from "@/components/ui/T";
import { useToast } from "@/components/ui/Toast";

export { ErrorFallback as ErrorBoundary } from "@/components/ErrorFallback";

const KINDS = [
  { key: "PASSPORT_NOTE", label: "Passport / ID" },
  { key: "TICKET", label: "Ticket" },
  { key: "HOTEL", label: "Stay" },
  { key: "FLIGHT", label: "Flight" },
  { key: "INSURANCE", label: "Insurance" },
  { key: "NOTE", label: "Note" },
];
const kindLabel = (k: string) => KINDS.find((x) => x.key === k)?.label ?? "Other";

export default function Documents() {
  const { colors } = useTheme();
  const toast = useToast();
  const { tripId, reload: reloadTrip } = useTrip();
  const [docs, setDocs] = useState<DocumentFile[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [shown, setShown] = useState<Record<string, boolean>>({});
  const [adding, setAdding] = useState(false);
  const [kindFilter, setKindFilter] = useState("ALL");

  const load = useCallback(async () => {
    try {
      const res = await fetchDocuments(tripId);
      setDocs(res.documents);
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't load documents.");
    }
  }, [tripId]);

  useEffect(() => {
    void load();
  }, [load]);

  function remove(d: DocumentFile) {
    confirmDestructive({
      title: `Delete “${d.name}”?`,
      confirm: "Delete",
      onConfirm: async () => {
        try {
          await deleteDocument(tripId, d.id);
          setDocs((xs) => xs?.filter((x) => x.id !== d.id) ?? null);
          void reloadTrip();
          toast("Document deleted");
        } catch {
          toast("Couldn't delete it", "error");
        }
      },
    });
  }

  return (
    <SubScreen
      title="Documents"
      intro="Passport numbers, policy details, ticket codes. Sensitive ones stay hidden until you tap."
      right={!adding ? <Button variant="quiet" label="Add" onPress={() => setAdding(true)} /> : undefined}
      refreshing={refreshing}
      onRefresh={async () => {
        setRefreshing(true);
        await load();
        setRefreshing(false);
      }}
    >
      {adding ? (
        <AddDoc
          onDone={(doc) => {
            setAdding(false);
            if (doc) {
              setDocs((xs) => [doc, ...(xs ?? [])]);
              void reloadTrip();
            }
          }}
        />
      ) : null}

      {error ? (
        <T v="meta" c="danger" style={{ paddingHorizontal: GUTTER }}>
          {error}
        </T>
      ) : docs && docs.length === 0 && !adding ? (
        <View style={{ paddingHorizontal: GUTTER }}>
          <Empty title="Nothing saved yet" body="Keep the numbers you'll be asked for at check-in or the border." action="Add a document" onAction={() => setAdding(true)} />
        </View>
      ) : (
        <View>
          {docs && docs.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: GUTTER, paddingBottom: space.md }}>
              <Choices options={[{ key: "ALL", label: "All" }, ...KINDS.filter((k) => docs.some((d) => d.kind === k.key))]} value={kindFilter} onChange={setKindFilter} wrap={false} />
            </ScrollView>
          ) : null}
          <Rule style={{ marginHorizontal: GUTTER }} />
          {(docs ?? []).filter((d) => kindFilter === "ALL" || d.kind === kindFilter).map((d) => {
            const hidden = d.sensitive && !shown[d.id];
            return (
              <View key={d.id} style={{ paddingHorizontal: GUTTER, paddingVertical: space.md, borderBottomWidth: 1, borderBottomColor: colors.rule }}>
                <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
                  <T v="entry" style={{ flex: 1 }}>
                    {d.name}
                  </T>
                  <Pressable onPress={() => remove(d)} hitSlop={10} accessibilityRole="button" accessibilityLabel={`Delete ${d.name}`}>
                    <T v="small" c="ink3">
                      Delete
                    </T>
                  </Pressable>
                </View>
                <T v="small" c="ink3" style={{ marginTop: 2 }}>
                  {[kindLabel(d.kind), d.sensitive ? "Sensitive" : null, fmtDate(d.createdAt, { month: "short", day: "numeric" })].filter(Boolean).join(" · ")}
                </T>
                {d.content ? (
                  <Pressable
                    onPress={() => d.sensitive && setShown((s) => ({ ...s, [d.id]: !s[d.id] }))}
                    disabled={!d.sensitive}
                    accessibilityRole={d.sensitive ? "button" : undefined}
                    accessibilityLabel={hidden ? "Hidden. Tap to show" : undefined}
                    style={{ marginTop: space.sm, flexDirection: "row", alignItems: "center", gap: 8 }}
                  >
                    <T v="body" num selectable={!hidden} style={{ flex: 1, letterSpacing: hidden ? 2 : 0 }}>
                      {hidden ? "•".repeat(Math.min(14, Math.max(6, d.content.length))) : d.content}
                    </T>
                    {d.sensitive ? <Ionicons name={hidden ? "eye-outline" : "eye-off-outline"} size={18} color={colors.ink3} /> : null}
                  </Pressable>
                ) : d.fileName ? (
                  <T v="meta" c="ink2" style={{ marginTop: space.sm }}>
                    File: {d.fileName}
                  </T>
                ) : null}
              </View>
            );
          })}
        </View>
      )}
    </SubScreen>
  );
}

function AddDoc({ onDone }: { onDone: (doc: DocumentFile | null) => void }) {
  const { colors } = useTheme();
  const toast = useToast();
  const { tripId } = useTrip();
  const [name, setName] = useState("");
  const [kind, setKind] = useState("PASSPORT_NOTE");
  const [content, setContent] = useState("");
  const [sensitive, setSensitive] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!name.trim() || !content.trim()) return setError("Add a name and the details.");
    setSaving(true);
    try {
      const res = await addDocumentNote(tripId, { name: name.trim(), kind, content: content.trim(), sensitive });
      toast("Saved");
      onDone(res.document);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't save it.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={{ marginHorizontal: GUTTER, marginBottom: space.xl, padding: space.lg, gap: space.lg, borderWidth: 1, borderColor: colors.rule, borderRadius: 8, backgroundColor: colors.raised }}>
      <Choices options={KINDS} value={kind} onChange={setKind} />
      <Field label="Name" value={name} onChangeText={setName} placeholder="Passport — Maria" />
      <Field label="Details" value={content} onChangeText={setContent} placeholder="Number, policy, booking code…" multiline style={{ minHeight: 80, textAlignVertical: "top" }} />
      <Pressable onPress={() => setSensitive(!sensitive)} accessibilityRole="checkbox" accessibilityState={{ checked: sensitive }} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <Ionicons name={sensitive ? "checkbox" : "square-outline"} size={22} color={sensitive ? colors.ink : colors.ink3} />
        <T v="meta">Hide the details until tapped</T>
      </Pressable>
      {error ? (
        <T v="small" c="danger">
          {error}
        </T>
      ) : null}
      <View style={{ flexDirection: "row", gap: space.md }}>
        <Button label="Save" loading={saving} onPress={save} style={{ flex: 1 }} />
        <Button variant="secondary" label="Cancel" onPress={() => onDone(null)} />
      </View>
    </View>
  );
}
