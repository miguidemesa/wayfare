import React, { useLayoutEffect, useMemo } from "react";
import * as THREE from "three";
import { useThree } from "@react-three/fiber";
import { ThreeCanvas } from "@remotion/three";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { C, ease, sans, serif, tween } from "../brand";
import { Bezel, Eyebrow, Fade, lede, T, Words } from "../ui";
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
import landDots from "../data/land-dots.json";

// Manila → Tokyo on a dotted globe, diving into Day 2 on the map: the stops
// in order, the dashed route drawing through them, the time for each leg.

// ------------------------------------------------------------------ the globe

const toVec = (lat: number, lng: number, r = 1) => {
  const la = THREE.MathUtils.degToRad(lat);
  const lo = THREE.MathUtils.degToRad(lng);
  return new THREE.Vector3(
    r * Math.cos(la) * Math.sin(lo),
    r * Math.sin(la),
    r * Math.cos(la) * Math.cos(lo),
  );
};

const MANILA = toVec(14.5086, 121.0194); // NAIA
const TOKYO = toVec(35.5494, 139.7798); // Haneda
const MIDWAY = MANILA.clone().add(TOKYO).normalize();
// Bowed out over the Pacific a little, so the flight reads as an arc even seen from above.
const BOW = new THREE.Vector3().crossVectors(TOKYO, MANILA).normalize();
const ARC = new THREE.CatmullRomCurve3(
  Array.from({ length: 48 }, (_, i) => {
    const lift = Math.sin((Math.PI * i) / 47);
    return MANILA.clone()
      .lerp(TOKYO, i / 47)
      .normalize()
      .multiplyScalar(1 + 0.1 * lift)
      .addScaledVector(BOW, 0.08 * lift);
  }),
);
const ARC_SEGMENTS = 160;
const ARC_SIDES = 8;
const SHIFT = 400; // px: the dive lands Tokyo right of centre, where the route will draw

/** The globe camera at a frame — shared by the 3D scene and the labels over it. */
const placeCamera = (camera: THREE.PerspectiveCamera, frame: number) => {
  const turn = tween(frame, [0, 44], [0, 1], ease.inOut);
  const distance =
    tween(frame, [0, 40], [4.3, 2.6], ease.inOut) -
    tween(frame, [38, 62], [0, 1.47], ease.in);
  camera.position.copy(
    MIDWAY.clone().lerp(TOKYO, turn).normalize().multiplyScalar(distance),
  );
  camera.up.set(0, 1, 0);
  camera.lookAt(0, 0, 0);
  camera.setViewOffset(
    1920,
    1080,
    -SHIFT * tween(frame, [16, 60], [0, 1], ease.inOut),
    0,
    1920,
    1080,
  );
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld();
};

const Globe: React.FC<{ frame: number }> = ({ frame }) => {
  const { camera } = useThree();
  const dots = useMemo(() => {
    const mesh = new THREE.InstancedMesh(
      new THREE.CircleGeometry(0.0075, 8),
      new THREE.MeshBasicMaterial({ color: "#4A4640" }),
      landDots.length,
    );
    const o = new THREE.Object3D();
    (landDots as [number, number][]).forEach(([lat, lng], i) => {
      o.position.copy(toVec(lat, lng, 1.002));
      o.lookAt(o.position.clone().multiplyScalar(2));
      o.updateMatrix();
      mesh.setMatrixAt(i, o.matrix);
    });
    return mesh;
  }, []);
  const arc = useMemo(
    () => new THREE.TubeGeometry(ARC, ARC_SEGMENTS, 0.0045, ARC_SIDES, false),
    [],
  );
  const ringFacing = useMemo(
    () =>
      new THREE.Quaternion().setFromUnitVectors(
        new THREE.Vector3(0, 0, 1),
        TOKYO.clone().normalize(),
      ),
    [],
  );
  const draw = tween(frame, [6, 42], [0, 1], ease.inOut);
  const landed = tween(frame, [40, 60], [0, 1], ease.out);

  useLayoutEffect(() => {
    placeCamera(camera as THREE.PerspectiveCamera, frame);
    arc.setDrawRange(0, Math.floor(draw * ARC_SEGMENTS) * ARC_SIDES * 6);
  }, [camera, frame, arc, draw]);

  return (
    <>
      {/* three.js divides light by π: this lands the sphere near its own paper colour, shaded toward the rim. */}
      <ambientLight intensity={2.2} color="#FFF8EE" />
      <directionalLight
        position={[-2.5, 3, 4]}
        intensity={1.0}
        color="#FFF3E2"
      />
      <mesh>
        <sphereGeometry args={[1, 96, 64]} />
        <meshStandardMaterial color="#E7E1D4" roughness={1} />
      </mesh>
      <primitive object={dots} />
      <mesh geometry={arc}>
        <meshBasicMaterial color={C.accent} />
      </mesh>
      {draw > 0 && draw < 1 ? (
        <mesh position={ARC.getPointAt(draw)}>
          <sphereGeometry args={[0.015, 16, 12]} />
          <meshBasicMaterial color={C.accent} />
        </mesh>
      ) : null}
      <mesh position={MANILA.clone().multiplyScalar(1.003)}>
        <sphereGeometry args={[0.013, 16, 12]} />
        <meshBasicMaterial color={C.ink} />
      </mesh>
      {landed > 0 ? (
        <>
          <mesh position={TOKYO.clone().multiplyScalar(1.003)} scale={landed}>
            <sphereGeometry args={[0.015, 16, 12]} />
            <meshBasicMaterial color={C.accent} />
          </mesh>
          <mesh
            position={TOKYO.clone().multiplyScalar(1.004)}
            quaternion={ringFacing}
            scale={1 + landed * 5}
          >
            <ringGeometry args={[0.016, 0.02, 48]} />
            <meshBasicMaterial
              color={C.accent}
              transparent
              opacity={1 - landed}
              depthWrite={false}
            />
          </mesh>
        </>
      ) : null}
    </>
  );
};

const projector = new THREE.PerspectiveCamera(30, 1920 / 1080, 0.01, 100);

/** A city name pinned to its point on the globe. */
const GlobeLabel: React.FC<{
  at: THREE.Vector3;
  name: string;
  code: string;
  side: "l" | "r";
  frame: number;
  opacity: number;
}> = ({ at, name, code, side, frame, opacity }) => {
  placeCamera(projector, frame);
  const p = at.clone().project(projector);
  return (
    <div
      style={{
        position: "absolute",
        left: ((p.x + 1) / 2) * 1920,
        top: ((1 - p.y) / 2) * 1080,
        opacity,
        translate: side === "l" ? "calc(-100% - 24px) -50%" : "24px -50%",
        textAlign: side === "l" ? "right" : "left",
        // A halo in the globe's own colour, so the names hold over the dots.
        textShadow: "0 0 12px #E7E1D4, 0 0 5px #E7E1D4, 0 0 2px #E7E1D4",
      }}
    >
      <div
        style={{
          fontFamily: serif,
          fontWeight: 500,
          fontSize: 42,
          lineHeight: 1,
          color: C.ink,
        }}
      >
        {name}
      </div>
      <div
        style={{
          fontFamily: sans,
          fontWeight: 600,
          fontSize: 18,
          letterSpacing: "0.2em",
          color: C.ink3,
          marginTop: 8,
        }}
      >
        {code}
      </div>
    </div>
  );
};

// -------------------------------------------------------------------- the map

// Day 2 in the order the planner would lay it: west from Asakusa through Ueno, then north to Yanaka.
const STOPS: { name: string; at: LngLat; side: "l" | "r" | "t" | "b" }[] = [
  { name: "Senso-ji", at: [139.7967, 35.7148], side: "t" },
  { name: "Kappabashi", at: [139.788, 35.7137], side: "b" },
  { name: "Ameyoko", at: [139.7745, 35.7101], side: "b" },
  { name: "National Museum", at: [139.7766, 35.7189], side: "r" },
  { name: "Yanaka Ginza", at: [139.7663, 35.7277], side: "t" },
];
const HOTEL: LngLat = [139.7938, 35.7118];
// Straight-line legs at walking pace; `flip` sets the label on the other side of its line.
const LEGS: { text: string; flip?: boolean }[] = [
  { text: "10 min on foot" },
  { text: "16 min on foot" },
  { text: "13 min on foot", flip: true },
  { text: "17 min on foot" },
];
const POINTS: LngLat[] = [...STOPS.map((s) => s.at), HOTEL];
const PLATE = { w: 2112, h: 1188 }; // 1.1× the frame, so the push-in never enlarges past 1:1
const BOUNDS: [LngLat, LngLat] = [
  [139.7663, 35.7101],
  [139.7967, 35.7277],
];
// Keeps the route right of the headline and above the day card, in plate pixels.
const PADDING = { left: 1096, right: 196, top: 254, bottom: 374 };
const START = 64;
const SPAN = 52;

const Hotel: React.FC<{ p: XY; at: number }> = ({ p, at }) => {
  const f = useCurrentFrame();
  const o = tween(f, [at, at + 10], [0, 1]);
  if (o <= 0) return null;
  return (
    <g
      transform={`translate(${p.x} ${p.y}) scale(${0.7 + 0.3 * o})`}
      opacity={o}
    >
      <rect
        x={-17}
        y={-17}
        width={34}
        height={34}
        rx={6}
        fill={C.paper}
        stroke={C.ink}
        strokeWidth={2.5}
      />
      <text
        textAnchor="middle"
        dominantBaseline="central"
        fill={C.ink}
        style={{ fontFamily: sans, fontWeight: 700, fontSize: 18 }}
      >
        H
      </text>
    </g>
  );
};

const Itinerary: React.FC<{ xy: XY[] }> = ({ xy }) => {
  const f = useCurrentFrame();
  const stops = xy.slice(0, STOPS.length);
  const lengths = stops
    .slice(1)
    .map((q, i) => Math.hypot(q.x - stops[i].x, q.y - stops[i].y));
  const total = lengths.reduce((a, b) => a + b, 0);
  const cum = lengths.reduce(
    (acc, l) => [...acc, acc[acc.length - 1] + l / total],
    [0],
  );
  // Pins and legs land as the line reaches them.
  const when = (fraction: number) => START + SPAN * fraction;
  return (
    <svg
      width={PLATE.w}
      height={PLATE.h}
      style={{ position: "absolute", inset: 0, overflow: "visible" }}
    >
      <Route
        id="day-route"
        points={stops}
        progress={tween(f, [START, START + SPAN], [0, 1], ease.linear)}
        color={C.ink}
      />
      {LEGS.map(({ text, flip }, i) => {
        const a = stops[i];
        const b = stops[i + 1];
        const off = (flip ? -34 : 34) / Math.hypot(b.x - a.x, b.y - a.y);
        // Beside the line, not on it.
        return (
          <Leg
            key={i}
            p={{
              x: (a.x + b.x) / 2 - (b.y - a.y) * off,
              y: (a.y + b.y) / 2 + (b.x - a.x) * off,
            }}
            text={text}
            at={when((cum[i] + cum[i + 1]) / 2)}
          />
        );
      })}
      <Hotel p={xy[STOPS.length]} at={56} />
      {stops.map((p, i) => (
        <Pin key={i} p={p} n={i + 1} at={when(cum[i]) - 3} />
      ))}
      {stops.map((p, i) => (
        <Label
          key={i}
          p={p}
          text={STOPS[i].name}
          side={STOPS[i].side}
          at={when(cum[i]) + 2}
        />
      ))}
    </svg>
  );
};

// ------------------------------------------------------------------ the scene

export const MapScene: React.FC = () => {
  const f = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const globe = 1 - tween(f, [50, 64], [0, 1]);
  const reveal = tween(f, [44, 78], [60, 2300], ease.inOut);
  const labels = tween(f, [14, 26], [0, 1]) * (1 - tween(f, [36, 46], [0, 1]));
  const mask = `radial-gradient(circle at ${960 + SHIFT}px 540px, #000 ${reveal}px, transparent ${reveal + 380}px)`;
  return (
    <AbsoluteFill style={{ backgroundColor: C.paper }}>
      {globe > 0 ? (
        <AbsoluteFill style={{ opacity: globe }}>
          <ThreeCanvas
            width={width}
            height={height}
            flat
            camera={{ fov: 30, near: 0.01, far: 100 }}
          >
            <Globe frame={f} />
          </ThreeCanvas>
          <GlobeLabel
            at={MANILA}
            name="Manila"
            code="MNL"
            side="l"
            frame={f}
            opacity={labels}
          />
          <GlobeLabel
            at={TOKYO}
            name="Tokyo"
            code="HND"
            side="r"
            frame={f}
            opacity={labels}
          />
        </AbsoluteFill>
      ) : null}

      <AbsoluteFill
        style={{
          opacity: tween(f, [44, 60], [0, 1]),
          maskImage: mask,
          WebkitMaskImage: mask,
        }}
      >
        <div
          style={{
            position: "absolute",
            left: (1920 - PLATE.w) / 2,
            top: (1080 - PLATE.h) / 2,
            width: PLATE.w,
            height: PLATE.h,
            scale: `${tween(f, [44, 165], [1920 / PLATE.w, 1], ease.out)}`,
          }}
        >
          <MapPlate
            width={PLATE.w}
            height={PLATE.h}
            bounds={BOUNDS}
            padding={PADDING}
            points={POINTS}
          >
            {(xy) => <Itinerary xy={xy} />}
          </MapPlate>
        </div>
        <AbsoluteFill
          style={{
            background: `linear-gradient(90deg, ${C.paper} 0%, rgba(244,241,234,0.94) 32%, rgba(244,241,234,0) 50%)`,
          }}
        />
        <Attribution />
      </AbsoluteFill>

      <div style={{ position: "absolute", left: 150, top: 250 }}>
        <Eyebrow at={62}>Itinerary &amp; maps</Eyebrow>
        <Words
          lines={["Every day,", "in the right", "*order.*"]}
          at={66}
          style={{ fontSize: 118, marginTop: 34 }}
        />
        <Fade at={92} style={{ ...lede, marginTop: 40, maxWidth: 600 }}>
          Stops grouped by neighborhood, with the walk or train between each
          one.
        </Fade>
      </div>

      <Fade at={112} style={{ position: "absolute", right: 90, bottom: 84 }}>
        <Bezel pad="22px 28px">
          <T
            v="label"
            c={C.accent}
            style={{ fontSize: 17, lineHeight: "22px", letterSpacing: 2.2 }}
          >
            Day 2 · Wednesday
          </T>
          <div
            style={{
              fontFamily: serif,
              fontWeight: 500,
              fontSize: 42,
              color: C.ink,
              marginTop: 6,
              letterSpacing: "-0.02em",
            }}
          >
            Asakusa &amp; Ueno
          </div>
          <T
            v="meta"
            c={C.ink2}
            style={{ fontSize: 21, lineHeight: "28px", marginTop: 4 }}
          >
            5 stops · 56 min getting around
          </T>
        </Bezel>
      </Fade>
    </AbsoluteFill>
  );
};
