// lib/feed30.mjs: one entry point for the five feed-30 generators, shared by the type engine materials, the
// lettering techniques, the superframe nodes and the render script. Every call takes a skeleton (lib/skel.mjs)
// and returns a raster with straight alpha (transparent where nothing is drawn) unless a ground is given.
import * as M from './manyfold.mjs';
import { grow } from './swash.mjs';
import { substitute } from './vessel.mjs';
import { marquetry, toneFromSkeleton } from './marquetry.mjs';
import { bubbly } from './bubbly.mjs';
import { withCoverage } from './skel.mjs';
import { canvas, paint, hexLin, over, clamp } from './raster.mjs';

export const KINDS = Object.freeze(['fill', 'outline', 'halftone', 'scan', 'split', 'swash', 'vessel', 'marquetry', 'bubbly']);

/** Coverage renderings of build (a), painted in one ink. */
function inked(sk, kind, o) {
  const cov = kind === 'fill' ? M.fill(sk) : kind === 'outline' ? M.outline(sk, o) : kind === 'halftone' ? M.halftoneTri(sk, o) : M.scan(sk, o);
  return paint(canvas(sk.w, sk.h, o.ground ?? null), cov, hexLin(o.ink ?? '#15130f'));
}

/** The spectral split of any coverage rendering, as light on a dark panel (opaque). */
function splitLight(sk, o) {
  const base = o.of === 'fill' ? M.fill(sk) : o.of === 'outline' ? M.outline(sk, o) : o.of === 'halftone' ? M.halftoneTri(sk, o) : M.scan(sk, o);
  const L = M.split(base, sk.w, sk.h, o), R = canvas(sk.w, sk.h, o.ground ?? '#07070b');
  for (let i = 0; i < sk.w * sk.h; i++) { for (let c = 0; c < 3; c++) R.data[i * 4 + c] += L[i * 3 + c] * (o.gain ?? 1); R.data[i * 4 + 3] = 1; }
  return R;
}

/** Render one generator. o: that generator's options plus { ground, ink }. */
export function render(kind, sk, o = {}) {
  if (['fill', 'outline', 'halftone', 'scan'].includes(kind)) return inked(sk, kind, o);
  if (kind === 'split') return splitLight(sk, o);
  if (kind === 'swash') {
    const S = grow(sk, o), sk2 = withCoverage(sk, S.cov, S.strokes), cov = o.as === 'outline' ? M.outline(sk2, o) : S.cov;
    const R = paint(canvas(sk.w, sk.h, o.ground ?? null), cov, hexLin(o.ink ?? '#15130f')); R.swash = S; R.skeleton = sk2; return R;
  }
  if (kind === 'vessel') { const V = substitute(sk, o); return o.ground ? over(canvas(sk.w, sk.h, o.ground), V.R) : V.R; }
  if (kind === 'marquetry') return marquetry(sk.w, sk.h, { tone: toneFromSkeleton(sk, o), ...o });
  if (kind === 'bubbly') { const B = bubbly(sk, o); return o.ground ? over(canvas(sk.w, sk.h, o.ground), B.R) : B.R; }
  throw new Error(`feed30: unknown kind "${kind}" (one of ${KINDS.join(', ')})`);
}

/** Coverage of a raster's alpha (for gates and tests). */
export const alphaOf = (R) => { const a = new Float32Array(R.w * R.h); for (let i = 0; i < a.length; i++) a[i] = clamp(R.data[i * 4 + 3]); return a; };
