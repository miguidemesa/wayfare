import { Platform } from "react-native";
import {
  cubicBezier,
  Easing,
  FadeIn,
  FadeInDown,
  FadeInLeft,
  FadeInRight,
  FadeOut,
  LinearTransition,
  ReduceMotion,
  useReducedMotion,
  ZoomIn,
  type CSSTransitionProperties,
  type StyleProps,
} from "react-native-reanimated";
import { motion } from "@/shared/theme";

// Reanimated versions of the motion tokens in shared/theme.ts. Every preset
// here honours the system Reduce Motion setting.

const [x1, y1, x2, y2] = motion.ease;

/** The house curve, for timing and layout animations. */
export const settle = Easing.bezier(x1, y1, x2, y2);

/**
 * Where an entrance starts. On the web, Reanimated (4.1) pins an element with
 * custom starting values to an absolute position once it has entered, and can
 * throw doing it, so the web keeps each preset's own starting distance.
 */
export function startFrom<B extends { withInitialValues(values: StyleProps): B }>(builder: B, values: StyleProps): B {
  return Platform.OS === "web" ? builder : builder.withInitialValues(values);
}

/** Rise 10pt into place. `i` staggers rows; only the first six wait. */
export function enterUp(i = 0) {
  const rise = FadeInDown.duration(motion.slow)
    .delay(Math.min(i, 6) * motion.stagger)
    .easing(settle)
    .reduceMotion(ReduceMotion.System);
  return startFrom(rise, { opacity: 0, transform: [{ translateY: 10 }] });
}

/** Slide in from the side it lives on: 1 from the right (next), -1 from the left (previous). */
export function enterFrom(dir: 1 | -1, distance = 24, duration: number = motion.base) {
  const slide = (dir > 0 ? FadeInRight : FadeInLeft).duration(duration).easing(settle).reduceMotion(ReduceMotion.System);
  return startFrom(slide, { opacity: 0, transform: [{ translateX: dir * distance }] });
}

export const fadeIn = FadeIn.duration(motion.base).easing(settle).reduceMotion(ReduceMotion.System);
export const fadeOut = FadeOut.duration(motion.fast).reduceMotion(ReduceMotion.System);

/** A small pop for a mark that just changed under the finger (a tick, "Booked"). */
export const pop = startFrom(ZoomIn.duration(180).easing(settle).reduceMotion(ReduceMotion.System), { transform: [{ scale: 0.6 }] });

/** Siblings glide to their new places when a row arrives or leaves. */
export const reflow = LinearTransition.duration(motion.base).easing(settle).reduceMotion(ReduceMotion.System);

const settleCss = cubicBezier(x1, y1, x2, y2);

/**
 * A CSS-style transition for an Animated component's style changes (colors,
 * an indicator's position). Instant when Reduce Motion is on.
 */
export function useTransition(
  property: CSSTransitionProperties["transitionProperty"],
  duration: number = motion.base
): CSSTransitionProperties {
  const reduce = useReducedMotion();
  return { transitionProperty: property, transitionDuration: reduce ? 0 : duration, transitionTimingFunction: settleCss };
}
