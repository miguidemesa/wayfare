// Precomputes the globe's land dots (Natural Earth 110m, via world-atlas) into
// src/data/land-dots.json. Run once: `node scripts/land-dots.mjs`.
import { createRequire } from "node:module";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { geoContains } from "d3-geo";

const require = createRequire(import.meta.url);
const { feature } = require("topojson-client");

const topo = JSON.parse(readFileSync(new URL("../node_modules/world-atlas/land-110m.json", import.meta.url), "utf8"));
const land = feature(topo, topo.objects.land);

// Evenly spread samples over the sphere (Fibonacci lattice); keep the ones on land.
const N = 60000;
const golden = Math.PI * (3 - Math.sqrt(5));
const dots = [];
for (let i = 0; i < N; i++) {
  const lat = (Math.asin(1 - (2 * i + 1) / N) * 180) / Math.PI;
  const lng = ((((i * golden * 180) / Math.PI) % 360) + 360) % 360 - 180;
  if (geoContains(land, [lng, lat])) dots.push([+lat.toFixed(2), +lng.toFixed(2)]);
}

mkdirSync(new URL("../src/data/", import.meta.url), { recursive: true });
writeFileSync(new URL("../src/data/land-dots.json", import.meta.url), JSON.stringify(dots));
console.log(`${dots.length} land dots`);
