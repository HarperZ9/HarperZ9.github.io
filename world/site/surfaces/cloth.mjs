// cloth.mjs: a woven ground, from the site's loom. Pure: no page, runs in node and the browser.
//
// The weave is the loom's own: system/weave-engine.js (the draft mathematics behind loom.html and the Studio's Loom)
// gives the threading, the tie-up, the treadling and liftAt(end, pick), which says whether the warp (the lengthwise
// thread) or the weft (the crosswise thread) lies on top at each crossing. Nothing of the engine is rewritten here.
// From that one draft this file makes the two things the well needs:
//
//   clothPixels(draft)    the cloth as a texture for the shader: which thread is on top, where across that thread a
//                         point lies (its round profile), where along its float (the run over the other threads) it
//                         lies, and how long that float is (a longer float catches more light, as satin does)
//   clothLinks(draft)     how a wash spreads in it (spread.mjs): fast along whichever thread is on top, slow across it,
//                         so a dye runs down the warp where the warp shows and along the weft where the weft shows
//
//   WEAVES, cleanLoom(loom)   the structures offered, and a recipe's loom setting, checked
//   threadSlot(pick, n)       which pigment a weft thread is spun from when the cloth is woven from the blend
// Our numbers: the thread count (48 ends by 36 picks across the well) and the two spreading rates. None is measured.
import { STRUCTURES, computeDraft } from '../../../system/weave-engine.js';
import { tensorLinks } from './spread.mjs';
import { NX, NY } from './grid.mjs';

export const ENDS = 48, PICKS = 36, TPX = 10, ALONG = 2.4, ACROSS = 0.3;
export const WEAVES = Object.freeze(['plain', 'twill22', 'satin5', 'overshot']);
export const weaveName = (id) => STRUCTURES[id]?.name ?? id;
export const cleanLoom = (l) => ({ weave: WEAVES.includes(l?.weave) ? l.weave : 'twill22', woven: l?.woven === true });
const drafts = new Map();
// The draft: an even grey, so the structure alone sets every crossing (the loom's tone steering is off).
export function draftOf(id = 'twill22') {
  const w = WEAVES.includes(id) ? id : 'twill22'; if (!drafts.has(w)) drafts.set(w, computeDraft(new Float32Array(ENDS * PICKS).fill(0.5), ENDS, PICKS, w, { toneDrive: 0 }));
  return drafts.get(w);
}
// The float a crossing belongs to: where it starts and how many crossings it runs, along the thread on top.
function float(d, e, p) {
  const up = d.liftAt(e, p), on = (i, j) => d.liftAt(i, j) === up;
  if (up) { let a = p, b = p; while (a > 0 && on(e, a - 1)) a--; while (b < d.picks - 1 && on(e, b + 1)) b++; return { up, start: a, len: b - a + 1 }; }
  let a = e, b = e; while (a > 0 && on(a - 1, p)) a--; while (b < d.ends - 1 && on(b + 1, p)) b++; return { up, start: a, len: b - a + 1 };
}
// R: 255 where the warp is on top. G: across the top thread, 0 to 255. B: along its float, 0 to 255. A: the float's length, 32 a crossing.
export function clothPixels(d, px = TPX) {
  const w = d.ends * px, h = d.picks * px, data = new Uint8Array(w * h * 4);
  for (let p = 0; p < d.picks; p++) for (let e = 0; e < d.ends; e++) { const f = float(d, e, p);
    for (let y = 0; y < px; y++) for (let x = 0; x < px; x++) { const o = ((p * px + y) * w + e * px + x) * 4, across = (f.up ? x : y) + 0.5, along = (f.up ? p - f.start : e - f.start) * px + (f.up ? y : x) + 0.5;
      data[o] = f.up ? 255 : 0; data[o + 1] = Math.round(255 * across / px); data[o + 2] = Math.round(255 * along / (f.len * px)); data[o + 3] = Math.min(255, 32 * f.len); } }
  return { w, h, data };
}
// The tensor per solver cell: the thread on top at that cell carries the wash along itself.
export function clothLinks(d) {
  const K = new Float64Array(NX * NY * 3);
  for (let y = 0; y < NY; y++) for (let x = 0; x < NX; x++) { const up = d.liftAt(Math.floor(x * d.ends / NX), Math.floor(y * d.picks / NY)), i = (y * NX + x) * 3;
    K[i] = up ? ACROSS : ALONG; K[i + 1] = 0; K[i + 2] = up ? ALONG : ACROSS; }
  return tensorLinks(K);
}
// The share of crossings where the warp is on top: a plain weave and a 2/2 twill show half, a satin mostly one side.
export function warpShare(d) { let up = 0; for (let p = 0; p < d.picks; p++) for (let e = 0; e < d.ends; e++) if (d.liftAt(e, p)) up++; return up / (d.ends * d.picks); }
// Woven from the blend: the warp is spun from the first pigment, and the weft takes the others in turn, pick by pick.
export const threadSlot = (pick, n) => (n > 1 ? 1 + (pick % (n - 1)) : 0);
