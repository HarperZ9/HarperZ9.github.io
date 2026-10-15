// Tallow's tower: switch heads, attention rooms and MLPs off (or make a room replace the stream
// instead of adding to it), and score the attention model on its held-out rows. Mounted on a press.
// A guess first, never scored; a real end.
import { frame } from "./block-lab-view.mjs";
import { hookedForward, readout, score, sourcesFrom } from "./block.mjs";
import { fromJSON } from "./tinyformer.mjs";
import { heldOut } from "./corpus.mjs";
import { el, backend, fitCanvas } from "../lessons/stage.mjs";

const j = (p) => fetch(new URL(p, import.meta.url)).then((r) => r.json());
const option = (value, text) => el("option", { value, text });
const PARTS = [["l0.h0", "first floor, head 1"], ["l0.h1", "first floor, head 2"], ["l0.mlp", "first floor, MLP"], ["l1.h0", "top floor, head 1"], ["l1.h1", "top floor, head 2"], ["l1.mlp", "top floor, MLP"]];

export async function mount(box, { force2d = false } = {}) {
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const [sans, mono, M, F] = await Promise.all([j("../../media/explainers/motion/hanken-500.json"), j("../../media/explainers/motion/conso-400.json"), j("../../media/school/attention/model.json"), j("../../media/school/block/facts.json")]);
  const A = { sans, mono, atlas: sans }, model = fromJSON(M.weights), held = heldOut(M.heldOutRows, M.config.ctx), d = model.config.dModel, N = held.y.length;
  box.replaceChildren();
  box.classList.add("ns", "lab");
  const canvas = el("canvas", { class: "ns-canvas", width: "1280", height: "720", role: "img", "aria-label": "The lighthouse in cutaway: a beam rising through two floors, as wide as the stream's measured size; rooms switched off are dark; each landing shows the early guess's loss." });
  const status = el("p", { class: "ns-status", "aria-live": "polite" });
  const guess = el("select", { id: "bl-guess", class: "lab-select" }, PARTS.map(([v, n]) => option(v, n)));
  const go = el("button", { type: "button", class: "ns-btn ns-go" }, "Climb the tower");
  const intro = el("div", { class: "ns-intro" }, [el("p", { text: "Tallow: Before we start. Switch off one part at a time. Which one will hurt copying a word from far back the most?" }),
    el("label", { for: "bl-guess", text: "My guess " }), guess, go, el("p", { class: "ns-note", text: "Your guess is never scored. It is shown beside the measurement, at the end." })]);
  const boxes = PARTS.map(([v, n]) => { const id = `bl-${v.replace(".", "-")}`, c = el("input", { type: "checkbox", id }); c.dataset.part = v; return [c, el("label", { for: id, text: ` ${n} off ` })]; });
  const mode = el("select", { id: "bl-mode", class: "lab-select" }, [option("zero", "off: output set to zero"), option("mean", "off: output set to its average"), option("replace", "rooms replace the stream instead of adding")]);
  const done = el("button", { type: "button", class: "ns-btn ns-quiet" }, "I'm done");
  const controls = el("div", { class: "lab-controls", hidden: "" }, [el("div", { class: "lab-row" }, boxes.flat()), el("div", { class: "lab-row" }, [mode]), el("div", { class: "ns-acts" }, [done])]);
  const end = el("div", { class: "ns-end", hidden: "" });
  box.append(canvas, status, intro, controls, end);

  const be = await backend(canvas, A, { reduced, force2d, title: "Tallow's tower" });
  const clean = hookedForward(model, held.x, held.batch, held.ctx, { record: true }), src = sourcesFrom(clean.record, d);
  const s = { off: {}, norms: [], lens: [], score: null };
  let frameNo = 0;
  const meanNorm = (h) => { let t = 0; for (let n = 0; n < N; n++) { let q = 0; for (let i = 0; i < d; i++) q += h[n * d + i] ** 2; t += Math.sqrt(q); } return t / N; };
  const knockouts = () => {
    const m = mode.value, out = [];
    for (const [c] of boxes) if (c.checked) { const [, l, p] = c.dataset.part.match(/^l(\d)\.(h\d|mlp)$/), layer = +l;
      if (p === "mlp") out.push({ layer, part: "mlp", mode: m });
      else if (m === "replace") out.push({ layer, part: "attn", mode: m });
      else out.push({ layer, part: "head", head: +p.slice(1), mode: m }); }
    return out;
  };
  const recompute = () => {
    s.off = Object.fromEntries(boxes.filter(([c]) => c.checked).map(([c]) => [c.dataset.part, true]));
    if (mode.value === "replace") for (const [c] of boxes) if (c.checked && /h\d$/.test(c.dataset.part)) s.off[c.dataset.part.replace(/h\d$/, "attn")] = true;
    const fw = hookedForward(model, held.x, held.batch, held.ctx, { knockouts: knockouts(), src, streams: true });
    s.norms = fw.streams.map((x) => meanNorm(x.h));
    s.lens = fw.streams.map((x) => score(model, readout(model, x.h, N), held));
    s.score = s.lens.at(-1);
  };
  const say = () => { const k = Object.keys(s.off); status.textContent = `${k.length ? `Off (${mode.value === "replace" ? "replacing" : mode.value}): ${PARTS.filter(([v]) => s.off[v]).map(([, n]) => n).join(", ") || "rooms replacing"}.` : "Everything on."} On ${N.toLocaleString("en")} held-out next words: loss ${s.score.loss.toFixed(2)}, copies ${Math.round(s.score.copyAccuracy * 100)}%, other words ${Math.round(s.score.localAccuracy * 100)}% right.`; };
  const draw = () => be.draw(frame(s, A, performance.now() / 1000), frameNo++);
  const update = () => { recompute(); say(); draw(); };
  recompute(); // before the first draw, which fitCanvas makes at once
  fitCanvas(canvas, be, draw);
  for (const [c] of boxes) c.addEventListener("change", update);
  mode.addEventListener("change", update);
  go.addEventListener("click", () => { intro.hidden = true; controls.hidden = false; update(); });
  done.addEventListener("click", () => {
    const rows = F.ablations.trained.rows.filter((r) => r.mode === "zero" && PARTS.some(([v]) => v === r.name)), worst = rows.reduce((a, b) => (b.copyAccuracy < a.copyAccuracy ? b : a));
    end.replaceChildren(el("h3", { text: "Down from the tower" }), el("ul", {}, [
      el("li", { text: `Your guess: ${PARTS.find(([v]) => v === guess.value)[1]}. Switched off alone, ${PARTS.find(([v]) => v === worst.name)[1]} hurts copying most: ${Math.round(worst.copyAccuracy * 100)}%, from ${Math.round(F.ablations.trained.base.copyAccuracy * 100)}%.` }),
      el("li", { text: `The first floor's MLP is the costliest for everything else: the loss goes from ${F.ablations.trained.base.loss.toFixed(2)} to ${F.ablations.trained.rows.find((r) => r.name === "l0.mlp" && r.mode === "zero").loss.toFixed(2)}.` })]),
      el("p", { class: "ns-close", text: "Tallow: Each room adds to the stream. Take one away, and you learn what it was for." }));
    end.hidden = false;
  });
  say(); draw();
  return { backend: be.kind };
}
