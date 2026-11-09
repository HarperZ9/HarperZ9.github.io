// Tallow's rudder: teach the trained model a new habit (things keep their look) by changing every
// number, only the readout or last floor, or fitting LoRA strips of a chosen rank; train it in this
// page and watch the change to one table, the new habit and the old skill. Mounted on a press. A
// guess first, never scored; a real end.
import { frame } from "./lora-lab-view.mjs";
import { createFinetuner } from "./lora.mjs";
import { taskSource, taskHeld } from "./lora-task.mjs";
import { scoreTask } from "./lora-measure.mjs";
import { fromJSON, evaluate } from "./tinyformer.mjs";
import { heldOut } from "./corpus.mjs";
import { el, backend, fitCanvas } from "../lessons/stage.mjs";

const j = (p) => fetch(new URL(p, import.meta.url)).then((r) => r.json());
const option = (value, text) => el("option", { value, text });
const EVERY = 50, MAT = "l1.wqkv", K = 32, OUT = 96;
const LABEL = { full: "every number", readout: "the readout only", lastLayer: "the last floor", "lora.attn.r1": "LoRA rank 1, attention", "lora.attn.r4": "LoRA rank 4, attention", "lora.attn.r8": "LoRA rank 8, attention", "lora.all.r1": "LoRA rank 1, every table", "lora.all.r4": "LoRA rank 4, every table", "lora.all.r8": "LoRA rank 8, every table" };
const SPEC = (k) => (k.startsWith("lora.") ? { kind: "lora", targets: k.split(".")[1], rank: +k.split(".r")[1], alpha: 8, seed: 51 } : { kind: k });
const rows = (flat) => Array.from({ length: K }, (_, i) => Array.from(flat.subarray(i * OUT, (i + 1) * OUT)));

export async function mount(box, { force2d = false } = {}) {
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const [sans, mono, M, F] = await Promise.all([j("../../media/explainers/motion/hanken-500.json"), j("../../media/explainers/motion/conso-400.json"), j("../../media/school/attention/model.json"), j("../../media/school/lora/facts.json")]);
  const A = { sans, mono, atlas: sans, rows: [] }, ctx = M.config.ctx, base = fromJSON(M.weights), task = taskHeld(64, ctx), orig = heldOut(64, ctx);
  box.replaceChildren();
  box.classList.add("ns", "lab");
  const canvas = el("canvas", { class: "ns-canvas", width: "1280", height: "720", role: "img", "aria-label": "A grid of 32 by 96 planks showing the change your run makes to one attention table, and a board with the new habit's accuracy and the old skill's accuracy over the training steps." });
  const status = el("p", { class: "ns-status", "aria-live": "polite" });
  const guess = el("input", { type: "number", id: "lr-guess", min: "0", max: "100", step: "1", value: "50", class: "lab-num", inputmode: "numeric" });
  const go = el("button", { type: "button", class: "ns-btn ns-go" }, "Open the boatyard");
  const intro = el("div", { class: "ns-intro" }, [el("p", { text: `Tallow: Before we start. Rank-1 strips on the attention tables train ${(F.methods.runs["lora.attn.r1"].shareOfFull * 100).toFixed(1)} percent of the model's numbers. What share of answers will they get right, in percent?` }),
    el("label", { for: "lr-guess", text: "My guess " }), guess, go, el("p", { class: "ns-note", text: "Your guess is never scored. It is shown beside the measurement, at the end." })]);
  const method = el("select", { id: "lr-method", class: "lab-select" }, Object.entries(LABEL).map(([k, t]) => option(k, t)));
  method.value = "lora.attn.r1";
  const steps = el("select", { id: "lr-steps", class: "lab-select" }, [option("300", "300 steps"), option("600", "600 steps"), option("1500", "1,500 steps")]);
  steps.value = "600";
  const train = el("button", { type: "button", class: "ns-btn" }, "Train"), stop = el("button", { type: "button", class: "ns-btn ns-quiet" }, "Stop"), done = el("button", { type: "button", class: "ns-btn ns-quiet" }, "I'm done");
  const controls = el("div", { class: "lab-controls", hidden: "" }, [el("div", { class: "lab-row" }, [method, steps]), el("div", { class: "lab-row" }, [train, stop]), el("div", { class: "ns-acts" }, [done])]);
  const end = el("div", { class: "ns-end", hidden: "" });
  box.append(canvas, status, intro, controls, end);

  const be = await backend(canvas, A, { reduced, force2d, title: "Tallow's rudder" });
  const W0 = base.params[MAT], zero = rows(new Float64Array(K * OUT)), scale = Math.max(...F.film.fullChange.map(Math.abs)) * 0.6;
  const s = { change: zero, scale, method: "", trained: 0, total: F.methods.runs.full.trained, strips: "", steps: 600, curve: [], film: F.methods.runs.full.curveSeed1, running: false, step: 0 };
  let frameNo = 0, job = 0, nextDraw = 0;
  const draw = () => be.draw(frame(s, A, performance.now() / 1000), frameNo++);
  const point = (m, step) => s.curve.push({ step, answer: scoreTask(m, task).answer.accuracy, copy: evaluate(m, orig).copyAccuracy });
  const say = () => { const p = s.curve.at(-1); status.textContent = p ? `${LABEL[method.value]}: step ${p.step}, answer right ${Math.round(p.answer * 100)}% on 64 new-habit rows; old look-back words ${Math.round(p.copy * 100)}% right on 64 held-out rows${s.running ? "" : "."}` : "Choose a method and press Train."; };
  const run = () => {
    const id = ++job, k = method.value, R = F.methods.runs[k];
    const ft = createFinetuner(base, SPEC(k), taskSource({ seed: 301, batch: M.batch, ctx }), { lr: R.lr, batch: M.batch });
    s.method = LABEL[k]; s.trained = ft.trained; s.steps = +steps.value; s.curve = []; s.step = 0; s.running = true;
    s.strips = ft.adapter ? `${SPEC(k).rank} pair${SPEC(k).rank > 1 ? "s" : ""} of ${K} + ${OUT} numbers on this table` : "";
    point(ft.model, 0);
    // Train in slices so the page stays responsive; both scores every 50 steps.
    const slice = () => {
      if (id !== job) return;
      const t0 = performance.now();
      let checked = false;
      while (s.step < s.steps && performance.now() - t0 < 40) {
        ft.step(); s.step++;
        if (s.step % EVERY === 0) { point(ft.model, s.step); checked = true; }
      }
      if (s.step >= s.steps) s.running = false;
      // The hull of 3,072 planks is redrawn only at each check: on a software adapter one frame
      // costs far more than a training slice.
      if (checked || !s.running) {
        const W = ft.model.params[MAT], d = new Float64Array(K * OUT);
        for (let i = 0; i < d.length; i++) d[i] = W[i] - W0[i];
        s.change = rows(d); nextDraw = 0;
      } else nextDraw = Infinity;
      say();
      if (!s.running || performance.now() >= nextDraw) draw();
      if (s.running) setTimeout(slice, 0);
    };
    slice();
  };
  fitCanvas(canvas, be, draw); // the first state (no change yet) is drawable as it is
  train.addEventListener("click", run);
  stop.addEventListener("click", () => { job++; s.running = false; say(); draw(); });
  go.addEventListener("click", () => { intro.hidden = true; controls.hidden = false; say(); draw(); });
  done.addEventListener("click", () => {
    job++; s.running = false;
    const r = F.methods.runs, pc = (v) => Math.round(v * 100);
    end.replaceChildren(el("h3", { text: "The boatyard is closed" }), el("ul", {}, [
      el("li", { text: `Your guess: ${guess.value}%. Over three seeds and 1,500 steps, rank-1 strips on the attention tables got ${pc(r["lora.attn.r1"].answer.mean)}% of answers right; the model before any training, ${pc(F.base.task.answer)}%.` }),
      el("li", { text: `Changing every number: ${pc(r.full.answer.mean)}%, with old look-back words falling from ${pc(F.forgetting.base.copyAccuracy)}% to ${pc(r.full.origCopy.mean)}%. Rank-8 strips on every table: ${pc(r["lora.all.r8"].answer.mean)}%.` })]),
      el("p", { class: "ns-close", text: "Tallow: Fit the smallest rudder that steers, and check what the old course lost." }));
    end.hidden = false;
  });
  say(); draw();
  return { backend: be.kind };
}
