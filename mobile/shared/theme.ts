// Wayfare design system — "Folio".
//
// A trip is set like a well-made travel book: warm paper, ink, a serif for
// places and headings, a tight grotesk for times and money. Hairline rules and
// whitespace carry structure instead of cards; one vermilion accent marks
// "now" and the primary action, and nothing else.

import { useColorScheme } from "react-native";
import { dayKey, daysBetween, localKey } from "./trip";

export type ThemeColors = {
  paper: string; // app background
  raised: string; // sheets, inputs, the one surface that sits above paper
  sunk: string; // input wells, pressed rows, skeletons
  ink: string; // primary text + primary buttons
  ink2: string; // secondary text
  ink3: string; // tertiary text, placeholders (still 4.5:1 on paper and raised)
  rule: string; // hairlines: decorative, so exempt from contrast minimums
  ruleStrong: string; // active dividers
  edge: string; // borders of controls (fields, chips): 3:1 on raised, so they read as controls
  accent: string; // "now", selection, the primary action
  accentSoft: string; // accent wash behind selected text
  onAccent: string;
  onInk: string; // text on ink-filled buttons
  positive: string; // booked, under budget
  caution: string; // near budget
  danger: string; // destructive, over budget
  dangerSoft: string;
  scrim: string;
};

const LIGHT: ThemeColors = {
  paper: "#F4F1EA",
  raised: "#FBFAF6",
  sunk: "#EAE5DA",
  ink: "#1C1B18",
  ink2: "#5C574E",
  ink3: "#6E685D",
  rule: "#DCD5C7",
  ruleStrong: "#C4BBA9",
  edge: "#918877",
  accent: "#B03D22",
  accentSoft: "#F3DED6",
  onAccent: "#FFFFFF",
  onInk: "#F4F1EA",
  positive: "#3D6A4C",
  caution: "#8A5712",
  danger: "#A3281D",
  dangerSoft: "#F2DCD8",
  scrim: "rgba(28, 27, 24, 0.38)",
};

// Night is a warm dark, not an inverted light theme — easy on the eyes at a
// dinner table or in a dim airport.
const DARK: ThemeColors = {
  paper: "#161513",
  raised: "#1F1D1A",
  sunk: "#282521",
  ink: "#EDE8DE",
  ink2: "#AAA396",
  ink3: "#918A7D",
  rule: "#312D28",
  ruleStrong: "#453F37",
  edge: "#766F62",
  accent: "#E36A4D",
  accentSoft: "#3A221B",
  onAccent: "#161513",
  onInk: "#161513",
  positive: "#7DB08C",
  caution: "#D49A4A",
  danger: "#EC7A6B",
  dangerSoft: "#3B1F1B",
  scrim: "rgba(0, 0, 0, 0.55)",
};

// --------------------------------------------------------------- typography

// Static font families (loaded in app/_layout.tsx). Custom static fonts don't
// synthesize weights on RN, so always pick the family, never a fontWeight.
export const fonts = {
  serif: "Newsreader_400Regular",
  serifMedium: "Newsreader_500Medium",
  serifItalic: "Newsreader_400Regular_Italic",
  sans: "InterTight_400Regular",
  sansMedium: "InterTight_500Medium",
  sansSemibold: "InterTight_600SemiBold",
  sansBold: "InterTight_700Bold",
} as const;

export const type = {
  display: { fontFamily: fonts.serifMedium, fontSize: 40, lineHeight: 44, letterSpacing: -0.8 },
  title: { fontFamily: fonts.serifMedium, fontSize: 30, lineHeight: 34, letterSpacing: -0.5 },
  heading: { fontFamily: fonts.serifMedium, fontSize: 22, lineHeight: 27, letterSpacing: -0.2 },
  entry: { fontFamily: fonts.serifMedium, fontSize: 19, lineHeight: 24, letterSpacing: -0.1 },
  aside: { fontFamily: fonts.serifItalic, fontSize: 15, lineHeight: 20 },
  body: { fontFamily: fonts.sans, fontSize: 15, lineHeight: 22 },
  bodyStrong: { fontFamily: fonts.sansSemibold, fontSize: 15, lineHeight: 22 },
  meta: { fontFamily: fonts.sansMedium, fontSize: 13, lineHeight: 18 },
  small: { fontFamily: fonts.sans, fontSize: 12, lineHeight: 16 },
  label: { fontFamily: fonts.sansSemibold, fontSize: 11, lineHeight: 14, letterSpacing: 1.1, textTransform: "uppercase" as const },
  figure: { fontFamily: fonts.serifMedium, fontSize: 44, lineHeight: 48, letterSpacing: -1 },
} as const;

export type TypeVariant = keyof typeof type;

// ------------------------------------------------------------ layout tokens

export const space = { xxs: 2, xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 } as const;

/** Standard horizontal page margin. */
export const GUTTER = 20;

export const radii = { sm: 4, md: 8, lg: 14, full: 999 } as const;

// Motion: short, eased, never bouncy. Pushed screens and sheets use each
// platform's native transition; these are for in-place changes (press,
// selection, reveal, reorder). Reduce Motion turns every one of them off.
export const motion = {
  fast: 160, // press release, selection, toggles
  base: 220, // enter and exit, indicator glide, day change
  slow: 320, // progress, bars, first reveal
  stagger: 40, // per row, first six rows only
  press: 0.97, // how far a pressed control sinks
  /** "Settle": a quick start that eases into place, as a cubic bezier. */
  ease: [0.22, 1, 0.36, 1],
} as const;

export type Theme = { colors: ThemeColors; dark: boolean };

export function useTheme(): Theme {
  const dark = useColorScheme() === "dark";
  return { colors: dark ? DARK : LIGHT, dark };
}

export function getThemeColors(dark: boolean): ThemeColors {
  return dark ? DARK : LIGHT;
}

export const TABULAR_NUMS = { fontVariant: ["tabular-nums" as const] };

// ---------------------------------------------------------------- formatters

export function hexA(hex: string, alpha: number): string {
  if (!hex) return `rgba(28, 25, 23, ${alpha})`;
  if (hex.startsWith("rgba")) return hex;
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  if (isNaN(n)) return `rgba(28, 25, 23, ${alpha})`;
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

export function fmtMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
    }).format(amount);
  } catch {
    return `${currency} ${Math.round(amount).toLocaleString()}`;
  }
}

/** Whole days from today until a calendar date (e.g. a trip's start); never negative. */
export function daysUntil(iso: string): number {
  return Math.max(0, daysBetween(localKey(new Date()), dayKey(iso)));
}

export function tripDayCount(startIso: string, endIso: string): number {
  return Math.round((new Date(endIso).getTime() - new Date(startIso).getTime()) / 86400000) + 1;
}

export function fmtClock(minutes: number | null): string {
  if (minutes == null) return "--:--";
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

/** Format an instant (an expense, a booking time) in the phone's timezone. */
export function fmtDate(iso: string, opts?: Intl.DateTimeFormatOptions): string {
  return new Date(iso).toLocaleDateString("en-US", opts ?? { month: "short", day: "numeric" });
}

/**
 * Format a calendar date: an itinerary day, a trip's start or end, a hotel
 * stay, or a YYYY-MM-DD key. Shows the same day in every timezone (see dayKey).
 */
export function fmtDay(isoOrKey: string, opts?: Intl.DateTimeFormatOptions): string {
  return fmtDate(dayKey(isoOrKey) + "T12:00:00", opts);
}

export function fmtDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1)} km`;
}

export function fmtDuration(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}
