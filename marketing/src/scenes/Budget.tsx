import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { C, ease, serif, tween } from "../brand";
import {
  Bezel,
  Eyebrow,
  Fade,
  lede,
  Masthead,
  Paper,
  Phone,
  StatusBar,
  T,
  TabBar,
  Words,
} from "../ui";

// The Spend tab (mobile/app/trips/[tripId]/(tabs)/spend.tsx), with its math:
// ₱80,000 budget, ₱38,240 spent, 5 days left counting today (Day 2 of 6)
// → ₱8,352 a day. Yen converts to pesos at ₱0.39.
const BUDGET = 80000;
const SPENT = 38240;
const PER_DAY = (BUDGET - SPENT) / 5;
const CATEGORIES: [string, number][] = [
  ["Stay", 16800],
  ["Flights", 14600],
  ["Food", 3140],
  ["Transport", 2180],
  ["Activities", 1520],
];
const TODAY = [
  {
    merchant: "Ameyoko market",
    meta: "Food · Cash",
    yen: "¥1,200",
    peso: "₱468",
  },
  {
    merchant: "IC card top-up",
    meta: "Transport · Cash",
    yen: "¥3,000",
    peso: "₱1,170",
  },
  {
    merchant: "Tokyo National Museum",
    meta: "Activities · Card",
    yen: "¥1,000",
    peso: "₱390",
  },
];
const peso = (n: number) => `₱${Math.round(n).toLocaleString("en-US")}`;

const Spend: React.FC = () => {
  const f = useCurrentFrame();
  const count = tween(f, [8, 54], [0, 1], ease.out);
  const bar = tween(f, [14, 60], [0, 1], ease.inOut);
  return (
    <>
      <StatusBar time="13:26" />
      <Masthead />
      <div
        style={{
          position: "absolute",
          top: 164,
          left: 0,
          right: 0,
          bottom: 0,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "24px 20px 120px",
            translate: `0 ${tween(f, [64, 112], [0, -212], ease.inOut)}px`,
          }}
        >
          <T v="label" c={C.ink3}>
            Spent so far
          </T>
          <T v="figure" style={{ marginTop: 4 }}>
            {peso(SPENT * count)}
          </T>
          <T v="meta" c={C.ink2} style={{ marginTop: 2 }}>
            {peso((BUDGET - SPENT) * count)} left of ₱80,000
          </T>
          <div
            style={{
              height: 3,
              background: C.rule,
              marginTop: 12,
              borderRadius: 2,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${(SPENT / BUDGET) * 100 * bar}%`,
                height: 3,
                background: C.ink,
              }}
            />
          </div>
          <div
            style={{
              display: "flex",
              marginTop: 24,
              borderTop: `1px solid ${C.rule}`,
              borderBottom: `1px solid ${C.rule}`,
            }}
          >
            <div style={{ flex: 1, padding: "12px 0" }}>
              <T v="small" c={C.ink3}>
                Today
              </T>
              <T v="heading" style={{ marginTop: 2 }}>
                {peso(2028 * count)}
              </T>
            </div>
            <div
              style={{
                flex: 1,
                padding: "12px 0 12px 16px",
                borderLeft: `1px solid ${C.rule}`,
              }}
            >
              <T v="small" c={C.ink3}>
                Per day to stay on budget
              </T>
              <T v="heading" style={{ marginTop: 2 }}>
                {peso(PER_DAY * count)}
              </T>
            </div>
          </div>
          <T v="label" c={C.ink3} style={{ marginTop: 24, marginBottom: 8 }}>
            Where it went
          </T>
          {CATEGORIES.map(([name, amount], i) => (
            <div key={name} style={{ padding: "7px 0" }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <T v="meta">{name}</T>
                <T v="meta">
                  {peso(amount)}
                  <span style={{ color: C.ink3, marginLeft: 8 }}>
                    {Math.round((amount / SPENT) * 100)}%
                  </span>
                </T>
              </div>
              <div style={{ height: 2, background: C.rule, marginTop: 6 }}>
                <div
                  style={{
                    width: `${(amount / CATEGORIES[0][1]) * 100 * tween(f, [30 + i * 4, 60 + i * 4], [0, 1], ease.inOut)}%`,
                    height: 2,
                    background: C.ink2,
                  }}
                />
              </div>
            </div>
          ))}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
              marginTop: 24,
              padding: "8px 0",
            }}
          >
            <T v="entry">
              Today
              <span
                style={{
                  fontFamily: serif,
                  fontStyle: "italic",
                  fontWeight: 400,
                  fontSize: 15,
                  color: C.ink3,
                  marginLeft: 8,
                }}
              >
                Day 2
              </span>
            </T>
            <T v="meta" c={C.ink2}>
              ₱2,028
            </T>
          </div>
          <div style={{ height: 1, background: C.rule }} />
          {TODAY.map((e, i) => {
            const at = 76 + i * 7;
            return (
              <div
                key={e.merchant}
                style={{
                  display: "flex",
                  gap: 12,
                  padding: "11px 0",
                  opacity: tween(f, [at, at + 8], [0, 1]),
                  translate: `${tween(f, [at, at + 14], [26, 0])}px 0`,
                }}
              >
                <div style={{ flex: 1 }}>
                  <T v="bodyStrong">{e.merchant}</T>
                  <T v="small" c={C.ink3}>
                    {e.meta}
                  </T>
                </div>
                <div style={{ textAlign: "right" }}>
                  <T v="bodyStrong">{e.yen}</T>
                  <T v="small" c={C.ink3}>
                    {e.peso}
                  </T>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <TabBar active="Spend" />
    </>
  );
};

/** A callout off the phone: the market snacks, logged in yen, turning over into pesos. */
const Converted: React.FC = () => {
  const f = useCurrentFrame();
  const p = tween(f, [84, 102], [0, 1], ease.fluid);
  const flip = tween(f, [104, 118], [0, 1], ease.inOut);
  return (
    <div
      style={{
        position: "absolute",
        left: 610,
        top: 612,
        opacity: p,
        translate: `${(1 - p) * 40}px 0`,
        scale: `${0.94 + 0.06 * p}`,
      }}
    >
      <Bezel pad="24px 30px">
        <T
          v="label"
          c={C.ink3}
          style={{ fontSize: 17, lineHeight: "22px", letterSpacing: 2.2 }}
        >
          Ameyoko market · Food
        </T>
        <div style={{ height: 80, overflow: "hidden", marginTop: 8 }}>
          <div
            style={{
              fontFamily: serif,
              fontWeight: 500,
              fontSize: 68,
              lineHeight: "80px",
              letterSpacing: "-0.02em",
              color: C.ink,
              translate: `0 ${-80 * flip}px`,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            <div>¥1,200</div>
            <div>₱468</div>
          </div>
        </div>
        <T
          v="meta"
          c={C.ink2}
          style={{ fontSize: 20, lineHeight: "26px", marginTop: 4 }}
        >
          Logged in yen · at ₱0.39 to ¥1
        </T>
      </Bezel>
    </div>
  );
};

export const Budget: React.FC = () => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill>
      <Paper />
      <Phone
        rx={tween(f, [0, 135], [4, 2], ease.linear)}
        ry={tween(f, [0, 135], [22, 12], ease.out)}
        style={{ left: 200, top: 96 + Math.sin(f / 26) * 5, scale: "1.1" }}
      >
        <Spend />
      </Phone>
      <Converted />
      <div style={{ position: "absolute", left: 1040, top: 250 }}>
        <Eyebrow at={6}>Budget</Eyebrow>
        <Words
          lines={["Knows what", "you can spend", "*today.*"]}
          at={10}
          style={{ fontSize: 118, marginTop: 34 }}
        />
        <Fade at={40} style={{ ...lede, marginTop: 40, maxWidth: 680 }}>
          Log it in yen, see it in pesos. Your daily allowance keeps up as you
          go.
        </Fade>
      </div>
    </AbsoluteFill>
  );
};
