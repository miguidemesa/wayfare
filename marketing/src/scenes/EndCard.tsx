import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { C, ease, sans, serif, tween } from "../brand";
import { Fade, Icon, Words } from "../ui";
import { Logo3D } from "../Logo3D";

// The app icon, made whole: the vermilion field the side quest's star swelled
// into, the mark in white enamel, then the name and the line.

const LIGHT = "#FBFAF6";

export const EndCard: React.FC = () => {
  const f = useCurrentFrame();
  const star = tween(f, [2, 30], [0, 1]);
  const nudge =
    tween(f, [96, 104], [0, 1], ease.out) *
    (1 - tween(f, [106, 116], [0, 1], ease.inOut));
  return (
    <AbsoluteFill style={{ backgroundColor: C.icon }}>
      <AbsoluteFill
        style={{
          backgroundImage:
            "radial-gradient(ellipse 70% 80% at 50% 36%, rgba(255,236,220,0.24) 0%, rgba(255,236,220,0) 60%, rgba(70,18,6,0.28) 100%)",
        }}
      />
      <div style={{ position: "absolute", left: 960 - 210, top: 330 - 210 }}>
        <Logo3D
          size={420}
          star={star}
          ring={tween(f, [10, 42], [0, 1], ease.inOut)}
          spin={(1 - star) * -2.6}
          tilt={[
            Math.sin(f / 40) * 0.08 + (1 - star) * 0.4,
            Math.sin(f / 52) * 0.12,
          ]}
          color="#F6F1E7"
          shadow="#5A1A0C"
          light={tween(f, [24, 140], [-5, 5], ease.inOut)}
        />
      </div>
      <Words
        lines={["Wayfare"]}
        at={18}
        style={{
          position: "absolute",
          top: 520,
          width: "100%",
          textAlign: "center",
          fontSize: 168,
          color: LIGHT,
        }}
      />
      <Fade
        at={40}
        style={{
          position: "absolute",
          top: 718,
          width: "100%",
          textAlign: "center",
          fontFamily: serif,
          fontStyle: "italic",
          fontSize: 60,
          color: "rgba(251,250,246,0.9)",
        }}
      >
        Your trip, handled.
      </Fade>
      <Fade
        at={60}
        style={{
          position: "absolute",
          top: 846,
          width: "100%",
          display: "flex",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 20,
            padding: "10px 10px 10px 36px",
            borderRadius: 999,
            background: LIGHT,
            boxShadow: "0 24px 50px -20px rgba(60,14,4,0.6)",
          }}
        >
          <span
            style={{
              fontFamily: sans,
              fontWeight: 600,
              fontSize: 30,
              color: C.ink,
            }}
          >
            Plan your next trip
          </span>
          <span
            style={{
              width: 60,
              height: 60,
              borderRadius: 30,
              background: C.ink,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Icon
              name="arrow"
              size={28}
              color={LIGHT}
              style={{ translate: `${nudge * 4}px ${nudge * -4}px` }}
            />
          </span>
        </div>
      </Fade>
    </AbsoluteFill>
  );
};
