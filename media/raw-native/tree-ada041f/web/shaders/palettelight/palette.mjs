// Ramp palettes for palette-locked lighting. A palette here is a table of ramps, each an ordered
// run of colours from shadow to light, built in OKLab from one base colour per material class:
// shadows turn toward blue-violet, lights toward warm yellow, chroma peaks in the mid steps.
// Every class has two variants of its ramp, one under cool light (the moon) and one under warm
// light (a lamp or a window), so a lamp changes the hue of what it lights and not only its value.
// Also a cycling ramp for the void pools and short ramps for emissive things. Every colour is an
// exact 8-bit sRGB entry. Original construction; the colours are authored, not sampled.
import { srgbToOklab, oklabToSrgb } from "../reference/retro-palettes.mjs";

const D2R = Math.PI / 180;
// Move hue h (radians) a fraction f of the way toward target hue t, along the short arc.
function toward(h, t, f) { let d = t - h; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return h + d * f; }
const byte = (v) => Math.round(Math.min(1, Math.max(0, v)) * 255);
function entry(L, C, h, tag) {
  const rgb = oklabToSrgb(L, C * Math.cos(h), C * Math.sin(h)).map(byte), lab = srgbToOklab(rgb[0] / 255, rgb[1] / 255, rgb[2] / 255);
  return { rgb, lab, ...tag };
}
export const CLASS_BASES = { ground: [0.34, 0.42, 0.24], stone: [0.62, 0.6, 0.58], wood: [0.42, 0.29, 0.18], foliage: [0.2, 0.38, 0.22] };

// variant: 0 moon (cool), 1 lamp (warm)
export function rampColours(base, steps, variant) {
  const [L0, a0, b0] = srgbToOklab(...base), C0 = Math.hypot(a0, b0), h0 = Math.atan2(b0, a0), out = [];
  for (let s = 0; s < steps; s++) {
    const t = s / (steps - 1);
    let L = Math.min(0.97, L0 * (0.34 + 0.86 * Math.pow(t, 0.9))), C = Math.min(0.2, C0 * (0.6 + 0.9 * Math.sin(Math.PI * (0.15 + 0.8 * t)))), h = toward(h0, 285 * D2R, 0.55 * Math.pow(1 - t, 1.2));
    h = toward(h, 85 * D2R, 0.4 * Math.pow(t, 1.6));
    if (variant === 0) { h = toward(h, 250 * D2R, 0.3); L *= 0.97; } else { h = toward(h, 62 * D2R, 0.72 * (0.4 + 0.6 * t)); C = Math.min(0.22, C * 1.3); L = Math.min(0.97, L * 1.12); }
    out.push({ L, C, h });
  }
  return out;
}

export function buildPalette({ steps = 4, voidSteps = 6 } = {}) {
  const entries = [], ramp = {};
  for (const [name, base] of Object.entries(CLASS_BASES)) {
    ramp[name] = [[], []];
    for (let v = 0; v < 2; v++) rampColours(base, steps, v).forEach((c, s) => { ramp[name][v].push(entries.length); entries.push(entry(c.L, c.C, c.h, { cls: name, variant: v, step: s })); });
  }
  ramp.void = [];
  for (let s = 0; s < voidSteps; s++) { const t = s / voidSteps, L = 0.2 + 0.44 * Math.pow(Math.sin(Math.PI * t), 1.3) + (s === 3 ? 0.04 : 0), C = 0.07 + 0.1 * Math.sin(Math.PI * t), h = (285 + 75 * Math.sin(2 * Math.PI * t) - 40 * (s === 3 ? 1 : 0)) * D2R; ramp.void.push(entries.length); entries.push(entry(L, C, h, { cls: "void", variant: 0, step: s })); }
  ramp.window = [[0.7, 0.13, 70], [0.83, 0.12, 85], [0.95, 0.08, 95]].map(([L, C, h], s) => { const k = entries.length; entries.push(entry(L, C, h * D2R, { cls: "window", variant: 0, step: s })); return k; });
  ramp.lamp = [[0.9, 0.1, 90], [0.98, 0.05, 100]].map(([L, C, h], s) => { const k = entries.length; entries.push(entry(L, C, h * D2R, { cls: "lamp", variant: 0, step: s })); return k; });
  ramp.night = entries.length; entries.push(entry(0.14, 0.04, 285 * D2R, { cls: "night", variant: 0, step: 0 }));
  return { entries, ramp, steps, voidSteps, size: entries.length };
}
export const rgbaOf = (pal, i) => [...pal.entries[i].rgb, 255];
