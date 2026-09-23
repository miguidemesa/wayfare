"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  Plus,
  Sparkles,
  Trash2,
} from "lucide-react";
import type { TripBundle } from "@/lib/trip-service";
import { Badge, Button, Card, EmptyState, Field, Input, Modal, Select, toast } from "@/components/ui";
import { api, ApiError } from "@/lib/client-api";
import { cn } from "@/lib/utils";

type Item = TripBundle["checklist"][number];

export function PackingClient({ tripId, bundle }: { tripId: string; bundle: TripBundle }) {
  const router = useRouter();
  const [items, setItems] = useState<Item[]>(bundle.checklist);
  const [addOpen, setAddOpen] = useState(false);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    setItems(bundle.checklist);
  }, [bundle.checklist]);

  const before = items.filter((c) => c.section === "BEFORE_TRIP");
  const packing = items.filter((c) => c.section === "PACKING");
  const beforeDone = before.filter((c) => c.checked).length;
  const packingDone = packing.filter((c) => c.checked).length;

  async function toggleCheck(id: string, checked: boolean) {
    // Optimistic update
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, checked } : item))
    );
    try {
      await api(`/api/trips/${tripId}/checklist`, {
        method: "PATCH",
        json: { id, checked },
      });
    } catch {
      // Rollback on error
      setItems((prev) =>
        prev.map((item) => (item.id === id ? { ...item, checked: !checked } : item))
      );
      toast.error("Failed to update item");
    }
  }

  async function deleteItem(id: string) {
    const itemToDelete = items.find((i) => i.id === id);
    // Optimistic remove
    setItems((prev) => prev.filter((item) => item.id !== id));
    try {
      await api(`/api/trips/${tripId}/checklist?id=${id}`, { method: "DELETE" });
      toast.info("Item deleted");
    } catch {
      // Rollback on error
      if (itemToDelete) {
        setItems((prev) => [...prev, itemToDelete]);
      }
      toast.error("Failed to delete item");
    }
  }

  async function generate() {
    setGenerating(true);
    try {
      const res = await api<{ items?: Item[] }>(`/api/trips/${tripId}/checklist`, { json: { action: "generate" } });
      if (res.items) {
        setItems(res.items);
      }
      toast.success("Generated smart packing list");
      router.refresh();
    } catch {
      toast.error("Failed to generate packing list");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 pb-24 pt-5 sm:px-6">
      <div className="mb-5 flex items-center justify-between gap-3 animate-fade-up">
        <div>
          <h1 className="font-display text-3xl tracking-tight">Packing & checklist</h1>
          <p className="mt-0.5 text-[13px] text-ink-3">
            {beforeDone}/{before.length} pre-trip · {packingDone}/{packing.length} packing
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={generate} loading={generating}>
            <Sparkles size={15} /> Generate
          </Button>
          <Button onClick={() => setAddOpen(true)}>
            <Plus size={15} /> Add item
          </Button>
        </div>
      </div>

      {before.length === 0 && packing.length === 0 ? (
        <EmptyState
          emoji="🎒"
          title="Checklist is empty"
          description="Generate a smart list based on your destinations, dates, and interests — or add items manually."
          action={
            <div className="flex gap-2">
              <Button onClick={generate}><Sparkles size={15} /> Generate list</Button>
              <Button variant="secondary" onClick={() => setAddOpen(true)}><Plus size={15} /> Add manually</Button>
            </div>
          }
        />
      ) : (
        <>
          {(before.length > 0 || packing.length > 0) && (
            <Card className="mb-4 p-3 animate-fade-up">
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="rounded-xl border border-line bg-surface-2/60 p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-3">Pre-trip</p>
                  <p className="tabular mt-1 text-xl font-bold">
                    <span className="text-accent-strong">{beforeDone}</span>/{before.length}
                  </p>
                </div>
                <div className="rounded-xl border border-line bg-surface-2/60 p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-3">Packing</p>
                  <p className="tabular mt-1 text-xl font-bold">
                    <span className="text-accent-strong">{packingDone}</span>/{packing.length}
                  </p>
                </div>
              </div>
            </Card>
          )}

          {before.length > 0 && (
            <section className="mb-5 animate-fade-up">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-ink-3">Before your trip</h2>
              <div className="space-y-2">
                {before.map((item) => (
                  <ChecklistItem key={item.id} item={item} onToggle={toggleCheck} onDelete={deleteItem} />
                ))}
              </div>
            </section>
          )}

          {packing.length > 0 && (
            <section className="animate-fade-up">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-ink-3">Packing</h2>
              <div className="space-y-2">
                {packing.map((item) => (
                  <ChecklistItem key={item.id} item={item} onToggle={toggleCheck} onDelete={deleteItem} />
                ))}
              </div>
            </section>
          )}

          <AddChecklistModal
            open={addOpen}
            onClose={() => setAddOpen(false)}
            tripId={tripId}
            onSaved={(newItem) => {
              if (newItem) setItems((prev) => [...prev, newItem]);
              toast.success("Item added");
              router.refresh();
            }}
          />
        </>
      )}
    </div>
  );
}

function ChecklistItem({ item, onToggle, onDelete }: { item: Item; onToggle: (id: string, checked: boolean) => void; onDelete: (id: string) => void }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-line bg-surface p-3 transition-colors hover:bg-surface-2/60">
      <button
        onClick={() => onToggle(item.id, !item.checked)}
        className={cn(
          "grid h-5 w-5 place-items-center rounded border-2 transition-colors active:scale-95",
          item.checked
            ? "border-accent bg-accent text-white"
            : "border-line-strong text-ink-3 hover:border-accent/50"
        )}
      >
        {item.checked && <Check size={13} />}
      </button>
      <p className={cn("flex-1 text-[13.5px] leading-snug", item.checked && "line-through text-ink-3")}>
        {item.text}
      </p>
      {item.category && <Badge tone="neutral" className="shrink-0 text-[10px]">{item.category}</Badge>}
      <Button variant="ghost" size="icon" onClick={() => onDelete(item.id)}>
        <Trash2 size={13} />
      </Button>
    </div>
  );
}

function AddChecklistModal({ open, onClose, tripId, onSaved }: { open: boolean; onClose: () => void; tripId: string; onSaved: (item?: Item) => void }) {
  const [text, setText] = useState("");
  const [section, setSection] = useState<"BEFORE_TRIP" | "PACKING">("PACKING");
  const [category, setCategory] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await api<{ item?: Item }>(`/api/trips/${tripId}/checklist`, { json: { text: text.trim(), section, category: category || undefined } });
      onClose();
      onSaved(res.item);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to add");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Add checklist item">
      <div className="space-y-4">
        <Field label="Item">
          <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Buy travel insurance" required />
        </Field>
        <Field label="Section">
          <Select value={section} onChange={(e) => setSection(e.target.value as "BEFORE_TRIP" | "PACKING")}>
            <option value="BEFORE_TRIP">Before trip</option>
            <option value="PACKING">Packing</option>
          </Select>
        </Field>
        <Field label="Category (optional)">
          <Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Documents, Electronics, Clothing" />
        </Field>
        {error && <p className="rounded-lg bg-danger/10 px-3 py-2 text-[13px] text-danger">{error}</p>}
        <Button onClick={save} loading={saving} className="w-full">Add item</Button>
      </div>
    </Modal>
  );
}