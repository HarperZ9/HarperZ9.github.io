// fractal-formula-cpu.js: the CPU twins of the formula and Lyapunov programs.
//
// fractal.js hands these the views whose type is a formula or the Lyapunov fractal. They iterate
// with the same compiled tree as the GPU (fractal-formulas.js) and colour with the same recipe as
// fractal-glsl-formula.js and fractal-glsl-lyapunov.js, line for line, through fractal-color.js.

import { preparePalette, rampLinear, reliefDir, encodeChannel, ditherOffset, trapWeight, holdGamut } from "./fractal-color.js";
import { formulaSpec, cpuFunction, iterateSpec } from "./fractal-formulas.js";
import { lyapunovExponent, lyapunovSequence } from "./fractal-glsl-lyapunov.js";
import { rootColour } from "./fractal-glsl-formula.js";

// Twin of convergedCount() in fractal-glsl-formula.js.
function convergedCount(n, s2, p2) {
  const a = Math.log(Math.max(p2, 1e-30)), b = Math.log(Math.max(s2, 1e-30)), e = Math.log(1e-9);
  const f = a - b > 1e-6 ? Math.min(1, Math.max(0, (a - e) / (a - b))) : 1;
  return n - 1 + f;
}

function paint(canvas, colourAt) {
  const W = canvas.width, H = canvas.height;
  const buf = new Uint8ClampedArray(W * H * 4);
  const buf32 = new Uint32Array(buf.buffer);
  const col = [0, 0, 0];
  for (let py = 0; py < H; py++) {
    for (let px = 0; px < W; px++) {
      const idx = py * W + px;
      if (!colourAt(px, py, col)) { buf32[idx] = 0xff000000; continue; }
      holdGamut(col);
      const d = ditherOffset(px, py);
      buf32[idx] = (0xff << 24) | (encodeChannel(col[2], d) << 16) | (encodeChannel(col[1], d) << 8) | encodeChannel(col[0], d);
    }
  }
  canvas.getContext("2d", { willReadFrequently: true }).putImageData(new ImageData(buf, W, H), 0, 0);
}

// Plane coordinate of a pixel centre; row 0 is the top (the larger imaginary part), as on the GPU.
function planeAt(opts, W, H) {
  const aspect = H / W;
  return (px, py) => [opts.cx + ((px + 0.5) / W - 0.5) * opts.scale, opts.cy - ((py + 0.5) / H - 0.5) * opts.scale * aspect];
}

export function renderFormulaCPU(canvas, opts, pal) {
  const spec = formulaSpec(opts);
  const fn = cpuFunction(spec);
  const { lab, tint } = preparePalette(pal);
  const at = planeAt(opts, canvas.width, canvas.height);
  const maxIter = Math.max(1, Math.round(opts.maxIter || 300));
  const logD = Math.log(spec.degree);
  paint(canvas, (px, py, col) => {
    const [x, y] = at(px, py);
    const r = iterateSpec(spec, fn, x, y, maxIter);
    if (!r.done) return false;
    if (spec.mode === "converge" && !rootColour(spec)) {
      const nu = convergedCount(r.n, r.step2, r.prev2);
      rampLinear(lab, nu / 6, col);
      return true;
    }
    if (spec.mode === "converge") {
      const nu = convergedCount(r.n, r.step2, r.prev2);
      const hue = Math.atan2(r.zy, r.zx) / (2 * Math.PI) + 0.5;
      rampLinear(lab, hue * 6 + 0.5, col);
      const bright = 1.6 * Math.exp(-0.2 * Math.max(nu, 0)) + 0.05;
      col[0] *= bright; col[1] *= bright; col[2] *= bright;
      return true;
    }
    const logr = 0.5 * Math.log(r.zx * r.zx + r.zy * r.zy);
    const mu = r.n - Math.log(Math.max(logr / Math.LN2, 1e-6)) / logD;
    rampLinear(lab, mu / 8, col);
    const shade = reliefDir(r.gx, r.gy);
    const glow = trapWeight(Math.exp(-r.trap * 4) * 0.30);
    col[0] = col[0] * shade + tint[0] * glow;
    col[1] = col[1] * shade + tint[1] * glow;
    col[2] = col[2] * shade + tint[2] * glow;
    return true;
  });
}

export function renderLyapunovCPU(canvas, opts, pal) {
  const { lab } = preparePalette(pal);
  const seq = lyapunovSequence(opts.sequence);
  const at = planeAt(opts, canvas.width, canvas.height);
  const iters = Math.max(16, Math.round(opts.maxIter || 200));
  const warm = Math.max(0, Math.min(400, Math.round(opts.warmup ?? 100)));
  const dark = [0, 0, 0];
  rampLinear(lab, 0.15, dark);
  paint(canvas, (px, py, col) => {
    const [a, b] = at(px, py);
    const l = lyapunovExponent(a, b, seq, iters, warm, opts.x0 ?? 0.5);
    if (l < 0) {
      const t = 1 - Math.exp(l * 1.6);
      rampLinear(lab, t * 5, col);
      const k = 0.55 + 0.6 * t;
      col[0] *= k; col[1] *= k; col[2] *= k;
    } else {
      const k = Math.exp(-l * 2.5) * 0.7;
      col[0] = dark[0] * k; col[1] = dark[1] * k; col[2] = dark[2] * k;
    }
    return true;
  });
}
