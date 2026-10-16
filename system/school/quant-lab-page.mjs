// Rerun's palette: store the attention model's weights in fewer bits (round to nearest or GPTQ, one
// scale per table, per output or per group), score it on held-out rows in this page against the full
// model, and see one table repainted. Mounted on a press. A guess first, never scored; a real end.
import { frame } from "./quant-lab-view.mjs";
import { quantizeModel, createScorer, summarise, bytesOf } from "./quant.mjs";
import { gptqModel } from "./quant-gptq.mjs";
import { fromJSON } from "./tinyformer.mjs";
import { heldOut } from "./corpus.mjs";
import { el, backend, fitCanvas } from "../lessons/stage.mjs";

const j = (p) => fetch(new URL(p, import.meta.url)).then((r) => r.json());
const option = (value, text) => el("option", { value, text });
const ROWS = 256;

export async function mount(box, { force2d = false } = {}) {
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const [sans, mono, M, F] = await Promise.all([j("../../media/explainers/motion/hanken-500.json"), j("../../media/explainers/motion/conso-400.json"), j("../../media/school/attention/model.json"), j("../../media/school/quant/facts.json")]);
  const A = { sans, mono, atlas: sans, rows: [] }, base = fromJSON(M.weights), held = heldOut(ROWS, M.config.ctx);
  box.replaceChildren();
  box.classList.add("ns", "lab");
  const canvas = el("canvas", { class: "ns-canvas", width: "1280", height: "720", role: "img", "aria-label": "One table of the model's weights as a grid of planks, repainted with the levels your choice of bits allows, and the held-out loss of the quantised model beside the full one." });
  const status = el("p", { class: "ns-status", "aria-live": "polite" });
  const guess = el("input", { type: "number", id: "qt-guess", min: "0", max: "5", step: "0.001", value: "0.7", class: "lab-num", inputmode: "decimal" });
  const go = el("button", { type: "button", class: "ns-btn ns-go" }, "Open the palette");
  const intro = el("div", { class: "ns-intro" }, [el("p", { text: `Tallow: Before we start. The full model's loss is ${F.schemes.float.loss.value.toFixed(4)}. Stored in 4 bits with one scale per output, what will it be?` }),
    el("label", { for: "qt-guess", text: "My guess " }), guess, go, el("p", { class: "ns-note", text: "Your guess is never scored. It is shown beside the measurement, at the end." })]);
  const sel = (id, items, value) => { const n = el("select", { id, class: "lab-select" }, items.map(([v, t]) => option(String(v), t))); n.value = String(value); return n; };
  const bits = sel("qt-bits", [8, 6, 4, 3, 2].map((b) => [b, `${b} bits`]), 4);
  const scheme = sel("qt-scheme", [["tensor", "one scale per table"], ["channel", "one scale per output"], ["group", "one scale per 32 numbers"]], "channel");
  const method = sel("qt-method", [["rtn", "plain rounding"], ["gptq", "GPTQ"]], "rtn");
  const run = el("button", { type: "button", class: "ns-btn" }, "Quantise and score"), done = el("button", { type: "button", class: "ns-btn ns-quiet" }, "I'm done");
  const controls = el("div", { class: "lab-controls", hidden: "" }, [el("div", { class: "lab-row" }, [bits, scheme, method]), el("div", { class: "lab-row" }, [run]), el("div", { class: "ns-acts" }, [done])]);
  const end = el("div", { class: "ns-end", hidden: "" });
  box.append(canvas, status, intro, controls, end);

  const be = await backend(canvas, A, { reduced, force2d, title: "Rerun's palette" });
  const s = { table: base.params["l1.wqkv"], baseTable: base.params["l1.wqkv"], label: "full precision", result: null, bytes: null, running: false, scored: 0 };
  let frameNo = 0, job = 0, baseUnits = null;
  const draw = () => be.draw(frame(s, A, performance.now() / 1000), frameNo++);
  const say = () => { const r = s.result; status.textContent = r ? `${s.label}: loss ${r.loss.value.toFixed(4)} (full ${baseUnits ? r.base.toFixed(4) : "?"}), rise ${r.loss.diff >= 0 ? "+" : ""}${r.loss.diff.toFixed(4)} [${r.loss.diffLo.toFixed(4)}, ${r.loss.diffHi.toFixed(4)}] on ${ROWS} held-out rows; ${s.bytes.total.toLocaleString("en")} bytes${s.running ? "" : "."}` : s.running ? `scoring: ${s.scored} of ${ROWS} rows` : "Choose bits, scale and rounding, and press Quantise and score."; };
  const score = (model, id, onDone) => { const sc = createScorer(model, held); const slice = () => { if (id !== job) return; const t0 = performance.now(); while (!sc.done && performance.now() - t0 < 40) s.scored = sc.step(); say(); draw(); if (sc.done) onDone(sc.units()); else setTimeout(slice, 0); }; s.scored = 0; slice(); };
  const start = () => {
    const id = ++job, o = { bits: +bits.value, scheme: scheme.value }; s.running = true; s.result = null;
    s.label = `${o.bits} bits, ${scheme.options[scheme.selectedIndex].text}, ${method.options[method.selectedIndex].text}`;
    const after = () => {
      const q = method.value === "gptq" ? gptqModel(base, o) : quantizeModel(base, o);
      s.table = q.model.params["l1.wqkv"]; s.bytes = bytesOf(base.config, o);
      score(q.model, id, (u) => { const r = summarise(u, baseUnits, { resamples: 400 }); r.base = summarise(baseUnits, null, { resamples: 50 }).loss.value; s.result = r; s.running = false; say(); draw(); });
    };
    if (baseUnits) setTimeout(after, 0); else score(base, id, (u) => { baseUnits = u; after(); });
  };
  fitCanvas(canvas, be, draw); // the first state (the full-precision table) is drawable as it is
  run.addEventListener("click", start);
  go.addEventListener("click", () => { intro.hidden = true; controls.hidden = false; say(); draw(); });
  done.addEventListener("click", () => {
    job++; s.running = false;
    const r = F.schemes.rows[18], g = F.schemes.rows[19];
    end.replaceChildren(el("h3", { text: "The palette is put away" }), el("ul", {}, [
      el("li", { text: `Your guess: ${guess.value}. On 1,024 held-out rows, 4 bits with one scale per output gave ${r.loss.value.toFixed(4)} by plain rounding and ${g.loss.value.toFixed(4)} by GPTQ; the full model ${F.schemes.float.loss.value.toFixed(4)}.` }),
      el("li", { text: `That 4-bit model takes ${r.bytes.total.toLocaleString("en")} bytes, ${Math.round(r.bytes.ratio * 100)}% of the 32-bit one.` })]),
      el("p", { class: "ns-close", text: "Tallow: Fewer paints, if you measure what you lose." }));
    end.hidden = false;
  });
  say(); draw();
  return { backend: be.kind };
}
