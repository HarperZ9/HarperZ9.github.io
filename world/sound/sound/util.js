// Small shared helpers for the sound engine. No dependencies.
export const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
export const cents = (f, c) => f * Math.pow(2, c / 1200);

// Seeded generator (mulberry32) so a render is the same every time.
export function rng(seed = 1) {
  let a = seed >>> 0;
  const r = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  r.range = (lo, hi) => lo + (hi - lo) * r();
  r.pick = (arr) => arr[Math.floor(r() * arr.length)];
  return r;
}

const noiseCache = new WeakMap();
export function noiseBuffer(ctx, kind = 'white', seconds = 2) {
  let m = noiseCache.get(ctx);
  if (!m) noiseCache.set(ctx, (m = {}));
  const key = kind + seconds;
  if (m[key]) return m[key];
  const n = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(1, n, ctx.sampleRate);
  const d = buf.getChannelData(0);
  const r = rng(kind.length * 7919 + 13);
  if (kind === 'white') for (let i = 0; i < n; i++) d[i] = r() * 2 - 1;
  else if (kind === 'brown') {
    let last = 0;
    for (let i = 0; i < n; i++) { last = (last + 0.02 * (r() * 2 - 1)) / 1.02; d[i] = last * 3.5; }
  } else {
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < n; i++) {
      const w = r() * 2 - 1;
      b0 = 0.99765 * b0 + w * 0.099046; b1 = 0.963 * b1 + w * 0.2965164; b2 = 0.57 * b2 + w * 1.0526913;
      d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.2;
    }
  }
  return (m[key] = buf);
}

export function noiseSource(ctx, kind = 'white') {
  const s = ctx.createBufferSource();
  s.buffer = noiseBuffer(ctx, kind);
  s.loop = true;
  return s;
}

// Attack then exponential decay on an AudioParam. Exponential ramps cannot reach 0, so a floor is used.
export function env(param, t, { a = 0.002, peak = 1, d = 0.2, floor = 0.0001 } = {}) {
  param.cancelScheduledValues(t);
  param.setValueAtTime(floor, t);
  param.linearRampToValueAtTime(peak, t + a);
  param.exponentialRampToValueAtTime(floor, t + a + d);
}

export function stopAt(node, t) { try { node.stop(t); } catch (e) { console.warn('stopAt', e); } }

export function tanhCurve(drive, n = 2048) {
  const c = new Float32Array(n), k = Math.max(drive, 0.0001), nrm = Math.tanh(k);
  for (let i = 0; i < n; i++) { const x = (i / (n - 1)) * 2 - 1; c[i] = Math.tanh(k * x) / nrm; }
  return c;
}
export function clipCurve(ceiling = 0.5, n = 2048) {
  const c = new Float32Array(n);
  for (let i = 0; i < n; i++) { const x = (i / (n - 1)) * 2 - 1; c[i] = clamp(x, -ceiling, ceiling) / ceiling; }
  return c;
}
export function foldCurve(drive, n = 4096) {
  const c = new Float32Array(n);
  for (let i = 0; i < n; i++) { const x = ((i / (n - 1)) * 2 - 1) * drive; c[i] = Math.sin(x * Math.PI / 2); }
  return c;
}
export function quantCurve(bits, n = 4097) {
  const c = new Float32Array(n), lv = Math.pow(2, Math.max(1, bits) - 1);
  for (let i = 0; i < n; i++) { const x = (i / (n - 1)) * 2 - 1; c[i] = Math.round(x * lv) / lv; }
  return c;
}
