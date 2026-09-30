import type { ReactNode } from "react";
import { ActivityIndicator, View, type StyleProp, type ViewStyle } from "react-native";
import { fonts, motion, radii, useTheme } from "@/shared/theme";
import { Press } from "./Press";
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
 *
 * Filled and outlined buttons sink when pressed; quiet ones only dim.
 */
export function Button({ label, onPress, variant = "primary", size = "md", loading, busy, disabled, icon, style, accessibilityHint }: Props) {
  const { colors } = useTheme();
  const inactive = disabled || loading || busy;
  const quiet = variant === "quiet";

  const bg = variant === "primary" ? colors.ink : variant === "accent" ? colors.accent : "transparent";
  const fg = variant === "primary" ? colors.onInk : variant === "accent" ? colors.onAccent : quiet ? colors.accent : colors.ink;

  return (
    <Press
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      aria-disabled={!!inactive}
      aria-busy={!!(loading || busy)}
      // A quiet button is a line of text: 22 tall plus 11 above and below = 44.
      hitSlop={quiet ? 11 : 0}
      scaleTo={quiet ? 1 : motion.press}
      dimTo={quiet ? 0.5 : 0.9}
      style={[
        {
          height: quiet ? undefined : size === "lg" ? 52 : 44,
          paddingHorizontal: quiet ? 0 : size === "lg" ? 24 : 18,
          borderRadius: radii.md,
          borderCurve: "continuous",
          backgroundColor: bg,
          borderWidth: variant === "secondary" ? 1 : 0,
          borderColor: colors.edge,
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "row",
          gap: 8,
          opacity: busy ? 0.6 : inactive ? 0.45 : 1,
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
    </Press>
  );
}
