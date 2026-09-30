import { Pressable, StyleSheet, type PressableProps, type StyleProp, type ViewStyle } from "react-native";
import Animated, {
  interpolate,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type CSSTransitionProperties,
} from "react-native-reanimated";
import { motion } from "@/shared/theme";
import { settle } from "@/lib/motion";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type Props = Omit<PressableProps, "style"> & {
  /** Static styles, plus CSS-style transitions (see useTransition). */
  style?: StyleProp<ViewStyle & CSSTransitionProperties>;
  /** How far it sinks while held; 1 for text that should only dim. */
  scaleTo?: number;
  /** Opacity while held, relative to the style's own opacity. */
  dimTo?: number;
};

/**
 * A Pressable with the house press: sinks and dims on touch, settles back on
 * release. It runs on the UI thread, so it answers the finger instantly.
 */
export function Press({ scaleTo = motion.press, dimTo = 0.9, style, onPressIn, onPressOut, ...rest }: Props) {
  const held = useSharedValue(0);
  // Disabled and busy states set their own opacity; pressing dims from there.
  const base = Number(StyleSheet.flatten(style)?.opacity ?? 1);
  const pressed = useAnimatedStyle(() => ({
    opacity: base * interpolate(held.value, [0, 1], [1, dimTo]),
    transform: [{ scale: interpolate(held.value, [0, 1], [1, scaleTo]) }],
  }));

  return (
    <AnimatedPressable
      {...rest}
      onPressIn={(e) => {
        held.value = withTiming(1, { duration: 90, easing: settle, reduceMotion: ReduceMotion.System });
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        held.value = withTiming(0, { duration: motion.fast, easing: settle, reduceMotion: ReduceMotion.System });
        onPressOut?.(e);
      }}
      style={[style, pressed]}
    />
  );
}
