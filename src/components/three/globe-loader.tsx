"use client";

// Capability-gated loader for the dashboard globe. On reduced-motion or
// low-power devices it renders a calm static compass mark instead — same
// footprint, zero WebGL cost.

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { Compass } from "lucide-react";
import type { GlobeMarker } from "./trip-globe";

const TripGlobe = dynamic(() => import("./trip-globe"), { ssr: false, loading: () => null });

function capable(): boolean {
  if (typeof window === "undefined") return false;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
  if (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 2) return false;
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") ?? c.getContext("webgl"));
  } catch {
    return false;
  }
}

export function GlobeOrb({
  markers,
  accent,
  className,
}: {
  markers: GlobeMarker[];
  accent?: string;
  className?: string;
}) {
  const [ok, setOk] = useState(false);

  useEffect(() => {
    setOk(capable());
  }, []);

  return (
    <div
      className={className}
      role="img"
      aria-label={markers.length ? `Globe showing ${markers.length} destinations` : "Globe"}
    >
      {ok ? (
        <div className="relative h-full w-full">
          <TripGlobe markers={markers} accent={accent} />
        </div>
      ) : (
        // Static fallback: soft halo + compass mark
        <div className="relative grid h-full w-full place-items-center">
          <div
            className="absolute inset-4 rounded-full opacity-25 blur-2xl"
            style={{ background: accent ?? "#2dd4bf" }}
          />
          <div className="absolute inset-6 rounded-full border border-line/70" />
          <Compass size={44} strokeWidth={1.2} className="relative text-ink-3" />
        </div>
      )}
    </div>
  );
}