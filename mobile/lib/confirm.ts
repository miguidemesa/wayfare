import { Alert, Platform } from "react-native";

/**
 * Destructive-action confirmation. Native alert on iOS/Android; the browser's
 * confirm() on web, where RN's Alert has no implementation.
 */
export function confirmDestructive(opts: { title: string; message?: string; confirm: string; cancel?: string; onConfirm: () => void }) {
  const { title, message, confirm, cancel = "Cancel", onConfirm } = opts;
  if (Platform.OS === "web") {
    if (globalThis.confirm?.(message ? `${title}\n\n${message}` : title)) onConfirm();
    return;
  }
  Alert.alert(title, message, [
    { text: cancel, style: "cancel" },
    { text: confirm, style: "destructive", onPress: onConfirm },
  ]);
}
