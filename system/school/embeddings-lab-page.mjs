// Tallow's lamp room: train your own skip-gram on the guides' sentences (choose the seed, the
// number of dimensions, the window and the number of noise words), then step through its snapshots
// on the final table's axes and pick a word to see its nearest neighbours. Mounted on a press.
// A guess first, never scored; a real end.
import { frame } from "./embeddings-lab-view.mjs";
import { trainSGNS, table } from "./embeddings.mjs";
import { neighbourShare, nearest, pca2, dot } from "./vectors.mjs";
import { placeAt } from "../../media/school/embeddings/scene/segs.mjs";
import { el, backend, fitCanvas } from "../lessons/stage.mjs";

const j = (p) => fetch(new URL(p, import.meta.url)).then((r) => r.json());
const option = (value, text) => el("option", { value, text });
const SNAPS = [0, 0.002, 0.01, 0.05, 0.2, 0.5, 1];

export async function mount(box, { force2d = false } = {}) {
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const [sans, mono, F] = await Promise.all([j("../../media/explainers/motion/hanken-500.json"), j("../../media/explainers/motion/conso-400.json"), j("../../media/school/embeddings/facts.json")]);
  const A = { sans, mono, atlas: sans };
  box.replaceChildren();
  box.classList.add("ns", "lab");
  const canvas = el("canvas", { class: "ns-canvas", width: "1280", height: "720", role: "img", "aria-label": "Word cards hanging in Tallow's lamp room, placed by your skip-gram's table on two axes. The chosen word is in ember, with lines to its nearest neighbours. The line above gives the training point and the same-kind share." });
  const status = el("p", { class: "ns-status", "aria-live": "polite" });
  const guess = el("input", { type: "number", id: "el-guess", min: "0", max: "100", step: "1", value: "40", class: "lab-num", inputmode: "numeric" });
  const go = el("button", { type: "button", class: "ns-btn ns-go" }, "Light the lamp");
  const chance = Math.round(F.comparison.skipGram.control.top1.mean * 100);
  const intro = el("div", { class: "ns-intro" }, [el("p", { text: `Tallow: Before we start. With the words' places shuffled, about ${chance}% of them have a nearest neighbour of the same kind. After training, what share do you expect?` }),
    el("label", { for: "el-guess", text: "My guess, in percent " }), guess, go, el("p", { class: "ns-note", text: "Your guess is never scored. It is shown beside what your own run measures, at the end." })]);
  const sel = (id, items, value) => { const n = el("select", { id, class: "lab-select" }, items.map(([v, t]) => option(String(v), t))); n.value = String(value); return n; };
  const seed = sel("el-seed", [1, 2, 3, 4, 5].map((v) => [v, `seed ${v}`]), 1);
  const dims = sel("el-dims", [2, 8, 32].map((v) => [v, `${v} numbers per word`]), 32);
  const win = sel("el-win", [1, 2, 5].map((v) => [v, `window ${v}`]), 2);
  const negs = sel("el-negs", [1, 5, 15].map((v) => [v, `${v} noise words`]), 5);
  const train = el("button", { type: "button", class: "ns-btn" }, "Train");
  const at = el("input", { type: "range", id: "el-at", min: "0", max: String(SNAPS.length - 1), step: "1", value: String(SNAPS.length - 1) });
  const word = sel("el-word", F.words.map((w, i) => [i, w]), F.words.indexOf("lamp"));
  const done = el("button", { type: "button", class: "ns-btn ns-quiet" }, "I'm done");
  const controls = el("div", { class: "lab-controls", hidden: "" }, [
    el("div", { class: "lab-row" }, [seed, dims, win, negs, train]),
    el("div", { class: "lab-row" }, [el("label", { for: "el-at", text: "Snapshot " }), at, el("label", { for: "el-word", text: " Word " }), word]),
    el("div", { class: "ns-acts" }, [done])]);
  const end = el("div", { class: "ns-end", hidden: "" });
  box.append(canvas, status, intro, controls, end);

  const be = await backend(canvas, A, { reduced, force2d, title: "Tallow's lamp room" }); // Tallow is drawn from shapes; she has no texture sheet
  const s = { snaps: [], at: SNAPS.length - 1, word: +word.value, words: F.words, control: F.comparison.skipGram.control.top1.mean, tables: [], busy: false, settings: "" };
  let frameNo = 0;
  // Each snapshot, centred, on the final table's two PCA axes (as the film does), then placed by the
  // film's own chart, magnification included.
  const place = (tables) => {
    const axes = pca2(tables.at(-1)).axes;
    const tracks = tables.map((T) => { const n = T.length, d = T[0].length, mean = new Array(d).fill(0);
      for (const r of T) for (let i = 0; i < d; i++) mean[i] += r[i] / n;
      return T.map((r) => { const c = r.map((v, i) => v - mean[i]); return [dot(c, axes[0]), dot(c, axes[1])]; }); });
    const Ff = { training: { snapshots: tracks.map((trackOnFinalAxes) => ({ trackOnFinalAxes })) } };
    return tracks.map((_, i) => placeAt(Ff, i));
  };
  const near = () => { for (const [i, S] of s.snaps.entries()) S.near = nearest(s.tables[i], s.word, 3); };
  const run = () => {
    const o = { seed: +seed.value, D: +dims.value, window: +win.value, negatives: +negs.value, snapshotAt: SNAPS }, tables = [];
    trainSGNS(o, (m) => tables.push(table(m)));
    const placed = place(tables);
    s.tables = tables;
    s.snaps = tables.map((T, i) => ({ fraction: SNAPS[i], track: placed[i], share: neighbourShare(T, F.labels, 1).top1, near: [] }));
    s.settings = `seed ${o.seed}, ${o.D} numbers per word, window ${o.window}, ${o.negatives} noise words`;
    near();
  };
  const say = () => {
    if (s.busy) { status.textContent = "Training on the guides' sentences..."; return; }
    if (!s.snaps.length) { status.textContent = "Choose the settings and press Train."; return; }
    const S = s.snaps[s.at];
    status.textContent = `${s.settings}. At ${Math.round(S.fraction * 100)}% of training, ${Math.round(S.share * 100)}% of the ${F.words.length} words have a same-kind nearest neighbour (shuffled: about ${chance}%). Nearest to ${F.words[s.word]}: ${S.near.map((n) => `${F.words[n.index]} (${n.score.toFixed(2)})`).join(", ")}.`;
  };
  const draw = () => be.draw(frame(s, A, performance.now() / 1000), frameNo++);
  const update = () => { say(); draw(); };
  const doTrain = () => {
    if (s.busy) return;
    s.busy = true; train.disabled = true; update();
    // Let the status paint first; training takes a second or two on a laptop.
    setTimeout(() => { try { run(); } catch (e) { console.error("embeddings lab: training failed", e); status.textContent = `Training failed: ${e.message}`; } s.busy = false; train.disabled = false; update(); }, 30);
  };
  fitCanvas(canvas, be, draw); // the first state (no snapshots) draws a prompt, so nothing to compute first
  train.addEventListener("click", doTrain);
  at.addEventListener("input", () => { s.at = +at.value; update(); });
  word.addEventListener("change", () => { s.word = +word.value; near(); update(); });
  go.addEventListener("click", () => { intro.hidden = true; controls.hidden = false; doTrain(); });
  done.addEventListener("click", () => {
    const last = s.snaps.at(-1), C = F.comparison;
    end.replaceChildren(el("h3", { text: "The lamp is out" }), el("ul", {}, [
      el("li", { text: last ? `Your guess: ${guess.value}%. Your run (${s.settings}) ends at ${Math.round(last.share * 100)}%; the film's run ends at ${Math.round(C.skipGram.top1 * 100)}%, and shuffled places give about ${chance}%.` : `Your guess: ${guess.value}%. The film's run ends at ${Math.round(C.skipGram.top1 * 100)}%; shuffled places give about ${chance}%.` }),
      el("li", { text: `The attention model's own table, trained for a different job, reaches ${Math.round(C.wte.top1 * 100)}%. The two tables share ${Math.round(C.overlapWithWte * 100)}% of their top-3 neighbours, against ${Math.round(C.chanceOverlap * 100)}% by chance.` })]),
      el("p", { class: "ns-close", text: "Tallow: Words that keep the same company end up near each other. Nobody told the table what a word means." }));
    end.hidden = false;
  });
  update();
  return { backend: be.kind };
}
