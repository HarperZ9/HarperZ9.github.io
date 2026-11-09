// lib/living/states-tiles.mjs: the word made of the tiles that make its letters (the name-art mosaic, folded in: its
// own layout and shading, name-art/lib/mosaic, read-only). Courses run along each stroke (andamento),
// the field is laid around them, and every tile takes the light. 'tiles' is Roman stone; 'tiles-code' carries a
// character of source in every tile (the Divisumma lesson of the v1 code mosaic).
import { layTiles } from '../../../name-art/lib/mosaic/andamento.mjs';
import { shade } from '../../../name-art/lib/mosaic/tesserae.mjs';
import { codeInk } from '../../../name-art/lib/mosaic/codecells.mjs';
import { STYLES } from '../../../name-art/lib/mosaic/index.mjs';
import { registerState } from './states.mjs';

function tiles(C, style) {
  const S = STYLES[style], T = Math.max(3, S.tile * C.size * 0.72 * (C.tileK ?? 1));
  const layout = layTiles(C.w, C.h, { sdf: C.sdf, strokes: C.G.strokes.strokes, tile: T, halo: C.halo ?? (style === 'andamento' ? 0 : S.halo), ratio: S.ratio, grout: Math.max(0.8, S.grout * T), fieldRatio: S.fieldRatio ?? 1, field: S.field ?? 'tessellatum', fieldScale: (S.fieldScale ?? 1.15) * 2, seed: C.seed }); // larger field stones: a quieter field behind the letters
  const ink = style === 'code' ? codeInk(C.w, C.h, layout, { cellRatio: S.ratio }) : null;
  const px = shade(C.w, C.h, layout, { zones: S.zones, light: [-0.55, -0.6, 0.6], grout: S.groutC, ink }).px;
  return matched(C, px, C.matchK ?? 0.55, C.fieldK ?? 0.5, C.deep ?? (style === 'andamento' ? 0.6 : 1));
}
// Grout matched to the tiles: inside the letters each pixel moves toward the letters' mean colour, in the field toward
// the field's mean, so the letters read as whole shapes and the tiles stay visible as a texture (stone mosaic read
// 100% OCR error with contrasting grout at every tile size tried, 2026-10-26).
function matched(C, px, kIn, kOut, deep) {
  const n = C.w * C.h, mIn = [0, 0, 0], mOut = [0, 0, 0]; let a = 0, b = 0;
  for (let i = 0; i < n; i++) { const inside = C.cov[i] > 0.5; for (let c = 0; c < 3; c++) (inside ? mIn : mOut)[c] += px[i * 3 + c]; inside ? a++ : b++; }
  for (let c = 0; c < 3; c++) { mIn[c] = (mIn[c] / Math.max(1, a)) * deep; mOut[c] /= Math.max(1, b); }
  for (let i = 0; i < n; i++) { const t = C.cov[i] > 0.5 ? kIn : kOut, m = C.cov[i] > 0.5 ? mIn : mOut; for (let c = 0; c < 3; c++) px[i * 3 + c] += (m[c] - px[i * 3 + c]) * t; }
  return px;
}
// Stone does not read to the bar: best variant (no outline courses, matched grout, deeper letter stone) 11% at 32 px and
// 16% at 96 px, first and last letters lost. It stays for art moments (createLiving({ unread: true })).
registerState({ id: 'tiles', title: 'Mosaic', kind: 'print', breath: { amp: 0, rate: 0 }, reads: false, measured: 'OCR 11% at 32 px, 16% at 96 px', paint: (C) => tiles(C, 'andamento') });
registerState({ id: 'tiles-code', title: 'Code mosaic', kind: 'digital', breath: { amp: 0, rate: 0 }, night: 'positive', paint: (C) => tiles(C, 'code') });
