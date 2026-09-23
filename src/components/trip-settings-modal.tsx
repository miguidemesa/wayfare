"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, AlertTriangle, Calendar, Users, UserPlus, X, Copy, Check } from "lucide-react";
import { Badge, Button, Field, Input, Modal, Select, Textarea, toast } from "@/components/ui";
import { COVER_THEME_KEYS } from "@/components/covers";
import { CURRENCY_NAMES } from "@/lib/currency-meta";
import { api, ApiError } from "@/lib/client-api";

export type TripSettingsData = {
  id: string;
  title: string;
  subtitle: string | null;
  startDate: string | Date;
  endDate: string | Date;
  budgetAmount: number;
  homeCurrency: string;
  pace: string;
  status: string;
  notes: string | null;
  coverEmoji: string;
  coverTheme: string;
};

export type TravelerData = {
  id: string;
  name: string;
  email: string | null;
  isOwner: boolean;
};

export function TripSettingsModal({
  open,
  onClose,
  trip,
  travelers = [],
}: {
  open: boolean;
  onClose: () => void;
  trip: TripSettingsData;
  travelers?: TravelerData[];
}) {
  const router = useRouter();
  const [title, setTitle] = useState(trip.title);
  const [subtitle, setSubtitle] = useState(trip.subtitle ?? "");
  const [startDate, setStartDate] = useState(
    typeof trip.startDate === "string"
      ? trip.startDate.slice(0, 10)
      : trip.startDate.toISOString().slice(0, 10)
  );
  const [endDate, setEndDate] = useState(
    typeof trip.endDate === "string"
      ? trip.endDate.slice(0, 10)
      : trip.endDate.toISOString().slice(0, 10)
  );
  const [budget, setBudget] = useState(String(trip.budgetAmount || 0));
  const [homeCurrency, setHomeCurrency] = useState(trip.homeCurrency || "PHP");
  const [pace, setPace] = useState(trip.pace || "balanced");
  const [status, setStatus] = useState(trip.status || "PLANNING");
  const [notes, setNotes] = useState(trip.notes ?? "");
  const [coverEmoji, setCoverEmoji] = useState(trip.coverEmoji || "🌍");
  const [coverTheme, setCoverTheme] = useState(trip.coverTheme || "teal");

  const [travelerList, setTravelerList] = useState<TravelerData[]>(travelers);
  const [newTravelerName, setNewTravelerName] = useState("");
  const [newTravelerEmail, setNewTravelerEmail] = useState("");
  const [addingTraveler, setAddingTraveler] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  function handleCopyInviteLink() {
    if (typeof window === "undefined") return;
    const url = `${window.location.origin}/join/${trip.id}`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    toast.success("Invite link copied to clipboard");
    setTimeout(() => setCopiedLink(false), 2500);
  }

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAddTraveler(e: React.FormEvent) {
    e.preventDefault();
    if (!newTravelerName.trim()) return;
    setAddingTraveler(true);
    try {
      const res = await api<{ traveler: TravelerData }>(`/api/trips/${trip.id}/travelers`, {
        method: "POST",
        json: { name: newTravelerName.trim(), email: newTravelerEmail.trim() || undefined },
      });
      setTravelerList((prev) => [...prev, res.traveler]);
      setNewTravelerName("");
      setNewTravelerEmail("");
      toast.success(`Added ${res.traveler.name}`);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to add traveler");
    } finally {
      setAddingTraveler(false);
    }
  }

  async function handleRemoveTraveler(id: string, name: string) {
    try {
      await api(`/api/trips/${trip.id}/travelers?id=${id}`, { method: "DELETE" });
      setTravelerList((prev) => prev.filter((t) => t.id !== id));
      toast.info(`Removed ${name}`);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to remove traveler");
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await api(`/api/trips/${trip.id}`, {
        method: "PATCH",
        json: {
          title,
          subtitle: subtitle || null,
          startDate,
          endDate,
          budgetAmount: Number(budget) || 0,
          homeCurrency,
          pace,
          status,
          notes: notes || null,
          coverEmoji,
          coverTheme,
        },
      });
      toast.success("Trip settings saved");
      onClose();
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to update trip");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setError(null);
    setDeleting(true);
    try {
      await api(`/api/trips/${trip.id}`, { method: "DELETE" });
      toast.success("Trip deleted");
      router.push("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to delete trip");
      setDeleting(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Trip Settings" wide>
      <form onSubmit={handleSave} className="space-y-4">
        {error && (
          <div className="rounded-lg border border-danger/25 bg-danger/10 px-3 py-2 text-[13px] text-danger">
            {error}
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Trip Title">
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Tokyo & Kyoto"
              required
            />
          </Field>
          <Field label="Subtitle / Destinations">
            <Input
              value={subtitle}
              onChange={(e) => setSubtitle(e.target.value)}
              placeholder="e.g. Tokyo · Kyoto"
            />
          </Field>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Start Date">
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              required
            />
          </Field>
          <Field label="End Date">
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              required
            />
          </Field>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Total Budget">
            <Input
              type="number"
              min="0"
              step="any"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
            />
          </Field>
          <Field label="Home Currency">
            <Select
              value={homeCurrency}
              onChange={(e) => setHomeCurrency(e.target.value)}
            >
              {Object.keys(CURRENCY_NAMES).map((c) => (
                <option key={c} value={c}>
                  {c} — {CURRENCY_NAMES[c]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Trip Pace">
            <Select value={pace} onChange={(e) => setPace(e.target.value)}>
              <option value="relaxed">Relaxed (1-2 places/day)</option>
              <option value="balanced">Balanced (3-4 places/day)</option>
              <option value="packed">Packed (5+ places/day)</option>
            </Select>
          </Field>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Cover Emoji">
            <Input
              value={coverEmoji}
              onChange={(e) => setCoverEmoji(e.target.value)}
              maxLength={4}
            />
          </Field>
          <Field label="Cover Theme">
            <Select value={coverTheme} onChange={(e) => setCoverTheme(e.target.value)}>
              {COVER_THEME_KEYS.map((t) => (
                <option key={t} value={t}>
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Status Override">
            <Select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="PLANNING">Planning</option>
              <option value="UPCOMING">Upcoming</option>
              <option value="ACTIVE">Happening Now (Active)</option>
              <option value="COMPLETED">Completed</option>
            </Select>
          </Field>
        </div>

        <Field label="Trip Notes / Packing Reminders">
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Important notes, visa details, booking deadlines..."
            rows={2}
          />
        </Field>

        {/* Travelers & Companions Section */}
        <div className="rounded-xl border border-line bg-surface-2/40 p-3.5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-ink-3">
              <Users size={13} className="text-accent" />
              Travelers ({travelerList.length})
            </span>
            <button
              type="button"
              onClick={handleCopyInviteLink}
              className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline cursor-pointer"
            >
              {copiedLink ? <Check size={12} /> : <Copy size={12} />}
              {copiedLink ? "Link Copied!" : "Copy Invite Link"}
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            {travelerList.map((t) => (
              <span
                key={t.id}
                className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface py-1 pl-2.5 pr-1.5 text-xs font-medium"
              >
                <span>{t.name}</span>
                {t.isOwner ? (
                  <Badge tone="accent" className="text-[10px] py-0 px-1.5">
                    Owner
                  </Badge>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleRemoveTraveler(t.id, t.name)}
                    className="rounded-full p-0.5 text-ink-3 hover:bg-danger/10 hover:text-danger transition-colors cursor-pointer"
                    aria-label={`Remove ${t.name}`}
                  >
                    <X size={12} />
                  </button>
                )}
              </span>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Input
              value={newTravelerName}
              onChange={(e) => setNewTravelerName(e.target.value)}
              placeholder="Companion name"
              className="h-8 text-xs max-w-[150px]"
            />
            <Input
              value={newTravelerEmail}
              onChange={(e) => setNewTravelerEmail(e.target.value)}
              placeholder="Email (optional)"
              className="h-8 text-xs max-w-[180px]"
            />
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="h-8 text-xs"
              onClick={handleAddTraveler}
              loading={addingTraveler}
              disabled={!newTravelerName.trim()}
            >
              <UserPlus size={12} />
              Add
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
          <div className="flex items-center gap-2">
            <a
              href={`/api/trips/${trip.id}/calendar`}
              download
              className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface-2 px-3 py-1.5 text-xs font-semibold text-ink hover:bg-surface-3 transition-colors"
            >
              <Calendar size={13} className="text-accent" />
              Export .ics
            </a>
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-danger hover:bg-danger/10 transition-colors cursor-pointer"
            >
              <Trash2 size={13} />
              Delete Trip
            </button>
          </div>

          <div className="flex items-center gap-2">
            <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" variant="brand" loading={saving}>
              Save Changes
            </Button>
          </div>
        </div>
      </form>

      {/* Delete confirmation sub-modal */}
      <Modal
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Delete this trip?"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-xl border border-danger/25 bg-danger/10 p-3.5 text-[13px] text-danger">
            <AlertTriangle size={18} className="shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">This action cannot be undone.</p>
              <p className="mt-0.5 text-ink-2">
                All itinerary items, expenses, reservations, documents, and journal entries will be permanently removed.
              </p>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setConfirmDelete(false)}
              disabled={deleting}
            >
              Keep Trip
            </Button>
            <Button
              type="button"
              variant="danger"
              onClick={handleDelete}
              loading={deleting}
            >
              Delete Permanently
            </Button>
          </div>
        </div>
      </Modal>
    </Modal>
  );
}
