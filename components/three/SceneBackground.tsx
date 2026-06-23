"use client";

import { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";

function ParticleField({ count = 1400 }: { count?: number }) {
  const ref = useRef<THREE.Points>(null);

  const { positions, colors } = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const palette = [
      new THREE.Color("#6d5efc"),
      new THREE.Color("#b14bff"),
      new THREE.Color("#2bd9d0"),
    ];
    for (let i = 0; i < count; i++) {
      const r = 4 + Math.random() * 9;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta) * 0.6;
      positions[i * 3 + 2] = r * Math.cos(phi);
      const c = palette[i % palette.length];
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }
    return { positions, colors };
  }, [count]);

  useFrame((state, delta) => {
    if (!ref.current) return;
    ref.current.rotation.y += delta * 0.04;
    ref.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.1) * 0.12;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-color" args={[colors, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={0.05}
        vertexColors
        transparent
        opacity={0.85}
        sizeAttenuation
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

function Nucleus() {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    if (!ref.current) return;
    const s = 1 + Math.sin(state.clock.elapsedTime * 0.8) * 0.06;
    ref.current.scale.setScalar(s);
  });
  return (
    <mesh ref={ref}>
      <icosahedronGeometry args={[1.5, 1]} />
      <meshBasicMaterial color="#b14bff" wireframe transparent opacity={0.25} />
    </mesh>
  );
}

export default function SceneBackground() {
  return (
    <div className="absolute inset-0 -z-10">
      <Canvas
        camera={{ position: [0, 0, 12], fov: 60 }}
        dpr={[1, 1.8]}
        gl={{ antialias: true, alpha: true }}
      >
        <ParticleField />
        <Nucleus />
      </Canvas>
    </div>
  );
}
