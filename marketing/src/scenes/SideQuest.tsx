import React from "react";
import { AbsoluteFill, interpolateColors, useCurrentFrame } from "remotion";
import { C, ease, sans, serif, starPath, tween } from "../brand";
import { Bezel, Eyebrow, Fade, Icon, lede, Tap, Words } from "../ui";
import {
  Attribution,
  Label,
  Leg,
  MapPlate,
  Pin,
  Route,
  type LngLat,
  type XY,
} from "../MapPlate";

// On the ground at the museum, early afternoon: a side quest turns up a short
// detour away, one tap adds it, and Wayfare says when to leave. Then the new
// star pin swells to fill the frame and becomes the end card.

const MUSEUM: LngLat = [139.7766, 35.7189];
const AMEYOKO: LngLat = [139.7745, 35.7101];
const YANAKA: LngLat = [139.7663, 35.7277];
const NEZU: LngLat = [139.7606, 35.7202];
const PLATE = { w: 2036, h: 1146 }; // 1.06× the frame, for the push-in
const BOUNDS: [LngLat, LngLat] = [
  [139.7606, 35.7101],
  [139.7766, 35.7277],
];
// Keeps the stops between the headline and the card, in plate pixels.
const PADDING = { left: 1018, right: 698, top: 273, bottom: 233 };

const ADD = 70; // the tap on "Add to today"
const WIPE = 136; // the star pin starts to swell

const Quest: React.FC<{ xy: XY[] }> = ({ xy }) => {
  const f = useCurrentFrame();
  const [museum, ameyoko, yanaka, nezu] = xy;
  const added = tween(f, [ADD + 6, ADD + 32], [0, 1], ease.inOut);
  const pop = tween(f, [ADD + 10, ADD + 24], [0, 1], ease.out);
  const swell = tween(f, [WIPE, WIPE + 24], [0, 1], ease.in);
  const pulse = (f % 40) / 40;
  return (
    <svg
      width={PLATE.w}
      height={PLATE.h}
      style={{ position: "absolute", inset: 0, overflow: "visible" }}
    >
      <Route
        id="quest-done"
        points={[ameyoko, museum]}
        progress={1}
        color={C.ink3}
        opacity={0.5}
      />
      <Route
        id="quest-next"
        points={[museum, yanaka]}
        progress={tween(f, [4, 30], [0, 1], ease.inOut)}
        color={C.ink}
        opacity={0.7 - 0.5 * added}
      />
      <Route
        id="quest-detour"
        points={[museum, nezu, yanaka]}
        progress={added}
        color={C.accent}
        width={5.5}
        opacity={0.95}
      />
      <Leg
        p={{ x: (museum.x + nezu.x) / 2, y: (museum.y + nezu.y) / 2 + 42 }}
        text="19 min on foot"
        at={ADD + 26}
      />
      <Pin p={ameyoko} n={3} at={0} fill={C.ink3} />
      <Pin p={yanaka} n={added > 0.5 ? 6 : 5} at={8} />
      <circle
        cx={museum.x}
        cy={museum.y}
        r={24 + pulse * 40}
        fill="none"
        stroke={C.accent}
        strokeWidth={2}
        opacity={(1 - pulse) * 0.6}
      />
      <Pin p={museum} n={4} at={0} fill={C.accent} r={25} />
      <Label p={museum} text="National Museum" side="r" at={4} />
      <text
        x={museum.x + 34}
        y={museum.y + 44}
        fill={C.accent}
        style={{
          fontFamily: sans,
          fontWeight: 600,
          fontSize: 19,
          letterSpacing: "0.2em",
        }}
      >
        NOW · 13:18
      </text>
      <Label p={yanaka} text="Yanaka Ginza" side="t" at={10} />
      <Label
        p={nezu}
        text="Nezu Shrine"
        side="t"
        at={ADD + 16}
        color={C.accent}
      />
      {pop > 0 ? (
        <g
          transform={`translate(${nezu.x} ${nezu.y}) rotate(${(1 - pop) * -90 + swell * 90}) scale(${pop * Math.pow(160, swell)})`}
        >
          <path
            d={starPath(24)}
            fill={interpolateColors(f, [WIPE, WIPE + 20], [C.accent, C.icon])}
            stroke={C.paper}
            strokeWidth={swell > 0 ? 0 : 4}
            strokeLinejoin="round"
          />
        </g>
      ) : null}
    </svg>
  );
};

/** The suggestion, as a card over the map. */
const QuestCard: React.FC = () => {
  const f = useCurrentFrame();
  const p = tween(f, [30, 50], [0, 1], ease.fluid);
  const q = tween(f, [ADD + 22, ADD + 38], [0, 1], ease.in);
  const press =
    tween(f, [ADD - 6, ADD], [0, 1]) *
    (1 - tween(f, [ADD + 3, ADD + 10], [0, 1]));
  const done = f >= ADD + 2;
  return (
    <div
      style={{
        position: "absolute",
        left: 1330,
        top: 640,
        width: 500,
        opacity: p * (1 - q),
        translate: `${(1 - p) * 70 + q * 50}px 0`,
      }}
    >
      <Bezel pad="30px 32px">
        <div
          style={{
            fontFamily: sans,
            fontWeight: 600,
            fontSize: 18,
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            color: C.accent,
          }}
        >
          Side quest · 15 min detour
        </div>
        <div
          style={{
            fontFamily: serif,
            fontWeight: 500,
            fontSize: 58,
            lineHeight: 1.05,
            letterSpacing: "-0.02em",
            color: C.ink,
            marginTop: 12,
          }}
        >
          Nezu Shrine
        </div>
        <div
          style={{
            fontFamily: serif,
            fontStyle: "italic",
            fontSize: 28,
            lineHeight: 1.3,
            color: C.ink2,
            marginTop: 8,
          }}
        >
          A tunnel of red torii, and azaleas in April.
        </div>
        <div
          style={{
            fontFamily: sans,
            fontWeight: 500,
            fontSize: 20,
            color: C.ink3,
            marginTop: 14,
          }}
        >
          Free · about 40 min · Yanaka Ginza by 14:45
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 26,
            marginTop: 24,
          }}
        >
          <div
            style={{
              position: "relative",
              display: "flex",
              alignItems: "center",
              gap: 10,
              height: 58,
              padding: "0 24px",
              borderRadius: 10,
              background: C.ink,
              scale: `${1 - press * 0.04}`,
            }}
          >
            <Icon name={done ? "check" : "plus"} size={24} color={C.paper} />
            <span
              style={{
                fontFamily: sans,
                fontWeight: 600,
                fontSize: 22,
                color: C.paper,
              }}
            >
              {done ? "Added to today" : "Add to today"}
            </span>
            <Tap at={ADD} />
          </div>
          <span
            style={{
              fontFamily: sans,
              fontWeight: 600,
              fontSize: 22,
              color: C.accent,
            }}
          >
            Not now
          </span>
        </div>
      </Bezel>
    </div>
  );
};

/** The alert that follows (shared/alerts.ts "leave soon"), in the app's AlertCard layout. */
const LeaveAlert: React.FC = () => {
  const f = useCurrentFrame();
  const p = tween(f, [ADD + 30, ADD + 46], [0, 1], ease.fluid);
  return (
    <div
      style={{
        position: "absolute",
        right: 86,
        top: 84,
        width: 590,
        opacity: p,
        translate: `0 ${(1 - p) * -44}px`,
      }}
    >
      <Bezel pad={0}>
        <div
          style={{
            display: "flex",
            gap: 16,
            padding: "22px 24px",
            borderRadius: 16,
            border: `1.5px solid ${C.caution}`,
          }}
        >
          <Icon
            name="alert"
            size={32}
            color={C.caution}
            style={{ marginTop: 2 }}
          />
          <div style={{ flex: 1 }}>
            <div
              style={{
                fontFamily: sans,
                fontWeight: 600,
                fontSize: 26,
                color: C.ink,
              }}
            >
              Leave in 12 min for Nezu Shrine
            </div>
            <div
              style={{
                fontFamily: sans,
                fontSize: 20,
                color: C.ink2,
                marginTop: 4,
              }}
            >
              Counting the time to get there.
            </div>
            <div
              style={{
                fontFamily: sans,
                fontWeight: 500,
                fontSize: 21,
                color: C.accent,
                marginTop: 12,
              }}
            >
              Directions
            </div>
          </div>
          <Icon name="close" size={26} color={C.ink3} />
        </div>
      </Bezel>
    </div>
  );
};

export const SideQuest: React.FC = () => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ backgroundColor: C.paper }}>
      <div
        style={{
          position: "absolute",
          left: (1920 - PLATE.w) / 2,
          top: (1080 - PLATE.h) / 2,
          width: PLATE.w,
          height: PLATE.h,
          scale: `${tween(f, [0, 165], [1920 / PLATE.w, 1], ease.linear)}`,
        }}
      >
        <MapPlate
          width={PLATE.w}
          height={PLATE.h}
          bounds={BOUNDS}
          padding={PADDING}
          points={[MUSEUM, AMEYOKO, YANAKA, NEZU]}
        >
          {(xy) => <Quest xy={xy} />}
        </MapPlate>
      </div>
      {/* Everything over the map clears as the star swells, so it swallows a clean frame. */}
      <AbsoluteFill
        style={{ opacity: 1 - tween(f, [WIPE - 2, WIPE + 8], [0, 1]) }}
      >
        <AbsoluteFill
          style={{
            background: `linear-gradient(90deg, ${C.paper} 0%, rgba(244,241,234,0.94) 26%, rgba(244,241,234,0) 46%)`,
          }}
        />
        <Attribution />
        <div style={{ position: "absolute", left: 150, top: 250 }}>
          <Eyebrow at={6}>Side quests</Eyebrow>
          <Words
            lines={["Finds the", "detours worth", "*taking.*"]}
            at={10}
            style={{ fontSize: 112, marginTop: 34 }}
          />
          <Fade at={36} style={{ ...lede, marginTop: 40, maxWidth: 620 }}>
            Nearby finds that fit around your day, added in one tap, with a
            nudge when it’s time to go.
          </Fade>
        </div>
        <QuestCard />
        <LeaveAlert />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
