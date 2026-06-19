"use client";

import { useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Line, Grid } from "@react-three/drei";
import * as THREE from "three";
import { buildPlot, type PlotData } from "@/lib/math/parsePlot";

function Curve2D({ data }: { data: PlotData }) {
  const points = useMemo(() => {
    if (!data.points2d) return [];
    return data.points2d
      .filter((p) => Number.isFinite(p.y))
      .map((p) => new THREE.Vector3(p.x, Math.max(-8, Math.min(8, p.y)), 0));
  }, [data]);

  if (points.length < 2) return null;
  return <Line points={points} color="#2bd9d0" lineWidth={3} />;
}

function Surface3D({ data }: { data: PlotData }) {
  const geometry = useMemo(() => {
    const g = data.grid;
    if (!g) return null;
    const { xs, ys, z, zMin, zMax } = g;
    const w = xs.length;
    const h = ys.length;
    const geo = new THREE.BufferGeometry();
    const verts: number[] = [];
    const cols: number[] = [];
    const indices: number[] = [];
    const span = zMax - zMin || 1;
    const cold = new THREE.Color("#2bd9d0");
    const warm = new THREE.Color("#b14bff");

    for (let j = 0; j < h; j++) {
      for (let i = 0; i < w; i++) {
        let zv = z[j][i];
        if (!Number.isFinite(zv)) zv = zMin;
        const clamped = Math.max(-5, Math.min(5, ((zv - zMin) / span) * 8 - 4));
        verts.push(xs[i], clamped, ys[j]);
        const t = (zv - zMin) / span;
        const c = cold.clone().lerp(warm, Number.isFinite(t) ? t : 0);
        cols.push(c.r, c.g, c.b);
      }
    }
    for (let j = 0; j < h - 1; j++) {
      for (let i = 0; i < w - 1; i++) {
        const a = j * w + i;
        const b = a + 1;
        const c = a + w;
        const d = c + 1;
        indices.push(a, c, b, b, c, d);
      }
    }
    geo.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
    geo.setAttribute("color", new THREE.Float32BufferAttribute(cols, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    return geo;
  }, [data]);

  if (!geometry) return null;
  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial
        vertexColors
        side={THREE.DoubleSide}
        roughness={0.4}
        metalness={0.1}
        transparent
        opacity={0.95}
      />
    </mesh>
  );
}

export default function FunctionPlotter({ expression }: { expression: string }) {
  const data = useMemo(() => buildPlot(expression), [expression]);

  if (data.kind === "invalid") {
    return (
      <div className="flex h-full w-full items-center justify-center text-center text-sm text-mist">
        {data.error ?? "Type an expression to plot, e.g. sin(x) or sin(x)*cos(y)"}
      </div>
    );
  }

  const is3d = data.kind === "3d";

  return (
    <Canvas
      camera={{ position: is3d ? [9, 7, 9] : [0, 0, 11], fov: 55 }}
      dpr={[1, 1.8]}
    >
      <ambientLight intensity={0.7} />
      <directionalLight position={[6, 10, 6]} intensity={1.1} />
      <directionalLight position={[-6, -4, -6]} intensity={0.4} color="#6d5efc" />
      {is3d ? <Surface3D data={data} /> : <Curve2D data={data} />}
      <Grid
        args={[20, 20]}
        cellColor="#1b2030"
        sectionColor="#2a3350"
        fadeDistance={28}
        infiniteGrid
        position={[0, is3d ? -4.2 : 0, 0]}
        rotation={is3d ? [0, 0, 0] : [Math.PI / 2, 0, 0]}
      />
      <OrbitControls
        enablePan={false}
        enableRotate={is3d}
        minDistance={4}
        maxDistance={24}
        autoRotate={is3d}
        autoRotateSpeed={0.6}
      />
    </Canvas>
  );
}
