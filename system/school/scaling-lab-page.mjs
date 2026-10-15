// Tallow's shelf: build a model of any width and depth on the film's grid, train it in this page,
// and watch its gap above the floor against the work done, over the film's frontier. Mounted on a
// press. A guess first, never scored; a real end.
import { frame } from "./scaling-lab-view.mjs";
import { gridConfig, computeOf } from "./scaling.mjs";
import { createModel, lossAndGrad, createAdamState, adam, evaluate } from "./tinyformer.mjs";
import { DEFAULTS, lrAt } from "./trainloop.mjs";
import { freshSource } from "./data.mjs";
import { heldOut } from "./corpus.mjs";
import { el, backend, fitCanvas } from "../lessons/stage.mjs";

const j = (p) => fetch(new URL(p, import.meta.url)).then((r) => r.json());
const option = (value, text) => el("option", { value, text });
const EVERY = 50;

export async function mount(box, { force2d = false } = {}) {
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const [sans, mono, M, F] = await Promise.all([j("../../media/explainers/motion/hanken-500.json"), j("../../media/explainers/motion/conso-400.json"), j("../../media/school/attention/model.json"), j("../../media/school/scaling/facts.json")]);
  const A = { sans, mono, atlas: sans }, ctx = M.config.ctx, held = heldOut(M.heldOutRows, ctx);
  box.replaceChildren();
  box.classList.add("ns", "lab");
  const canvas = el("canvas", { class: "ns-canvas", width: "1280", height: "720", role: "img", "aria-label": "A shelf of twelve small lighthouses with your model's in ember, and a log-log chart of work against the gap above the floor, your run in blue over the film's frontier in rust." });
  const status = el("p", { class: "ns-status", "aria-live": "polite" });
  const guess = el("select", { id: "sl-guess", class: "lab-select" }, [option("small", "16 numbers, two floors"), option("big", "64 numbers, three floors"), option("same", "about the same")]);
  const go = el("button", { type: "button", class: "ns-btn ns-go" }, "Open the shelf");
  const intro = el("div", { class: "ns-intro" }, [el("p", { text: "Tallow: Before we start. Trained for 4,000 steps on the same text, which ends closer to the floor?" }),
    el("label", { for: "sl-guess", text: "My guess " }), guess, go, el("p", { class: "ns-note", text: "Your guess is never scored. It is shown beside the measurement, at the end." })]);
  const sel = (id, items, value) => { const n = el("select", { id, class: "lab-select" }, items.map(([v, t]) => option(String(v), t))); n.value = String(value); return n; };
  const width = sel("sl-d", [8, 16, 32, 64].map((v) => [v, `${v} numbers per word`]), 16);
  const depth = sel("sl-L", [1, 2, 3].map((v) => [v, `${v} floor${v > 1 ? "s" : ""}`]), 2);
  const laps = sel("sl-laps", [[250, "250 laps"], [500, "500 laps"], [1000, "1,000 laps"]], 500);
  const train = el("button", { type: "button", class: "ns-btn" }, "Train"), stop = el("button", { type: "button", class: "ns-btn ns-quiet" }, "Stop"), done = el("button", { type: "button", class: "ns-btn ns-quiet" }, "I'm done");
  const controls = el("div", { class: "lab-controls", hidden: "" }, [el("div", { class: "lab-row" }, [width, depth, laps]), el("div", { class: "lab-row" }, [train, stop]), el("div", { class: "ns-acts" }, [done])]);
  const end = el("div", { class: "ns-end", hidden: "" });
  box.append(canvas, status, intro, controls, end);

  const be = await backend(canvas, A, { reduced, force2d, title: "Tallow's shelf" });
  const s = { F, d: 16, L: 2, curve: [], step: 0, steps: 500, running: false };
  let frameNo = 0, job = 0;
  const draw = () => be.draw(frame(s, A, performance.now() / 1000), frameNo++);
  const say = () => { const p = s.curve.at(-1); status.textContent = p ? `${s.d} numbers per word, ${s.L} floor${s.L > 1 ? "s" : ""}: lap ${p.step}, held-out loss ${p.heldOut.toFixed(3)} on ${held.y.length.toLocaleString("en")} next words, ${p.excess > 0 ? `${p.excess.toFixed(3)} above the floor` : "at or below the floor on these rows"}${s.running ? "" : "."}` : "Choose a size and press Train."; };
  const run = () => {
    const id = ++job; s.d = +width.value; s.L = +depth.value; s.steps = +laps.value;
    const config = gridConfig(s.d, s.L), model = createModel({ ...M.weights.config, ...config }, M.seed), o = { ...DEFAULTS }, state = createAdamState(model), source = freshSource({ seed: M.dataSeed, ctx });
    const point = (step) => { const e = evaluate(model, held); s.curve.push({ step, heldOut: e.loss, excess: e.loss - F.floor, compute: computeOf(model.config, step).flops }); };
    s.curve = []; s.step = 0; s.running = true;
    point(0);
    // Train in slices so the page stays responsive; a held-out check every 50 laps.
    const slice = () => {
      if (id !== job) return;
      const t0 = performance.now();
      while (s.step < s.steps && performance.now() - t0 < 40) {
        const { x, y } = source.next(), { grads } = lossAndGrad(model, x, y, o.batch, ctx);
        adam(model, grads, state, { lr: lrAt(s.step, o.lr, o.warmup), weightDecay: o.weightDecay, clip: o.clip });
        s.step++;
        if (s.step % EVERY === 0) point(s.step);
      }
      if (s.step >= s.steps) s.running = false;
      say(); draw();
      if (s.running) setTimeout(slice, 0);
    };
    slice();
  };
  fitCanvas(canvas, be, draw); // the first state (no run yet) is drawable as it is
  train.addEventListener("click", run);
  stop.addEventListener("click", () => { job++; s.running = false; say(); draw(); });
  for (const n of [width, depth]) n.addEventListener("change", () => { if (!s.running) { s.d = +width.value; s.L = +depth.value; draw(); } });
  go.addEventListener("click", () => { intro.hidden = true; controls.hidden = false; say(); draw(); });
  done.addEventListener("click", () => {
    job++; s.running = false;
    const g = (d, L) => F.grid.runs.find((r) => r.config.dModel === d && r.config.nLayers === L).final, a = g(16, 2), b = g(64, 3);
    end.replaceChildren(el("h3", { text: "The shelf is dark" }), el("ul", {}, [
      el("li", { text: `Your guess: ${guess.selectedOptions[0].text}. After 4,000 steps, 16 numbers with two floors ends ${a.excess.toFixed(4)} above the floor and 64 with three floors ${b.excess.toFixed(4)}; three seeds of the smaller one spread from ${(F.noise.d16.heldOut.min - F.floor).toFixed(3)} to ${(F.noise.d16.heldOut.max - F.floor).toFixed(3)}, so the two cannot be told apart.` }),
      el("li", { text: `Along the frontier, the gap shrinks with work at a slope of ${F.frontier.fitExcess.slope.toFixed(2)} on the log-log chart.` })]),
      el("p", { class: "ns-close", text: "Tallow: Bigger helps until the text has nothing left to teach. On our shelf, that comes early." }));
    end.hidden = false;
  });
  say(); draw();
  return { backend: be.kind };
}
