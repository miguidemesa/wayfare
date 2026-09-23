import { cn } from "@/lib/utils";

/**
 * Destination cover art — bespoke editorial palettes with film grain
 * and subtle geometric architectural depth.
 */

const THEMES: Record<string, { layers: string; accent: string; label: string }> = {
  sakura: {
    layers: `
      radial-gradient(110% 90% at 85% -10%, rgba(244, 168, 196, 0.45) 0%, transparent 60%),
      radial-gradient(90% 80% at -10% 20%, rgba(251, 146, 170, 0.35) 0%, transparent 55%),
      radial-gradient(120% 120% at 50% 110%, rgba(94, 234, 212, 0.25) 0%, transparent 50%),
      linear-gradient(145deg, #0d131f 0%, #1e1b38 45%, #2a244d 100%)`,
    accent: "#f4a8c4",
    label: "Sakura Dusk",
  },
  sunset: {
    layers: `
      radial-gradient(110% 90% at 90% 0%, rgba(251, 191, 36, 0.4) 0%, transparent 55%),
      radial-gradient(100% 100% at 0% 100%, rgba(225, 29, 72, 0.35) 0%, transparent 60%),
      radial-gradient(80% 80% at 100% 100%, rgba(124, 58, 237, 0.25) 0%, transparent 50%),
      linear-gradient(145deg, #1c1412 0%, #431407 50%, #701a06 100%)`,
    accent: "#fbbf24",
    label: "Amalfi Sunset",
  },
  amber: {
    layers: `
      radial-gradient(120% 100% at 10% -10%, rgba(252, 211, 77, 0.35) 0%, transparent 55%),
      radial-gradient(90% 90% at 95% 30%, rgba(234, 88, 12, 0.3) 0%, transparent 60%),
      radial-gradient(110% 110% at 50% 115%, rgba(22, 101, 52, 0.25) 0%, transparent 50%),
      linear-gradient(145deg, #1c1917 0%, #292524 55%, #382e2b 100%)`,
    accent: "#f59e0b",
    label: "Autumn Amber",
  },
  teal: {
    layers: `
      radial-gradient(110% 90% at 85% -10%, rgba(45, 212, 191, 0.35) 0%, transparent 55%),
      radial-gradient(90% 80% at 0% 30%, rgba(56, 189, 248, 0.25) 0%, transparent 55%),
      radial-gradient(120% 120% at 60% 115%, rgba(19, 78, 74, 0.35) 0%, transparent 50%),
      linear-gradient(145deg, #042423 0%, #06403d 50%, #0c4a6e 100%)`,
    accent: "#2dd4bf",
    label: "Nordic Mist",
  },
  midnight: {
    layers: `
      radial-gradient(110% 90% at 80% -10%, rgba(167, 139, 250, 0.3) 0%, transparent 55%),
      radial-gradient(90% 80% at 10% 30%, rgba(56, 189, 248, 0.2) 0%, transparent 55%),
      linear-gradient(145deg, #090c14 0%, #0f172a 60%, #1e1b4b 100%)`,
    accent: "#a78bfa",
    label: "Tokyo Midnight",
  },
  dune: {
    layers: `
      radial-gradient(110% 90% at 85% -10%, rgba(245, 158, 11, 0.35) 0%, transparent 55%),
      radial-gradient(90% 80% at 0% 40%, rgba(180, 83, 9, 0.3) 0%, transparent 55%),
      linear-gradient(145deg, #1c1409 0%, #2e1d0f 60%, #452414 100%)`,
    accent: "#f59e0b",
    label: "Sahara Dune",
  },
};

export const COVER_THEME_KEYS = Object.keys(THEMES);

export function CoverArt({
  theme = "teal",
  emoji,
  className,
  children,
  size = "md",
}: {
  theme?: string;
  emoji?: string;
  className?: string;
  children?: React.ReactNode;
  size?: "sm" | "md" | "lg";
}) {
  const t = THEMES[theme] ?? THEMES.teal;
  return (
    <div
      className={cn(
        "relative overflow-hidden isolate ring-1 ring-inset ring-white/10",
        className
      )}
      style={{ background: t.layers }}
      aria-hidden={children ? undefined : true}
    >
      {/* Film grain overlay */}
      <svg className="absolute inset-0 h-full w-full opacity-[0.14] mix-blend-overlay pointer-events-none" aria-hidden>
        <filter id={`grain-${theme}`}>
          <feTurbulence type="fractalNoise" baseFrequency="0.75" numOctaves="2" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter={`url(#grain-${theme})`} />
      </svg>

      {/* Subtle architectural grid lines */}
      <div
        className="absolute inset-0 opacity-[0.05] pointer-events-none"
        style={{
          backgroundImage: `linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)`,
          backgroundSize: "32px 32px",
        }}
      />

      {/* Ambient glow */}
      <div
        className="absolute -bottom-16 left-1/2 h-36 w-[120%] -translate-x-1/2 rounded-[100%] blur-2xl opacity-60 pointer-events-none"
        style={{ background: t.accent }}
      />

      {/* Refined Frosted Insignia Seal */}
      {emoji ? (
        <div
          className={cn(
            "absolute right-3.5 bottom-3.5 flex items-center justify-center rounded-full border border-white/20 bg-black/30 backdrop-blur-md shadow-xs select-none",
            size === "sm" && "h-7 w-7 text-xs",
            size === "md" && "h-10 w-10 text-lg",
            size === "lg" && "h-14 w-14 text-2xl"
          )}
        >
          <span className="leading-none drop-shadow-xs">{emoji}</span>
        </div>
      ) : null}

      {children}
    </div>
  );
}

/** Small square avatar-style cover used in lists. */
export function CoverThumb({
  theme,
  emoji,
  className,
}: {
  theme?: string;
  emoji?: string;
  className?: string;
}) {
  return (
    <CoverArt theme={theme} emoji={emoji} size="sm" className={cn("rounded-xl shrink-0 h-10 w-10", className)}>
      <span className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/35 to-transparent pointer-events-none" />
    </CoverArt>
  );
}
