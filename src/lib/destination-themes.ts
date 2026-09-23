// ---------------------------------------------------------------------------
// Destination Theme Engine
// Maps a trip's destination (country/city) to a cohesive visual direction:
// palette, texture, motifs, 3D environment and animation style.
// Tasteful and researched — never flags, clichés, or emoji-sticker theming.
// ---------------------------------------------------------------------------

export type DestinationEnv = "fuji" | "paris" | "rome" | "tropics" | "hanok" | "peaks";
export type AnimationStyle = "calm" | "warm" | "crisp" | "airy";

export type DestinationTheme = {
  key: string;
  country: string;
  city: string;
  /** Primary accent — drives links, buttons, focus rings inside the scope */
  accent: string;
  /** Secondary accent — gradients, charts, secondary highlights */
  accent2: string;
  /** Two atmospheric glow colors for scrims/auras */
  glowA: string;
  glowB: string;
  /** Deep base tone used behind 3D scenes and immersive cards */
  deep: string;
  /** Surface texture inspiration applied subtly via CSS */
  texture: "washi" | "marble" | "linen" | "weave" | "paper";
  motifs: string[];
  /** Which procedural 3D environment to render */
  env: DestinationEnv;
  animationStyle: AnimationStyle;
  /** Short editorial tagline used in heroes / empty states */
  tagline: string;
};

const THEMES: Record<string, DestinationTheme> = {
  japan: {
    key: "japan",
    country: "Japan",
    city: "",
    accent: "#C73E3A", // vermilion — shrine gates, hanko seals
    accent2: "#26456E", // aizome indigo
    glowA: "#F4A8C4", // someiyoshino sakura
    glowB: "#26456E",
    deep: "#101522",
    texture: "washi",
    motifs: ["sakura", "washi", "torii", "asanoha"],
    env: "fuji",
    animationStyle: "calm",
    tagline: "Temples, gardens, and city walks.",
  },
  italy: {
    key: "italy",
    country: "Italy",
    city: "",
    accent: "#9C4A2F", // terracotta — Roman brick, Tuscan rooftops
    accent2: "#3E5F4A", // cypress green
    glowA: "#E8B04B", // late golden hour
    glowB: "#9C4A2F",
    deep: "#1A130E",
    texture: "marble",
    motifs: ["travertine", "arches", "cypress", "fresco"],
    env: "rome",
    animationStyle: "warm",
    tagline: "Historic streets, art, and regional cuisine.",
  },
  france: {
    key: "france",
    country: "France",
    city: "",
    accent: "#31456E", // Parisian navy
    accent2: "#B5495B", // muted red — café awnings
    glowA: "#F2D8A7", // cream
    glowB: "#31456E",
    deep: "#0F1420",
    texture: "linen",
    motifs: ["zinc rooftops", "haussmann", "art nouveau", "cream"],
    env: "paris",
    animationStyle: "crisp",
    tagline: "Museums, architecture, and neighborhood cafés.",
  },
  philippines: {
    key: "philippines",
    country: "Philippines",
    city: "",
    accent: "#0E7C7B", // deep reef teal
    accent2: "#D98E32", // capiz-shell sunlight
    glowA: "#7FD8D4", // shallow lagoon
    glowB: "#D98E32",
    deep: "#07211F",
    texture: "weave",
    motifs: ["capiz", "banig weave", "coconut palms", "sunburst"],
    env: "tropics",
    animationStyle: "airy",
    tagline: "Islands, beaches, and coastal waters.",
  },
  korea: {
    key: "korea",
    country: "South Korea",
    city: "",
    accent: "#34558B", // dancheong blue, cooled
    accent2: "#B4552D", // dancheong red-brown
    glowA: "#9DB8D9",
    glowB: "#34558B",
    deep: "#0E1420",
    texture: "paper",
    motifs: ["hanok", "dancheong", "granite peaks"],
    env: "hanok",
    animationStyle: "crisp",
    tagline: "Palaces, street food, and vibrant neighborhoods.",
  },
};

/** Keyword matchers evaluated against the trip's destination + country strings. */
const MATCHERS: [RegExp, string][] = [
  [/japan|toky|kyoto|osaka|nippon/i, "japan"],
  [/italy|italia|rome|roma|florence|venice|venezia|amalfi|milan|naples/i, "italy"],
  [/france|paris|provence|lyon|nice|riviera/i, "france"],
  [/philippin|manila|palawan|cebu|boracay|siargao/i, "philippines"],
  [/korea|seoul|busan|jeju/i, "korea"],
];

/** Fallback palettes keyed by the trip's generic coverTheme when no country matches. */
const GENERIC: Record<string, DestinationTheme> = {
  sakura: { ...THEMES.japan, key: "generic", country: "", tagline: "Itinerary, maps, and travel details." },
  sunset: { ...THEMES.italy, key: "generic", country: "", tagline: "Itinerary, maps, and travel details." },
  teal: {
    key: "generic",
    country: "",
    city: "",
    accent: "#0F766E",
    accent2: "#0369A1",
    glowA: "#2DD4BF",
    glowB: "#0C4A6E",
    deep: "#071B22",
    texture: "paper",
    motifs: ["mist", "ridgelines"],
    env: "peaks",
    animationStyle: "calm",
    tagline: "Itinerary, maps, and travel details.",
  },
  midnight: { ...THEMES.korea, key: "generic", country: "", tagline: "Itinerary, maps, and travel details." },
  amber: { ...THEMES.italy, key: "generic", country: "", tagline: "Itinerary, maps, and travel details." },
  dune: { ...THEMES.philippines, key: "generic", country: "", tagline: "Itinerary, maps, and travel details." },
};

export const DEFAULT_DESTINATION_THEME = GENERIC.teal;

/**
 * Resolve the destination theme for a trip from its destinations + cover fallback.
 * Never throws; always returns a coherent theme.
 */
export function resolveDestinationTheme(
  destinations: { name: string; country: string }[],
  coverTheme?: string
): DestinationTheme {
  for (const d of destinations) {
    const haystack = `${d.name} ${d.country}`;
    for (const [re, key] of MATCHERS) {
      if (re.test(haystack)) {
        const base = THEMES[key];
        return { ...base, city: d.name, country: d.country || base.country };
      }
    }
  }
  const generic = (coverTheme && GENERIC[coverTheme]) || DEFAULT_DESTINATION_THEME;
  return {
    ...generic,
    city: destinations[0]?.name ?? "",
    country: destinations[0]?.country ?? generic.country,
  };
}

/** CSS custom properties produced for a theme (consumed by DestinationThemeScope). */
export function destinationCssVars(t: DestinationTheme): React.CSSProperties {
  return {
    "--dst-accent": t.accent,
    "--dst-accent-2": t.accent2,
    "--dst-glow-a": t.glowA,
    "--dst-glow-b": t.glowB,
    "--dst-deep": t.deep,
    // Re-map the app-wide accent tokens so every nested surface inherits the
    // destination palette without touching component code.
    "--accent": t.accent,
    "--accent-strong": t.accent,
    "--accent-soft": `color-mix(in srgb, ${t.accent} 14%, transparent)`,
    "--ring": `color-mix(in srgb, ${t.accent} 40%, transparent)`,
  } as React.CSSProperties;
}

/** Immersive gradient backdrop built from the theme (used as 3D/static fallback). */
export function destinationGradient(t: DestinationTheme): string {
  return [
    `radial-gradient(120% 90% at 82% -8%, ${hexA(t.glowA, 0.38)} 0%, transparent 58%)`,
    `radial-gradient(100% 85% at -6% 30%, ${hexA(t.glowB, 0.34)} 0%, transparent 56%)`,
    `radial-gradient(130% 120% at 50% 118%, ${hexA(t.accent, 0.28)} 0%, transparent 52%)`,
    `linear-gradient(150deg, ${t.deep} 0%, ${shade(t.deep, 14)} 55%, ${shade(t.deep, 26)} 100%)`,
  ].join(", ");
}

/** 1-line destination-aware loading copy. */
export function destinationLoadingCopy(t: DestinationTheme): string {
  const place = t.city || t.country || "your destination";
  return `Preparing your ${place} journey…`;
}

// -- tiny color helpers (no dependency needed) -------------------------------
function parse(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export function hexA(hex: string, alpha: number): string {
  const [r, g, b] = parse(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
export function shade(hex: string, amount: number): string {
  const [r, g, b] = parse(hex);
  const f = (v: number) => Math.min(255, Math.max(0, Math.round(v + amount)));
  return `rgb(${f(r)}, ${f(g)}, ${f(b)})`;
}