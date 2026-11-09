// nodes.js: the feed-24 generators as nodes for the super framework (Synthesis-and-Design-Framework.md,
// section 9). The super framework folder did not exist when this was written, so the interface here is
// a proposal kept small: typed ports by medium, seeded parameters with units from each module's SPEC,
// and a pure run(inputs, params) that returns outputs keyed by port. No DOM; every node runs in node.
// Media: 'mask' { w, h, v: Float32Array }, 'spans' [{ x0, x1, code }], 'image' { w, h, rgba },
// 'points' { xyz: Float32Array, w: Float32Array, d: Float32Array, vis: Uint8Array }, 'state' terms,
// 'numbers' Uint8Array or number[][], 'labels' [{ x, y, text }], 'time' seconds.
import { scene, render as plateRender, placeLabels, SPEC as PLATE } from './construct.js';
import { makeState, sampleGrid, snapshot, advect, SPEC as ORB } from './orbital.js';
import { splatOpaque, extentOf, VIEW, SPEC as PAINT } from './orbital-render.js';
import { field, wordMatrix, SPEC as HAM } from './hamming.js';
import { tiles, render as mosaicRender, SPEC as MOSAIC } from './bitmosaic.js';
import { surface, toRGBA, hexLin, rng } from './raster.js';

const image = (S) => ({ w: S.w, h: S.h, rgba: toRGBA(S) });

export const NODES = [
  { id: 'feed24.plate', spec: PLATE,
    ports: { in: { mask: 'mask', time: 'time' }, out: { image: 'image', labels: 'labels', numbers: 'numbers' } },
    run({ mask, time = 0 }, p = {}) {
      const W = p.W ?? 1440, H = p.H ?? Math.round(W / 1.5), sc = scene(W, H, mask ? [{ mask: { cols: mask.w, rows: mask.h, v: mask.v }, square: 0 }] : [], time, p);
      const S = plateRender(surface(W, H, hexLin(sc.c.ground)), sc);
      return { image: image(S), labels: placeLabels(sc.tracked, 0, { W, H }), numbers: sc.tracked.map(t => [t.ux, t.uy]) };
    } },
  { id: 'feed24.orbital.sample', spec: ORB,
    ports: { in: { state: 'state', time: 'time' }, out: { points: 'points' } },
    run({ state, time = 0 }, p = {}) {
      const S = makeState(state), P = sampleGrid(S, p.count ?? 20000, rng(p.seed ?? 24), { t: 0 });
      if (time) advect(S, P, 0, time, Math.max(1, Math.ceil(time / 2)));
      const s = snapshot(S, P, time, p.keep ?? 0.82);
      return { points: { xyz: s.pos, w: s.w, d: s.d, vis: s.vis, extent: extentOf(P) } };
    } },
  { id: 'feed24.orbital.paint', spec: PAINT,
    ports: { in: { points: 'points' }, out: { image: 'image' } },
    run({ points }, p = {}) {
      const W = p.W ?? 600, rgba = new Uint8ClampedArray(W * W * 4);
      splatOpaque(rgba, W, W, points.xyz, points.w, { ...VIEW, ...p.view }, points.extent * 0.8, W / 600, { vis: points.vis, dens: points.d, radius: 1.6, relief: 0.2 });
      return { image: { w: W, h: W, rgba } };
    } },
  { id: 'feed24.bitfield', spec: HAM,
    ports: { in: {}, out: { numbers: 'numbers' } },
    run(_, p = {}) { return { numbers: field({ w: p.w ?? 256, h: p.h ?? 256, ...p }) }; } },
  { id: 'feed24.wordbits', spec: HAM,
    ports: { in: { a: 'text', b: 'text' }, out: { numbers: 'numbers' } },
    run({ a, b }) { return { numbers: wordMatrix(a, b) }; } },
  { id: 'feed24.bitmosaic', spec: MOSAIC,
    ports: { in: { mask: 'mask', spans: 'spans' }, out: { image: 'image' } },
    run({ mask, spans = [] }, p = {}) {
      const W = mask?.w ?? p.W ?? 640, H = mask?.h ?? p.H ?? 320;
      return { image: image(mosaicRender(surface(W, H, hexLin(p.ground ?? '#efe9de')), tiles(W, H, mask?.v ?? null, spans, p), p)) };
    } },
];

export const node = id => NODES.find(n => n.id === id);
