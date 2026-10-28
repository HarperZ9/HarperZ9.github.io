// dist.mjs: distributions as first-class values. sample() draws with a seeded source; hold() gives the value a held
// (deterministic) node uses: the mean for continuous kinds, the heaviest option for a choice.
// A recipe parameter may be a distribution, written { dist: 'uniform', min, max } (or normal, lognormal, choice);
// graph.mjs draws it from the node's own substream, or holds it when the recipe says hold: true.

export function sample(d, r) {
  switch (d.kind ?? d.dist) {
    case 'uniform': return d.min + (d.max - d.min) * r();
    case 'normal': return (d.mean ?? 0) + (d.sd ?? 1) * gauss(r);
    case 'lognormal': return Math.exp((d.mean ?? 0) + (d.sd ?? 1) * gauss(r));
    case 'choice': { const w = d.weights ?? d.options.map(() => 1), t = w.reduce((a, b) => a + b, 0) * r(); let s = 0; for (let i = 0; i < w.length; i++) { s += w[i]; if (t < s) return d.options[i]; } return d.options.at(-1); }
    default: throw new Error(`dist: unknown kind ${d.kind ?? d.dist}`);
  }
}
export function hold(d) {
  switch (d.kind ?? d.dist) {
    case 'uniform': return (d.min + d.max) / 2;
    case 'normal': return d.mean ?? 0;
    case 'lognormal': return Math.exp((d.mean ?? 0) + (d.sd ?? 1) ** 2 / 2);
    case 'choice': { const w = d.weights ?? d.options.map(() => 1); return d.options[w.indexOf(Math.max(...w))]; }
    default: throw new Error(`dist: unknown kind ${d.kind ?? d.dist}`);
  }
}
export const isDist = v => v && typeof v === 'object' && !Array.isArray(v) && typeof v.dist === 'string';
function gauss(r) { const u = Math.max(1e-12, r()), v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
