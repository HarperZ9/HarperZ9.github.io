// fractal-flight.js: keyframed flights through a 2D fractal, and their export as video.
//
// A flight is a list of keyframes, each a whole view (centre as decimal strings, width, budget,
// palette, colouring). Between two keyframes the width moves geometrically, so a zoom of 1e30 takes
// as long per decade at the start as at the end, and the centre moves so that the destination's
// centre approaches the middle of the frame in step with the zoom:
//     s(t) = sA^(1-e) sB^e,   c(t) = cB + (cA - cB) (s(t) - sB) / (sA - sB)      (e = eased t)
// When the widths are equal the centre slides linearly instead. The centre arithmetic goes through
// fractal-hp.js, so a flight to 1e-200 lands exactly. The palettes blend in OKLab; colouring
// parameters (density, offset) and the iteration budget interpolate linearly; everything else
// switches at the halfway point.
//
// Export: every frame is drawn in full by the renderer (not captured in real time), encoded with
// WebCodecs (VP9, else VP8), and muxed here into WebM: a minimal Matroska writer with one video
// track and one cluster per second.

import { viewCentre, decDiff, offsetDec, bitsForScale } from "./fractal-hp.js";
import { paletteOf } from "./fractal.js";
import { resample } from "./fractal-gradient.js";
import { srgbToLinear, srgbEncode, linearToOklab, oklabToLinear } from "./fractal-color.js";

// Two palettes blended in OKLab, stop by stop, after resampling both to the same count; the flight
// crosses from one keyframe's colours to the next's instead of switching at the halfway point.
function blendPalettes(A, B, e) {
  const pa = paletteOf(A), pb = paletteOf(B);
  if (pa === pb) return null;
  const n = Math.max(pa.length, pb.length);
  const even = (p) => resample(p.map((rgb, i) => ({ pos: p.length === 1 ? 0 : i / (p.length - 1), rgb })), n);
  const ra = even(pa), rb = even(pb), lin = [0, 0, 0];
  const lab = (c) => linearToOklab(srgbToLinear(c[0] / 255), srgbToLinear(c[1] / 255), srgbToLinear(c[2] / 255));
  return ra.map((ca, i) => {
    const la = lab(ca), lb = lab(rb[i]);
    oklabToLinear(la[0] + (lb[0] - la[0]) * e, la[1] + (lb[1] - la[1]) * e, la[2] + (lb[2] - la[2]) * e, lin);
    return lin.map((v) => Math.round(srgbEncode(v) * 255));
  });
}

const ease = (t) => t * t * (3 - 2 * t);

/** The view at time t (seconds) along a flight of keyframes, each held `seconds` apart. */
export function flightView(keys, t, seconds) {
  if (!keys.length) return null;
  if (keys.length === 1) return { ...keys[0] };
  const seg = Math.min(keys.length - 2, Math.max(0, Math.floor(t / seconds)));
  const u = Math.min(1, Math.max(0, (t - seg * seconds) / seconds));
  return between(keys[seg], keys[seg + 1], ease(u));
}

export function between(A, B, e) {
  const sA = A.scale, sB = B.scale;
  const s = Math.exp(Math.log(sA) * (1 - e) + Math.log(sB) * e);
  const cA = viewCentre(A), cB = viewCentre(B);
  const bits = bitsForScale(Math.min(sA, sB, s));
  const dx = decDiff(cA.re, cB.re, bits), dy = decDiff(cA.im, cB.im, bits);
  const w = Math.abs(sA - sB) > 1e-12 * Math.max(sA, sB) ? (s - sB) / (sA - sB) : 1 - e;
  const re = offsetDec(cB.re, dx * w, s), im = offsetDec(cB.im, dy * w, s);
  const lerp = (a, b) => (a == null || b == null ? (e < 0.5 ? a : b) : a + (b - a) * e);
  const blend = blendPalettes(A, B, e);
  const cola = A.colouring || {}, colb = B.colouring || {};
  return {
    ...(e < 0.5 ? A : B),
    re, im, cx: parseFloat(re), cy: parseFloat(im), scale: s,
    maxIter: Math.round(lerp(A.maxIter || 500, B.maxIter || 500)),
    colouring: { ...(e < 0.5 ? cola : colb), density: lerp(cola.density ?? 1, colb.density ?? 1), offset: lerp(cola.offset ?? 0, colb.offset ?? 0) },
    ...(blend ? { gradient: blend } : {}),
  };
}

// ── WebM (Matroska) writer ────────────────────────────────────────────────────────────────────
// EBML element IDs (Matroska specification, RFC 9559).
const ID = {
  EBML: 0x1a45dfa3, EBMLVersion: 0x4286, EBMLReadVersion: 0x42f7, EBMLMaxIDLength: 0x42f2, EBMLMaxSizeLength: 0x42f3,
  DocType: 0x4282, DocTypeVersion: 0x4287, DocTypeReadVersion: 0x4285,
  Segment: 0x18538067, Info: 0x1549a966, TimestampScale: 0x2ad7b1, MuxingApp: 0x4d80, WritingApp: 0x5741, Duration: 0x4489,
  Tracks: 0x1654ae6b, TrackEntry: 0xae, TrackNumber: 0xd7, TrackUID: 0x73c5, TrackType: 0x83, CodecID: 0x86,
  Video: 0xe0, PixelWidth: 0xb0, PixelHeight: 0xba, CodecPrivate: 0x63a2,
  Cluster: 0x1f43b675, Timestamp: 0xe7, SimpleBlock: 0xa3,
};
function idBytes(id) { const b = []; while (id > 0) { b.unshift(id & 255); id = Math.floor(id / 256); } return b; }
function sizeBytes(n) {   // EBML variable-length size, 8 bytes always (simple and valid)
  const b = [0x01];
  for (let i = 6; i >= 0; i--) b.push(Math.floor(n / 2 ** (8 * i)) & 255);
  return b;
}
function uint(v) { const b = []; do { b.unshift(v & 255); v = Math.floor(v / 256); } while (v > 0); return b; }
function float64(v) { const b = new Uint8Array(8); new DataView(b.buffer).setFloat64(0, v); return [...b]; }
function str(s) { return [...new TextEncoder().encode(s)]; }
function el(id, payload) {
  const data = payload instanceof Uint8Array ? payload : Uint8Array.from(payload);
  const head = Uint8Array.from([...idBytes(id), ...sizeBytes(data.length)]);
  const out = new Uint8Array(head.length + data.length);
  out.set(head); out.set(data, head.length);
  return out;
}
function cat(parts) {
  const n = parts.reduce((a, p) => a + p.length, 0);
  const out = new Uint8Array(n);
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

/** Mux encoded chunks ({ data, timestampMs, key }) into a WebM Blob. */
export function muxWebM({ width, height, codec, chunks, durationMs, codecPrivate = null }) {
  const header = el(ID.EBML, cat([
    el(ID.EBMLVersion, uint(1)), el(ID.EBMLReadVersion, uint(1)), el(ID.EBMLMaxIDLength, uint(4)), el(ID.EBMLMaxSizeLength, uint(8)),
    el(ID.DocType, str("webm")), el(ID.DocTypeVersion, uint(4)), el(ID.DocTypeReadVersion, uint(2)),
  ]));
  const info = el(ID.Info, cat([el(ID.TimestampScale, uint(1000000)), el(ID.MuxingApp, str("harperz9 studio")), el(ID.WritingApp, str("harperz9 studio")), el(ID.Duration, float64(durationMs))]));
  const video = el(ID.Video, cat([el(ID.PixelWidth, uint(width)), el(ID.PixelHeight, uint(height))]));
  const track = el(ID.TrackEntry, cat([
    el(ID.TrackNumber, uint(1)), el(ID.TrackUID, uint(1)), el(ID.TrackType, uint(1)), el(ID.CodecID, str(codec)), video,
    ...(codecPrivate ? [el(ID.CodecPrivate, codecPrivate)] : []),
  ]));
  const tracks = el(ID.Tracks, track);
  // One cluster per second; block timestamps are relative to the cluster (signed 16 bits).
  const clusters = [];
  let start = 0, blocks = [];
  const flush = () => { if (blocks.length) clusters.push(el(ID.Cluster, cat([el(ID.Timestamp, uint(start)), ...blocks]))); blocks = []; };
  for (const c of chunks) {
    const ts = Math.round(c.timestampMs);
    if (!blocks.length) start = ts;
    else if (ts - start >= 1000 || c.key) { flush(); start = ts; }
    const rel = ts - start;
    const head = Uint8Array.from([0x81, (rel >> 8) & 255, rel & 255, c.key ? 0x80 : 0x00]);
    blocks.push(el(ID.SimpleBlock, cat([head, c.data])));
  }
  flush();
  const segment = el(ID.Segment, cat([info, tracks, ...clusters]));
  return new Blob([header, segment], { type: "video/webm" });
}

/**
 * Render a flight to WebM. draw(view, canvas) draws one frame; returns a Blob. Each frame is drawn
 * and encoded in turn, so the video is as smooth as its frame rate however slow the frames are.
 */
export async function renderFlightVideo({ keys, seconds, fps = 30, width = 1280, height = 720, draw, onProgress = () => {}, bitrate = 12e6 }) {
  if (typeof VideoEncoder === "undefined") throw new Error("this browser has no WebCodecs VideoEncoder");
  const configs = [
    { codec: "vp09.00.40.08", webm: "V_VP9" },
    { codec: "vp8", webm: "V_VP8" },
  ];
  let chosen = null;
  for (const c of configs) {
    const cfg = { codec: c.codec, width, height, bitrate, framerate: fps };
    try { const s = await VideoEncoder.isConfigSupported(cfg); if (s.supported) { chosen = { ...c, cfg }; break; } } catch (_) { /* try the next */ }
  }
  if (!chosen) throw new Error("no VP9 or VP8 encoder in this browser");
  const chunks = [];
  let failure = null;
  const enc = new VideoEncoder({
    output: (chunk) => { const d = new Uint8Array(chunk.byteLength); chunk.copyTo(d); chunks.push({ data: d, timestampMs: chunk.timestamp / 1000, key: chunk.type === "key" }); },
    error: (e) => { failure = e; },
  });
  enc.configure(chosen.cfg);
  const canvas = document.createElement("canvas");
  canvas.width = width; canvas.height = height;
  const total = Math.max(1, Math.round((keys.length - 1) * seconds * fps)) + 1;
  for (let f = 0; f < total; f++) {
    if (failure) throw failure;
    const v = flightView(keys, f / fps, seconds);
    draw(v, canvas);
    const frame = new VideoFrame(canvas, { timestamp: Math.round(f * 1e6 / fps), duration: Math.round(1e6 / fps) });
    enc.encode(frame, { keyFrame: f % (fps * 2) === 0 });
    frame.close();
    if (enc.encodeQueueSize > 8) await new Promise((r) => setTimeout(r, 0));
    onProgress(f + 1, total);
    if (f % 4 === 3) await new Promise((r) => setTimeout(r, 0));
  }
  await enc.flush();
  enc.close();
  if (failure) throw failure;
  return muxWebM({ width, height, codec: chosen.webm, chunks, durationMs: total * 1000 / fps });
}
