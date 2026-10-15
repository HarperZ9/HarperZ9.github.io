// Tallow's wheel room: give the model a start, choose how the wheel is cut (greedy, temperature,
// top-k, top-p), spin one run or two hundred, and see which runs the rules could have written.
// Mounted on a press. A guess first, never scored; a real end.
import { frame } from "./decoding-lab-view.mjs";
import { generate, settingProbs, createCache, stepCache } from "./decoding.mjs";
import { softmax } from "./nextword.mjs";
import { grammarCheck } from "./corpus-grammar.mjs";
import { fromJSON } from "./tinyformer.mjs";
import { VOCAB } from "./corpus.mjs";
import { landOn, spin } from "../../media/school/nextword/scene/wheel.mjs";
import { el, backend, fitCanvas } from "../lessons/stage.mjs";

const j = (p) => fetch(new URL(p, import.meta.url)).then((r) => r.json());
const option = (value, text) => el("option", { value, text });
const ID = new Map(VOCAB.map((w, i) => [w, i]));
const tokenize = (s) => s.toLowerCase().replace(/([.?])/g, " $1 ").split(/\s+/).filter((w) => ID.has(w));

export async function mount(box, { force2d = false } = {}) {
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const [sans, mono, M, F] = await Promise.all([j("../../media/explainers/motion/hanken-500.json"), j("../../media/explainers/motion/conso-400.json"), j("../../media/school/attention/model.json"), j("../../media/school/decoding/facts.json")]);
  const A = { sans, mono, atlas: sans }, model = fromJSON(M.weights), ctx = M.config.ctx, open = F.prompts.find((p) => p.key === "open").settings;
  box.replaceChildren();
  box.classList.add("ns", "lab");
  const canvas = el("canvas", { class: "ns-canvas", width: "1280", height: "720", role: "img", "aria-label": "A brass wheel with one slot per word, cut by the chosen setting; below, the last runs written, with the first word the rules cannot explain in ember, and the tally of a batch of runs." });
  const status = el("p", { class: "ns-status", "aria-live": "polite" });
  const guess = el("input", { type: "number", id: "dl-guess", min: "0", max: "100", step: "1", value: "50", class: "lab-num", inputmode: "numeric" });
  const go = el("button", { type: "button", class: "ns-btn ns-go" }, "Open the wheel room");
  const intro = el("div", { class: "ns-intro" }, [el("p", { text: "Tallow: Before we start. Spin at temperature 2, starting from pylon. What share of runs, in percent, will still follow the rules?" }),
    el("label", { for: "dl-guess", text: "My guess " }), guess, go, el("p", { class: "ns-note", text: "Your guess is never scored. It is shown beside the measurement, at the end." })]);
  const prompt = el("input", { type: "text", id: "dl-prompt", class: "lab-text", value: "pylon", "aria-label": "The start of the text" });
  const mode = el("select", { id: "dl-mode", class: "lab-select" }, [option("temperature", "temperature"), option("greedy", "greedy"), option("topK", "top-k"), option("topP", "top-p")]);
  const knob = el("input", { type: "range", id: "dl-knob", min: "0.05", max: "2.5", step: "0.05", value: "1" });
  const one = el("button", { type: "button", class: "ns-btn" }, "Spin once"), many = el("button", { type: "button", class: "ns-btn" }, "Spin 200"), done = el("button", { type: "button", class: "ns-btn ns-quiet" }, "I'm done");
  const controls = el("div", { class: "lab-controls", hidden: "" }, [el("div", { class: "lab-row" }, [el("label", { for: "dl-prompt", text: "Start " }), prompt, mode, el("label", { for: "dl-knob", text: " " }), knob]),
    el("div", { class: "lab-row" }, [one, many]), el("div", { class: "ns-acts" }, [done])]);
  const end = el("div", { class: "ns-end", hidden: "" });
  box.append(canvas, status, intro, controls, end);

  const be = await backend(canvas, A, { reduced, force2d, title: "Tallow's wheel room" });
  const s = { vocab: VOCAB, base: new Float64Array(VOCAB.length), dist: new Float64Array(VOCAB.length), setting: "", kept: 0, runs: [], tally: "", turn: 0 };
  let seed = 1, frameNo = 0, anim = null;
  const setting = () => {
    const v = +knob.value;
    if (mode.value === "greedy") return [{ mode: "greedy" }, "greedy"];
    if (mode.value === "topK") { const k = Math.max(1, Math.round(v * 8)); return [{ topK: k }, `top-k, k ${k}`]; }
    if (mode.value === "topP") { const p = Math.min(1, Math.max(0.05, v / 2.5)); return [{ topP: p }, `top-p, p ${p.toFixed(2)}`]; }
    return [{ temperature: v }, `temperature ${v.toFixed(2)}`];
  };
  const ids = () => { const x = tokenize(prompt.value); return x.length ? x.slice(0, ctx - 4).map((w) => ID.get(w)) : [ID.get("pylon")]; };
  const recompute = () => {
    const x = ids(), C = createCache(model, 1);
    let logits;
    for (const id of x) logits = stepCache(model, C, Int32Array.of(id));
    const [st, name] = setting();
    s.base = softmax(logits); s.dist = settingProbs(logits, st); s.setting = name; s.kept = s.dist.filter((v) => v > 0).length;
  };
  const run = (n) => {
    const x = ids(), [st] = setting(), out = generate(model, x, st, { n, maxNew: ctx - x.length, seed });
    seed += n;
    return out.rows.map((r) => { const w = [...x, ...r].map((i) => VOCAB[i]), g = grammarCheck(w); return { words: w, failAt: g.failAt, ok: g.ok }; });
  };
  const say = () => { status.textContent = `${s.setting}: ${s.kept} words keep a slot after "${ids().map((i) => VOCAB[i]).join(" ")}".${s.tally ? ` ${s.tally}.` : ""}`; };
  const draw = () => be.draw(frame(s, A, performance.now() / 1000), frameNo++);
  const update = () => { recompute(); say(); draw(); };
  // The wheel draws its slots widest first (by the uncut spread), so land on the word's drawn slot.
  const animate = (id) => {
    const o = Array.from(s.base, (p, i) => [p, i]).sort((a, b) => b[0] - a[0] || a[1] - b[1]).map(([, i]) => i), drawn = o.map((i) => s.dist[i]), k = o.indexOf(id);
    if (reduced) { s.turn = landOn(drawn, k, 0); draw(); return; }
    const t0 = performance.now() / 1000, from = s.turn % (Math.PI * 2), to = landOn(drawn, k, 3);
    cancelAnimationFrame(anim);
    const tick = () => { const t = performance.now() / 1000; s.turn = spin(t, t0, 1.6, from, to); draw(); if (t - t0 < 1.7) anim = requestAnimationFrame(tick); };
    tick();
  };
  recompute(); // before the first draw, which fitCanvas makes at once
  fitCanvas(canvas, be, draw);
  for (const n of [mode, knob]) n.addEventListener("input", () => { s.tally = ""; update(); });
  mode.addEventListener("change", () => { s.tally = ""; update(); });
  let pending = 0; prompt.addEventListener("input", () => { clearTimeout(pending); pending = setTimeout(() => { s.runs = []; s.tally = ""; update(); }, 250); });
  one.addEventListener("click", () => { const [r] = run(1); s.runs.push(r); recompute(); say(); animate(VOCAB.indexOf(r.words[ids().length])); });
  many.addEventListener("click", () => {
    const rs = run(200), ok = rs.filter((r) => r.ok).length, distinct = new Set(rs.map((r) => r.words.join(" "))).size;
    s.runs.push(...rs.slice(0, 3));
    s.tally = `200 runs: ${ok} follow the rules (${Math.round(ok / 2)}%), ${distinct} different texts`;
    say(); draw();
  });
  go.addEventListener("click", () => { intro.hidden = true; controls.hidden = false; update(); });
  done.addEventListener("click", () => {
    end.replaceChildren(el("h3", { text: "The wheel room is closed" }), el("ul", {}, [
      el("li", { text: `Your guess: ${guess.value}%. Over ${open.t2.n.toLocaleString("en")} runs from pylon at temperature 2, ${Math.round(open.t2.grammatical * 100)}% follow the rules; at temperature 1, ${Math.round(open.t1.grammatical * 100)}%; the rules' own runs, all of them.` }),
      el("li", { text: `Top-p at 0.5 follows the rules in ${(open["p0.5"].grammatical * 100).toFixed(1)}% of runs, but ${open["p0.5"].n.toLocaleString("en")} runs wrote only ${open["p0.5"].distinctTexts} different texts.` })]),
      el("p", { class: "ns-close", text: "Tallow: How the wheel is cut decides what gets written. Safe and samey, or varied and wrong: you choose where to stand." }));
    end.hidden = false;
  });
  say(); draw();
  return { backend: be.kind };
}
