// Wayfare 2.0 Design System & Editorial Theme Engine
// Inspired by modern travel publications, Monocle, Airbnb, and Polarsteps.
// Warm paper, sandstone, deep charcoal, botanical forest, and curated destination palettes.

export type DestinationEnv = "fuji" | "paris" | "rome" | "tropics" | "hanok" | "peaks";

export type DestinationTheme = {
  key: string;
  country: string;
  city: string;
  accent: string; // Primary editorial accent (e.g. Terracotta, Vermillion)
  accentLight: string; // Soft tinted surface (e.g. #F7ECE8)
  secondary: string;
  secondaryLight: string;
  surfaceMuted: string;
  border: string;
  motifs: string[];
  env: DestinationEnv;
  tagline: string;
  // Backward compatibility fields
  glowA?: string;
  glowB?: string;
  deep?: string;
  surface?: string;
  accent2?: string;
};

export const TRAVEL_THEME = {
  colors: {
    bg: "#FAF8F5", // Warm canvas paper
    bgMuted: "#F4F0E8", // Sandstone base
    surface: "#FFFFFF", // Crisp card surface
    surfaceWarm: "#F7F4EE",
    surfaceDark: "#1C1917", // Deep charcoal card for cinematic contrast
    border: "#E7E2D8", // Warm stone hairline
    borderSubtle: "#EFECE4",
    borderStrong: "#D3CBBD",
    
    // Typography
    inkPrimary: "#1C1917", // Deep charcoal (softer than #000)
    inkSecondary: "#57534E", // Warm dark gray
    inkMuted: "#78716C", // Scannable metadata
    inkDim: "#A8A29E", // Subtle indicators
    inkLight: "#FAF8F5", // Light text on dark surfaces
    inkLightMuted: "rgba(255, 255, 255, 0.72)",

    // Semantic accents
    terracotta: "#C2593F",
    terracottaDark: "#9E3A24",
    terracottaLight: "#F7ECE8",

    forest: "#2D5A4C",
    forestDark: "#1E3D34",
    forestLight: "#EAF1ED",

    ocean: "#2B4C6F",
    oceanDark: "#1B344D",
    oceanLight: "#EBF1F8",

    amber: "#D9822B",
    amberDark: "#B36518",
    amberLight: "#FCF3E8",

    success: "#2D5A4C",
    successLight: "#EAF1ED",
    danger: "#C24136",
    dangerLight: "#FBEBEA",
    warning: "#D9822B",
    warningLight: "#FCF3E8",
    info: "#2B4C6F",
    infoLight: "#EBF1F8",
  },
  shadows: {
    card: {
      shadowColor: "#2A2521",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 8,
      elevation: 2,
    },
    hover: {
      shadowColor: "#2A2521",
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.08,
      shadowRadius: 16,
      elevation: 4,
    },
    modal: {
      shadowColor: "#1C1917",
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: 0.14,
      shadowRadius: 28,
      elevation: 10,
    },
  },
  radii: {
    xs: 6,
    sm: 10,
    md: 14,
    lg: 20,
    xl: 26,
    full: 9999,
  },
};

// Backward-compatible alias for existing imports
export const OLED_COLORS = {
  bg: TRAVEL_THEME.colors.bg,
  bgElevated: TRAVEL_THEME.colors.surfaceWarm,
  surfaceCard: TRAVEL_THEME.colors.surface,
  surfaceFloating: TRAVEL_THEME.colors.surface,
  surfaceActive: TRAVEL_THEME.colors.bgMuted,
  borderSubtle: TRAVEL_THEME.colors.borderSubtle,
  borderHighlight: TRAVEL_THEME.colors.border,
  textPrimary: TRAVEL_THEME.colors.inkPrimary,
  textSecondary: TRAVEL_THEME.colors.inkSecondary,
  textMuted: TRAVEL_THEME.colors.inkMuted,
  textDim: TRAVEL_THEME.colors.inkDim,
  wayfareLime: TRAVEL_THEME.colors.forest,
  wayfareMint: TRAVEL_THEME.colors.forest,
  danger: TRAVEL_THEME.colors.danger,
  success: TRAVEL_THEME.colors.success,
  warning: TRAVEL_THEME.colors.warning,
  info: TRAVEL_THEME.colors.info,
};

const THEMES: Record<string, DestinationTheme> = {
  japan: {
    key: "japan",
    country: "Japan",
    city: "Tokyo",
    accent: "#C43C35", // Japanese vermillion
    accentLight: "#FAECEB",
    secondary: "#2D5A4C", // Bamboo forest
    secondaryLight: "#EAF1ED",
    surfaceMuted: "#F5F0EA",
    border: "#E5DDD3",
    motifs: ["sakura", "torii", "washi", "gardens"],
    env: "fuji",
    tagline: "Between ancient quiet and urban rhythm.",
    glowA: "#C43C35",
    glowB: "#2D5A4C",
    accent2: "#2D5A4C",
    deep: "#1C1917",
    surface: "#FFFFFF",
  },
  italy: {
    key: "italy",
    country: "Italy",
    city: "Rome",
    accent: "#C2593F", // Terracotta
    accentLight: "#F7ECE8",
    secondary: "#D48D3B", // Travertine ochre
    secondaryLight: "#FCF3E8",
    surfaceMuted: "#F6F1EA",
    border: "#E7DFD4",
    motifs: ["travertine", "piazza", "espresso", "cypress"],
    env: "rome",
    tagline: "Golden stone and long Mediterranean afternoons.",
    glowA: "#C2593F",
    glowB: "#D48D3B",
    accent2: "#D48D3B",
    deep: "#1C1917",
    surface: "#FFFFFF",
  },
  france: {
    key: "france",
    country: "France",
    city: "Paris",
    accent: "#2B4C6F", // Haussmann zinc blue
    accentLight: "#EBF1F8",
    secondary: "#A6596A", // Muted rose
    secondaryLight: "#F9ECEF",
    surfaceMuted: "#F4EFF2",
    border: "#E3DBDF",
    motifs: ["zinc rooftops", "bistro", "seine", "croissant"],
    env: "paris",
    tagline: "An editorial stroll through stone and zinc.",
    glowA: "#2B4C6F",
    glowB: "#A6596A",
    accent2: "#A6596A",
    deep: "#1C1917",
    surface: "#FFFFFF",
  },
  philippines: {
    key: "philippines",
    country: "Philippines",
    city: "Manila",
    accent: "#1A7A70", // Tropical emerald sea
    accentLight: "#E8F4F2",
    secondary: "#DF7A32", // Island sunset
    secondaryLight: "#FCEEE3",
    surfaceMuted: "#F2F5F3",
    border: "#DBE3DF",
    motifs: ["capiz", "coastal breeze", "islands", "sunlight"],
    env: "tropics",
    tagline: "Warm waters, sea breeze, and vibrant island life.",
    glowA: "#1A7A70",
    glowB: "#DF7A32",
    accent2: "#DF7A32",
    deep: "#1C1917",
    surface: "#FFFFFF",
  },
  korea: {
    key: "korea",
    country: "South Korea",
    city: "Seoul",
    accent: "#2C4673", // Hanok indigo
    accentLight: "#ECEFF6",
    secondary: "#C8523B", // Dancheong rust
    secondaryLight: "#FAECE8",
    surfaceMuted: "#F1F2F5",
    border: "#DBDFE7",
    motifs: ["hanok", "mountain mist", "tea houses", "night markets"],
    env: "hanok",
    tagline: "Mountain shrines meeting modern energy.",
    glowA: "#2C4673",
    glowB: "#C8523B",
    accent2: "#C8523B",
    deep: "#1C1917",
    surface: "#FFFFFF",
  },
};

const MATCHERS: [RegExp, string][] = [
  [/japan|toky|kyoto|osaka|nippon|nara/i, "japan"],
  [/italy|italia|rome|roma|florence|venice|venezia|amalfi|milan|naples/i, "italy"],
  [/france|paris|provence|lyon|nice|riviera/i, "france"],
  [/philippin|manila|palawan|cebu|boracay|siargao/i, "philippines"],
  [/korea|seoul|busan|jeju/i, "korea"],
];

const GENERIC: Record<string, DestinationTheme> = {
  sakura: { ...THEMES.japan, key: "generic", country: "", tagline: "Your next chapter begins here." },
  sunset: { ...THEMES.italy, key: "generic", country: "", tagline: "Your next chapter begins here." },
  teal: {
    key: "generic",
    country: "",
    city: "",
    accent: "#2D5A4C",
    accentLight: "#EAF1ED",
    secondary: "#2B4C6F",
    secondaryLight: "#EBF1F8",
    surfaceMuted: "#F3F0EA",
    border: "#E5DDD3",
    motifs: ["ridgelines", "compass", "open sky"],
    env: "peaks",
    tagline: "Your next chapter begins here.",
    glowA: "#2D5A4C",
    glowB: "#2B4C6F",
    accent2: "#2B4C6F",
    deep: "#1C1917",
    surface: "#FFFFFF",
  },
  midnight: { ...THEMES.korea, key: "generic", country: "", tagline: "Your next chapter begins here." },
  amber: { ...THEMES.italy, key: "generic", country: "", tagline: "Your next chapter begins here." },
  dune: { ...THEMES.philippines, key: "generic", country: "", tagline: "Your next chapter begins here." },
};

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
  const generic = (coverTheme && GENERIC[coverTheme]) || GENERIC.teal;
  return {
    ...generic,
    city: destinations[0]?.name ?? "",
    country: destinations[0]?.country ?? generic.country,
  };
}

export function hexA(hex: string, alpha: number): string {
  if (!hex) return `rgba(28, 25, 23, ${alpha})`;
  if (hex.startsWith("rgba")) return hex;
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  if (isNaN(n)) return `rgba(28, 25, 23, ${alpha})`;
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

// ------------------------------------------------------------- Formatters & Tokens

export const TABULAR_NUMS = { fontVariant: ["tabular-nums" as const] };

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

export function daysUntil(iso: string): number {
  return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000));
}

export function tripDayCount(startIso: string, endIso: string): number {
  return Math.round((new Date(endIso).getTime() - new Date(startIso).getTime()) / 86400000) + 1;
}

export function fmtClock(minutes: number | null): string {
  if (minutes == null) return "--:--";
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

export function fmtDate(iso: string, opts?: Intl.DateTimeFormatOptions): string {
  return new Date(iso).toLocaleDateString("en-US", opts ?? { month: "short", day: "numeric" });
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