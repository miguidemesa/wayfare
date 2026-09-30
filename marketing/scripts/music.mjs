// Synthesizes the ad's music bed into public/music.wav: 30 s, 120 bpm, in D,
// written to the cut — a cascade as the scraps land, the logo hit at 3.2 s,
// the groove from 5 s, a build under the star wipe, the resolve at 25 s.
// Run once: `node scripts/music.mjs`. Everything is generated here, so there
// is nothing to license; swap in a produced track by replacing the file.
import { mkdirSync, writeFileSync } from "node:fs";

const SR = 48000;
const N = SR * 30;
const L = new Float32Array(N);
const R = new Float32Array(N);
const SEND = new Float32Array(N); // mono send into the reverb

const hz = (midi) => 440 * 2 ** ((midi - 69) / 12);
let seed = 7;
const noise = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32) * 2 - 1;

const put = (i, v, pan = 0, send = 0) => {
  if (i < 0 || i >= N) return;
  L[i] += v * (1 - pan);
  R[i] += v * (1 + pan);
  SEND[i] += v * send;
};

// ------------------------------------------------------------- instruments

const DETUNE = [-7, 0, 7]; // cents

/** A soft additive pad: three detuned voices, brightening as it opens. */
const pad = (t0, t1, midi, gain, pan) => {
  const f = hz(midi);
  const attack = 0.45;
  const release = 0.9;
  for (let i = Math.max(0, Math.floor(t0 * SR)); i < Math.min(N, Math.floor((t1 + release) * SR)); i++) {
    const t = i / SR;
    const env = Math.min(1, (t - t0) / attack) * (t > t1 ? Math.max(0, 1 - (t - t1) / release) : 1);
    let v = 0;
    for (const cents of DETUNE) {
      const fk = f * 2 ** (cents / 1200) * (1 + 0.0015 * Math.sin(2 * Math.PI * 4.6 * t));
      for (let h = 1; h <= 6; h++) v += (Math.sin(2 * Math.PI * fk * h * t + h * cents) / h ** 1.7) * (h === 1 ? 1 : 0.45 + 0.55 * env);
    }
    put(i, (v / 3) * env * gain, pan, 0.6);
  }
};

/** A mallet: in tune, warm, quick to fade — kalimba more than piano. */
const mallet = (t0, midi, gain, pan = 0) => {
  const f = hz(midi);
  const s0 = Math.floor(t0 * SR);
  for (let i = 0; i < SR * 2.2; i++) {
    const t = i / SR;
    const v =
      Math.min(1, t / 0.003) *
      Math.exp(-t * 3.2) *
      (Math.sin(2 * Math.PI * f * t) + 0.28 * Math.exp(-t * 7) * Math.sin(2 * Math.PI * 3.01 * f * t) + 0.08 * Math.exp(-t * 14) * Math.sin(2 * Math.PI * 6.2 * f * t));
    put(s0 + i, v * gain, pan, 0.35);
  }
};

/** An FM bell for the hits. */
const bell = (t0, midi, gain, pan = 0) => {
  const f = hz(midi);
  const s0 = Math.floor(t0 * SR);
  for (let i = 0; i < SR * 4; i++) {
    const t = i / SR;
    const v = Math.min(1, t / 0.002) * Math.exp(-t * 1.1) * Math.sin(2 * Math.PI * f * t + 2.4 * Math.exp(-t * 2.2) * Math.sin(2 * Math.PI * 3.5 * f * t));
    put(s0 + i, v * gain, pan, 0.5);
  }
};

const bass = (t0, dur, midi, gain) => {
  const f = hz(midi);
  const s0 = Math.floor(t0 * SR);
  for (let i = 0; i < SR * (dur + 0.12); i++) {
    const t = i / SR;
    const env = Math.min(1, t / 0.006) * (0.75 + 0.25 * Math.exp(-t * 6)) * (t > dur ? Math.max(0, 1 - (t - dur) / 0.12) : 1);
    const v = Math.sin(2 * Math.PI * f * t) + 0.35 * Math.sin(4 * Math.PI * f * t) + 0.5 * Math.sin(Math.PI * f * t);
    put(s0 + i, Math.tanh(v * 1.3) * env * gain);
  }
};

const kick = (t0, gain) => {
  const s0 = Math.floor(t0 * SR);
  let ph = 0;
  for (let i = 0; i < SR * 0.45; i++) {
    const t = i / SR;
    ph += (2 * Math.PI * (46 + 95 * Math.exp(-t * 30))) / SR;
    put(s0 + i, (Math.sin(ph) * Math.exp(-t * 7.5) + (i < 60 ? noise() * 0.12 * (1 - i / 60) : 0)) * gain);
  }
};

/** A soft clap: three quick bursts of band-limited noise over a little body. */
const clap = (t0, gain) => {
  const s0 = Math.floor(t0 * SR);
  let lp = 0;
  let hpIn = 0;
  let hp = 0;
  for (let i = 0; i < SR * 0.4; i++) {
    const t = i / SR;
    lp += 0.45 * (noise() - lp);
    hp = 0.88 * (hp + lp - hpIn);
    hpIn = lp;
    const bursts = (t >= 0 ? Math.exp(-t * 90) : 0) + (t >= 0.011 ? Math.exp(-(t - 0.011) * 90) : 0) + (t >= 0.023 ? Math.exp(-(t - 0.023) * 16) : 0);
    put(s0 + i, (hp * bursts * 0.9 + 0.25 * Math.sin(2 * Math.PI * 190 * t) * Math.exp(-t * 30)) * gain, 0, 0.45);
  }
};

const hat = (t0, gain, pan) => {
  const s0 = Math.floor(t0 * SR);
  let prev = 0;
  let hp = 0;
  for (let i = 0; i < SR * 0.08; i++) {
    const n = noise();
    hp = 0.3 * (hp + n - prev);
    prev = n;
    put(s0 + i, hp * Math.exp(-(i / SR) * 55) * gain, pan, 0.1);
  }
};

/** Filtered noise opening up into a hit. */
const riser = (t0, t1, gain) => {
  let lp = 0;
  for (let i = Math.floor(t0 * SR); i < Math.floor(t1 * SR); i++) {
    const p = (i / SR - t0) / (t1 - t0);
    lp += (0.02 + 0.5 * p * p) * (noise() - lp);
    put(i, lp * p * p * gain, 0, 0.5);
  }
};

const boom = (t0, gain) => {
  const s0 = Math.floor(t0 * SR);
  let ph = 0;
  for (let i = 0; i < SR * 2; i++) {
    const t = i / SR;
    ph += (2 * Math.PI * (38 + 40 * Math.exp(-t * 9))) / SR;
    put(s0 + i, Math.sin(ph) * Math.exp(-t * 2.4) * gain);
  }
};

// ------------------------------------------------------------------ the score

// Bars start on odd seconds so the resolve at 25 s lands on a downbeat.
const BAR = 2;
const CHORDS = [
  // [start s, pad voicing, bass root]
  [5, [50, 54, 57, 61], 38], // Dmaj7
  [7, [50, 54, 57, 59], 35], // Bm7
  [9, [50, 54, 55, 59], 43], // Gmaj7
  [11, [52, 54, 57, 61], 45], // A6
  [13, [50, 54, 57, 61], 38], // Dmaj7
  [15, [49, 52, 54, 57], 42], // F#m7
  [17, [50, 54, 55, 59], 43], // Gmaj7
  [19, [50, 52, 55, 59], 40], // Em7
  [21, [50, 54, 57, 59], 35], // Bm7
  [23, [50, 54, 55, 59], 43], // Gmaj7, turning to A under the build
];

// Intro: Dmaj9 held while the scraps land, one mallet note per scrap.
for (const [k, m] of [50, 57, 61, 64, 66].entries()) pad(0, 5.2, m, 0.05, (k - 2) * 0.15);
[74, 69, 78, 76, 71, 81, 78, 73, 76, 85].forEach((m, i) => mallet((i * 3 + 13) / 30, m, 0.07, i % 2 ? 0.3 : -0.3));

// The logo: a riser as the scraps pull in, then the hit as the star appears (frame 96).
riser(2.1, 3.2, 0.5);
boom(3.2, 0.45);
[62, 69, 74, 76, 78].forEach((m, i) => bell(3.2 + i * 0.012, m, 0.06, (i - 2) * 0.2));

// The groove, 5 s to 24 s.
CHORDS.forEach(([start, voicing, root], ci) => {
  const last = ci === CHORDS.length - 1;
  const end = last ? 24 : start + BAR;
  voicing.forEach((m, k) => pad(start, end, m, 0.05, (k - 1.5) * 0.2));
  if (last) [52, 57, 61, 64].forEach((m, k) => pad(24, 24.95, m, 0.05, (k - 1.5) * 0.2));
  for (let b = 0; b < (last ? 2 : 4); b++) {
    const t = start + b * 0.5;
    if (b === 0 || b === 2) bass(t, b === 0 ? 0.7 : 0.45, root, 0.18);
    if (b === 1) bass(t + 0.25, 0.2, root + 12, 0.08);
    if (b === 0) kick(t, 0.55);
    if (b === 1) kick(t + 0.25, 0.3);
    if (b === 2) clap(t, 0.24);
  }
  // Eighth-note mallets through the chord, an octave up.
  const tones = voicing.map((m) => m + 12);
  const pattern = [0, 2, 1, 3, 2, 0, 3, 1];
  const vel = [1, 0.55, 0.8, 0.55, 0.9, 0.5, 0.75, 0.5];
  for (let e = 0; e < (last ? 4 : 8); e++) {
    if (ci % 2 === 1 && e === 5) continue; // a breath every other bar
    mallet(start + e * 0.25, tones[pattern[e]] + (e === 5 ? 12 : 0), 0.06 * vel[e], e % 2 ? 0.25 : -0.25);
    hat(start + e * 0.25 + (e % 2 ? 0.01 : 0), e % 2 ? 0.1 : 0.06, e % 2 ? 0.2 : -0.2);
  }
});

// The build under the star wipe: a clap roll and a riser into the end card.
for (let k = 0; k < 8; k++) clap(24 + k * 0.125, 0.06 + k * 0.025);
riser(23.9, 25, 0.6);

// The resolve at 25 s (frame 750): Dmaj9, a boom, bells; then a motif under the name, the line, the button.
boom(25, 0.55);
bass(25, 2.5, 38, 0.18);
for (const [k, m] of [50, 54, 57, 61, 64].entries()) pad(25, 28.6, m, 0.055, (k - 2) * 0.15);
[62, 66, 69, 73, 76].forEach((m, i) => bell(25 + i * 0.015, m, 0.055, (i - 2) * 0.2));
[
  [25.6, 78],
  [26.33, 81],
  [27.0, 86],
].forEach(([t, m]) => bell(t, m, 0.045));

// -------------------------------------------------------------- reverb, master

/** A small Freeverb: eight damped combs into two allpasses, per channel. */
const reverb = (input, spread) => {
  const out = new Float32Array(N);
  for (const d of [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617]) {
    const len = Math.round(((d + spread) * SR * 1.35) / 44100);
    const buf = new Float32Array(len);
    let idx = 0;
    let damp = 0;
    for (let i = 0; i < N; i++) {
      const y = buf[idx];
      damp = y * 0.72 + damp * 0.28;
      buf[idx] = input[i] + damp * 0.85;
      idx = (idx + 1) % len;
      out[i] += y / 8;
    }
  }
  for (const d of [556, 441]) {
    const len = Math.round(((d + spread) * SR) / 44100);
    const buf = new Float32Array(len);
    let idx = 0;
    for (let i = 0; i < N; i++) {
      const b = buf[idx];
      buf[idx] = out[i] + b * 0.5;
      out[i] = b - out[i];
      idx = (idx + 1) % len;
    }
  }
  return out;
};

const wetL = reverb(SEND, 0);
const wetR = reverb(SEND, 23);
let peak = 0;
for (let i = 0; i < N; i++) {
  L[i] += wetL[i] * 0.3;
  R[i] += wetR[i] * 0.3;
  peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
}

// Peak-normalise, round off the peaks, fade the tail, and write 16-bit PCM.
const pcm = Buffer.alloc(N * 4);
const drive = Math.tanh(1.15);
for (let i = 0; i < N; i++) {
  const t = i / SR;
  const fade = Math.min(1, t / 0.08) * Math.min(1, Math.max(0, (30 - t) / 1.6));
  const l = (Math.tanh((L[i] / peak) * 1.15) / drive) * fade * 0.89;
  const r = (Math.tanh((R[i] / peak) * 1.15) / drive) * fade * 0.89;
  pcm.writeInt16LE(Math.round(l * 32767), i * 4);
  pcm.writeInt16LE(Math.round(r * 32767), i * 4 + 2);
}

const header = Buffer.alloc(44);
header.write("RIFF", 0);
header.writeUInt32LE(36 + pcm.length, 4);
header.write("WAVEfmt ", 8);
header.writeUInt32LE(16, 16);
header.writeUInt16LE(1, 20);
header.writeUInt16LE(2, 22);
header.writeUInt32LE(SR, 24);
header.writeUInt32LE(SR * 4, 28);
header.writeUInt16LE(4, 32);
header.writeUInt16LE(16, 34);
header.write("data", 36);
header.writeUInt32LE(pcm.length, 40);

mkdirSync(new URL("../public/", import.meta.url), { recursive: true });
writeFileSync(new URL("../public/music.wav", import.meta.url), Buffer.concat([header, pcm]));
console.log(`music.wav written (mix peak before normalising: ${peak.toFixed(2)})`);
