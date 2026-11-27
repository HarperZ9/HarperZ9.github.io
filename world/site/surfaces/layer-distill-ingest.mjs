// layer-distill-ingest.mjs: Zero-dependency Layer-0 distill/1 byte-anatomy dissector,
// 64-slice Shannon entropy strip, and live drag-and-drop palette/waveform ingest (Wave 33A-1).
// Converts any dropped local image/audio/binary into live patchbay palette, frame, audio, receipt.
import { linToOklab, oklabToHex, srgbToLin } from './layer-elements-palette.mjs';

export const LAYER_META = Object.freeze({
  id: 'distill',
  name: 'Distill Layer-0 Byte Ingest',
  discipline: 'Native Engine, Living World & Inspection',
  route: 'File Drop -> Distill -> Palette + Frame + Audio',
  takes: ['frame'],
  gives: ['palette', 'frame', 'audio_features', 'receipt'],
  defaultOn: false,
  defaultOpacity: 0.72,
  defaultBlend: 'normal',
});

const clamp = (x, lo = 0, hi = 1) => (x < lo ? lo : x > hi ? hi : x);
const u32be = (b, o) => ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0;
const u32le = (b, o) => (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;
const ascii = (b, o, n) => String.fromCharCode(...b.slice(o, o + n));

export function shannonEntropy64(bytes, slices = 64) {
  const len = bytes.length;
  if (!len) return Array(slices).fill(0);
  const out = [];
  for (let s = 0; s < slices; s++) {
    const lo = Math.floor((s * len) / slices);
    const hi = Math.max(lo + 1, Math.floor(((s + 1) * len) / slices));
    const hist = new Uint32Array(256);
    const count = Math.min(len, hi) - lo;
    if (count <= 0) { out.push(0); continue; }
    for (let i = lo; i < lo + count; i++) hist[bytes[i]]++;
    let H = 0;
    for (let v = 0; v < 256; v++) {
      if (!hist[v]) continue;
      const p = hist[v] / count;
      H -= p * Math.log2(p);
    }
    out.push(Number(H.toFixed(4)));
  }
  return out;
}

function computeCoverage(parts, totalBytes) {
  if (!totalBytes) return { totalBytes: 0, covered: 0, share: 1, residualBytes: 0, overlapBytes: 0 };
  const segs = parts
    .map((p) => [Math.max(0, p.offset), Math.min(totalBytes, p.offset + p.length)])
    .filter(([a, b]) => b > a)
    .sort((x, y) => x[0] - y[0]);
  let covered = 0, overlapBytes = 0, curEnd = 0;
  for (const [a, b] of segs) {
    if (a < curEnd) {
      overlapBytes += Math.min(b, curEnd) - a;
      if (b > curEnd) { covered += b - curEnd; curEnd = b; }
    } else {
      covered += b - a; curEnd = b;
    }
  }
  const residualBytes = Math.max(0, totalBytes - covered);
  return {
    totalBytes, covered,
    share: Number((covered / totalBytes).toFixed(6)),
    residualBytes, overlapBytes,
  };
}

// Dissect PNG, RIFF/WAV, JPEG, OGG, or generic UTF-8/binary into distill/1 spans
export function dissectBytesLayer0(inputBytes, filename = 'drop.bin') {
  const b = inputBytes instanceof Uint8Array ? inputBytes : new Uint8Array(inputBytes);
  const n = b.length;
  const parts = [];
  let format = 'raw-binary';

  // PNG signature: 89 50 4E 47 0D 0A 1A 0A
  if (n >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) {
    format = 'png';
    parts.push({ name: 'png-signature', offset: 0, length: 8 });
    let off = 8;
    while (off + 12 <= n) {
      const len = u32be(b, off);
      const tag = ascii(b, off + 4, 4);
      const span = 12 + len;
      if (off + span > n) break;
      parts.push({ name: `chunk:${tag}`, offset: off, length: span });
      off += span;
      if (tag === 'IEND') break;
    }
  } else if (n >= 12 && ascii(b, 0, 4) === 'RIFF') {
    format = ascii(b, 8, 4) === 'WAVE' ? 'wav' : 'riff';
    const declaredEnd = Math.min(n, 8 + u32le(b, 4));
    parts.push({ name: 'riff-header', offset: 0, length: 12 });
    let off = 12;
    while (off + 8 <= declaredEnd) {
      const tag = ascii(b, off, 4);
      const len = u32le(b, off + 4);
      const padded = len + (len & 1);
      const span = Math.min(declaredEnd - off, 8 + padded);
      parts.push({ name: `riff:${tag.trim()}`, offset: off, length: span });
      off += span;
      if (span < 8) break;
    }
  } else if (n >= 4 && b[0] === 0xff && b[1] === 0xd8) {
    format = 'jpeg';
    let end = n;
    for (let i = n - 2; i >= 2; i--) {
      if (b[i] === 0xff && b[i + 1] === 0xd9) { end = i + 2; break; }
    }
    parts.push({ name: 'jpeg-stream', offset: 0, length: end });
  } else if (n >= 4 && ascii(b, 0, 4) === 'OggS') {
    format = 'ogg';
    let off = 0, page = 0;
    while (off + 27 <= n && ascii(b, off, 4) === 'OggS') {
      const segs = b[off + 26];
      let body = 0;
      for (let i = 0; i < segs && off + 27 + i < n; i++) body += b[off + 27 + i];
      const span = 27 + segs + body;
      if (off + span > n) break;
      parts.push({ name: `ogg-page-${page++}`, offset: off, length: span });
      off += span;
    }
  } else {
    parts.push({ name: 'payload', offset: 0, length: n });
  }

  return {
    schema: 'distill/1',
    filename,
    format,
    bytes: n,
    parts,
    coverage: computeCoverage(parts, n),
    entropyMap: shannonEntropy64(b, 64),
  };
}

// Convert dissected bytes into typed patchbay outputs (palette, frame, audio_features, receipt)
export function distillToPatchbayOutputs(inputBytes, filename, digestFn) {
  const b = inputBytes instanceof Uint8Array ? inputBytes : new Uint8Array(inputBytes);
  const anatomy = dissectBytesLayer0(b, filename);
  const ent = anatomy.entropyMap;

  // Extract 4 OKLab swatches deterministically from byte quartiles + entropy
  const oklab = [], hex = [];
  for (let s = 0; s < 4; s++) {
    const base = Math.floor((s * Math.max(1, b.length)) / 4);
    const r = b[base % Math.max(1, b.length)] ?? 40;
    const g = b[(base + 1) % Math.max(1, b.length)] ?? 90;
    const bl = b[(base + 2) % Math.max(1, b.length)] ?? 120;
    const ok = linToOklab([srgbToLin(r / 255), srgbToLin(g / 255), srgbToLin(bl / 255)]);
    oklab.push(ok);
    hex.push(oklabToHex(ok, 1));
  }

  // 8x4 luma frame from 64-slice entropy map (paired)
  const lumaGrid = Array.from({ length: 32 }, (_, i) => Math.round(clamp((ent[i * 2] + ent[i * 2 + 1]) / 16) * 255));
  const bands8 = Array.from({ length: 8 }, (_, i) => {
    let sum = 0;
    for (let j = 0; j < 8; j++) sum += ent[i * 8 + j];
    return Number(clamp(sum / 64, 0.05, 1).toFixed(4));
  });
  const rms = Number(clamp(Math.sqrt(bands8.reduce((s, v) => s + v * v, 0) / 8), 0.06, 0.96).toFixed(4));

  const frame = {
    width: 8, height: 4, lumaGrid,
    pixelsSha256: digestFn({ width: 8, height: 4, lumaGrid, source: 'distill', format: anatomy.format }),
    transfer: 'srgb-u8', source: 'distill',
  };
  const palette = { oklab, hex, mix: hex[1], ground: hex[0] };
  const audio_features = {
    rms, spectralCentroidHz: Number((320 + rms * 2400).toFixed(1)),
    bands8, beatPhase: 0, onset: anatomy.coverage.residualBytes > 0, bpm: 126,
    lufs: Number((-21 + rms * 8).toFixed(1)),
  };
  const receipt = {
    schema: 'distill/1',
    filename: anatomy.filename,
    format: anatomy.format,
    coverage: anatomy.coverage,
    bytesSha256: digestFn({ len: b.length, parts: anatomy.parts.length, ent0: ent[0], ent63: ent[63] }),
  };
  return { anatomy, palette, frame, audio_features, receipt };
}

export function renderDistillOverlayLayer(ctx, state = {}, opts = {}) {
  const W = ctx.canvas.width, H = ctx.canvas.height;
  ctx.clearRect(0, 0, W, H);
  const ent = opts.anatomy?.entropyMap || state.distill?.entropyMap || Array.from({ length: 64 }, (_, i) => 3.5 + 3 * Math.sin(i * 0.25 + (state.time || 0)));
  const barW = (W - 64) / ent.length;
  for (let i = 0; i < ent.length; i++) {
    const h = clamp(ent[i] / 8) * (H * 0.22);
    ctx.fillStyle = ent[i] > 6.8 ? 'rgba(215, 158, 53, 0.68)' : 'rgba(130, 198, 212, 0.52)';
    ctx.fillRect(32 + i * barW, H - 36 - h, Math.max(2, barW - 2), h);
  }
  const cov = opts.anatomy?.coverage || state.distill?.coverage;
  ctx.fillStyle = 'rgba(244, 239, 230, 0.85)';
  ctx.font = '600 13px ui-monospace, monospace';
  const msg = cov ? `distill/1 ${opts.anatomy?.format || 'bin'} | cov=${(cov.share * 100).toFixed(1)}% | residual=${cov.residualBytes}B` : 'distill/1 ready (drop local file)';
  ctx.fillText(msg, 32, 34);
}
