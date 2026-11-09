// lib/io.mjs: node-only file output for the feed-29 and feed-28 builds. PNG through the feed-23 encoder (8-bit
// preview, 16-bit master), golden thumbnails, and frame sequences to H.264 and AV1 through the imageio ffmpeg build.
import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { deflateSync } from 'node:zlib';
import { spawnSync } from 'node:child_process';
import { encodePNG } from '../../../feed-23/build/brush/png.js';
import { encode, luma8 } from './field.mjs';
import { thumb, encode as enc64, decode as dec64, ssim } from '../../../lettering/lib/ssim.mjs';

export const FFMPEG = 'ffmpeg-win-x86_64-v7.1.exe';
const ensure = p => mkdirSync(dirname(p), { recursive: true });

export async function writePNG(path, R, opts = {}) {
  ensure(path);
  const px = encode(R, opts);
  writeFileSync(path, await encodePNG(R.w, R.h, px, b => deflateSync(b, { level: 6 })));
  return px;
}

// Golden check (QUALITY-SPEC S5): a 64 x 64 luma thumbnail plus 16 x 16 per-channel thumbnails, stored as base64.
// First run writes the golden; later runs return the SSIM against it. UPDATE_GOLDEN=1 rewrites.
export function golden(file, name, rgba, w, h) {
  const n = w * h, L = thumb(luma8(rgba, n), w, h, 64, 64);
  const ch = [0, 1, 2].map(c => thumb(Float32Array.from({ length: n }, (_, i) => rgba[4 * i + c] / 255), w, h, 16, 16));
  const db = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {};
  if (!db[name] || process.env.UPDATE_GOLDEN === '1') { db[name] = { L: enc64(L), ch: ch.map(enc64) }; ensure(file); writeFileSync(file, JSON.stringify(db, null, 1)); return { mean: 1, created: true, chroma: 0 }; }
  const g = db[name], mean = ssim(L, dec64(g.L), 64, 64);
  const chroma = Math.max(...ch.map((c, k) => { const d = dec64(g.ch[k]); let m = 0; for (let i = 0; i < c.length; i++) m = Math.max(m, Math.abs(c[i] - d[i])); return m; }));
  return { mean, created: false, chroma };
}

// Pipe raw RGBA frames to ffmpeg. frames: async (i) => Uint8ClampedArray. Writes H.264 (yuv420p, crf 16) and returns
// the path; AV1 10-bit master when av1 is set and the encoder exists.
export async function writeVideo(path, w, h, fps, count, frame, { crf = 16, av1 = false } = {}) {
  ensure(path);
  const raw = Buffer.alloc(w * h * 4 * count);
  for (let i = 0; i < count; i++) Buffer.from((await frame(i)).buffer).copy(raw, i * w * h * 4);
  const base = ['-y', '-v', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${w}x${h}`, '-r', String(fps), '-i', '-'];
  const r = spawnSync(FFMPEG, [...base, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', String(crf), '-preset', 'slow', '-movflags', '+faststart', path], { input: raw, maxBuffer: 1 << 30 });
  if (r.status !== 0) throw new Error(`ffmpeg h264 failed: ${r.stderr}`);
  if (av1) {
    const a = spawnSync(FFMPEG, [...base, '-c:v', 'libaom-av1', '-pix_fmt', 'yuv420p10le', '-crf', '18', '-b:v', '0', '-cpu-used', '6', path.replace(/\.mp4$/, '.av1.webm')], { input: raw, maxBuffer: 1 << 30 });
    if (a.status !== 0) console.error(`ffmpeg av1 master skipped: ${String(a.stderr).slice(0, 200)}`);
  }
  return path;
}
