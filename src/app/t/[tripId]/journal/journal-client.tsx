"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Edit, MapPin, Plus, Trash2 } from "lucide-react";
import type { TripBundle } from "@/lib/trip-service";
import { Button, Card, EmptyState, Field, Input, Modal, Textarea } from "@/components/ui";
import { api, ApiError } from "@/lib/client-api";

/** JournalEntry.photos is stored as a JSON string; parse defensively. */
function journalPhotos(photos: string): string[] {
  try {
    const v = JSON.parse(photos || "[]");
    return Array.isArray(v) ? v.filter((p): p is string => typeof p === "string") : [];
  } catch {
    return [];
  }
}

export function JournalClient({ tripId, bundle }: { tripId: string; bundle: TripBundle }) {
  const router = useRouter();
  const { journal } = bundle;
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<typeof journal[0] | null>(null);
  const [viewing, setViewing] = useState<typeof journal[0] | null>(null);

  async function deleteEntry(id: string) {
    try {
      await api(`/api/trips/${tripId}/journal?id=${id}`, { method: "DELETE" });
      router.refresh();
    } catch {}
  }

  return (
    <div className="mx-auto max-w-3xl px-4 pb-24 pt-5 sm:px-6">
      <div className="mb-5 flex items-center justify-between gap-3 animate-fade-up">
        <div>
          <h1 className="font-display text-3xl tracking-tight">Travel journal</h1>
          <p className="mt-0.5 text-[13px] text-ink-3">{journal.length} entr{journal.length !== 1 ? "ies" : "y"}</p>
        </div>
        <Button onClick={() => setAddOpen(true)}>
          <Plus size={15} /> New entry
        </Button>
      </div>

      {journal.length === 0 ? (
        <EmptyState
          emoji="📔"
          title="No journal entries yet"
          description="Capture your favorite moments, photos, and thoughts from each day."
          action={<Button onClick={() => setAddOpen(true)}><Plus size={15} /> Write your first entry</Button>}
        />
      ) : (
        <div className="space-y-4">
          {journal.map((entry) => (
            <Card key={entry.id} className="overflow-hidden animate-fade-up transition-colors hover:bg-surface-2/60">
              <div className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="font-semibold truncate">{entry.title}</h3>
                    <p className="mt-1 flex flex-wrap items-center gap-x-3 text-[13px] text-ink-2">
                      <span className="flex items-center gap-1">
                        <MapPin size={11} className="text-accent" />
                        {entry.locationName ?? "No location"}
                      </span>
                      <span>
                        {entry.date.toLocaleDateString("en-US", {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </span>
                      {entry.mood && <span className="text-base">{entry.mood}</span>}
                    </p>
                    {entry.body && <p className="mt-3 text-[13px] leading-relaxed line-clamp-3">{entry.body}</p>}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Button variant="ghost" size="icon" onClick={() => setViewing(entry)}>
                      <Edit size={15} />
                    </Button>
                    <Button variant="danger" size="icon" onClick={() => deleteEntry(entry.id)}>
                      <Trash2 size={15} />
                    </Button>
                  </div>
                </div>
                {journalPhotos(entry.photos).length > 0 && (
                  <div className="mx-4 mb-4 flex gap-2 overflow-x-auto pb-2">
                    {journalPhotos(entry.photos).slice(0, 6).map((p, i) => (
                      <div key={i} className="shrink-0 rounded-xl bg-surface-2 aspect-square w-24">
                        <img src={p} alt="" className="h-full w-full rounded-xl object-cover" />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      <AddJournalModal open={addOpen} onClose={() => setAddOpen(false)} tripId={tripId} onSaved={() => router.refresh()} />
      <EditJournalModal entry={editing} onClose={() => setEditing(null)} tripId={tripId} onSaved={() => router.refresh()} />
      {viewing && (
        <Modal open onClose={() => setViewing(null)} title={viewing.title} wide>
          <div className="space-y-4">
            <p className="flex items-center gap-2 text-[13px] text-ink-2">
              <MapPin size={13} className="text-accent" /> {viewing.locationName ?? "No location"}
              {" · "}
              {viewing.date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
            </p>
            <p className="whitespace-pre-wrap text-[13px] leading-relaxed">{viewing.body}</p>
            {journalPhotos(viewing.photos).length > 0 && (
              <div className="flex gap-2 overflow-x-auto">
                {journalPhotos(viewing.photos).map((p, i) => (
                  <img key={i} src={p} alt="" className="h-40 w-auto rounded-xl object-cover" />
                ))}
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}

function AddJournalModal({ open, onClose, tripId, onSaved }: { open: boolean; onClose: () => void; tripId: string; onSaved: () => void }) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [locationName, setLocationName] = useState("");
  const [mood, setMood] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await api(`/api/trips/${tripId}/journal`, { json: { title: title.trim(), body: body.trim() || null, locationName: locationName.trim() || null, mood: mood || null } });
      onClose();
      onSaved();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="New journal entry" wide>
      <div className="space-y-4">
        <Field label="Title"><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Best ramen in Toyosu" required /></Field>
        <Field label="Location"><Input value={locationName} onChange={(e) => setLocationName(e.target.value)} placeholder="Toyosu, Tokyo" /></Field>
        <Field label="Mood (emoji)"><Input value={mood} onChange={(e) => setMood(e.target.value)} placeholder="✨ 🤯 😋" /></Field>
        <Field label="Story"><Textarea rows={6} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Write about your day…" /></Field>
        {error && <p className="rounded-lg bg-danger/10 px-3 py-2 text-[13px] text-danger">{error}</p>}
        <Button onClick={save} loading={saving} className="w-full">Save entry</Button>
      </div>
    </Modal>
  );
}

function EditJournalModal({ entry, onClose, tripId, onSaved }: { entry: TripBundle["journal"][number] | null; onClose: () => void; tripId: string; onSaved: () => void }) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [locationName, setLocationName] = useState("");
  const [mood, setMood] = useState("");
  const [saving, setSaving] = useState(false);
  const initializedFor = useRef<string | null>(null);

  if (entry && initializedFor.current !== entry.id) {
    initializedFor.current = entry.id;
    setTitle(entry.title);
    setBody(entry.body ?? "");
    setLocationName(entry.locationName ?? "");
    setMood(entry.mood ?? "");
  }

  async function save() {
    if (!entry) return;
    setSaving(true);
    try {
      await api(`/api/trips/${tripId}/journal`, { method: "PATCH", json: { id: entry.id, title: title.trim(), body: body.trim() || null, locationName: locationName.trim() || null, mood: mood || null } });
      onClose();
      onSaved();
    } catch {} finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!entry) return;
    setSaving(true);
    await api(`/api/trips/${tripId}/journal?id=${entry.id}`, { method: "DELETE" }).catch(() => {});
    setSaving(false);
    onClose();
    onSaved();
  }

  return (
    <Modal open={!!entry} onClose={onClose} title="Edit entry">
      <div className="space-y-4">
        <Field label="Title"><Input value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
        <Field label="Location"><Input value={locationName} onChange={(e) => setLocationName(e.target.value)} /></Field>
        <Field label="Mood"><Input value={mood} onChange={(e) => setMood(e.target.value)} /></Field>
        <Field label="Story"><Textarea rows={6} value={body} onChange={(e) => setBody(e.target.value)} /></Field>
        <div className="flex gap-2">
          <Button loading={saving} onClick={save} className="flex-1">Save</Button>
          <Button variant="danger" onClick={remove}><Trash2 size={15} /></Button>
        </div>
      </div>
    </Modal>
  );
}