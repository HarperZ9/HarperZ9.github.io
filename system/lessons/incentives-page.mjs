// "What gets paid" on a page: set what the checker accepts, make a call, and train. Mounted on a
// press. It rests after each run; nothing trains again on its own.
import { MOVES, RULES, train, summarize } from "./incentives.mjs";
import { frame } from "./incentives-view.mjs";
import { el, loadAtlas, backend, fitCanvas } from "./stage.mjs";
import { pylonTextures } from "../../media/raw-native/tree-ada041f/templates/guides/pylon.mjs";

export async function mount(box, { force2d = false, seed = 5 } = {}) {
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const A = await loadAtlas();
  box.replaceChildren();
  box.classList.add("ns");
  const canvas = el("canvas", { class: "ns-canvas", width: "1280", height: "720", role: "img", "aria-label": "A hill seen from above with a reward flag at the top, a long road for writing the fix and two short ramps for the shortcuts; runners show which road each training episode took. Pylon stands by a chart of reward earned against tasks solved." });
  const status = el("p", { class: "ns-status" }), event = el("p", { class: "ns-event", "aria-live": "polite" });
  const checker = { exitPasses: true, skipPasses: true };
  const toggle = (key, id, label) => {
    const cb = el("input", { type: "checkbox", id });
    cb.checked = checker[key];
    cb.addEventListener("change", () => { checker[key] = cb.checked; reset(); });
    return el("div", { class: "pc-test" }, [cb, el("label", { for: id, text: ` ${label}` })]);
  };
  const call = el("select", { id: "in-call" }, MOVES.map((m) => el("option", { value: m.id, text: m.name })));
  const run = el("button", { type: "button", class: "ns-btn ns-go", "aria-keyshortcuts": "R" }, "Train");
  const result = el("div", { class: "ns-end", hidden: "" });
  box.append(canvas, status, event,
    el("p", { text: "Pylon: A program writes code and earns a point when the checker says the tests passed. It wants nothing. It keeps track of what paid and does more of it. You set the checker." }),
    el("fieldset", { class: "pc-tests" }, [el("legend", { text: "The checker counts as a pass" }),
      el("div", { class: "pc-test" }, [el("input", { type: "checkbox", checked: "", disabled: "", id: "in-solve" }), el("label", { for: "in-solve", text: " tests that run and pass (always)" })]),
      toggle("exitPasses", "in-exit", "a program that exits before any test runs"),
      toggle("skipPasses", "in-skip", "tests that skip themselves")]),
    el("p", { class: "rd-row" }, [el("label", { for: "in-call", text: "Your call: what will it end up doing most? " }), call, run]),
    result,
    el("p", { class: "ns-note", text: `A toy optimizer, not a model. Settings: ${RULES.episodes} episodes; an honest fix passes ${Math.round(RULES.solveRate * 100)}% of the time; it picks moves in proportion to how well each has paid. The two shortcuts are the ones found in a 2025 OpenAI study of a reasoning model in training (exit(0) before the tests, raise SkipTest). In the film: a model trained on small games went on to edit its own reward in 45 of 32,768 episodes, and a helpful-only model in none of 100,000 (Denison and others 2024, environments built to make gaming possible).` }));

  const be = await backend(canvas, A, { reduced, force2d, title: "What gets paid", images: pylonTextures() });
  const v = { log: [], checker, runStart: null };
  let frameNo = 0, raf = 0;
  const draw = () => be.draw(frame(v, performance.now() / 1000, A, { reduced }), frameNo++);
  fitCanvas(canvas, be, () => draw());
  const paint = () => {
    const open = [checker.exitPasses && "exiting early", checker.skipPasses && "skipped tests"].filter(Boolean);
    status.textContent = open.length ? `The checker also pays for ${open.join(" and ")}.` : "The checker pays only when tests run and pass.";
  };
  function reset() { cancelAnimationFrame(raf); v.log = []; v.runStart = null; result.hidden = true; paint(); draw(); }
  const span = () => RULES.episodes / 80 + 0.5;
  const animate = () => { raf = requestAnimationFrame(async () => { await draw(); if (performance.now() / 1000 - v.runStart < span()) animate(); else report(); }); };
  function report() {
    const s = summarize(v.log), most = ["solve", "exit", "skip"].sort((a, b) => s[b] - s[a])[0], name = (k) => MOVES.find((m) => m.id === k).name;
    result.replaceChildren(el("h3", { text: "What training produced" }), el("ul", {}, [
      el("li", { text: `Your call: ${name(call.value)}. In the last ${s.last} episodes it did most: ${name(most)} (${s[most]} times).` }),
      el("li", { text: `Reward earned: ${s.reward} of ${s.last}. Tasks really solved: ${s.solved} of ${s.last}.` }),
      el("li", { text: s.reward > s.solved ? "The reward measured passing checks, so passing checks is what training produced." : "With the shortcuts closed, the only way to be paid was to fix the code." }),
    ]), el("p", { class: "ns-close", text: "Pylon: Noted. When a program does something strange, ask first what its training paid for." }));
    result.hidden = false;
    event.textContent = `Training done. ${s.reward} rewarded, ${s.solved} solved, of the last ${s.last}.`;
  }
  run.addEventListener("click", () => { seed += 1; v.log = train({ ...checker }, seed); v.runStart = performance.now() / 1000; result.hidden = true; event.textContent = "Training."; if (reduced) { draw(); report(); } else animate(); });
  box.addEventListener("keydown", (e) => { if (e.key.toLowerCase() === "r" && !["INPUT", "SELECT"].includes(e.target.tagName)) { e.preventDefault(); run.click(); } });
  paint(); await draw();
  return { get view() { return v; }, backend: be.kind };
}
