"use client";

import { useEffect, useMemo } from "react";
import { SphereGeometry } from "three";
import { ATMOSPHERE_RADIUS, createAtmosphereMaterial } from "../lib/shaders";

/**
 * Back-side rim-glow shell that gives the planet its atmospheric halo.
 * Purely a shader effect (additive, depth-write off); cheap and static.
 */
export default function Atmosphere() {
  const geo = useMemo(() => new SphereGeometry(ATMOSPHERE_RADIUS, 64, 64), []);
  const mat = useMemo(() => createAtmosphereMaterial(), []);

  useEffect(() => {
    return () => {
      geo.dispose();
      mat.dispose();
    };
  }, [geo, mat]);

  return <mesh geometry={geo} material={mat} renderOrder={2} />;
}
