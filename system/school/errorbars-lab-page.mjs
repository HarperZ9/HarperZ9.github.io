// Rerun's bucket: resample the attention model's held-out rows (or single words) and watch the
// interval form, or draw fresh rows from the rules again and again and count how often the interval
// holds the known truth. Mounted on a press. A guess first, never scored; a real end.
import { frame } from "./errorbars-lab-view.mjs";
import { scoreItems, firstRows, unitsOf, scoreOf, createBootstrap, createCoverage } from "./errorbars.mjs";
import { fromJSON } from "./tinyformer.mjs";
import { heldOut } from "./corpus.mjs";
import { el, backend, fitCanvas } from "../lessons/stage.mjs";

const j = (p) => fetch(new URL(p, import.meta.url)).then((r) => r.json());
const option = (value, text) => el("option", { value, text });

export async function mount(box, { force2d = false } = {}) {
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const [sans, mono, M, F] = await Promise.all([j("../../media/explainers/motion/hanken-500.json"), j("../../media/explainers/motion/conso-400.json"), j("../../media/school/attention/model.json"), j("../../media/school/errorbars/facts.json")]);
  const A = { sans, mono, atlas: sans }, ctx = M.config.ctx, all = scoreItems(fromJSON(M.weights), heldOut(1024, ctx)), truth = F.coverage.truth;
  box.replaceChildren();
  box.classList.add("ns", "lab");
  const canvas = el("canvas", { class: "ns-canvas", width: "1280", height: "720", role: "img", "aria-label": "Rerun's prism at the tide line: resampled scores fall as beads with their middle 95 percent bracketed, or intervals from fresh draws stacked against the known truth." });
  const status = el("p", { class: "ns-status", "aria-live": "polite" });
  const guess = el("input", { type: "number", id: "eb-guess", min: "0", max: "100", step: "1", value: "50", class: "lab-num", inputmode: "numeric" });
  const go = el("button", { type: "button", class: "ns-btn ns-go" }, "Open the bucket");
  const intro = el("div", { class: "ns-intro" }, [el("p", { text: "Rerun: Before we start. Draw 64 fresh rows from the rules a hundred times and build a 95 percent interval on each. How many hold the true average?" }),
    el("label", { for: "eb-guess", text: "My guess " }), guess, go, el("p", { class: "ns-note", text: "Your guess is never scored. It is shown beside the measurement, at the end." })]);
  const sel = (id, items, value) => { const n = el("select", { id, class: "lab-select" }, items.map(([v, t]) => option(String(v), t))); n.value = String(value); return n; };
  const mode = sel("eb-mode", [["boot", "resample the model's rows"], ["cover", "draw fresh rows from the rules"]], "boot");
  const rows = sel("eb-rows", [[16, "16 rows"], [64, "64 rows"], [256, "256 rows"], [1024, "1,024 rows"]], 64);
  const unit = sel("eb-unit", [["row", "resample rows"], ["word", "resample single words"]], "row");
  const run = el("button", { type: "button", class: "ns-btn" }, "Draw"), done = el("button", { type: "button", class: "ns-btn ns-quiet" }, "I'm done");
  const controls = el("div", { class: "lab-controls", hidden: "" }, [el("div", { class: "lab-row" }, [mode, rows, unit]), el("div", { class: "lab-row" }, [run]), el("div", { class: "ns-acts" }, [done])]);
  const end = el("div", { class: "ns-end", hidden: "" });
  box.append(canvas, status, intro, controls, end);

  const be = await backend(canvas, A, { reduced, force2d, title: "Rerun's bucket" });
  const s = { mode: "boot", rows: 64, unit: "row", point: 0, stats: [], interval: null, range: [0.55, 0.85], trials: [], truth, running: false };
  let frameNo = 0, job = 0;
  const draw = () => be.draw(frame(s, A, performance.now() / 1000), frameNo++);
  const say = () => {
    if (s.mode === "boot") status.textContent = s.interval ? `${s.rows} rows, resampling ${s.unit === "row" ? "rows" : "words"}: score ${s.point.toFixed(4)}, ${s.stats.length} resamples, middle 95% ${s.interval.lo.toFixed(4)} to ${s.interval.hi.toFixed(4)}${s.running ? "" : "."}` : "Choose rows and press Draw.";
    else { const h = s.trials.filter((r) => r[`${s.unit}Pct`].hit).length; status.textContent = s.trials.length ? `${s.trials.length} fresh draws of ${s.rows} rows: ${h} intervals held the truth ${truth.toFixed(4)}${s.running ? "" : "."}` : "Press Draw to take fresh rows from the rules."; }
  };
  const settings = () => { s.mode = mode.value; s.rows = +rows.value; s.unit = unit.value; s.stats = []; s.interval = null; s.trials = []; };
  const start = () => {
    const id = ++job; settings(); s.running = true;
    let tick;
    if (s.mode === "boot") {
      const u = unitsOf(firstRows(all, s.rows), "loss", s.unit), b = createBootstrap(u, 1);
      s.point = scoreOf(u); s.range = [s.point - 0.15, s.point + 0.15];
      tick = () => {
        b.step(100); s.stats = b.stats; s.interval = b.interval();
        // Fix the axis once 200 resamples show the spread: the interval with its own width either side.
        if (s.stats.length === 200) { const w = s.interval.hi - s.interval.lo; s.range = [s.interval.lo - w, s.interval.hi + w]; }
        return s.stats.length >= 2000;
      };
    } else {
      const c = createCoverage({ rows: Math.min(s.rows, 64), truth, seed: 1, resamples: 400 }); s.rows = Math.min(s.rows, 64);
      tick = () => { c.step(); s.trials = c.trials; return s.trials.length >= 100; };
    }
    // Work in 40 ms slices so the page stays responsive; redraw each slice.
    const slice = () => {
      if (id !== job) return;
      const t0 = performance.now();
      let fin = false;
      while (!fin && performance.now() - t0 < 40) fin = tick();
      if (fin) s.running = false;
      say(); draw();
      if (s.running) setTimeout(slice, 0);
    };
    slice();
  };
  fitCanvas(canvas, be, draw); // the first state (nothing drawn yet) is drawable as it is
  for (const n of [mode, rows, unit]) n.addEventListener("change", () => { if (!s.running) { settings(); say(); draw(); } });
  run.addEventListener("click", start);
  go.addEventListener("click", () => { intro.hidden = true; controls.hidden = false; say(); draw(); });
  done.addEventListener("click", () => {
    job++; s.running = false;
    const R = F.coverage.runs;
    end.replaceChildren(el("h3", { text: "The bucket is empty" }), el("ul", {}, [
      el("li", { text: `Your guess: ${guess.value} of 100. Over 1,000 fresh draws of 64 rows, ${(R.rows64.rowPct.coverage * 100).toFixed(1)}% of row intervals held the truth; resampling single words, ${(R.rows64.wordPct.coverage * 100).toFixed(1)}%.` }),
      el("li", { text: `With each of 16 rows copied four times, intervals that treat the copies as new rows held it ${(R.rows16x4.rowPct.coverage * 100).toFixed(1)}% of the time; resampling the 16, ${(R.rows16x4.clusterPct.coverage * 100).toFixed(1)}%.` })]),
      el("p", { class: "ns-close", text: "Rerun: Draw again from whatever was drawn at random." }));
    end.hidden = false;
  });
  say(); draw();
  return { backend: be.kind };
}
