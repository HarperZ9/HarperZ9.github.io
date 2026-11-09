// The committed frame set for post-pass checks (M1 exit criteria 9 and 10): 960 x 600,
// linear RGBA in Float32Array rows, made by fixed rules and a fixed seed so every run
// and every machine sees the same values.
//   ramp      horizontal grey ramp 0..4 (above display white) over vertical hue bands
//   edges     one-pixel lines, a checkerboard, a disc and small text-like blocks at 0..1
//   noise     uniform noise from a seeded xorshift, 0..1.5
//   bars      SMPTE-like colour bars with a black-to-white step wedge
// toHalf and fromHalf convert to and from the rgba16float texels the GPU reads.

export const W = 960, H = 600;

function xorshift(seed) {
  let x = seed >>> 0 || 1;
  return () => { x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0; return x / 4294967296; };
}

const frames = {
  ramp(x, y) {
    const g = (x / (W - 1)) * 4, band = Math.floor((y / H) * 6);
    const tint = [[1, 1, 1], [1, 0.3, 0.2], [0.3, 1, 0.3], [0.2, 0.4, 1], [1, 1, 0.2], [0.8, 0.2, 1]][band];
    return [g * tint[0], g * tint[1], g * tint[2], 1];
  },
  edges(x, y) {
    if (x % 64 === 0 || y % 64 === 0) return [1, 1, 1, 1];
    if (x < 320 && y < 300) return ((x >> 3) + (y >> 3)) % 2 ? [0.9, 0.9, 0.85, 1] : [0.05, 0.05, 0.08, 1];
    if (Math.hypot(x - 640, y - 300) < 140) return [0.9, 0.55, 0.4, 1];
    if (y > 420 && (x >> 2) % 5 < 3 && (y >> 2) % 4 < 2) return [0.92, 0.9, 0.84, 1];
    return [0.1, 0.12, 0.16, 1];
  },
  bars(x, y) {
    const bars = [[0.75, 0.75, 0.75], [0.75, 0.75, 0], [0, 0.75, 0.75], [0, 0.75, 0], [0.75, 0, 0.75], [0.75, 0, 0], [0, 0, 0.75]];
    if (y < 400) { const c = bars[Math.floor((x / W) * 7)]; return [...c, 1]; }
    const v = Math.floor((x / W) * 11) / 10;
    return [v, v, v, 1];
  },
};

export function frameSet() {
  const names = ["ramp", "edges", "noise", "bars"], data = [];
  for (const n of names) {
    const a = new Float32Array(W * H * 4);
    if (n === "noise") { const r = xorshift(0x9e3779b9); for (let i = 0; i < a.length; i++) a[i] = i % 4 === 3 ? 1 : r() * 1.5; }
    else for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) a.set(frames[n](x, y), 4 * (y * W + x));
    data.push(a);
  }
  return { width: W, height: H, names, data };
}

// IEEE half floats, round to nearest even.
const f32 = new Float32Array(1), u32 = new Uint32Array(f32.buffer);
export function toHalf(a) {
  const out = new Uint16Array(a.length);
  for (let i = 0; i < a.length; i++) {
    f32[0] = a[i];
    const x = u32[0], sign = (x >>> 16) & 0x8000, exp = (x >>> 23) & 0xff, man = x & 0x7fffff;
    let h;
    if (exp === 0xff) h = sign | 0x7c00 | (man ? 0x200 : 0);
    else {
      const e = exp - 127 + 15;
      if (e >= 0x1f) h = sign | 0x7c00;
      else if (e <= 0) {
        if (e < -10) h = sign;
        else {
          const m = man | 0x800000, shift = 14 - e, r = m >>> shift, rem = m & ((1 << shift) - 1), half = 1 << (shift - 1);
          h = sign | (r + (rem > half || (rem === half && (r & 1)) ? 1 : 0));
        }
      } else {
        const r = (e << 10) | (man >>> 13), rem = man & 0x1fff;
        h = sign | (r + (rem > 0x1000 || (rem === 0x1000 && (r & 1)) ? 1 : 0));
      }
    }
    out[i] = h;
  }
  return out;
}
export function fromHalf(h) {
  const out = new Float32Array(h.length);
  for (let i = 0; i < h.length; i++) {
    const v = h[i], s = v & 0x8000 ? -1 : 1, e = (v >> 10) & 31, f = v & 1023;
    out[i] = e === 0 ? s * f * 2 ** -24 : e === 31 ? (f ? NaN : s * Infinity) : s * (1 + f / 1024) * 2 ** (e - 15);
  }
  return out;
}
