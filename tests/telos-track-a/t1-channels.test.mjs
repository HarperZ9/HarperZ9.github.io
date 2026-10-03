// t1-channels.test.mjs: Telos Track A step T1, the false and mislabelled perception channels.
// Every fixture and threshold here is fixed in tests/telos-track-a/PREREGISTRATION.md (block hash in
// results/t1-channels.json). Each equality test is paired with a mutation in mutation/registry.json.
// Run: node --test tests/telos-track-a/t1-channels.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  assembleFullPerception, edgeOrientations, symmetryScores, shapeInventory, colourWord,
  pitchFromTimeBytes, linearRgbToOklab, describeFrameLong, perceptionDetail,
  richFeatures,
} from "../../system/sense.js";
import { srgbToLinear } from "../../system/lib/sense-core/colour-perceptual.mjs";
import * as audioLib from "../../system/lib/sense-core/audio-perceptual.mjs";
import * as visionLib from "../../system/lib/sense-core/vision-biomimetic.mjs";
import { normaliseFidelityEntry } from "../../shared-frame/fidelity-log.js";
import { xorshift32 } from "./lib/rng.mjs";
import { writeResult } from "./lib/results.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const results = {};

function mk(w, h, fn) {
  const px = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const c = fn(x, y), i = (y * w + x) * 4;
    px[i] = c[0]; px[i + 1] = c[1]; px[i + 2] = c[2]; px[i + 3] = 255;
  }
  return px;
}
const grey = (v) => [v, v, v];

// ---------------------------------------------------------------- R1, R2: WPIR and PBE are gone
function audioFixture() {
  const sampleRate = 48000, fftSize = 4096;
  const freqBytes = new Uint8Array(fftSize / 2);
  freqBytes[85] = 146; freqBytes[86] = 120;
  const timeBytes = new Uint8Array(fftSize);
  for (let i = 0; i < fftSize; i++) timeBytes[i] = Math.round(128 + 90 * Math.sin(2 * Math.PI * 1000 * i / sampleRate));
  return { level: 0.4, pitch: 1000, freqBytes, timeBytes, sampleRate, fftSize, minDb: -100, maxDb: -30 };
}
function keysDeep(v, out = new Set()) {
  if (v && typeof v === "object" && !ArrayBuffer.isView(v)) {
    for (const [k, x] of Object.entries(v)) { out.add(k); keysDeep(x, out); }
  }
  return out;
}

test("T1.R1/R2 eq: a packet with audio carries no wpir and no pbe key anywhere", () => {
  const px = mk(32, 24, (x, y) => [x * 7, y * 9, (x ^ y) * 5]);
  const fp = assembleFullPerception(px, 32, 24, 4, { source: "t1", audio: audioFixture() });
  const keys = keysDeep(fp);
  const hits = ["wpir", "pbe"].filter((k) => keys.has(k));
  results.removed = { packetKeysChecked: keys.size, hits };
  assert.deepEqual(hits, []);
  assert.equal(typeof visionLib.wpir, "undefined", "wpir library function deleted");
  assert.equal(typeof audioLib.pbe, "undefined", "pbe library function deleted");
});

test("T1.R1/R2 eq: the fidelity ledger drops pbe and wpir from legacy input", () => {
  const e = normaliseFidelityEntry({ wpre: 2, pbe: 1, wpir: 1, source: "s", timestamp: 5 });
  assert.deepEqual(Object.keys(e).sort(), ["source", "timestamp", "wpre"]);
});

// ---------------------------------------------------------------- T1.O orientation, both directions
const GRATINGS = {
  horizontal: (x, y) => y,
  "vertical": (x, y) => x,
  "rising diagonal": (x, y) => (x + y) / Math.SQRT2,
  "falling diagonal": (x, y) => (x - y) / Math.SQRT2,
};
const BIN_KEY = { horizontal: "horizontal", vertical: "vertical", "rising diagonal": "risingDiagonal", "falling diagonal": "fallingDiagonal" };

test("T1.O eq: each grating reads its own bin at share >= 0.8 and names it dominant", () => {
  results.orientation = {};
  for (const [name, d] of Object.entries(GRATINGS)) {
    const px = mk(96, 96, (x, y) => grey(Math.round(128 + 100 * Math.sin(2 * Math.PI * d(x, y) / 8))));
    const e = edgeOrientations(px, 96, 96, 4);
    results.orientation[name] = { share: e[BIN_KEY[name]], dominant: e.dominant, coherence: e.coherence };
    assert.ok(e[BIN_KEY[name]] >= 0.8, `${name} share ${e[BIN_KEY[name]]}`);
    assert.equal(e.dominant, name);
  }
});

test("T1.O eq: half-plane diagonal edges name their own diagonal (rising and falling)", () => {
  const W = 192, H = 128;
  const rising = mk(W, H, (x, y) => grey(y > H - x * H / W ? 220 : 0));
  const falling = mk(W, H, (x, y) => grey(y > x * H / W ? 220 : 0));
  const er = edgeOrientations(rising, W, H, 4), ef = edgeOrientations(falling, W, H, 4);
  results.orientation.halfPlaneRising = { dominant: er.dominant, rising: er.risingDiagonal, falling: er.fallingDiagonal };
  results.orientation.halfPlaneFalling = { dominant: ef.dominant, rising: ef.risingDiagonal, falling: ef.fallingDiagonal };
  assert.equal(er.dominant, "rising diagonal");
  assert.equal(ef.dominant, "falling diagonal");
});

test("T1.O eq: an isotropic disk has coherence below 0.2 and no dominant orientation", () => {
  const px = mk(96, 96, (x, y) => grey(Math.hypot(x - 48, y - 48) < 30 ? 220 : 30));
  const e = edgeOrientations(px, 96, 96, 4);
  results.orientation.disk = { coherence: e.coherence, dominant: e.dominant, strong: e.strongEdgeCount };
  assert.ok(e.strongEdgeCount > 0);
  assert.ok(e.coherence < 0.2, `coherence ${e.coherence}`);
  assert.equal(e.dominant, "none");
});

// ---------------------------------------------------------------- T1.P pitch
const SR = 48000, N = 4096;
function toneBytes(f0, partials) {
  const x = new Float64Array(N);
  for (let i = 0; i < N; i++) for (const k of partials) x[i] += Math.sin(2 * Math.PI * k * f0 * i / SR) / k;
  let peak = 0; for (const v of x) peak = Math.max(peak, Math.abs(v));
  const b = new Uint8Array(N);
  for (let i = 0; i < N; i++) b[i] = Math.max(0, Math.min(255, Math.round(128 + 128 * (x[i] * 0.8 / peak))));
  return b;
}

test("T1.P eq: scalar pitch is YIN, within 1 semitone on C2..C7 with and without the fundamental", () => {
  results.pitch = [];
  for (const midi of [36, 48, 60, 72, 84, 96]) {
    const f = 440 * Math.pow(2, (midi - 69) / 12);
    for (const [form, partials] of [["full", [1, 2, 3, 4, 5]], ["missing-fundamental", [2, 3, 4, 5, 6]]]) {
      const p = pitchFromTimeBytes(toneBytes(f, partials), SR);
      const semis = 12 * Math.log2(p.f0 / f);
      results.pitch.push({ midi, form, trueHz: +f.toFixed(3), pitch: p.f0, semitones: +semis.toFixed(4), probability: +p.probability.toFixed(4) });
      assert.equal(p.method, "yin");
      assert.ok(Math.abs(semis) <= 1, `MIDI ${midi} ${form}: ${p.f0} Hz vs ${f.toFixed(2)} (${semis.toFixed(2)} st)`);
    }
  }
});

test("T1.P eq: silence reads pitch 0", () => {
  assert.equal(pitchFromTimeBytes(new Uint8Array(N).fill(128), SR).f0, 0);
});

test("T1.P eq: the assembled packet's scalar pitch is the YIN value the caller passes through", () => {
  const tb = toneBytes(220, [2, 3, 4, 5, 6]);
  const p = pitchFromTimeBytes(tb, SR);
  const fp = assembleFullPerception(mk(8, 8, () => grey(90)), 8, 8, 4,
    { audio: { level: 0.3, pitch: p.f0, pitchMethod: p.method, pitchProbability: p.probability } });
  assert.equal(fp.audio.pitch, p.f0);
  assert.equal(fp.audio.pitchMethod, "yin");
  assert.ok(Math.abs(12 * Math.log2(fp.audio.pitch / 220)) <= 1);
});

// ---------------------------------------------------------------- T1.L loudness
function loudnessAudio(offset) {
  const fftSize = 4096, sampleRate = 48000;
  const freqBytes = new Uint8Array(fftSize / 2);
  freqBytes[Math.round(1000 / (sampleRate / fftSize))] = 146;
  const a = { freqBytes, timeBytes: new Uint8Array(fftSize).fill(128), sampleRate, fftSize, minDb: -100, maxDb: -30 };
  if (offset !== undefined) a.splOffsetDb = offset;
  return a;
}
const PEAK_DB = -100 + (146 / 255) * 70;

test("T1.L eq: with an SPL offset, a 1 kHz tone reads within 1 phon of its SPL at 40, 60 and 80 dB", () => {
  results.loudness = [];
  for (const spl of [40, 60, 80]) {
    const fp = assembleFullPerception(mk(4, 4, () => grey(50)), 4, 4, 4, { audio: loudnessAudio(spl - PEAK_DB) });
    const L = fp.audioPerceptual.iso226;
    results.loudness.push({ spl, phon: L.phon, sone: L.sone, atHz: L.atHz });
    assert.ok(Math.abs(L.phon - spl) <= 1, `${spl} dB SPL read ${L.phon} phon`);
  }
});

test("T1.L eq: without an offset the iso226 key is absent", () => {
  const fp = assembleFullPerception(mk(4, 4, () => grey(50)), 4, 4, 4, { audio: loudnessAudio(undefined) });
  assert.equal("iso226" in fp.audioPerceptual, false);
  assert.equal(JSON.stringify(fp).includes("phon"), false);
});

// ---------------------------------------------------------------- R-hue-v1 colour words
const REF19 = [
  ["ff0000", "red"], ["ffa500", "orange"], ["ffff00", "yellow"], ["008000", "green"], ["0000ff", "blue"],
  ["800080", "purple"], ["ffc0cb", "pink"], ["8b4513", "brown"], ["ffffff", "white"], ["808080", "grey"],
  ["000000", "black"], ["e8aac8", "pink"], ["5f328c", "purple"],
  ["c4631a", "brown"], ["d0b0c6", "purple"], ["eadafb", "purple"], ["d26837", "red"], ["a54764", "pink"], ["44272a", "red"],
];
const PROBE46 = {
  red: ["ff0000", "dc143c", "b22222", "8b0000"], orange: ["ffa500", "ff8c00"], yellow: ["ffff00", "ffd700"],
  green: ["00ff00", "008000", "228b22", "32cd32", "006400", "2e8b57", "90ee90"],
  blue: ["0000ff", "000080", "4169e1", "1e90ff", "87ceeb", "00bfff", "4682b4", "191970"],
  purple: ["800080", "4b0082", "8a2be2", "9932cc", "663399", "9370db"], pink: ["ffc0cb", "ff69b4", "ff1493", "ffb6c1"],
  brown: ["8b4513", "a0522d", "d2691e"], white: ["ffffff", "fffafa", "f5f5f5"],
  grey: ["808080", "a9a9a9", "d3d3d3", "696969", "708090"], black: ["000000", "1e2228"],
};
const rgbOf = (hex) => [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));

// Comparator only (not gated): build-color's nearest_basic_name, nearest of 11 prototypes in OKLab.
const PROTO = { red: "ff0000", orange: "ffa500", yellow: "ffff00", green: "008000", blue: "0000ff", purple: "800080",
  pink: "ffc0cb", brown: "8b4513", white: "ffffff", grey: "808080", black: "000000" };
const oklabOf = (hex) => { const [r, g, b] = rgbOf(hex); return linearRgbToOklab(srgbToLinear(r / 255), srgbToLinear(g / 255), srgbToLinear(b / 255)); };
function nearestPrototype(hex) {
  const p = oklabOf(hex);
  let best = null, bd = Infinity;
  for (const [n, h] of Object.entries(PROTO)) {
    const q = oklabOf(h), d = Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
    if (d < bd) { bd = d; best = n; }
  }
  return best;
}

test("T1.hue eq: the colour word equals the reference on all 19 pre-registered colours", () => {
  results.hue19 = REF19.map(([hex, want]) => {
    const w = colourWord(...rgbOf(hex));
    return { hex, want, got: w.name, margin: +w.margin.toFixed(5) };
  });
  const wrong = results.hue19.filter((r) => r.got !== r.want);
  assert.deepEqual(wrong, []);
});

test("T1.hue eq: JavaScript and the Python twin agree on the 19, the probe and 2,000 seeded colours", () => {
  const next = xorshift32(20261002);
  const hexes = [...REF19.map((r) => r[0]), ...Object.values(PROBE46).flat()];
  for (let i = 0; i < 2000; i++) hexes.push((next() & 0xffffff).toString(16).padStart(6, "0"));
  const out = execFileSync("python", [join(HERE, "py", "hue_words.py"), ...hexes], { encoding: "utf8", maxBuffer: 1 << 24 });
  const py = new Map(out.trim().split(/\r?\n/).map((l) => { const [h, n, m] = l.split(" "); return [h, { n, m: +m }]; }));
  const disagree = [];
  for (const hex of hexes) {
    const js = colourWord(...rgbOf(hex)), p = py.get(hex);
    if (!p) { disagree.push({ hex, reason: "missing" }); continue; }
    if (js.name !== p.n && Math.min(js.margin, p.m) > 1e-9) disagree.push({ hex, js: js.name, py: p.n, margin: js.margin });
  }
  results.hueTwin = { colours: hexes.length, disagreements: disagree.length, examples: disagree.slice(0, 5) };
  assert.deepEqual(disagree, []);
});

test("T1.hue probe: at least 44 of the 46 author-labelled probe colours match (comparator reported)", () => {
  const rows = [];
  for (const [want, list] of Object.entries(PROBE46)) for (const hex of list) {
    const w = colourWord(...rgbOf(hex));
    rows.push({ hex, want, got: w.name, margin: +w.margin.toFixed(5), nearestPrototype: nearestPrototype(hex) });
  }
  const hits = rows.filter((r) => r.got === r.want).length;
  const cmp = rows.filter((r) => r.nearestPrototype === r.want).length;
  results.hueProbe = { n: rows.length, ruleHits: hits, nearestPrototypeHits: cmp,
    ruleMisses: rows.filter((r) => r.got !== r.want), nearestPrototypeMisses: rows.filter((r) => r.nearestPrototype !== r.want).map((r) => [r.hex, r.want, r.nearestPrototype]) };
  assert.equal(rows.length, 46);
  assert.ok(hits >= 44, `R-hue-v1 matched ${hits} of 46: ${JSON.stringify(results.hueProbe.ruleMisses)}`);
});

// ---------------------------------------------------------------- T1.S symmetry
function exactMirror(px, w, h, axis) {
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4;
    const j = axis === "h" ? (y * w + (w - 1 - x)) * 4 : ((h - 1 - y) * w + x) * 4;
    if (px[i] !== px[j] || px[i + 1] !== px[j + 1] || px[i + 2] !== px[j + 2]) return false;
  }
  return true;
}
function symFixtures() {
  const tri = (v, n) => 1 - Math.abs(2 * v - (n - 1)) / (n - 1);
  const noise = xorshift32(20261002);
  return {
    mirrorLeftRight: [96, 64, mk(96, 64, (x, y) => grey(Math.round(40 + 120 * tri(x, 96) + 80 * y / 63)))],
    mirrorTopBottom: [96, 64, mk(96, 64, (x, y) => grey(Math.round(40 + 120 * tri(y, 64) + 80 * x / 95)))],
    lowContrastHalfRamp: [192, 128, mk(192, 128, (x) => grey(x < 96 ? Math.round(120 + 20 * x / 96) : 120))],
    offCentreDisk: [192, 128, mk(192, 128, (x, y) => (Math.hypot(x - 130, y - 50) < 28 ? [230, 190, 40] : [30, 34, 40]))],
    whiteNoise: [192, 128, mk(192, 128, () => [noise() & 255, noise() & 255, noise() & 255])],
  };
}

test("T1.S eq: an axis reads mirrored if and only if the frame is exactly mirror-symmetric on it", () => {
  results.symmetry = {};
  for (const [name, [w, h, px]] of Object.entries(symFixtures())) {
    const s = symmetryScores(px, w, h, 4);
    const truth = { h: exactMirror(px, w, h, "h"), v: exactMirror(px, w, h, "v") };
    const read = { h: s.horizontal != null && s.horizontal >= 0.9, v: s.vertical != null && s.vertical >= 0.9 };
    results.symmetry[name] = { horizontal: s.horizontal, vertical: s.vertical, truth, read };
    assert.deepEqual(read, truth, `${name}: read ${JSON.stringify(read)} truth ${JSON.stringify(truth)}`);
  }
  assert.ok(results.symmetry.mirrorLeftRight.truth.h && !results.symmetry.mirrorLeftRight.truth.v, "fixture sanity");
  assert.ok(results.symmetry.mirrorTopBottom.truth.v && !results.symmetry.mirrorTopBottom.truth.h, "fixture sanity");
});

test("T1.S: the long description says mirrored only for a true mirror", () => {
  const f = symFixtures();
  const say = ([w, h, px]) => describeFrameLong(richFeatures(px, w, h, 4), perceptionDetail(px, w, h, 4));
  assert.match(say(f.mirrorLeftRight), /mirrored left-right/);
  assert.doesNotMatch(say(f.offCentreDisk), /mirrored/);
  assert.doesNotMatch(say(f.whiteNoise), /mirrored/);
});

// ---------------------------------------------------------------- T1.H shapes across 0 degrees of hue
function hsvBytes(h, s, v) {
  const hh = (((h % 360) + 360) % 360) / 60, i = Math.floor(hh), f = hh - i;
  const p = v * (1 - s), q = v * (1 - s * f), t = v * (1 - s * (1 - f));
  return [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][i % 6].map((c) => Math.round(c * 255));
}
function shapeCheck(name, w, h, px, box) {
  const shapes = shapeInventory(px, w, h, 4, 12);
  const scale = Math.min(1, 96 / Math.max(w, h));
  const gw = Math.max(1, Math.round(w * scale)), gh = Math.max(1, Math.round(h * scale));
  const bx = [box[0] / w, box[1] / h, box[2] / w, box[3] / h];
  const overlaps = shapes.filter((s) => s.bbox[0] < bx[2] && s.bbox[2] > bx[0] && s.bbox[1] < bx[3] && s.bbox[3] > bx[1]
    && !(s.bbox[0] === 0 && s.bbox[1] === 0 && s.bbox[2] === 1 && s.bbox[3] === 1));
  const iou = (a, b) => {
    const ix = Math.max(0, Math.min(a[2], b[2]) - Math.max(a[0], b[0])), iy = Math.max(0, Math.min(a[3], b[3]) - Math.max(a[1], b[1]));
    const inter = ix * iy, uni = (a[2] - a[0]) * (a[3] - a[1]) + (b[2] - b[0]) * (b[3] - b[1]) - inter;
    return inter / uni;
  };
  const share = ((box[2] - box[0]) * (box[3] - box[1])) / (w * h);
  const one = overlaps[0];
  results.shapes[name] = { components: overlaps.length, grid: [gw, gh], blockShare: +share.toFixed(4),
    areaFrac: one && one.areaFrac, iou: one && +iou(one.bbox, bx).toFixed(4), hue: one && one.hue };
  assert.equal(overlaps.length, 1, `${name}: ${overlaps.length} components overlap the block`);
  assert.ok(Math.abs(one.areaFrac - share) <= 0.01, `${name}: area ${one.areaFrac} vs ${share}`);
  assert.ok(iou(one.bbox, bx) >= 0.95, `${name}: IoU ${iou(one.bbox, bx)}`);
}

test("T1.H eq: a red that crosses 0 degrees of hue stays one component (gradient and audit frame)", () => {
  results.shapes = {};
  const gradient = mk(120, 80, (x, y) => (x >= 30 && x < 90 && y >= 20 && y < 60 ? hsvBytes(350 + 20 * (x - 30) / 59, 0.9, 0.85) : grey(128)));
  shapeCheck("hueGradient350to10", 120, 80, gradient, [30, 20, 90, 60]);
  const coin = xorshift32(20261002);
  const wrap = mk(192, 128, (x, y) => (Math.abs(x - 96) < 40 && Math.abs(y - 64) < 30
    ? ((coin() & 1) ? [210, 30, 10] : [210, 10, 30]) : [40, 40, 40]));
  shapeCheck("auditRedWrap", 192, 128, wrap, [57, 35, 136, 94]);
});

test("T1 results file", () => {
  writeResult("t1-channels", { results });
});
