// weave-thread.js: the pixels of a spun thread, pure and canvas-free so the
// cloth renderer and its Node contracts share one sprite recipe. A thread is a
// cylinder lit from the upper left: a Lambert profile across its width, a
// specular crest, a helical Z-twist of darker fibre bands along its length,
// and a grain of fibre fuzz. Tiles repeat along the thread, so one tile per
// colour, width, and orientation serves every float in the cloth.

// Light direction across the thread and out of the cloth, and the half vector
// between that light and a viewer looking straight down.
const LX = -0.42, LZ = 0.91;
const HL = Math.hypot(LX, LZ + 1);
const HX = LX / HL, HZ = (LZ + 1) / HL;

export function hexToRgb(hex) {
  const v = parseInt(String(hex).replace("#", ""), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

// Shading at one point across the thread. n runs -1..1 edge to edge.
export function threadShade(n) {
  const nz = Math.sqrt(Math.max(0, 1 - n * n));
  const lam = Math.max(0, n * LX + nz * LZ);
  const spec = Math.pow(Math.max(0, n * HX + nz * HZ), 28);
  return { diffuse: 0.2 + 0.8 * lam, spec };
}

// Twist bands: two dark helical bands per pitch, leaning with the position
// across the thread so they read as a Z-twist. Both inputs run 0..1.
export function twistBand(along, across) {
  return 0.5 + 0.5 * Math.sin(Math.PI * 2 * (along * 2 + across * 0.6));
}

const grain = (x, y) => {
  const s = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
  return s - Math.floor(s);
};

// Tile length along the thread: one twist pitch.
export function tilePitch(t) {
  return Math.max(4, Math.round(t * 1.7));
}

// The tile: t pixels across the thread and one pitch along it. Hairline
// threads (3 px) carry no twist texture, which would only read as noise.
export function threadTilePixels(rgb, t, vertical, sheen = 0.65) {
  const pitch = tilePitch(t);
  const w = vertical ? t : pitch, h = vertical ? pitch : t;
  const data = new Uint8ClampedArray(w * h * 4);
  const amp = Math.min(1, Math.max(0, (t - 3) / 6));
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const across = vertical ? x : y, along = vertical ? y : x;
    const { diffuse, spec } = threadShade(((across + 0.5) / t) * 2 - 1);
    const band = twistBand(along / pitch, (across + 0.5) / t);
    const lit = diffuse * (1 - amp * (0.28 * band + 0.06 * grain(x, y)));
    // The gleam lifts toward white without saturating, so the twist stays
    // visible through the crest on pale threads.
    const gleam = spec * sheen * 0.5;
    const i = (y * w + x) * 4;
    for (let c = 0; c < 3; c++) {
      const v = rgb[c] * lit;
      data[i + c] = v + (255 - v) * gleam;
    }
    data[i + 3] = 255;
  }
  return { w, h, data };
}

// Alpha of the dive shadow i pixels in from a float end, over len pixels.
export function diveAlpha(i, len) {
  const u = Math.max(0, Math.min(1, i / len));
  return 0.5 * Math.pow(1 - u, 1.8);
}

// A float end darkening as the thread goes under the crossing thread. The
// start sprite shades its first rows (or columns); atEnd mirrors it.
export function diveSpritePixels(t, len, vertical, atEnd) {
  const w = vertical ? t : len, h = vertical ? len : t;
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const k = vertical ? y : x;
    data[(y * w + x) * 4 + 3] = Math.round(255 * diveAlpha(atEnd ? len - 1 - k : k, len));
  }
  return { w, h, data };
}

// Luster along a float: a white sheen that peaks at mid-span and on the crest,
// the cue that makes a long satin float read brighter than a plain-weave one.
export function lusterPixels(t, len, vertical, peak) {
  const w = vertical ? t : len, h = vertical ? len : t;
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const along = (vertical ? y : x) / (len - 1);
    const across = (((vertical ? x : y) + 0.5) / t) * 2 - 1;
    const a = peak * Math.pow(Math.sin(Math.PI * along), 2) * Math.max(0, 1 - across * across);
    const i = (y * w + x) * 4;
    data[i] = 255; data[i + 1] = 255; data[i + 2] = 255;
    data[i + 3] = Math.round(255 * a);
  }
  return { w, h, data };
}
