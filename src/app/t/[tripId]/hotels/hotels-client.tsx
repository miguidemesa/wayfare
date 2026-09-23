"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BedDouble,
  Edit,
  MapPin,
  Plane,
  Plus,
  Trash2,
} from "lucide-react";
import type { TripBundle } from "@/lib/trip-service";
import { Badge, Button, Card, EmptyState, Field, Input, Modal, Select } from "@/components/ui";
import { CoverThumb } from "@/components/covers";
import { fmtMoney } from "@/lib/utils";
import { api, ApiError } from "@/lib/client-api";

export function HotelsClient({ tripId, bundle }: { tripId: string; bundle: TripBundle }) {
  const router = useRouter();
  const { trip, hotels, destinations } = bundle;
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<typeof hotels[0] | null>(null);

  async function deleteHotel(id: string) {
    try {
      await api(`/api/trips/${tripId}/hotels?id=${id}`, { method: "DELETE" });
      router.refresh();
    } catch {}
  }

  return (
    <div className="mx-auto max-w-5xl px-4 pb-24 pt-5 sm:px-6">
      <div className="mb-5 flex items-center justify-between gap-3 animate-fade-up">
        <div>
          <h1 className="font-display text-3xl tracking-tight">Stays & flights</h1>
          <p className="mt-0.5 text-[13px] text-ink-3">
            {hotels.length} hotel{hotels.length !== 1 ? "s" : ""}, {destinations.length} destination{destinations.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Button onClick={() => setAddOpen(true)}>
          <Plus size={15} /> Add hotel
        </Button>
      </div>

      {hotels.length === 0 ? (
        <EmptyState
          emoji="🏨"
          title="No hotels yet"
          description="Add your accommodation — we'll show nearby places and transit on the map."
          action={<Button onClick={() => setAddOpen(true)}><Plus size={15} /> Add your first hotel</Button>}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {hotels.map((hotel) => (
            <Card key={hotel.id} className="overflow-hidden animate-fade-up">
              <CoverThumb theme={trip.coverTheme} emoji={trip.coverEmoji} className="h-40 w-full" />
              <div className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-3">
                      {hotel.destinationName ?? "Trip"}
                    </p>
                    <h3 className="font-display text-xl leading-snug tracking-tight">{hotel.name}</h3>
                  </div>
                  <div className="flex gap-1.5">
                    <Button variant="ghost" size="icon" onClick={() => setEditing(hotel)}>
                      <Edit size={15} />
                    </Button>
                    <Button variant="danger" size="icon" onClick={() => deleteHotel(hotel.id)}>
                      <Trash2 size={15} />
                    </Button>
                  </div>
                </div>

                {hotel.address && (
                  <p className="mt-2 flex items-center gap-1.5 text-[13px] text-ink-2">
                    <MapPin size={13} className="shrink-0 text-accent" />
                    <span className="truncate">{hotel.address}</span>
                  </p>
                )}

                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-ink-2">
                  <span className="flex items-center gap-1">
                    <BedDouble size={11} /> {hotel.nights} night{hotel.nights !== 1 ? "s" : ""}
                  </span>
                  <span className="flex items-center gap-1">
                    <MapPin size={11} className="text-accent" />
                    Check-in {new Date(hotel.checkIn).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </span>
                  <span className="flex items-center gap-1">
                    <Plane size={11} /> Check-out {new Date(hotel.checkOut).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </span>
                </div>

                {hotel.confirmationNumber && (
                  <p className="mt-3 text-xs text-ink-3">
                    Confirmation: <span className="tabular font-medium text-ink-2">{hotel.confirmationNumber}</span>
                  </p>
                )}

                <div className="mt-3 flex items-center justify-between">
                  <p className="tabular text-sm font-semibold">
                    {fmtMoney(hotel.costPerNight * hotel.nights, hotel.currency)} total
                  </p>
                  <Badge tone="accent">{hotel.costPerNight.toLocaleString()} {hotel.currency}/night</Badge>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <AddHotelModal open={addOpen} onClose={() => setAddOpen(false)} tripId={tripId} defaultCity={destinations[0]?.name} onSaved={() => router.refresh()} />
      <EditHotelModal hotel={editing} onClose={() => setEditing(null)} tripId={tripId} onSaved={() => router.refresh()} />
    </div>
  );
}

function AddHotelModal({ open, onClose, tripId, defaultCity, onSaved }: { open: boolean; onClose: () => void; tripId: string; defaultCity?: string; onSaved: () => void }) {
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [confirmationNumber, setConfirmationNumber] = useState("");
  const [phone, setPhone] = useState("");
  const [costPerNight, setCostPerNight] = useState("");
  const [currency, setCurrency] = useState("JPY");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await api(`/api/trips/${tripId}/hotels`, {
        json: {
          name: name.trim(),
          destinationName: defaultCity,
          address: address.trim() || null,
          checkIn,
          checkOut,
          confirmationNumber: confirmationNumber.trim() || null,
          phone: phone.trim() || null,
          costPerNight: Number(costPerNight) || 0,
          currency,
        },
      });
      onClose();
      onSaved();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to add hotel");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Add hotel" wide>
      <div className="space-y-4">
        <Field label="Hotel name">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Hotel Kanra Kyoto" required />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Check-in">
            <Input type="date" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} required />
          </Field>
          <Field label="Check-out">
            <Input type="date" value={checkOut} onChange={(e) => setCheckOut(e.target.value)} required />
          </Field>
        </div>
        <Field label="Address">
          <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="190 Kitamachi, Shimogyo Ward, Kyoto" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Cost per night">
            <Input type="number" min={0} value={costPerNight} onChange={(e) => setCostPerNight(e.target.value)} placeholder="26000" />
          </Field>
          <Field label="Currency">
            <Select value={currency} onChange={(e) => setCurrency(e.target.value)}>
              {["JPY", "PHP", "USD", "EUR", "KRW"].map((c) => <option key={c}>{c}</option>)}
            </Select>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Confirmation #">
            <Input value={confirmationNumber} onChange={(e) => setConfirmationNumber(e.target.value)} placeholder="KNR-44107-KY" />
          </Field>
          <Field label="Phone">
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+81 75-344-3815" />
          </Field>
        </div>
        {error && <p className="rounded-lg bg-danger/10 px-3 py-2 text-[13px] text-danger">{error}</p>}
        <Button onClick={save} loading={saving} className="w-full">Save hotel</Button>
      </div>
    </Modal>
  );
}

function EditHotelModal({ hotel, onClose, tripId, onSaved }: { hotel: TripBundle["hotels"][number] | null; onClose: () => void; tripId: string; onSaved: () => void }) {
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [confirmationNumber, setConfirmationNumber] = useState("");
  const [phone, setPhone] = useState("");
  const [costPerNight, setCostPerNight] = useState("");
  const [saving, setSaving] = useState(false);
  const initializedFor = useRef<string | null>(null);

  if (hotel && initializedFor.current !== hotel.id) {
    initializedFor.current = hotel.id;
    setName(hotel.name);
    setAddress(hotel.address ?? "");
    setCheckIn(hotel.checkIn.toISOString().slice(0, 10));
    setCheckOut(hotel.checkOut.toISOString().slice(0, 10));
    setConfirmationNumber(hotel.confirmationNumber ?? "");
    setPhone(hotel.phone ?? "");
    setCostPerNight(String(hotel.costPerNight));
  }

  async function save() {
    if (!hotel) return;
    setSaving(true);
    try {
      await api(`/api/trips/${tripId}/hotels`, {
        method: "PATCH",
        json: {
          id: hotel.id,
          name: name.trim(),
          address: address.trim() || null,
          checkIn,
          checkOut,
          confirmationNumber: confirmationNumber.trim() || null,
          phone: phone.trim() || null,
          costPerNight: Number(costPerNight) || 0,
        },
      });
      onClose();
      onSaved();
    } catch {} finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!hotel) return;
    setSaving(true);
    await api(`/api/trips/${tripId}/hotels?id=${hotel.id}`, { method: "DELETE" }).catch(() => {});
    setSaving(false);
    onClose();
    onSaved();
  }

  return (
    <Modal open={!!hotel} onClose={onClose} title="Edit hotel">
      <div className="space-y-4">
        <Field label="Hotel name"><Input value={name} onChange={(e) => setName(e.target.value)} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Check-in"><Input type="date" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} /></Field>
          <Field label="Check-out"><Input type="date" value={checkOut} onChange={(e) => setCheckOut(e.target.value)} /></Field>
        </div>
        <Field label="Address"><Input value={address} onChange={(e) => setAddress(e.target.value)} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Cost per night"><Input type="number" min={0} value={costPerNight} onChange={(e) => setCostPerNight(e.target.value)} /></Field>
          <Field label="Confirmation #"><Input value={confirmationNumber} onChange={(e) => setConfirmationNumber(e.target.value)} /></Field>
        </div>
        <Field label="Phone"><Input value={phone} onChange={(e) => setPhone(e.target.value)} /></Field>
        <div className="flex gap-2">
          <Button loading={saving} onClick={save} className="flex-1">Save</Button>
          <Button variant="danger" onClick={remove}><Trash2 size={15} /></Button>
        </div>
      </div>
    </Modal>
  );
}

