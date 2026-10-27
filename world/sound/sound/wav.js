// WAV encoding and offline rendering.
export function encodeWav(buffer, bits = 16) {
  const ch = buffer.numberOfChannels, n = buffer.length, bytes = bits / 8, size = 44 + n * ch * bytes;
  const out = new ArrayBuffer(size), v = new DataView(out);
  const w = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  w(0, 'RIFF'); v.setUint32(4, size - 8, true); w(8, 'WAVE'); w(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true);
  v.setUint16(22, ch, true); v.setUint32(24, buffer.sampleRate, true); v.setUint32(28, buffer.sampleRate * ch * bytes, true);
  v.setUint16(32, ch * bytes, true); v.setUint16(34, bits, true); w(36, 'data'); v.setUint32(40, n * ch * bytes, true);
  const data = []; for (let c = 0; c < ch; c++) data.push(buffer.getChannelData(c));
  let o = 44;
  for (let i = 0; i < n; i++) for (let c = 0; c < ch; c++) { const s = Math.max(-1, Math.min(1, data[c][i])); v.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7fff, true); o += 2; }
  return out;
}

export function bufferStats(buf) {
  let peak = 0, sum = 0, nan = 0, n = 0;
  for (let c = 0; c < buf.numberOfChannels; c++) { const d = buf.getChannelData(c); for (let i = 0; i < d.length; i++) { const x = d[i]; if (x !== x) { nan++; continue; } const a = Math.abs(x); if (a > peak) peak = a; sum += x * x; n++; } }
  return { peak, rms: Math.sqrt(sum / Math.max(n, 1)), nan, seconds: buf.length / buf.sampleRate };
}

// build(engine) schedules sound and returns the end time in seconds. Resolves to an AudioBuffer.
export async function renderOffline(Engine, seconds, build, opts = {}) {
  const e = await Engine.offline(seconds, opts);
  await build(e);
  return e.ctx.startRendering();
}

export function wavBlobUrl(buffer) { return URL.createObjectURL(new Blob([encodeWav(buffer)], { type: 'audio/wav' })); }
export function toBase64(ab) { let s = ''; const b = new Uint8Array(ab); for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000)); return btoa(s); }
