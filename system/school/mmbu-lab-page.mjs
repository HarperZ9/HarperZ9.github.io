// Lesson S20's lab: redo the MMBU logbook's intervals from the published per-row scores, with the
// scorers' own bootstrap and numpy's random stream, and see whether the digits come out the same.
// Mounted on a press. A guess first, never scored; the run goes in slices so the page stays
// responsive; a real end.
import { frame } from "./mmbu-lab-view.mjs";
import { devBootstrap, clusterBootstrap, devSeries, difference, SEED, B } from "./mmbu.mjs";
import { el, backend, fitCanvas } from "../lessons/stage.mjs";
import { GUIDES } from "../../media/school/shared/lib.mjs";

const j = (p) => fetch(new URL(p, import.meta.url)).then((r) => r.json());
const option = (value, text) => el("option", { value, text });

// Each comparison: how to build the per-row series, the bar, the axis for the drawing, the published line.
export function comparisons(F) {
  const P = (x) => [x.mean, x.lo, x.hi], V = F.vocab.ft7minusFt6;
  const dev = (key, measure, a, b, title, what, bar, pub, axis) => ({ key, kind: "dev", measure, a, b, title, what, bar, published: P(pub), axis, d: 4, resamples: B });
  const held = (key, file, field, a, b, title, what, bar, pub, axis) => ({ key, kind: "held", file, field, a, b, title, what, bar, published: P(pub), axis, d: 5, resamples: B });
  return [
    dev("M1", "T", "FT6_4B", "FT5_4B", "M1: answers, FT6 minus FT5", "the answer-vocabulary rows, same start and recipe", { above: 0 }, F.ft6.M1, [-0.01, 0.03]),
    dev("K1", "T", "FT5_4B", "FT3A_4B", "K1: answers, FT5 minus FT3A", "a second pass over the same rows", { above: 0 }, F.ft5.K1, [-0.02, 0.02]),
    dev("N1", "C", "FT7_4B", "FT6_4B", "N1: context, FT7 minus FT6", "the relabel to the paper's words, with the slice 8 rows", { above: 0 }, F.ft7.N1, [-0.02, 0.2]),
    dev("N3", "T", "FT7_4B", "FT6_4B", "N3: answers, FT7 minus FT6", "answers must not fall by more than 0.01", { above: -0.01 }, F.ft7.N3, [-0.02, 0.02]),
    dev("N4", "adjS", "FT7_4B", "FT3A_4B", "N4: size-adjusted score, FT7 minus FT3A", "the candidacy bar", { above: 0 }, F.ft7.N4, [-0.01, 0.06]),
    held("N5", "task", "task", "ft7_4b", "ft3a_4b", "N5: held-out answers, FT7 minus FT3A", "by source cluster; must not fall by more than 0.02", { above: -0.02 }, F.ft7.N5, [-0.03, 0.05]),
    held("VO", "context", "context_original", "ft7_4b", "ft6_4b", "Held-out context, FT7 minus FT6, the sources' own key", "a measurement, not a preregistered test", { above: 0 }, V.original, [-0.15, 0.2]),
    held("VH", "context", "context_harmonised", "ft7_4b", "ft6_4b", "Held-out context, FT7 minus FT6, the key in the paper's words", "the same replies; a measurement, not a preregistered test", { above: 0 }, V.harmonised, [-0.15, 0.2]),
  ].map((c) => ({ ...c, ticks: ticks(c.axis) }));
}
function ticks([lo, hi]) { const step = (hi - lo) / 4, out = []; for (let k = 0; k <= 4; k++) out.push(Number((lo + k * step).toFixed(3))); return out; }

// Build the bootstrap for one comparison from the loaded data.
export function makeRun(c, D, seed = SEED) {
  if (c.kind === "dev") return devBootstrap(difference(devSeries(D.dev, c.a, c.measure), devSeries(D.dev, c.b, c.measure)), { seed });
  const H = c.file === "task" ? D.task : D.context;
  return clusterBootstrap(difference(H[c.field][c.a], H[c.field][c.b]), H.group_rank, { seed });
}
// Bins for the histogram. Answer differences are whole multiples of 1/n, so on a lattice the bin width is
// a whole number of lattice steps; otherwise a width of 1.03 steps aliases into a spike.
export function binned(means, done, [lo, hi], n = 120, lattice = 0) {
  if (lattice) n = Math.max(1, Math.floor(((hi - lo) * lattice) / Math.ceil(((hi - lo) * lattice) / n)));
  const w = lattice ? Math.ceil(((hi - lo) * lattice) / n) / lattice : (hi - lo) / n, bins = new Array(n).fill(0);
  for (let i = 0; i < done; i++) { const k = Math.floor((means[i] - lo) / w); if (k >= 0 && k < n) bins[k]++; }
  return bins;
}

export async function mount(box, { force2d = false } = {}) {
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const [sans, mono, F, dev, task, context] = await Promise.all([j("../../media/explainers/motion/hanken-500.json"), j("../../media/explainers/motion/conso-400.json"), j("../../media/school/mmbu/facts.json"),
    j("../../media/school/mmbu/data/dev_per_row.json"), j("../../media/school/mmbu/data/heldout_task_per_row.json"), j("../../media/school/mmbu/data/heldout_context_per_row.json")]);
  const A = { sans, mono, atlas: sans, rows: [] }, D = { dev, task, context }, C = comparisons(F);
  box.replaceChildren();
  box.classList.add("ns", "lab");
  const canvas = el("canvas", { class: "ns-canvas", width: "1280", height: "720", role: "img", "aria-label": "A logbook page: the comparison's bar as a pencil line, the resampled differences as a histogram, our interval inked under it and the logbook's published interval beside it." });
  const status = el("p", { class: "ns-status", "aria-live": "polite" });
  const guess = el("select", { id: "mb-guess", class: "lab-select" }, [option("yes", "yes, it clears zero"), option("no", "no, zero is inside")]);
  const go = el("button", { type: "button", class: "ns-btn ns-go" }, "Open the logbook");
  const intro = el("div", { class: "ns-intro" }, [el("p", { text: "Tallow: Before we start. The sixth run added rows in the labels' own words. On the practice answers, does its interval against the fifth run clear zero?" }),
    el("label", { for: "mb-guess", text: "My guess " }), guess, go, el("p", { class: "ns-note", text: "Your guess is never scored. It is shown beside the result, at the end." })]);
  const pick = el("select", { id: "mb-pick", class: "lab-select" }, C.map((c) => option(c.key, c.title)));
  const seed = el("select", { id: "mb-seed", class: "lab-select" }, [option(String(SEED), `seed ${SEED} (the scorers')`), option("1", "seed 1"), option("2", "seed 2"), option("3", "seed 3")]);
  const redo = el("button", { type: "button", class: "ns-btn" }, "Redo the interval"), done = el("button", { type: "button", class: "ns-btn ns-quiet" }, "I'm done");
  const controls = el("div", { class: "lab-controls", hidden: "" }, [el("div", { class: "lab-row" }, [pick, seed]), el("div", { class: "lab-row" }, [redo]), el("div", { class: "ns-acts" }, [done])]);
  const end = el("div", { class: "ns-end", hidden: "" });
  box.append(canvas, status, intro, controls, end);

  const be = await backend(canvas, A, { reduced, force2d, title: "Tallow's logbook", images: GUIDES.tallow?.textures ? GUIDES.tallow.textures() : undefined });
  const s = { comparison: null, run: null };
  let frameNo = 0, job = 0;
  const draw = () => be.draw(frame(s, A, performance.now() / 1000), frameNo++);
  const say = () => {
    const c = s.comparison, r = s.run?.result;
    if (!c) { status.textContent = "Choose a comparison and a seed, and press Redo the interval."; return; }
    if (!r) { status.textContent = `${c.title}: resampling.`; return; }
    const full = r.resamples === c.resamples, met = r.lo > c.bar.above;
    status.textContent = `${c.title}, seed ${s.seed}: ${r.mean > 0 ? "+" : ""}${r.mean.toFixed(c.d)} [${r.lo.toFixed(c.d)}, ${r.hi.toFixed(c.d)}] from ${r.resamples.toLocaleString("en")} of ${c.resamples.toLocaleString("en")} resamples` +
      (full ? `; the logbook printed [${c.published[1].toFixed(c.d)}, ${c.published[2].toFixed(c.d)}]: ${r.equal ? "the same digits" : "different digits"}; bar ${met ? "met" : "missed"}.` : ".");
  };
  const start = () => {
    const c = C.find((x) => x.key === pick.value), sd = +seed.value, me = ++job, bt = makeRun(c, D, sd);
    s.comparison = c; s.seed = sd; s.run = { bins: [], result: null };
    const tick = () => {
      if (me !== job) return;
      bt.step(reduced ? 2000 : 400);
      const r = bt.result(c.d), full = bt.done === c.resamples;
      s.run = { bins: binned(bt.means, bt.done, c.axis, 120, c.kind === "dev" && c.measure === "T" ? bt.n : 0), result: { ...r, equal: full && r.mean === c.published[0] && r.lo === c.published[1] && r.hi === c.published[2] } };
      say(); draw();
      if (!full) setTimeout(tick, 0);
    };
    say(); tick();
  };
  fitCanvas(canvas, be, draw); // the first state (nothing run yet) is drawable as it is
  redo.addEventListener("click", start);
  go.addEventListener("click", () => { intro.hidden = true; controls.hidden = false; say(); draw(); });
  done.addEventListener("click", () => {
    job++;
    const M = F.ft6.M1, R = F.recomputed;
    end.replaceChildren(el("h3", { text: "The logbook goes back on the shelf" }), el("ul", {}, [
      el("li", { text: `Your guess: ${guess.value === "yes" ? "it clears zero" : "zero is inside"}. The logbook: M1 was +${M.mean} [${M.lo}, ${M.hi}], so it clears zero.` }),
      el("li", { text: `With the scorers' seed, ${Object.values(R).filter((x) => x && x.equal).length} of the logbook's intervals come out to the same digits from these scores; with another seed they move in the third or fourth decimal.` }),
      el("li", { text: "This re-derives the arithmetic from the published scores. It does not check that the scores themselves are right, or when the bars were written: that is the ledger's job, and the lesson says where it falls short." })]),
      el("p", { class: "ns-close", text: "Tallow: Same scores, same seed, same digits. That much anyone can check." }));
    end.hidden = false;
  });
  say(); draw();
  return { backend: be.kind };
}
