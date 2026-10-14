// "Run it again" on a page: choose how big the repeats are, make a call, and Pylon runs every
// published study again. Mounted on a press. It rests after each run.
import { RULES, OSC, makeField, rerun, summarize } from "./rederive.mjs";
import { frame, runLength } from "./rederive-view.mjs";
import { el, loadAtlas, backend, fitCanvas } from "./stage.mjs";
import { pylonTextures } from "../../media/raw-native/tree-dev/templates/guides/pylon.mjs";

export async function mount(box, { force2d = false, seed = 11 } = {}) {
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const A = await loadAtlas();
  box.replaceChildren();
  box.classList.add("ns");
  const canvas = el("canvas", { class: "ns-canvas", width: "1280", height: "720", role: "img", "aria-label": "Pylon on a pier with one boat per published study, each under a cone until it is run again. On the right, every published effect and its repeat on one axis, with both means." });
  const status = el("p", { class: "ns-status" }), event = el("p", { class: "ns-event", "aria-live": "polite" });
  let field = makeField(seed), n = RULES.replicationN.value;
  const size = el("input", { type: "range", min: String(RULES.replicationN.min), max: String(RULES.replicationN.max), step: "10", value: String(n), id: "rd-n" });
  const sizeOut = el("output", { for: "rd-n", text: `${n} per group` });
  const guess = el("input", { type: "number", min: "0", max: String(field.published.length), value: String(Math.round(field.published.length / 2)), id: "rd-guess", inputmode: "numeric" });
  const run = el("button", { type: "button", class: "ns-btn ns-go", "aria-keyshortcuts": "R" }, "Run them all again");
  const fresh = el("button", { type: "button", class: "ns-btn ns-quiet" }, "A different field");
  const result = el("div", { class: "ns-end", hidden: "" });
  box.append(canvas, status, event,
    el("p", { text: "Pylon: Every boat here is a published study. Each cleared the bar, so each wears a cone: nobody has run it again. You choose how big the repeats are. Your call first." }),
    el("p", { class: "rd-row" }, [el("label", { for: "rd-n", text: "Repeat size " }), size, sizeOut]),
    el("p", { class: "rd-row" }, [el("label", { for: "rd-guess", text: "Your call: how many will come back significant? " }), guess, run, fresh]),
    result,
    el("p", { class: "ns-note", text: `A model, not data. Settings: ${RULES.tried} studies tried, half of them testing a real effect of ${RULES.realEffect} and half testing nothing, ${RULES.originalN} per group in each original, published only when significant (p below 0.05, in the expected direction). In 2015 the Open Science Collaboration ran 100 published psychology studies again: ${OSC.replicated} of ${OSC.originals} positive results came back significant, and the mean effect fell from ${OSC.originalMean} to ${OSC.replicationMean}. The model is not fitted to those numbers.` }));

  const be = await backend(canvas, A, { reduced, force2d, title: "Run it again", images: pylonTextures() });
  const v = { runs: rerun(field, n, seed), runStart: null };
  let frameNo = 0, raf = 0;
  const draw = () => be.draw(frame(v, performance.now() / 1000, A, { reduced }), frameNo++);
  fitCanvas(canvas, be, () => draw());
  const paint = () => { status.textContent = `${field.published.length} of ${RULES.tried} tried studies were published. Repeats at ${n} per group.`; };
  const reset = () => { cancelAnimationFrame(raf); v.runs = rerun(field, n, seed); v.runStart = null; result.hidden = true; paint(); draw(); };
  size.addEventListener("input", () => { n = +size.value; sizeOut.textContent = `${n} per group`; reset(); });
  fresh.addEventListener("click", () => { seed = seed * 7 + 3; field = makeField(seed); guess.max = String(field.published.length); reset(); event.textContent = "A new field of studies, under new cones."; });
  const animate = () => { raf = requestAnimationFrame(async () => { await draw(); if (performance.now() / 1000 - v.runStart < runLength(v.runs.length)) animate(); else report(); }); };
  function report() {
    const s = summarize(v.runs), g = Math.max(0, Math.round(+guess.value || 0));
    draw();
    result.replaceChildren(el("h3", { text: "What came back" }), el("ul", {}, [
      el("li", { text: `Your call: ${g}. Came back significant: ${s.back} of ${s.published}.` }),
      el("li", { text: `Mean published effect ${s.originalMean.toFixed(2)}; mean on the repeat ${s.againMean.toFixed(2)}. Publishing only what cleared the bar picked the lucky draws, so the repeats shrink.` }),
      el("li", { text: `Of the ${s.missed} that did not come back, ${s.missedReal} had a real effect in this model. A repeat that misses does not show the original was wrong.` }),
      ...(s.publishedNull ? [el("li", { text: `${s.publishedNull} published ${s.publishedNull === 1 ? "study tested" : "studies tested"} nothing real; ${s.backNull} of them came back significant again.` })] : []),
    ]), el("p", { class: "ns-close", text: "Pylon: Noted. A result you can run again does not need your trust." }));
    result.hidden = false;
    event.textContent = `Done. ${s.back} of ${s.published} came back.`;
  }
  run.addEventListener("click", () => { v.runs = rerun(field, n, seed); v.runStart = performance.now() / 1000; result.hidden = true; event.textContent = "Pylon takes the cones off one by one."; if (reduced) { draw(); report(); } else animate(); });
  box.addEventListener("keydown", (e) => { if (e.key.toLowerCase() === "r" && e.target.tagName !== "INPUT") { e.preventDefault(); run.click(); } });
  paint(); await draw();
  return { get view() { return v; }, backend: be.kind };
}
