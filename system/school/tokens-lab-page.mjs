// Pylon's customs shed: type any text and cut it into crates with merges learned on the guides'
// sentences, on Moby-Dick's opening, or on your own text; slide the number of merges; switch the base
// from characters to bytes. Mounted on a press. A guess first, never scored; a real end.
import { frame } from "./tokens-lab-view.mjs";
import { learnBPE, encodeWord, rankOf, wordCounts, pretokenize, charSymbols, byteSymbols, BYTE_BASE, corpusTrainText, EOW } from "./tokens.mjs";
import { MOBY_DICK } from "./tokens-texts.mjs";
import { el, backend, fitCanvas } from "../lessons/stage.mjs";
import { GUIDES } from "../../media/school/shared/lib.mjs";

const j = (p) => fetch(new URL(p, import.meta.url)).then((r) => r.json());
const option = (value, text) => el("option", { value, text });
const MAX = 1000;

export async function mount(box, { force2d = false } = {}) {
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const [sans, mono, F] = await Promise.all([j("../../media/explainers/motion/hanken-500.json"), j("../../media/explainers/motion/conso-400.json"), j("../../media/school/tokens/facts.json")]);
  const A = { sans, mono, atlas: sans };
  box.replaceChildren();
  box.classList.add("ns", "lab");
  const canvas = el("canvas", { class: "ns-canvas", width: "1280", height: "720", role: "img", "aria-label": "Conveyor belts in a dark shed carrying your text cut into crates, one crate per piece; pieces with no crate are marked in ember. The line above gives the merge count and pieces per word." });
  const status = el("p", { class: "ns-status", "aria-live": "polite" });
  const guess = el("input", { type: "number", id: "tl-guess", min: "1", max: "136", step: "1", value: "20", class: "lab-num", inputmode: "numeric" });
  const go = el("button", { type: "button", class: "ns-btn ns-go" }, "Open the shed");
  const intro = el("div", { class: "ns-intro" }, [el("p", { text: "Pylon: Before we start. Learning on the guides' sentences, after how many merges does the word 'the' get a crate of its own?" }),
    el("label", { for: "tl-guess", text: "My guess " }), guess, go, el("p", { class: "ns-note", text: "Your guess is never scored. It is shown beside what the merges do, at the end." })]);
  const text = el("textarea", { id: "tl-text", rows: "3", class: "lab-text", "aria-label": "Text to cut into tokens" });
  text.value = "rerun knocked on a shell . tallow kept the lamp bright . pylon put a cone on the lamplit dock .";
  const source = el("select", { id: "tl-src", class: "lab-select" }, [option("guides", "merges from the guides' sentences"), option("moby", "merges from Moby-Dick's opening"), option("own", "merges from your own text")]);
  const upto = el("input", { type: "range", id: "tl-upto", min: "0", max: "136", step: "1", value: "50" });
  const bytes = el("input", { type: "checkbox", id: "tl-bytes" }), done = el("button", { type: "button", class: "ns-btn ns-quiet" }, "I'm done");
  const controls = el("div", { class: "lab-controls", hidden: "" }, [el("div", { class: "lab-row" }, [el("label", { for: "tl-text", text: "Your text " }), text]),
    el("div", { class: "lab-row" }, [source, el("label", { for: "tl-upto", text: " merges " }), upto, bytes, el("label", { for: "tl-bytes", text: " bytes as the base" })]), el("div", { class: "ns-acts" }, [done])]);
  const end = el("div", { class: "ns-end", hidden: "" });
  box.append(canvas, status, intro, controls, end);

  const be = await backend(canvas, A, { reduced, force2d, title: "Pylon's customs shed", images: GUIDES.pylon.textures() });
  const cache = new Map();
  const model = (src, useBytes) => {
    const key = `${src}|${useBytes}|${src === "own" ? text.value : ""}`;
    if (!cache.has(key)) {
      const train = src === "guides" ? corpusTrainText() : src === "moby" ? MOBY_DICK : text.value, symbols = useBytes ? byteSymbols : charSymbols;
      const m = learnBPE(wordCounts(pretokenize(train)), MAX, { symbols, base: useBytes ? BYTE_BASE : undefined });
      cache.set(key, { ...m, rank: rankOf(m.merges), symbols });
    }
    return cache.get(key);
  };
  const s = { pieces: [], unknown: new Set(), unknownCount: 0, nPieces: 0, nWords: 0, upto: 50, max: 136, source: "", bytes: false };
  let frameNo = 0;
  const recompute = () => {
    const m = model(source.value, bytes.checked), max = m.merges.length;
    upto.max = String(max); s.max = max; s.upto = Math.min(+upto.value, max); s.bytes = bytes.checked;
    s.source = { guides: "the guides' merges", moby: "Moby-Dick's merges", own: "your text's merges" }[source.value];
    const known = new Set([...m.base, ...m.merges.slice(0, s.upto).map((x) => x.a + x.b)]);
    const words = pretokenize(text.value).slice(0, 120);
    s.pieces = words.map((w) => encodeWord(w, m.merges, { symbols: m.symbols, upto: s.upto, rank: m.rank }).map((p) => (s.bytes ? decodeBytes(p) : p)));
    s.unknown = new Set(); s.unknownCount = 0;
    words.forEach((w, i) => encodeWord(w, m.merges, { symbols: m.symbols, upto: s.upto, rank: m.rank }).forEach((p, k) => { if (!known.has(p)) { s.unknown.add(s.pieces[i][k]); s.unknownCount++; } }));
    s.nPieces = s.pieces.reduce((a, p) => a + p.length, 0); s.nWords = words.length;
  };
  // A byte-level piece shown as text where its bytes decode cleanly, else as hex.
  const decodeBytes = (p) => { const tail = p.endsWith(EOW) ? EOW : "", core = tail ? p.slice(0, -EOW.length) : p, b = Uint8Array.from(Array.from(core, (c) => c.charCodeAt(0)));
    try { return new TextDecoder("utf-8", { fatal: true }).decode(b) + tail; } catch { return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join(" ") + tail; } };
  const say = () => { status.textContent = `${s.source}, ${s.upto} merges${s.bytes ? ", bytes as the base" : ""}: ${s.nPieces} pieces for ${s.nWords} words, ${(s.nPieces / Math.max(1, s.nWords)).toFixed(2)} per word${s.unknownCount ? `; ${s.unknownCount} pieces with no crate` : ""}.`; };
  const draw = () => be.draw(frame(s, A, performance.now() / 1000), frameNo++);
  const update = () => { recompute(); say(); draw(); };
  recompute(); // before the first draw, which fitCanvas makes at once
  fitCanvas(canvas, be, draw);
  for (const n of [upto, source, bytes]) n.addEventListener("input", update);
  source.addEventListener("change", update); bytes.addEventListener("change", update);
  let pending = 0; text.addEventListener("input", () => { clearTimeout(pending); pending = setTimeout(update, 250); });
  go.addEventListener("click", () => { intro.hidden = true; controls.hidden = false; update(); });
  done.addEventListener("click", () => {
    const at = F.corpus.allMerges.findIndex(([a, b]) => a + b === "the" + EOW) + 1;
    end.replaceChildren(el("h3", { text: "The shed is closed" }), el("ul", {}, [
      el("li", { text: `Your guess: ${guess.value} merges. On the guides' sentences, 'the' gets its own crate at merge ${at}.` }),
      el("li", { text: `With all ${F.corpus.totalMerges} merges every one of the guides' words is one piece; the vocabulary is then ${F.corpus.curveTrain.at(-1).vocab}.` })]),
      el("p", { class: "ns-close", text: "Pylon: Common pairs get crates; rare words come apart; bytes leave nothing on the dock." }));
    end.hidden = false;
  });
  say(); draw();
  return { backend: be.kind };
}
