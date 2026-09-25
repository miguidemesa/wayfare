import { Pressable, View } from "react-native";
import { router, type Href } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { ApiError, deleteTrip } from "@/shared/api";
import { fmtDay, fmtMoney, GUTTER, space, useTheme } from "@/shared/theme";
import { tripPhase } from "@/shared/trip";
import { useTrip } from "@/lib/trip";
import { confirmDestructive } from "@/lib/confirm";
import { SubScreen } from "@/components/trip/SubScreen";
import { Pair, Rule, SectionLabel } from "@/components/ui/Primitives";
import { T } from "@/components/ui/T";
import { useToast } from "@/components/ui/Toast";

export { ErrorFallback as ErrorBoundary } from "@/components/ErrorFallback";

// The trip's index: everything that isn't Plan, Map or Spend lives one tap
// from here, so the tab bar stays about the three things you do daily.
export default function TripDetails() {
  const { bundle, tripId } = useTrip();
  const toast = useToast();

  return (
    <SubScreen title={bundle?.trip.title ?? "Trip"} backLabel="Plan" fallback={`/trips/${tripId}`}>
      {bundle ? <Contents onDeleteError={(m) => toast(m, "error")} /> : null}
    </SubScreen>
  );
}

function Contents({ onDeleteError }: { onDeleteError: (m: string) => void }) {
  const { bundle, tripId } = useTrip();
  if (!bundle) return null;
  const { trip, destinations, hotels, flights, reservations, documents, checklist, savedPlaces, journal, travelers } = bundle;
  const packed = checklist.filter((c) => c.checked).length;
  const phase = tripPhase(trip.startDate, trip.endDate);
  let interests: string[] = [];
  try {
    interests = JSON.parse(trip.interests || "[]");
  } catch {}

  const bookingBits = [
    hotels.length ? `${hotels.length} ${hotels.length === 1 ? "stay" : "stays"}` : null,
    flights.length ? `${flights.length} ${flights.length === 1 ? "flight" : "flights"}` : null,
    reservations.length ? `${reservations.length} ${reservations.length === 1 ? "reservation" : "reservations"}` : null,
  ].filter(Boolean);

  function remove() {
    confirmDestructive({
      title: `Delete “${trip.title}”?`,
      message: "Its plan, expenses, bookings and notes are deleted with it. This can't be undone.",
      confirm: "Delete trip",
      onConfirm: async () => {
        try {
          await deleteTrip(tripId);
          router.dismissTo("/trips");
        } catch (e) {
          onDeleteError(e instanceof ApiError ? e.message : "Couldn't delete the trip.");
        }
      },
    });
  }

  return (
    <View>
      <View style={{ paddingHorizontal: GUTTER }}>
        <Pair label="Where" value={destinations.map((d) => [d.name, d.country].filter(Boolean).join(", ")).join(" · ") || "—"} />
        <Pair label="When" value={`${fmtDay(trip.startDate, { month: "short", day: "numeric" })} – ${fmtDay(trip.endDate, { month: "short", day: "numeric", year: "numeric" })}`} />
        <Pair label="Travellers" value={travelers.length ? travelers.map((t) => t.name).join(", ") : String(trip.travelersCount)} />
        <Pair label="Budget" value={trip.budgetAmount > 0 ? fmtMoney(trip.budgetAmount, trip.homeCurrency) : "Not set"} />
        <Pair label="Pace" value={trip.pace ? trip.pace[0].toUpperCase() + trip.pace.slice(1) : "Balanced"} />
        {interests.length ? <Pair label="Interests" value={interests.join(", ")} /> : null}
      </View>

      <SectionLabel style={{ paddingHorizontal: GUTTER, marginTop: space.xl }}>In this trip</SectionLabel>
      <Rule style={{ marginHorizontal: GUTTER }} />
      <IndexRow icon="bed-outline" label="Bookings" detail={bookingBits.join(" · ") || "Stays, flights and reservations"} href={`/trips/${tripId}/bookings`} />
      <IndexRow icon="document-text-outline" label="Documents" detail={documents.length ? `${documents.length} saved` : "Passport, insurance, tickets"} href={`/trips/${tripId}/documents`} />
      <IndexRow icon="checkbox-outline" label="Packing & to-dos" detail={checklist.length ? `${packed} of ${checklist.length} done` : "Lists for before you go"} href={`/trips/${tripId}/packing`} />
      <IndexRow icon="bookmark-outline" label="Places" detail={savedPlaces.length ? `${savedPlaces.length} saved` : "Find and save places to go"} href={`/trips/${tripId}/places`} />
      <IndexRow icon="create-outline" label="Journal" detail={journal.length ? `${journal.length} ${journal.length === 1 ? "entry" : "entries"}` : "Write down what happened"} href={`/trips/${tripId}/journal`} />
      <IndexRow icon="swap-horizontal-outline" label="Currency converter" detail={`${trip.homeCurrency} and local money`} href={`/trips/${tripId}/currency`} />
      <IndexRow icon="albums-outline" label="Trip recap" detail={phase === "after" ? "How it went, in numbers" : "Fills in as you travel"} href={`/trips/${tripId}/recap`} />

      <Pressable
        onPress={remove}
        accessibilityRole="button"
        style={({ pressed }) => ({ paddingHorizontal: GUTTER, paddingVertical: space.xl, opacity: pressed ? 0.5 : 1 })}
      >
        <T v="meta" c="danger">
          Delete this trip
        </T>
      </Pressable>
    </View>
  );
}

function IndexRow({ icon, label, detail, href }: { icon: keyof typeof Ionicons.glyphMap; label: string; detail: string; href: Href }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={() => router.push(href)}
      accessibilityRole="button"
      accessibilityLabel={`${label}. ${detail}`}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: 14,
        paddingHorizontal: GUTTER,
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: colors.rule,
        backgroundColor: pressed ? colors.sunk : "transparent",
      })}
    >
      <Ionicons name={icon} size={20} color={colors.ink2} />
      <View style={{ flex: 1 }}>
        <T v="bodyStrong">{label}</T>
        <T v="small" c="ink3" numberOfLines={1}>
          {detail}
        </T>
      </View>
      <Ionicons name="chevron-forward" size={16} color={colors.ink3} />
    </Pressable>
  );
}
