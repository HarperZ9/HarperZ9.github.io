// SPDX-License-Identifier: FSL-1.1-MIT
// Copyright 2026 Zain Dana Harper
//
// wav.mjs: RIFF WAVE in and out, with no dependencies, so the same reader runs in Node and in a browser worker.
//   readWav(bytes)                 -> { rate, channels: Float32Array[] }   PCM 8/16/24/32 int and 32/64 float,
//                                     plain or WAVE_FORMAT_EXTENSIBLE; unknown chunks are skipped
//   writeWav({ rate, channels }, { bits: 16 | 24, seed })  -> Uint8Array; 16 bit gets TPDF dither of 1 LSB peak
//   mono(audio)                    -> Float32Array, the channel mean
//   slice(audio, t0, t1, fade)     -> audio between two times with raised-cosine fades of `fade` seconds
//   resample(x, from, to)          -> Float32Array, windowed-sinc (16 zero crossings, Kaiser beta 8.6)

export function readWav(bytes) {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const tag = o => String.fromCharCode(b[o], b[o + 1], b[o + 2], b[o + 3]);
  if (tag(0) !== 'RIFF' || tag(8) !== 'WAVE') throw new Error('readWav: not a RIFF WAVE file');
  let o = 12, fmt = null, data = null;
  while (o + 8 <= b.length) {
    const id = tag(o), size = dv.getUint32(o + 4, true), body = o + 8;
    if (id === 'fmt ') {
      let code = dv.getUint16(body, true);
      const ch = dv.getUint16(body + 2, true), rate = dv.getUint32(body + 4, true), bits = dv.getUint16(body + 14, true);
      if (code === 0xfffe && size >= 26) code = dv.getUint16(body + 24, true);
      fmt = { code, ch, rate, bits };
    } else if (id === 'data') data = { at: body, size: Math.min(size, b.length - body) };
    o = body + size + (size & 1);
  }
  if (!fmt || !data) throw new Error('readWav: missing fmt or data chunk');
  const { code, ch, rate, bits } = fmt, bps = bits >> 3, n = Math.floor(data.size / (bps * ch));
  if (!(code === 1 || code === 3)) throw new Error(`readWav: format code ${code} is not PCM or float`);
  const channels = Array.from({ length: ch }, () => new Float32Array(n));
  for (let i = 0; i < n; i++) for (let c = 0; c < ch; c++) {
    const p = data.at + (i * ch + c) * bps;
    let v;
    if (code === 3) v = bits === 64 ? dv.getFloat64(p, true) : dv.getFloat32(p, true);
    else if (bits === 8) v = (b[p] - 128) / 128;
    else if (bits === 16) v = dv.getInt16(p, true) / 32768;
    else if (bits === 24) v = (((b[p + 2] << 24) | (b[p + 1] << 16) | (b[p] << 8)) >> 8) / 8388608;
    else if (bits === 32) v = dv.getInt32(p, true) / 2147483648;
    else throw new Error(`readWav: ${bits}-bit integer PCM is not supported`);
    channels[c][i] = v;
  }
  return { rate, channels };
}

// Mulberry32 for the dither, seeded, so a written file is the same bytes every run.
function mulberry(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

export function writeWav({ rate, channels }, { bits = 24, seed = 31 } = {}) {
  const ch = channels.length, n = channels[0].length, bps = bits >> 3, size = n * ch * bps;
  const b = new Uint8Array(44 + size), dv = new DataView(b.buffer), put = (o, s) => { for (let i = 0; i < 4; i++) b[o + i] = s.charCodeAt(i); };
  put(0, 'RIFF'); dv.setUint32(4, 36 + size, true); put(8, 'WAVE'); put(12, 'fmt ');
  dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, ch, true); dv.setUint32(24, rate, true);
  dv.setUint32(28, rate * ch * bps, true); dv.setUint16(32, ch * bps, true); dv.setUint16(34, bits, true);
  put(36, 'data'); dv.setUint32(40, size, true);
  const r = mulberry(seed), full = bits === 16 ? 32767 : 8388607;
  for (let i = 0, p = 44; i < n; i++) for (let c = 0; c < ch; c++, p += bps) {
    const d = bits === 16 ? r() - r() : 0;  // TPDF, 1 LSB peak each side, 16-bit only
    const q = Math.max(-full - 1, Math.min(full, Math.round(channels[c][i] * (full + 1) + d)));
    if (bits === 16) dv.setInt16(p, q, true);
    else { b[p] = q & 255; b[p + 1] = (q >> 8) & 255; b[p + 2] = (q >> 16) & 255; }
  }
  return b;
}

export function mono({ channels }) {
  if (channels.length === 1) return channels[0];
  const n = channels[0].length, x = new Float32Array(n);
  for (const c of channels) for (let i = 0; i < n; i++) x[i] += c[i];
  for (let i = 0; i < n; i++) x[i] /= channels.length;
  return x;
}

export function slice({ rate, channels }, t0, t1, fade = 0.05) {
  const a = Math.max(0, Math.round(t0 * rate)), z = Math.min(channels[0].length, Math.round(t1 * rate)), f = Math.round(fade * rate);
  return { rate, channels: channels.map(c => {
    const o = c.slice(a, z);
    for (let i = 0; i < f && i < o.length; i++) { const g = 0.5 - 0.5 * Math.cos(Math.PI * i / f); o[i] *= g; o[o.length - 1 - i] *= g; }
    return o;
  }) };
}

function besselI0(x) { let s = 1, t = 1; for (let k = 1; k < 30; k++) { t *= (x / (2 * k)) ** 2; s += t; } return s; }
export function resample(x, from, to, { zeros = 16, beta = 8.6 } = {}) {
  if (from === to) return Float32Array.from(x);
  const ratio = to / from, n = Math.floor(x.length * ratio), out = new Float32Array(n), cut = Math.min(1, ratio), i0b = besselI0(beta);
  for (let j = 0; j < n; j++) {
    const t = j / ratio, c = Math.floor(t), half = Math.ceil(zeros / cut);
    let s = 0;
    for (let k = c - half + 1; k <= c + half; k++) {
      if (k < 0 || k >= x.length) continue;
      const u = (t - k) * cut, wk = Math.abs(u) / zeros;
      if (wk >= 1) continue;
      const sinc = u === 0 ? 1 : Math.sin(Math.PI * u) / (Math.PI * u);
      s += x[k] * cut * sinc * besselI0(beta * Math.sqrt(1 - wk * wk)) / i0b;
    }
    out[j] = s;
  }
  return out;
}
