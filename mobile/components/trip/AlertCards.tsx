import { useState } from "react";
import { Pressable, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { radii, space, useTheme } from "@/shared/theme";
import type { AlertAction, TripAlert } from "@/shared/alerts";
import { openDirections } from "@/lib/directions";
import { T } from "@/components/ui/T";

/** Carry out an alert's action. */
export function runAlertAction(tripId: string, to: AlertAction, setDayIndex?: (i: number) => void) {
  switch (to.kind) {
    case "bookings":
      return router.push(`/trips/${tripId}/bookings`);
    case "packing":
      return router.push(`/trips/${tripId}/packing`);
    case "spend":
      return router.navigate(`/trips/${tripId}/spend`);
    case "plan":
      setDayIndex?.(to.dayIndex);
      return router.navigate(`/trips/${tripId}`);
    case "stop":
      return router.push({ pathname: "/trips/[tripId]/stop/[itemId]", params: { tripId, itemId: to.itemId } });
    case "ask":
      return router.push({ pathname: "/trips/[tripId]/ask", params: { tripId, date: to.date, prompt: to.prompt } });
    case "directions":
      return void openDirections({ lat: to.lat, lng: to.lng, name: to.name, city: to.city });
  }
}

/**
 * The trip's alerts as a short stack of cards: the most urgent first, the
 * rest one tap away. Each can be dismissed for the session.
 */
export function AlertCards({
  tripId,
  alerts,
  dismissed,
  onDismiss,
  setDayIndex,
  max = 2,
}: {
  tripId: string;
  alerts: TripAlert[];
  dismissed: ReadonlySet<string>;
  onDismiss: (id: string) => void;
  setDayIndex?: (i: number) => void;
  max?: number;
}) {
  const [all, setAll] = useState(false);
  const live = alerts.filter((a) => !dismissed.has(a.id));
  if (!live.length) return null;
  const shown = all ? live : live.slice(0, max);
  return (
    <View style={{ gap: space.sm }} accessibilityLabel={`${live.length} ${live.length === 1 ? "alert" : "alerts"}`}>
      {shown.map((a) => (
        <AlertCard key={a.id} alert={a} onAction={() => runAlertAction(tripId, a.action.to, setDayIndex)} onDismiss={() => onDismiss(a.id)} />
      ))}
      {live.length > shown.length ? (
        <Pressable onPress={() => setAll(true)} accessibilityRole="button" hitSlop={10} style={{ alignSelf: "flex-start" }}>
          <T v="meta" c="accent">
            {live.length - shown.length} more
          </T>
        </Pressable>
      ) : null}
    </View>
  );
}

function AlertCard({ alert, onAction, onDismiss }: { alert: TripAlert; onAction: () => void; onDismiss: () => void }) {
  const { colors } = useTheme();
  const tint = alert.tone === "danger" ? colors.danger : alert.tone === "warning" ? colors.caution : colors.ink2;
  const icon = alert.tone === "info" ? "information-circle-outline" : "alert-circle-outline";
  return (
    <View
      accessibilityRole={alert.tone === "danger" ? "alert" : undefined}
      style={{
        flexDirection: "row",
        gap: 10,
        padding: 12,
        borderRadius: radii.md,
        borderWidth: 1,
        borderColor: alert.tone === "info" ? colors.rule : tint,
        backgroundColor: colors.raised,
      }}
    >
      <Ionicons name={icon} size={20} color={tint} style={{ marginTop: 1 }} />
      <View style={{ flex: 1, gap: 2 }}>
        <T v="bodyStrong">{alert.title}</T>
        <T v="small" c="ink2">
          {alert.body}
        </T>
        <Pressable onPress={onAction} accessibilityRole="button" hitSlop={10} style={{ alignSelf: "flex-start", marginTop: 6 }}>
          <T v="meta" c="accent">
            {alert.action.label}
          </T>
        </Pressable>
      </View>
      <Pressable onPress={onDismiss} accessibilityRole="button" accessibilityLabel={`Dismiss: ${alert.title}`} hitSlop={12} style={{ padding: 2 }}>
        <Ionicons name="close" size={18} color={colors.ink3} />
      </Pressable>
    </View>
  );
}
