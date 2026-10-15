// Tallow's scoring wheel: type a line from the guides' world, step through it, and see the model's
// spread for each next word, the rules' own odds beside it, and the surprise of the word that came.
// Mounted on a press. A guess first, never scored; a real end.
import { frame } from "./nextword-lab-view.mjs";
import { batchProbs } from "./nextword.mjs";
import { startParse, advance, nextWordProbs } from "./corpus-grammar.mjs";
import { fromJSON } from "./tinyformer.mjs";
import { VOCAB } from "./corpus.mjs";
import { el, backend, fitCanvas } from "../lessons/stage.mjs";

const j = (p) => fetch(new URL(p, import.meta.url)).then((r) => r.json());
const V = VOCAB.length, ID = new Map(VOCAB.map((w, i) => [w, i]));
// Lower case; "." and "?" split off as words of their own, as in the guides' sentences.
const tokenize = (s) => s.toLowerCase().replace(/([.?])/g, " $1 ").split(/\s+/).filter(Boolean);

export async function mount(box, { force2d = false } = {}) {
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const [sans, mono, M, F] = await Promise.all([j("../../media/explainers/motion/hanken-500.json"), j("../../media/explainers/motion/conso-400.json"), j("../../media/school/attention/model.json"), j("../../media/school/nextword/facts.json")]);
  const A = { sans, mono, atlas: sans }, model = fromJSON(M.weights), ctx = M.config.ctx;
  box.replaceChildren();
  box.classList.add("ns", "lab");
  const canvas = el("canvas", { class: "ns-canvas", width: "1280", height: "720", role: "img", "aria-label": "A brass wheel with one slot per word, each slot as wide as the model's share for the next word; a blue ring outside gives the rules' own odds; the word that came is in ember. Your text runs across the top." });
  const status = el("p", { class: "ns-status", "aria-live": "polite" });
  const guess = el("input", { type: "number", id: "nl-guess", min: "1", max: "46", step: "0.1", value: "10", class: "lab-num", inputmode: "decimal" });
  const go = el("button", { type: "button", class: "ns-btn ns-go" }, "Turn the wheel");
  const intro = el("div", { class: "ns-intro" }, [el("p", { text: `Tallow: Before we start. A blind guess is torn between all ${V} words. On sentences held back from training, how many words will the model be torn between?` }),
    el("label", { for: "nl-guess", text: "My guess " }), guess, go, el("p", { class: "ns-note", text: "Your guess is never scored. It is shown beside the measurement, at the end." })]);
  const text = el("input", { type: "text", id: "nl-text", class: "lab-text", value: "rerun found a kettle . pylon put a cone on the kettle .", "aria-label": "Text made of the guides' words" });
  const pos = el("input", { type: "range", id: "nl-pos", min: "0", max: "23", step: "1", value: "8" });
  const done = el("button", { type: "button", class: "ns-btn ns-quiet" }, "I'm done");
  const controls = el("div", { class: "lab-controls", hidden: "" }, [el("div", { class: "lab-row" }, [el("label", { for: "nl-text", text: "Your text " }), text]),
    el("div", { class: "lab-row" }, [el("label", { for: "nl-pos", text: "After word " }), pos]), el("div", { class: "ns-acts" }, [done])]);
  const end = el("div", { class: "ns-end", hidden: "" });
  box.append(canvas, status, intro, controls, end);

  const be = await backend(canvas, A, { reduced, force2d, title: "Tallow's scoring wheel" });
  const s = { vocab: VOCAB, words: [], pos: 0, model: new Float64Array(V), truth: null, surprise: [], line: "", dropped: [] };
  let P = null, frameNo = 0;
  const recompute = () => {
    const all = tokenize(text.value);
    s.dropped = all.filter((w) => !ID.has(w));
    s.words = all.filter((w) => ID.has(w)).slice(0, ctx);
    if (!s.words.length) { s.line = ""; return; }
    const x = Int32Array.from(s.words, (w) => ID.get(w));
    P = batchProbs(model, x, 1, x.length);
    s.surprise = Array.from({ length: x.length - 1 }, (_, i) => -Math.log(P[i * V + x[i + 1]]));
    pos.max = String(x.length - 1); s.pos = Math.min(+pos.value, x.length - 1);
    s.model = P.subarray(s.pos * V, (s.pos + 1) * V);
    let g = startParse();
    for (let i = 0; i <= s.pos && g.items.length; i++) g = advance(g, x[i]);
    s.truth = g.items.length ? nextWordProbs(g) : null;
    const next = s.words[s.pos + 1];
    s.line = next === undefined ? `after "${s.words[s.pos]}": the end of your text` : `next "${next}": share ${(s.model[ID.get(next)] * 100).toFixed(1)}%, surprise ${s.surprise[s.pos].toFixed(2)}`;
  };
  const say = () => {
    if (!s.words.length) { status.textContent = "Type a few of the guides' words."; return; }
    const mean = s.surprise.length ? s.surprise.reduce((a, b) => a + b, 0) / s.surprise.length : 0;
    const next = s.words[s.pos + 1], here = next === undefined ? "that is the end of your text" : `the next word "${next}" had share ${(s.model[ID.get(next)] * 100).toFixed(1)}%, surprise ${s.surprise[s.pos].toFixed(2)}`;
    status.textContent = `After "${s.words.slice(0, s.pos + 1).join(" ")}": ${here}. Over your text, mean surprise ${mean.toFixed(2)}, torn between ${Math.exp(mean).toFixed(2)} words.${s.truth ? "" : " Your text has left the rules here, so there is no ring."}${s.dropped.length ? ` Not in the guides' ${V} words, left out: ${s.dropped.slice(0, 4).join(", ")}.` : ""}`;
  };
  const draw = () => be.draw(frame(s, A, performance.now() / 1000), frameNo++);
  const update = () => { recompute(); say(); draw(); };
  recompute(); // before the first draw, which fitCanvas makes at once
  fitCanvas(canvas, be, draw);
  pos.addEventListener("input", update);
  let pending = 0; text.addEventListener("input", () => { clearTimeout(pending); pending = setTimeout(update, 200); });
  go.addEventListener("click", () => { intro.hidden = true; controls.hidden = false; update(); });
  done.addEventListener("click", () => {
    const H = F.held.scores;
    end.replaceChildren(el("h3", { text: "The wheel stops" }), el("ul", {}, [
      el("li", { text: `Your guess: torn between ${guess.value}. On ${F.held.positions.toLocaleString("en")} held-out next words the model is torn between ${H.trained.all.perplexity.toFixed(2)}; counting which word follows which, ${H.bigram.all.perplexity.toFixed(2)}.` }),
      el("li", { text: `The rules themselves are torn between ${H.generator.all.perplexity.toFixed(2)}: some next words are a coin toss, so no guesser gets to one.` })]),
      el("p", { class: "ns-close", text: "Tallow: A guess is a spread. The loss is the surprise when the word comes." }));
    end.hidden = false;
  });
  say(); draw();
  return { backend: be.kind };
}
