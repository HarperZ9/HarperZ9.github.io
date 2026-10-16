// Rerun's gate: pick a checker, train the early attention model against it by trial and reward in
// this page, and watch the points it pays against the answers that are right, with the answers it
// writes now. Mounted on a press. A guess first, never scored; a real end.
import { frame } from "./gaming-lab-view.mjs";
import { createGamer, scorePolicy, exampleAnswers, makePrompts, checkpointAt } from "./gaming.mjs";
import { cloneModel } from "./lora.mjs";
import { el, backend, fitCanvas } from "../lessons/stage.mjs";

const j = (p) => fetch(new URL(p, import.meta.url)).then((r) => r.json());
const option = (value, text) => el("option", { value, text });
const EVERY = 25, SIGN = { gamed: "+1 if the answer contains the right name", patched: "+1 if right name first and no other guide", fixed: "+1 if right name first, no other guide, and a stop" };

export async function mount(box, { force2d = false } = {}) {
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const [sans, mono, M, F] = await Promise.all([j("../../media/explainers/motion/hanken-500.json"), j("../../media/explainers/motion/conso-400.json"), j("../../media/school/attention/model.json"), j("../../media/school/gaming/facts.json")]);
  const A = { sans, mono, atlas: sans };
  box.replaceChildren();
  box.classList.add("ns", "lab");
  const canvas = el("canvas", { class: "ns-canvas", width: "1280", height: "720", role: "img", "aria-label": "A tide board with the points a checker pays and the share of answers that are right over training, the film's runs faint behind yours, and the answers the model writes now." });
  const status = el("p", { class: "ns-status", "aria-live": "polite" });
  const guess = el("input", { type: "number", id: "gm-guess", min: "0", max: "100", step: "1", value: "50", class: "lab-num", inputmode: "numeric" });
  const go = el("button", { type: "button", class: "ns-btn ns-go" }, "Open the gate");
  const intro = el("div", { class: "ns-intro" }, [el("p", { text: "Rerun: Before we start. The checker pays when the answer contains the right name. After 800 rounds its points are near 100 percent. What share of answers is right, in percent?" }),
    el("label", { for: "gm-guess", text: "My guess " }), guess, go, el("p", { class: "ns-note", text: "Your guess is never scored. It is shown beside the measurement, at the end." })]);
  const checker = el("select", { id: "gm-checker", class: "lab-select" }, Object.entries(SIGN).map(([k, v]) => option(k, v)));
  const steps = el("select", { id: "gm-steps", class: "lab-select" }, [option("100", "100 rounds"), option("300", "300 rounds"), option("800", "800 rounds")]);
  steps.value = "300";
  const train = el("button", { type: "button", class: "ns-btn" }, "Train"), stop = el("button", { type: "button", class: "ns-btn ns-quiet" }, "Stop"), done = el("button", { type: "button", class: "ns-btn ns-quiet" }, "I'm done");
  const controls = el("div", { class: "lab-controls", hidden: "" }, [el("div", { class: "lab-row" }, [checker, steps]), el("div", { class: "lab-row" }, [train, stop]), el("div", { class: "ns-acts" }, [done])]);
  const end = el("div", { class: "ns-end", hidden: "" });
  box.append(canvas, status, intro, controls, end);

  const be = await backend(canvas, A, { reduced, force2d, title: "Rerun's gate" });
  const prompts = makePrompts(F.recipe.evalSeed, 64), shown = prompts.slice(0, 2);
  const s = { sign: SIGN.gamed, film: F.film.curves.gamed, curve: [], examples: [], steps: 300, running: false, step: 0 };
  let frameNo = 0, job = 0, base = null;
  const draw = () => be.draw(frame(s, A, performance.now() / 1000), frameNo++);
  const words = (p) => exampleAnswers(p, shown).map((e) => ({ truth: e.truth, words: e.sampled }));
  const say = () => { const p = s.curve.at(-1); status.textContent = p ? `${checker.value} checker: round ${p.step}, points ${Math.round(p.reward * 100)}%, answers right ${Math.round(p.correct * 100)}% on 64 questions${s.running ? "" : "."}` : base ? "Choose a checker and press Train." : "Rebuilding the model at step 200 of its training."; };
  const preview = () => { s.sign = SIGN[checker.value]; s.film = F.film.curves[checker.value]; s.steps = +steps.value; draw(); };
  const point = (p, step) => { const sc = scorePolicy(p, prompts); s.curve.push({ step, reward: sc[checker.value], correct: sc.correct }); s.examples = words(p); };
  const run = () => {
    if (!base) return;
    const id = ++job; preview();
    const policy = cloneModel(base), g = createGamer(policy, checker.value, { promptSeed: 11, sampleSeed: 21, batch: F.recipe.batch, lr: F.recipe.lr });
    s.curve = []; s.step = 0; s.running = true; point(policy, 0);
    // Train in 40 ms slices so the page stays responsive; both scores every 25 rounds.
    const slice = () => {
      if (id !== job) return;
      const t0 = performance.now();
      while (s.step < s.steps && performance.now() - t0 < 40) { g.step(); s.step++; if (s.step % EVERY === 0) point(policy, s.step); }
      if (s.step >= s.steps) s.running = false;
      say(); draw();
      if (s.running) setTimeout(slice, 0);
    };
    slice();
  };
  fitCanvas(canvas, be, draw); // the first state (no run yet) is drawable as it is
  checker.addEventListener("change", () => { if (!s.running) preview(); });
  steps.addEventListener("change", () => { if (!s.running) preview(); });
  train.addEventListener("click", run);
  stop.addEventListener("click", () => { job++; s.running = false; say(); draw(); });
  go.addEventListener("click", () => {
    intro.hidden = true; controls.hidden = false; say(); draw();
    // Rebuild the early checkpoint (200 steps of the attention lab's own training) in slices.
    setTimeout(() => { base = checkpointAt(M, 200); s.examples = words(base); say(); draw(); }, 0);
  });
  done.addEventListener("click", () => {
    job++; s.running = false;
    const S = F.start200;
    end.replaceChildren(el("h3", { text: "The gate is shut" }), el("ul", {}, [
      el("li", { text: `Your guess: ${guess.value}%. Against the first checker, three runs of 800 rounds ended with points at ${(S.gamed.end.reward.mean * 100).toFixed(1)}% and right answers at ${Math.round(S.gamed.end.correct.mean * 100)}%.` }),
      el("li", { text: `With the gap closed (the answer must also stop), right answers ended at ${Math.round(S.fixed.end.correct.mean * 100)}%.` })]),
      el("p", { class: "ns-close", text: "Rerun: Check the check. Tap what the gate lets through." }));
    end.hidden = false;
  });
  say(); draw();
  return { backend: be.kind };
}
