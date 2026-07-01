"use client";

import { useEffect, useRef, type RefObject } from "react";
import { useThree } from "@react-three/fiber";
import gsap from "gsap";
import { Vector3, type Group } from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { useWorldStore } from "@/store/worldStore";
import { latLngToVector3 } from "../lib/geo";
import {
  CITY_ORBIT_SPEED,
  FLYTO_DURATION,
  LEVEL_DISTANCE,
  MARKER_RADIUS,
} from "../lib/constants";

interface CameraRigProps {
  controlsRef: RefObject<OrbitControlsImpl | null>;
  /** The rotating earth group — used to resolve marker world positions. */
  groupRef: RefObject<Group | null>;
  reducedMotion: boolean;
}

/**
 * Choreographs the camera. Subscribes to the store's drill level + selection
 * and eases the camera (and orbit target) toward the focused geography with
 * GSAP. Tweens are interruptible; reduced-motion snaps instead of flying.
 */
export default function CameraRig({
  controlsRef,
  groupRef,
  reducedMotion,
}: CameraRigProps) {
  const camera = useThree((s) => s.camera);
  const level = useWorldStore((s) => s.level);
  const country = useWorldStore((s) => s.selectedCountry);
  const state = useWorldStore((s) => s.selectedState);
  const city = useWorldStore((s) => s.selectedCity);

  const tweenRef = useRef<gsap.core.Tween | null>(null);
  const tmpLocal = useRef(new Vector3());

  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) return;
    const group = groupRef.current;

    // Resolve the focus point (lat/lng) and framing distance for this level.
    let focus: { lat: number; lng: number } | null = null;
    let distance: number = LEVEL_DISTANCE.world;
    if (level === "city" && city) {
      focus = { lat: city.lat, lng: city.lng };
      distance = LEVEL_DISTANCE.city;
    } else if (level === "state" && state?.lat != null && state?.lng != null) {
      focus = { lat: state.lat, lng: state.lng };
      distance = LEVEL_DISTANCE.state;
    } else if (level === "state" && country) {
      focus = { lat: country.lat, lng: country.lng };
      distance = LEVEL_DISTANCE.state;
    } else if (level === "country" && country) {
      focus = { lat: country.lat, lng: country.lng };
      distance = LEVEL_DISTANCE.country;
    }

    const destTarget = new Vector3();
    const destCamDir = new Vector3();

    if (focus) {
      latLngToVector3(focus.lat, focus.lng, MARKER_RADIUS, tmpLocal.current);
      if (group) {
        group.updateWorldMatrix(true, false);
        tmpLocal.current.applyMatrix4(group.matrixWorld);
      }
      destTarget.copy(tmpLocal.current);
      destCamDir.copy(destTarget).normalize();
    } else {
      // World level: keep the current viewing angle, just re-frame + tilt.
      destTarget.set(0, 0, 0);
      destCamDir.copy(camera.position).sub(controls.target).normalize();
      if (destCamDir.lengthSq() < 1e-6) destCamDir.set(0, 0.3, 1).normalize();
    }

    const destCamPos = destCamDir.multiplyScalar(distance);
    if (!focus) destCamPos.y += 0.35;

    const cityOrbit = level === "city" && !reducedMotion;
    tweenRef.current?.kill();

    if (reducedMotion) {
      camera.position.copy(destCamPos);
      controls.target.copy(destTarget);
      controls.update();
      controls.autoRotate = cityOrbit;
      return;
    }

    controls.enabled = false;
    controls.autoRotate = false;
    const proxy = {
      px: camera.position.x,
      py: camera.position.y,
      pz: camera.position.z,
      tx: controls.target.x,
      ty: controls.target.y,
      tz: controls.target.z,
    };
    tweenRef.current = gsap.to(proxy, {
      px: destCamPos.x,
      py: destCamPos.y,
      pz: destCamPos.z,
      tx: destTarget.x,
      ty: destTarget.y,
      tz: destTarget.z,
      duration: FLYTO_DURATION,
      ease: "power2.inOut",
      onUpdate() {
        camera.position.set(proxy.px, proxy.py, proxy.pz);
        controls.target.set(proxy.tx, proxy.ty, proxy.tz);
        controls.update();
      },
      onComplete() {
        controls.enabled = true;
        controls.autoRotate = cityOrbit;
        controls.autoRotateSpeed = CITY_ORBIT_SPEED;
      },
    });
  }, [
    level,
    country,
    state,
    city,
    reducedMotion,
    camera,
    controlsRef,
    groupRef,
  ]);

  useEffect(() => () => void tweenRef.current?.kill(), []);

  return null;
}
