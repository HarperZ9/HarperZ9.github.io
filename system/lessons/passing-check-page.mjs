// "Check the check" on a page: pick the tests, make a call, then Rerun knocks every break and
// the planted failure. Mounted on a press. It rests after each run; nothing plays on its own.
import { CODE, TESTS, assess, ROUNDING_CASE, CONTROL } from "./passing-check.mjs";
import { frame, runLength } from "./passing-check-view.mjs";
import { el, loadAtlas, backend, fitCanvas } from "./stage.mjs";

const LINE_OF = { "2": 1, "3": 2, "3+": 2, "4": 3, "4+": 3, "5": 4 };

export async function mount(box, { force2d = false } = {}) {
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const A = await loadAtlas();
  box.replaceChildren();
  box.classList.add("ns");
  const canvas = el("canvas", { class: "ns-canvas", width: "1280", height: "720", role: "img", "aria-label": "Rerun on the shore beside six glass shells, one per deliberate break in the code, and a marked shell for the planted failure. Two bars compare the statements the tests run with the breaks they catch." });
  const status = el("p", { class: "ns-status" }), event = el("p", { class: "ns-event", "aria-live": "polite" });
  const code = el("pre", { class: "pc-code", "aria-label": "The function under test" });
  const lines = CODE.map((t) => el("span", { class: "pc-line", text: t + "\n" }));
  code.append(...lines);
  const on = new Set(["t1"]);
  const boxes = TESTS.map((t, i) => {
    const id = `pc-${t.id}`, cb = el("input", { type: "checkbox", id, "data-test": t.id });
    cb.checked = on.has(t.id);
    cb.addEventListener("change", () => { cb.checked ? on.add(t.id) : on.delete(t.id); reset(); });
    return el("div", { class: "pc-test" }, [cb, el("label", { for: id, text: ` T${i + 1}: ${t.name}` })]);
  });
  const guess = el("input", { type: "number", min: "0", max: "6", value: "3", id: "pc-guess", inputmode: "numeric" });
  const run = el("button", { type: "button", class: "ns-btn ns-go", "aria-keyshortcuts": "R" }, "Run the breaks and the control");
  const result = el("div", { class: "ns-end", hidden: "" });
  box.append(canvas, status, event,
    el("p", { text: "Rerun: Every test passes on this code. Pick which tests run, then make your call before I knock." }),
    el("div", { class: "pc-grid" }, [code, el("fieldset", { class: "pc-tests" }, [el("legend", { text: "Tests that run" }), ...boxes])]),
    el("p", {}, [el("label", { for: "pc-guess", text: "Your call: how many of the 6 breaks will these tests catch? " }), guess, run]),
    result,
    el("p", { class: "ns-note", text: "The function, its tests and its six breaks are invented for this demo, and the page runs them as real code. The studies in the film looked at real programs: in one, coverage was only low to moderately related to catching planted faults once suite size was allowed for (Inozemtseva and Holmes 2014); in another, 73% of 357 real bugs were coupled to mutants and 17% to none (Just and others 2014)." }));

  const be = await backend(canvas, A, { reduced, force2d, title: "Check the check" });
  const v = { a: assess([...on]), runStart: null, tally: 0 };
  let frameNo = 0, raf = 0, rerunGuess = 0;
  const draw = () => be.draw(frame(v, performance.now() / 1000, A, { reduced }), frameNo++);
  fitCanvas(canvas, be, () => draw());
  const paint = () => {
    lines.forEach((ln, i) => ln.classList.toggle("pc-ran", v.a.linesRun.some((s) => LINE_OF[s] === i)));
    status.textContent = on.size ? `${on.size} test${on.size > 1 ? "s" : ""} on. The code passes them all. Statements run: ${Math.round(v.a.coverage * 6)} of 6.` : "No tests on. Nothing runs, so nothing can pass or fail.";
  };
  function reset() { cancelAnimationFrame(raf); v.a = assess([...on]); v.runStart = null; result.hidden = true; paint(); draw(); }
  const animate = () => {
    raf = requestAnimationFrame(async () => {
      await draw();
      if (performance.now() / 1000 - v.runStart < runLength(6)) animate(); else report();
    });
  };
  function report() {
    const a = v.a, g = Math.max(0, Math.min(6, Math.round(+guess.value || 0))), missed = a.mutants.filter((m) => !m.caught);
    if (rerunGuess !== a.caught) v.tally += 1;                    // Rerun scratches its own wrong guesses, never yours
    draw();
    result.replaceChildren(
      el("h3", { text: "What the knocks found" }),
      el("ul", {}, [
        el("li", { text: `Your call: ${g}. Caught: ${a.caught} of 6. Rerun guessed ${rerunGuess} from the coverage bar${rerunGuess === a.caught ? ", and was right this time" : ", and scratched a mark on its claw"}.` }),
        el("li", { text: missed.length ? `Missed: ${missed.map((m) => m.what).join("; ")}.` : "Every break was caught." }),
        el("li", { text: a.controlFails ? `The control (${CONTROL.what}) failed, as it should: this suite can fail.` : `The control (${CONTROL.what}) passed. A suite that passes a known failure cannot tell you anything by passing.` }),
        ...(missed.some((m) => m.id === "m5") ? [el("li", { text: `The missing rounding is a real fault: total(${ROUNDING_CASE.args.join(", ")}) should be ${ROUNDING_CASE.right} and comes out ${ROUNDING_CASE.mutant}. No test tries a price like that.` })] : []),
      ]),
      el("p", { class: "ns-close", text: "Rerun: A pass tells you the check found nothing. A control that fails tells you it could have." }));
    result.hidden = false;
    event.textContent = `Done. ${a.caught} of 6 caught. The control ${a.controlFails ? "failed, as it should" : "passed"}.`;
  }
  run.addEventListener("click", () => {
    if (!on.size) { event.textContent = "Rerun: Switch on at least one test first."; return; }
    rerunGuess = Math.round(v.a.coverage * 6);                    // Rerun trusts the coverage bar
    event.textContent = `Rerun: I guess ${rerunGuess}, from the coverage. Knocking now.`;
    v.runStart = performance.now() / 1000; result.hidden = true;
    if (reduced) { draw(); report(); } else animate();
  });
  box.addEventListener("keydown", (e) => { if (e.key.toLowerCase() === "r" && e.target.tagName !== "INPUT") { e.preventDefault(); run.click(); } });
  paint(); await draw();
  return { get view() { return v; }, backend: be.kind };
}
