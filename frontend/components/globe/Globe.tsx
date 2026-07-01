"use client";

/**
 * Aurora — CesiumJS satellite globe.
 *
 * A self-contained, browser-only globe that renders REAL satellite imagery
 * (Bing via Cesium ion, or free Esri World Imagery as a fallback) and can zoom
 * from the whole planet down to street level. It has NO required props and is
 * safe to load via `next/dynamic({ ssr: false })`: every Cesium/WebGL/DOM call
 * happens inside a client-only effect.
 *
 * Integration seam: the globe READS the current selection + loaded geo data
 * from `useWorldStore` and drives the camera to match; it may call
 * `selectCountry` on globe clicks. It never mutates the store's data — the HUD
 * list is the primary navigation.
 *
 * `window.CESIUM_BASE_URL` MUST be set before Cesium's module evaluates, so the
 * engine is imported dynamically inside the effect (ES `import` is hoisted, so
 * a top-level static import could not be preceded by the assignment). Only the
 * widgets stylesheet is imported statically — CSS has no such ordering need.
 */
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useWorldStore, type WorldStore } from "@/store/worldStore";
import { ALTITUDE, FLYTO_DURATION, MAX_MARKERS, MAX_RENDER_TIME_CHANGE, PALETTE } from "./lib/constants";
import { isWebGLAvailable } from "./lib/webgl";
import { nearestCountryIso2 } from "./lib/geo";

// Type-only imports (erased at build) — the engine itself is loaded at RUNTIME
// from the static UMD bundle at /cesium/Cesium.js (see loadCesium). This keeps
// Cesium OUT of the Turbopack bundle, which otherwise mangles its built code
// ("Octal escape sequences are not allowed in template strings") and never
// starts, leaving the loader spinning forever.
type CesiumModule = typeof import("cesium");
type Viewer = import("cesium").Viewer;
type CustomDataSource = import("cesium").CustomDataSource;

const CESIUM_BASE = "/cesium";
let cesiumPromise: Promise<CesiumModule> | null = null;

/** Load the Cesium UMD build + widgets CSS from /public/cesium exactly once. */
function loadCesium(): Promise<CesiumModule> {
  if (cesiumPromise) return cesiumPromise;
  cesiumPromise = new Promise<CesiumModule>((resolve, reject) => {
    const w = window as unknown as { CESIUM_BASE_URL?: string; Cesium?: CesiumModule };
    w.CESIUM_BASE_URL = CESIUM_BASE;
    if (w.Cesium) {
      resolve(w.Cesium);
      return;
    }
    // Stylesheet (idempotent).
    if (!document.querySelector('link[data-cesium="1"]')) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = `${CESIUM_BASE}/Widgets/widgets.css`;
      link.dataset.cesium = "1";
      document.head.appendChild(link);
    }
    const script = document.createElement("script");
    script.src = `${CESIUM_BASE}/Cesium.js`;
    script.async = true;
    script.onload = () => {
      if (w.Cesium) resolve(w.Cesium);
      else reject(new Error("Cesium failed to initialize"));
    };
    script.onerror = () => reject(new Error("Cesium script failed to load"));
    document.head.appendChild(script);
  });
  return cesiumPromise;
}

// WebGL support is static per session — detect once, read via useSyncExternalStore.
let webglSupport: boolean | undefined;
function getWebGLSupport(): boolean {
  if (webglSupport === undefined) webglSupport = isWebGLAvailable();
  return webglSupport;
}
const noopSubscribe = () => () => {};

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export default function Globe() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  // Assume WebGL is available during SSR/first paint (this island is ssr:false),
  // then resolve the real value on the client without a hydration mismatch.
  const supported = useSyncExternalStore(noopSubscribe, getWebGLSupport, () => true);

  useEffect(() => {
    if (!supported) return;
    const container = containerRef.current;
    if (!container) return;

    let viewer: Viewer | null = null;
    let markerSource: CustomDataSource | null = null;
    let unsubscribe: (() => void) | null = null;
    let clickHandler: { destroy(): void } | null = null;
    let cancelled = false;

    (async () => {
      // Load Cesium from the static UMD bundle (not the Turbopack graph).
      const Cesium: CesiumModule = await loadCesium();
      if (cancelled) return;

      // --- Imagery + terrain: prefer ion (Bing), fall back to Esri World Imagery ---
      let imageryProvider: import("cesium").ImageryProvider;
      let terrainProvider: import("cesium").TerrainProvider | undefined;
      const token = process.env.NEXT_PUBLIC_CESIUM_ION_TOKEN;
      try {
        if (!token) throw new Error("no ion token");
        Cesium.Ion.defaultAccessToken = token;
        imageryProvider = await Cesium.createWorldImageryAsync();
        terrainProvider = await Cesium.createWorldTerrainAsync();
      } catch {
        // Free fallback — no token required, hosts allow-listed in the CSP.
        imageryProvider = await Cesium.ArcGisMapServerImageryProvider.fromUrl(
          "https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer",
        );
        terrainProvider = undefined; // default smooth ellipsoid terrain
      }
      if (cancelled) return;

      // --- Viewer: strip all default UI chrome, keep only the credit line ---
      viewer = new Cesium.Viewer(container, {
        baseLayer: false, // we add imagery explicitly below (avoid default Bing)
        baseLayerPicker: false,
        geocoder: false,
        homeButton: false,
        sceneModePicker: false,
        navigationHelpButton: false,
        animation: false,
        timeline: false,
        fullscreenButton: false,
        infoBox: false,
        selectionIndicator: false,
        requestRenderMode: true, // idle the GPU when nothing moves
        maximumRenderTimeChange: MAX_RENDER_TIME_CHANGE,
        contextOptions: { webgl: { powerPreference: "high-performance" } },
      });

      viewer.imageryLayers.addImageryProvider(imageryProvider);
      if (terrainProvider) viewer.terrainProvider = terrainProvider;

      const scene = viewer.scene;
      // Realism without heavy cost: lighting + atmosphere on, shadows off.
      scene.globe.enableLighting = true;
      scene.globe.showGroundAtmosphere = true;
      if (scene.skyAtmosphere) scene.skyAtmosphere.show = true;
      scene.fog.enabled = true;
      viewer.shadows = false;
      scene.globe.showWaterEffect = false;

      // Cap the render resolution: crisper than 1x on retina, but bounded so
      // high-DPR phones don't melt. (Overrides the browser-recommended value.)
      viewer.useBrowserRecommendedResolution = false;
      viewer.resolutionScale = Math.min(window.devicePixelRatio || 1, 1.5);

      // Lightweight marker layer (points only — very cheap).
      markerSource = new Cesium.CustomDataSource("aurora-markers");
      await viewer.dataSources.add(markerSource);
      if (cancelled) return;

      // Start on a whole-globe view, then let the store drive the camera.
      flyToSelection(Cesium, viewer, useWorldStore.getState(), true);
      rebuildMarkers(Cesium, viewer, markerSource, useWorldStore.getState());

      // --- Drive the camera + markers FROM THE STORE ---
      let lastSelSig = selectionSignature(useWorldStore.getState());
      let lastStates = useWorldStore.getState().states;
      let lastCities = useWorldStore.getState().cities;
      unsubscribe = useWorldStore.subscribe((state) => {
        if (!viewer || viewer.isDestroyed()) return;
        const sig = selectionSignature(state);
        if (sig !== lastSelSig) {
          lastSelSig = sig;
          // flyTo implicitly cancels any in-flight camera flight.
          flyToSelection(Cesium, viewer, state, prefersReducedMotion());
        }
        if (state.states !== lastStates || state.cities !== lastCities) {
          lastStates = state.states;
          lastCities = state.cities;
          if (markerSource) rebuildMarkers(Cesium, viewer, markerSource, state);
        }
      });

      // --- Optional: click the globe → select the nearest country (world view) ---
      const handler = new Cesium.ScreenSpaceEventHandler(scene.canvas);
      handler.setInputAction((movement: import("cesium").ScreenSpaceEventHandler.PositionedEvent) => {
        try {
          if (!viewer || viewer.isDestroyed()) return;
          if (useWorldStore.getState().level !== "world") return;
          const ray = viewer.camera.getPickRay(movement.position);
          const cart =
            (ray && scene.globe.pick(ray, scene)) ||
            viewer.camera.pickEllipsoid(movement.position);
          if (!cart) return;
          const carto = Cesium.Cartographic.fromCartesian(cart);
          const lat = Cesium.Math.toDegrees(carto.latitude);
          const lng = Cesium.Math.toDegrees(carto.longitude);
          const iso = nearestCountryIso2(lat, lng, useWorldStore.getState().countries);
          if (iso) void useWorldStore.getState().selectCountry(iso);
        } catch {
          // Picking is best-effort; ignore failures (HUD list is the real nav).
        }
      }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
      clickHandler = handler;

      setReady(true);
    })().catch(() => {
      if (!cancelled) setFailed(true);
    });

    return () => {
      cancelled = true;
      unsubscribe?.();
      clickHandler?.destroy();
      if (viewer && !viewer.isDestroyed()) viewer.destroy();
      viewer = null;
      markerSource = null;
    };
  }, [supported]);

  // Populate the HUD's country list on mount.
  useEffect(() => {
    void useWorldStore.getState().loadCountries();
  }, []);

  // Escape steps back up the drill hierarchy (mirrors HUD breadcrumb).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const store = useWorldStore.getState();
      if (store.level !== "world") store.goBack();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div
      data-testid="globe-canvas"
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        overflow: "hidden",
        background: "radial-gradient(circle at 50% 40%, #0a1226 0%, #04060d 70%)",
      }}
    >
      {!supported || failed ? (
        <StaticOverlay
          title={failed ? "Globe failed to load" : "3D globe unavailable"}
          body={
            failed
              ? "The satellite globe couldn't be initialized on this device. The clock and location panels still work."
              : "Your browser or device doesn't support WebGL, so the satellite globe can't be rendered. The clock and location panels still work."
          }
        />
      ) : (
        <>
          <div ref={containerRef} style={{ position: "absolute", inset: 0 }} />
          {!ready ? <LoaderOverlay /> : null}
        </>
      )}
      <CesiumChromeStyles />
    </div>
  );
}

/** Stable string that changes only when the fly-to target changes. */
function selectionSignature(s: WorldStore): string {
  return [
    s.level,
    s.selectedCountry?.iso2 ?? "",
    s.selectedState?.iso ?? "",
    s.selectedCity ? `${s.selectedCity.lat},${s.selectedCity.lng}` : "",
  ].join("|");
}

/** Fly the camera to match the current selection level/altitude. */
function flyToSelection(
  Cesium: CesiumModule,
  viewer: Viewer,
  s: WorldStore,
  reducedMotion: boolean,
): void {
  const cam = viewer.camera;
  const duration = reducedMotion ? 0 : FLYTO_DURATION;
  const easingFunction = Cesium.EasingFunction.QUINTIC_IN_OUT;
  const topDown = {
    heading: 0,
    pitch: Cesium.Math.toRadians(-90),
    roll: 0,
  };

  // City → street scale, slightly oblique so terrain/buildings read as 3D.
  if (s.level === "city" && s.selectedCity) {
    cam.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(
        s.selectedCity.lng,
        s.selectedCity.lat,
        ALTITUDE.city,
      ),
      orientation: {
        heading: Cesium.Math.toRadians(15),
        pitch: Cesium.Math.toRadians(-45),
        roll: 0,
      },
      duration,
      easingFunction,
    });
    return;
  }

  // State → region scale (only when the subdivision has a real centroid).
  if (
    s.level === "state" &&
    s.selectedState &&
    s.selectedState.lat != null &&
    s.selectedState.lng != null
  ) {
    cam.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(
        s.selectedState.lng,
        s.selectedState.lat,
        ALTITUDE.state,
      ),
      orientation: topDown,
      duration,
      easingFunction,
    });
    return;
  }

  // Country (also the fallback for a state that has no centroid).
  if ((s.level === "country" || s.level === "state") && s.selectedCountry) {
    cam.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(
        s.selectedCountry.lng,
        s.selectedCountry.lat,
        ALTITUDE.country,
      ),
      orientation: topDown,
      duration,
      easingFunction,
    });
    return;
  }

  // World → whole-globe overview.
  cam.flyHome(duration);
}

/** Rebuild the point-marker layer to reflect the deepest loaded dataset. */
function rebuildMarkers(
  Cesium: CesiumModule,
  viewer: Viewer,
  source: CustomDataSource,
  s: WorldStore,
): void {
  source.entities.removeAll();

  const add = (lng: number, lat: number, color: string, size: number) => {
    source.entities.add({
      position: Cesium.Cartesian3.fromDegrees(lng, lat),
      point: {
        pixelSize: size,
        color: Cesium.Color.fromCssColorString(color),
        outlineColor: Cesium.Color.BLACK.withAlpha(0.55),
        outlineWidth: 1,
        // Always visible, never occluded by the terrain silhouette.
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
    });
  };

  if (s.cities.length > 0) {
    for (const c of s.cities.slice(0, MAX_MARKERS)) add(c.lng, c.lat, PALETTE.city, 6);
  } else if (s.states.length > 0) {
    let n = 0;
    for (const st of s.states) {
      if (st.lat == null || st.lng == null) continue;
      add(st.lng, st.lat, PALETTE.state, 7);
      if (++n >= MAX_MARKERS) break;
    }
  }

  viewer.scene.requestRender(); // requestRenderMode: reflect the mutation now
}

function LoaderOverlay() {
  return (
    <div
      role="status"
      aria-label="Loading satellite globe"
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
        background: "radial-gradient(circle at 50% 40%, #0a1226 0%, #04060d 70%)",
      }}
    >
      <div
        style={{
          width: 46,
          height: 46,
          borderRadius: "50%",
          border: "2px solid rgba(79,240,224,0.15)",
          borderTopColor: "#4ff0e0",
          animation: "aurora-globe-spin 0.9s linear infinite",
        }}
      />
      <span>Loading satellite imagery</span>
      <style>{`@keyframes aurora-globe-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function StaticOverlay({ title, body }: { title: string; body: string }) {
  return (
    <div
      role="alert"
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
      <strong style={{ fontSize: "1.05rem", letterSpacing: "0.04em" }}>{title}</strong>
      <p style={{ maxWidth: 360, fontSize: "0.85rem", lineHeight: 1.5, opacity: 0.75 }}>
        {body}
      </p>
    </div>
  );
}

/** Keep Cesium's required attribution, but make it subtle and unobtrusive. */
function CesiumChromeStyles() {
  return (
    <style>{`
      .cesium-viewer, .cesium-widget, .cesium-widget canvas {
        width: 100%;
        height: 100%;
      }
      .cesium-widget-credits {
        font-size: 10px !important;
        color: rgba(220, 240, 255, 0.45) !important;
        text-shadow: 0 1px 2px rgba(0, 0, 0, 0.6);
        filter: saturate(0.6);
      }
      .cesium-widget-credits a { color: rgba(220, 240, 255, 0.55) !important; }
      .cesium-credit-logoContainer img { opacity: 0.55; }
      .cesium-viewer-bottom { pointer-events: auto; }
    `}</style>
  );
}
