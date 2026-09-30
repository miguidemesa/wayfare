import { loadFont as loadNewsreader } from "@remotion/google-fonts/Newsreader";
import { loadFont as loadInterTight } from "@remotion/google-fonts/InterTight";
import { loadFont as loadCaveat } from "@remotion/google-fonts/Caveat";
import { Easing, interpolate } from "remotion";

// Wayfare's "Folio" system (mobile/shared/theme.ts): warm paper, ink, and one
// vermilion accent that marks "now" and the primary action — nothing else.
export const C = {
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
  caution: "#8A5712",
  icon: "#C2593F", // the app icon's field (mobile/assets/icon.png)
} as const;

const faces = [
  loadNewsreader("normal", {
    weights: ["400", "500"],
    subsets: ["latin", "latin-ext"],
  }),
  loadNewsreader("italic", {
    weights: ["400", "500"],
    subsets: ["latin", "latin-ext"],
  }),
  loadInterTight("normal", {
    weights: ["400", "500", "600", "700"],
    subsets: ["latin", "latin-ext"],
  }),
  loadCaveat("normal", { weights: ["600"], subsets: ["latin"] }),
];

export const serif = faces[0].fontFamily;
export const sans = faces[2].fontFamily;
export const hand = faces[3].fontFamily;

/** Every face loaded — canvas textures draw outside the DOM's own font wait. */
export const fontsReady = () =>
  Promise.all(faces.map((f) => f.waitUntilDone()));

// Eased and never bouncy, like the app (theme.ts `motion`) — only slower and grander.
export const ease = {
  out: Easing.bezier(0.16, 1, 0.3, 1),
  inOut: Easing.bezier(0.65, 0, 0.35, 1),
  in: Easing.bezier(0.7, 0, 0.84, 0),
  fluid: Easing.bezier(0.32, 0.72, 0, 1),
  linear: (t: number) => t,
};

/** Clamped interpolate: the shape almost every animation here takes. */
export const tween = (
  frame: number,
  input: number[],
  output: number[],
  easing: (t: number) => number = ease.out,
) =>
  interpolate(frame, input, output, {
    easing,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

/** The compass star from the icon as an SVG path: four points, the waist at 0.6 of the radius. */
export const starPath = (r: number) =>
  Array.from({ length: 8 }, (_, i) => {
    const a = -Math.PI / 2 + (i * Math.PI) / 4;
    const k = i % 2 ? r * 0.6 : r;
    return `${i ? "L" : "M"}${(Math.cos(a) * k).toFixed(2)} ${(Math.sin(a) * k).toFixed(2)}`;
  }).join(" ") + "Z";
