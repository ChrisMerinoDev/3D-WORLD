"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import {
  AdditiveBlending,
  CanvasTexture,
  Color,
  DynamicDrawUsage,
  IcosahedronGeometry,
  type InstancedMesh,
  MeshBasicMaterial,
  Object3D,
  type Sprite,
  SpriteMaterial,
} from "three";
import { MARKER_RADIUS } from "../lib/constants";
import { latLngToVector3 } from "../lib/geo";

export interface MarkerDatum {
  id: string;
  lat: number;
  lng: number;
}

interface MarkersProps {
  points: MarkerDatum[];
  selectedId?: string;
  color: string;
  activeColor: string;
  size: number;
  /** Target opacity for the layer (drives cross-fade between drill levels). */
  targetOpacity: number;
  /** Whether clicks/hover on this layer are accepted. */
  interactive: boolean;
  pulse: boolean;
  reducedMotion: boolean;
  onSelect: (id: string) => void;
}

/** Reused scratch objects — never allocate inside useFrame. */
const dummy = new Object3D();

/** Soft radial glow sprite texture, generated once on the client. */
function makeGlowTexture(): CanvasTexture {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, "rgba(255,255,255,0.95)");
  g.addColorStop(0.3, "rgba(255,255,255,0.35)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return new CanvasTexture(canvas);
}

/**
 * A layer of instanced markers on the globe. Handles raycast selection,
 * per-instance hover elevation + pulse, opacity cross-fade, and a glowing
 * halo on the selected marker. One InstancedMesh = one draw call per layer.
 */
export default function Markers({
  points,
  selectedId,
  color,
  activeColor,
  size,
  targetOpacity,
  interactive,
  pulse,
  reducedMotion,
  onSelect,
}: MarkersProps) {
  const meshRef = useRef<InstancedMesh>(null);
  const haloRef = useRef<Sprite>(null);
  const hoveredRef = useRef(-1);

  const positions = useMemo(
    () => points.map((p) => latLngToVector3(p.lat, p.lng, MARKER_RADIUS)),
    [points],
  );
  const selectedIndex = useMemo(
    () => (selectedId ? points.findIndex((p) => p.id === selectedId) : -1),
    [points, selectedId],
  );

  const geometry = useMemo(() => new IcosahedronGeometry(1, 1), []);
  const material = useMemo(
    () =>
      new MeshBasicMaterial({ transparent: true, toneMapped: false, opacity: 0 }),
    [],
  );
  const baseColor = useMemo(() => new Color(color), [color]);
  const activeColorObj = useMemo(() => new Color(activeColor), [activeColor]);

  const glowTex = useMemo(() => makeGlowTexture(), []);
  const haloMaterial = useMemo(
    () =>
      new SpriteMaterial({
        map: glowTex,
        color: new Color(activeColor),
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
        opacity: 0,
      }),
    [glowTex, activeColor],
  );

  useEffect(() => {
    return () => {
      geometry.dispose();
      material.dispose();
      haloMaterial.dispose();
      glowTex.dispose();
    };
  }, [geometry, material, haloMaterial, glowTex]);

  // Mark the instance matrix as dynamic (updated every frame for pulse/hover).
  useEffect(() => {
    const mesh = meshRef.current;
    if (mesh) mesh.instanceMatrix.setUsage(DynamicDrawUsage);
  }, [points.length]);

  // Per-instance colors: highlight the selected marker.
  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    for (let i = 0; i < positions.length; i++) {
      mesh.setColorAt(i, i === selectedIndex ? activeColorObj : baseColor);
    }
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [positions, selectedIndex, baseColor, activeColorObj]);

  // Reset the cursor if we unmount while hovering.
  useEffect(() => {
    return () => {
      document.body.style.cursor = "auto";
    };
  }, []);

  useFrame((state, delta) => {
    const mesh = meshRef.current;
    if (!mesh) return;

    // Smooth opacity cross-fade.
    const mat = mesh.material as MeshBasicMaterial;
    mat.opacity += (targetOpacity - mat.opacity) * Math.min(1, delta * 6);
    mesh.visible = mat.opacity > 0.02;
    if (!mesh.visible) return;

    const t = state.clock.elapsedTime;
    const hovered = hoveredRef.current;
    for (let i = 0; i < positions.length; i++) {
      let scale = size;
      if (pulse && !reducedMotion) {
        scale *= 1 + 0.15 * Math.sin(t * 2.2 + i * 0.7);
      }
      if (i === selectedIndex) scale *= 2.2;
      else if (i === hovered) scale *= 1.6;
      dummy.position.copy(positions[i]);
      dummy.scale.setScalar(scale);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;

    // Halo tracks the selected marker with a gentle pulse.
    const halo = haloRef.current;
    if (halo) {
      const hmat = halo.material as SpriteMaterial;
      if (selectedIndex >= 0 && positions[selectedIndex]) {
        halo.position.copy(positions[selectedIndex]);
        const pulseScale =
          size * 12 * (reducedMotion ? 1 : 1 + 0.18 * Math.sin(t * 3));
        halo.scale.setScalar(pulseScale);
        hmat.opacity += (0.9 - hmat.opacity) * Math.min(1, delta * 6);
        halo.visible = true;
      } else {
        hmat.opacity += (0 - hmat.opacity) * Math.min(1, delta * 6);
        halo.visible = hmat.opacity > 0.02;
      }
    }
  });

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    if (!interactive) return;
    e.stopPropagation();
    const id = e.instanceId;
    if (id != null && points[id]) onSelect(points[id].id);
  };

  const handleMove = (e: ThreeEvent<PointerEvent>) => {
    if (!interactive) return;
    e.stopPropagation();
    hoveredRef.current = e.instanceId ?? -1;
    document.body.style.cursor = "pointer";
  };

  const handleOut = () => {
    hoveredRef.current = -1;
    document.body.style.cursor = "auto";
  };

  if (points.length === 0) return null;

  return (
    <group>
      <instancedMesh
        ref={meshRef}
        args={[geometry, material, points.length]}
        onClick={handleClick}
        onPointerMove={handleMove}
        onPointerOut={handleOut}
      />
      <sprite ref={haloRef} material={haloMaterial} visible={false} />
    </group>
  );
}
