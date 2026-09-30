import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { C, ease, sans, serif, tween } from "./brand";

// ------------------------------------------------------------------ grounds

/** Warm paper with a soft vignette, like a page of a travel book. */
export const Paper: React.FC = () => (
  <AbsoluteFill
    style={{
      backgroundColor: C.paper,
      backgroundImage:
        "radial-gradient(ellipse 85% 95% at 50% 40%, rgba(255,253,247,0.6) 0%, rgba(255,253,247,0) 58%, rgba(96,70,40,0.12) 100%)",
    }}
  />
);

/** Film grain over the whole cut, re-seeded every other frame so it reads as film, not static. */
export const Grain: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill
      style={{
        mixBlendMode: "soft-light",
        opacity: 0.5,
        pointerEvents: "none",
      }}
    >
      <svg width="100%" height="100%">
        <filter id="wayfare-grain" x="0" y="0" width="100%" height="100%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.8"
            numOctaves={2}
            seed={Math.floor(frame / 2)}
            stitchTiles="stitch"
          />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#wayfare-grain)" />
      </svg>
    </AbsoluteFill>
  );
};

// ------------------------------------------------------------- type in motion

/** A headline set word by word, each rising out of its own mask. `*word*` is italic, `_word_` vermilion. */
export const Words: React.FC<{
  lines: string[];
  at: number;
  out?: number;
  stagger?: number;
  style?: React.CSSProperties;
}> = ({ lines, at, out, stagger = 3, style }) => {
  const frame = useCurrentFrame();
  let n = 0;
  return (
    <div
      style={{
        fontFamily: serif,
        fontWeight: 500,
        color: C.ink,
        letterSpacing: "-0.03em",
        lineHeight: 1.02,
        ...style,
      }}
    >
      {lines.map((line, li) => (
        <div key={li} style={{ whiteSpace: "nowrap" }}>
          {line.split(" ").map((raw, wi) => {
            const i = n++;
            const t = at + i * stagger;
            const gone = out === undefined ? Infinity : out + i * 2 + 16;
            const leave =
              out === undefined
                ? 0
                : tween(frame, [out + i * 2, gone], [0, -140], ease.in);
            return (
              <React.Fragment key={wi}>
                {wi ? " " : null}
                <span
                  style={{
                    display: "inline-block",
                    overflow: "hidden",
                    verticalAlign: "top",
                    padding: "0.1em 0.08em 0.18em",
                    margin: "-0.1em -0.08em -0.18em",
                  }}
                >
                  <span
                    style={{
                      display: "inline-block",
                      // Fully below/above the mask when out of play, and hidden outright: ascenders and descenders overshoot the line box.
                      opacity: frame < t || frame >= gone ? 0 : 1,
                      translate: `0 ${tween(frame, [t, t + 26], [140, 0]) + leave}%`,
                      fontStyle: raw.startsWith("*") ? "italic" : undefined,
                      fontWeight: raw.startsWith("*") ? 400 : undefined,
                      color: raw.startsWith("_") ? C.accent : undefined,
                    }}
                  >
                    {raw.replace(/[*_]/g, "")}
                  </span>
                </span>
              </React.Fragment>
            );
          })}
        </div>
      ))}
    </div>
  );
};

/** The small-caps kicker over a headline, led by a vermilion rule that draws in. */
export const Eyebrow: React.FC<{ at: number; children: React.ReactNode }> = ({
  at,
  children,
}) => {
  const frame = useCurrentFrame();
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
      <div
        style={{
          width: 46,
          height: 3,
          background: C.accent,
          scale: `${tween(frame, [at, at + 18], [0, 1])} 1`,
          transformOrigin: "0 50%",
        }}
      />
      <div
        style={{
          fontFamily: sans,
          fontWeight: 600,
          fontSize: 24,
          letterSpacing: "0.22em",
          textTransform: "uppercase",
          color: C.ink3,
          opacity: tween(frame, [at + 6, at + 20], [0, 1]),
          translate: `${tween(frame, [at + 6, at + 26], [-14, 0])}px 0`,
        }}
      >
        {children}
      </div>
    </div>
  );
};

/** Rises out of a soft blur. */
export const Fade: React.FC<{
  at: number;
  y?: number;
  children: React.ReactNode;
  style?: React.CSSProperties;
}> = ({ at, y = 26, children, style }) => {
  const frame = useCurrentFrame();
  const p = tween(frame, [at, at + 24], [0, 1]);
  return (
    <div
      style={{
        opacity: p,
        translate: `0 ${(1 - p) * y}px`,
        filter: `blur(${(1 - p) * 10}px)`,
        ...style,
      }}
    >
      {children}
    </div>
  );
};

/** Supporting copy under a headline. */
export const lede: React.CSSProperties = {
  fontFamily: sans,
  fontSize: 42,
  lineHeight: 1.4,
  color: C.ink2,
};

// ------------------------------------------------------------ floating cards

/** A floating card built like hardware: a frosted hairline shell holding a raised core. */
export const Bezel: React.FC<{
  children: React.ReactNode;
  pad?: number | string;
}> = ({ children, pad = 28 }) => (
  <div
    style={{
      padding: 7,
      borderRadius: 30,
      background: "rgba(244,241,234,0.55)",
      backdropFilter: "blur(14px)",
      boxShadow:
        "0 0 0 1px rgba(28,27,24,0.08), 0 44px 80px -34px rgba(70,46,20,0.42), 0 14px 28px -14px rgba(70,46,20,0.2)",
    }}
  >
    <div
      style={{
        borderRadius: 23,
        background: C.raised,
        padding: pad,
        boxShadow:
          "inset 0 1px 1px rgba(255,255,255,0.9), 0 0 0 1px rgba(28,27,24,0.06)",
      }}
    >
      {children}
    </div>
  </div>
);

// ------------------------------------------------------------------ the phone

export const SCREEN = { w: 390, h: 844 };

/** A phone with real depth: stacked slices give it a rounded edge that turns with it. */
export const Phone: React.FC<{
  children: React.ReactNode;
  rx?: number;
  ry?: number;
  style?: React.CSSProperties;
}> = ({ children, rx = 0, ry = 0, style }) => {
  const R = 62;
  const B = 12;
  return (
    <div
      style={{
        position: "absolute",
        width: SCREEN.w + B * 2,
        height: SCREEN.h + B * 2,
        perspective: 2600,
        ...style,
      }}
    >
      <div
        style={{
          position: "absolute",
          left: "10%",
          right: "10%",
          bottom: -46,
          height: 80,
          borderRadius: "50%",
          background: "rgba(56,38,20,0.32)",
          filter: "blur(34px)",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          transformStyle: "preserve-3d",
          transform: `rotateX(${rx}deg) rotateY(${ry}deg)`,
        }}
      >
        {Array.from({ length: 12 }, (_, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: R,
              background: i < 3 ? "#5B5650" : "#26231F",
              transform: `translateZ(${-(i + 1) * 1.1}px)`,
            }}
          />
        ))}
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: R,
            padding: B,
            background:
              "linear-gradient(150deg, #4B4640 0%, #1C1B18 24%, #151410 72%, #36322D 100%)",
            boxShadow:
              "inset 0 0 0 1.5px rgba(255,255,255,0.16), inset 0 0 0 4px #0D0C0A",
          }}
        >
          <div
            style={{
              position: "relative",
              width: SCREEN.w,
              height: SCREEN.h,
              borderRadius: R - B,
              overflow: "hidden",
              background: C.paper,
            }}
          >
            {children}
            <div
              style={{
                position: "absolute",
                top: 11,
                left: SCREEN.w / 2 - 60,
                width: 120,
                height: 34,
                borderRadius: 17,
                background: "#0A0A09",
              }}
            />
            <div
              style={{
                position: "absolute",
                inset: 0,
                background:
                  "linear-gradient(118deg, rgba(255,255,255,0.2) 0%, rgba(255,255,255,0.05) 26%, rgba(255,255,255,0) 46%)",
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

// The app's own type scale (mobile/shared/theme.ts `type`), in points = CSS px on the 390-wide screen.
const TYPE = {
  title: {
    fontFamily: serif,
    fontWeight: 500,
    fontSize: 30,
    lineHeight: "34px",
    letterSpacing: -0.5,
  },
  heading: {
    fontFamily: serif,
    fontWeight: 500,
    fontSize: 22,
    lineHeight: "27px",
    letterSpacing: -0.2,
  },
  entry: {
    fontFamily: serif,
    fontWeight: 500,
    fontSize: 19,
    lineHeight: "24px",
    letterSpacing: -0.1,
  },
  aside: {
    fontFamily: serif,
    fontStyle: "italic",
    fontSize: 15,
    lineHeight: "20px",
  },
  body: { fontFamily: sans, fontSize: 15, lineHeight: "22px" },
  bodyStrong: {
    fontFamily: sans,
    fontWeight: 600,
    fontSize: 15,
    lineHeight: "22px",
  },
  meta: { fontFamily: sans, fontWeight: 500, fontSize: 13, lineHeight: "18px" },
  small: { fontFamily: sans, fontSize: 12, lineHeight: "16px" },
  label: {
    fontFamily: sans,
    fontWeight: 600,
    fontSize: 11,
    lineHeight: "14px",
    letterSpacing: 1.1,
    textTransform: "uppercase",
  },
  figure: {
    fontFamily: serif,
    fontWeight: 500,
    fontSize: 44,
    lineHeight: "48px",
    letterSpacing: -1,
  },
} satisfies Record<string, React.CSSProperties>;

/** Text in the app's type scale. */
export const T: React.FC<{
  v: keyof typeof TYPE;
  c?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}> = ({ v, c = C.ink, style, children }) => (
  <div
    style={{
      ...TYPE[v],
      color: c,
      fontVariantNumeric: "tabular-nums",
      ...style,
    }}
  >
    {children}
  </div>
);

const ICONS = {
  back: <polyline points="15 5 8 12 15 19" />,
  plus: <path d="M12 5v14M5 12h14" />,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  check: <polyline points="5 12.5 10 17 19 7" />,
  alert: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7.5v5.5" />
      <circle cx="12" cy="16.4" r="0.4" />
    </>
  ),
  more: (
    <>
      <circle cx="5.5" cy="12" r="0.9" />
      <circle cx="12" cy="12" r="0.9" />
      <circle cx="18.5" cy="12" r="0.9" />
    </>
  ),
  arrow: <path d="M7 17L17 7M9 7h8v8" />,
};

/** Fine-line icons in the spirit of the app's Ionicons outlines. */
export const Icon: React.FC<{
  name: keyof typeof ICONS;
  size?: number;
  color?: string;
  style?: React.CSSProperties;
}> = ({ name, size = 18, color = C.ink, style }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth={1.9}
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ flexShrink: 0, ...style }}
  >
    {ICONS[name]}
  </svg>
);

/** The phone's status bar. */
export const StatusBar: React.FC<{ time: string }> = ({ time }) => (
  <div
    style={{
      height: 54,
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "6px 30px 0 36px",
    }}
  >
    <div
      style={{
        fontFamily: sans,
        fontWeight: 600,
        fontSize: 16,
        color: C.ink,
        fontVariantNumeric: "tabular-nums",
      }}
    >
      {time}
    </div>
    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
      <svg width="18" height="12" viewBox="0 0 18 12">
        {[0, 1, 2, 3].map((i) => (
          <rect
            key={i}
            x={i * 4.7}
            y={8.5 - i * 2.8}
            width="3.2"
            height={3.5 + i * 2.8}
            rx="0.9"
            fill={C.ink}
          />
        ))}
      </svg>
      <svg
        width="16"
        height="12"
        viewBox="0 0 16 12"
        fill="none"
        stroke={C.ink}
        strokeWidth="1.8"
        strokeLinecap="round"
      >
        <path d="M1.6 4.4a9.4 9.4 0 0 1 12.8 0M4.2 7.2a5.6 5.6 0 0 1 7.6 0" />
        <circle cx="8" cy="10" r="1.1" fill={C.ink} stroke="none" />
      </svg>
      <svg width="27" height="13" viewBox="0 0 27 13">
        <rect
          x="0.5"
          y="0.5"
          width="23"
          height="12"
          rx="3.6"
          fill="none"
          stroke={C.ink}
          strokeOpacity="0.4"
        />
        <rect x="2.5" y="2.5" width="16" height="8" rx="2" fill={C.ink} />
        <rect
          x="24.8"
          y="4.3"
          width="1.6"
          height="4.4"
          rx="0.8"
          fill={C.ink}
          fillOpacity="0.4"
        />
      </svg>
    </div>
  </div>
);

/** The trip masthead (TripChrome.tsx): which trip, which day. */
export const Masthead: React.FC = () => (
  <div style={{ padding: "0 20px" }}>
    <div
      style={{
        height: 44,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", marginLeft: -6 }}>
        <Icon name="back" size={22} />
        <T v="meta">Trips</T>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        <T v="meta">Trip</T>
        <Icon name="more" size={18} />
      </div>
    </div>
    <div style={{ paddingTop: 2, paddingBottom: 10 }}>
      <T v="title">Tokyo &amp; Kyoto</T>
      <T v="meta" c={C.ink2} style={{ marginTop: 2 }}>
        Tokyo · Kyoto · Apr 6 – Apr 11 ·{" "}
        <span style={{ color: C.accent }}>Day 2 of 6</span>
      </T>
    </div>
  </div>
);

/** Plan · Map · Spend, the accent line over the open tab, and the Expense shortcut. */
export const TabBar: React.FC<{ active: "Plan" | "Map" | "Spend" }> = ({
  active,
}) => (
  <div
    style={{
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 0,
      display: "flex",
      alignItems: "center",
      padding: "8px 10px 34px",
      borderTop: `1px solid ${C.rule}`,
      background: C.paper,
    }}
  >
    {(["Plan", "Map", "Spend"] as const).map((tab) => (
      <div
        key={tab}
        style={{
          position: "relative",
          padding: "0 10px",
          height: 44,
          display: "flex",
          alignItems: "center",
        }}
      >
        <T
          v="bodyStrong"
          c={tab === active ? C.ink : C.ink3}
          style={{ fontSize: 16 }}
        >
          {tab}
        </T>
        {tab === active ? (
          <div
            style={{
              position: "absolute",
              top: -9,
              left: 10,
              right: 10,
              height: 2,
              background: C.accent,
            }}
          />
        ) : null}
      </div>
    ))}
    <div style={{ flex: 1 }} />
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        height: 44,
        padding: "0 14px",
        marginRight: 10,
        borderRadius: 8,
        background: C.accent,
      }}
    >
      <Icon name="plus" size={18} color="#fff" />
      <T v="bodyStrong" c="#fff">
        Expense
      </T>
    </div>
  </div>
);

/** A fingertip: a press, then a ring that spreads and fades. Place it inside the target. */
export const Tap: React.FC<{ at: number }> = ({ at }) => {
  const frame = useCurrentFrame();
  if (frame < at - 8 || frame > at + 26) return null;
  const press =
    tween(frame, [at - 8, at], [0, 1]) *
    (1 - tween(frame, [at + 4, at + 14], [0, 1]));
  const ring = tween(frame, [at, at + 24], [0, 1]);
  return (
    <div
      style={{
        position: "absolute",
        left: "50%",
        top: "50%",
        width: 0,
        height: 0,
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          position: "absolute",
          left: -24,
          top: -24,
          width: 48,
          height: 48,
          borderRadius: 24,
          background: "rgba(28,27,24,0.22)",
          opacity: press,
          scale: `${0.7 + 0.3 * press}`,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: -24,
          top: -24,
          width: 48,
          height: 48,
          borderRadius: 24,
          border: "2px solid rgba(28,27,24,0.3)",
          opacity: ring > 0 ? 1 - ring : 0,
          scale: `${1 + ring * 1.5}`,
        }}
      />
    </div>
  );
};
