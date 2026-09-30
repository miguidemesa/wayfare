import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { C, ease, tween } from "../brand";
import {
  Eyebrow,
  Fade,
  lede,
  Paper,
  Phone,
  StatusBar,
  T,
  Tap,
  Words,
} from "../ui";

// The planner drafting the seeded "Tokyo & Kyoto" trip, laid out as
// mobile/app/trips/[tripId]/suggest.tsx shows it: set up, drafting, the draft.

type Stop = {
  time: string;
  title: string;
  where: string;
  long: string;
  why?: string;
  leg?: string;
};

const DRAFT: { day: string; title: string; stops: Stop[] }[] = [
  {
    day: "Day 1 · Tuesday, April 6",
    title: "Asakusa evening",
    stops: [
      {
        time: "16:30",
        title: "Sumida Park",
        where: "Asakusa",
        long: "45 min",
        why: "Near your hotel, for an easy first evening.",
        leg: "10 min on foot",
      },
      {
        time: "18:00",
        title: "Hoppy Street",
        where: "Asakusa",
        long: "1h 30m",
        why: "Casual dinner, no booking needed.",
      },
    ],
  },
  {
    day: "Day 2 · Wednesday, April 7",
    title: "Asakusa & Ueno",
    stops: [
      {
        time: "08:00",
        title: "Senso-ji",
        where: "Asakusa",
        long: "1h",
        why: "Early, before the crowds.",
        leg: "10 min on foot",
      },
      {
        time: "09:10",
        title: "Kappabashi Street",
        where: "Asakusa",
        long: "45 min",
        leg: "16 min on foot",
      },
      {
        time: "10:15",
        title: "Ameyoko",
        where: "Ueno",
        long: "1h",
        why: "Snacks as the stalls open.",
        leg: "13 min on foot",
      },
      {
        time: "11:30",
        title: "Tokyo National Museum",
        where: "Ueno",
        long: "2h",
        why: "One of your must-dos.",
        leg: "17 min on foot",
      },
      {
        time: "14:00",
        title: "Yanaka Ginza",
        where: "Yanaka",
        long: "1h 30m",
        why: "A late lunch on the old shopping street.",
      },
    ],
  },
  {
    day: "Day 3 · Thursday, April 8",
    title: "Harajuku & Shibuya",
    stops: [
      {
        time: "09:00",
        title: "Meiji Jingu",
        where: "Harajuku",
        long: "1h 15m",
        leg: "12 min on foot",
      },
    ],
  },
];

const Chip: React.FC<{ on?: boolean; children: React.ReactNode }> = ({
  on,
  children,
}) => (
  <div
    style={{
      height: 36,
      padding: "0 12px",
      display: "flex",
      alignItems: "center",
      borderRadius: 4,
      border: `1px solid ${on ? C.ink : C.edge}`,
      background: on ? C.ink : C.raised,
    }}
  >
    <T v="meta" c={on ? C.paper : C.ink2}>
      {children}
    </T>
  </div>
);

const Setup: React.FC = () => {
  const f = useCurrentFrame();
  const press = tween(f, [32, 38], [0, 1]) * (1 - tween(f, [40, 46], [0, 1]));
  return (
    <div
      style={{
        padding: "24px 20px 0",
        display: "flex",
        flexDirection: "column",
        gap: 24,
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <T v="title">A plan for Tokyo and Kyoto</T>
        <T v="body" c={C.ink2}>
          Wayfare plans from what you told it: your must-dos first, each day
          starting near where you’re staying, at your pace, with meals at
          sensible times. You’ll see it before anything changes.
        </T>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <T v="label" c={C.ink3}>
          Pace
        </T>
        <div style={{ display: "flex", gap: 6 }}>
          <Chip>Relaxed</Chip>
          <Chip on>Balanced</Chip>
          <Chip>Packed</Chip>
        </div>
        <T v="small" c={C.ink3}>
          A full day with room to wander.
        </T>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <T v="label" c={C.ink3}>
          Leaning towards
        </T>
        <T v="meta" c={C.ink2}>
          Food, temples, old neighborhoods
        </T>
      </div>
      <div
        style={{
          position: "relative",
          height: 52,
          borderRadius: 8,
          background: C.ink,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          scale: `${1 - press * 0.03}`,
        }}
      >
        <T v="bodyStrong" c={C.paper} style={{ fontSize: 16 }}>
          Draft it
        </T>
        <Tap at={38} />
      </div>
    </div>
  );
};

const Preview: React.FC = () => {
  const f = useCurrentFrame();
  let k = 0;
  const enter = (): React.CSSProperties => {
    const at = 66 + k++ * 4;
    return {
      opacity: tween(f, [at, at + 10], [0, 1]),
      translate: `0 ${tween(f, [at, at + 14], [14, 0])}px`,
    };
  };
  return (
    <div style={{ paddingBottom: 48 }}>
      <div
        style={{
          padding: "24px 20px 16px",
          display: "flex",
          flexDirection: "column",
          gap: 6,
        }}
      >
        <T v="title">Here’s a draft</T>
        <T v="meta" c={C.ink2}>
          17 stops · about 4h 10m getting around · ~¥52,400 in entry and meals
        </T>
      </div>
      {DRAFT.map((d) => (
        <div key={d.day} style={{ marginBottom: 16 }}>
          <div style={{ padding: "8px 20px", ...enter() }}>
            <T v="label" c={C.ink3}>
              {d.day}
            </T>
            <T v="heading" style={{ marginTop: 2 }}>
              {d.title}
            </T>
          </div>
          <div style={{ height: 1, background: C.rule, margin: "0 20px" }} />
          {d.stops.map((s) => (
            <div key={s.title} style={{ padding: "0 20px", ...enter() }}>
              <div style={{ display: "flex", padding: "10px 0" }}>
                <T v="meta" style={{ width: 58 }}>
                  {s.time}
                </T>
                <div style={{ flex: 1 }}>
                  <T v="bodyStrong">{s.title}</T>
                  <T v="small" c={C.ink3}>
                    {s.where} · {s.long}
                  </T>
                  {s.why ? (
                    <T
                      v="aside"
                      c={C.ink2}
                      style={{ marginTop: 2, fontSize: 14, lineHeight: "19px" }}
                    >
                      {s.why}
                    </T>
                  ) : null}
                </div>
              </div>
              {s.leg ? (
                <T
                  v="aside"
                  c={C.ink3}
                  style={{ paddingLeft: 58, fontSize: 13 }}
                >
                  {s.leg}
                </T>
              ) : null}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
};

const Screen: React.FC = () => {
  const f = useCurrentFrame();
  const setup = 1 - tween(f, [44, 50], [0, 1]);
  const drafting =
    tween(f, [46, 52], [0, 1]) * (1 - tween(f, [60, 66], [0, 1]));
  const preview = tween(f, [62, 68], [0, 1]);
  return (
    <>
      <StatusBar time="21:40" />
      <div
        style={{
          height: 54,
          display: "flex",
          alignItems: "center",
          padding: "0 20px",
          borderBottom: `1px solid ${C.rule}`,
        }}
      >
        <T v="meta" c={C.ink2} style={{ minWidth: 64 }}>
          Cancel
        </T>
        <T v="bodyStrong" style={{ flex: 1, textAlign: "center" }}>
          Draft a plan
        </T>
        <div style={{ minWidth: 64 }} />
      </div>
      <div
        style={{
          position: "absolute",
          top: 108,
          left: 0,
          right: 0,
          bottom: 0,
          overflow: "hidden",
        }}
      >
        {setup > 0 ? (
          <div style={{ opacity: setup }}>
            <Setup />
          </div>
        ) : null}
        {drafting > 0 ? (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 12,
              paddingBottom: 90,
              opacity: drafting,
            }}
          >
            <svg
              width="26"
              height="26"
              viewBox="0 0 26 26"
              style={{ rotate: `${f * 16}deg` }}
            >
              <circle
                cx="13"
                cy="13"
                r="10"
                fill="none"
                stroke={C.ink3}
                strokeWidth="2.4"
                strokeDasharray="44 20"
                strokeLinecap="round"
              />
            </svg>
            <T v="aside" c={C.ink2}>
              Arranging 6 days around Tokyo and Kyoto…
            </T>
          </div>
        ) : null}
        {preview > 0 ? (
          <div
            style={{
              opacity: preview,
              translate: `0 ${tween(f, [82, 150], [0, -330], ease.inOut)}px`,
            }}
          >
            <Preview />
          </div>
        ) : null}
      </div>
    </>
  );
};

export const Suggest: React.FC = () => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill>
      <Paper />
      <div style={{ position: "absolute", left: 150, top: 200 }}>
        <Eyebrow at={6}>Suggested itinerary</Eyebrow>
        <Words
          lines={["Tell it how", "you travel.", "It drafts", "*every* *day.*"]}
          at={10}
          style={{ fontSize: 118, marginTop: 34 }}
        />
        <Fade at={48} style={{ ...lede, marginTop: 40, maxWidth: 640 }}>
          Your pace and must-dos, meals at sensible times, each day kept to one
          part of town.
        </Fade>
      </div>
      <Phone
        rx={tween(f, [0, 165], [5, 2], ease.linear)}
        ry={tween(f, [0, 165], [-24, -12], ease.out)}
        style={{ left: 1110, top: 96 + Math.sin(f / 26) * 5, scale: "1.1" }}
      >
        <Screen />
      </Phone>
    </AbsoluteFill>
  );
};
