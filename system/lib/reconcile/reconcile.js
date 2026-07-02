// reconcile -- THE engine. One organ in, one witnessed World out, via the full loop:
//   perceive (seed → rough draft) → generate → critique → refine (toward correct + novel) →
//   choreograph (timeline) → witness (World + receipt).
// create() does a single organ; compose() (re-exported) layers several. The trajectory IS the
// reasoning; the receipt makes every World reproducible and re-checkable.
import "./organs/index.js"; // register the organ library
import { getOrgan, seedParams } from "./organ.js";
import { refine, evaluate } from "./refine.js";
import { palette as makePalette } from "./palette.js";
import { makeLayer, makeWorld } from "./world.js";
import { buildTimeline } from "./temporal.js";
import { Corpus } from "./corpus.js";
import { tag } from "./criteria.js";

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const weakest = (m) => Object.keys(m).reduce((a, b) => (m[b] < m[a] ? b : a));
const r4 = (x) => Math.round(x * 1e4) / 1e4;

export function create(organId, opts = {}) {
  const { seed = 0, scheme = "analogous", refine: doRefine = true, maxSteps = 24, corpus = null } = opts;
  const organ = getOrgan(organId);
  if (!organ) throw new Error(`unknown organ ${organId}`);
  const pal = makePalette(seed, 6, scheme), corp = corpus || new Corpus();
  const start = seedParams(organ, seed);

  let result;
  if (doRefine) {
    result = refine(organ, start, { corpus: corp, maxSteps });
  } else {
    const ev = evaluate(organ, start, corp);
    result = {
      params: start, features: ev.features, margins: ev.margins, cohesion: r4(ev.cohesion),
      converged: false, tag: tag(ev.cohesion),
      trajectory: [{ index: 0, params: start, margins: ev.margins, cohesion: r4(ev.cohesion), weakest: weakest(ev.margins) }],
    };
  }

  const layer = makeLayer(organ, result.params, pal, { role: "render", z: 0 });
  const timeline = buildTimeline(organ, result.params);
  corp.add(result.features); // the made work grounds future novelty
  return makeWorld({
    seed, title: `${cap(organId)} #${seed}`, layers: [layer],
    trajectory: { steps: result.trajectory, accepted: result.params, cohesion: result.cohesion, tag: result.tag, converged: result.converged },
    timeline, palette: pal,
  });
}

export { compose } from "./compose.js";
