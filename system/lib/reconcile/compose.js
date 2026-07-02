// Compose -- layer organs into one witnessed World, scored by a composition criterion (depth
// complementarity + contrast balance). The reconcile's compose() at the scene level; each layer is
// itself refined toward correct. Ported from studio-engine compose.py.
import { getOrgan, seedParams } from "./organ.js";
import { refine } from "./refine.js";
import { palette as makePalette } from "./palette.js";
import { makeLayer, makeWorld } from "./world.js";
import { Corpus } from "./corpus.js";
import { cohesion, tag } from "./criteria.js";

const r4 = (x) => Math.round(x * 1e4) / 1e4;

export function compositionAxes(layerFeats) {
  const covs = layerFeats.map((f) => f.coverage);
  const cons = layerFeats.map((f) => f.contrast);
  const depth = covs.length > 1 ? Math.min(1, (Math.max(...covs) - Math.min(...covs)) / 0.6) : 0.5;
  const mc = cons.reduce((s, x) => s + x, 0) / (cons.length || 1);
  const balance = Math.max(0, 1 - Math.abs(mc - 0.5) * 2);
  return { depth_complementarity: r4(depth), contrast_balance: r4(balance) };
}

export function compose(organIds, opts = {}) {
  const { seed = 0, scheme = "analogous", maxSteps = 16, corpus = null } = opts;
  if (!organIds || !organIds.length) throw new Error("compose needs at least one organ");
  const pal = makePalette(seed, 6, scheme), corp = corpus || new Corpus();
  const layers = [], feats = [];
  organIds.forEach((id, i) => {
    const o = getOrgan(id);
    if (!o) throw new Error(`unknown organ ${id}`);
    const r = refine(o, seedParams(o, seed), { corpus: corp, maxSteps });
    corp.add(r.features); feats.push(r.features);
    layers.push(makeLayer(o, r.params, pal, { role: "render", z: o.kind === "field" ? i - 10 : i + 10, blend: i === 0 ? "normal" : "screen" }));
  });
  layers.sort((a, b) => a.z - b.z);
  const axes = compositionAxes(feats), score = cohesion(Object.values(axes));
  return makeWorld({
    seed, title: "Composite: " + organIds.join(" + "), layers, palette: pal,
    composition: { tag: tag(score), score: r4(score), axes },
  });
}
