// src/emblems/media.mjs: emblems for graphics, film and design, visual art, sound and the game revivals. Each draws
// a technique or idea, never a logo, character or trademark of the work or person it honours.
import { TAU, inCircle, inPoly, inRect, fbm } from './kit.mjs';

// Vorontsov (ENBSeries): practical film-look hacks. A point light with bloom rings and an anamorphic streak.
export function bloom(c) {
  for (let r = 0.02; r < 0.3; r += 0.018) c.circle(0.5, 0.5, r, 0.5 + 1.6 * (1 - r / 0.3) ** 3);
  for (let k = -3; k <= 3; k++) c.line(0.04, 0.5 + k * 0.006, 0.96, 0.5 + k * 0.006, 0.6 * (1 - Math.abs(k) / 4));
  c.fill(inCircle(0.5, 0.5, 0.025), c.spot);
}

// Gilcher (ReShade): ambient occlusion. A sphere resting on a plane, the contact shadow built from dots.
export function occlusion(c) {
  c.line(0.08, 0.72, 0.92, 0.72, 1);
  c.stipple((u, v) => (v > 0.72 && v < 0.8 ? Math.exp(-((u - 0.5) ** 2) / 0.01) * (1 - (v - 0.72) / 0.08) : 0), 60000, 0.0018);
  c.circle(0.5, 0.5, 0.2, 1.4);
  c.stipple((u, v) => { const d = Math.hypot(u - 0.5, v - 0.5); return d < 0.2 ? Math.max(0, (u - 0.42) * 1.4 + (v - 0.45) * 1.2) : 0; }, 50000, 0.0018);
}

// Trey M: film grade. A strip of frames stepping through a tone ramp, with sprocket holes.
export function filmstrip(c) {
  c.line(0.08, 0.3, 0.92, 0.3, 1.2); c.line(0.08, 0.7, 0.92, 0.7, 1.2);
  for (let i = 0; i < 5; i++) {
    const x0 = 0.1 + i * 0.165, f = inRect(x0, 0.36, x0 + 0.14, 0.64);
    c.hatch(f, 0.9, 0.05 - i * 0.008, 0.7); c.poly([[x0, 0.36], [x0 + 0.14, 0.36], [x0 + 0.14, 0.64], [x0, 0.64]], 0.7, c.ink, true);
    for (const y of [0.32, 0.66]) c.fill(inRect(x0 + 0.02, y, x0 + 0.05, y + 0.02)), c.fill(inRect(x0 + 0.09, y, x0 + 0.12, y + 0.02));
  }
}

// Looping: a loop of light, a lemniscate drawn as many offset passes.
export function loop(c) {
  for (let k = 0; k < 9; k++) {
    const pts = [], s = 0.32 + k * 0.012;
    for (let t = 0; t <= TAU + 0.01; t += 0.02) { const d = 1 + Math.sin(t) ** 2; pts.push([0.5 + (s * Math.cos(t)) / d, 0.5 + (s * Math.sin(t) * Math.cos(t)) / d]); }
    c.poly(pts, 0.7);
  }
}

// The Eameses: one idea explained by moving through scale. Nested squares, each a power of ten smaller in spirit.
export function scale(c) {
  let s = 0.42, x = 0.5, y = 0.5;
  for (let i = 0; i < 7; i++) { c.poly([[x - s, y - s], [x + s, y - s], [x + s, y + s], [x - s, y + s]], 1.4 - i * 0.12, c.ink, true); x += s * 0.18; y += s * 0.12; s *= 0.56; }
  c.fill(inCircle(x, y, 0.012), c.spot);
}

// wiqaayat1: line geometry from the Islamic tradition the craft draws on. An eight-fold star rosette.
export function rosette(c) {
  const star = (r, rot) => [...Array(16)].map((_, i) => { const a = (i / 16) * TAU + rot, rr = i % 2 ? r * 0.62 : r; return [0.5 + rr * Math.cos(a), 0.5 + rr * Math.sin(a)]; });
  c.poly(star(0.4, 0), 1.4, c.ink, true); c.poly(star(0.4, TAU / 16), 0.8, c.ink, true); c.poly(star(0.2, TAU / 32), 1, c.ink, true);
  c.circle(0.5, 0.5, 0.44, 0.6);
}

// Bauhaus: the elementary forms, with one in the spot colour.
export function elements(c) {
  c.fill(inCircle(0.3, 0.38, 0.14), c.spot); c.fill(inRect(0.5, 0.24, 0.78, 0.52)); c.fill(inPoly([[0.22, 0.82], [0.5, 0.56], [0.78, 0.82]])); c.line(0.12, 0.88, 0.88, 0.88, 1);
}

// Art deco: a stepped sunburst over stepped forms.
export function sunburst(c) {
  for (let i = 0; i <= 18; i++) { const a = Math.PI + (i / 18) * Math.PI; c.line(0.5 + 0.1 * Math.cos(a), 0.62 + 0.1 * Math.sin(a), 0.5 + 0.42 * Math.cos(a), 0.62 + 0.42 * Math.sin(a), i % 2 ? 0.7 : 1.6); }
  for (let k = 0; k < 4; k++) c.fill(inRect(0.5 - 0.1 - k * 0.08, 0.62 + k * 0.06, 0.5 + 0.1 + k * 0.08, 0.68 + k * 0.06));
}

// Surrealism: a cloud indoors, held in a door frame standing in an empty field.
export function cloudDoor(c) {
  c.poly([[0.34, 0.82], [0.34, 0.2], [0.66, 0.2], [0.66, 0.82]], 2); c.line(0.06, 0.82, 0.94, 0.82, 0.8);
  const puffs = [[0.44, 0.5, 0.055], [0.51, 0.45, 0.07], [0.58, 0.5, 0.055], [0.5, 0.53, 0.06]], cloud = (u, v) => puffs.some(([x, y, r]) => (u - x) ** 2 + (v - y) ** 2 < r * r);
  c.hatch(cloud, -0.4, 0.007, 0.5); for (const [x, y, r] of puffs) c.circle(x, y, r, 0.8, c.ink, Math.PI * 0.95, Math.PI * 2.05);
}

// Brutalism: board-marked concrete masses stacked off-axis.
export function masses(c) {
  for (const [x0, y0, x1, y1] of [[0.18, 0.56, 0.82, 0.84], [0.3, 0.32, 0.7, 0.56], [0.24, 0.16, 0.58, 0.32]]) {
    const f = inRect(x0, y0, x1, y1); c.hatch(f, 0, 0.012, 0.5); c.poly([[x0, y0], [x1, y0], [x1, y1], [x0, y1]], 1.8, c.ink, true);
  }
}

// Giger (ballpoint): biomechanical ribs, crosshatched in one pen.
export function ribs(c) {
  for (let i = 0; i < 9; i++) {
    const y = 0.14 + i * 0.085, rib = (u, v) => Math.abs(v - y - 0.05 * Math.cos((u - 0.5) * 5)) < 0.025 && Math.abs(u - 0.5) < 0.38 - i * 0.012;
    c.hatch(rib, 0.6, 0.008, 0.45); c.hatch(rib, -0.6, 0.011, 0.45);
  }
  c.hatch((u, v) => Math.abs(u - 0.5) < 0.035 && v > 0.08 && v < 0.92, 0, 0.007, 0.5);
}

// Beksinski: a single monolithic tower in fog.
export function monolith(c) {
  const tower = inPoly([[0.43, 0.88], [0.45, 0.2], [0.5, 0.12], [0.55, 0.2], [0.57, 0.88]]);
  c.hatch(tower, 1.45, 0.006, 0.6);
  c.stipple((u, v) => (v > 0.6 ? 0.35 * (v - 0.6) / 0.4 * (0.6 + 0.8 * fbm(u * 6, v * 6, 3)) : 0), 140000, 0.0014);
}

// Escher: the regular division of the plane. One wavy tile edge, translated, interlocks every tile; alternate
// tiles are hatched, so figure and ground trade places.
export function tessellate(c) {
  const n = 5, t = 0.8 / n, f = (q) => 0.22 * Math.sin(q * TAU) * Math.sin(q * Math.PI), g = (q) => 0.18 * Math.sin(q * TAU * 1.5) * Math.sin(q * Math.PI);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const x0 = 0.1 + i * t, y0 = 0.1 + j * t, pts = [];
    for (let k = 0; k <= 20; k++) pts.push([x0 + (k / 20) * t, y0 + f(k / 20) * t]);
    for (let k = 0; k <= 20; k++) pts.push([x0 + t + g(k / 20) * t, y0 + (k / 20) * t]);
    for (let k = 20; k >= 0; k--) pts.push([x0 + (k / 20) * t, y0 + t + f(k / 20) * t]);
    for (let k = 20; k >= 0; k--) pts.push([x0 + g(k / 20) * t, y0 + (k / 20) * t]);
    if ((i + j) % 2) c.hatch(inPoly(pts), 0.8, 0.008, 0.5);
    c.poly(pts, 0.8, c.ink, true);
  }
}

// Idris Muhammad: a drumhead with a swung pattern of strokes around its rim.
export function drum(c) {
  for (let r = 0.12; r <= 0.4; r += 0.07) c.circle(0.5, 0.5, r, r > 0.39 ? 2 : 0.6);
  for (let i = 0; i < 16; i++) { const swing = i % 2 ? 0.11 : 0, a = ((i + swing) / 16) * TAU - TAU / 4, acc = i % 4 === 0; c.dot(0.5 + 0.33 * Math.cos(a), 0.5 + 0.33 * Math.sin(a), acc ? 0.022 : 0.011); }
}

// LTJ Bukem: atmosphere. Rolling horizon lines, layered and soft, over a low pulse.
export function atmosphere(c) {
  for (let k = 0; k < 14; k++) {
    const pts = [], y0 = 0.25 + k * 0.035;
    for (let u = 0.06; u <= 0.94; u += 0.01) pts.push([u, y0 + 0.03 * Math.sin(u * 7 + k * 0.6) * (1 - k / 16)]);
    c.poly(pts, 0.5 + k * 0.08);
  }
  for (let i = 0; i < 8; i++) c.dot(0.12 + i * 0.108, 0.86, 0.008);
}

// Akira Yamaoka: radio static in fog. A band of noise over a horizon dissolving into mist.
export function staticBand(c) {
  c.stipple((u, v) => (Math.abs(v - 0.4) < 0.08 ? 0.75 : v > 0.55 ? 0.2 * (1 - (v - 0.55) / 0.45) : 0), 200000, 0.0012);
  c.line(0.06, 0.62, 0.94, 0.62, 0.8);
}

// Skino: the beat selection. A 16-step grid, four lanes, accents in ink.
export function steps(c) {
  const pat = ['1000001000100010', '0000100000001000', '1010101110101011', '0001000000100001'];
  pat.forEach((row, j) => [...row].forEach((b, i) => {
    const x = 0.12 + i * 0.048, y = 0.28 + j * 0.13, f = inRect(x, y, x + 0.036, y + 0.09);
    if (b === '1') c.fill(f); else c.poly([[x, y], [x + 0.036, y], [x + 0.036, y + 0.09], [x, y + 0.09]], 0.5, c.ink, true);
  }));
}

// Neno: woozy, futuristic patterns. A grid warped as if the tape were slowing.
export function warp(c) {
  for (let i = 0; i <= 12; i++) {
    const a = [], b = [];
    for (let t = 0; t <= 1; t += 0.01) {
      const w = 0.04 * Math.sin(t * 5 + i * 0.5) * Math.sin(i * 0.4);
      a.push([0.12 + t * 0.76, 0.12 + i * 0.063 + w]); b.push([0.12 + i * 0.063 + w, 0.12 + t * 0.76]);
    }
    c.poly(a, 0.6); c.poly(b, 0.6);
  }
}

// OT7 Quanny: mastering fadeouts. A waveform whose envelope falls away to silence.
export function fade(c) {
  let prev = null;
  for (let u = 0.06; u <= 0.94; u += 0.0015) {
    const env = Math.pow(1 - (u - 0.06) / 0.88, 2.2), y = 0.5 + 0.32 * env * Math.sin(u * 340) * (0.6 + 0.4 * Math.sin(u * 23));
    if (prev) c.line(prev[0], prev[1], u, y, 0.6); prev = [u, y];
  }
}

// Mercenaries: open-world destruction. A building breaking into falling blocks.
export function ruin(c) {
  for (let j = 0; j < 7; j++) for (let i = 0; i < 4; i++) {
    const fall = Math.max(0, i + j - 6) * 0.04, x = 0.3 + i * 0.1 + fall * 0.7, y = 0.84 - (j + 1) * 0.09 + fall * 1.6;
    c.poly([[x, y], [x + 0.09, y + fall * 0.4], [x + 0.09, y + 0.08 + fall * 0.4], [x, y + 0.08]], 1);
  }
  c.line(0.08, 0.88, 0.92, 0.88, 1.2);
}

// The Suffering: a barred window in a cell, fog beyond.
export function bars(c) {
  c.stipple((u, v) => (u > 0.24 && u < 0.76 && v > 0.2 && v < 0.74 ? 0.25 + 0.35 * fbm(u * 5, v * 5, 8) : 0), 120000, 0.0013);
  c.poly([[0.24, 0.2], [0.76, 0.2], [0.76, 0.74], [0.24, 0.74]], 2.4, c.ink, true);
  for (let i = 1; i < 6; i++) c.line(0.24 + i * 0.087, 0.2, 0.24 + i * 0.087, 0.74, 2.2);
}

// Manhunt: a camcorder frame. Corner marks, scanlines and the recording dot in the spot colour.
export function camcorder(c) {
  for (const [x, y, sx, sy] of [[0.1, 0.18, 1, 1], [0.9, 0.18, -1, 1], [0.1, 0.82, 1, -1], [0.9, 0.82, -1, -1]]) c.poly([[x, y + sy * 0.1], [x, y], [x + sx * 0.1, y]], 1.6);
  for (let v = 0.22; v < 0.8; v += 0.012) c.line(0.12, v, 0.88, v, 0.35, c.ink, 0.5);
  c.fill(inCircle(0.8, 0.27, 0.025), c.spot);
}
