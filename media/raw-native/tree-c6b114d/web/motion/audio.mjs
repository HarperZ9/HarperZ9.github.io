// The offline audio mix for Motion media, sample-exact with tools/media/audio_mix.py and
// with the superstack.sound/1 rules: tracks are summed in float64 in a fixed order, then
// quantized to s16 by superstack's rule, and loudness is the superstack-bs1770/1 meter
// (ITU-R BS.1770-4). Pure; runs in Node and in a browser.
//
//   const mix = mixTracks([{ samples, channels: 1, gainDb: 0 }, { samples: score, channels: 2, gainDb: -13 }], { channels: 2, frames });
//   const pcm = quantizeS16(mix);             // Int16Array, interleaved
//   integratedLufs(mix, 48000, 2);            // or null
//   const wav = wavS16(pcm, 48000, 2);        // Uint8Array

// superstack: clamp to [-1, 1], then floor(v * 32767 + 0.5).
export function quantizeS16(samples) {
  const out = new Int16Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    const v = Math.max(-1, Math.min(1, samples[i]));
    out[i] = Math.floor(v * 32767 + 0.5);
  }
  return out;
}

// s16 back to float: v / 32767, superstack's s16ToFloats, so quantizeS16(fromS16(pcm)) is pcm.
export function fromS16(pcm) {
  const out = new Float64Array(pcm.length);
  for (let i = 0; i < pcm.length; i++) out[i] = pcm[i] / 32767;
  return out;
}

// Sum tracks into `channels` interleaved channels over `frames` frames. A mono track
// feeds every output channel; a track with as many channels as the output maps one to
// one. gainDb scales a track; offset (frames) delays it. Order of summation: track by track.
export function mixTracks(tracks, { channels = 2, frames }) {
  const out = new Float64Array(frames * channels);
  for (const t of tracks) {
    // A linear gain is exact across runtimes; a gain in dB goes through pow, which may round differently.
    const g = t.gain ?? Math.pow(10, (t.gainDb || 0) / 20), off = t.offset || 0, tc = t.channels || 1;
    if (tc !== 1 && tc !== channels) throw new Error(`a ${tc}-channel track cannot mix into ${channels} channels`);
    const n = Math.floor(t.samples.length / tc);
    for (let i = 0; i < n; i++) {
      const f = i + off;
      if (f < 0 || f >= frames) continue;
      for (let c = 0; c < channels; c++) out[f * channels + c] += t.samples[i * tc + (tc === 1 ? 0 : c)] * g;
    }
  }
  return out;
}

const RATES = [8000, 11025, 16000, 22050, 32000, 44100, 48000, 88200, 96000, 176400, 192000];
export function kWeighting(rate) {
  if (rate === 48000) return [[1.53512485958697, -2.69169618940638, 1.19839281085285, -1.69065929318241, 0.73248077421585],
    [1.0, -2.0, 1.0, -1.99004745483398, 0.99007225036621]];
  const fs = rate;
  let k = Math.tan(Math.PI * 1681.974450955533 / fs), q = 0.7071752369554196;
  const vh = Math.pow(10, 3.999843853973347 / 20), vb = Math.pow(vh, 0.4996667741545416);
  let a0 = 1 + k / q + k * k;
  const shelf = [(vh + vb * k / q + k * k) / a0, 2 * (k * k - vh) / a0, (vh - vb * k / q + k * k) / a0, 2 * (k * k - 1) / a0, (1 - k / q + k * k) / a0];
  k = Math.tan(Math.PI * 38.13547087602444 / fs); q = 0.5003270373238773; a0 = 1 + k / q + k * k;
  return [shelf, [1, -2, 1, 2 * (k * k - 1) / a0, (1 - k / q + k * k) / a0]];
}
function biquad(x, c) {
  const y = new Float64Array(x.length);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const v = x[i], o = c[0] * v + c[1] * x1 + c[2] * x2 - c[3] * y1 - c[4] * y2;
    x2 = x1; x1 = v; y2 = y1; y1 = o; y[i] = o;
  }
  return y;
}
const loud = (p) => (p > 0 ? -0.691 + 10 * Math.log10(p) : -Infinity);

// BS.1770 integrated loudness: 400 ms blocks at 100 ms hops, gates -70 LUFS and -10 LU.
export function integratedLufs(samples, rate, channels = 1) {
  if ((channels !== 1 && channels !== 2) || !RATES.includes(rate) || rate % 10) return null;
  const filt = kWeighting(rate), chans = [];
  for (let c = 0; c < channels; c++) {
    const xs = new Float64Array(Math.ceil((samples.length - c) / channels));
    for (let i = c, j = 0; i < samples.length; i += channels, j++) xs[j] = samples[i];
    chans.push(biquad(biquad(xs, filt[0]), filt[1]));
  }
  const n = chans[0].length, block = (rate * 4) / 10, hop = rate / 10, powers = [];
  for (let i = 0; i + block <= n; i += hop) {
    let p = 0;
    for (const z of chans) { let acc = 0; for (let j = i; j < i + block; j++) acc += z[j] * z[j]; p += acc / block; }
    powers.push(p);
  }
  const gated = powers.filter((p) => loud(p) > -70);
  if (!gated.length) return null;
  const rel = loud(gated.reduce((a, b) => a + b, 0) / gated.length) - 10;
  let acc = 0, count = 0;
  for (const p of gated) if (loud(p) > rel) { acc += p; count++; }
  return loud(acc / count);
}

export function peakDbfs(samples) {
  let peak = 0;
  for (const v of samples) peak = Math.max(peak, Math.abs(v));
  return peak > 0 ? 20 * Math.log10(peak) : null;
}

export function wavS16(pcm, rate, channels) {
  const n = pcm.length * 2, b = new Uint8Array(44 + n), dv = new DataView(b.buffer);
  const tag = (o, s) => { for (let i = 0; i < 4; i++) b[o + i] = s.charCodeAt(i); };
  tag(0, "RIFF"); dv.setUint32(4, 36 + n, true); tag(8, "WAVE"); tag(12, "fmt ");
  dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, channels, true); dv.setUint32(24, rate, true);
  dv.setUint32(28, rate * channels * 2, true); dv.setUint16(32, channels * 2, true); dv.setUint16(34, 16, true);
  tag(36, "data"); dv.setUint32(40, n, true);
  for (let i = 0; i < pcm.length; i++) dv.setInt16(44 + 2 * i, pcm[i], true);
  return b;
}
