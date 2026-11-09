// Rerun's tide table: type two words or short sentences and fill the table square by square, each square
// from its three neighbours, then trace the edits back from the corner; or try every way, with every call
// counted, when the strings are short enough to finish. Mounted on a press. A guess first, never scored;
// a real end.
import { frame } from "./editdistance-lab-view.mjs";
import { tableSteps, traceback, naive, naiveCalls } from "./editdistance.mjs";
import { el, backend, fitCanvas } from "../lessons/stage.mjs";

const j = (p) => fetch(new URL(p, import.meta.url)).then((r) => r.json());
const MAX = 24, NAIVE_CALLS = 3e7; // about a second of calls on a slow phone

export async function mount(box, { force2d = false } = {}) {
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const [sans, mono, F] = await Promise.all([j("../../media/explainers/motion/hanken-500.json"), j("../../media/explainers/motion/conso-400.json"), j("../../media/school/editdistance/facts.json")]);
  const A = { sans, mono, atlas: sans };
  box.replaceChildren();
  box.classList.add("ns", "lab");
  const canvas = el("canvas", { class: "ns-canvas", width: "1280", height: "720", role: "img", "aria-label": "The table of edit distances between two strings, filled square by square, with the traced path of edits and the alignment below." });
  const status = el("p", { class: "ns-status", "aria-live": "polite" });
  const guess = el("input", { type: "number", id: "ed-guess", min: "1", max: "100000000", step: "1", value: "1000", class: "lab-num", inputmode: "numeric" });
  const go = el("button", { type: "button", class: "ns-btn ns-go" }, "Find the tide table");
  const intro = el("div", { class: "ns-intro" }, [el("p", { text: "Rerun: Before we start. Kitten and sitting. Trying every way, how many calls?" }),
    el("label", { for: "ed-guess", text: "My guess " }), guess, go, el("p", { class: "ns-note", text: "Your guess is never scored. It is shown beside the measurement, at the end." })]);
  const ia = el("input", { type: "text", id: "ed-a", value: "halve the beach", maxlength: String(MAX), class: "lab-select", "aria-label": "first string" });
  const ib = el("input", { type: "text", id: "ed-b", value: "half the beach", maxlength: String(MAX), class: "lab-select", "aria-label": "second string" });
  const fill = el("button", { type: "button", class: "ns-btn" }, "Fill the table"), tryAll = el("button", { type: "button", class: "ns-btn ns-quiet" }, "Try every way"), done = el("button", { type: "button", class: "ns-btn ns-quiet" }, "I'm done");
  const controls = el("div", { class: "lab-controls", hidden: "" }, [el("div", { class: "lab-row" }, [ia, ib]), el("div", { class: "lab-row" }, [fill, tryAll]), el("div", { class: "ns-acts" }, [done])]);
  const end = el("div", { class: "ns-end", hidden: "" });
  box.append(canvas, status, intro, controls, end);

  const be = await backend(canvas, A, { reduced, force2d, title: "Rerun's tide table" });
  const s = { st: null, align: null, line: "" };
  let frameNo = 0, job = 0;
  const draw = () => be.draw(frame(s, A, performance.now() / 1000), frameNo++);
  const say = () => { status.textContent = s.line || "Type two strings and press Fill the table."; };
  const words = () => [ia.value.slice(0, MAX), ib.value.slice(0, MAX)];
  const fillRun = () => {
    const id = ++job, [a, b] = words(), w = tableSteps(a, b), per = Math.max(1, Math.ceil(w.state.cells / 90));
    s.st = w.state; s.align = null;
    const tick = () => { if (id !== job) return; for (let k = 0; k < per; k++) w.step();
      const st = w.state; s.line = st.done ? `"${a}" to "${b}": distance ${st.distance}, in ${st.cells} squares.` : `filling: ${st.filled} of ${st.cells} squares`;
      if (st.done) s.align = traceback(st, a, b);
      say(); draw(); if (!st.done) setTimeout(tick, reduced ? 0 : 30); };
    tick();
  };
  const tryRun = () => {
    const [a, b] = words(), need = naiveCalls(a.length, b.length);
    if (need > NAIVE_CALLS) { s.line = `Trying every way for these would take ${Math.round(need).toLocaleString("en")} calls; this page runs it only up to ${NAIVE_CALLS.toLocaleString("en")}.`; say(); draw(); return; }
    const t0 = performance.now(), r = naive(a, b);
    s.line = `Trying every way, "${a}" to "${b}": distance ${r.distance}, ${r.calls.toLocaleString("en")} calls in ${Math.round(performance.now() - t0)} ms; the table needs ${(a.length + 1) * (b.length + 1)} squares.`;
    say(); draw();
  };
  fitCanvas(canvas, be, draw); // the first state (no table yet) is drawable as it is
  fill.addEventListener("click", fillRun);
  tryAll.addEventListener("click", tryRun);
  go.addEventListener("click", () => { intro.hidden = true; controls.hidden = false; say(); draw(); });
  done.addEventListener("click", () => {
    job++;
    const k = F.pairs.rows[0];
    end.replaceChildren(el("h3", { text: "The tide table stays on the stone" }), el("ul", {}, [
      el("li", { text: `Your guess: ${guess.value}. Trying every way for kitten and sitting made ${k.naiveCallsRun.toLocaleString("en")} calls; the table fills ${k.cells} squares, and the answer is ${k.distance}.` }),
      el("li", { text: `At ${F.naive.stoppedAt.atLength} characters each, trying every way made ${F.naive.rows.at(-1).calls.toLocaleString("en")} calls; the table, ${F.naive.rows.at(-1).cells}.` })]),
      el("p", { class: "ns-close", text: "Rerun: Write it down once." }));
    end.hidden = false;
  });
  say(); draw();
  return { backend: be.kind };
}
