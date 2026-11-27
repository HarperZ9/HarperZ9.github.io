// layer-glass-water.mjs: Real-time dielectric glass refraction + Cauchy dispersion +
// water ripple caustics for the Unified /playground/ Studio Compositor (Wave 33A-1).
// Reuses exact Fraunhofer/Cauchy optics (650/532/450 nm) and Fresnel/Snell slab physics.

export const LAYER_META = Object.freeze({
  id: 'glass-water',
  name: 'Glass & Water Optics',
  discipline: 'Paint, Pigment, Glass, Film & Shaders',
  route: 'Low Water -> Glass & Water',
  takes: ['frame', 'audio_features', 'palette'],
  gives: ['frame'],
  defaultOn: true,
  defaultOpacity: 0.78,
  defaultBlend: 'normal',
});

export const WAVELENGTHS = Object.freeze({ r: 650, g: 532, b: 450 });
export const LINES = Object.freeze({ F: 486.13, d: 587.56, C: 656.27 });
export const GLASSES = Object.freeze({
  crown: { nd: 1.5168, vd: 64.17 },
  flint: { nd: 1.6200, vd: 36.37 },
  dense: { nd: 1.7847, vd: 25.68 },
  silica: { nd: 1.4585, vd: 67.82 },
  water: { nd: 1.3330, vd: 55.6 },
});

const clamp = (x, lo = 0, hi = 1) => (x < lo ? lo : x > hi ? hi : x);

export function cauchy(nd, vd) {
  if (!(nd > 1 && vd > 0)) throw new RangeError('glass-water: need n_d > 1 and V_d > 0');
  const um = (l) => l / 1000;
  const B = (nd - 1) / (vd * (1 / um(LINES.F) ** 2 - 1 / um(LINES.C) ** 2));
  return { A: nd - B / um(LINES.d) ** 2, B };
}

export function iorAt(lambdaNm, nd, vd) {
  const { A, B } = cauchy(nd, vd);
  return A + B / (lambdaNm / 1000) ** 2;
}

export function channelIor(glass = 'crown', spread = 1) {
  const g = typeof glass === 'string' ? GLASSES[glass] : glass;
  if (!g) throw new RangeError(`glass-water: unknown medium ${glass}`);
  const n = [WAVELENGTHS.r, WAVELENGTHS.g, WAVELENGTHS.b].map((l) => iorAt(l, g.nd, g.vd));
  return n.map((v) => n[1] + (v - n[1]) * spread);
}

export function fresnel(cosi, n1, n2) {
  const ci = Math.min(1, Math.abs(cosi));
  const s = (n1 / n2) ** 2 * (1 - ci * ci);
  if (s >= 1) return 1;
  const ct = Math.sqrt(1 - s);
  const rs = (n1 * ci - n2 * ct) / (n1 * ci + n2 * ct);
  const rp = (n1 * ct - n2 * ci) / (n1 * ct + n2 * ci);
  return 0.5 * (rs * rs + rp * rp);
}

export function refractVec(I, N, eta) {
  const d = I[0] * N[0] + I[1] * N[1] + I[2] * N[2];
  const k = 1 - eta * eta * (1 - d * d);
  if (k < 0) return null;
  const a = eta * d + Math.sqrt(k);
  return [eta * I[0] - a * N[0], eta * I[1] - a * N[1], eta * I[2] - a * N[2]];
}

export function slabOffset(N, n, thickness, gap) {
  const t1 = refractVec([0, 0, -1], N, 1 / n);
  if (!t1) return null;
  const s1 = thickness / Math.max(1e-4, -t1[2]);
  const t2 = refractVec(t1, [0, 0, 1], n);
  if (!t2) return null;
  const s2 = gap / Math.max(1e-4, -t2[2]);
  return { dx: t1[0] * s1 + t2[0] * s2, dy: t1[1] * s1 + t2[1] * s2, path: s1 };
}

export function buildRippleGlassHeight(w, h, state = {}, opts = {}) {
  const t = Number(state.time) || 0;
  const sx = (state.stirX ?? 0.52) * w;
  const sy = (state.stirY ?? 0.46) * h;
  const bass = clamp(state.audio?.bass ?? state.audio?.bands8?.[0] ?? 0.35);
  const rms = clamp(state.audio?.rms ?? 0.3);
  const amp = (opts.rippleAmp ?? 2.8) * (0.65 + bass * 0.85 + (state.audio?.onset ? 0.25 : 0));
  const thickness = opts.thickness ?? 14;
  const height = new Float32Array(w * h);
  const lensR = Math.min(w, h) * (opts.lensRadius ?? 0.36);

  for (let y = 0, i = 0; y < h; y++) {
    for (let x = 0; x < w; x++, i++) {
      const dx = x - sx, dy = y - sy;
      const dist = Math.hypot(dx, dy);
      const lens = dist < lensR ? Math.sqrt(Math.max(0, 1 - (dist / lensR) ** 2)) * (opts.lensHeight ?? 10) : 0;
      const wave1 = Math.sin(dist * 0.24 - t * 3.1) * Math.exp(-dist / (w * 0.45));
      const wave2 = Math.cos(x * 0.11 + t * 1.4) * Math.sin(y * 0.13 - t * 1.1) * (0.45 + rms * 0.55);
      height[i] = Math.max(1, thickness + lens + (wave1 * 0.72 + wave2 * 0.28) * amp);
    }
  }
  return height;
}

function normalFromHeight(height, w, h, x, y) {
  const xm = x > 0 ? x - 1 : 0, xp = x + 1 < w ? x + 1 : w - 1;
  const ym = y > 0 ? y - 1 : 0, yp = y + 1 < h ? y + 1 : h - 1;
  const gx = (height[y * w + xp] - height[y * w + xm]) * 0.5;
  const gy = (height[yp * w + x] - height[ym * w + x]) * 0.5;
  const inv = 1 / Math.hypot(-gx, -gy, 1);
  return [-gx * inv, -gy * inv, inv];
}

function sampleRgba(src, w, h, x, y, c) {
  const cx = clamp(x, 0, w - 1.001), cy = clamp(y, 0, h - 1.001);
  const x0 = cx | 0, y0 = cy | 0, fx = cx - x0, fy = cy - y0;
  const i00 = (y0 * w + x0) * 4 + c, i10 = i00 + 4, i01 = i00 + w * 4, i11 = i01 + 4;
  return (src[i00] * (1 - fx) + src[i10] * fx) * (1 - fy) + (src[i01] * (1 - fx) + src[i11] * fx) * fy;
}

export function refractBuffer(srcRgba, w, h, state = {}, opts = {}) {
  const medium = opts.glass || 'crown';
  const spread = opts.spread ?? 1.65;
  const gap = opts.gap ?? 18;
  const causticGain = opts.causticStrength ?? 0.55;
  const tintSigma = opts.tintSigma ?? [0.0045, 0.0022, 0.0016];
  const nRgb = channelIor(medium, spread);
  const height = buildRippleGlassHeight(w, h, state, opts);
  const caustic = new Float32Array(w * h);
  const off = new Float32Array(w * h * 6);
  const F = new Float32Array(w * h);
  const pathLen = new Float32Array(w * h);

  for (let y = 0, i = 0; y < h; y++) {
    for (let x = 0; x < w; x++, i++) {
      const N = normalFromHeight(height, w, h, x, y);
      F[i] = fresnel(N[2], 1, nRgb[1]);
      for (let c = 0; c < 3; c++) {
        const s = slabOffset(N, nRgb[c], height[i], gap);
        if (s) {
          off[i * 6 + c * 2] = s.dx;
          off[i * 6 + c * 2 + 1] = s.dy;
          if (c === 1) pathLen[i] = s.path;
        } else if (c === 1) {
          pathLen[i] = -1;
        }
      }
      if (pathLen[i] >= 0) {
        const tx = Math.round(clamp(x + off[i * 6 + 2], 0, w - 1));
        const ty = Math.round(clamp(y + off[i * 6 + 3], 0, h - 1));
        caustic[ty * w + tx] += (1 - F[i]);
      }
    }
  }

  const out = new Uint8ClampedArray(w * h * 4);
  for (let y = 0, i = 0; y < h; y++) {
    for (let x = 0; x < w; x++, i++) {
      const j = i * 4, f = F[i], p = pathLen[i];
      const caust = 1 + causticGain * clamp(caustic[i] - 1, -0.35, 1.4);
      const spec = f * 238;
      for (let c = 0; c < 3; c++) {
        if (p < 0) {
          out[j + c] = Math.round(clamp(spec * 0.9, 0, 255));
        } else {
          const sx = x + off[i * 6 + c * 2], sy = y + off[i * 6 + c * 2 + 1];
          const beer = Math.exp(-tintSigma[c] * p);
          const refr = sampleRgba(srcRgba, w, h, sx, sy, c) * beer * caust;
          out[j + c] = Math.round(clamp((1 - f) * refr + spec, 0, 255));
        }
      }
      out[j + 3] = 255;
    }
  }
  return { rgba: out, caustic, nRgb, height };
}

export function renderGlassWaterLayer(ctx, srcCanvas, state, opts = {}) {
  const W = ctx.canvas.width, H = ctx.canvas.height;
  const sw = opts.workW ?? 192, sh = opts.workH ?? 108;
  const scratch = opts.scratch || (typeof document !== 'undefined' ? document.createElement('canvas') : null);
  if (!scratch) return null;
  scratch.width = sw; scratch.height = sh;
  const sg = scratch.getContext('2d', { willReadFrequently: true });
  sg.drawImage(srcCanvas, 0, 0, sw, sh);
  const img = sg.getImageData(0, 0, sw, sh);
  const res = refractBuffer(img.data, sw, sh, state, opts);
  img.data.set(res.rgba);
  sg.putImageData(img, 0, 0);
  ctx.clearRect(0, 0, W, H);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(scratch, 0, 0, W, H);
  return res;
}

export function glassWaterTransform(input, ctx, digestFn) {
  const src = ctx.inPort === 'frame' ? input : ctx.lastByEnginePort?.get('low-water:frame') || { width: 8, height: 4, lumaGrid: Array(32).fill(128) };
  const w = src.width || 8, h = src.height || 4;
  const rgba = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    const v = src.lumaGrid[i] ?? 128;
    rgba[i * 4] = v; rgba[i * 4 + 1] = v; rgba[i * 4 + 2] = v; rgba[i * 4 + 3] = 255;
  }
  const audio = ctx.inPort === 'audio_features' ? input : ctx.lastByEnginePort?.get('daw:audio_features');
  const res = refractBuffer(rgba, w, h, { time: 0.75, audio: audio || { rms: 0.35, bass: 0.4 } }, { gap: 4, lensHeight: 3 });
  const lumaGrid = [];
  for (let i = 0; i < w * h; i++) {
    lumaGrid.push(Math.round(0.299 * res.rgba[i * 4] + 0.587 * res.rgba[i * 4 + 1] + 0.114 * res.rgba[i * 4 + 2]));
  }
  const pixelsSha256 = digestFn({ width: w, height: h, lumaGrid, source: 'glass-water' });
  return {
    frame: {
      width: w, height: h, lumaGrid, pixelsSha256, transfer: 'srgb-u8', source: 'glass-water',
      nRgb: res.nRgb.map((v) => Number(v.toFixed(4))),
    },
  };
}
