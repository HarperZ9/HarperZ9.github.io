// Tallow's measuring jugs: type a number and see where fp16, bf16 and fp32 can put it; add a step to a
// running total until it stops; or run the whole model with 16-bit numbers on held-out rows in this
// page. Mounted on a press. A guess first, never scored; a real end.
import { frame } from "./precision-lab-view.mjs";
import { FORMATS, roundTo, spacing, longSum } from "./precision.mjs";
import { createPrecisionScorer } from "./precision-model.mjs";
import { summarise } from "./quant.mjs";
import { fromJSON } from "./tinyformer.mjs";
import { heldOut } from "./corpus.mjs";
import { el, backend, fitCanvas } from "../lessons/stage.mjs";

const j = (p) => fetch(new URL(p, import.meta.url)).then((r) => r.json());
const option = (value, text) => el("option", { value, text });
const ROWS = 64;

export async function mount(box, { force2d = false } = {}) {
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const [sans, mono, M, F] = await Promise.all([j("../../media/explainers/motion/hanken-500.json"), j("../../media/explainers/motion/conso-400.json"), j("../../media/school/attention/model.json"), j("../../media/school/precision/facts.json")]);
  const A = { sans, mono, atlas: sans, rows: [] }, model = fromJSON(M.weights), held = heldOut(ROWS, M.config.ctx);
  box.replaceChildren();
  box.classList.add("ns", "lab");
  const canvas = el("canvas", { class: "ns-canvas", width: "1280", height: "720", role: "img", "aria-label": "Three number lines around your number with the values fp16, bf16 and fp32 can store, where your number lands on each, and the result of a running sum or of the model run in 16 bits." });
  const status = el("p", { class: "ns-status", "aria-live": "polite" });
  const guess = el("input", { type: "number", id: "pr-guess", min: "1", max: "5000", step: "1", value: "5000", class: "lab-num", inputmode: "numeric" });
  const go = el("button", { type: "button", class: "ns-btn ns-go" }, "Take down the jugs");
  const intro = el("div", { class: "ns-intro" }, [el("p", { text: "Tallow: Before we start. Add 1 to a running total five thousand times, keeping the total in fp16. Where does it end?" }),
    el("label", { for: "pr-guess", text: "My guess " }), guess, go, el("p", { class: "ns-note", text: "Your guess is never scored. It is shown beside the measurement, at the end." })]);
  const num = el("input", { type: "number", id: "pr-x", step: "any", min: "-65000", max: "65000", value: "110.0042", class: "lab-num", inputmode: "decimal" });
  const step = el("select", { id: "pr-step", class: "lab-select" }, [option("1", "add 1"), option("0.01", "add 0.01")]);
  const mode = el("select", { id: "pr-mode", class: "lab-select" }, [["fp16acc32", "fp16 inputs, 32-bit sums"], ["fp16acc16", "fp16 throughout"], ["bf16acc32", "bf16 inputs, 32-bit sums"], ["bf16acc16", "bf16 throughout"]].map(([v, t]) => option(v, t)));
  const show = el("button", { type: "button", class: "ns-btn" }, "Show the marks"), sum = el("button", { type: "button", class: "ns-btn ns-quiet" }, "Run the sum"), score = el("button", { type: "button", class: "ns-btn ns-quiet" }, "Score the model"), done = el("button", { type: "button", class: "ns-btn ns-quiet" }, "I'm done");
  const controls = el("div", { class: "lab-controls", hidden: "" }, [el("div", { class: "lab-row" }, [step, sum]), el("div", { class: "lab-row" }, [num, show]), el("div", { class: "lab-row" }, [mode, score]), el("div", { class: "ns-acts" }, [done])]);
  const end = el("div", { class: "ns-end", hidden: "" });
  box.append(canvas, status, intro, controls, end);

  const be = await backend(canvas, A, { reduced, force2d, title: "Tallow's measuring jugs" });
  const s = { x: 110.0042, places: null, sums: null, scoreLine: "", running: false };
  let frameNo = 0, job = 0, base = null;
  const draw = () => be.draw(frame(s, A, performance.now() / 1000), frameNo++);
  const place = () => { const v = +num.value || 1; s.x = Math.sign(v) * Math.min(65000, Math.max(0.001, Math.abs(v))); num.value = String(s.x); s.places = ["fp16", "bf16", "fp32"].map((n) => { const Fm = FORMATS[n], v = n === "fp32" ? Math.fround(s.x) : roundTo(s.x, Fm); return { name: n, stored: v, step: spacing(s.x, Fm), err: Math.abs(v - s.x) }; }); };
  const say = () => { const p = s.places; status.textContent = [p ? `${s.x} is stored as ${p.map((q) => `${q.stored} (${q.name})`).join(", ")}` : "", s.sums ? `adding ${s.sums.step} five thousand times: ${s.sums.rows.map((r) => `${r.format} ${r.sum}`).join(", ")}` : "", s.scoreLine].filter(Boolean).join(". ") + "."; };
  const scoreRun = () => {
    const id = ++job, m = mode.value, sc = createPrecisionScorer(model, held, m, 4), b = base || createPrecisionScorer(model, held, "fp32", 4); s.running = true; s.scoreLine = `scoring ${m}`;
    const slice = () => { if (id !== job) return; const t0 = performance.now(); while (performance.now() - t0 < 40 && !(sc.done && b.done)) (b.done ? sc : b).step();
      if (sc.done && b.done) { base = b; const r = summarise(sc.units(), b.units(), { resamples: 400 }); s.scoreLine = `${mode.options[mode.selectedIndex].text}: loss ${r.loss.value.toFixed(4)}, change ${r.loss.diff >= 0 ? "+" : ""}${r.loss.diff.toExponential(1)} [${r.loss.diffLo.toExponential(1)}, ${r.loss.diffHi.toExponential(1)}] on ${ROWS} held-out rows`; s.running = false; }
      say(); draw(); if (s.running) setTimeout(slice, 0); };
    slice();
  };
  fitCanvas(canvas, be, draw); // the first state (no number placed yet) is drawable as it is
  show.addEventListener("click", () => { place(); say(); draw(); });
  sum.addEventListener("click", () => { const st = +step.value, n = 5000; s.sums = { step: st, rows: ["fp16", "bf16", "fp32"].map((k) => longSum(st, n, FORMATS[k])) }; say(); draw(); });
  score.addEventListener("click", scoreRun);
  go.addEventListener("click", () => { intro.hidden = true; controls.hidden = false; place(); say(); draw(); });
  done.addEventListener("click", () => {
    job++; s.running = false;
    const S = F.stagnation.rows, N = F.near110;
    end.replaceChildren(el("h3", { text: "The jugs are back on the shelf" }), el("ul", {}, [
      el("li", { text: `Your guess: ${guess.value}. Adding 1 five thousand times, the fp16 total stops at ${S[0].stuckAt.toLocaleString("en")}; bf16 at ${S[1].stuckAt}.` }),
      el("li", { text: `Near 110, fp16's marks are ${N.fp16.spacing} apart, and a value can move by up to ${N.absolute.fp16WorstMove}.` })]),
      el("p", { class: "ns-close", text: "Tallow: Small inputs, big sums." }));
    end.hidden = false;
  });
  say(); draw();
  return { backend: be.kind };
}
