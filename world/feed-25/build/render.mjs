// render.mjs: render the pieces to lossless PNG and the animated piece to WebM (ffmpeg, an R&D tool).
//   node render.mjs [--size 3840] [--only sheet-one,glyph-field] [--out out] [--anim] [--anim-size 1080]
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { encodePNG } from '../../feed-23/build/brush/png.js';
import { readPPM } from './sources.mjs';
import { PIECES } from './pieces.mjs';
import { spawn } from 'node:child_process';
import * as Anim from './anim.mjs';

export const FFMPEG = process.env.FFMPEG ?? 'ffmpeg-win-x86_64-v7.1.exe';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d; };
const deflate = async (b) => zlib.deflateSync(b, { level: 6 });

export function loadPlates(dir = path.join(HERE, 'plates')) {
  const meta = JSON.parse(fs.readFileSync(path.join(dir, 'plates.json'), 'utf8')), out = {};
  for (const [k, m] of Object.entries(meta)) out[k] = readPPM(new Uint8Array(fs.readFileSync(path.join(dir, `${k}.ppm`))), { title: m.title, year: m.year });
  return out;
}

export async function writePNG(file, w, h, rgba) { fs.writeFileSync(file, await encodePNG(w, h, rgba, deflate)); }

const run = (args, input) => new Promise((res, rej) => { const p = spawn(FFMPEG, args, { stdio: [input ? 'pipe' : 'ignore', 'ignore', 'pipe'] }); let err = ''; p.stderr.on('data', (d) => { err += d; });
  p.on('close', (c) => (c ? rej(new Error(`ffmpeg exit ${c}: ${err.slice(-600)}`)) : res())); if (input) input(p.stdin); });

// The animated piece: 120 unique frames after a warm-up loop, each written twice (24 fps on twos), as
// 16-bit RGBA into ffmpeg. Master: AV1 10-bit CRF 18 in WebM. Web: H.264 MP4 and a poster PNG.
// The seam is measured: mean |last - first| against the median step between frames, on 8-bit luma.
export async function renderAnim(size, out) {
  const st = Anim.createFeedback(size), t0 = Date.now();
  for (let i = 0; i < Anim.UNIQUE; i++) Anim.step(st);
  const master = path.join(out, 'feedback-plate.webm'), frames = [], lum = [];
  for (let i = 0; i < Anim.UNIQUE; i++) {
    const r = Anim.step(st), f = r.sheet.out({ grain: r.grain, depth: 16 }); frames.push(f);
    const L = new Float32Array(size * size); for (let p = 0; p < L.length; p++) L[p] = (f[4 * p] * 0.2126 + f[4 * p + 1] * 0.7152 + f[4 * p + 2] * 0.0722) / 257; lum.push(L);
    if (i === 0) await writePNG(path.join(out, 'feedback-plate-poster.png'), size, size, f);
  }
  const d = (a, b) => { let s = 0; for (let p = 0; p < a.length; p++) s += Math.abs(a[p] - b[p]); return s / a.length; };
  const steps = lum.slice(1).map((L, i) => d(L, lum[i])).sort((a, b) => a - b), seam = d(lum[lum.length - 1], lum[0]);
  await run(['-y', '-f', 'rawvideo', '-pix_fmt', 'rgba64le', '-s', `${size}x${size}`, '-r', String(Anim.FPS), '-i', '-', '-c:v', 'libaom-av1', '-crf', '18', '-b:v', '0', '-cpu-used', '6', '-row-mt', '1',
    '-pix_fmt', 'yuv420p10le', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709', master], (w) => {
    let i = 0; const next = () => { while (i < frames.length * 2) { const f = frames[i >> 1]; i++; if (!w.write(Buffer.from(f.buffer, f.byteOffset, f.byteLength))) { w.once('drain', next); return; } } w.end(); }; next(); });
  await run(['-y', '-i', master, '-c:v', 'libx264', '-crf', '16', '-preset', 'slow', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', path.join(out, 'feedback-plate.mp4')]);
  return { size, fps: Anim.FPS, unique_fps: Anim.UNIQUE_FPS, loop_s: Anim.LOOP_S, frames: frames.length * 2, seam_diff: +seam.toFixed(3), step_diff_median: +steps[steps.length >> 1].toFixed(3), seconds: (Date.now() - t0) / 1000 };
}

async function main() {
  const depth = +arg('depth', 16), size = +arg('size', 3840), only = arg('only', ''), out = path.resolve(HERE, arg('out', 'out'));
  fs.mkdirSync(out, { recursive: true });
  const plates = loadPlates(), meta = {};
  if (process.argv.includes('--anim')) meta['feedback-plate'] = await renderAnim(+arg('anim-size', 1080), out);
  for (const [name, P] of Object.entries(PIECES)) {
    if (only && !only.split(',').includes(name)) continue;
    const t0 = Date.now(), r = await P.render(size, { plates });
    const rgba = r.sheet.out({ grain: r.grain, depth });
    await writePNG(path.join(out, `${name}.png`), r.sheet.w, r.sheet.h, rgba);
    meta[name] = { ...r.meta, size, grain: r.grain, seconds: (Date.now() - t0) / 1000 };
    console.log(name, size, `${meta[name].seconds}s`);
  }
  const mf = path.join(out, 'meta.json'), prev = fs.existsSync(mf) ? JSON.parse(fs.readFileSync(mf, 'utf8')) : {};
  fs.writeFileSync(mf, JSON.stringify({ ...prev, ...meta }, null, 1));
}


if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) await main();
