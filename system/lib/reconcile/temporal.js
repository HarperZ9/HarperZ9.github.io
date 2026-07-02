// Temporal -- witnessed motion. For an animatable field, sample across one loop period and verify
// (a) continuity: the seam delta is no larger than the interior deltas (no pop), and (b) on-criterion:
// the dynamic range stays comparable across the loop (stays legible). Ported from studio-engine.
import { sampleField } from "./expr.js";
import { tag } from "./criteria.js";

const r4 = (x) => Math.round(x * 1e4) / 1e4;

export function buildTimeline(organ, params) {
  const art = organ.make(params);
  if (art.kind !== "field" || !art.animatable || !(art.period > 0)) return null;
  const k = 16, n = 12, frames = [];
  for (let j = 0; j < k; j++) frames.push(sampleField(art.expr, n, art.period * j / k));

  const deltas = [];
  for (let j = 0; j < k; j++) {
    const a = frames[j], b = frames[(j + 1) % k];
    let s = 0; for (let i = 0; i < a.length; i++) s += Math.abs(a[i] - b[i]);
    deltas.push(s / a.length);
  }
  const seam = deltas[deltas.length - 1], interior = deltas.slice(0, -1);
  const typ = interior.length ? Math.max(...interior) : seam;
  const all = frames.flat();
  const rng = (Math.max(...all) - Math.min(...all)) || 1e-6;
  const contScore = seam <= typ ? 1 : Math.max(0, 1 - (seam - typ) / rng);

  const ranges = frames.map((f) => Math.max(...f) - Math.min(...f));
  const mn = Math.min(...ranges), mx = Math.max(...ranges);
  const onScore = mx > 1e-6 ? mn / mx : 0;

  return {
    period: Math.round(art.period * 1e6) / 1e6,
    continuity: { tag: tag(contScore), score: r4(contScore) },
    on_criterion: { tag: tag(onScore), score: r4(onScore) },
  };
}
