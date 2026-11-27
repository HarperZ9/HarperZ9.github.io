// layer-elements-palette.mjs: Measured-color OKLab periodic swatch table, Kubelka-Munk
// pigment glaze optics, and live material-LUT grader for Unified /playground/ Studio (Wave 33A-1).
// Reuses exact OKLab and Kubelka-Munk two-flux equations from world/site/surfaces/km.mjs.

export const LAYER_META = Object.freeze({
  id: 'elements',
  name: 'Elements OKLab Palette & LUT',
  discipline: 'Paint, Pigment, Glass, Film & Shaders',
  route: 'Distill -> Elements -> All Layers',
  takes: ['palette', 'frame', 'audio_features'],
  gives: ['palette', 'frame'],
  defaultOn: true,
  defaultOpacity: 0.44,
  defaultBlend: 'overlay',
});

export const PAPER = Object.freeze([0.80, 0.765, 0.67]);
const FLOOR = 1e-4;
const clamp = (x, lo = 0, hi = 1) => (x < lo ? lo : x > hi ? hi : x);
const hex2 = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');

export const srgbToLin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
export const linToSrgb = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);
export const linToHex = (lin) => '#' + lin.map((c) => hex2(linToSrgb(clamp(c, 0, 1)) * 255)).join('');

export function hexToLin(hex) {
  const h = String(hex || '#132a3a').replace(/^#/, '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h.padEnd(6, '0');
  return [0, 2, 4].map((o) => srgbToLin(parseInt(full.slice(o, o + 2), 16) / 255));
}

// Bjorn Ottosson exact OKLab forward & inverse transforms
export function linToOklab([r, g, b]) {
  const l = Math.cbrt(Math.max(0, 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b));
  const m = Math.cbrt(Math.max(0, 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b));
  const s = Math.cbrt(Math.max(0, 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b));
  return [
    Number((0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s).toFixed(5)),
    Number((1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s).toFixed(5)),
    Number((0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s).toFixed(5)),
  ];
}

export function oklabToLin([L, A, B], chroma = 1) {
  const a = A * chroma, b = B * chroma;
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.2914855480 * b) ** 3;
  return [
    clamp(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    clamp(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    clamp(-0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s),
  ];
}

export const hexToOklab = (hex) => linToOklab(hexToLin(hex));
export const oklabToHex = (ok, chroma = 1) => linToHex(oklabToLin(ok, chroma));

// Kubelka-Munk two-flux pigment inversion and stacking (Curtis 1997 / km.mjs)
export function pigmentKS(lin, opacity = 0.42) {
  const o = clamp(opacity, 0, 0.92), K = [], S = [];
  for (let c = 0; c < 3; c++) {
    const Rw = clamp(lin[c], 0.02, 0.97);
    if (o < 0.005) { K.push(-Math.log(Rw) / 2); S.push(0); continue; }
    const Rb = o * Rw, a = 0.5 * (Rw + (Rb - Rw + 1) / Rb), b = Math.sqrt(Math.max(0, a * a - 1));
    const x = (b * b - (a - Rw) * (a - 1)) / Math.max(1e-6, b * (1 - Rw));
    const s = Math.log(Math.max(1.0001, (x + 1) / Math.max(1e-6, x - 1))) / Math.max(1e-6, 2 * b);
    S.push(s); K.push(s * (a - 1));
  }
  return { K, S, opacity: o };
}

export function kmLayer(p, d = 1) {
  const R = [], T = [];
  for (let c = 0; c < 3; c++) {
    const k = Math.max(p.K[c], FLOOR), s = Math.max(p.S[c], FLOOR);
    const a = 1 + k / s, b = Math.sqrt(Math.max(0, a * a - 1)), x = b * s * d;
    const e = Math.exp(-2 * x), den = a * (1 - e) + b * (1 + e);
    R.push((1 - e) / den); T.push((2 * b * Math.exp(-x)) / den);
  }
  return { R, T };
}

export function kmGlaze(topLin, underLin, topOp = 0.45, underOp = 0.52, ground = PAPER) {
  const layers = [kmLayer(pigmentKS(underLin, underOp), 1), kmLayer(pigmentKS(topLin, topOp), 1)];
  let R = [...ground];
  for (const L of layers) R = L.R.map((r, c) => r + (L.T[c] ** 2 * R[c]) / Math.max(1e-6, 1 - r * R[c]));
  return R.map((v) => clamp(v, 0, 1));
}

// Curated Elements & Swatches periodic table entries
export const PERIODIC_SWATCHES = Object.freeze([
  { id: 'estuary-teal', group: 'water', hex: '#132a3a', opacity: 0.48 },
  { id: 'slate-water', group: 'water', hex: '#2b5f73', opacity: 0.40 },
  { id: 'ochre-earth', group: 'earth', hex: '#d79e35', opacity: 0.62 },
  { id: 'salt-paper', group: 'ground', hex: '#ece5d6', opacity: 0.30 },
  { id: 'cinnabar-ink', group: 'pigment', hex: '#9b3a33', opacity: 0.68 },
  { id: 'indigo-loom', group: 'dye', hex: '#2f456e', opacity: 0.56 },
  { id: 'cobalt-glaze', group: 'glass', hex: '#4379a6', opacity: 0.34 },
  { id: 'iron-gall', group: 'ink', hex: '#22211e', opacity: 0.78 },
]);

export function buildMaterialPalette(swatchIds = ['estuary-teal', 'slate-water', 'ochre-earth', 'salt-paper'], chroma = 1.0) {
  const chosen = swatchIds.map((id) => PERIODIC_SWATCHES.find((s) => s.id === id) || PERIODIC_SWATCHES[0]);
  const oklab = chosen.map((s) => hexToOklab(s.hex));
  const hex = oklab.map((ok) => oklabToHex(ok, chroma));
  const glazeLin = kmGlaze(hexToLin(hex[2] || hex[0]), hexToLin(hex[1] || hex[0]), chosen[2]?.opacity ?? 0.5, chosen[1]?.opacity ?? 0.4);
  return { oklab, hex, mix: linToHex(glazeLin), ground: hex[0], swatchIds: chosen.map((s) => s.id) };
}

// Grade RGBA buffer toward a 4-stop OKLab material LUT by luminance
export function gradeRgbaWithPalette(rgba, palette, strength = 0.55) {
  const stops = (palette?.oklab?.length >= 2 ? palette.oklab : buildMaterialPalette().oklab)
    .slice()
    .sort((a, b) => a[0] - b[0]);
  const out = new Uint8ClampedArray(rgba.length);
  const st = clamp(strength, 0, 1);
  for (let i = 0; i < rgba.length; i += 4) {
    const lin = [srgbToLin(rgba[i] / 255), srgbToLin(rgba[i + 1] / 255), srgbToLin(rgba[i + 2] / 255)];
    const [L, a, b] = linToOklab(lin);
    const pos = clamp(L, 0, 1) * (stops.length - 1);
    const lo = Math.floor(pos), hi = Math.min(stops.length - 1, lo + 1), f = pos - lo;
    const tA = stops[lo][1] + (stops[hi][1] - stops[lo][1]) * f;
    const tB = stops[lo][2] + (stops[hi][2] - stops[lo][2]) * f;
    const graded = oklabToLin([L, a + (tA - a) * st, b + (tB - b) * st], 1);
    out[i] = Math.round(linToSrgb(graded[0]) * 255);
    out[i + 1] = Math.round(linToSrgb(graded[1]) * 255);
    out[i + 2] = Math.round(linToSrgb(graded[2]) * 255);
    out[i + 3] = rgba[i + 3];
  }
  return out;
}

export function renderElementsPaletteLayer(ctx, srcCanvas, state = {}, opts = {}) {
  const W = ctx.canvas.width, H = ctx.canvas.height;
  const pal = opts.palette || buildMaterialPalette(opts.swatchIds, 0.9 + clamp(state.audio?.rms ?? 0.3) * 0.3);
  if (srcCanvas && typeof document !== 'undefined') {
    const sw = 160, sh = 90, sc = opts.scratch || document.createElement('canvas');
    sc.width = sw; sc.height = sh;
    const sg = sc.getContext('2d', { willReadFrequently: true });
    sg.drawImage(srcCanvas, 0, 0, sw, sh);
    const img = sg.getImageData(0, 0, sw, sh);
    img.data.set(gradeRgbaWithPalette(img.data, pal, opts.strength ?? 0.62));
    sg.putImageData(img, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(sc, 0, 0, W, H);
  }
  // Render minimal periodic swatch strip along top-right corner
  const pad = 12, swW = 24, swH = 12;
  for (let i = 0; i < pal.hex.length; i++) {
    ctx.fillStyle = pal.hex[i];
    ctx.fillRect(W - pad - (pal.hex.length - i) * (swW + 4), pad, swW, swH);
  }
  return pal;
}

export function elementsPaletteTransform(input, ctx, digestFn) {
  const base = ctx.inPort === 'palette' && input?.oklab?.length ? input : buildMaterialPalette();
  const audio = ctx.inPort === 'audio_features' ? input : ctx.lastByEnginePort?.get('daw:audio_features');
  const chroma = 0.9 + clamp(audio?.rms ?? 0.3) * 0.35;
  const oklab = base.oklab.map(([L, a, b]) => [L, Number((a * chroma).toFixed(4)), Number((b * chroma).toFixed(4))]);
  const hex = oklab.map((ok) => oklabToHex(ok, 1));
  const glazeHex = linToHex(kmGlaze(hexToLin(hex[hex.length - 1]), hexToLin(hex[0])));
  const palette = { oklab, hex, mix: glazeHex, ground: hex[0] };
  const lumaGrid = Array.from({ length: 32 }, (_, i) => Math.round(clamp(oklab[i % oklab.length][0]) * 255));
  return {
    palette,
    frame: {
      width: 8, height: 4, lumaGrid,
      pixelsSha256: digestFn({ width: 8, height: 4, lumaGrid, source: 'elements' }),
      transfer: 'srgb-u8', source: 'elements',
    },
  };
}
