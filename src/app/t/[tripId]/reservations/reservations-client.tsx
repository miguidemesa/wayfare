"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Calendar,
  Clock,
  Edit,
  MapPin,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import type { TripBundle } from "@/lib/trip-service";
import { Badge, Button, Card, EmptyState, Field, Input, Modal, Select } from "@/components/ui";
import { cn, fmtMoney, fmtTime12 } from "@/lib/utils";
import { api, ApiError } from "@/lib/client-api";

const TYPE_ICON: Record<string, string> = {
  FLIGHT: "✈️",
  HOTEL: "🏨",
  RESTAURANT: "🍽️",
  ACTIVITY: "🎟️",
  TRAIN: "🚆",
  TOUR: "🗺️",
  EVENT: "🎭",
};

export function ReservationsClient({ tripId, bundle }: { tripId: string; bundle: TripBundle }) {
  const router = useRouter();
  const { reservations } = bundle;
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<typeof reservations[0] | null>(null);
  const [filter, setFilter] = useState<"all" | "upcoming" | "past">("upcoming");

  const now = new Date();
  const filtered = reservations
    .filter((r) => {
      if (filter === "all") return true;
      return filter === "upcoming" ? r.dateTime >= now : r.dateTime < now;
    })
    .sort((a, b) => a.dateTime.getTime() - b.dateTime.getTime());

  async function deleteReservation(id: string) {
    try {
      await api(`/api/trips/${tripId}/reservations?id=${id}`, { method: "DELETE" });
      router.refresh();
    } catch {}
  }

  return (
    <div className="mx-auto max-w-4xl px-4 pb-24 pt-5 sm:px-6">
      <div className="mb-5 flex items-center justify-between gap-3 animate-fade-up">
        <div>
          <h1 className="font-display text-3xl tracking-tight">Reservations</h1>
          <p className="mt-0.5 text-[13px] text-ink-3">
            {reservations.filter((r) => r.dateTime >= now).length} upcoming, {reservations.filter((r) => r.dateTime < now).length} past
          </p>
        </div>
        <Button onClick={() => setAddOpen(true)}>
          <Plus size={15} /> Add reservation
        </Button>
      </div>

      <div className="mb-4 flex gap-2">
        {(["all", "upcoming", "past"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              "rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors",
              filter === f
                ? "bg-accent-soft/50 text-accent-strong border border-accent/30"
                : "text-ink-3 hover:text-ink hover:bg-surface-2"
            )}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          emoji="📋"
          title={filter === "upcoming" ? "Nothing booked ahead" : "No reservations yet"}
          description={filter === "upcoming" ? "Add a restaurant, tour, or train booking to stay organized." : "Start adding your confirmations."}
          action={<Button onClick={() => setAddOpen(true)}><Plus size={15} /> Add your first reservation</Button>}
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((r) => (
            <Card key={r.id} className="overflow-hidden transition-colors hover:bg-surface-2/60">
              <div className="flex items-center gap-3 p-4">
                <span className="grid h-12 w-12 place-items-center rounded-xl bg-surface-2 text-xl">{TYPE_ICON[r.type] ?? "📌"}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <h3 className="font-semibold truncate">{r.title}</h3>
                    <Badge tone={r.dateTime < now ? "neutral" : "accent"} className="shrink-0">
                      {r.dateTime < now ? "Past" : "Upcoming"}
                    </Badge>
                  </div>
                  <p className="mt-1 flex flex-wrap items-center gap-x-3 text-[13px] text-ink-2">
                    <span className="flex items-center gap-1">
                      <Calendar size={11} />
                      {r.dateTime.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock size={11} />
                      {fmtTime12(r.dateTime.getHours() * 60 + r.dateTime.getMinutes())}
                    </span>
                    {r.locationName && (
                      <span className="flex items-center gap-1">
                        <MapPin size={11} className="text-accent" />
                        <span className="truncate">{r.locationName}</span>
                      </span>
                    )}
                  </p>
                  {r.confirmationNumber && (
                    <p className="mt-1 text-xs text-ink-3">
                      Confirmation: <span className="tabular font-medium text-ink-2">{r.confirmationNumber}</span>
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 p-4 pr-2">
                  {r.cost && (
                    <span className="tabular text-sm font-semibold mr-auto">
                      {fmtMoney(r.cost, r.currency ?? "JPY")}
                    </span>
                  )}
                  {r.cancellationDeadline && r.cancellationDeadline > now && (
                    <Badge tone="warning" className="mr-auto">
                      <X size={10} className="mr-0.5" /> Cancels {r.cancellationDeadline.toLocaleDateString()}
                    </Badge>
                  )}
                  <Button variant="ghost" size="icon" onClick={() => setEditing(r)}>
                    <Edit size={15} />
                  </Button>
                  <Button variant="danger" size="icon" onClick={() => deleteReservation(r.id)}>
                    <Trash2 size={15} />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <AddReservationModal open={addOpen} onClose={() => setAddOpen(false)} tripId={tripId} onSaved={() => router.refresh()} />
      <EditReservationModal reservation={editing} onClose={() => setEditing(null)} tripId={tripId} onSaved={() => router.refresh()} />
    </div>
  );
}

function AddReservationModal({ open, onClose, tripId, onSaved }: { open: boolean; onClose: () => void; tripId: string; onSaved: () => void }) {
  const [title, setTitle] = useState("");
  const [type, setType] = useState("RESTAURANT");
  const [dateTime, setDateTime] = useState("");
  const [confirmationNumber, setConfirmationNumber] = useState("");
  const [locationName, setLocationName] = useState("");
  const [cost, setCost] = useState("");
  const [currency, setCurrency] = useState("JPY");
  const [cancellationDeadline, setCancellationDeadline] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await api(`/api/trips/${tripId}/reservations`, {
        json: {
          title: title.trim(),
          type,
          dateTime: new Date(dateTime).toISOString(),
          confirmationNumber: confirmationNumber.trim() || null,
          locationName: locationName.trim() || null,
          cost: Number(cost) || null,
          currency,
          cancellationDeadline: cancellationDeadline ? new Date(cancellationDeadline).toISOString() : null,
        },
      });
      onClose();
      onSaved();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to add");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Add reservation" wide>
      <div className="space-y-4">
        <Field label="Title"><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Dinner at Gonpachi" required /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Type">
            <Select value={type} onChange={(e) => setType(e.target.value)}>
              {["FLIGHT", "HOTEL", "RESTAURANT", "ACTIVITY", "TRAIN", "TOUR", "EVENT"].map((t) => <option key={t} value={t}>{t}</option>)}
            </Select>
          </Field>
          <Field label="Date & time">
            <Input type="datetime-local" value={dateTime} onChange={(e) => setDateTime(e.target.value)} required />
          </Field>
        </div>
        <Field label="Location name"><Input value={locationName} onChange={(e) => setLocationName(e.target.value)} placeholder="Gonpachi Nishi-Azabu" /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Cost (optional)">
            <Input type="number" min={0} value={cost} onChange={(e) => setCost(e.target.value)} placeholder="0" />
          </Field>
          <Field label="Currency">
            <Select value={currency} onChange={(e) => setCurrency(e.target.value)}>
              {["JPY", "PHP", "USD", "EUR", "KRW"].map((c) => <option key={c}>{c}</option>)}
            </Select>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Confirmation #"><Input value={confirmationNumber} onChange={(e) => setConfirmationNumber(e.target.value)} placeholder="GNP77341" /></Field>
          <Field label="Cancellation deadline (optional)">
            <Input type="date" value={cancellationDeadline} onChange={(e) => setCancellationDeadline(e.target.value)} />
          </Field>
        </div>
        {error && <p className="rounded-lg bg-danger/10 px-3 py-2 text-[13px] text-danger">{error}</p>}
        <Button onClick={save} loading={saving} className="w-full">Add reservation</Button>
      </div>
    </Modal>
  );
}

function EditReservationModal({ reservation, onClose, tripId, onSaved }: { reservation: TripBundle["reservations"][number] | null; onClose: () => void; tripId: string; onSaved: () => void }) {
  const [title, setTitle] = useState("");
  const [type, setType] = useState("RESTAURANT");
  const [dateTime, setDateTime] = useState("");
  const [confirmationNumber, setConfirmationNumber] = useState("");
  const [locationName, setLocationName] = useState("");
  const [cost, setCost] = useState("");
  const [currency, setCurrency] = useState("JPY");
  const [cancellationDeadline, setCancellationDeadline] = useState("");
  const [saving, setSaving] = useState(false);
  const initializedFor = useRef<string | null>(null);

  if (reservation && initializedFor.current !== reservation.id) {
    initializedFor.current = reservation.id;
    setTitle(reservation.title);
    setType(reservation.type);
    setDateTime(reservation.dateTime.toISOString().slice(0, 16));
    setConfirmationNumber(reservation.confirmationNumber ?? "");
    setLocationName(reservation.locationName ?? "");
    setCost(reservation.cost != null ? String(reservation.cost) : "");
    setCurrency(reservation.currency ?? "JPY");
    setCancellationDeadline(reservation.cancellationDeadline ? new Date(reservation.cancellationDeadline).toISOString().slice(0, 10) : "");
  }

  async function save() {
    if (!reservation) return;
    setSaving(true);
    try {
      await api(`/api/trips/${tripId}/reservations`, {
        method: "PATCH",
        json: {
          id: reservation.id,
          title: title.trim(),
          type,
          dateTime: new Date(dateTime).toISOString(),
          confirmationNumber: confirmationNumber.trim() || null,
          locationName: locationName.trim() || null,
          cost: Number(cost) || null,
          currency,
          cancellationDeadline: cancellationDeadline ? new Date(cancellationDeadline).toISOString() : null,
        },
      });
      onClose();
      onSaved();
    } catch {} finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!reservation) return;
    setSaving(true);
    await api(`/api/trips/${tripId}/reservations?id=${reservation.id}`, { method: "DELETE" }).catch(() => {});
    setSaving(false);
    onClose();
    onSaved();
  }

  return (
    <Modal open={!!reservation} onClose={onClose} title="Edit reservation">
      <div className="space-y-4">
        <Field label="Title"><Input value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Type"><Select value={type} onChange={(e) => setType(e.target.value)}>{["FLIGHT", "HOTEL", "RESTAURANT", "ACTIVITY", "TRAIN", "TOUR", "EVENT"].map((t) => <option key={t} value={t}>{t}</option>)}</Select></Field>
          <Field label="Date & time"><Input type="datetime-local" value={dateTime} onChange={(e) => setDateTime(e.target.value)} /></Field>
        </div>
        <Field label="Location name"><Input value={locationName} onChange={(e) => setLocationName(e.target.value)} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Cost"><Input type="number" min={0} value={cost} onChange={(e) => setCost(e.target.value)} /></Field>
          <Field label="Currency"><Select value={currency} onChange={(e) => setCurrency(e.target.value)}>{["JPY", "PHP", "USD", "EUR", "KRW"].map((c) => <option key={c}>{c}</option>)}</Select></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Confirmation #"><Input value={confirmationNumber} onChange={(e) => setConfirmationNumber(e.target.value)} /></Field>
          <Field label="Cancellation deadline"><Input type="date" value={cancellationDeadline} onChange={(e) => setCancellationDeadline(e.target.value)} /></Field>
        </div>
        <div className="flex gap-2">
          <Button loading={saving} onClick={save} className="flex-1">Save</Button>
          <Button variant="danger" onClick={remove}><Trash2 size={15} /></Button>
        </div>
      </div>
    </Modal>
  );
}