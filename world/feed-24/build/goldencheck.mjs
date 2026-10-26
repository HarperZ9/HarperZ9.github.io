// goldencheck.mjs: golden-image check for rendered output. SSIM (Wang et al. 2004) from the lettering
// library on a box-downsampled luma thumbnail. A missing golden fails the test unless UPDATE_GOLDEN=1,
// and an existing golden is never overwritten by the run, so a regression cannot become the new truth.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { ssim, thumb, encode, decode } from '../../lettering/lib/ssim.mjs';

const DIR = new URL('./golden/', import.meta.url);

export function golden(name, field, w, h, { tw = 96, th = null, min = 0.985 } = {}) {
  const TH = th ?? Math.max(8, Math.round(tw * h / w)), t = thumb(field, w, h, tw, TH), file = new URL(`${name}.json`, DIR);
  if (!existsSync(file)) {
    if (process.env.UPDATE_GOLDEN === '1') { writeFileSync(file, JSON.stringify({ name, w: tw, h: TH, data: encode(t) })); return { created: true, score: 1 }; }
    throw new Error(`golden ${name} missing; run with UPDATE_GOLDEN=1 once and look at the render before trusting it`);
  }
  const g = JSON.parse(readFileSync(file, 'utf8'));
  if (g.w !== tw || g.h !== TH) throw new Error(`golden ${name}: size ${g.w}x${g.h} against ${tw}x${TH}`);
  const score = ssim(decode(g.data), decode(encode(t)), tw, TH);
  return { created: false, score, pass: score >= min };
}

// QUALITY-SPEC S5 at full resolution: mean SSIM >= 0.995 and the worst 32 px tile >= 0.97.
// Goldens are stored as 8-bit luma at the render's own size.
export function goldenFull(name, field, w, h, { mean = 0.995, tile = 0.97 } = {}) {
  const file = new URL(`${name}.full.json`, DIR);
  if (!existsSync(file)) {
    if (process.env.UPDATE_GOLDEN === '1') { writeFileSync(file, JSON.stringify({ name, w, h, data: encode(field) })); return { created: true, mean: 1, worst: 1 }; }
    throw new Error(`golden ${name} missing; run with UPDATE_GOLDEN=1 once and look at the render before trusting it`);
  }
  const g = JSON.parse(readFileSync(file, 'utf8'));
  if (g.w !== w || g.h !== h) throw new Error(`golden ${name}: size ${g.w}x${g.h} against ${w}x${h}`);
  const a = decode(g.data), b = decode(encode(field)), m = ssim(a, b, w, h);
  let worst = 1;
  for (let y = 0; y + 32 <= h; y += 32) for (let x = 0; x + 32 <= w; x += 32) {
    const ta = new Float32Array(1024), tb = new Float32Array(1024);
    for (let j = 0; j < 32; j++) for (let i = 0; i < 32; i++) { ta[j * 32 + i] = a[(y + j) * w + x + i]; tb[j * 32 + i] = b[(y + j) * w + x + i]; }
    worst = Math.min(worst, ssim(ta, tb, 32, 32));
  }
  return { created: false, mean: m, worst, pass: m >= mean && worst >= tile };
}
