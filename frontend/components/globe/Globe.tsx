"use client";

/**
 * Aurora — the cinematic, interactive 3D globe.
 *
 * Self-contained R3F scene with NO required props. Reads navigation + data
 * from `useWorldStore` and drives selection back through it. Safe to import
 * via `next/dynamic({ ssr: false })`: all WebGL/browser work happens inside
 * effects and the client-only <Canvas>.
 */
import { Suspense, useEffect, useState, useSyncExternalStore } from "react";
import { Canvas } from "@react-three/fiber";
import { useWorldStore } from "@/store/worldStore";
import { LEVEL_DISTANCE, PALETTE } from "./lib/constants";
import { isWebGLAvailable } from "./lib/webgl";
import { useReducedMotion } from "./lib/useReducedMotion";
import Scene from "./components/Scene";

/** WebGL support is static per session — detect once, read via a store. */
let webglSupport: boolean | undefined;
function getWebGLSupport(): boolean {
  if (webglSupport === undefined) webglSupport = isWebGLAvailable();
  return webglSupport;
}
const noopSubscribe = () => () => {};

export default function Globe() {
  const loadCountries = useWorldStore((s) => s.loadCountries);
  const goBack = useWorldStore((s) => s.goBack);
  const reducedMotion = useReducedMotion();

  // Assume supported on the server; the client resolves the real value on
  // first render without a hydration mismatch (this is only mounted ssr:false).
  const supported = useSyncExternalStore(noopSubscribe, getWebGLSupport, () => true);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    void loadCountries();
  }, [loadCountries]);

  // Escape key steps back up the drill hierarchy.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (useWorldStore.getState().level !== "world") goBack();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goBack]);

  return (
    <div
      data-testid="globe-canvas"
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        background: `radial-gradient(circle at 50% 40%, #0a1226 0%, ${PALETTE.space} 70%)`,
        overflow: "hidden",
      }}
    >
      {!supported ? (
        <WebGLFallback />
      ) : (
        <Canvas
          dpr={[1, 2]}
          camera={{
            position: [0, 0.5, LEVEL_DISTANCE.world],
            fov: 42,
            near: 0.01,
            far: 100,
          }}
          gl={{ antialias: true, powerPreference: "high-performance" }}
          onCreated={() => setReady(true)}
          onPointerMissed={() => {
            if (useWorldStore.getState().level !== "world") goBack();
          }}
          style={{ position: "absolute", inset: 0 }}
        >
          <color attach="background" args={[PALETTE.space]} />
          <Suspense fallback={null}>
            <Scene reducedMotion={reducedMotion} />
          </Suspense>
        </Canvas>
      )}

      {supported && !ready ? <LoaderOverlay /> : null}
    </div>
  );
}

function LoaderOverlay() {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "1.1rem",
        color: "rgba(220,240,255,0.85)",
        letterSpacing: "0.28em",
        textTransform: "uppercase",
        fontSize: "0.7rem",
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          width: 46,
          height: 46,
          borderRadius: "50%",
          border: "2px solid rgba(79,240,224,0.15)",
          borderTopColor: PALETTE.atmosphere,
          animation: "aurora-spin 0.9s linear infinite",
        }}
      />
      <span>Charting the Earth</span>
      <style>{`@keyframes aurora-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function WebGLFallback() {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "0.75rem",
        padding: "2rem",
        textAlign: "center",
        color: "rgba(220,240,255,0.8)",
      }}
    >
      <strong style={{ fontSize: "1.05rem", letterSpacing: "0.04em" }}>
        3D globe unavailable
      </strong>
      <p style={{ maxWidth: 360, fontSize: "0.85rem", lineHeight: 1.5, opacity: 0.75 }}>
        Your browser or device doesn&apos;t support WebGL, so the interactive
        Earth can&apos;t be rendered. The clock and location panels still work.
      </p>
    </div>
  );
}
