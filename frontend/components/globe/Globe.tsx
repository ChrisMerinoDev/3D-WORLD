"use client";

/**
 * PLACEHOLDER Globe — replaced entirely by the 3D/design engineer.
 * Exists so the app shell can import "@/components/globe/Globe" and typecheck
 * while the real cinematic R3F globe is built in parallel.
 */
import { useEffect } from "react";
import { useWorldStore } from "@/store/worldStore";

export default function Globe() {
  const loadCountries = useWorldStore((s) => s.loadCountries);
  useEffect(() => {
    void loadCountries();
  }, [loadCountries]);

  return (
    <div
      data-testid="globe-canvas"
      className="flex h-full w-full items-center justify-center bg-black text-white/40"
    >
      <span>Loading globe…</span>
    </div>
  );
}
