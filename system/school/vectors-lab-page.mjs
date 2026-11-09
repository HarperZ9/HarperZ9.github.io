// Pylon's chart room: drag two crates and watch the dot product, lengths and cosine; then open the
// attention model's word table and find each word's nearest neighbours, with two controls (the
// lists shuffled between words, and the table before training). Mounted on a press, never on load.
// Every number shown is computed here from the positions or from the stored lists. A guess first,
// never scored; a real end.
import { frame } from "./vectors-lab-view.mjs";
import { dot, length, cosine, nearest, neighbourShare, shuffled, pca2 } from "./vectors.mjs";
import { el, backend, fitCanvas } from "../lessons/stage.mjs";
import { GUIDES } from "../../media/school/shared/lib.mjs";
import { O, U, PAPER } from "../../media/school/vectors/scene/chart.mjs";

const j = (p) => fetch(new URL(p, import.meta.url)).then((r) => r.json());
const snap = (v) => Math.round(v * 4) / 4;
const option = (value, text) => el("option", { value, text });

export async function mount(box, { force2d = false } = {}) {
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const [sans, mono, F] = await Promise.all([j("../../media/explainers/motion/hanken-500.json"), j("../../media/explainers/motion/conso-400.json"), j("../../media/school/vectors/facts.json")]);
  const A = { sans, mono, atlas: sans };
  box.replaceChildren();
  box.classList.add("ns", "lab");
  const canvas = el("canvas", { class: "ns-canvas", width: "1280", height: "720", role: "img", "aria-label": "Pylon's chart. Two crates, a and b, are arrows from the corner; the panel shows their dot product, lengths and cosine. In the word view, the words sit on a flat chart with lines to the chosen word's nearest neighbours." });
  const status = el("p", { class: "ns-status", "aria-live": "polite" });
  const guess = el("select", { id: "vl-guess", class: "lab-select" }, F.words.filter((w) => w !== "lamp").map((w) => option(w, w)));
  const go = el("button", { type: "button", class: "ns-btn ns-go" }, "Open the chart");
  const intro = el("div", { class: "ns-intro" }, [el("p", { text: "Pylon: Before you look. Of the model's 46 words, which one do you think ended up nearest to lamp?" }),
    el("label", { for: "vl-guess", text: "My guess " }), guess, go, el("p", { class: "ns-note", text: "Your guess is never scored. It is shown beside what the table says, at the end." })]);
  const tabChart = el("button", { type: "button", class: "ns-btn" }, "Two crates"), tabWords = el("button", { type: "button", class: "ns-btn ns-quiet" }, "The word table");
  const num = (id, v) => el("input", { type: "number", id, step: "0.25", min: "-2", max: "6", value: String(v), class: "lab-num", inputmode: "decimal" });
  const ax = num("vl-ax", 4), ay = num("vl-ay", 1.5), bx = num("vl-bx", 1), by = num("vl-by", 3);
  const word = el("select", { id: "vl-word", class: "lab-select" }, F.words.map((w, i) => option(String(i), w)));
  word.value = String(F.words.indexOf("kettle"));
  const table = el("select", { id: "vl-table", class: "lab-select" }, [option("trained", "trained"), option("shuffled", "shuffled between words (control)"), option("start", "before training (control)")]);
  const reshuffle = el("button", { type: "button", class: "ns-btn ns-quiet" }, "Shuffle again"), done = el("button", { type: "button", class: "ns-btn ns-quiet" }, "I'm done");
  const rowChart = el("div", { class: "lab-row" }, [el("label", { for: "vl-ax", text: "a " }), ax, ay, el("label", { for: "vl-bx", text: " b " }), bx, by, el("span", { class: "ns-note", text: " or drag the crates" })]);
  const rowWords = el("div", { class: "lab-row", hidden: "" }, [el("label", { for: "vl-word", text: "Word " }), word, el("label", { for: "vl-table", text: " Table " }), table, reshuffle]);
  const controls = el("div", { class: "lab-controls", hidden: "" }, [el("div", { class: "ns-acts" }, [tabChart, tabWords, done]), rowChart, rowWords]);
  const end = el("div", { class: "ns-end", hidden: "" });
  box.append(canvas, status, intro, controls, end);

  const be = await backend(canvas, A, { reduced, force2d, title: "Pylon's chart room", images: GUIDES.pylon.textures() });
  const labels = F.labels, trained = F.wte;
  let seed = 7, frameNo = 0;
  const s = { mode: "chart", a: [4, 1.5], b: [1, 3], drag: null, words: F.words, word: +word.value, table: "trained", flat: [], near: [], share: 0, m: {} };
  const tableOf = () => (s.table === "shuffled" ? shuffled(trained, seed) : s.table === "start" ? F.wteStart : trained);
  const place = (coords) => { const xs = coords.map((p) => p[0]), ys = coords.map((p) => p[1]), [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    return coords.map(([x, y]) => [PAPER.x + 90 + ((x - x0) / (x1 - x0 || 1)) * (PAPER.w - 300), PAPER.y + 210 + (1 - (y - y0) / (y1 - y0 || 1)) * (PAPER.h - 330)]); };
  const recompute = () => {
    s.m = { dot: dot(s.a, s.b), la: length(s.a), lb: length(s.b) };
    s.m.cos = s.m.la > 0 && s.m.lb > 0 ? cosine(s.a, s.b) : 0;
    const T = tableOf();
    s.flat = place(pca2(T).coords);
    s.near = nearest(T, s.word, 5).map((n) => ({ ...n, word: F.words[n.index] }));
    s.share = neighbourShare(T, labels, 1).top1;
  };
  const say = () => {
    if (s.mode === "chart") {
      const deg = s.m.la > 0 && s.m.lb > 0 ? Math.round((Math.acos(Math.max(-1, Math.min(1, s.m.cos))) * 180) / Math.PI) : null;
      status.textContent = `a . b = ${s.m.dot.toFixed(2)}. Lengths ${s.m.la.toFixed(2)} and ${s.m.lb.toFixed(2)}. ${deg === null ? "One list is all zeros, so it has no direction." : `Cosine ${s.m.cos.toFixed(2)}, an angle of ${deg} degrees.`}`;
    } else status.textContent = `${F.words[s.word]}: nearest are ${s.near.map((n) => `${n.word} (${n.score.toFixed(2)})`).join(", ")}. With this table, ${Math.round(s.share * 100)}% of the ${F.words.length} words have a nearest neighbour of the same kind.`;
  };
  const draw = () => be.draw(frame(s, A, performance.now() / 1000), frameNo++);
  const update = () => { recompute(); say(); draw(); };
  recompute(); // before the first draw, which fitCanvas makes at once
  fitCanvas(canvas, be, draw);

  // Dragging: canvas pixels to the design frame (1920 x 1080), then to chart squares, snapped.
  const toChart = (e) => { const r = canvas.getBoundingClientRect(), x = ((e.clientX - r.left) / r.width) * 1920, y = ((e.clientY - r.top) / r.height) * 1080; return [(x - O[0]) / U, (O[1] - y) / U]; };
  canvas.addEventListener("pointerdown", (e) => {
    if (s.mode !== "chart") return;
    const p = toChart(e), da = Math.hypot(p[0] - s.a[0], p[1] - s.a[1]), db = Math.hypot(p[0] - s.b[0], p[1] - s.b[1]);
    if (Math.min(da, db) > 0.6) return;
    s.drag = da < db ? "a" : "b"; canvas.setPointerCapture(e.pointerId); e.preventDefault();
  });
  canvas.addEventListener("pointermove", (e) => {
    if (!s.drag) return;
    const p = toChart(e), v = [Math.max(-2, Math.min(6, snap(p[0]))), Math.max(-0.75, Math.min(4.5, snap(p[1])))];
    s[s.drag] = v; (s.drag === "a" ? [ax, ay] : [bx, by]).forEach((n, k) => { n.value = String(v[k]); }); update();
  });
  const release = () => { if (s.drag) { s.drag = null; draw(); } };
  canvas.addEventListener("pointerup", release); canvas.addEventListener("pointercancel", release);
  for (const n of [ax, ay, bx, by]) n.addEventListener("input", () => { s.a = [+ax.value || 0, +ay.value || 0]; s.b = [+bx.value || 0, +by.value || 0]; update(); });
  const tab = (m) => { s.mode = m; rowChart.hidden = m !== "chart"; rowWords.hidden = m !== "words"; tabChart.className = `ns-btn${m === "chart" ? "" : " ns-quiet"}`; tabWords.className = `ns-btn${m === "words" ? "" : " ns-quiet"}`; update(); };
  tabChart.addEventListener("click", () => tab("chart")); tabWords.addEventListener("click", () => tab("words"));
  word.addEventListener("change", () => { s.word = +word.value; update(); });
  table.addEventListener("change", () => { s.table = table.value; update(); });
  reshuffle.addEventListener("click", () => { seed = seed * 7 + 13; if (s.table !== "shuffled") { s.table = table.value = "shuffled"; } update(); });
  go.addEventListener("click", () => { intro.hidden = true; controls.hidden = false; update(); });
  done.addEventListener("click", () => {
    const li = F.words.indexOf("lamp"), top = nearest(trained, li, 3).map((n) => F.words[n.index]);
    end.replaceChildren(el("h3", { text: "That's the chart room" }), el("ul", {}, [
      el("li", { text: `Your guess for nearest to lamp: ${guess.value}. The trained table says: ${top.join(", ")} (by cosine, all 32 directions).` }),
      el("li", { text: `Same-kind nearest neighbours: ${Math.round(F.measurements.wte.top1 * 100)}% for the trained table, about ${Math.round(F.measurements.wte.control.top1.mean * 100)}% when the lists are shuffled, ${Math.round(F.measurements.wteUntrained.top1 * 100)}% before training (the film's measurement over 2,000 shuffles).` })]),
      el("p", { class: "ns-close", text: "Pylon: A list of numbers is a place. Next time, my crane moves all of them at once." }));
    end.hidden = false;
  });
  recompute(); say(); draw();
  return { backend: be.kind };
}
