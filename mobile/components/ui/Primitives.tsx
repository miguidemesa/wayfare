import { forwardRef, useEffect, type ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  TextInput,
  View,
  type DimensionValue,
  type StyleProp,
  type TextInputProps,
  type ViewProps,
  type ViewStyle,
} from "react-native";
import Animated, { ReduceMotion, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withTiming } from "react-native-reanimated";
import { fonts, GUTTER, motion, radii, space, TABULAR_NUMS, type, useTheme } from "@/shared/theme";
import { settle, useTransition } from "@/lib/motion";
import { T } from "./T";
import { Button } from "./Button";
import { Press } from "./Press";

/** Hairline. The primary structural device — used where other apps use cards. */
export function Rule({ inset = 0, strong, style }: { inset?: number; strong?: boolean; style?: StyleProp<ViewStyle> }) {
  const { colors } = useTheme();
  return <View style={[{ height: 1, backgroundColor: strong ? colors.ruleStrong : colors.rule, marginLeft: inset }, style]} />;
}

/** Small-caps section label with an optional right-hand action. */
export function SectionLabel({ children, action, style }: { children: string; action?: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: space.sm }, style]}>
      <T v="label" c="ink3" accessibilityRole="header">
        {children}
      </T>
      {action}
    </View>
  );
}

/** A pressable row with a quiet pressed state. */
export function Row({
  onPress,
  onLongPress,
  children,
  style,
  accessibilityLabel,
}: {
  onPress?: () => void;
  onLongPress?: () => void;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      disabled={!onPress && !onLongPress}
      accessibilityRole={onPress ? "button" : undefined}
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [{ backgroundColor: pressed ? colors.sunk : "transparent" }, style]}
    >
      {children}
    </Pressable>
  );
}

type FieldProps = TextInputProps & { label?: string; hint?: string; error?: string | null; numeric?: boolean };

export const Field = forwardRef<TextInput, FieldProps>(function Field({ label, hint, error, numeric, style, ...rest }, ref) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: 6 }}>
      {label ? (
        // The input announces the label itself; don't read it twice.
        <T v="label" c="ink3" importantForAccessibility="no" accessibilityElementsHidden>
          {label}
        </T>
      ) : null}
      <TextInput
        ref={ref}
        placeholderTextColor={colors.ink3}
        selectionColor={colors.accent}
        accessibilityLabel={label}
        accessibilityHint={error ?? hint}
        {...rest}
        style={[
          {
            fontFamily: fonts.sans,
            fontSize: 16,
            color: colors.ink,
            backgroundColor: colors.raised,
            borderWidth: 1,
            borderColor: error ? colors.danger : colors.edge,
            borderRadius: radii.md,
            paddingHorizontal: 14,
            paddingVertical: 12,
            minHeight: 46,
          },
          numeric && TABULAR_NUMS,
          style,
        ]}
      />
      {error ? (
        <T v="small" c="danger" accessibilityLiveRegion="polite">
          {error}
        </T>
      ) : hint ? (
        <T v="small" c="ink3">
          {hint}
        </T>
      ) : null}
    </View>
  );
});

/**
 * A row of mutually exclusive text options. Selected = ink-filled.
 * Used for categories, pace, durations — never for navigation.
 */
export function Choices<K extends string>({
  options,
  value,
  onChange,
  wrap = true,
}: {
  options: { key: K; label: string }[];
  value: K | null;
  onChange: (key: K) => void;
  wrap?: boolean;
}) {
  return (
    <View style={{ flexDirection: "row", flexWrap: wrap ? "wrap" : "nowrap", gap: 6 }}>
      {options.map((o) => (
        <Chip key={o.key} label={o.label} on={o.key === value} role="radio" onPress={() => onChange(o.key)} />
      ))}
    </View>
  );
}

/** Chips where any number can be on (interests, diets). Selected = ink-filled. */
export function Toggles<K extends string>({
  options,
  values,
  onChange,
}: {
  options: readonly { key: K; label: string }[];
  values: readonly K[];
  onChange: (values: K[]) => void;
}) {
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
      {options.map((o) => {
        const on = values.includes(o.key);
        return (
          <Chip
            key={o.key}
            label={o.label}
            on={on}
            role="checkbox"
            onPress={() => onChange(on ? values.filter((v) => v !== o.key) : [...values, o.key])}
          />
        );
      })}
    </View>
  );
}

/** One option in Choices or Toggles: sinks when pressed, and the ink fill eases in and out. */
function Chip({ label, on, role, onPress }: { label: string; on: boolean; role: "radio" | "checkbox"; onPress: () => void }) {
  const { colors } = useTheme();
  const fill = useTransition(["backgroundColor", "borderColor"], motion.fast);
  const ink = useTransition("color", motion.fast);
  return (
    <Press
      onPress={onPress}
      accessibilityRole={role}
      aria-checked={on}
      // 36 visible + 4 above and below = a 44pt target.
      hitSlop={{ top: 4, bottom: 4 }}
      scaleTo={0.96}
      style={[
        {
          paddingHorizontal: 12,
          height: 36,
          justifyContent: "center",
          borderRadius: radii.sm,
          borderWidth: 1,
          borderColor: on ? colors.ink : colors.edge,
          backgroundColor: on ? colors.ink : colors.raised,
        },
        fill,
      ]}
    >
      <Animated.Text style={[type.meta, { color: on ? colors.onInk : colors.ink2 }, ink]}>{label}</Animated.Text>
    </Press>
  );
}

/** Typographic empty state — a headline, one sentence, one way forward. */
export function Empty({
  title,
  body,
  action,
  onAction,
  actionBusy,
  secondary,
  onSecondary,
  style,
}: {
  title: string;
  body?: string;
  action?: string;
  onAction?: () => void;
  /** The action is running: keep its label, block repeat taps. */
  actionBusy?: boolean;
  secondary?: string;
  onSecondary?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[{ paddingVertical: space.xxl, gap: space.sm }, style]}>
      <T v="heading" accessibilityRole="header">
        {title}
      </T>
      {body ? (
        <T v="body" c="ink2" style={{ maxWidth: 340 }}>
          {body}
        </T>
      ) : null}
      {action || secondary ? (
        <View style={{ flexDirection: "row", gap: space.lg, alignItems: "center", marginTop: space.md }}>
          {action ? <Button label={action} onPress={onAction} busy={actionBusy} /> : null}
          {secondary ? <Button label={secondary} variant="quiet" onPress={onSecondary} /> : null}
        </View>
      ) : null}
    </View>
  );
}

/** Full-area loading state. Quiet: a small spinner and what we're doing. */
export function Loading({ label }: { label?: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: space.md, backgroundColor: colors.paper }}>
      <ActivityIndicator color={colors.ink3} />
      {label ? (
        <T v="meta" c="ink3">
          {label}
        </T>
      ) : null}
    </View>
  );
}

/** Full-area failure state with a retry. */
export function Failure({ title = "Couldn't load this", message, onRetry }: { title?: string; message?: string | null; onRetry?: () => void }) {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, justifyContent: "center", paddingHorizontal: GUTTER, backgroundColor: colors.paper }}>
      <Empty title={title} body={message ?? "Check your connection and try again."} action={onRetry ? "Try again" : undefined} onAction={onRetry} />
    </View>
  );
}

/** Label / value pair on one line, value right-aligned. */
export function Pair({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", paddingVertical: 6, gap: 12 }}>
      <T v="meta" c="ink2" style={{ flexShrink: 1 }}>
        {label}
      </T>
      <T v={strong ? "bodyStrong" : "meta"} num>
        {value}
      </T>
    </View>
  );
}

const BREATHE = { from: { opacity: 1 }, to: { opacity: 0.5 } };

/**
 * A placeholder in the shape of what's loading, breathing gently (still under
 * Reduce Motion). Wrap a group of them in one view that announces what's loading.
 */
export function Skeleton({ width, height, style }: { width?: DimensionValue; height?: DimensionValue; style?: StyleProp<ViewStyle> }) {
  const { colors } = useTheme();
  const reduce = useReducedMotion();
  return (
    <Animated.View
      style={[
        { width, height, borderRadius: radii.sm, backgroundColor: colors.sunk },
        !reduce && {
          animationName: BREATHE,
          animationDuration: 900,
          animationIterationCount: "infinite",
          animationDirection: "alternate",
          animationTimingFunction: "ease-in-out",
        },
        style,
      ]}
    />
  );
}

/**
 * A thin bar for a share of a whole (budget used, a category, interview
 * progress). Grows from zero when it appears and eases to each new value.
 */
export function Meter({
  value,
  color,
  track,
  height = 3,
  delay = 0,
  ...rest
}: ViewProps & { value: number; color: string; track?: string; height?: number; delay?: number }) {
  const target = Math.max(0, Math.min(1, value));
  const shown = useSharedValue(0);
  useEffect(() => {
    shown.value = withDelay(delay, withTiming(target, { duration: motion.slow, easing: settle, reduceMotion: ReduceMotion.System }));
  }, [target, delay, shown]);
  const fill = useAnimatedStyle(() => ({ width: `${shown.value * 100}%` }));
  return (
    <View {...rest} style={[{ height, backgroundColor: track ?? "transparent", borderRadius: track ? 2 : 0, overflow: "hidden" }, rest.style]}>
      <Animated.View style={[{ height, backgroundColor: color }, fill]} />
    </View>
  );
}
