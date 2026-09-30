import React, {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import * as THREE from "three";
import { useThree } from "@react-three/fiber";
import { ThreeCanvas } from "@remotion/three";
import {
  AbsoluteFill,
  useCurrentFrame,
  useDelayRender,
  useVideoConfig,
} from "remotion";
import { C, ease, fontsReady, hand, sans, serif, tween } from "../brand";
import { Fade, Paper, Words } from "../ui";
import { Logo3D } from "../Logo3D";

// "Every trip starts in pieces": the scraps of a Tokyo & Kyoto trip, tossed
// onto the table in 3D, then pulled together into Wayfare's mark.

// Destination photos, from mobile/shared/images.ts (Unsplash).
const PHOTO = {
  tower:
    "https://images.unsplash.com/photo-1503899036084-c55cdd92da26?auto=format&fit=crop&w=800&q=80",
  shibuya:
    "https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?auto=format&fit=crop&w=800&q=80",
  inari:
    "https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&w=800&q=80",
  bamboo:
    "https://images.unsplash.com/photo-1545569341-9eb8b30979d9?auto=format&fit=crop&w=800&q=80",
};

type Kind =
  | keyof typeof PHOTO
  | "boarding"
  | "train"
  | "receipt"
  | "sticky"
  | "scrap"
  | "passport";
type Piece = {
  kind: Kind;
  w: number;
  h: number;
  x: number;
  z: number;
  y: number;
  rot: number;
};

// World units on a table at y = 0, scattered around an empty middle where the headline sits.
const PIECES: Piece[] = [
  { kind: "tower", w: 2.1, h: 2.5, x: -5.9, z: -2.6, y: 0.45, rot: 8 },
  { kind: "boarding", w: 3.75, h: 1.5, x: -1.6, z: -3.3, y: 0.18, rot: -4 },
  { kind: "inari", w: 2.1, h: 2.5, x: 2.6, z: -2.9, y: 0.62, rot: -9 },
  { kind: "sticky", w: 1.7, h: 1.7, x: 6.0, z: -2.4, y: 0.3, rot: 12 },
  { kind: "passport", w: 1.75, h: 2.45, x: -6.4, z: 1.4, y: 0.1, rot: -12 },
  { kind: "receipt", w: 1.13, h: 2.5, x: -3.5, z: 3.1, y: 0.35, rot: 7 },
  { kind: "shibuya", w: 2.1, h: 2.5, x: -0.2, z: 3.4, y: 0.55, rot: -5 },
  { kind: "train", w: 3.0, h: 1.3, x: 3.3, z: 3.2, y: 0.22, rot: 6 },
  { kind: "scrap", w: 3.0, h: 2.18, x: 6.4, z: 1.6, y: 0.06, rot: -8 },
  { kind: "bamboo", w: 2.1, h: 2.5, x: 5.6, z: -0.4, y: 0.5, rot: 15 },
];

const PULL_Y = 0.8; // where the pieces meet: the camera's aim, so dead centre on screen
const BOX = 300; // logo canvas; the mark itself is about 196px across
const MARK = 196;
const GAP = 40;

// ---------------------------------------------------------------- the scraps

const PX = 400; // texture pixels per world unit
const font = (weight: number, size: number, family: string) =>
  `${weight} ${Math.round(size)}px "${family}"`;

const sheet = (p: Piece, fill: string) => {
  const c = document.createElement("canvas");
  c.width = Math.round(p.w * PX);
  c.height = Math.round(p.h * PX);
  const g = c.getContext("2d")!;
  g.fillStyle = fill;
  g.fillRect(0, 0, c.width, c.height);
  return { c, g, W: c.width, H: c.height };
};

// Seeded, so the barcode and the scrap's streets match on every frame and every render.
const random = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const polaroid = (p: Piece, img: HTMLImageElement, caption: string) => {
  const { c, g, W, H } = sheet(p, "#FBF8F1");
  const m = W * 0.055;
  const side = W - m * 2;
  const k = Math.max(side / img.width, side / img.height);
  g.save();
  g.beginPath();
  g.rect(m, m, side, side);
  g.clip();
  g.drawImage(
    img,
    m + (side - img.width * k) / 2,
    m + (side - img.height * k) / 2,
    img.width * k,
    img.height * k,
  );
  g.restore();
  g.fillStyle = "#2B2620";
  g.font = font(600, W * 0.085, hand);
  g.fillText(caption, m * 1.3, m + side + (H - m - side) * 0.64);
  return c;
};

const boarding = (p: Piece) => {
  const { c, g, W, H } = sheet(p, "#FBFAF6");
  const label = (text: string, x: number, y: number) => {
    g.fillStyle = C.ink3;
    g.font = font(600, H * 0.055, sans);
    g.letterSpacing = `${H * 0.012}px`;
    g.fillText(text, x, y);
    g.letterSpacing = "0px";
  };
  g.fillStyle = C.accent;
  g.fillRect(0, 0, W, H * 0.06);
  label("BOARDING PASS", W * 0.05, H * 0.2);
  g.fillStyle = C.ink;
  g.font = font(500, H * 0.28, serif);
  g.fillText("MNL", W * 0.05, H * 0.5);
  g.fillText("HND", W * 0.395, H * 0.5);
  g.strokeStyle = C.ink3;
  g.lineWidth = H * 0.009;
  g.setLineDash([H * 0.022, H * 0.02]);
  g.beginPath();
  g.moveTo(W * 0.31, H * 0.4);
  g.lineTo(W * 0.36, H * 0.4);
  g.stroke();
  g.setLineDash([]);
  g.fillStyle = C.accent;
  g.beginPath();
  g.arc(W * 0.37, H * 0.4, H * 0.02, 0, Math.PI * 2);
  g.fill();
  [
    ["FLIGHT", "422"],
    ["GATE", "7"],
    ["SEAT", "14A"],
    ["BOARDS", "06:40"],
  ].forEach(([k, v], i) => {
    label(k, W * 0.05 + i * W * 0.165, H * 0.7);
    g.fillStyle = C.ink;
    g.font = font(500, H * 0.12, serif);
    g.fillText(v, W * 0.05 + i * W * 0.165, H * 0.86);
  });
  const stub = W * 0.72;
  g.strokeStyle = C.ruleStrong;
  g.lineWidth = H * 0.007;
  g.setLineDash([H * 0.025, H * 0.02]);
  g.beginPath();
  g.moveTo(stub, H * 0.12);
  g.lineTo(stub, H * 0.96);
  g.stroke();
  g.setLineDash([]);
  const r = random(7);
  g.fillStyle = C.ink;
  for (let x = stub + W * 0.04; x < W * 0.95; ) {
    const bw = H * (0.006 + r() * 0.016);
    g.fillRect(x, H * 0.2, bw, H * 0.5);
    x += bw + H * (0.006 + r() * 0.012);
  }
  label("SEAT 14A · ZONE 2", stub + W * 0.04, H * 0.84);
  return c;
};

const train = (p: Piece) => {
  const { c, g, W, H } = sheet(p, "#E2E7E3");
  g.fillStyle = "#5E6E69";
  g.font = font(600, H * 0.065, sans);
  g.letterSpacing = `${H * 0.014}px`;
  g.fillText("SHINKANSEN · RESERVED", W * 0.06, H * 0.2);
  g.letterSpacing = "0px";
  g.fillStyle = C.ink;
  g.font = font(500, H * 0.24, serif);
  g.fillText("Tokyo", W * 0.06, H * 0.52);
  g.fillText("Kyoto", W * 0.5, H * 0.52);
  g.strokeStyle = C.ink;
  g.lineWidth = H * 0.012;
  g.lineCap = "round";
  g.beginPath();
  g.moveTo(W * 0.35, H * 0.43);
  g.lineTo(W * 0.45, H * 0.43);
  g.moveTo(W * 0.425, H * 0.39);
  g.lineTo(W * 0.45, H * 0.43);
  g.lineTo(W * 0.425, H * 0.47);
  g.stroke();
  g.fillStyle = C.ink2;
  g.font = font(500, H * 0.075, sans);
  g.fillText("Apr 9 · 09:33 · Car 7 · Seat 12D", W * 0.06, H * 0.78);
  g.save();
  g.translate(W * 0.86, H * 0.36);
  g.rotate(-0.25);
  g.globalAlpha = 0.75;
  g.strokeStyle = C.accent;
  g.lineWidth = H * 0.014;
  g.beginPath();
  g.arc(0, 0, H * 0.17, 0, Math.PI * 2);
  g.stroke();
  g.fillStyle = C.accent;
  g.font = font(700, H * 0.075, sans);
  g.textAlign = "center";
  g.fillText("APR 9", 0, H * 0.028);
  g.restore();
  return c;
};

const receipt = (p: Piece) => {
  const { c, g, W, H } = sheet(p, "#FFFFFF");
  const rule = (y: number) => {
    g.strokeStyle = C.ruleStrong;
    g.lineWidth = 2;
    g.setLineDash([6, 6]);
    g.beginPath();
    g.moveTo(W * 0.08, y);
    g.lineTo(W * 0.92, y);
    g.stroke();
    g.setLineDash([]);
  };
  const row = (a: string, b: string, y: number, weight = 500) => {
    g.fillStyle = C.ink;
    g.font = font(weight, W * 0.062, sans);
    g.textAlign = "left";
    g.fillText(a, W * 0.08, y);
    g.textAlign = "right";
    g.fillText(b, W * 0.92, y);
  };
  g.textAlign = "center";
  g.fillStyle = C.ink;
  g.font = font(700, W * 0.075, sans);
  g.fillText("RAMEN COUNTER", W / 2, H * 0.09);
  g.fillStyle = C.ink3;
  g.font = font(400, W * 0.055, sans);
  g.fillText("Asakusa, Tokyo", W / 2, H * 0.13);
  rule(H * 0.17);
  row("Tonkotsu ramen", "¥980", H * 0.24);
  row("Ajitama egg", "¥120", H * 0.3);
  row("Green tea", "¥100", H * 0.36);
  rule(H * 0.41);
  row("TOTAL", "¥1,200", H * 0.48, 700);
  g.textAlign = "center";
  g.fillStyle = C.ink3;
  g.font = font(400, W * 0.05, sans);
  g.fillText("Paid by card", W / 2, H * 0.55);
  g.fillStyle = "#2B2620";
  g.font = font(600, W * 0.12, hand);
  g.fillText("so good", W / 2, H * 0.68);
  // A torn, zigzag foot.
  g.globalCompositeOperation = "destination-out";
  const t = W / 14;
  g.beginPath();
  for (let x = 0; x < W; x += t) {
    g.moveTo(x, H);
    g.lineTo(x + t / 2, H - t * 0.55);
    g.lineTo(x + t, H);
  }
  g.fill();
  g.globalCompositeOperation = "source-over";
  return c;
};

const sticky = (p: Piece) => {
  const { c, g, W, H } = sheet(p, "#EED88A");
  g.fillStyle = "rgba(110,80,20,0.07)";
  g.fillRect(0, 0, W, H * 0.16);
  g.fillStyle = "#2B2620";
  g.font = font(600, W * 0.16, hand);
  g.fillText("which day", W * 0.1, H * 0.42);
  g.fillText("for Kyoto??", W * 0.1, H * 0.62);
  g.strokeStyle = C.accent;
  g.lineWidth = W * 0.014;
  g.lineCap = "round";
  g.beginPath();
  g.moveTo(W * 0.1, H * 0.73);
  g.bezierCurveTo(W * 0.35, H * 0.69, W * 0.62, H * 0.77, W * 0.88, H * 0.7);
  g.stroke();
  return c;
};

const scrap = (p: Piece) => {
  const { c, g, W, H } = sheet(p, "#EDE8DC");
  const r = random(11);
  g.lineCap = "round";
  g.strokeStyle = "#FBFAF6";
  for (let i = 0; i < 16; i++) {
    const across = i % 2 === 0;
    const a = r() * (across ? W : H);
    g.lineWidth = H * (0.012 + r() * 0.022);
    g.beginPath();
    if (across) {
      g.moveTo(a, -10);
      g.lineTo(a + (r() - 0.5) * W * 0.25, H + 10);
    } else {
      g.moveTo(-10, a);
      g.lineTo(W + 10, a + (r() - 0.5) * H * 0.25);
    }
    g.stroke();
  }
  g.strokeStyle = "#C9D2D0";
  g.lineWidth = H * 0.08;
  g.beginPath();
  g.moveTo(-20, H * 0.22);
  g.bezierCurveTo(W * 0.3, H * 0.08, W * 0.52, H * 0.5, W + 20, H * 0.38);
  g.stroke();
  g.strokeStyle = C.accent;
  g.lineWidth = H * 0.012;
  g.beginPath();
  g.ellipse(W * 0.6, H * 0.68, W * 0.085, H * 0.1, -0.2, 0.3, Math.PI * 2.15);
  g.stroke();
  g.fillStyle = C.accent;
  g.font = font(600, H * 0.1, hand);
  g.fillText("ramen here?", W * 0.58, H * 0.92);
  return c;
};

const passport = (p: Piece) => {
  const { c, g, W, H } = sheet(p, "#4A1D23");
  const gold = "#C9A45C";
  g.strokeStyle = gold;
  g.fillStyle = gold;
  g.lineWidth = W * 0.01;
  for (const r of [0.19, 0.15]) {
    g.beginPath();
    g.arc(W / 2, H * 0.42, W * r, 0, Math.PI * 2);
    g.stroke();
  }
  // A plain sunburst: a generic emblem, not any real state's seal.
  for (let i = 0; i < 16; i++) {
    const a = (i * Math.PI) / 8;
    g.beginPath();
    g.moveTo(W / 2 + Math.cos(a) * W * 0.04, H * 0.42 + Math.sin(a) * W * 0.04);
    g.lineTo(W / 2 + Math.cos(a) * W * 0.12, H * 0.42 + Math.sin(a) * W * 0.12);
    g.stroke();
  }
  g.textAlign = "center";
  g.font = font(600, W * 0.085, sans);
  g.letterSpacing = `${W * 0.02}px`;
  g.fillText("PASSPORT", W / 2, H * 0.76);
  g.letterSpacing = "0px";
  return c;
};

const load = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Couldn't load ${src}`));
    img.src = src;
  });

const piece = (kind: Kind) => PIECES.find((p) => p.kind === kind)!;

/** Draws every piece once — photos and fonts first — and holds the render until they're textures. */
const useEphemera = () => {
  const { delayRender, continueRender, cancelRender } = useDelayRender();
  const [handle] = useState(() =>
    delayRender("Drawing the travel ephemera", {
      timeoutInMilliseconds: 60000,
    }),
  );
  const [textures, setTextures] = useState<Record<Kind, THREE.Texture> | null>(
    null,
  );

  useEffect(() => {
    Promise.all([
      load(PHOTO.tower),
      load(PHOTO.shibuya),
      load(PHOTO.inari),
      load(PHOTO.bamboo),
      fontsReady(),
    ])
      .then(([tower, shibuya, inari, bamboo]) => {
        const canvases: Record<Kind, HTMLCanvasElement> = {
          tower: polaroid(piece("tower"), tower, "tokyo, night one"),
          shibuya: polaroid(piece("shibuya"), shibuya, "shibuya!!"),
          inari: polaroid(piece("inari"), inari, "kyoto at 6am?"),
          bamboo: polaroid(piece("bamboo"), bamboo, "kyoto, from the hill"),
          boarding: boarding(piece("boarding")),
          train: train(piece("train")),
          receipt: receipt(piece("receipt")),
          sticky: sticky(piece("sticky")),
          scrap: scrap(piece("scrap")),
          passport: passport(piece("passport")),
        };
        const out = {} as Record<Kind, THREE.Texture>;
        for (const kind of Object.keys(canvases) as Kind[]) {
          const t = new THREE.CanvasTexture(canvases[kind]);
          t.colorSpace = THREE.SRGBColorSpace;
          t.anisotropy = 8;
          out[kind] = t;
        }
        setTextures(out);
      })
      .catch((err) => cancelRender(err));
  }, [cancelRender]);

  // Released after commit, once <ThreeCanvas> has mounted and taken its own hold.
  useEffect(() => {
    if (textures) continueRender(handle);
  }, [textures, continueRender, handle]);

  return textures;
};

/** A sheet of paper with a slight curl, so light rakes across it. */
const paperGeometry = (w: number, h: number) => {
  const geo = new THREE.PlaneGeometry(w, h, 10, 10);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++)
    pos.setZ(i, 0.05 * (pos.getX(i) / (w / 2)) ** 2);
  geo.computeVertexNormals();
  return geo;
};

/** Where piece i is at a frame: tossed in from past the frame, floating, then pulled into the mark. */
const pose = (p: Piece, i: number, f: number) => {
  const land = tween(f, [i * 3, i * 3 + 22], [0, 1], ease.out);
  const bob = Math.sin((f / 80 + i * 0.37) * Math.PI * 2);
  const pull = tween(f, [72 + i * 1.8, 98 + i * 1.8], [0, 1], ease.inOut);
  const reach = (1 + (1 - land) * 0.95) * (1 - pull);
  const swirl = pull * 1.4;
  return {
    x: (p.x * Math.cos(swirl) - p.z * Math.sin(swirl)) * reach,
    y:
      (p.y + (1 - land) * 2.4 + bob * 0.06) * (1 - pull) +
      (PULL_Y + Math.sin(Math.PI * pull) * 0.9) * pull,
    z: (p.x * Math.sin(swirl) + p.z * Math.cos(swirl)) * reach,
    spin:
      THREE.MathUtils.degToRad(
        p.rot + (1 - land) * (i % 2 ? 34 : -34) + bob * 1.4,
      ) +
      pull * 2.8,
    tilt: bob * 0.025 + (1 - land) * 0.3,
    scale: 1 - pull * 0.94,
    gone: pull >= 1,
  };
};

const Pieces: React.FC<{
  textures: Record<Kind, THREE.Texture>;
  frame: number;
}> = ({ textures, frame }) => {
  const meshes = useMemo(
    () =>
      PIECES.map((p) => {
        const face = new THREE.MeshStandardMaterial({
          map: textures[p.kind],
          roughness: 0.88,
          side: THREE.DoubleSide,
          transparent: p.kind === "receipt",
          alphaTest: p.kind === "receipt" ? 0.5 : 0,
        });
        if (p.kind !== "passport")
          return {
            geometry: paperGeometry(p.w, p.h),
            material: face as THREE.Material | THREE.Material[],
          };
        const cover = new THREE.MeshStandardMaterial({
          color: "#3E171C",
          roughness: 0.7,
        });
        const pages = new THREE.MeshStandardMaterial({
          color: "#EFE8DA",
          roughness: 0.95,
        });
        return {
          geometry: new THREE.BoxGeometry(p.w, p.h, 0.09),
          material: [pages, cover, pages, pages, face, cover],
        };
      }),
    [textures],
  );
  return (
    <>
      {PIECES.map((p, i) => {
        const s = pose(p, i, frame);
        if (s.gone) return null;
        return (
          <mesh
            key={p.kind}
            geometry={meshes[i].geometry}
            material={meshes[i].material}
            position={[s.x, s.y, s.z]}
            rotation={[-Math.PI / 2 + s.tilt, 0, s.spin]}
            scale={s.scale}
            castShadow
          />
        );
      })}
    </>
  );
};

/** A slow push in over the table. */
const Rig: React.FC<{ frame: number }> = ({ frame }) => {
  const { camera } = useThree();
  useLayoutEffect(() => {
    const push = tween(frame, [0, 120], [0, 1], ease.inOut);
    camera.position.set(0, 15.6 - push * 2.8, 7.4 - push * 2.2);
    camera.lookAt(0, PULL_Y, 0);
    camera.updateMatrixWorld();
  }, [camera, frame]);
  return null;
};

// --------------------------------------------------------------- the scene

export const Opening: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const textures = useEphemera();
  const { delayRender, continueRender } = useDelayRender();
  const wordmark = useRef<HTMLDivElement>(null);
  const [wordWidth, setWordWidth] = useState(520);

  // Mark + wordmark are centred as a pair, so measure the wordmark once its face is in.
  useLayoutEffect(() => {
    const h = delayRender("Measuring the wordmark");
    fontsReady().then(() => {
      if (wordmark.current) setWordWidth(wordmark.current.offsetWidth);
      continueRender(h);
    });
  }, [delayRender, continueRender]);

  const star = tween(frame, [96, 122], [0, 1]);
  const markX =
    -((GAP + wordWidth) / 2) * tween(frame, [118, 144], [0, 1], ease.fluid);
  const reveal = tween(frame, [124, 148], [0, 1], ease.fluid);
  const wave = tween(frame, [96, 126], [0, 1], ease.out);

  return (
    <AbsoluteFill>
      <Paper />
      {textures ? (
        <ThreeCanvas
          width={width}
          height={height}
          flat
          shadows="variance"
          camera={{ fov: 32, near: 0.1, far: 80, position: [0, 15.6, 7.4] }}
        >
          <Rig frame={frame} />
          <ambientLight intensity={1.35} color="#FFF8EE" />
          <directionalLight
            position={[-5, 12, 4]}
            intensity={1.7}
            color="#FFF3E2"
            castShadow
            shadow-mapSize={[2048, 2048]}
            shadow-camera-left={-12}
            shadow-camera-right={12}
            shadow-camera-top={10}
            shadow-camera-bottom={-10}
            shadow-camera-near={1}
            shadow-camera-far={40}
            shadow-radius={9}
            shadow-blurSamples={16}
          />
          <Pieces textures={textures} frame={frame} />
          <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
            <planeGeometry args={[80, 80]} />
            <shadowMaterial color="#4A3620" opacity={0.22} transparent />
          </mesh>
        </ThreeCanvas>
      ) : null}

      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
        <Words
          lines={["Every trip", "starts in pieces."]}
          at={12}
          out={66}
          style={{ fontSize: 136, textAlign: "center" }}
        />
      </AbsoluteFill>

      {wave > 0 && wave < 1 ? (
        <div
          style={{
            position: "absolute",
            left: 460,
            top: 40,
            width: 1000,
            height: 1000,
            borderRadius: "50%",
            border: `2px solid ${C.accent}`,
            opacity: (1 - wave) * 0.5,
            scale: `${0.08 + wave * 0.92}`,
          }}
        />
      ) : null}

      <div
        style={{
          position: "absolute",
          left: 960 - BOX / 2,
          top: 540 - BOX / 2,
          translate: `${markX}px 0`,
        }}
      >
        <Logo3D
          size={BOX}
          star={star}
          ring={tween(frame, [104, 136], [0, 1], ease.inOut)}
          spin={(1 - star) * -2.6}
          tilt={[(1 - star) * 0.5, 0]}
        />
      </div>

      <div
        ref={wordmark}
        style={{
          position: "absolute",
          left: 960 + markX + MARK / 2 + GAP,
          top: 540 - 84,
          fontFamily: serif,
          fontWeight: 500,
          fontSize: 150,
          lineHeight: 1,
          letterSpacing: "-0.03em",
          color: C.ink,
          clipPath: `inset(-30% ${(1 - reveal) * 100}% -30% 0)`,
          translate: `${(1 - reveal) * -40}px 0`,
        }}
      >
        Wayfare
      </div>

      <Fade
        at={134}
        style={{
          position: "absolute",
          top: 670,
          width: "100%",
          textAlign: "center",
          fontFamily: sans,
          fontWeight: 500,
          fontSize: 42,
          color: C.ink2,
        }}
      >
        The travel companion that handles your trip.
      </Fade>
    </AbsoluteFill>
  );
};
