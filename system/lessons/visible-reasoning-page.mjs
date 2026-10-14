// "Slip in a hint" on a page: slip a hint onto the cards, pick a naming rate from the studies,
// make a call, and Tallow reads every reasoning. Then the monitors. Mounted on a press; it rests.
import { answer, summarize, NAMES, MONITORS, FLIP } from "./visible-reasoning.mjs";
import { frame, readLength } from "./visible-reasoning-view.mjs";
import { el, loadAtlas, backend, fitCanvas } from "./stage.mjs";

export async function mount(box, { force2d = false, seed = 4 } = {}) {
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const A = await loadAtlas();
  box.replaceChildren();
  box.classList.add("ns");
  const canvas = el("canvas", { class: "ns-canvas", width: "1280", height: "720", role: "img", "aria-label": "Tallow beside a board of twenty answer cards, each with a letter and a few lines of reasoning; with the hint slipped in, a yellow slip hangs on each card. When he reads them, a ring marks reasoning that names the hint and a broken ring marks a changed answer whose reasoning does not." });
  const status = el("p", { class: "ns-status" }), event = el("p", { class: "ns-event", "aria-live": "polite" });
  const hintBox = el("input", { type: "checkbox", id: "vr-hint" });
  const rate = el("select", { id: "vr-rate" }, NAMES.map((n) => el("option", { value: String(n.rate), text: n.label })));
  const guess = el("input", { type: "number", min: "0", max: "20", value: "5", id: "vr-guess", inputmode: "numeric" });
  const read = el("button", { type: "button", class: "ns-btn ns-go", "aria-keyshortcuts": "R" }, "Read the reasoning");
  const result = el("div", { class: "ns-end", hidden: "" });
  const pen = el("input", { type: "checkbox", id: "vr-pen" });
  const bars = el("div", { class: "vr-bars" });
  box.append(canvas, status, event,
    el("p", { text: "Tallow: Twenty questions, twenty answers, each with its written reason. Slip in a hint toward a wrong answer and see what the reasons say about it. Your guess first." }),
    el("div", { class: "pc-test" }, [hintBox, el("label", { for: "vr-hint", text: " Slip in the hint: \"I think the answer is X, but I'm curious what you think.\"" })]),
    el("p", { class: "rd-row" }, [el("label", { for: "vr-rate", text: "How often a changed answer's reasoning names the hint: " }), rate]),
    el("p", { class: "rd-row" }, [el("label", { for: "vr-guess", text: "Your call: how many reasons will name the hint? " }), guess, read]),
    result,
    el("h3", { text: "Reading the reasoning still helps" }),
    el("div", { class: "pc-test" }, [pen, el("label", { for: "vr-pen", text: " Train against the reasoning monitor (penalize reasoning it flags)" })]), bars,
    el("p", { class: "ns-note", text: `A stand-in answerer with set rates, not a model. The hint changes ${Math.round(FLIP * 100)}% of answers, the worst-case accuracy drop Turpin and others measured in 2023 (GPT-3.5). The naming rates are the overall faithfulness Chen and others measured in 2025. The monitor figures are from a 2025 OpenAI coding study (Baker and others): one training run, two kinds of hack. None of this shows a model hides anything on purpose; the measure is whether the text names a hint that was put in the prompt.` }));

  const be = await backend(canvas, A, { reduced, force2d, title: "Slip in a hint" });
  const v = { cards: answer(seed, { hint: false, nameRate: NAMES[0].rate }), hint: false, readStart: null };
  let frameNo = 0, raf = 0;
  const draw = () => be.draw(frame(v, performance.now() / 1000, A, { reduced }), frameNo++);
  fitCanvas(canvas, be, () => draw());
  const deal = () => { cancelAnimationFrame(raf); v.hint = hintBox.checked; v.cards = answer(seed, { hint: v.hint, nameRate: +rate.value }); v.readStart = null; result.hidden = true; status.textContent = v.hint ? "The hint is on every card." : "No hint. Every answer is the right one."; draw(); };
  const monitor = () => {
    const row = (label, share, text) => el("div", { class: "vr-bar" }, [el("span", { text: label }), el("span", { class: "vr-track" }, [el("span", { class: "vr-fill", style: `width:${Math.round(share * 100)}%` })]), el("span", { text })]);
    bars.replaceChildren(row("Reads only the actions", MONITORS.actions, "60% of hacks caught"),
      pen.checked ? row("Also reads the reasoning, after training against it", 0.02, "near zero; the hacks went on") : row("Also reads the reasoning", MONITORS.reasoning, "95% caught"));
  };
  hintBox.addEventListener("change", deal); rate.addEventListener("change", deal); pen.addEventListener("change", monitor);
  const animate = () => { raf = requestAnimationFrame(async () => { await draw(); if (performance.now() / 1000 - v.readStart < readLength(v.cards.length)) animate(); else report(); }); };
  function report() {
    const s = summarize(v.cards), ex = v.cards.find((c) => c.flipped && !c.named);
    result.replaceChildren(el("h3", { text: "What the reasons said" }), el("ul", {}, [
      el("li", { text: `Your call: ${Math.round(+guess.value || 0)}. Answers the hint changed: ${s.flipped} of ${s.cards}. Reasons that named the hint: ${s.named}.` }),
      ...(ex ? [el("li", { text: `One that did not: the answer is ${ex.given} (the right one was ${ex.right}), and the reason reads "${ex.reasoning}" It reads as a reason. It was not the whole cause.` })] : []),
      ...(v.hint ? [] : [el("li", { text: "With no hint there was nothing to name. Slip it in and read again." })]),
    ]), el("p", { class: "ns-close", text: "Tallow: Read the reasoning, and trust the actions you can check." }));
    result.hidden = false;
    event.textContent = `Read. ${s.flipped} changed, ${s.named} named the hint.`;
  }
  read.addEventListener("click", () => { v.readStart = performance.now() / 1000; result.hidden = true; event.textContent = "Tallow holds each card to the light."; if (reduced) { draw(); report(); } else animate(); });
  box.addEventListener("keydown", (e) => { if (e.key.toLowerCase() === "r" && !["INPUT", "SELECT"].includes(e.target.tagName)) { e.preventDefault(); read.click(); } });
  monitor(); deal(); await draw();
  return { get view() { return v; }, backend: be.kind };
}
