import { useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { addFlight, addHotel, addReservation, ApiError, deleteFlight, deleteHotel, deleteReservation } from "@/shared/api";
import { fmtDate, fmtDay, fmtMoney, GUTTER, space, useTheme } from "@/shared/theme";
import { dayKey, parseClock } from "@/shared/trip";
import { useTrip } from "@/lib/trip";
import { confirmDestructive } from "@/lib/confirm";
import { SubScreen } from "@/components/trip/SubScreen";
import { Button } from "@/components/ui/Button";
import { Choices, Empty, Field, Rule, SectionLabel } from "@/components/ui/Primitives";
import { RangeCalendar } from "@/components/ui/RangeCalendar";
import { T } from "@/components/ui/T";
import { useToast } from "@/components/ui/Toast";

export { ErrorFallback as ErrorBoundary } from "@/components/ErrorFallback";

type Kind = "stay" | "flight" | "reservation";
const KINDS: { key: Kind; label: string }[] = [
  { key: "stay", label: "Stay" },
  { key: "flight", label: "Flight" },
  { key: "reservation", label: "Reservation" },
];
const RES_TYPES = [
  { key: "RESTAURANT", label: "Table" },
  { key: "ACTIVITY", label: "Activity" },
  { key: "TOUR", label: "Tour" },
  { key: "TRAIN", label: "Train" },
  { key: "EVENT", label: "Event" },
];

const dateTime = (iso: string) =>
  `${fmtDate(iso, { weekday: "short", month: "short", day: "numeric" })}, ${new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;

export default function Bookings() {
  const { colors } = useTheme();
  const toast = useToast();
  const { tripId, bundle, reload } = useTrip();
  const [adding, setAdding] = useState(false);
  const [show, setShow] = useState<"all" | Kind>("all");

  if (!bundle) return <SubScreen title="Bookings">{null}</SubScreen>;
  const { hotels, flights, reservations, trip } = bundle;
  const none = !hotels.length && !flights.length && !reservations.length;

  function remove(kind: Kind, id: string, name: string) {
    confirmDestructive({
      title: `Remove “${name}”?`,
      confirm: "Remove",
      onConfirm: async () => {
        try {
          if (kind === "stay") await deleteHotel(tripId, id);
          else if (kind === "flight") await deleteFlight(tripId, id);
          else await deleteReservation(tripId, id);
          await reload();
          toast("Booking removed");
        } catch {
          toast("Couldn't remove it", "error");
        }
      },
    });
  }

  return (
    <SubScreen title="Bookings" scrollTopWhen={adding} intro="Where you're staying, how you're getting there, and anything reserved." right={!adding ? <Button variant="quiet" label="Add" onPress={() => setAdding(true)} /> : undefined}>
      {adding ? <AddBooking onDone={() => setAdding(false)} /> : null}

      {none && !adding ? (
        <View style={{ paddingHorizontal: GUTTER }}>
          <Empty title="No bookings yet" body="Keep confirmation numbers and times here so they're at hand when you need them." action="Add a booking" onAction={() => setAdding(true)} />
        </View>
      ) : null}

      {!none ? (
        <View style={{ paddingHorizontal: GUTTER, marginBottom: space.sm }}>
          <Choices
            options={[
              { key: "all" as const, label: "All" },
              { key: "stay" as const, label: `Stays ${hotels.length}` },
              { key: "flight" as const, label: `Flights ${flights.length}` },
              { key: "reservation" as const, label: `Reservations ${reservations.length}` },
            ]}
            value={show}
            onChange={setShow}
          />
        </View>
      ) : null}

      {hotels.length && (show === "all" || show === "stay") ? (
        <Section title="Stays">
          {hotels.map((h) => (
            <Item
              key={h.id}
              title={h.name}
              lines={[
                `${fmtDay(h.checkIn, { weekday: "short", month: "short", day: "numeric" })} → ${fmtDay(h.checkOut, { weekday: "short", month: "short", day: "numeric" })} · ${h.nights} ${h.nights === 1 ? "night" : "nights"}`,
                h.address,
                [h.confirmationNumber ? `Confirmation ${h.confirmationNumber}` : null, h.costPerNight ? `${fmtMoney(h.costPerNight, h.currency)} a night` : null].filter(Boolean).join(" · ") || null,
                h.phone,
              ]}
              onRemove={() => remove("stay", h.id, h.name)}
            />
          ))}
        </Section>
      ) : null}

      {flights.length && (show === "all" || show === "flight") ? (
        <Section title="Flights">
          {flights.map((f) => (
            <Item
              key={f.id}
              title={`${f.originCode || f.originCity} → ${f.destCode || f.destCity}`}
              lines={[
                [f.airline, f.flightNumber].filter(Boolean).join(" "),
                `Departs ${dateTime(f.departAt)}`,
                `Arrives ${dateTime(f.arriveAt)}`,
                [f.terminal ? `Terminal ${f.terminal}` : null, f.gate ? `Gate ${f.gate}` : null, f.seat ? `Seat ${f.seat}` : null].filter(Boolean).join(" · ") || null,
                f.confirmation ? `Confirmation ${f.confirmation}` : null,
              ]}
              onRemove={() => remove("flight", f.id, `${f.airline} ${f.flightNumber}`.trim())}
            />
          ))}
        </Section>
      ) : null}

      {reservations.length && (show === "all" || show === "reservation") ? (
        <Section title="Reservations">
          {reservations.map((r) => (
            <Item
              key={r.id}
              title={r.title}
              lines={[
                dateTime(r.dateTime),
                r.locationName,
                [r.confirmationNumber ? `Confirmation ${r.confirmationNumber}` : null, r.cost ? fmtMoney(r.cost, r.currency || trip.homeCurrency) : null].filter(Boolean).join(" · ") || null,
                r.cancellationDeadline ? `Free cancellation until ${dateTime(r.cancellationDeadline)}` : null,
                r.notes,
              ]}
              onRemove={() => remove("reservation", r.id, r.title)}
            />
          ))}
        </Section>
      ) : null}
      <View style={{ height: 1, backgroundColor: colors.paper }} />
    </SubScreen>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ marginTop: space.lg }}>
      <SectionLabel style={{ paddingHorizontal: GUTTER }}>{title}</SectionLabel>
      <Rule style={{ marginHorizontal: GUTTER }} />
      {children}
    </View>
  );
}

function Item({ title, lines, onRemove }: { title: string; lines: (string | null | undefined)[]; onRemove: () => void }) {
  const { colors } = useTheme();
  return (
    <View style={{ paddingHorizontal: GUTTER, paddingVertical: space.md, borderBottomWidth: 1, borderBottomColor: colors.rule }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
        <T v="entry" style={{ flex: 1 }} selectable>
          {title}
        </T>
        <Pressable onPress={onRemove} accessibilityRole="button" accessibilityLabel={`Remove ${title}`} hitSlop={14}>
          <T v="small" c="ink3">
            Remove
          </T>
        </Pressable>
      </View>
      {lines.filter(Boolean).map((l, i) => (
        <T key={i} v="meta" c={i === 0 ? "ink" : "ink2"} num selectable style={{ marginTop: 3 }}>
          {l}
        </T>
      ))}
    </View>
  );
}

/** Pick a trip day (or any date via the calendar) and a time. */
function DayTime({ label, day, time, onDay, onTime, error }: { label: string; day: string | null; time: string; onDay: (k: string) => void; onTime: (t: string) => void; error?: string }) {
  const { bundle } = useTrip();
  const [other, setOther] = useState(false);
  const options = (bundle?.days ?? []).map((d, i) => ({ key: dayKey(d.date), label: `Day ${i + 1} · ${fmtDay(d.date, { month: "short", day: "numeric" })}` }));
  return (
    <View style={{ gap: 8 }}>
      <T v="label" c="ink3">
        {label}
      </T>
      {other || !options.length ? (
        <RangeCalendar start={day} end={null} onChange={(s) => s && onDay(s)} />
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <Choices options={options} value={day} onChange={onDay} wrap={false} />
        </ScrollView>
      )}
      {options.length ? (
        <Pressable onPress={() => setOther(!other)} hitSlop={8} accessibilityRole="button">
          <T v="small" c="accent">
            {other ? "Pick a trip day instead" : "A date outside the trip"}
          </T>
        </Pressable>
      ) : null}
      <Field value={time} onChangeText={onTime} placeholder="14:30" numeric accessibilityLabel={`${label} time`} error={error} />
    </View>
  );
}

function AddBooking({ onDone }: { onDone: () => void }) {
  const { colors } = useTheme();
  const toast = useToast();
  const { tripId, bundle, reload } = useTrip();
  const trip = bundle!.trip;
  const [kind, setKind] = useState<Kind>("stay");
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [cost, setCost] = useState("");
  const [checkIn, setCheckIn] = useState<string | null>(dayKey(trip.startDate));
  const [checkOut, setCheckOut] = useState<string | null>(dayKey(trip.endDate));
  const [flightNo, setFlightNo] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [seat, setSeat] = useState("");
  const [departDay, setDepartDay] = useState<string | null>(dayKey(trip.startDate));
  const [departTime, setDepartTime] = useState("");
  const [arriveDay, setArriveDay] = useState<string | null>(dayKey(trip.startDate));
  const [arriveTime, setArriveTime] = useState("");
  const [resType, setResType] = useState("RESTAURANT");
  const [resDay, setResDay] = useState<string | null>(dayKey(trip.startDate));
  const [resTime, setResTime] = useState("19:00");
  const [notes, setNotes] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const at = (day: string, time: string) => new Date(`${day}T${time.padStart(5, "0")}:00`).toISOString();

  async function save() {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = kind === "flight" ? "Which airline?" : "Give it a name.";
    const costNum = cost.trim() ? Number(cost) : undefined;
    if (costNum != null && (!Number.isFinite(costNum) || costNum < 0)) e.cost = "A number, or leave empty.";
    if (kind === "stay" && (!checkIn || !checkOut)) e.dates = "Pick check-in, then check-out.";
    if (kind === "flight") {
      if (!departDay || parseClock(departTime) == null) e.depart = "Pick a day and a 24-hour time.";
      if (!arriveDay || parseClock(arriveTime) == null) e.arrive = "Pick a day and a 24-hour time.";
    }
    if (kind === "reservation" && (!resDay || parseClock(resTime) == null)) e.res = "Pick a day and a 24-hour time.";
    setErrors(e);
    if (Object.keys(e).length) return;

    setSaving(true);
    try {
      if (kind === "stay") {
        await addHotel(tripId, {
          name: name.trim(),
          address: address.trim() || undefined,
          checkIn: checkIn!,
          checkOut: checkOut!,
          confirmationNumber: confirmation.trim() || undefined,
          costPerNight: costNum,
          currency: trip.homeCurrency,
        });
      } else if (kind === "flight") {
        await addFlight(tripId, {
          airline: name.trim(),
          flightNumber: flightNo.trim() || undefined,
          originCode: from.trim().toUpperCase() || undefined,
          originCity: from.trim() || undefined,
          destCode: to.trim().toUpperCase() || undefined,
          destCity: to.trim() || undefined,
          departAt: at(departDay!, departTime),
          arriveAt: at(arriveDay!, arriveTime),
          seat: seat.trim() || undefined,
          confirmation: confirmation.trim() || undefined,
          price: costNum,
          currency: trip.homeCurrency,
        });
      } else {
        await addReservation(tripId, {
          type: resType,
          title: name.trim(),
          dateTime: at(resDay!, resTime),
          locationName: address.trim() || undefined,
          confirmationNumber: confirmation.trim() || undefined,
          cost: costNum,
          currency: trip.homeCurrency,
          notes: notes.trim() || undefined,
        });
      }
      await reload();
      toast("Booking saved");
      onDone();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "Couldn't save the booking", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={{ marginHorizontal: GUTTER, marginBottom: space.xl, padding: space.lg, gap: space.lg, borderWidth: 1, borderColor: colors.rule, borderRadius: 8, backgroundColor: colors.raised }}>
      <Choices options={KINDS} value={kind} onChange={setKind} />
      <Field label={kind === "flight" ? "Airline" : kind === "stay" ? "Hotel or place" : "What"} value={name} onChangeText={setName} error={errors.name} placeholder={kind === "flight" ? "ANA" : kind === "stay" ? "Hotel Kanra Kyoto" : "Dinner at Kikunoi"} />

      {kind === "stay" ? (
        <>
          <View style={{ gap: 8 }}>
            <T v="label" c="ink3">
              Check-in → check-out
            </T>
            <RangeCalendar start={checkIn} end={checkOut} onChange={(s, e) => { setCheckIn(s); setCheckOut(e); }} />
            {errors.dates ? <T v="small" c="danger">{errors.dates}</T> : null}
          </View>
          <Field label="Address" value={address} onChangeText={setAddress} placeholder="Optional" />
        </>
      ) : null}

      {kind === "flight" ? (
        <>
          <View style={{ flexDirection: "row", gap: space.md }}>
            <View style={{ flex: 1 }}>
              <Field label="From" value={from} onChangeText={setFrom} placeholder="MNL" autoCapitalize="characters" />
            </View>
            <View style={{ flex: 1 }}>
              <Field label="To" value={to} onChangeText={setTo} placeholder="KIX" autoCapitalize="characters" />
            </View>
          </View>
          <Field label="Flight number" value={flightNo} onChangeText={setFlightNo} placeholder="NH 820" autoCapitalize="characters" />
          <DayTime label="Departs" day={departDay} time={departTime} onDay={setDepartDay} onTime={setDepartTime} error={errors.depart} />
          <DayTime label="Arrives" day={arriveDay} time={arriveTime} onDay={setArriveDay} onTime={setArriveTime} error={errors.arrive} />
          <Field label="Seat" value={seat} onChangeText={setSeat} placeholder="Optional" autoCapitalize="characters" />
        </>
      ) : null}

      {kind === "reservation" ? (
        <>
          <Choices options={RES_TYPES} value={resType} onChange={setResType} />
          <DayTime label="When" day={resDay} time={resTime} onDay={setResDay} onTime={setResTime} error={errors.res} />
          <Field label="Where" value={address} onChangeText={setAddress} placeholder="Optional" />
          <Field label="Notes" value={notes} onChangeText={setNotes} placeholder="Optional" />
        </>
      ) : null}

      <Field label="Confirmation number" value={confirmation} onChangeText={setConfirmation} placeholder="Optional" autoCapitalize="characters" />
      <Field label={`${kind === "stay" ? "Cost per night" : "Cost"} (${trip.homeCurrency})`} value={cost} onChangeText={setCost} keyboardType="decimal-pad" numeric placeholder="Optional" error={errors.cost} />

      <View style={{ flexDirection: "row", gap: space.md }}>
        <Button label="Save" loading={saving} onPress={save} style={{ flex: 1 }} />
        <Button variant="secondary" label="Cancel" onPress={onDone} />
      </View>
    </View>
  );
}
