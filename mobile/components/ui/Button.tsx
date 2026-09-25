import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, View, type StyleProp, type ViewStyle } from "react-native";
import { fonts, radii, useTheme } from "@/shared/theme";
import { T } from "./T";

type Variant = "primary" | "accent" | "secondary" | "quiet";

type Props = {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  size?: "md" | "lg";
  loading?: boolean;
  /** Working, with the label kept (e.g. "Saving…"): not pressable, announced as busy. */
  busy?: boolean;
  disabled?: boolean;
  icon?: ReactNode;
  style?: StyleProp<ViewStyle>;
  accessibilityHint?: string;
};

/**
 * primary — ink-filled; the main action on a screen.
 * accent — reserved for the single most important action (log expense, save).
 * secondary — hairline outline.
 * quiet — text only, for inline actions next to content.
 */
export function Button({ label, onPress, variant = "primary", size = "md", loading, busy, disabled, icon, style, accessibilityHint }: Props) {
  const { colors } = useTheme();
  const inactive = disabled || loading || busy;

  const bg = variant === "primary" ? colors.ink : variant === "accent" ? colors.accent : "transparent";
  const fg = variant === "primary" ? colors.onInk : variant === "accent" ? colors.onAccent : variant === "quiet" ? colors.accent : colors.ink;
  const height = variant === "quiet" ? undefined : size === "lg" ? 52 : 42;

  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!inactive, busy: !!(loading || busy) }}
      hitSlop={variant === "quiet" ? 10 : 0}
      style={({ pressed }) => [
        {
          height,
          paddingHorizontal: variant === "quiet" ? 0 : size === "lg" ? 22 : 16,
          borderRadius: radii.md,
          backgroundColor: bg,
          borderWidth: variant === "secondary" ? 1 : 0,
          borderColor: colors.edge,
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "row",
          gap: 8,
          opacity: busy ? 0.6 : inactive ? 0.45 : pressed ? 0.78 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={fg} />
      ) : (
        <>
          {icon ? <View>{icon}</View> : null}
          <T
            v="bodyStrong"
            style={{ color: fg, fontFamily: fonts.sansSemibold, fontSize: size === "lg" ? 16 : 15 }}
            numberOfLines={1}
          >
            {label}
          </T>
        </>
      )}
    </Pressable>
  );
}
