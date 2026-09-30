import React, { useEffect, useRef, useState } from "react";
import { useCurrentFrame, useDelayRender } from "remotion";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { C, sans, serif, tween } from "./brand";

export type LngLat = [number, number];
export type XY = { x: number; y: number };

// OpenFreeMap's positron style (OpenStreetMap data, no key) — the basemap the
// app's Map tab uses — quieted into Folio's paper and ink.
const STYLE = "https://tiles.openfreemap.org/styles/positron";
export const MAP_PAPER = "#EEE9DF";
const PAINT: [
  string,
  Parameters<maplibregl.Map["setPaintProperty"]>[1],
  string,
][] = [
  ["background", "background-color", MAP_PAPER],
  ["park", "fill-color", "#E1E1CD"],
  ["landcover_wood", "fill-color", "#DADDC6"],
  ["landuse_residential", "fill-color", "#EBE6DB"],
  ["water", "fill-color", "#C9D2D0"],
  ["waterway", "line-color", "#C9D2D0"],
  ["building", "fill-color", "#E3DCCD"],
  ["highway_minor", "line-color", "#FBFAF6"],
  ["highway_major_casing", "line-color", "#D9D1C1"],
  ["highway_major_inner", "line-color", "#FBFAF6"],
  ["highway_major_subtle", "line-color", "#E2DBCD"],
  ["highway_motorway_casing", "line-color", "#D3CAB8"],
  ["highway_motorway_inner", "line-color", "#F6F1E6"],
  ["highway_motorway_subtle", "line-color", "#DDD5C6"],
  ["railway_transit", "line-color", "#D2CAB9"],
  ["railway_service", "line-color", "#D6CEBE"],
  ["railway", "line-color", "#CDC4B2"],
];
// Street names, shields and the dense neighbourhood (label_other) names would crowd the route.
const HIDDEN =
  /^(highway_path|highway-name|highway-shield|road_shield|boundary|aeroway|airport|label_other)/;

let workerReady = false;

/**
 * A map rendered once, as a still plate. Its camera never moves — per-frame
 * camera moves shimmer in headless renders — so scenes push in with CSS and
 * draw over it in the plate's own pixels, at the projected `points`.
 */
export const MapPlate: React.FC<{
  width: number;
  height: number;
  bounds: [LngLat, LngLat];
  padding: { top: number; bottom: number; left: number; right: number };
  points: LngLat[];
  children: (xy: XY[]) => React.ReactNode;
}> = ({ width, height, bounds, padding, points, children }) => {
  const container = useRef<HTMLDivElement>(null);
  const started = useRef(false);
  const { delayRender, continueRender } = useDelayRender();
  const [handle] = useState(() =>
    delayRender("Loading the map plate", { timeoutInMilliseconds: 120000 }),
  );
  const [xy, setXy] = useState<XY[] | null>(null);

  useEffect(() => {
    if (started.current || !container.current) return;
    started.current = true;
    if (!workerReady) {
      workerReady = true;
      maplibregl.setWorkerUrl(
        URL.createObjectURL(
          new Blob(
            [
              `import "https://unpkg.com/maplibre-gl@${maplibregl.getVersion()}/dist/maplibre-gl-worker.mjs";`,
            ],
            { type: "text/javascript" },
          ),
        ),
      );
    }
    const map = new maplibregl.Map({
      container: container.current,
      style: STYLE,
      bounds,
      fitBoundsOptions: { padding },
      interactive: false,
      attributionControl: false,
      fadeDuration: 0,
      canvasContextAttributes: { preserveDrawingBuffer: true },
    });
    map.once("load", () => {
      for (const [layer, prop, value] of PAINT)
        if (map.getLayer(layer)) map.setPaintProperty(layer, prop, value);
      for (const layer of map.getStyle().layers) {
        if (HIDDEN.test(layer.id))
          map.setLayoutProperty(layer.id, "visibility", "none");
        else if (layer.type === "symbol") {
          // Latin names only: calmer, and no CJK glyph ranges to fetch.
          map.setLayoutProperty(layer.id, "text-field", [
            "coalesce",
            ["get", "name:latin"],
            ["get", "name_en"],
            ["get", "name"],
          ]);
          map.setPaintProperty(layer.id, "text-color", C.ink3);
          map.setPaintProperty(layer.id, "text-halo-color", MAP_PAPER);
        }
      }
      map.once("idle", () =>
        setXy(points.map((p) => map.project(p)).map(({ x, y }) => ({ x, y }))),
      );
    });
    // No map.remove() cleanup: it interferes with Remotion's render lifecycle.
  }, [bounds, padding, points]);

  // Released after commit, once the overlay drawn from `xy` is on the page.
  useEffect(() => {
    if (xy) continueRender(handle);
  }, [xy, continueRender, handle]);

  return (
    <div style={{ position: "absolute", width, height }}>
      <div ref={container} style={{ position: "absolute", inset: 0 }} />
      {xy ? children(xy) : null}
    </div>
  );
};

// ------------------------------------------------ what gets drawn over a plate

/** A numbered stop as the app draws it: an ink disc with a paper rim. Drops in at `at`. */
export const Pin: React.FC<{
  p: XY;
  n: React.ReactNode;
  at: number;
  fill?: string;
  r?: number;
}> = ({ p, n, at, fill = C.ink, r = 20 }) => {
  const frame = useCurrentFrame();
  const d = tween(frame, [at, at + 12], [0, 1]);
  if (d <= 0) return null;
  return (
    <g>
      <ellipse
        cx={p.x + 2}
        cy={p.y + r * 0.95}
        rx={r * 0.85 * d}
        ry={r * 0.24 * d}
        fill="rgba(46,30,14,0.2)"
      />
      <g
        transform={`translate(${p.x} ${p.y - (1 - d) * 34}) scale(${0.6 + 0.4 * d})`}
        opacity={Math.min(1, d * 2.5)}
      >
        <circle r={r} fill={fill} stroke={C.paper} strokeWidth={4} />
        <text
          textAnchor="middle"
          dominantBaseline="central"
          fill={C.paper}
          style={{ fontFamily: sans, fontWeight: 700, fontSize: r * 1.05 }}
        >
          {n}
        </text>
      </g>
    </g>
  );
};

/** A place name beside its pin, haloed in paper like the map's own labels. */
export const Label: React.FC<{
  p: XY;
  text: string;
  side: "l" | "r" | "t" | "b";
  at: number;
  color?: string;
}> = ({ p, text, side, at, color = C.ink }) => {
  const frame = useCurrentFrame();
  const o = tween(frame, [at, at + 14], [0, 1]);
  if (o <= 0) return null;
  return (
    <text
      x={p.x + (side === "r" ? 34 : side === "l" ? -34 : 0)}
      y={p.y + (side === "t" ? -36 : side === "b" ? 54 : 10)}
      opacity={o}
      textAnchor={side === "r" ? "start" : side === "l" ? "end" : "middle"}
      fill={color}
      stroke={MAP_PAPER}
      strokeWidth={9}
      strokeLinejoin="round"
      paintOrder="stroke"
      style={{
        fontFamily: serif,
        fontWeight: 500,
        fontSize: 30,
        letterSpacing: "-0.01em",
      }}
    >
      {text}
    </text>
  );
};

/** The time between two stops, in the app's italic aside. */
export const Leg: React.FC<{ p: XY; text: string; at: number }> = ({
  p,
  text,
  at,
}) => {
  const frame = useCurrentFrame();
  const o = tween(frame, [at, at + 12], [0, 1]);
  if (o <= 0) return null;
  const w = text.length * 10.6 + 30;
  return (
    <g transform={`translate(${p.x} ${p.y + (1 - o) * 8})`} opacity={o}>
      <rect
        x={-w / 2}
        y={-19}
        width={w}
        height={38}
        rx={19}
        fill="rgba(251,250,246,0.95)"
        stroke={C.rule}
        strokeWidth={1.5}
      />
      <text
        textAnchor="middle"
        dominantBaseline="central"
        fill={C.ink2}
        style={{ fontFamily: serif, fontStyle: "italic", fontSize: 23 }}
      >
        {text}
      </text>
    </g>
  );
};

/** A dashed route that draws itself on: a solid stroke in a mask reveals the dashes. */
export const Route: React.FC<{
  id: string;
  points: XY[];
  progress: number;
  color: string;
  width?: number;
  opacity?: number;
}> = ({ id, points, progress, color, width = 4.5, opacity = 0.7 }) => {
  const d = points.map((q, i) => `${i ? "L" : "M"}${q.x} ${q.y}`).join(" ");
  const length = points
    .slice(1)
    .reduce(
      (s, q, i) => s + Math.hypot(q.x - points[i].x, q.y - points[i].y),
      0,
    );
  return (
    <>
      <mask
        id={id}
        maskUnits="userSpaceOnUse"
        x={-4000}
        y={-4000}
        width={12000}
        height={12000}
      >
        {progress > 0 ? (
          <path
            d={d}
            fill="none"
            stroke="#fff"
            strokeWidth={width * 5}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={length}
            strokeDashoffset={length * (1 - progress)}
          />
        ) : null}
      </mask>
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth={width}
        strokeDasharray={`${width * 1.6} ${width * 2.2}`}
        strokeLinejoin="round"
        opacity={opacity}
        mask={`url(#${id})`}
      />
    </>
  );
};

/** OpenStreetMap and OpenFreeMap ask for this on every map shown. */
export const Attribution: React.FC = () => (
  <div
    style={{
      position: "absolute",
      right: 22,
      bottom: 16,
      fontFamily: sans,
      fontSize: 15,
      color: C.ink3,
      opacity: 0.85,
    }}
  >
    © OpenStreetMap contributors · OpenFreeMap
  </div>
);
