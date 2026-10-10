// fractal-buddhabrot.js: the Buddhabrot and the Nebulabrot, the parts shared by the GPU engine and
// the CPU fallback.
//
// The Buddhabrot (Melinda Green, 1993) is a density plot: pick many points c, iterate z -> z^2 + c
// from 0, and for every c whose orbit escapes, add each point the orbit visited to a histogram of
// the view. The Nebulabrot colours three such histograms by orbit length, so short orbits (the
// outer haze) and long ones (the fine inner figure) take different channels. Here one pass fills
// all three, in disjoint bands: red for n in [green limit, red limit), green for [blue limit, green
// limit), blue below the blue limit. Nested limits, also common, turned the whole figure white.
//
// The sample stream is seeded, so the same view always accumulates the same picture, and a still
// exported later matches the one on screen.

import { preparePalette, rampLinear, encodeChannel, ditherOffset } from "./fractal-color.js";

export const BUDDHA_TYPES = ["buddhabrot", "nebulabrot"];

// The region c is drawn from: every escaping orbit that reaches the main figure starts in here.
export const SAMPLE_BOX = { x0: -2.1, x1: 0.7, y0: -1.25, y1: 1.25 };

/** xorshift128+, seeded; returns a function giving floats in [0, 1). */
export function rng(seed) {
  let s0 = (seed * 2654435761) >>> 0 || 1, s1 = (seed ^ 0x9e3779b9) >>> 0 || 2, s2 = 0x6c078965, s3 = 0x8d2a4c8a;
  return () => {
    let t = s3;
    const s = s0;
    s3 = s2; s2 = s1; s1 = s;
    t ^= t << 11; t ^= t >>> 8;
    s0 = t ^ s ^ (s >>> 19);
    return (s0 >>> 0) / 4294967296;
  };
}

/**
 * The iteration limits a view asks for. Buddhabrot: one window [minIter, maxIter) in all three
 * channels. Nebulabrot: three limits, red the longest, as in the common recipe of 5000 / 500 / 50
 * scaled by the view's budget.
 */
export function buddhaLimits(view) {
  const max = Math.max(20, Math.round(view.maxIter || 2000));
  const min = Math.max(0, Math.round(view.minIter ?? 8));
  if (view.type === "nebulabrot") {
    const l = view.limits || [max, Math.round(max / 10), Math.round(max / 100)];
    return { min, max: Math.max(...l), channel: [l[0], l[1], Math.max(4, l[2])] };
  }
  return { min, max, channel: [max, 0, 0] };
}

/**
 * CPU accumulation into a Float32Array of W*H*3 counts, for `orbits` sampled points c. The
 * fallback for devices without WebGL2 float targets, and the reference for tests.
 */
export function accumulateCPU(view, W, H, orbits, seed = 1) {
  const acc = new Float32Array(W * H * 3);
  const { min, max, channel } = buddhaLimits(view);
  const rand = rng(seed);
  const aspect = H / W;
  const sx = W / view.scale, sy = H / (view.scale * aspect);
  const ox = view.cx - view.scale / 2, oyTop = view.cy + view.scale * aspect / 2;
  const orbit = new Float64Array(2 * max);
  for (let s = 0; s < orbits; s++) {
    const cx = SAMPLE_BOX.x0 + rand() * (SAMPLE_BOX.x1 - SAMPLE_BOX.x0);
    const cy = SAMPLE_BOX.y0 + rand() * (SAMPLE_BOX.y1 - SAMPLE_BOX.y0);
    // The main cardioid and the period-2 bulb never escape; skip them, as the GPU does.
    const xq = cx - 0.25, q = xq * xq + cy * cy;
    if (q * (q + xq) <= 0.25 * cy * cy || (cx + 1) * (cx + 1) + cy * cy <= 0.0625) continue;
    let x = 0, y = 0, n = 0;
    while (n < max && x * x + y * y <= 4) {
      const t = x * x - y * y + cx;
      y = 2 * x * y + cy; x = t;
      orbit[2 * n] = x; orbit[2 * n + 1] = y;
      n++;
    }
    if (n >= max || n < min) continue;          // only orbits that escape inside the window
    const w0 = n < channel[0] && n >= channel[1] ? 1 : 0, w1 = n < channel[1] && n >= channel[2] ? 1 : 0, w2 = n < channel[2] ? 1 : 0;
    // k = 0 is z_1 = c, the sample itself: skipped, as on the GPU, or the sampling box would print.
    for (let k = 1; k < n; k++) {
      const px = Math.floor((orbit[2 * k] - ox) * sx);
      // The set is symmetric about the real axis, so each point also lands at its mirror image.
      for (const im of [orbit[2 * k + 1], -orbit[2 * k + 1]]) {
        const py = Math.floor((oyTop - im) * sy);
        if (px < 0 || py < 0 || px >= W || py >= H) continue;
        const i = (py * W + px) * 3;
        acc[i] += w0; acc[i + 1] += w1; acc[i + 2] += w2;
      }
    }
  }
  return acc;
}

/**
 * Exposure: the value each channel maps to full brightness, the 99.95th percentile of the lit
 * pixels, so a few hot pixels at the figure's spine do not darken everything else.
 */
export function exposureOf(acc, stride = 3, step = 1) {
  const out = [1, 1, 1];
  for (let c = 0; c < 3; c++) {
    const vals = [];
    for (let i = c; i < acc.length; i += stride * step) if (acc[i] > 0) vals.push(acc[i]);
    if (!vals.length) continue;
    vals.sort((a, b) => a - b);
    out[c] = Math.max(1, vals[Math.min(vals.length - 1, Math.floor(vals.length * 0.9995))]);
  }
  return out;
}

// The tone curve, shared with the GPU display shader: density over the exposure, raised to
// 1 / gamma. A log curve was tried first and washed the figure out: it lifts the sparse halo
// nearly as high as the dense spine.
export function tone(v, ref, gamma) {
  return Math.pow(Math.min(1, Math.max(0, v / ref)), 1 / gamma);
}

/** Paint an accumulation into a 2D canvas with the shared tone curve. */
export function paintAccumulation(canvas, acc, view, pal, ref = exposureOf(acc)) {
  const W = canvas.width, H = canvas.height;
  const gamma = view.gamma ?? 2;
  const { lab } = preparePalette(pal);
  const buf = new Uint8ClampedArray(W * H * 4);
  const col = [0, 0, 0];
  const nebula = view.type === "nebulabrot";
  for (let p = 0; p < W * H; p++) {
    const i = p * 3, px = p % W, py = (p / W) | 0;
    let r, g, b;
    if (nebula) {
      r = tone(acc[i], ref[0], gamma); g = tone(acc[i + 1], ref[1], gamma); b = tone(acc[i + 2], ref[2], gamma);
    } else {
      const t = tone(acc[i], ref[0], gamma);
      if (t <= 0) { r = g = b = 0; } else { rampLinear(lab, t * (lab.length - 1), col); r = col[0] * t; g = col[1] * t; b = col[2] * t; }
    }
    const d = ditherOffset(px, py);
    buf[p * 4] = encodeChannel(r, d); buf[p * 4 + 1] = encodeChannel(g, d); buf[p * 4 + 2] = encodeChannel(b, d); buf[p * 4 + 3] = 255;
  }
  canvas.getContext("2d", { willReadFrequently: true }).putImageData(new ImageData(buf, W, H), 0, 0);
}

/** The CPU renderer: a fixed budget of orbits sized to the canvas, then paint. */
export function renderBuddhabrotCPU(canvas, view, pal) {
  const W = canvas.width, H = canvas.height;
  const orbits = Math.min(400000, Math.max(20000, Math.round(W * H * 0.5)));
  paintAccumulation(canvas, accumulateCPU(view, W, H, orbits, view.seed || 1), view, pal);
}

/**
 * The GPU display program (GLSL ES 3.00), the twin of paintAccumulation. Built here so the tone
 * curve and its constants sit next to the CPU version; the colour libraries come in as arguments.
 */
export function buildBuddhaDisplay(RAMP_LIB, ENCODE_LIB) {
  return `#version 300 es
precision highp float;
precision highp sampler2D;
uniform sampler2D u_acc;
uniform vec3  u_ref;
uniform float u_gamma;
uniform int   u_nebula;
out vec4 fragColor;
${RAMP_LIB}
${ENCODE_LIB}
float tone(float v, float r) { return pow(clamp(v / r, 0.0, 1.0), 1.0 / u_gamma); }
void main() {
  vec4 a = texelFetch(u_acc, ivec2(gl_FragCoord.xy), 0);
  vec3 c;
  if (u_nebula == 1) c = vec3(tone(a.r, u_ref.r), tone(a.g, u_ref.g), tone(a.b, u_ref.b));
  else { float t = tone(a.r, u_ref.r); c = t <= 0.0 ? vec3(0.0) : ramp(t * float(u_palN - 1)) * t; }
  fragColor = vec4(encodeOut(c, gl_FragCoord.xy), 1.0);
}`;
}
