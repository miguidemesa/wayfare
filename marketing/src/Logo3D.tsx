import React, { useLayoutEffect, useMemo } from "react";
import * as THREE from "three";
import { useThree } from "@react-three/fiber";
import { ThreeCanvas } from "@remotion/three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

// The compass star from the app icon (mobile/assets/icon.png): four points
// with the waist at 0.6 of the radius, inside a ring at 1.24.
const star = new THREE.Shape();
for (let i = 0; i < 8; i++) {
  const a = Math.PI / 2 - (i * Math.PI) / 4;
  const r = i % 2 ? 0.6 : 1;
  if (i) star.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  else star.moveTo(Math.cos(a) * r, Math.sin(a) * r);
}
const starGeometry = new THREE.ExtrudeGeometry(star, {
  depth: 0.14,
  bevelEnabled: true,
  bevelThickness: 0.06,
  bevelSize: 0.05,
  bevelSegments: 6,
  curveSegments: 1,
});
starGeometry.center();

const RING = 1.24;
const TUBE = 0.072;

/** A soft studio for the enamel to reflect, built in code (no HDR download). */
const Studio: React.FC = () => {
  const { gl, scene } = useThree();
  useLayoutEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = env;
    scene.environmentIntensity = 0.4;
    return () => {
      scene.environment = null;
      env.dispose();
      pmrem.dispose();
    };
  }, [gl, scene]);
  return null;
};

/** The ring, drawn on like a pen stroke from 12 o'clock, with rounded ends. */
const Ring: React.FC<{ p: number; material: THREE.Material }> = ({
  p,
  material,
}) => {
  const arc = Math.PI * 2 * p;
  const geometry = useMemo(
    () =>
      new THREE.TorusGeometry(
        RING,
        TUBE,
        24,
        Math.max(6, Math.round(240 * p)),
        arc,
      ),
    [arc, p],
  );
  useLayoutEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <group rotation={[0, 0, Math.PI / 2]}>
      <mesh geometry={geometry} material={material} castShadow />
      {[0, arc].map((a, i) => (
        <mesh
          key={i}
          position={[Math.cos(a) * RING, Math.sin(a) * RING, 0]}
          material={material}
          castShadow
        >
          <sphereGeometry args={[TUBE, 20, 14]} />
        </mesh>
      ))}
    </group>
  );
};

/**
 * Wayfare's mark in enamel. `star` and `ring` run 0→1 to build it. `size` is
 * the canvas box in px: the mark fills about 65% of it, leaving room for its shadow.
 */
export const Logo3D: React.FC<{
  size: number;
  star: number;
  ring: number;
  spin?: number;
  tilt?: [number, number];
  color?: string;
  shadow?: string;
  light?: number;
}> = ({
  size,
  star: s,
  ring,
  spin = 0,
  tilt = [0, 0],
  color = "#B03D22",
  shadow = "#3A2A1A",
  light = 3,
}) => {
  const material = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color,
        roughness: 0.32,
        clearcoat: 1,
        clearcoatRoughness: 0.16,
      }),
    [color],
  );
  return (
    <ThreeCanvas
      width={size}
      height={size}
      flat
      shadows="variance"
      camera={{ fov: 24, position: [0, 0, 9.5], near: 0.1, far: 40 }}
    >
      <Studio />
      {/* three.js divides light by π: these land the enamel near its own colour, with room for highlights. */}
      <ambientLight intensity={0.4} />
      <directionalLight
        position={[light, 3.2, 6]}
        intensity={1.8}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-radius={14}
        shadow-blurSamples={20}
        shadow-camera-left={-3}
        shadow-camera-right={3}
        shadow-camera-top={3}
        shadow-camera-bottom={-3}
      />
      <directionalLight position={[-5, -3, 4]} intensity={0.35} />
      <group rotation={[tilt[0], tilt[1], 0]}>
        {s > 0.001 ? (
          <mesh
            geometry={starGeometry}
            material={material}
            scale={s}
            rotation={[0, 0, spin]}
            castShadow
          />
        ) : null}
        {ring > 0.004 ? <Ring p={ring} material={material} /> : null}
      </group>
      <mesh position={[0, 0, -0.8]} receiveShadow>
        <planeGeometry args={[14, 14]} />
        <shadowMaterial color={shadow} opacity={0.3} transparent />
      </mesh>
    </ThreeCanvas>
  );
};
