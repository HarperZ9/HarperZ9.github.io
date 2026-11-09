// Physical CRT parameters: presets in physical units, and resolve(), which turns a preset
// plus overrides into the full set of numbers the passes use (millimetres on the tube
// face, signal samples, line spacing, filter taps, the halo kernel, the phosphor matrix).
// Lengths are millimetres, times seconds, frequencies MHz.
import { lowpassTaps, notchTaps, identityTaps } from "../common.mjs";
import { screenMatrix, decayTable } from "./phosphors.mjs";
import { PRIMARIES } from "../spectral.mjs";
import { haloKernel } from "./halo.mjs";

export const STANDARDS = {
  ntsc: { fsc: 315 / 88, lumaMHz: 4.2, iMHz: 1.3, qMHz: 0.4, lineDeg: 180, frameDeg: 180, field: 1 / 59.94 },
  pal: { fsc: 4.43361875, lumaMHz: 5.0, iMHz: 1.3, qMHz: 1.3, lineDeg: 270.6, frameDeg: 0, field: 1 / 50 },
};

const base = {
  signal: { mode: "rgb", standard: "ntsc", pixelClockMHz: 5.369318, lineDeg: null, frameDeg: null,
    decoder: "comb", encodeChromaMHz: 1.3, rgbMHz: 8, lumaMHz: null },
  tube: { diagonalIn: 20, aspect: 4 / 3, overscan: 0.0, corner: 12, gamma: 2.4, contrast: 1, brightness: 0 },
  view: { distance: null, zoom: 1, centre: [0, 0], border: 0.08 },
  curvature: { rx: 1500, ry: 1e9 },
  spot: { lo: 0.16, hi: 0.34, exponent: 0.5 },     // sigma in line spacings at zero and full current
  mask: { type: "grille", pitch: 0.30, fill: 0.85, slotHeight: 0.6, slotGap: 0.12, dampers: [1 / 3, 2 / 3], damperWidth: 0.05, mix: 1 },
  convergence: { r: [0, 0], b: [0, 0], radial: 0 },
  phosphor: { screen: "p22", primaries: "smpteC", white: "D65", output: "rec709" },
  glass: { thickness: 12, n: 1.52, transmission: 0.56, albedo: 0.5, cell: 1.0 },
  room: { ambient: 0.004, reflection: 0.6, bezel: [0.035, 0.034, 0.033] },
  interlace: false,
};

export const PRESETS = {
  "pvm-20": { tube: { diagonalIn: 20 }, mask: { type: "grille", pitch: 0.30 }, spot: { lo: 0.12, hi: 0.27 },
    curvature: { rx: 1600, ry: 1e9 }, glass: { thickness: 11, transmission: 0.7 } },
  "trinitron-tv": { tube: { diagonalIn: 27, overscan: 0.06 }, signal: { mode: "composite", decoder: "comb" },
    mask: { type: "grille", pitch: 0.70 }, spot: { lo: 0.18, hi: 0.38 }, curvature: { rx: 1700, ry: 1e9 }, glass: { thickness: 13, transmission: 0.56 } },
  "slot-tv": { tube: { diagonalIn: 20, overscan: 0.07, corner: 22 }, signal: { mode: "composite", decoder: "notch" },
    mask: { type: "slot", pitch: 0.75, slotHeight: 0.85, slotGap: 0.18 }, spot: { lo: 0.2, hi: 0.42 },
    curvature: { rx: 810, ry: 810 }, glass: { thickness: 12, transmission: 0.46 } },
  "vga-14": { tube: { diagonalIn: 14 }, mask: { type: "delta", pitch: 0.28, fill: 0.8 }, spot: { lo: 0.18, hi: 0.32 },
    curvature: { rx: 700, ry: 700 }, glass: { thickness: 9, transmission: 0.6 } },
  "bw-tv": { tube: { diagonalIn: 17, overscan: 0.06, corner: 30 }, signal: { mode: "composite", decoder: "notch" },
    mask: { type: "none" }, spot: { lo: 0.2, hi: 0.4 }, curvature: { rx: 650, ry: 650 }, phosphor: { screen: "p4" } },
  "radar-p7": { tube: { diagonalIn: 12, aspect: 1, corner: 60 }, mask: { type: "none" }, spot: { lo: 0.25, hi: 0.45 },
    curvature: { rx: 900, ry: 900 }, phosphor: { screen: "p7" }, glass: { transmission: 0.8 } },
  "scope-p31": { tube: { diagonalIn: 8 }, mask: { type: "none" }, spot: { lo: 0.25, hi: 0.4 }, curvature: { rx: 1e9, ry: 1e9 },
    phosphor: { screen: "p31" }, glass: { transmission: 0.85 } },
};

function merge(a, b) {
  const o = Array.isArray(a) ? a.slice() : { ...a };
  for (const [k, v] of Object.entries(b || {})) o[k] = v && typeof v === "object" && !Array.isArray(v) && a && typeof a[k] === "object" ? merge(a[k], v) : v;
  return o;
}

// Filter taps for the signal stages, in cycles per sample at fs = 4 fsc.
function signalTaps(sig, std, fs) {
  const lp = (mhz, half = 16) => (mhz > 0 ? lowpassTaps(Math.min(0.49, mhz / fs), half) : identityTaps());
  const luma = sig.lumaMHz ?? std.lumaMHz;
  return {
    encodeC: lp(sig.encodeChromaMHz, 12),
    lumaSep: sig.decoder === "notch" ? notchTaps(0.25, 1.0 / fs, 16) : identityTaps(),
    lumaLp: lp(luma, 12),
    demodI: lp(std.iMHz, 24), demodQ: lp(std.qMHz, 24),
    rgb: lp(sig.rgbMHz, 8),
  };
}

// resolve(preset name or object, overrides, source size, output size) -> plan
export function resolve(preset, overrides, src, out) {
  const p = merge(merge(base, typeof preset === "string" ? PRESETS[preset] || {} : preset || {}), overrides || {});
  const std = STANDARDS[p.signal.standard];
  const fs = 4 * std.fsc, N = Math.max(1, Math.round((src.w * fs) / p.signal.pixelClockMHz));
  const diag = p.tube.diagonalIn * 25.4, a = p.tube.aspect;
  const faceW = (diag * a) / Math.hypot(a, 1), faceH = diag / Math.hypot(a, 1);
  const rasterW = faceW * (1 + p.tube.overscan), rasterH = faceH * (1 + p.tube.overscan);
  const lines = src.h, lineMm = rasterH / lines;
  const distance = p.view.distance ?? 4 * faceH;
  const viewW = (faceW * (1 + p.view.border)) / p.view.zoom;
  const viewH = viewW * (out.h / out.w);
  const scr = screenMatrix(p.phosphor.screen, { white: p.phosphor.white, output: p.phosphor.output,
    primaries: p.phosphor.primaries && p.phosphor.primaries !== "spectral" ? PRIMARIES[p.phosphor.primaries] : null });
  const field = std.field;
  const halo = haloKernel(p.glass, { mmPerPx: viewW / out.w, maxCells: 25 });
  return {
    p, std, fs, N, src, out, faceW, faceH, rasterW, rasterH, lines, lineMm, distance, viewW, viewH,
    lineCyc: (p.signal.lineDeg ?? std.lineDeg) / 360, frameCyc: (p.signal.frameDeg ?? std.frameDeg) / 360,
    taps: signalTaps(p.signal, std, fs), screen: scr, decay: decayTable(scr.parts, field), field, halo,
    mode: { rgb: 0, svideo: 1, composite: 2 }[p.signal.mode], pal: p.signal.standard === "pal",
  };
}
