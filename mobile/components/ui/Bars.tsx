import type { ReactNode } from "react";
import { Platform, Pressable, View } from "react-native";
import { router, type Href } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { GUTTER, useTheme } from "@/shared/theme";
import { T } from "./T";

/**
 * Back that always goes somewhere sensible: pop when there's history,
 * otherwise (deep link, cold start) replace with the logical parent.
 */
export function goBack(fallback: Href) {
  if (router.canGoBack()) router.back();
  else router.replace(fallback);
}

/** Top bar for pushed screens: back, a title, an optional right action. */
export function TopBar({
  title,
  backLabel,
  fallback,
  right,
  onBack,
}: {
  title?: string;
  backLabel?: string;
  fallback: Href;
  right?: ReactNode;
  onBack?: () => void;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ paddingTop: insets.top, backgroundColor: colors.paper }}>
      <View style={{ height: 48, flexDirection: "row", alignItems: "center", paddingHorizontal: GUTTER - 6 }}>
        <Pressable
          onPress={onBack ?? (() => goBack(fallback))}
          accessibilityRole="button"
          accessibilityLabel={backLabel ? `Back to ${backLabel}` : "Back"}
          hitSlop={10}
          style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 2, opacity: pressed ? 0.5 : 1, paddingRight: 8 })}
        >
          <Ionicons name="chevron-back" size={22} color={colors.ink} />
          {backLabel ? <T v="meta">{backLabel}</T> : null}
        </Pressable>
        <View style={{ flex: 1, alignItems: "center" }}>
          {title ? (
            <T v="bodyStrong" numberOfLines={1} accessibilityRole="header">
              {title}
            </T>
          ) : null}
        </View>
        <View style={{ minWidth: 44, alignItems: "flex-end" }}>{right}</View>
      </View>
    </View>
  );
}

/**
 * Header for modal flows: Cancel on the left, the title, a confirm on the
 * right. Modals slide up and are dismissed down — never "back".
 */
export function SheetBar({
  title,
  onCancel,
  cancelLabel = "Cancel",
  right,
}: {
  title: string;
  onCancel?: () => void;
  cancelLabel?: string;
  right?: ReactNode;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  // iOS presents modals as page sheets below the status bar. Android shows
  // them full-screen, edge to edge, so the bar has to clear the status bar.
  const top = Platform.OS === "android" ? insets.top : 0;
  return (
    <View
      style={{
        height: 54 + top,
        paddingTop: top,
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: GUTTER,
        borderBottomWidth: 1,
        borderBottomColor: colors.rule,
        backgroundColor: colors.paper,
      }}
    >
      <Pressable
        onPress={onCancel ?? (() => router.back())}
        accessibilityRole="button"
        accessibilityLabel={cancelLabel}
        hitSlop={10}
        style={({ pressed }) => ({ minWidth: 64, opacity: pressed ? 0.5 : 1 })}
      >
        <T v="meta" c="ink2">
          {cancelLabel}
        </T>
      </Pressable>
      <View style={{ flex: 1, alignItems: "center" }}>
        <T v="bodyStrong" numberOfLines={1} accessibilityRole="header">
          {title}
        </T>
      </View>
      <View style={{ minWidth: 64, alignItems: "flex-end" }}>{right}</View>
    </View>
  );
}
