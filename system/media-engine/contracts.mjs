// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Zain Dana Harper
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in all
// copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.
//
// Algorithms by others, each under terms that allow this file's MIT licence:
//   mulberry32: Tommy Ettinger, 2017, CC0 1.0 public domain dedication.
//   xmur3: bryc (github.com/bryc/code), public domain, MIT fallback,
//     Copyright (c) 2024 bryc.
//   OKLab matrices: Bjorn Ottosson, 2020, public domain, MIT fallback.
//   K-weighting constants for rates other than 48 kHz: as published in
//     libebur128 (MIT); the 48 kHz table is ITU-R BS.1770-4's.
// Sources and dates: docs/LICENSING.md in the superstack repository.
// superstack contract v0, JavaScript implementation. No dependencies; an ES module
// for browsers and Node 20+. Same rules as superstack.py and superstack.hpp; all
// three must pass every file in vectors/. Bytes are Uint8Array throughout.

export const CONTRACT = 'superstack/0';
export const VERSION = '0.1.0';
export const RECEIPT_SCHEMA = 'superstack.receipt/1';
export const SCENE_KINDS = Object.freeze(['superstack.scene/1', 'superstack.sound/1']);
const MAX_SAFE = Number.MAX_SAFE_INTEGER;

// ---------------------------------------------------------------- canonical JSON v2

export function positional(sign, intPart, frac, exp) {
  let digits = intPart + frac;
  let point = intPart.length + exp;
  const stripped = digits.replace(/^0+/, '');
  point -= digits.length - stripped.length;
  digits = stripped.replace(/0+$/, '');
  if (!digits) return '0';
  let body;
  if (point <= 0) body = '0.' + '0'.repeat(-point) + digits;
  else if (point >= digits.length) body = digits + '0'.repeat(point - digits.length);
  else body = digits.slice(0, point) + '.' + digits.slice(point);
  return sign + body;
}

export function canonicalNumber(x) {
  if (typeof x === 'bigint') {
    if (x > BigInt(MAX_SAFE) || x < -BigInt(MAX_SAFE)) throw new RangeError('integer outside the safe range');
    return x.toString();
  }
  if (typeof x !== 'number') throw new TypeError('not a number');
  if (!Number.isFinite(x)) throw new RangeError('non-finite number');
  if (x === 0) return '0';
  const m = /^(-?)(\d+)(?:\.(\d+))?(?:e([+-]?\d+))?$/.exec(String(x));
  return positional(m[1], m[2], m[3] || '', Number(m[4] || 0));
}

const ESC = { '"': '\\"', '\\': '\\\\', '\b': '\\b', '\f': '\\f', '\n': '\\n', '\r': '\\r', '\t': '\\t' };

function checkScalars(s) {
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c >= 0xd800 && c <= 0xdbff) {
      const d = s.charCodeAt(i + 1);
      if (!(d >= 0xdc00 && d <= 0xdfff)) throw new RangeError('lone surrogate');
      i++;
    } else if (c >= 0xdc00 && c <= 0xdfff) throw new RangeError('lone surrogate');
  }
}

export function canonicalString(s) {
  checkScalars(s);
  let out = '"';
  for (const ch of s) {
    const c = ch.codePointAt(0);
    if (ESC[ch]) out += ESC[ch];
    else if (c < 0x20) out += '\\u' + c.toString(16).padStart(4, '0');
    else out += ch;
  }
  return out + '"';
}

const utf8 = (s) => new TextEncoder().encode(s);

function byCodePoint(a, b) {
  const x = utf8(a), y = utf8(b);
  const n = Math.min(x.length, y.length);
  for (let i = 0; i < n; i++) if (x[i] !== y[i]) return x[i] - y[i];
  return x.length - y.length;
}

export function canonical(v) {
  if (v === null) return 'null';
  if (v === true) return 'true';
  if (v === false) return 'false';
  if (typeof v === 'number' || typeof v === 'bigint') return canonicalNumber(v);
  if (typeof v === 'string') return canonicalString(v);
  if (Array.isArray(v)) return '[' + v.map(canonical).join(',') + ']';
  if (typeof v === 'object' && Object.getPrototypeOf(v) === Object.prototype || (typeof v === 'object' && Object.getPrototypeOf(v) === null)) {
    const keys = Object.keys(v).sort(byCodePoint);
    return '{' + keys.map((k) => canonicalString(k) + ':' + canonical(v[k])).join(',') + '}';
  }
  throw new TypeError('cannot canonicalize ' + typeof v);
}

export const canonicalBytes = (v) => utf8(canonical(v));

// SHA-256 (FIPS 180-4), synchronous so it runs the same in every host.
const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

export function sha256(bytes) {
  const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const len = data.length;
  const padded = new Uint8Array(((len + 9 + 63) >> 6) << 6);
  padded.set(data);
  padded[len] = 0x80;
  const dv = new DataView(padded.buffer);
  dv.setUint32(padded.length - 8, Math.floor(len / 0x20000000), false);
  dv.setUint32(padded.length - 4, (len * 8) >>> 0, false);
  const H = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]);
  const W = new Uint32Array(64);
  const rotr = (x, n) => (x >>> n) | (x << (32 - n));
  for (let off = 0; off < padded.length; off += 64) {
    for (let i = 0; i < 16; i++) W[i] = dv.getUint32(off + i * 4, false);
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(W[i - 15], 7) ^ rotr(W[i - 15], 18) ^ (W[i - 15] >>> 3);
      const s1 = rotr(W[i - 2], 17) ^ rotr(W[i - 2], 19) ^ (W[i - 2] >>> 10);
      W[i] = (W[i - 16] + s0 + W[i - 7] + s1) >>> 0;
    }
    let [a, b, c, d, e, f, g, h] = H;
    for (let i = 0; i < 64; i++) {
      const t1 = (h + (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) + ((e & f) ^ (~e & g)) + K[i] + W[i]) >>> 0;
      const t2 = ((rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) >>> 0;
      h = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
    }
    H[0] += a; H[1] += b; H[2] += c; H[3] += d; H[4] += e; H[5] += f; H[6] += g; H[7] += h;
  }
  return [...H].map((x) => x.toString(16).padStart(8, '0')).join('');
}

export const sha256Hex = (bytes) => sha256(bytes);
export const canonicalSha256 = (v) => sha256(canonicalBytes(v));

// ---------------------------------------------------------------- seed rule

export const SEED_RULE = 'xmur3-mulberry32/1';
export const SEED_RULES = Object.freeze([SEED_RULE, 'raw-pixel-hash/1', 'fnv1a32-mulberry32', 'studio-engine-lcg/1', 'splitmix-fnv/1']);

export function xmur3(s) {
  checkScalars(s);
  let h = 1779033703 ^ s.length;
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(h ^ s.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^ (h >>> 16)) >>> 0;
}

export class Mulberry32 {
  constructor(seedU32) { this.a = seedU32 >>> 0; }
  nextU32() {
    this.a = (this.a + 0x6d2b79f5) >>> 0;
    let t = this.a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t = (t + Math.imul(t ^ (t >>> 7), t | 61)) ^ t;
    return (t ^ (t >>> 14)) >>> 0;
  }
  nextFloat() { return this.nextU32() / 4294967296; }
}

export const rng = (seed) => new Mulberry32(xmur3(seed));
export const substream = (seed, tag) => seed + '/' + tag;

export function pixelHash(x, y, s) {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(s, 2246822519 | 0)) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (h ^ (h >>> 16)) >>> 0;
}
export const pixelHash01 = (x, y, s) => (pixelHash(x, y, s) & 0xffffff) / 16777216;

// ---------------------------------------------------------------- flick clock

export const FLICKS_PER_SECOND = 705600000;
export const SAMPLE_RATES = Object.freeze([8000, 11025, 16000, 22050, 32000, 44100, 48000, 88200, 96000, 176400, 192000]);

export function flicksPerFrame(num, den = 1) {
  if (!(num > 0 && den > 0) || !Number.isInteger(num) || !Number.isInteger(den)) throw new RangeError('frame rate must be positive');
  if ((FLICKS_PER_SECOND * den) % num) throw new RangeError(`${num}/${den} fps does not divide the flick clock`);
  return (FLICKS_PER_SECOND * den) / num;
}

export function flicksPerSample(rate) {
  if (!(rate > 0) || !Number.isInteger(rate) || FLICKS_PER_SECOND % rate) throw new RangeError(`rate ${rate} does not divide the flick clock`);
  return FLICKS_PER_SECOND / rate;
}

export const round6 = (x) => (x === null || x === undefined ? null : Math.floor(x * 1e6 + 0.5) / 1e6);

// ---------------------------------------------------------------- colour

export const srgbToLinear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
export const linearToSrgb = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);

export function linearSrgbToOklab(r, g, b) {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s];
}

export function oklabToLinearSrgb(L, a, b) {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.2914855480 * b;
  const l = l_ * l_ * l_, m = m_ * m_ * m_, s = s_ * s_ * s_;
  return [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s];
}

export function hexToSrgb8(hex) {
  const h = hex.replace(/^#/, '');
  if (!/^[0-9a-fA-F]{6}$/.test(h)) throw new RangeError('expected #rrggbb');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
}

export const hexToOklab = (hex) => linearSrgbToOklab(...hexToSrgb8(hex).map((c) => srgbToLinear(c / 255)));

export function contrastRatio(a, b) {
  const lum = (h) => { const [r, g, bl] = hexToSrgb8(h).map((c) => srgbToLinear(c / 255)); return 0.2126 * r + 0.7152 * g + 0.0722 * bl; };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

export const RISK_LEVELS = Object.freeze(['low', 'moderate', 'elevated', 'high']);
export const RISK_TOKENS = Object.freeze({
  light: Object.freeze({ low: '#186844', moderate: '#5c5a66', elevated: '#8f5200', high: '#b3261e', ink: '#15130f', quiet: '#5d584e' }),
  dark: Object.freeze({ low: '#8fdc8a', moderate: '#a9a6b4', elevated: '#f0a848', high: '#ff7a6b', ink: '#ebe5d8', quiet: '#9d978a' }),
});
export const RISK_GROUNDS = Object.freeze({ light: Object.freeze(['#f4f3ef', '#ebe5d8', '#f2efe6']), dark: Object.freeze(['#060608', '#070406', '#1d1622']) });
const VERDICT_TO_RISK = Object.freeze({
  MATCH: 'low', VERIFIED: 'low', PASS: 'low', OK: 'low',
  UNVERIFIABLE: 'moderate', UNKNOWN: 'moderate', PENDING: 'moderate',
  DRIFT: 'elevated', WARN: 'elevated', STALE: 'elevated', REFUTED: 'high',
  FAIL: 'high', FAILED: 'high', REFUSED: 'high', ERROR: 'high', BROKEN: 'high',
});

export function riskOf(verdict) {
  if (RISK_LEVELS.includes(verdict)) return verdict;
  return VERDICT_TO_RISK[String(verdict || '').trim().toUpperCase()] || 'moderate';
}

export function hotMark(levels) {
  let best = -1, rank = -1;
  levels.forEach((lv, i) => { const r = RISK_LEVELS.indexOf(riskOf(lv)); if (r > rank) { rank = r; best = i; } });
  return best;
}

// ---------------------------------------------------------------- sound forms

export function quantizeS16(samples) {
  const out = new Uint8Array(samples.length * 2);
  const dv = new DataView(out.buffer);
  for (let i = 0; i < samples.length; i++) {
    const v = Math.max(-1, Math.min(1, samples[i]));
    dv.setInt16(i * 2, Math.floor(v * 32767 + 0.5), true);
  }
  return out;
}

export function s16ToFloats(pcm) {
  const dv = new DataView(pcm.buffer, pcm.byteOffset, pcm.byteLength);
  return Array.from({ length: pcm.length >> 1 }, (_, i) => dv.getInt16(i * 2, true) / 32767);
}

export function wavS16(pcm, rate, channels) {
  const out = new Uint8Array(44 + pcm.length);
  const dv = new DataView(out.buffer);
  const tag = (o, s) => { for (let i = 0; i < 4; i++) out[o + i] = s.charCodeAt(i); };
  tag(0, 'RIFF'); dv.setUint32(4, 36 + pcm.length, true); tag(8, 'WAVE'); tag(12, 'fmt ');
  dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, channels, true);
  dv.setUint32(24, rate, true); dv.setUint32(28, rate * channels * 2, true);
  dv.setUint16(32, channels * 2, true); dv.setUint16(34, 16, true); tag(36, 'data'); dv.setUint32(40, pcm.length, true);
  out.set(pcm, 44);
  return out;
}

function pnm(magic, body, w, h) {
  const hdr = utf8(`${magic}\n${w} ${h}\n255\n`);
  const out = new Uint8Array(hdr.length + body.length);
  out.set(hdr); out.set(body, hdr.length);
  return out;
}
export const ppmRgb8 = (rgb, w, h) => pnm('P6', rgb, w, h);
export const pgmU8 = (gray, w, h) => pnm('P5', gray, w, h);

export const METER = 'superstack-bs1770/1';
const K48 = [[1.53512485958697, -2.69169618940638, 1.19839281085285, -1.69065929318241, 0.73248077421585],
  [1.0, -2.0, 1.0, -1.99004745483398, 0.99007225036621]];

export function kWeighting(rate) {
  if (rate === 48000) return K48;
  let k = Math.tan(Math.PI * 1681.974450955533 / rate);
  let q = 0.7071752369554196;
  const vh = 10 ** (3.999843853973347 / 20);
  const vb = vh ** 0.4996667741545416;
  let a0 = 1 + k / q + k * k;
  const shelf = [(vh + vb * k / q + k * k) / a0, 2 * (k * k - vh) / a0, (vh - vb * k / q + k * k) / a0,
    2 * (k * k - 1) / a0, (1 - k / q + k * k) / a0];
  k = Math.tan(Math.PI * 38.13547087602444 / rate);
  q = 0.5003270373238773;
  a0 = 1 + k / q + k * k;
  return [shelf, [1, -2, 1, 2 * (k * k - 1) / a0, (1 - k / q + k * k) / a0]];
}

function biquad(x, [b0, b1, b2, a1, a2]) {
  const y = new Float64Array(x.length);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const v = x[i];
    const o = b0 * v + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1; x1 = v; y2 = y1; y1 = o; y[i] = o;
  }
  return y;
}

const loud = (p) => (p > 0 ? -0.691 + 10 * Math.log10(p) : -Infinity);

export function integratedLufs(samples, rate, channels = 1) {
  if (!(channels === 1 || channels === 2) || !SAMPLE_RATES.includes(rate) || rate % 10) return null;
  const filt = kWeighting(rate);
  const chans = [];
  for (let c = 0; c < channels; c++) {
    const xs = [];
    for (let i = c; i < samples.length; i += channels) xs.push(samples[i]);
    chans.push(biquad(biquad(xs, filt[0]), filt[1]));
  }
  const n = chans[0].length, block = (rate * 4) / 10, hop = rate / 10;
  const powers = [];
  for (let i = 0; i + block <= n; i += hop) {
    let p = 0;
    for (const z of chans) {
      let acc = 0;
      for (let j = i; j < i + block; j++) acc += z[j] * z[j];
      p += acc / block;
    }
    powers.push(p);
  }
  const gated = powers.filter((p) => loud(p) > -70);
  if (!gated.length) return null;
  let acc = 0;
  for (const p of gated) acc += p;
  const rel = loud(acc / gated.length) - 10;
  const fin = gated.filter((p) => loud(p) > rel);
  acc = 0;
  for (const p of fin) acc += p;
  return loud(acc / fin.length);
}

export function peakDbfs(samples) {
  let peak = 0;
  for (const v of samples) peak = Math.max(peak, Math.abs(v));
  return peak > 0 ? 20 * Math.log10(peak) : null;
}

export const LOUDNESS_TARGETS = Object.freeze({
  speech: Object.freeze({ integrated_lufs: -16, tolerance_lu: 1, true_peak_dbtp_max: -1.5 }),
  music: Object.freeze({ integrated_lufs: -14, tolerance_lu: 1, true_peak_dbtp_max: -1 }),
  interactive: Object.freeze({ integrated_lufs_max: -18, sample_peak_dbfs_max: -1 }),
});

export function loudnessCheck(cls, lufs, peak) {
  const t = Object.prototype.hasOwnProperty.call(LOUDNESS_TARGETS, cls) ? LOUDNESS_TARGETS[cls] : null;
  if (!t || lufs === null || peak === null) return 'unverifiable';
  const ok = cls === 'interactive'
    ? lufs <= t.integrated_lufs_max && peak <= t.sample_peak_dbfs_max
    : Math.abs(lufs - t.integrated_lufs) <= t.tolerance_lu && peak <= t.true_peak_dbtp_max;
  return ok ? 'verified' : 'refuted';
}

// ---------------------------------------------------------------- reconcile

export const PCM_TOLERANCE = Object.freeze({ max_abs_lsb: 2, min_snr_db: 60 });
export const RGB8_TOLERANCE = Object.freeze({ mean_abs_max: 1 });
export const identity = (refSha, candSha) => (refSha === candSha ? 'MATCH' : 'DRIFT');

function block(rs, cs, verdict, metrics, bounds, reason) {
  const out = { identity: identity(rs, cs), tolerance: { verdict, metrics, bounds: { ...bounds } } };
  if (reason) out.tolerance.reason = reason;
  return out;
}

export function reconcilePcmS16(ref, cand, tol = PCM_TOLERANCE) {
  const rs = sha256(ref), cs = sha256(cand);
  if (ref.length !== cand.length || ref.length % 2) return block(rs, cs, 'unverifiable', {}, tol, 'length differs from the reference');
  const n = ref.length / 2;
  const dr = new DataView(ref.buffer, ref.byteOffset, ref.byteLength), dc = new DataView(cand.buffer, cand.byteOffset, cand.byteLength);
  let sig = 0, err = 0, maxD = 0, exact = 0;
  for (let i = 0; i < n; i++) {
    const r = dr.getInt16(2 * i, true), d = dc.getInt16(2 * i, true) - r;
    sig += r * r; err += d * d;
    maxD = Math.max(maxD, Math.abs(d)); if (d === 0) exact++;
  }
  const snr = err === 0 ? null : (sig > 0 ? 10 * Math.log10(sig / err) : -Infinity);
  const metrics = { max_abs_lsb: maxD, exact_frac: n ? exact / n : 1, snr_db: snr === null ? null : (Number.isFinite(snr) ? round6(snr) : null) };
  const ok = maxD <= tol.max_abs_lsb && (snr === null || snr >= tol.min_snr_db);
  return block(rs, cs, ok ? 'verified' : 'refuted', metrics, tol);
}

export function reconcileRgb8(ref, cand, tol = RGB8_TOLERANCE) {
  const rs = sha256(ref), cs = sha256(cand);
  if (ref.length !== cand.length || ref.length % 3 || !ref.length) return block(rs, cs, 'unverifiable', {}, tol, 'size differs from the reference');
  let total = 0, maxD = 0, exactPx = 0;
  for (let p = 0; p < ref.length / 3; p++) {
    let worst = 0;
    for (let c = 0; c < 3; c++) { const d = Math.abs(cand[3 * p + c] - ref[3 * p + c]); total += d; worst = Math.max(worst, d); }
    maxD = Math.max(maxD, worst); if (worst === 0) exactPx++;
  }
  const metrics = { mean_abs: total / ref.length, max_abs: maxD, exact_pixels_frac: exactPx / (ref.length / 3) };
  return block(rs, cs, metrics.mean_abs <= tol.mean_abs_max ? 'verified' : 'refuted', metrics, tol);
}

export function f32Rmse(ref, cand, mask = null) {
  const a = new DataView(ref.buffer, ref.byteOffset, ref.byteLength), b = new DataView(cand.buffer, cand.byteOffset, cand.byteLength);
  let acc = 0, n = 0;
  for (let i = 0; i < ref.length / 4; i++) {
    if (mask && !mask[i]) continue;
    const d = b.getFloat32(4 * i, true) - a.getFloat32(4 * i, true);
    acc += d * d; n++;
  }
  return n ? Math.sqrt(acc / n) : null;
}

// ---------------------------------------------------------------- receipt

const HEX64 = /^[0-9a-f]{64}$/;
const REQUIRED = ['schema', 'producer', 'backend', 'scene_sha256', 'seed', 'seed_rule', 'seed_u32', 'time',
  'media', 'content_sha256', 'outputs', 'reconcile', 'does_not_prove', 'receipt_sha256'];
const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isInt = (v) => Number.isInteger(v) && Math.abs(v) <= MAX_SAFE;
const intIn = (v, options) => isInt(v) && options.includes(v);
const isText = (v) => typeof v === 'string' && v !== '';

export function seal(body) {
  const out = {};
  for (const k of Object.keys(body)) if (k !== 'receipt_sha256') out[k] = body[k];
  out.receipt_sha256 = canonicalSha256(out);
  return out;
}

export function makeReceipt({ producer, version, backend, scene, media, content, outputs = {}, reference = null,
  reconcile = null, doesNotProve = [], seedRule = SEED_RULE }) {
  const seed = has(scene, 'seed') ? scene.seed : null;
  const rec = {
    schema: RECEIPT_SCHEMA, producer: { name: producer, version }, backend,
    scene_sha256: canonicalSha256(scene), seed, seed_rule: seedRule,
    seed_u32: seed !== null && seedRule === SEED_RULE ? xmur3(seed) : null,
    time: { base: 'flicks', per_second: FLICKS_PER_SECOND, t: has(scene, 't_flicks') ? scene.t_flicks : 0 },
    media, content_sha256: sha256(content), outputs: { ...outputs }, reconcile: null, does_not_prove: [...doesNotProve],
  };
  if (reconcile !== null) rec.reconcile = { reference, ...reconcile };
  return seal(rec);
}

function audioErrors(media) {
  const errs = [];
  const rate = media.rate;
  if (!intIn(rate, SAMPLE_RATES)) errs.push('audio:rate');
  if (media.format !== 's16le' || !intIn(media.channels, [1, 2])) errs.push('audio:format');
  if (intIn(rate, SAMPLE_RATES) && (!isInt(media.frames) || !isInt(media.duration_flicks) || media.duration_flicks !== media.frames * flicksPerSample(rate))) errs.push('audio:duration');
  const access = media.access;
  if (!isObj(access) || access.autoplay !== false) errs.push('audio:autoplay');
  else if (!['silent', 'still-frame'].includes(access.reduced_sound)) errs.push('audio:reduced_sound');
  if (media.content === 'speech' && isObj(access)) {
    if (!isText(access.captions)) errs.push('audio:captions');
    if (access.transcript !== true) errs.push('audio:transcript');
  }
  const nar = has(media, 'narration') ? media.narration : null;
  if (nar !== null && !isObj(nar)) errs.push('narration:type');
  else if (nar !== null) {
    for (const k of ['backend', 'model', 'voice', 'text_sha256']) if (!isText(nar[k])) errs.push('narration:' + k);
    if (nar.reference !== false) errs.push('narration:reference');
    if (nar.hosted === true && !isText(nar.snapshot) && nar.reproducible !== false) errs.push('narration:reproducible');
  }
  return errs;
}

export function verifyReceipt(rec) {
  if (!isObj(rec)) return ['type'];
  let errs = REQUIRED.filter((k) => !has(rec, k)).map((k) => 'missing:' + k);
  if (errs.length) return errs.sort();
  if (rec.schema !== RECEIPT_SCHEMA) errs.push('schema');
  const dnp = rec.does_not_prove;
  if (!Array.isArray(dnp) || !dnp.length || !dnp.every((s) => typeof s === 'string' && !/^[ \t\n\r]*$/.test(s))) errs.push('does_not_prove');
  const t = rec.time;
  if (!isObj(t) || t.base !== 'flicks' || !intIn(t.per_second, [FLICKS_PER_SECOND]) || !isInt(t.t) || t.t < 0) errs.push('time');
  for (const k of ['scene_sha256', 'content_sha256', 'receipt_sha256']) if (typeof rec[k] !== 'string' || !HEX64.test(rec[k])) errs.push('hex:' + k);
  if (!SEED_RULES.includes(rec.seed_rule)) errs.push('seed_rule');
  else if (rec.seed_rule === SEED_RULE && rec.seed !== null) {
    let ok = typeof rec.seed === 'string';
    if (ok) { try { ok = isInt(rec.seed_u32) && rec.seed_u32 === xmur3(rec.seed); } catch { ok = false; } }
    if (!ok) errs.push('seed_u32');
  }
  const rc = rec.reconcile;
  if (rc !== null) {
    const ref = isObj(rc) ? rc.reference : null, tol = isObj(rc) ? rc.tolerance : null;
    if (!isObj(ref) || typeof ref.content_sha256 !== 'string') errs.push('reconcile:reference');
    else if (rc.identity !== identity(ref.content_sha256, rec.content_sha256)) errs.push('reconcile:identity');
    if (!isObj(tol) || !['verified', 'refuted', 'unverifiable'].includes(tol.verdict)) errs.push('reconcile:verdict');
    else if (tol.verdict === 'unverifiable' && !isText(tol.reason)) errs.push('reconcile:reason');
  }
  const media = rec.media;
  if (!isObj(media) || !['image', 'audio', 'video', 'document'].includes(media.kind)) errs.push('media:kind');
  else if (media.kind === 'audio') errs = errs.concat(audioErrors(media));
  if (!errs.length) {
    const body = {};
    for (const k of Object.keys(rec)) if (k !== 'receipt_sha256') body[k] = rec[k];
    if (canonicalSha256(body) !== rec.receipt_sha256) errs.push('seal');
  }
  return [...new Set(errs)].sort();
}

// ---------------------------------------------------------------- scenes

export function validateScene(scene) {
  if (!isObj(scene)) return ['type'];
  if (!SCENE_KINDS.includes(scene.kind)) return ['kind'];
  const errs = [];
  if (has(scene, 'seed') && typeof scene.seed !== 'string') errs.push('seed');
  const t = has(scene, 't_flicks') ? scene.t_flicks : 0;
  if (!isInt(t) || t < 0) errs.push('t_flicks');
  if (scene.kind === 'superstack.scene/1') {
    const f = scene.frame;
    if (!isObj(f) || !['width', 'height'].every((k) => isInt(f[k]) && f[k] > 0)) errs.push('frame');
  } else {
    if (!intIn(scene.rate, SAMPLE_RATES)) errs.push('rate');
    if (!intIn(scene.channels, [1, 2])) errs.push('channels');
    if (!isInt(scene.duration_samples) || scene.duration_samples <= 0) errs.push('duration_samples');
  }
  return errs.sort();
}
