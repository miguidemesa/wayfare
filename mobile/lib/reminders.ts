import { useCallback, useEffect, useState } from "react";
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import { reminderSchedule } from "@/shared/reminders";
import type { TripBundle } from "@/shared/types";

// Hands shared/reminders.ts's schedule to the phone. Local notifications
// only: no push server, and they fire offline. Nothing on the web, where
// the OS can't hold them.

const supported = Platform.OS === "ios" || Platform.OS === "android";
const CHANNEL = "trip-reminders";

if (supported) {
  // Show reminders even while the app is open.
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
  });
}

export type ReminderPermission = "unsupported" | "granted" | "denied" | "undetermined";

async function readPermission(): Promise<ReminderPermission> {
  if (!supported) return "unsupported";
  const p = await Notifications.getPermissionsAsync();
  return p.granted ? "granted" : p.canAskAgain ? "undetermined" : "denied";
}

/** Permission state, and a way to ask. */
export function useReminderPermission() {
  const [state, setState] = useState<ReminderPermission | null>(null);
  useEffect(() => {
    readPermission().then(setState, () => setState("unsupported"));
  }, []);
  const ask = useCallback(async () => {
    if (!supported) return "unsupported" as const;
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync(CHANNEL, { name: "Trip reminders", importance: Notifications.AndroidImportance.HIGH });
    }
    const p = await Notifications.requestPermissionsAsync();
    const next: ReminderPermission = p.granted ? "granted" : p.canAskAgain ? "undetermined" : "denied";
    setState(next);
    return next;
  }, []);
  return { state, ask };
}

/**
 * Replace this trip's scheduled reminders with a fresh schedule. Safe to
 * call on every load: it only acts when reminders are allowed.
 */
export async function syncReminders(bundle: TripBundle): Promise<number> {
  if ((await readPermission()) !== "granted") return 0;
  const tripId = bundle.trip.id;
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled.filter((n) => n.content.data?.tripId === tripId).map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier))
  );
  const schedule = reminderSchedule(bundle);
  for (const r of schedule) {
    await Notifications.scheduleNotificationAsync({
      identifier: `${tripId}:${r.id}`,
      content: { title: r.title, body: r.body, data: { tripId, reminder: r.id } },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: r.at, ...(Platform.OS === "android" ? { channelId: CHANNEL } : {}) },
    });
  }
  return schedule.length;
}
