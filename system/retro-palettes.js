/* retro-palettes.js — OKLab color + retro-hardware palettes + auto-palette.

   The color layer under retro-engine.js. Canonical Ottosson OKLab (matches
   coherence-membrane color.py), the historical hardware palettes from
   palettes.py, two ZentropyLabs customs, and a median-cut extractor so any
   image can be pixel-arted in its OWN colors. Zero dependencies. */

// --- OKLab (canonical, Bjorn Ottosson) --------------------------------------
function srgbToLinear(c) { return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
function linearToSrgb(c) { return c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055; }
function clamp01(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }

export function srgbToOklab(r, g, b) {
  const lr = srgbToLinear(r), lg = srgbToLinear(g), lb = srgbToLinear(b);
  const l = 0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb;
  const m = 0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb;
  const s = 0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb;
  const l_ = Math.cbrt(l), m_ = Math.cbrt(m), s_ = Math.cbrt(s);
  return [
    0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_,
    1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_,
    0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_,
  ];
}

export function oklabToSrgb(L, a, b) {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.2914855480 * b;
  const l = l_ * l_ * l_, m = m_ * m_ * m_, s = s_ * s_ * s_;
  return [
    clamp01(linearToSrgb(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s)),
    clamp01(linearToSrgb(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s)),
    clamp01(linearToSrgb(-0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s)),
  ];
}

// --- Palettes (RGB 0..255) --------------------------------------------------
// Hardware values match coherence-membrane palettes.py; pico8 is the canonical
// PICO-8 set; outrun + aurora are ZentropyLabs customs (not historical).
export const RETRO_PALETTES = {
  gameboy: [[15, 56, 15], [48, 98, 48], [139, 172, 15], [155, 188, 15]],
  cga: [[0, 0, 0], [0, 255, 255], [255, 0, 255], [255, 255, 255]],
  ega: [[0, 0, 0], [0, 0, 170], [0, 170, 0], [0, 170, 170], [170, 0, 0], [170, 0, 170],
    [170, 85, 0], [170, 170, 170], [85, 85, 85], [85, 85, 255], [85, 255, 85], [85, 255, 255],
    [255, 85, 85], [255, 85, 255], [255, 255, 85], [255, 255, 255]],
  c64: [[0, 0, 0], [255, 255, 255], [136, 0, 0], [170, 255, 238], [204, 68, 204], [0, 204, 85],
    [0, 0, 170], [238, 238, 119], [221, 136, 85], [102, 68, 0], [255, 119, 119], [51, 51, 51],
    [119, 119, 119], [170, 255, 102], [0, 136, 255], [187, 187, 187]],
  pico8: [[0, 0, 0], [29, 43, 83], [126, 37, 83], [0, 135, 81], [171, 82, 54], [95, 87, 79],
    [194, 195, 199], [255, 241, 232], [255, 0, 77], [255, 163, 0], [255, 236, 39], [0, 228, 54],
    [41, 173, 255], [131, 118, 156], [255, 119, 168], [255, 204, 170]],
  outrun: [[10, 6, 20], [26, 12, 48], [64, 20, 96], [180, 32, 120], [255, 78, 160],
    [255, 138, 96], [80, 220, 240], [244, 236, 255]],
  aurora: [[10, 10, 18], [16, 40, 44], [24, 84, 72], [52, 180, 120], [120, 230, 180],
    [90, 120, 220], [190, 90, 210], [245, 240, 255]],
  nes: [[0, 0, 0], [0, 0, 188], [0, 120, 248], [104, 68, 252], [216, 0, 204], [248, 56, 0],
    [248, 152, 0], [248, 216, 120], [0, 168, 0], [0, 168, 136], [248, 120, 248],
    [124, 124, 124], [188, 188, 188], [236, 238, 236]],
  zx: [[0, 0, 0], [0, 0, 215], [215, 0, 0], [215, 0, 215], [0, 215, 0], [0, 215, 215],
    [215, 215, 0], [215, 215, 215], [0, 0, 255], [255, 0, 0], [255, 0, 255], [0, 255, 0],
    [0, 255, 255], [255, 255, 0], [255, 255, 255]],
  teletext: [[0, 0, 0], [255, 0, 0], [0, 255, 0], [255, 255, 0], [0, 0, 255], [255, 0, 255],
    [0, 255, 255], [255, 255, 255]],
  vboy: [[0, 0, 0], [85, 0, 0], [170, 0, 0], [255, 0, 0]],
  amber: [[8, 5, 0], [78, 44, 0], [178, 108, 12], [255, 186, 84]],
  mono1: [[8, 8, 12], [236, 236, 232]],
};

export function paletteNames() { return Object.keys(RETRO_PALETTES); }

const _labCache = new Map();
export function labPalette(name) {
  if (_labCache.has(name)) return _labCache.get(name);
  const rgb = RETRO_PALETTES[name] || RETRO_PALETTES.gameboy;
  const lab = rgb.map(([r, g, b]) => ({ lab: srgbToOklab(r / 255, g / 255, b / 255), rgb: [r, g, b] }));
  _labCache.set(name, lab);
  return lab;
}

export function nearestIndex(L, a, b, pal) {
  let best = 0, bestD = Infinity;
  for (let i = 0; i < pal.length; i++) {
    const p = pal[i].lab;
    const dL = L - p[0], da = a - p[1], db = b - p[2];
    const d = dL * dL + da * da + db * db;
    if (d < bestD) { bestD = d; best = i; }
  }
  return best;
}

// --- Auto-palette: median-cut in OKLab so any image gets its own palette. ---
function axisRange(box) {
  let lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (const p of box) for (let c = 0; c < 3; c++) { if (p[c] < lo[c]) lo[c] = p[c]; if (p[c] > hi[c]) hi[c] = p[c]; }
  // Weight a/b spread up so hue variety survives against OKLab's compressed chroma.
  const spread = [hi[0] - lo[0], (hi[1] - lo[1]) * 1.6, (hi[2] - lo[2]) * 1.6];
  let axis = 0; if (spread[1] > spread[axis]) axis = 1; if (spread[2] > spread[axis]) axis = 2;
  return { axis, extent: spread[axis] };
}

export function medianCut(labPixels, k) {
  const target = Math.max(2, Math.min(64, k | 0));
  let boxes = [labPixels.slice()];
  while (boxes.length < target) {
    let bi = -1, best = -1;
    for (let i = 0; i < boxes.length; i++) {
      if (boxes[i].length < 2) continue;
      const e = axisRange(boxes[i]).extent;
      if (e > best) { best = e; bi = i; }
    }
    if (bi < 0) break;
    const box = boxes[bi];
    const axis = axisRange(box).axis;
    box.sort((p, q) => p[axis] - q[axis]);
    const mid = box.length >> 1;
    boxes.splice(bi, 1, box.slice(0, mid), box.slice(mid));
  }
  return boxes.filter((b) => b.length).map((box) => {
    let L = 0, a = 0, b = 0;
    for (const p of box) { L += p[0]; a += p[1]; b += p[2]; }
    const n = box.length;
    const lab = [L / n, a / n, b / n];
    const [r, g, bl] = oklabToSrgb(lab[0], lab[1], lab[2]);
    return { lab, rgb: [Math.round(r * 255), Math.round(g * 255), Math.round(bl * 255)] };
  });
}
