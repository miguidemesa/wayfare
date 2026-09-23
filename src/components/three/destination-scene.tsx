"use client";

// Stylized, low-poly procedural destination environments. Deliberately NOT
// photorealistic — editorial illustration in 3D. Every scene shares one canvas
// with fog, gentle camera drift and pointer parallax. Polygon budgets are tiny
// (< 3k tris) so this can render on integrated GPUs and phones.

import { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { DestinationEnv } from "@/lib/destination-themes";

type Palette = { accent: string; accent2: string; glowA: string; deep: string };

/* ------------------------------------------------------------ atmosphere */

function Particles({
  count = 90,
  color,
  spread = 14,
  size = 0.09,
  speed = 0.15,
  rise = true,
}: {
  count?: number;
  color: string;
  spread?: number;
  size?: number;
  speed?: number;
  rise?: boolean;
}) {
  const ref = useRef<THREE.Points>(null);
  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      arr[i * 3] = (Math.random() - 0.5) * spread;
      arr[i * 3 + 1] = (Math.random() - 0.5) * 8;
      arr[i * 3 + 2] = (Math.random() - 0.5) * spread * 0.6;
    }
    return arr;
  }, [count, spread]);

  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.elapsedTime * speed;
    const arr = ref.current.geometry.attributes.position.array as Float32Array;
    for (let i = 0; i < count; i++) {
      arr[i * 3 + 1] += rise ? 0.0025 * (1 + speed) : Math.sin(t + i) * 0.001;
      arr[i * 3] += Math.sin(t * 0.6 + i * 1.7) * 0.0012;
      if (arr[i * 3 + 1] > 5) arr[i * 3 + 1] = -4;
    }
    ref.current.geometry.attributes.position.needsUpdate = true;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial color={color} size={size} transparent opacity={0.75} sizeAttenuation depthWrite={false} />
    </points>
  );
}

/** Pointer parallax + slow drift — feels alive without OrbitControls overhead. */
function CameraRig({ animation }: { animation: string }) {
  const speed = animation === "calm" ? 0.4 : animation === "airy" ? 0.7 : 0.55;
  useFrame((state) => {
    const t = state.clock.elapsedTime * speed;
    const px = state.pointer.x;
    const py = state.pointer.y;
    state.camera.position.x += (Math.sin(t * 0.3) * 0.6 + px * 1.2 - state.camera.position.x) * 0.02;
    state.camera.position.y += (1.6 + Math.sin(t * 0.2) * 0.25 + py * 0.6 - state.camera.position.y) * 0.02;
    state.camera.lookAt(0, 1, 0);
  });
  return null;
}

function Ground({ deep }: { deep: string }) {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.4, 0]}>
      <circleGeometry args={[30, 40]} />
      <meshStandardMaterial color={deep} roughness={1} />
    </mesh>
  );
}

/* ------------------------------------------------------------- environments */

function FujiEnv({ p }: { p: Palette }) {
  return (
    <group>
      {/* Mount Fuji */}
      <mesh position={[-3.2, 1.4, -9]}>
        <coneGeometry args={[6.5, 6, 5]} />
        <meshStandardMaterial color="#2A3140" flatShading roughness={0.95} />
      </mesh>
      <mesh position={[-3.2, 3.85, -9]}>
        <coneGeometry args={[1.9, 1.5, 5]} />
        <meshStandardMaterial color="#EDF2F7" flatShading roughness={0.9} />
      </mesh>
      {/* Torii gate */}
      <group position={[2.6, -1.3, -2]}>
        <mesh position={[0, 2.4, 0]}>
          <boxGeometry args={[4.4, 0.28, 0.34]} />
          <meshStandardMaterial color={p.accent} roughness={0.7} />
        </mesh>
        <mesh position={[0, 1.85, 0]}>
          <boxGeometry args={[3.6, 0.2, 0.28]} />
          <meshStandardMaterial color={p.accent} roughness={0.7} />
        </mesh>
        <mesh position={[-1.6, 0.8, 0]}>
          <cylinderGeometry args={[0.16, 0.19, 3, 8]} />
          <meshStandardMaterial color={p.accent} roughness={0.7} />
        </mesh>
        <mesh position={[1.6, 0.8, 0]}>
          <cylinderGeometry args={[0.16, 0.19, 3, 8]} />
          <meshStandardMaterial color={p.accent} roughness={0.7} />
        </mesh>
      </group>
      {/* Distant skyline blocks (city glow) */}
      {[...Array(7)].map((_, i) => (
        <mesh key={i} position={[5.5 + i * 0.9, 0.2 + (i % 3) * 0.5, -11 - (i % 4)]}>
          <boxGeometry args={[0.6, 1.6 + (i % 3) * 1.1, 0.6]} />
          <meshStandardMaterial color={p.accent2} roughness={0.85} />
        </mesh>
      ))}
      <Particles color={p.glowA} count={100} speed={0.12} size={0.085} />
    </group>
  );
}

function ParisEnv({ p }: { p: Palette }) {
  return (
    <group>
      {/* Eiffel silhouette — tapered stacked forms */}
      <group position={[1.4, -1.3, -4]} rotation={[0, 0.4, 0]}>
        <mesh position={[0, 2.2, 0]}>
          <cylinderGeometry args={[0.22, 1.5, 3.4, 4, 1, true]} />
          <meshStandardMaterial color={p.accent2} flatShading side={THREE.DoubleSide} roughness={0.6} />
        </mesh>
        <mesh position={[0, 5.1, 0]}>
          <cylinderGeometry args={[0.1, 0.55, 3, 4, 1, true]} />
          <meshStandardMaterial color={p.accent2} flatShading side={THREE.DoubleSide} roughness={0.6} />
        </mesh>
        <mesh position={[0, 7.1, 0]}>
          <coneGeometry args={[0.16, 1.4, 4]} />
          <meshStandardMaterial color={p.glowA} emissive={p.glowA} emissiveIntensity={0.35} />
        </mesh>
      </group>
      {/* Haussmann rooftops */}
      {[...Array(8)].map((_, i) => (
        <mesh key={i} position={[-6 + i * 1.5, -0.7 + (i % 2) * 0.35, -7 - (i % 3)]}>
          <boxGeometry args={[1.3, 1.4 + (i % 2) * 0.7, 1.1]} />
          <meshStandardMaterial color={i % 2 ? p.accent2 : p.deep} flatShading roughness={0.9} />
        </mesh>
      ))}
      <Particles color={p.glowA} count={70} speed={0.18} size={0.07} />
    </group>
  );
}

function RomeEnv({ p }: { p: Palette }) {
  return (
    <group>
      {/* Colosseum arc — broken ring of columns */}
      {[...Array(10)].map((_, i) => {
        const a = -0.6 + (i / 10) * 2.4;
        return (
          <mesh key={i} position={[Math.sin(a) * 4.2, 0.6, -6 - Math.cos(a) * 1.5]}>
            <cylinderGeometry args={[0.28, 0.32, 3.4, 8]} />
            <meshStandardMaterial color="#D9CBB2" flatShading roughness={0.85} />
          </mesh>
        );
      })}
      <mesh position={[0, 3.4, -6.8]}>
        <torusGeometry args={[4.2, 0.22, 6, 24, Math.PI * 1.25]} />
        <meshStandardMaterial color="#C9B896" flatShading roughness={0.85} />
      </mesh>
      {/* Cypress trees */}
      {[-7, -5.4, 6.8, 8].map((x, i) => (
        <mesh key={i} position={[x, 0.2, -4 - (i % 2)]}>
          <coneGeometry args={[0.42, 2.6, 6]} />
          <meshStandardMaterial color={p.accent2} flatShading roughness={0.9} />
        </mesh>
      ))}
      {/* Sun disc */}
      <mesh position={[-4.5, 4.6, -10]}>
        <sphereGeometry args={[1.15, 16, 16]} />
        <meshStandardMaterial color={p.glowA} emissive={p.glowA} emissiveIntensity={0.9} />
      </mesh>
      <Particles color={p.glowA} count={50} speed={0.1} size={0.06} />
    </group>
  );
}

function TropicsEnv({ p }: { p: Palette }) {
  return (
    <group>
      {/* Warm sea */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.35, 0]}>
        <circleGeometry args={[26, 40]} />
        <meshStandardMaterial color={p.accent2} roughness={0.35} metalness={0.15} />
      </mesh>
      {/* Islands + a lone palm */}
      {[
        [-4, 1.9, 2.4],
        [2.5, 1.2, 1.5],
        [6.5, 2.6, 3.1],
      ].map(([x, r, h], i) => (
        <group key={i} position={[x, -1.3, -4 - i * 2]}>
          <mesh position={[0, h / 2 - 0.4, 0]}>
            <coneGeometry args={[r, h, 6]} />
            <meshStandardMaterial color="#2E5D4B" flatShading roughness={0.9} />
          </mesh>
          <mesh position={[0.6, h - 0.1, 0.3]}>
            <cylinderGeometry args={[0.07, 0.1, 1.3, 5]} />
            <meshStandardMaterial color="#6B4B2A" roughness={0.9} />
          </mesh>
        </group>
      ))}
      {/* Sun */}
      <mesh position={[4.5, 3.6, -12]}>
        <sphereGeometry args={[1.6, 16, 16]} />
        <meshStandardMaterial color="#F6C453" emissive="#F6C453" emissiveIntensity={1} />
      </mesh>
      <Particles color={p.glowA} count={60} speed={0.14} size={0.07} rise={false} />
    </group>
  );
}

function PeaksEnv({ p }: { p: Palette }) {
  return (
    <group>
      {[
        [-6, 3.2, 4],
        [-1.5, 4.4, 5.6],
        [3.4, 3.6, 4.6],
        [7.5, 2.8, 3.4],
      ].map(([x, h, r], i) => (
        <group key={i}>
          <mesh position={[x, h / 2 - 1.4, -8 - i]}>
            <coneGeometry args={[r, h, 5]} />
            <meshStandardMaterial color={i % 2 ? p.accent2 : p.deep} flatShading roughness={0.95} />
          </mesh>
          <mesh position={[x, h / 2 - 1.4 + h / 2 + 0.35, -8 - i]}>
            <coneGeometry args={[r * 0.24, 0.7, 5]} />
            <meshStandardMaterial color="#E8EDF4" flatShading />
          </mesh>
        </group>
      ))}
      {/* stars */}
      <Particles color={p.glowA} count={110} speed={0.05} size={0.06} rise={false} spread={22} />
    </group>
  );
}

/* ------------------------------------------------------------------- canvas */

const ENVS: Record<DestinationEnv, (args: { p: Palette }) => React.JSX.Element> = {
  fuji: FujiEnv,
  paris: ParisEnv,
  rome: RomeEnv,
  tropics: TropicsEnv,
  hanok: PeaksEnv,
  peaks: PeaksEnv,
};

export default function DestinationScene({
  env,
  accent,
  accent2,
  glowA,
  deep,
  animation = "calm",
}: {
  env: DestinationEnv;
  accent: string;
  accent2: string;
  glowA: string;
  deep: string;
  animation?: string;
}) {
  const Env = ENVS[env] ?? PeaksEnv;
  return (
    <Canvas
      dpr={[1, 1.75]}
      gl={{ antialias: true, powerPreference: "low-power", alpha: true }}
      camera={{ position: [0, 1.6, 9], fov: 42 }}
      style={{ position: "absolute", inset: 0 }}
      aria-hidden
    >
      <fog attach="fog" args={[deep, 12, 30]} />
      <ambientLight intensity={0.75} />
      <directionalLight position={[-6, 8, 4]} intensity={1.15} color={glowA} />
      <directionalLight position={[6, 3, -6]} intensity={0.4} color={accent2} />
      <CameraRig animation={animation} />
      <Env p={{ accent, accent2, glowA, deep }} />
      <Ground deep={deep} />
    </Canvas>
  );
}