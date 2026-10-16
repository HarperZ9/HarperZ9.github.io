// Rerun's three instruments: train the attention model from scratch in this page and, at each
// checkpoint, score 64 fresh rows three ways (loss, exact match, two judges) with bootstrap
// intervals. Mounted on a press. A guess first, never scored; a real end.
import { frame } from "./evaluate-lab-view.mjs";
import { makeEvalSet, pairSet, createScorer, units } from "./evaluate.mjs";
import { createEvalTrainer, recipeSeeds } from "./evaluate-train.mjs";
import { bootstrapInterval, scoreOf } from "./errorbars.mjs";
import { createModel } from "./tinyformer.mjs";
import { el, backend, fitCanvas } from "../lessons/stage.mjs";

const j = (p) => fetch(new URL(p, import.meta.url)).then((r) => r.json());
const option = (value, text) => el("option", { value, text });
const MARKS = [200, 600, 1000, 2000];

export async function mount(box, { force2d = false } = {}) {
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const [sans, mono, M, F] = await Promise.all([j("../../media/explainers/motion/hanken-500.json"), j("../../media/explainers/motion/conso-400.json"), j("../../media/school/attention/model.json"), j("../../media/school/evaluate/facts.json")]);
  const A = { sans, mono, atlas: sans }, set = makeEvalSet(F.recipe.sets.B.seed, 64, M.config.ctx), pairs = pairSet(F.recipe.pairSeed, F.recipe.pairRows);
  box.replaceChildren();
  box.classList.add("ns", "lab");
  const canvas = el("canvas", { class: "ns-canvas", width: "1280", height: "720", role: "img", "aria-label": "Rerun's prism splitting one model into three score bands, exact match, a perfect judge and a cheap judge, with the loss beside them, at each checkpoint of a run trained in this page." });
  const status = el("p", { class: "ns-status", "aria-live": "polite" });
  const guess = el("input", { type: "number", id: "ev-guess", min: "0", max: "100", step: "1", value: "50", class: "lab-num", inputmode: "numeric" });
  const go = el("button", { type: "button", class: "ns-btn ns-go" }, "Set up the instruments");
  const intro = el("div", { class: "ns-intro" }, [el("p", { text: "Rerun: Before we start. At step 200 the model gets about one one-answer question in five right. What share of its free writing will the cheap judge pass, in percent?" }),
    el("label", { for: "ev-guess", text: "My guess " }), guess, go, el("p", { class: "ns-note", text: "Your guess is never scored. It is shown beside the measurement, at the end." })]);
  const steps = el("select", { id: "ev-steps", class: "lab-select" }, MARKS.map((m) => option(String(m), `train to step ${m.toLocaleString("en")}`)));
  steps.value = "600";
  const train = el("button", { type: "button", class: "ns-btn" }, "Train and score"), stop = el("button", { type: "button", class: "ns-btn ns-quiet" }, "Stop"), done = el("button", { type: "button", class: "ns-btn ns-quiet" }, "I'm done");
  const controls = el("div", { class: "lab-controls", hidden: "" }, [el("div", { class: "lab-row" }, [steps]), el("div", { class: "lab-row" }, [train, stop]), el("div", { class: "ns-acts" }, [done])]);
  const end = el("div", { class: "ns-end", hidden: "" });
  box.append(canvas, status, intro, controls, end);

  const be = await backend(canvas, A, { reduced, force2d, title: "Rerun's three instruments" });
  const s = { marks: [], step: 0, scoring: false, running: false };
  let frameNo = 0, job = 0;
  const draw = () => be.draw(frame(s, A, performance.now() / 1000), frameNo++);
  const last = () => s.marks.at(-1);
  const say = () => { const m = last(); status.textContent = m ? `step ${m.step}: loss ${m.loss.mean.toFixed(2)}, exact match ${Math.round(m.exact.mean * 100)}%, perfect judge ${Math.round(m.perfect.mean * 100)}%, cheap judge ${Math.round(m.fluent.mean * 100)}% on 64 fresh rows${s.running ? "" : "."}` : s.running ? `training: step ${s.step}` : "Choose how far to train and press Train and score."; };
  const summarise = (rows, step) => { const r = { step }; for (const k of ["loss", "exact", "perfect", "fluent"]) { const u = units(rows, k); r[k] = { ...bootstrapInterval(u, { resamples: 400, seed: 1 }), mean: scoreOf(u) }; } return r; };
  const run = () => {
    const id = ++job, target = +steps.value, sd = recipeSeeds(M, 1), model = createModel(M.config, sd.model), tr = createEvalTrainer(model, { seed: sd.data, batch: M.batch, lr: M.lr });
    s.marks = []; s.step = 0; s.running = true;
    let scorer = null;
    // Train in 40 ms slices; at each checkpoint, score the 64 rows (16 rows a slice) before going on.
    const slice = () => {
      if (id !== job) return;
      const t0 = performance.now();
      while (performance.now() - t0 < 40 && s.running) {
        if (scorer) { scorer.step(); if (scorer.done) { s.marks.push(summarise(scorer.rows, s.step)); scorer = null; if (s.step >= target) s.running = false; } continue; }
        tr.step(); s.step++;
        if (MARKS.includes(s.step) && s.step <= target) scorer = createScorer(model, set, { pairs, genSeed: F.recipe.genSeed });
      }
      say(); draw();
      if (s.running) setTimeout(slice, 0);
    };
    slice();
  };
  fitCanvas(canvas, be, draw); // the first state (no run yet) is drawable as it is
  train.addEventListener("click", run);
  stop.addEventListener("click", () => { job++; s.running = false; say(); draw(); });
  go.addEventListener("click", () => { intro.hidden = true; controls.hidden = false; say(); draw(); });
  done.addEventListener("click", () => {
    job++; s.running = false;
    const a = F.checkpoints.across["200"];
    end.replaceChildren(el("h3", { text: "The instruments are packed" }), el("ul", {}, [
      el("li", { text: `Your guess: ${guess.value}%. At step 200, over three runs and 512 rows, the cheap judge passed ${Math.round(a.fluent.mean * 100)}% of the writing, the perfect judge ${Math.round(a.perfect.mean * 100)}%, and exact match was ${Math.round(a.exact.mean * 100)}%.` }),
      el("li", { text: `Of the writing the perfect judge rejected, the cheap judge still passed ${Math.round(F.judges.perSeed["1"]["200"].falseAccept * 100)}% in the first run.` })]),
      el("p", { class: "ns-close", text: "Rerun: Ask what a score can see before you trust what it says." }));
    end.hidden = false;
  });
  say(); draw();
  return { backend: be.kind };
}
