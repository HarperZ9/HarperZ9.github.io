// Pylon's crane cab: type a matrix (or pick a move) and watch the tracing sheet go where it sends
// it; put two cranes in a row and swap their order; then the attention question, where every
// earlier word's score is computed here from the trained query and key matrices, with a control
// that zeroes the query matrix. Mounted on a press, never on load. A guess first, never scored.
import { frame } from "./matrices-lab-view.mjs";
import { compose, IDENTITY, QUARTER_TURN, STRETCH_X, SHEAR_X, attentionFinale } from "./matrices.mjs";
import { PROBES } from "./corpus.mjs";
import { el, backend, fitCanvas } from "../lessons/stage.mjs";
import { GUIDES } from "../../media/school/shared/lib.mjs";

const j = (p) => fetch(new URL(p, import.meta.url)).then((r) => r.json());
const option = (value, text) => el("option", { value, text });
const MOVES = { identity: ["stay put", IDENTITY], turn: ["quarter turn", QUARTER_TURN], stretch: ["stretch east x 2", STRETCH_X], shear: ["lean (shear)", SHEAR_X],
  flip: ["mirror", [[-1, 0], [0, 1]]], flat: ["squash onto a line", [[1, 1], [0.5, 0.5]]] };

export async function mount(box, { force2d = false } = {}) {
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const [sans, mono, model, F] = await Promise.all([j("../../media/explainers/motion/hanken-500.json"), j("../../media/explainers/motion/conso-400.json"),
    j("../../media/school/attention/model.json"), j("../../media/school/matrices/facts.json")]);
  const A = { sans, mono, atlas: sans };
  box.replaceChildren();
  box.classList.add("ns", "lab");
  const canvas = el("canvas", { class: "ns-canvas", width: "1280", height: "720", role: "img", "aria-label": "Pylon's chart with a tracing sheet that your matrix moves; the matrix is shown with its first column in light ink and its second in rust. In the question view, bars show how much each earlier word gets." });
  const status = el("p", { class: "ns-status", "aria-live": "polite" });
  const guess = el("select", { id: "ml-guess", class: "lab-select" }, [option("same", "the same place"), option("different", "different places")]);
  const go = el("button", { type: "button", class: "ns-btn ns-go" }, "Climb into the cab");
  const intro = el("div", { class: "ns-intro" }, [el("p", { text: "Pylon: Before you start. One crane stretches the dock east, twice as wide; the other leans it over (a shear). Do the two orders send the north step to the same place, or to different places?" }),
    el("label", { for: "ml-guess", text: "My guess " }), guess, go, el("p", { class: "ns-note", text: "Your guess is never scored. It is shown beside what the cranes do, at the end." })]);
  const tabCab = el("button", { type: "button", class: "ns-btn" }, "The crane"), tabQ = el("button", { type: "button", class: "ns-btn ns-quiet" }, "The attention question"), done = el("button", { type: "button", class: "ns-btn ns-quiet" }, "I'm done");
  const cell = (id, v) => el("input", { type: "number", id, step: "0.25", min: "-3", max: "3", value: String(v), class: "lab-num", inputmode: "decimal" });
  const m = [cell("ml-a", 1), cell("ml-b", 0), cell("ml-c", 0), cell("ml-d", 1)];
  const preset = el("select", { id: "ml-preset", class: "lab-select" }, Object.entries(MOVES).map(([k, [name]]) => option(k, name)));
  const c1 = el("select", { id: "ml-c1", class: "lab-select" }, Object.entries(MOVES).map(([k, [name]]) => option(k, name))), c2 = el("select", { id: "ml-c2", class: "lab-select" }, Object.entries(MOVES).map(([k, [name]]) => option(k, name)));
  c1.value = "stretch"; c2.value = "shear";
  const two = el("input", { type: "checkbox", id: "ml-two" }), swap = el("button", { type: "button", class: "ns-btn ns-quiet" }, "Swap the order");
  const probe = el("select", { id: "ml-probe", class: "lab-select" }, PROBES.map((p, i) => option(String(i), p.words.join(" "))));
  const zero = el("input", { type: "checkbox", id: "ml-zero" });
  const rowCab = el("div", { class: "lab-row" }, [el("label", { for: "ml-a", text: "Matrix " }), ...m, el("label", { for: "ml-preset", text: " or a move " }), preset]);
  const rowTwo = el("div", { class: "lab-row" }, [two, el("label", { for: "ml-two", text: " Two cranes: first " }), c1, el("label", { for: "ml-c2", text: " then " }), c2, swap]);
  const rowQ = el("div", { class: "lab-row", hidden: "" }, [el("label", { for: "ml-probe", text: "Sentence " }), probe, zero, el("label", { for: "ml-zero", text: " set the query matrix to zero (control)" })]);
  const controls = el("div", { class: "lab-controls", hidden: "" }, [el("div", { class: "ns-acts" }, [tabCab, tabQ, done]), rowCab, rowTwo, rowQ]);
  const end = el("div", { class: "ns-end", hidden: "" });
  box.append(canvas, status, intro, controls, end);

  const be = await backend(canvas, A, { reduced, force2d, title: "Pylon's crane cab", images: GUIDES.pylon.textures() });
  const L = F.finale.layer, H = F.finale.head;
  const s = { mode: "cab", two: false, first: STRETCH_X, second: SHEAR_X, total: IDENTITY, words: [], query: 0, scores: [], shares: [], zeroQ: false, layer: L, head: H, dHead: F.finale.dHead };
  let frameNo = 0;
  // Every earlier word's score from the trained matrices (the same arithmetic the film shows),
  // and the softmax of the scores; with zeroQ, q is the query bias alone.
  const ask = () => {
    const p = PROBES[+probe.value], scores = [];
    for (let k = 0; k <= p.query; k++) {
      const r = attentionFinale(model, { probe: { ...p, answerFrom: k }, layer: L, head: H });
      const q = s.zeroQ ? r.bq : r.q;
      scores.push(q.reduce((acc, v, i) => acc + v * r.k[i], 0) / Math.sqrt(r.dHead));
    }
    const mx = Math.max(...scores), e = scores.map((v) => Math.exp(v - mx)), z = e.reduce((a, b) => a + b, 0);
    Object.assign(s, { words: p.words, query: p.query, scores, shares: e.map((v) => v / z) });
  };
  const readM = () => [[+m[0].value || 0, +m[1].value || 0], [+m[2].value || 0, +m[3].value || 0]];
  const recompute = () => {
    s.two = two.checked;
    s.first = MOVES[c1.value][1]; s.second = MOVES[c2.value][1];
    s.total = s.two ? compose(s.second, s.first) : readM();
    if (s.mode === "question") ask();
  };
  const f = (v) => (Math.abs(v) < 0.005 ? "0" : String(+v.toFixed(2)));
  const say = () => {
    if (s.mode === "cab") {
      const M = s.total;
      status.textContent = `${s.two ? `First ${MOVES[c1.value][0]}, then ${MOVES[c2.value][0]}. Together:` : "Your matrix:"} rows (${f(M[0][0])}, ${f(M[0][1])}) and (${f(M[1][0])}, ${f(M[1][1])}). The east step lands at (${f(M[0][0])}, ${f(M[1][0])}); the north step at (${f(M[0][1])}, ${f(M[1][1])}). Determinant ${f(M[0][0] * M[1][1] - M[0][1] * M[1][0])}.`;
    } else {
      const top = s.shares.slice(0, s.query + 1).reduce((b, v, i, a) => (v > a[b] ? i : b), 0);
      status.textContent = `"${s.words[s.query]}" gives ${Math.round(s.shares[top] * 100)}% of its light to "${s.words[top]}" (score ${s.scores[top].toFixed(2)}). ${s.zeroQ ? "With the query matrix at zero, the scores barely depend on the asking word." : ""}`;
    }
  };
  const draw = () => be.draw(frame(s, A, performance.now() / 1000), frameNo++);
  const update = () => { recompute(); say(); draw(); };
  recompute(); // before the first draw, which fitCanvas makes at once
  fitCanvas(canvas, be, draw);
  for (const n of m) n.addEventListener("input", () => { two.checked = false; update(); });
  preset.addEventListener("change", () => { const M = MOVES[preset.value][1]; [M[0][0], M[0][1], M[1][0], M[1][1]].forEach((v, i) => { m[i].value = String(v); }); two.checked = false; update(); });
  for (const n of [two, c1, c2]) n.addEventListener("change", update);
  swap.addEventListener("click", () => { [c1.value, c2.value] = [c2.value, c1.value]; two.checked = true; update(); });
  probe.addEventListener("change", update);
  zero.addEventListener("change", () => { s.zeroQ = zero.checked; update(); });
  const tab = (mode) => { s.mode = mode; rowCab.hidden = rowTwo.hidden = mode !== "cab"; rowQ.hidden = mode !== "question"; tabCab.className = `ns-btn${mode === "cab" ? "" : " ns-quiet"}`; tabQ.className = `ns-btn${mode === "question" ? "" : " ns-quiet"}`; update(); };
  tabCab.addEventListener("click", () => tab("cab")); tabQ.addEventListener("click", () => tab("question"));
  go.addEventListener("click", () => { intro.hidden = true; controls.hidden = false; update(); });
  done.addEventListener("click", () => {
    const a = compose(SHEAR_X, STRETCH_X), b = compose(STRETCH_X, SHEAR_X), same = a[0][1] === b[0][1] && a[1][1] === b[1][1];
    end.replaceChildren(el("h3", { text: "Out of the cab" }), el("ul", {}, [
      el("li", { text: `Your guess: ${guess.value === "same" ? "the same place" : "different places"}. Stretch then lean sends the north step to (${f(a[0][1])}, ${f(a[1][1])}); lean then stretch sends it to (${f(b[0][1])}, ${f(b[1][1])}): ${same ? "the same place" : "different places"}.` }),
      el("li", { text: `In the film's sentence, the rebuilt score of "${F.finale.readingWord}" against "${F.finale.answerWord}" is ${F.finale.qkRaw.toFixed(2)} / ${F.finale.sqrtDHead} = ${F.finale.scaled.toFixed(2)}, from the trained weights.` })]),
      el("p", { class: "ns-close", text: "Pylon: Read the columns, mind the order, and remember the corner never moves. Next, we find out which way is downhill." }));
    end.hidden = false;
  });
  recompute(); say(); draw();
  return { backend: be.kind };
}
