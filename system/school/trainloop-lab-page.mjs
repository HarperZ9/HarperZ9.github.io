// Pylon's training dock: train the attention model from scratch in this page with your own settings
// (step size, batch, clipping, weight decay, laps), and watch the held-out loss and the copy rate
// against the film's run. Mounted on a press. A guess first, never scored; a real end.
import { frame } from "./trainloop-lab-view.mjs";
import { createLoop } from "./trainloop.mjs";
import { createModel, evaluate } from "./tinyformer.mjs";
import { heldOut } from "./corpus.mjs";
import { el, backend, fitCanvas } from "../lessons/stage.mjs";
import { GUIDES } from "../../media/school/shared/lib.mjs";

const j = (p) => fetch(new URL(p, import.meta.url)).then((r) => r.json());
const option = (value, text) => el("option", { value, text });
const EVERY = 25;

export async function mount(box, { force2d = false } = {}) {
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const [sans, mono, M, F] = await Promise.all([j("../../media/explainers/motion/hanken-500.json"), j("../../media/explainers/motion/conso-400.json"), j("../../media/school/attention/model.json"), j("../../media/school/trainloop/facts.json")]);
  const A = { sans, mono, atlas: sans }, held = heldOut(64, M.config.ctx);
  box.replaceChildren();
  box.classList.add("ns", "lab");
  const canvas = el("canvas", { class: "ns-canvas", width: "1280", height: "720", role: "img", "aria-label": "A track round the dock with four stations and a cart at the current lap; a tally board with your run's held-out loss in rust and its copy rate in blue, over the film's run in faint ink." });
  const status = el("p", { class: "ns-status", "aria-live": "polite" });
  const guess = el("input", { type: "number", id: "tl2-guess", min: "0", max: "2000", step: "50", value: "300", class: "lab-num", inputmode: "numeric" });
  const go = el("button", { type: "button", class: "ns-btn ns-go" }, "Open the dock");
  const intro = el("div", { class: "ns-intro" }, [el("p", { text: "Pylon: Before we start. With the film's settings, after how many laps will the model first copy a word from far back right nine times in ten?" }),
    el("label", { for: "tl2-guess", text: "My guess " }), guess, go, el("p", { class: "ns-note", text: "Your guess is never scored. It is shown beside the measurement, at the end." })]);
  const sel = (id, items, value) => { const n = el("select", { id, class: "lab-select" }, items.map(([v, t]) => option(String(v), t))); n.value = String(value); return n; };
  const lr = sel("tl2-lr", [[0.001, "step size 0.001"], [0.003, "step size 0.003"], [0.01, "step size 0.01"], [0.03, "step size 0.03"], [0.1, "step size 0.1"]], 0.01);
  const batch = sel("tl2-batch", [[4, "batch 4"], [16, "batch 16"], [64, "batch 64"]], 16);
  const clip = sel("tl2-clip", [[1, "clip at 1"], [1e9, "no clipping"]], 1);
  const decay = sel("tl2-decay", [[0.01, "weight decay 0.01"], [0, "no weight decay"]], 0.01);
  const laps = sel("tl2-laps", [[250, "250 laps"], [500, "500 laps"], [1000, "1,000 laps"]], 500);
  const train = el("button", { type: "button", class: "ns-btn" }, "Train"), stop = el("button", { type: "button", class: "ns-btn ns-quiet" }, "Stop"), done = el("button", { type: "button", class: "ns-btn ns-quiet" }, "I'm done");
  const controls = el("div", { class: "lab-controls", hidden: "" }, [el("div", { class: "lab-row" }, [lr, batch, clip, decay, laps]), el("div", { class: "lab-row" }, [train, stop]), el("div", { class: "ns-acts" }, [done])]);
  const end = el("div", { class: "ns-end", hidden: "" });
  box.append(canvas, status, intro, controls, end);

  const be = await backend(canvas, A, { reduced, force2d, title: "Pylon's training dock", images: GUIDES.pylon.textures() });
  const s = { step: 0, lap: 0, steps: 500, curve: [], film: F.reproduce.curve, running: false, settings: "" };
  let frameNo = 0, job = 0;
  const draw = () => be.draw(frame(s, A, performance.now() / 1000), frameNo++);
  const say = () => { const p = s.curve.at(-1); status.textContent = p ? `${s.settings}: lap ${p.step}, held-out loss ${p.heldOut.toFixed(2)} on 64 held-out rows, copies ${Math.round(p.copyAccuracy * 100)}%${s.running ? "" : "."}` : "Choose the settings and press Train."; };
  const point = (model, step) => { const e = evaluate(model, held); s.curve.push({ step, heldOut: e.loss, copyAccuracy: e.copyAccuracy }); };
  const run = () => {
    const id = ++job, model = createModel(M.weights.config, M.seed), o = { lr: +lr.value, batch: +batch.value, clip: +clip.value, weightDecay: +decay.value, seed: M.dataSeed };
    const loop = createLoop(model, o);
    s.steps = +laps.value; s.step = 0; s.curve = []; s.running = true;
    s.settings = `step size ${o.lr}, batch ${o.batch}, ${o.clip > 1e6 ? "no clipping" : `clip at ${o.clip}`}, ${o.weightDecay ? `weight decay ${o.weightDecay}` : "no weight decay"}`;
    point(model, 0);
    // Train in slices so the page stays responsive; each slice ends with a held-out check.
    const slice = () => {
      if (id !== job) return;
      const t0 = performance.now();
      while (s.step < s.steps && performance.now() - t0 < 40) { loop.step(); s.step++; s.lap = s.step / 4; if (s.step % EVERY === 0) point(model, s.step); }
      if (s.step >= s.steps) { s.running = false; if (s.curve.at(-1).step !== s.step) point(model, s.step); }
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
    const first = F.reproduce.summary.firstCopyStep;
    end.replaceChildren(el("h3", { text: "The cart is in" }), el("ul", {}, [
      el("li", { text: `Your guess: ${guess.value} laps. With the film's settings the model first copies right nine times in ten at lap ${first}, measured every 25 laps on 256 held-out rows.` }),
      el("li", { text: `After ${F.recipe.model.steps.toLocaleString("en")} laps: held-out loss ${F.reproduce.summary.heldOut.toFixed(2)}, copies ${Math.round(F.reproduce.summary.copyAccuracy * 100)}%. A step size ten times larger, for 1,000 laps: ${F.variants.runs.find((r) => r.name === "lrHigh").summary.heldOut.toFixed(2)}.` })]),
      el("p", { class: "ns-close", text: "Pylon: Batch, forward, loss, backward, step. The loop is simple; the settings are where the care goes." }));
    end.hidden = false;
  });
  say(); draw();
  return { backend: be.kind };
}
