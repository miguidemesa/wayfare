"use client";

// A stylized dot-matrix globe showing every trip destination. Slow drift +
// pointer parallax. Deliberately abstract — editorial illustration, not Google
// Earth. Tiny geometry budget (points + low-poly markers only).

import { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";

export type GlobeMarker = { lat: number; lng: number; label: string; active?: boolean };

const R = 2;

function toVec3(lat: number, lng: number, radius = R): [number, number, number] {
  const phi = ((90 - lat) * Math.PI) / 180;
  const theta = ((lng + 180) * Math.PI) / 180;
  return [-radius * Math.sin(phi) * Math.cos(theta), radius * Math.cos(phi), radius * Math.sin(phi) * Math.sin(theta)];
}

/** Fibonacci-sphere dot matrix forming the globe surface. */
function DotSphere({ color, count = 900 }: { color: string; count?: number }) {
  const ref = useRef<THREE.Points>(null);
  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3);
    const golden = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < count; i++) {
      const y = 1 - (i / (count - 1)) * 2;
      const rad = Math.sqrt(1 - y * y);
      const theta = golden * i;
      arr[i * 3] = Math.cos(theta) * rad * R;
      arr[i * 3 + 1] = y * R;
      arr[i * 3 + 2] = Math.sin(theta) * rad * R;
    }
    return arr;
  }, [count]);

  useFrame((_, delta) => {
    if (ref.current) ref.current.rotation.y += delta * 0.06;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial color={color} size={0.032} transparent opacity={0.55} sizeAttenuation depthWrite={false} />
    </points>
  );
}

function Markers({ markers }: { markers: GlobeMarker[] }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    ref.current.rotation.y = (clock.elapsedTime * 0.06) % (Math.PI * 2);
    const pulse = 1 + Math.sin(clock.elapsedTime * 2.2) * 0.18;
    ref.current.children.forEach((c) => {
      if ((c as THREE.Mesh).userData.active) c.scale.setScalar(pulse);
    });
  });

  return (
    <group ref={ref}>
      {markers.map((m, i) => {
        const [x, y, z] = toVec3(m.lat, m.lng, R * 1.01);
        return (
          <mesh key={i} position={[x, y, z]} userData={{ active: !!m.active }}>
            <sphereGeometry args={[m.active ? 0.055 : 0.04, 8, 8]} />
            <meshBasicMaterial color={m.active ? "#F4A8C4" : "#FBBF24"} />
          </mesh>
        );
      })}
    </group>
  );
}

/** Atmospheric halo + subtle inner sphere so dots read as a solid planet. */
function Body() {
  return (
    <mesh>
      <sphereGeometry args={[R * 0.985, 32, 32]} />
      <meshBasicMaterial color="#141a26" transparent opacity={0.9} />
    </mesh>
  );
}

function Rig() {
  useFrame((state) => {
    state.camera.position.x += (state.pointer.x * 0.8 - state.camera.position.x) * 0.03;
    state.camera.position.y += (0.4 + state.pointer.y * 0.5 - state.camera.position.y) * 0.03;
    state.camera.lookAt(0, 0, 0);
  });
  return null;
}

export default function TripGlobe({
  markers,
  accent = "#2dd4bf",
}: {
  markers: GlobeMarker[];
  accent?: string;
}) {
  return (
    <Canvas
      dpr={[1, 1.75]}
      gl={{ antialias: true, alpha: true, powerPreference: "low-power" }}
      camera={{ position: [0, 0.4, 5.2], fov: 40 }}
      style={{ position: "absolute", inset: 0 }}
      aria-hidden
    >
      <Rig />
      <Body />
      <DotSphere color={accent} />
      <Markers markers={markers} />
    </Canvas>
  );
}