import type { ReactNode } from "react";
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import Animated, { useReducedMotion } from "react-native-reanimated";
import { GUTTER, space, useTheme, type ThemeColors } from "@/shared/theme";
import { T } from "./T";

// The timeline that Wayfare's pages hang from: a hairline down the left edge,
// a mark for each moment (now, a stop, a day, a trip), a small label saying
// when, then what. Home, the plan, spending and the journal all read this way.

/** Where the line runs, and where the words start, from the screen's left edge. */
export const SPINE_X = 36;
export const SPINE_TEXT = 64;

export type Mark = "now" | "next" | "stop" | "done" | "day" | "trip" | "past";

const PAD_TOP = 12;
const RIPPLE = { from: { transform: [{ scale: 1 }], opacity: 0.4 }, to: { transform: [{ scale: 2.8 }], opacity: 0 } };

function MarkDot({ mark }: { mark: Mark }) {
  const { colors } = useTheme();
  const reduce = useReducedMotion();
  const size = mark === "trip" ? 13 : mark === "now" || mark === "next" ? 11 : 9;
  const look: ViewStyle = {
    now: { backgroundColor: colors.accent },
    next: { backgroundColor: colors.paper, borderWidth: 2, borderColor: colors.accent },
    stop: { backgroundColor: colors.paper, borderWidth: 1.5, borderColor: colors.ink },
    done: { backgroundColor: colors.ink3 },
    day: { backgroundColor: colors.paper, borderWidth: 1.5, borderColor: colors.ink },
    trip: { backgroundColor: colors.ink },
    past: { backgroundColor: colors.ruleStrong },
  }[mark];
  const radius = mark === "day" ? 2 : size / 2;
  return (
    <View style={{ width: size, height: size }}>
      {/* "Now" breathes, so the eye finds it; nothing else moves. */}
      {mark === "now" && !reduce ? (
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            {
              borderRadius: radius,
              backgroundColor: colors.accent,
              animationName: RIPPLE,
              animationDuration: 2400,
              animationIterationCount: "infinite",
              animationTimingFunction: "ease-out",
            },
          ]}
        />
      ) : null}
      <View style={[{ width: size, height: size, borderRadius: radius }, look]} />
    </View>
  );
}

/**
 * One moment on the line: a mark, a small label (when), then what. Without a
 * mark it's a quiet passage between moments (the travel between two stops).
 * Pass onPress to make the whole row tappable. Every row draws its own piece
 * of the line, so a pressed row keeps it.
 */
export function SpineItem({
  mark,
  label,
  labelColor = "ink3",
  markCenter,
  padTop = PAD_TOP,
  right,
  children,
  onPress,
  onLongPress,
  disabled,
  accessibilityLabel,
  accessibilityHint,
  style,
}: {
  mark?: Mark;
  label?: string;
  labelColor?: keyof ThemeColors;
  /** Distance from the row's top padding to the middle of the first line, when there's no label. */
  markCenter?: number;
  /** Space above the row's content; the mark follows it. */
  padTop?: number;
  right?: ReactNode;
  children?: ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
  disabled?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  const center = padTop + (label ? 7 : (markCenter ?? 12));
  const inner = (
    <>
      <View pointerEvents="none" style={{ position: "absolute", left: SPINE_X, top: 0, bottom: 0, width: 1, backgroundColor: colors.ruleStrong }} />
      {mark ? (
        <View pointerEvents="none" style={{ position: "absolute", left: SPINE_X - 10 + 0.5, top: center - 10, width: 20, height: 20, alignItems: "center", justifyContent: "center" }}>
          <MarkDot mark={mark} />
        </View>
      ) : null}
      <View style={{ flex: 1, gap: 3 }}>
        {label ? (
          <T v="label" c={labelColor} num>
            {label}
          </T>
        ) : null}
        {children}
      </View>
      {right}
    </>
  );
  const row: StyleProp<ViewStyle> = [
    { flexDirection: "row", alignItems: "flex-start", gap: space.md, paddingLeft: SPINE_TEXT, paddingRight: GUTTER, paddingTop: padTop, paddingBottom: space.lg },
    style,
  ];
  if (!onPress && !onLongPress) {
    return (
      <View style={row} accessible={!!accessibilityLabel} accessibilityLabel={accessibilityLabel}>
        {inner}
      </View>
    );
  }
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      style={({ pressed }) => [row, { backgroundColor: pressed ? colors.sunk : "transparent" }]}
    >
      {inner}
    </Pressable>
  );
}

/** A quiet italic break on the line: "Later", "Earlier". */
export function SpineBreak({ children }: { children: string }) {
  return (
    <SpineItem padTop={space.sm} style={{ paddingBottom: space.md }}>
      <T v="aside" c="ink3" accessibilityRole="header">
        {children}
      </T>
    </SpineItem>
  );
}
