// spread.mjs: how a wash spreads on a ground, cell by cell. Pure: no page, runs in node and the browser.
//
// The well's solver spreads each pigment between a cell and its eight neighbours. How much passes over each link is a
// conductance, and this file makes the conductances. A ground can spread the same way everywhere (a uniform map, from
// its `wick`: [along x, along y]), or by a tensor that changes from cell to cell:
//
//   uniformLinks(wick)          the same two rates in every cell; this is what every ground had before this file
//   tensorLinks(K)              from a tensor per cell, [Kxx, Kxy, Kyy]: the eight links of the fibre module's own stencil
//   fibreLinks(name, opts)      a sheet of paper as a random network of fibres: the site's fibre module
//                               (media/raw-native/tree-ada041f/web/shaders/fibre/fibre.mjs), used as it is: its fibre
//                               network (paperField), its capillary tensor (tensors) and its eight-link stencil (links)
//
// A map is { e, s, se, sw }: for each cell, the conductance to its east, south, south-east and south-west neighbour. The
// link from a cell to its west neighbour is that neighbour's east link, and so on, so every link is shared by the two
// cells it joins: what one cell gives the other takes.
import { resolveFibre, paperField, tensors, links } from '../../../media/raw-native/tree-ada041f/web/shaders/fibre/fibre.mjs';
import { NX, NY } from './grid.mjs';

const N = NX * NY, cache = new Map();
const blank = () => ({ e: new Float32Array(N), s: new Float32Array(N), se: new Float32Array(N), sw: new Float32Array(N) });
export function uniformLinks([ax, ay] = [1, 1]) {
  const key = `u${ax},${ay}`; if (cache.has(key)) return cache.get(key);
  const m = blank(); m.e.fill(ax); m.s.fill(ay); m.uniform = [ax, ay]; cache.set(key, m); return m;
}
// K holds three numbers per cell. Each cell's own eight links come from links(); a shared link is the mean of what the
// two cells it joins say, as the fibre module's own wash does.
export function tensorLinks(K) {
  const own = new Float32Array(N * 8), m = blank();
  for (let i = 0; i < N; i++) links(K[i * 3], K[i * 3 + 1], K[i * 3 + 2]).forEach((l, j) => { own[i * 8 + j] = l[2]; });
  // links() order: +x, -x, +y, -y, (+1,+1), (-1,-1), (+1,-1), (-1,+1)
  for (let y = 0; y < NY; y++) for (let x = 0; x < NX; x++) { const i = y * NX + x, E = x < NX - 1 ? i + 1 : i, S = y < NY - 1 ? i + NX : i;
    const SE = x < NX - 1 && y < NY - 1 ? i + NX + 1 : i, SW = x > 0 && y < NY - 1 ? i + NX - 1 : i;
    m.e[i] = 0.5 * (own[i * 8] + own[E * 8 + 1]); m.s[i] = 0.5 * (own[i * 8 + 2] + own[S * 8 + 3]);
    m.se[i] = 0.5 * (own[i * 8 + 4] + own[SE * 8 + 5]); m.sw[i] = 0.5 * (own[i * 8 + 7] + own[SW * 8 + 6]); }
  return m;
}
// The fibre sheet's network. opts are the fibre module's own parameters over its 'rough' preset: md is the machine
// direction (0: along x), spread how far a fibre turns from it, k0 how fast a wash spreads where there is no fibre, k1
// how much faster along a fibre. The network is laid on the solver's grid, one pixel per cell.
export function fibreLinks(name, opts) {
  const key = `f${name}`; if (cache.has(key)) return cache.get(key);
  const plan = resolveFibre('rough', opts, { w: NX, h: NY }), F = paperField(plan), K = tensors(plan, F), m = tensorLinks(K);
  let cov = 0; for (let i = 0; i < N; i++) cov += F[i * 5];
  m.fibres = { coverage: cov / N, k0: plan.p.k0, k1: plan.p.k1, spread: plan.p.spread }; cache.set(key, m); return m;
}
// The mean conductance along x and along y over the whole map: a check on which way a map spreads a wash.
export function bias(m) { let ex = 0, sy = 0; for (let i = 0; i < N; i++) { ex += m.e[i] + 0.5 * (m.se[i] + m.sw[i]); sy += m.s[i] + 0.5 * (m.se[i] + m.sw[i]); } return [ex / N, sy / N]; }
