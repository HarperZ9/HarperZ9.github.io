// Tallow's two wheels: pick what a small student learns from (the text's own words, the teacher's
// wheel at a temperature, the teacher's top word as if certain, or the rules' own odds) and how
// much text it sees, train it in this page, and watch its wheel and held-out loss. Mounted on a
// press. A guess first, never scored; a real end.
import { frame } from "./distill-lab-view.mjs";
import { STUDENTS, createDistiller, softmaxT } from "./distill.mjs";
import { freshSource, poolSource } from "./data.mjs";
import { createModel, fromJSON, forward, evaluate } from "./tinyformer.mjs";
import { heldOut, encode, VOCAB } from "./corpus.mjs";
import { el, backend, fitCanvas } from "../lessons/stage.mjs";

const j = (p) => fetch(new URL(p, import.meta.url)).then((r) => r.json());
const option = (value, text) => el("option", { value, text });
const EVERY = 50, PROBE = encode(["tallow", "found", "a"]), V = VOCAB.length;
const sharesAfter = (m, T = 1) => { const { logits } = forward(m, PROBE, 1, PROBE.length); return Array.from(softmaxT(new Float64Array(V), logits.subarray((PROBE.length - 1) * V), 1, V, T)); };
const ARMS = { hard: { kind: "hard" }, soft: { kind: "soft" }, argmax: { kind: "argmax" }, oracle: { kind: "oracle" } };

export async function mount(box, { force2d = false } = {}) {
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const [sans, mono, M, F] = await Promise.all([j("../../media/explainers/motion/hanken-500.json"), j("../../media/explainers/motion/conso-400.json"), j("../../media/school/attention/model.json"), j("../../media/school/distill/facts.json")]);
  const A = { sans, mono, atlas: sans, rows: [] }, ctx = M.config.ctx, held = heldOut(64, ctx), teacher = fromJSON(M.weights);
  box.replaceChildren();
  box.classList.add("ns", "lab");
  const canvas = el("canvas", { class: "ns-canvas", width: "1280", height: "720", role: "img", "aria-label": "Two brass wheels after the words tallow found a: the teacher's shares at your temperature and your student's shares, live; a board with your student's held-out loss over the film's runs." });
  const status = el("p", { class: "ns-status", "aria-live": "polite" });
  const guess = el("select", { id: "ds-guess", class: "lab-select" }, [option("hard", "the text's own words"), option("soft", "the teacher's wheel"), option("same", "about the same")]);
  const go = el("button", { type: "button", class: "ns-btn ns-go" }, "Light the lamp");
  const intro = el("div", { class: "ns-intro" }, [el("p", { text: "Tallow: Before we start. A small student sees only 32 rows of text, over and over. Which teaches it better?" }),
    el("label", { for: "ds-guess", text: "My guess " }), guess, go, el("p", { class: "ns-note", text: "Your guess is never scored. It is shown beside the measurement, at the end." })]);
  const sel = (id, items, value) => { const n = el("select", { id, class: "lab-select" }, items.map(([v, t]) => option(String(v), t))); n.value = String(value); return n; };
  const target = sel("ds-target", [["hard", "the text's own words"], ["soft", "the teacher's wheel"], ["argmax", "the teacher's top word, as if certain"], ["oracle", "the rules' own odds"]], "soft");
  const temp = sel("ds-temp", [[1, "temperature 1"], [2, "temperature 2"], [4, "temperature 4"], [8, "temperature 8"]], 2);
  const pool = sel("ds-pool", [[0, "fresh text"], [256, "256 rows, repeated"], [32, "32 rows, repeated"]], 32);
  const steps = sel("ds-steps", [[500, "500 steps"], [1000, "1,000 steps"], [2000, "2,000 steps"]], 1000);
  const train = el("button", { type: "button", class: "ns-btn" }, "Train"), stop = el("button", { type: "button", class: "ns-btn ns-quiet" }, "Stop"), done = el("button", { type: "button", class: "ns-btn ns-quiet" }, "I'm done");
  const controls = el("div", { class: "lab-controls", hidden: "" }, [el("div", { class: "lab-row" }, [target, temp, pool, steps]), el("div", { class: "lab-row" }, [train, stop]), el("div", { class: "ns-acts" }, [done])]);
  const end = el("div", { class: "ns-end", hidden: "" });
  box.append(canvas, status, intro, controls, end);

  const be = await backend(canvas, A, { reduced, force2d, title: "Tallow's two wheels" });
  const blank = createModel({ ...M.config, ...STUDENTS.d16x1 }, 1);
  const s = { vocab: VOCAB, teacher1: sharesAfter(teacher), teacher: sharesAfter(teacher, 2), student: sharesAfter(blank), target: "soft", T: 2, steps: 1000, curve: [], film: [], filmLabel: "", teacherLoss: F.teacher.heldOut, running: false, step: 0 };
  let frameNo = 0, job = 0, nextDraw = 0;
  const draw = () => be.draw(frame(s, A, performance.now() / 1000), frameNo++);
  const regime = () => (+pool.value ? `pool${pool.value}` : "full");
  const filmCurves = () => { const R = regime() === "full" ? F.fullData.arms : F.lowData[regime()]; s.filmLabel = regime() === "full" ? "runs on fresh text" : `runs on ${pool.value} rows`; return ["hard", "soft2"].filter((k) => R[k]).map((k) => ({ name: k, points: R[k].curveSeed1 })); };
  const settings = () => `${target.options[target.selectedIndex].text}${s.target === "soft" || s.target === "oracle" ? `, temperature ${s.T}` : ""}, ${pool.options[pool.selectedIndex].text}`;
  const say = () => { const p = s.curve.at(-1); status.textContent = p ? `${settings()}: step ${p.step}, held-out loss ${p.heldOut.toFixed(2)} on 64 held-out rows; the teacher's is ${F.teacher.heldOut.toFixed(2)}${s.running ? "" : "."}` : "Choose a teacher and press Train."; };
  const preview = () => { s.target = target.value; s.T = +temp.value; s.steps = +steps.value; s.teacher = s.target === "soft" ? sharesAfter(teacher, s.T) : s.teacher1; s.film = filmCurves(); draw(); };
  const run = () => {
    const id = ++job; preview();
    const student = createModel({ ...M.config, ...STUDENTS.d16x1 }, 1), base = { seed: 101, batch: M.batch, ctx };
    const source = +pool.value ? poolSource({ ...base, seed: 201, rows: +pool.value }) : freshSource(base);
    const d = createDistiller(student, teacher, { ...ARMS[s.target], T: s.T, alpha: 1 }, source);
    s.curve = [{ step: 0, heldOut: evaluate(student, held).loss }]; s.step = 0; s.running = true;
    // Train in slices so the page stays responsive; a held-out check every 50 steps.
    const slice = () => {
      if (id !== job) return;
      const t0 = performance.now();
      while (s.step < s.steps && performance.now() - t0 < 40) {
        d.step(); s.step++;
        if (s.step % EVERY === 0) s.curve.push({ step: s.step, heldOut: evaluate(student, held).loss });
      }
      s.student = sharesAfter(student);
      if (s.step >= s.steps) s.running = false;
      // Redraw at most four times a second, and never more than a fifth of the time: a software
      // canvas can take longer to draw than a slice takes to train.
      if (!s.running || performance.now() >= nextDraw) { const d0 = performance.now(); say(); draw(); const d1 = performance.now(); nextDraw = d1 + Math.max(250, 4 * (d1 - d0)); }
      if (s.running) setTimeout(slice, 0);
    };
    slice();
  };
  s.film = filmCurves();
  fitCanvas(canvas, be, draw); // the first state (an untrained student) is drawable as it is
  for (const n of [target, temp, pool, steps]) n.addEventListener("change", () => { if (!s.running) preview(); });
  train.addEventListener("click", run);
  stop.addEventListener("click", () => { job++; s.running = false; say(); draw(); });
  go.addEventListener("click", () => { intro.hidden = true; controls.hidden = false; say(); draw(); });
  done.addEventListener("click", () => {
    job++; s.running = false;
    const L = F.lowData.pool32, G = { hard: "the text's own words", soft: "the teacher's wheel", same: "about the same" };
    end.replaceChildren(el("h3", { text: "The lamp is down" }), el("ul", {}, [
      el("li", { text: `Your guess: ${G[guess.value]}. On 32 rows, three students trained on the text's words end at a held-out loss of ${L.hard.heldOut.mean.toFixed(2)}; on the teacher's wheel at temperature 2, ${L.soft2.heldOut.mean.toFixed(2)}. Every seed agrees.` }),
      el("li", { text: `With fresh text, the text's words give ${F.fullData.arms.hard.heldOut.mean.toFixed(2)} and the teacher's wheel ${F.fullData.arms.soft2.heldOut.mean.toFixed(2)}: no difference the seeds agree on.` })]),
      el("p", { class: "ns-close", text: "Tallow: A good teacher matters most when the books are few." }));
    end.hidden = false;
  });
  say(); draw();
  return { backend: be.kind };
}
