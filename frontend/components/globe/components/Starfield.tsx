"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Stars } from "@react-three/drei";
import type { Group } from "three";

/**
 * Deep-space galaxy backdrop. drei's <Stars> gives a twinkling point cloud;
 * a very slow parallax rotation adds depth. Rotation is disabled under
 * reduced-motion.
 */
export default function Starfield({ reducedMotion }: { reducedMotion: boolean }) {
  const ref = useRef<Group>(null);

  useFrame((_, delta) => {
    if (reducedMotion || !ref.current) return;
    ref.current.rotation.y += delta * 0.004;
    ref.current.rotation.x += delta * 0.001;
  });

  return (
    <group ref={ref}>
      <Stars
        radius={40}
        depth={30}
        count={4500}
        factor={3.2}
        saturation={0.35}
        fade
        speed={reducedMotion ? 0 : 0.6}
      />
    </group>
  );
}
