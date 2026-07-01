"use client";

import { useCallback, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { Bloom, EffectComposer, Vignette } from "@react-three/postprocessing";
import type { Group } from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { useWorldStore } from "@/store/worldStore";
import {
  CAMERA_MAX_DISTANCE,
  CAMERA_MIN_DISTANCE,
  IDLE_SPIN_SPEED,
  MARKER_SIZE,
  PALETTE,
} from "../lib/constants";
import Earth from "./Earth";
import Atmosphere from "./Atmosphere";
import Starfield from "./Starfield";
import Markers, { type MarkerDatum } from "./Markers";
import CameraRig from "./CameraRig";

/**
 * The full R3F scene graph. Reads all navigation state from the store and
 * drives selection back into it. Country/state/city markers live inside the
 * rotating earth group so they stay pinned to their geography.
 */
export default function Scene({ reducedMotion }: { reducedMotion: boolean }) {
  const groupRef = useRef<Group>(null);
  const controlsRef = useRef<OrbitControlsImpl | null>(null);

  const level = useWorldStore((s) => s.level);
  const countries = useWorldStore((s) => s.countries);
  const states = useWorldStore((s) => s.states);
  const cities = useWorldStore((s) => s.cities);
  const selectedCountry = useWorldStore((s) => s.selectedCountry);
  const selectedState = useWorldStore((s) => s.selectedState);
  const selectedCity = useWorldStore((s) => s.selectedCity);
  const selectCountry = useWorldStore((s) => s.selectCountry);
  const selectState = useWorldStore((s) => s.selectState);
  const selectCity = useWorldStore((s) => s.selectCity);

  const countryPoints = useMemo<MarkerDatum[]>(
    () => countries.map((c) => ({ id: c.iso2, lat: c.lat, lng: c.lng })),
    [countries],
  );
  const statePoints = useMemo<MarkerDatum[]>(
    () =>
      states
        .filter((s) => s.lat != null && s.lng != null)
        .map((s) => ({ id: s.iso, lat: s.lat as number, lng: s.lng as number })),
    [states],
  );
  const cityPoints = useMemo<MarkerDatum[]>(
    () => cities.map((c, i) => ({ id: String(i), lat: c.lat, lng: c.lng })),
    [cities],
  );
  const selectedCityId = useMemo(() => {
    if (!selectedCity) return undefined;
    const idx = cities.indexOf(selectedCity);
    return idx >= 0 ? String(idx) : undefined;
  }, [cities, selectedCity]);

  const onCity = useCallback(
    (id: string) => {
      const c = cities[Number(id)];
      if (c) selectCity(c);
    },
    [cities, selectCity],
  );

  // Gentle idle auto-rotation, only at world level and when motion is allowed.
  useFrame((_, delta) => {
    if (level === "world" && !reducedMotion && groupRef.current) {
      groupRef.current.rotation.y += delta * IDLE_SPIN_SPEED;
    }
  });

  return (
    <>
      <Starfield reducedMotion={reducedMotion} />

      <group ref={groupRef}>
        <Earth />
        <Markers
          points={countryPoints}
          selectedId={selectedCountry?.iso2}
          color={PALETTE.country}
          activeColor={PALETTE.countryActive}
          size={MARKER_SIZE.country}
          targetOpacity={level === "world" ? 1 : level === "country" ? 0.3 : 0}
          interactive={level === "world"}
          pulse
          reducedMotion={reducedMotion}
          onSelect={selectCountry}
        />
        <Markers
          points={statePoints}
          selectedId={selectedState?.iso}
          color={PALETTE.state}
          activeColor={PALETTE.stateActive}
          size={MARKER_SIZE.state}
          targetOpacity={level === "country" ? 1 : level === "state" ? 0.45 : 0}
          interactive={level === "country"}
          pulse
          reducedMotion={reducedMotion}
          onSelect={selectState}
        />
        <Markers
          points={cityPoints}
          selectedId={selectedCityId}
          color={PALETTE.city}
          activeColor={PALETTE.cityActive}
          size={MARKER_SIZE.city}
          targetOpacity={level === "state" || level === "city" ? 1 : 0}
          interactive={level === "state" || level === "city"}
          pulse
          reducedMotion={reducedMotion}
          onSelect={onCity}
        />
      </group>

      <Atmosphere />

      <OrbitControls
        ref={controlsRef}
        makeDefault
        enableDamping
        dampingFactor={0.08}
        enablePan={false}
        rotateSpeed={0.55}
        zoomSpeed={0.6}
        minDistance={CAMERA_MIN_DISTANCE}
        maxDistance={CAMERA_MAX_DISTANCE}
        minPolarAngle={0.15}
        maxPolarAngle={Math.PI - 0.15}
        autoRotateSpeed={0.35}
      />

      <CameraRig
        controlsRef={controlsRef}
        groupRef={groupRef}
        reducedMotion={reducedMotion}
      />

      <EffectComposer>
        <Bloom
          intensity={0.9}
          luminanceThreshold={0.2}
          luminanceSmoothing={0.9}
          mipmapBlur
        />
        <Vignette offset={0.28} darkness={0.72} />
      </EffectComposer>
    </>
  );
}
