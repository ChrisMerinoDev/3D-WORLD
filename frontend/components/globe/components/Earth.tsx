"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { SphereGeometry, Vector3 } from "three";
import { CLOUD_RADIUS, EARTH_RADIUS } from "../lib/constants";
import { createCloudMaterial, createEarthMaterial } from "../lib/shaders";
import { sunDirection } from "../lib/geo";

/**
 * The Earth surface plus a drifting cloud shell. Owns the live sun-direction
 * uniform (recomputed ~2×/second, allocation-free per frame) that drives the
 * real-time day/night terminator on both shells.
 */
export default function Earth() {
  const earthGeo = useMemo(() => new SphereGeometry(EARTH_RADIUS, 96, 96), []);
  const cloudGeo = useMemo(() => new SphereGeometry(CLOUD_RADIUS, 64, 64), []);
  const earthMat = useMemo(() => createEarthMaterial(), []);
  const cloudMat = useMemo(() => createCloudMaterial(), []);

  const sunDir = useRef(new Vector3(1, 0, 0));
  const sunAccum = useRef(1); // force an immediate compute on first frame

  useEffect(() => {
    // Seed with the current terminator before the first frame paints.
    sunDirection(new Date(), sunDir.current);
    (earthMat.uniforms.uSunDir.value as Vector3).copy(sunDir.current);
    (cloudMat.uniforms.uSunDir.value as Vector3).copy(sunDir.current);
  }, [earthMat, cloudMat]);

  useEffect(() => {
    return () => {
      earthGeo.dispose();
      cloudGeo.dispose();
      earthMat.dispose();
      cloudMat.dispose();
    };
  }, [earthGeo, cloudGeo, earthMat, cloudMat]);

  useFrame((_, delta) => {
    sunAccum.current += delta;
    if (sunAccum.current >= 0.5) {
      sunAccum.current = 0;
      sunDirection(new Date(), sunDir.current);
      (earthMat.uniforms.uSunDir.value as Vector3).copy(sunDir.current);
      (cloudMat.uniforms.uSunDir.value as Vector3).copy(sunDir.current);
    }
    cloudMat.uniforms.uTime.value += delta;
  });

  return (
    <group>
      <mesh geometry={earthGeo} material={earthMat} renderOrder={0} />
      <mesh geometry={cloudGeo} material={cloudMat} renderOrder={1} />
    </group>
  );
}
