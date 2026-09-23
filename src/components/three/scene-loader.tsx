"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { destinationGradient, type DestinationTheme } from "@/lib/destination-themes";

// Code-split: the entire Three.js runtime is only fetched when the device
// qualifies AND the hero is actually mounted.
const DestinationScene = dynamic(() => import("./destination-scene"), {
  ssr: false,
  loading: () => null,
});

type Capability = "checking" | "full" | "fallback";

function detectCapability(): Capability {
  if (typeof window === "undefined") return "checking";
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return "fallback";
  // Old / constraint devices: skip WebGL entirely.
  if (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 2) return "fallback";
  try {
    const c = document.createElement("canvas");
    const gl = c.getContext("webgl2") ?? c.getContext("webgl");
    if (!gl) return "fallback";
    // Debug renderer info: allow explicit blocklist for software renderers.
    const ext = gl.getExtension("WEBGL_debug_renderer_info");
    if (ext) {
      const renderer = String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) ?? "");
      if (/swiftshader|llvmpipe|software/i.test(renderer)) return "fallback";
    }
    return "full";
  } catch {
    return "fallback";
  }
}

/**
 * Renders the destination 3D environment when the device can handle it,
 * and a high-quality themed gradient otherwise. Either way the hero looks
 * intentional — the fallback IS the design, not an error state.
 */
export function SceneBackdrop({ theme, className }: { theme: DestinationTheme; className?: string }) {
  const [capability, setCapability] = useState<Capability>("checking");

  useEffect(() => {
    setCapability(detectCapability());
  }, []);

  const gradient = destinationGradient(theme);

  return (
    <div
      className={`absolute inset-0 overflow-hidden ${className ?? ""}`}
      style={{ background: gradient }}
      aria-hidden
    >
      {/* film grain — keeps both paths feeling like one design language */}
      <svg className="absolute inset-0 h-full w-full opacity-[0.12] mix-blend-overlay pointer-events-none">
        <filter id="dst-grain">
          <feTurbulence type="fractalNoise" baseFrequency="0.72" numOctaves="2" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#dst-grain)" />
      </svg>

      {capability === "full" && (
        <DestinationScene
          env={theme.env}
          accent={theme.accent}
          accent2={theme.accent2}
          glowA={theme.glowA}
          deep={theme.deep}
          animation={theme.animationStyle}
        />
      )}

      {capability === "fallback" && (
        // Calm CSS-only atmosphere for reduced-motion / low-power devices.
        <div className="absolute inset-0 dst-fallback-drift" />
      )}
    </div>
  );
}