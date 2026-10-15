// The video signal, simulated in the signal domain (CPU reference of signal.wgsl).
//
// A line of the source is sampled at fs = 4 fsc as a DAC would hold it. RGB passes
// through the video amplifier's bandwidth. S-video and composite encode Y'IQ (NTSC) or
// Y'UV (PAL, V switching sign every line); the chroma is band-limited and modulated onto
// the subcarrier, whose phase advances 90 degrees a sample, lineRad a line and frameRad a
// frame. Composite adds chroma to luma on one wire, so the decoder has to separate them
// again with a notch or a one-line comb; what it gets wrong is dot crawl (chroma read as
// luma) and rainbowing (fine luma read as chroma). The decoder then demodulates the chroma
// with the I and Q (or U and V) low-passes and converts back to R'G'B'.
import { inv3 } from "../spectral.mjs";

export const YIQ = [0.299, 0.587, 0.114, 0.596, -0.274, -0.322, 0.211, -0.523, 0.312];
export const YUV = [0.299, 0.587, 0.114, -0.14713, -0.28886, 0.436, 0.615, -0.51499, -0.10001];
export const YIQ_INV = inv3(YIQ), YUV_INV = inv3(YUV);

const TAP_ORDER = ["rgb", "encodeC", "lumaSep", "lumaLp", "demodI", "demodQ"];
// All filter taps in one array, with [offset, half] per filter, as the GPU reads them.
export function packTaps(taps) {
  const info = {}, all = [];
  for (const name of TAP_ORDER) { const t = taps[name]; info[name] = [all.length, (t.length - 1) / 2]; for (const v of t) all.push(v); }
  return { data: Float32Array.from(all), info };
}

// Subcarrier phase in radians, reduced in cycles first so that f32 on the GPU keeps it exact.
const frac = (x) => x - Math.floor(x);
const phase = (plan, k, y, f) => 2 * Math.PI * ((k & 3) / 4 + frac(y * plan.lineCyc) + frac(f * plan.frameCyc));
const palSign = (y) => ((y & 1) === 0 ? 1 : -1);

// Source value of channel c at signal sample k of line y (zero-order hold).
function held(plan, src, y, k, c) {
  const kk = Math.min(plan.N - 1, Math.max(0, k));
  const x = Math.min(src.width - 1, Math.floor(((2 * kk + 1) * src.width) / (2 * plan.N)));
  return src.data[(y * src.width + x) * 4 + c];
}
function chromaOf(plan, src, y, k) {
  const m = plan.pal ? YUV : YIQ, r = held(plan, src, y, k, 0), g = held(plan, src, y, k, 1), b = held(plan, src, y, k, 2);
  return [m[3] * r + m[4] * g + m[5] * b, m[6] * r + m[7] * g + m[8] * b];
}

// Pass 1. enc[y][k] = (luma, chroma) on the wire; RGB mode writes the final signal.
export function encode(plan, src, f, T) {
  const { N, lines } = plan, out = new Float32Array(N * lines * 4), [o, h] = T.info.encodeC, [ro, rh] = T.info.rgb;
  for (let y = 0; y < lines; y++) for (let k = 0; k < N; k++) {
    const i = (y * N + k) * 4;
    if (plan.mode === 0) {
      for (let c = 0; c < 3; c++) { let s = 0; for (let j = -rh; j <= rh; j++) s += T.data[ro + j + rh] * held(plan, src, y, k + j, c); out[i + c] = s; }
      continue;
    }
    const r = held(plan, src, y, k, 0), g = held(plan, src, y, k, 1), b = held(plan, src, y, k, 2);
    let a = 0, q = 0;
    for (let j = -h; j <= h; j++) { const [ca, cq] = chromaOf(plan, src, y, k + j); a += T.data[o + j + h] * ca; q += T.data[o + j + h] * cq; }
    const ph = phase(plan, k, y, f);
    const c = plan.pal ? a * Math.sin(ph) + palSign(y) * q * Math.cos(ph) : a * Math.cos(ph) + q * Math.sin(ph);
    out[i] = 0.299 * r + 0.587 * g + 0.114 * b; out[i + 1] = c;
  }
  return out;
}

// Pass 2. sep[y][k] = (luma, chroma) as the decoder separates them.
export function separate(plan, enc, T) {
  const { N, lines } = plan, out = new Float32Array(N * lines * 4), [o, h] = T.info.lumaSep;
  const comp = (y, k) => { const i = (y * N + Math.min(N - 1, Math.max(0, k))) * 4; return enc[i] + enc[i + 1]; };
  const comb = plan.p.signal.decoder === "comb" && !plan.pal;
  for (let y = 0; y < lines; y++) for (let k = 0; k < N; k++) {
    const i = (y * N + k) * 4;
    if (plan.mode === 1) { out[i] = enc[i]; out[i + 1] = enc[i + 1]; continue; }
    let yl;
    if (comb) { const y2 = y > 0 ? y - 1 : Math.min(1, lines - 1); yl = 0.5 * (comp(y, k) + comp(y2, k)); }
    else { yl = 0; for (let j = -h; j <= h; j++) yl += T.data[o + j + h] * comp(y, k + j); }
    out[i] = yl; out[i + 1] = comp(y, k) - yl;
  }
  return out;
}

function demodLine(plan, sep, T, y, k, f) {
  const N = plan.N, [io, ih] = T.info.demodI, [qo, qh] = T.info.demodQ;
  const C = (kk) => sep[(y * N + Math.min(N - 1, Math.max(0, kk))) * 4 + 1];
  let a = 0, b = 0;
  for (let j = -ih; j <= ih; j++) { const ph = phase(plan, k + j, y, f); a += T.data[io + j + ih] * 2 * C(k + j) * (plan.pal ? Math.sin(ph) : Math.cos(ph)); }
  for (let j = -qh; j <= qh; j++) { const ph = phase(plan, k + j, y, f); b += T.data[qo + j + qh] * 2 * C(k + j) * (plan.pal ? palSign(y) * Math.cos(ph) : Math.sin(ph)); }
  return [a, b];
}

// Pass 3. sig[y][k] = R'G'B' as the tube's guns receive it.
export function demod(plan, sep, T, f) {
  const { N, lines } = plan, out = new Float32Array(N * lines * 4), [lo, lh] = T.info.lumaLp, M = plan.pal ? YUV_INV : YIQ_INV;
  for (let y = 0; y < lines; y++) for (let k = 0; k < N; k++) {
    let Y = 0;
    for (let j = -lh; j <= lh; j++) Y += T.data[lo + j + lh] * sep[(y * N + Math.min(N - 1, Math.max(0, k + j))) * 4];
    let [a, b] = demodLine(plan, sep, T, y, k, f);
    if (plan.pal && y > 0) { const [a2, b2] = demodLine(plan, sep, T, y - 1, k, f); a = 0.5 * (a + a2); b = 0.5 * (b + b2); }
    const i = (y * N + k) * 4;
    out[i] = M[0] * Y + M[1] * a + M[2] * b; out[i + 1] = M[3] * Y + M[4] * a + M[5] * b; out[i + 2] = M[6] * Y + M[7] * a + M[8] * b;
  }
  return out;
}

// The whole signal chain for one frame f of a source frame of R'G'B' values.
export function signalChain(plan, src, f, T = packTaps(plan.taps)) {
  const enc = encode(plan, src, f, T);
  if (plan.mode === 0) return enc;
  return demod(plan, separate(plan, enc, T), T, f);
}
