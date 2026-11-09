import { integratedLufs, truePeakDb } from './loudness.mjs';
// wav.mjs: PCM WAV masters per QUALITY-SPEC O3: 48 kHz, 24-bit, plus 16-bit with TPDF dither.
// channels: Float32Array[] (one per channel, equal length), values in -1..1. Returns an ArrayBuffer.
// The dither generator is seeded, so the same audio encodes to the same bytes.
export function encodeWav(channels, sampleRate = 48000, { bits = 24, seed = 0x5eed } = {}) {
  if (bits !== 24 && bits !== 16) throw new RangeError('wav: bits must be 16 or 24');
  const ch = channels.length, n = channels[0].length, bytes = bits / 8, size = 44 + n * ch * bytes;
  const buf = new ArrayBuffer(size), v = new DataView(buf);
  const str = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  str(0, 'RIFF'); v.setUint32(4, size - 8, true); str(8, 'WAVE'); str(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true);
  v.setUint16(22, ch, true); v.setUint32(24, sampleRate, true); v.setUint32(28, sampleRate * ch * bytes, true); v.setUint16(32, ch * bytes, true); v.setUint16(34, bits, true);
  str(36, 'data'); v.setUint32(40, n * ch * bytes, true);
  let s = seed >>> 0; const r = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
  const full = bits === 24 ? 8388607 : 32767;
  let o = 44;
  for (let i = 0; i < n; i++) for (let c = 0; c < ch; c++) {
    let x = channels[c][i] * full; if (bits === 16) x += r() - r(); // TPDF, 1 LSB peak each side
    const q = Math.max(-full - 1, Math.min(full, Math.round(x)));
    if (bits === 24) { v.setUint8(o, q & 255); v.setUint8(o + 1, (q >> 8) & 255); v.setUint8(o + 2, (q >> 16) & 255); o += 3; } else { v.setInt16(o, q, true); o += 2; }
  }
  return buf;
}

// Peak and RMS in dBFS, plus BS.1770 integrated loudness and 4x true peak, for the export line and the tests.
export function levels(channels, sampleRate = 48000) {
  const base = levelsBasic(channels);
  return { ...base, lufs: +integratedLufs(channels, sampleRate).toFixed(2), truePeakDb: +truePeakDb(channels).toFixed(2) };
}
function levelsBasic(channels) {
  let peak = 0, sum = 0, n = 0;
  for (const d of channels) for (let i = 0; i < d.length; i++) { const a = Math.abs(d[i]); if (a > peak) peak = a; sum += d[i] * d[i]; n++; }
  const db = x => (x > 0 ? 20 * Math.log10(x) : -Infinity);
  return { peakDb: +db(peak).toFixed(2), rmsDb: +db(Math.sqrt(sum / Math.max(1, n))).toFixed(2) };
}
