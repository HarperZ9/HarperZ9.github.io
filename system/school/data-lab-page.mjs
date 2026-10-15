// Pylon's crate yard: choose what goes into the training crates (how many episodes need a look
// back, how many labels are wrong, fresh rows or a small repeated pile), train the model in this
// page, and score it on held-out rows. Mounted on a press. A guess first, never scored; a real end.
import { frame } from "./data-lab-view.mjs";
import { freshSource, noisySource, poolSource, makeSpec, lookbackMix, scoreSet } from "./data.mjs";
import { createModel, lossAndGrad, createAdamState, adam, evaluate } from "./tinyformer.mjs";
import { DEFAULTS, lrAt } from "./trainloop.mjs";
import { heldOut } from "./corpus.mjs";
import { el, backend, fitCanvas } from "../lessons/stage.mjs";
import { GUIDES } from "../../media/school/shared/lib.mjs";

const j = (p) => fetch(new URL(p, import.meta.url)).then((r) => r.json());
const option = (value, text) => el("option", { value, text });
const EVERY = 25;

export async function mount(box, { force2d = false } = {}) {
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const [sans, mono, M, F] = await Promise.all([j("../../media/explainers/motion/hanken-500.json"), j("../../media/explainers/motion/conso-400.json"), j("../../media/school/attention/model.json"), j("../../media/school/data/facts.json")]);
  const A = { sans, mono, atlas: sans }, ctx = M.config.ctx, held = heldOut(64, ctx);
  box.replaceChildren();
  box.classList.add("ns", "lab");
  const canvas = el("canvas", { class: "ns-canvas", width: "1280", height: "720", role: "img", "aria-label": "A stack of ten crates on the dock coloured by kind of episode, with crosses for wrong labels; a board with your run's held-out loss and look-back accuracy over the film's default run." });
  const status = el("p", { class: "ns-status", "aria-live": "polite" });
  const guess = el("input", { type: "number", id: "dl2-guess", min: "0", max: "100", step: "1", value: "50", class: "lab-num", inputmode: "numeric" });
  const go = el("button", { type: "button", class: "ns-btn ns-go" }, "Open the crate yard");
  const intro = el("div", { class: "ns-intro" }, [el("p", { text: "Pylon: Before we start. If only 5 percent of the training episodes need a look back, what share of look-back words will the model get right, in percent?" }),
    el("label", { for: "dl2-guess", text: "My guess " }), guess, go, el("p", { class: "ns-note", text: "Your guess is never scored. It is shown beside the measurement, at the end." })]);
  const sel = (id, items, value) => { const n = el("select", { id, class: "lab-select" }, items.map(([v, t]) => option(String(v), t))); n.value = String(value); return n; };
  const look = sel("dl2-look", [[0, "no look-back episodes"], [0.05, "5% look back"], [0.2, "20% look back"], [0.4, "40% look back"], [0.8, "80% look back (usual)"]], 0.8);
  const noise = sel("dl2-noise", [[0, "no wrong labels"], [0.1, "10% wrong labels"], [0.3, "30% wrong labels"]], 0);
  const pool = sel("dl2-pool", [[0, "fresh rows"], [1024, "1,024 rows, repeated"], [256, "256 rows, repeated"], [64, "64 rows, repeated"]], 0);
  const laps = sel("dl2-laps", [[250, "250 laps"], [500, "500 laps"], [1000, "1,000 laps"]], 500);
  const train = el("button", { type: "button", class: "ns-btn" }, "Train"), stop = el("button", { type: "button", class: "ns-btn ns-quiet" }, "Stop"), done = el("button", { type: "button", class: "ns-btn ns-quiet" }, "I'm done");
  const controls = el("div", { class: "lab-controls", hidden: "" }, [el("div", { class: "lab-row" }, [look, noise, pool, laps]), el("div", { class: "lab-row" }, [train, stop]), el("div", { class: "ns-acts" }, [done])]);
  const end = el("div", { class: "ns-end", hidden: "" });
  box.append(canvas, status, intro, controls, end);

  const be = await backend(canvas, A, { reduced, force2d, title: "Pylon's crate yard", images: GUIDES.pylon.textures() });
  const s = { look: 0.8, noise: 0, pool: 0, steps: 500, curve: [], film: F.duplication.fresh.curve, running: false, step: 0 };
  let frameNo = 0, job = 0;
  const draw = () => be.draw(frame(s, A, performance.now() / 1000), frameNo++);
  const settings = () => `${Math.round(s.look * 100)}% look back, ${s.noise ? `${Math.round(s.noise * 100)}% wrong labels` : "no wrong labels"}, ${s.pool ? `${s.pool} rows repeated` : "fresh rows"}`;
  const say = () => { const p = s.curve.at(-1); status.textContent = p ? `${settings()}: lap ${p.step}, held-out loss ${p.heldOut.toFixed(2)} on 64 held-out rows; look-back words ${Math.round(p.lookback * 100)}% right${s.running ? "" : "."}` : "Choose a mix and press Train."; };
  const point = (model, step) => { const e = evaluate(model, held), sc = scoreSet(model, held); s.curve.push({ step, heldOut: e.loss, lookback: sc.lookback ? sc.lookback.accuracy : 0 }); };
  const preview = () => { s.look = +look.value; s.noise = +noise.value; s.pool = +pool.value; s.steps = +laps.value; draw(); };
  const run = () => {
    const id = ++job; preview();
    const model = createModel(M.weights.config, M.seed), spec = makeSpec({ mix: lookbackMix(s.look) }), o = { ...DEFAULTS }, state = createAdamState(model);
    let source = s.pool ? poolSource({ rows: s.pool, seed: M.dataSeed, ctx, spec }) : freshSource({ seed: M.dataSeed, ctx, spec });
    if (s.noise) source = noisySource(source, s.noise);
    s.curve = []; s.step = 0; s.running = true;
    point(model, 0);
    // Train in slices so the page stays responsive; a held-out check every 25 laps.
    const slice = () => {
      if (id !== job) return;
      const t0 = performance.now();
      while (s.step < s.steps && performance.now() - t0 < 40) {
        const { x, y } = source.next(), { grads } = lossAndGrad(model, x, y, o.batch, ctx);
        adam(model, grads, state, { lr: lrAt(s.step, o.lr, o.warmup), weightDecay: o.weightDecay, clip: o.clip });
        s.step++;
        if (s.step % EVERY === 0) point(model, s.step);
      }
      if (s.step >= s.steps) s.running = false;
      say(); draw();
      if (s.running) setTimeout(slice, 0);
    };
    slice();
  };
  fitCanvas(canvas, be, draw); // the first state (no run yet) is drawable as it is
  for (const n of [look, noise, pool, laps]) n.addEventListener("change", () => { if (!s.running) preview(); });
  train.addEventListener("click", run);
  stop.addEventListener("click", () => { job++; s.running = false; say(); draw(); });
  go.addEventListener("click", () => { intro.hidden = true; controls.hidden = false; say(); draw(); });
  done.addEventListener("click", () => {
    job++; s.running = false;
    const lb = F.lookback.runs.find((r) => r.name === "lb05"), ref = F.lookback.runs.find((r) => r.name === "reference");
    end.replaceChildren(el("h3", { text: "The yard is closed" }), el("ul", {}, [
      el("li", { text: `Your guess: ${guess.value}%. Trained for 2,000 laps with 5% look-back episodes, the model gets ${Math.round(lb.summary.copyAccuracy * 100)}% of look-back words right on 256 held-out rows; with the usual 80%, ${Math.round(ref.summary.copyAccuracy * 100)}%.` }),
      el("li", { text: `With 64 rows repeated for the same amount of text, held-out loss ends at ${F.duplication.runs[0].summary.heldOut.toFixed(2)}; with fresh rows, ${F.duplication.fresh.summary.heldOut.toFixed(2)}.` })]),
      el("p", { class: "ns-close", text: "Pylon: Check the crates before you check the model." }));
    end.hidden = false;
  });
  say(); draw();
  return { backend: be.kind };
}
