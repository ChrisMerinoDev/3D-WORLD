"use client";

import dynamic from "next/dynamic";
import { Hud } from "@/components/hud/Hud";

/**
 * The 3D globe is a heavy, browser-only (WebGL) island. It is code-split and
 * rendered client-side only (`ssr: false`) — allowed here because this page is
 * a Client Component. A cinematic fallback holds the layout while its chunk
 * and the WebGL context initialize (no layout shift).
 */
const Globe = dynamic(() => import("@/components/globe/Globe"), {
  ssr: false,
  loading: () => <GlobeFallback />,
});

export default function Home() {
  return (
    <main className="relative h-dvh w-screen overflow-hidden bg-space text-ink">
      {/* Globe fills the viewport behind the HUD. */}
      <div className="absolute inset-0">
        <Globe />
      </div>
      <Hud />
    </main>
  );
}

function GlobeFallback() {
  return (
    <div
      className="absolute inset-0 flex flex-col items-center justify-center gap-5"
      style={{
        background:
          "radial-gradient(circle at 50% 40%, #0a1226 0%, var(--color-space) 70%)",
      }}
      role="status"
      aria-label="Loading the interactive globe"
    >
      <span className="aurora-boot h-12 w-12 rounded-full border-2 border-aurora/15 border-t-aurora" />
      <span className="font-display text-[0.7rem] uppercase tracking-[0.32em] text-ink/70">
        Charting the Earth
      </span>
      <style>{`
        @keyframes aurora-boot-spin { to { transform: rotate(360deg); } }
        .aurora-boot { animation: aurora-boot-spin 0.9s linear infinite; }
      `}</style>
    </div>
  );
}
