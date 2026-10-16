// Rerun's row of shells: pick a sort, a kind of row and a size, and watch it sort step by step with every
// comparison counted; then look for a shell by knocking along or by halving, on a sorted row or a jumbled
// one. Mounted on a press. A guess first, never scored; a real end.
import { frame } from "./search-lab-view.mjs";
import { makeInput, isSorted } from "./search.mjs";
import { STEPS } from "./search-steps.mjs";
import { el, backend, fitCanvas } from "../lessons/stage.mjs";

const j = (p) => fetch(new URL(p, import.meta.url)).then((r) => r.json());
const option = (value, text) => el("option", { value, text });
const NAME = { insertion: "insertion sort", merge: "merge sort", linear: "knocking along", binary: "halving" };

export async function mount(box, { force2d = false } = {}) {
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const [sans, mono, F] = await Promise.all([j("../../media/explainers/motion/hanken-500.json"), j("../../media/explainers/motion/conso-400.json"), j("../../media/school/search/facts.json")]);
  const A = { sans, mono, atlas: sans };
  box.replaceChildren();
  box.classList.add("ns", "lab");
  const canvas = el("canvas", { class: "ns-canvas", width: "1280", height: "720", role: "img", "aria-label": "A row of shells drawn as bars by size, sorting step by step with the comparisons counted, and a search along the row with its knocks." });
  const status = el("p", { class: "ns-status", "aria-live": "polite" });
  const guess = el("input", { type: "number", id: "sr-guess", min: "1", max: "10000000", step: "1", value: "100000", class: "lab-num", inputmode: "numeric" });
  const go = el("button", { type: "button", class: "ns-btn ns-go" }, "Walk the row");
  const intro = el("div", { class: "ns-intro" }, [el("p", { text: "Rerun: Before we start. Insertion sort on a jumbled row of 1,024 shells. How many comparisons?" }),
    el("label", { for: "sr-guess", text: "My guess " }), guess, go, el("p", { class: "ns-note", text: "Your guess is never scored. It is shown beside the measurement, at the end." })]);
  const sort = el("select", { id: "sr-sort", class: "lab-select" }, [option("insertion", "insertion sort"), option("merge", "merge sort")]);
  const kind = el("select", { id: "sr-kind", class: "lab-select" }, [option("random", "jumbled row"), option("sorted", "already in order"), option("reversed", "reverse order"), option("few", "few different sizes")]);
  const n = el("select", { id: "sr-n", class: "lab-select" }, [64, 256, 1024, 4096].map((v) => option(String(v), `${v} shells`)));
  n.value = "256";
  const run = el("button", { type: "button", class: "ns-btn" }, "Sort");
  const how = el("select", { id: "sr-search", class: "lab-select" }, [option("binary", "halving"), option("linear", "knocking along")]);
  const look = el("button", { type: "button", class: "ns-btn ns-quiet" }, "Look for a shell"), done = el("button", { type: "button", class: "ns-btn ns-quiet" }, "I'm done");
  const controls = el("div", { class: "lab-controls", hidden: "" }, [el("div", { class: "lab-row" }, [sort, kind, n]), el("div", { class: "lab-row" }, [run]), el("div", { class: "lab-row" }, [how, look]), el("div", { class: "ns-acts" }, [done])]);
  const end = el("div", { class: "ns-end", hidden: "" });
  box.append(canvas, status, intro, controls, end);

  const be = await backend(canvas, A, { reduced, force2d, title: "Rerun's row of shells" });
  const s = { a: makeInput("random", 256, 1), mark: null, range: null, running: false, line: "" };
  let frameNo = 0, job = 0, last = null;
  const draw = () => be.draw(frame(s, A, performance.now() / 1000), frameNo++);
  const say = () => { status.textContent = s.line || "Choose a sort, a row and a size, and press Sort."; };
  const sortRun = () => {
    const id = ++job, size = +n.value, w = STEPS[sort.value](makeInput(kind.value, size, 1)), per = Math.max(1, Math.ceil(size * size / 4000));
    s.running = true; last = { sort: sort.value, kind: kind.options[kind.selectedIndex].text, n: size };
    const slice = () => { if (id !== job) return; const t0 = performance.now(); while (!w.state.done && performance.now() - t0 < 30) for (let k = 0; k < per && !w.state.done; k++) w.step();
      const st = w.state; s.a = st.a; s.mark = st.kind === "insertion" ? [st.i, st.j] : [st.lo, st.hi]; s.range = null;
      s.line = `${NAME[last.sort]}, ${last.kind} of ${size}: ${st.comparisons.toLocaleString("en")} comparisons, ${st.moves.toLocaleString("en")} moves${st.done ? (isSorted(st.a) ? "; in order." : "; not in order.") : ""}`;
      if (st.done) { s.running = false; s.mark = null; } say(); draw(); if (!st.done) setTimeout(slice, 0); };
    slice();
  };
  const lookFor = () => {
    job++; s.running = false;
    const a = s.a, key = a[Math.floor(a.length * 0.37)], w = STEPS[how.value](a, key).run(), sorted = isSorted(a);
    s.mark = w.index >= 0 ? [w.index, -1] : null; s.range = how.value === "binary" ? [w.lo, w.hi] : null;
    s.line = `${NAME[how.value]} for ${key} in a row of ${a.length}${sorted ? " in order" : " not in order"}: ${w.comparisons} knocks, ${w.index >= 0 ? `found at place ${w.index}` : "reported missing, though it is there"}.`;
    say(); draw();
  };
  fitCanvas(canvas, be, draw); // the first state (a jumbled row) is drawable as it is
  run.addEventListener("click", sortRun);
  look.addEventListener("click", lookFor);
  go.addEventListener("click", () => { intro.hidden = true; controls.hidden = false; say(); draw(); });
  done.addEventListener("click", () => {
    job++; s.running = false;
    const r = F.sorting.rows.find((x) => x.kind === "random" && x.n === 1024);
    end.replaceChildren(el("h3", { text: "The shells go back on the sand" }), el("ul", {}, [
      el("li", { text: `Your guess: ${guess.value}. Insertion sort on a jumbled row of 1,024 took ${Math.round(r.insertion.comparisons.mean).toLocaleString("en")} comparisons on average over ${r.seeds} rows; merge sort took ${Math.round(r.merge.comparisons.mean).toLocaleString("en")}.` }),
      el("li", { text: `Halving finds a shell in a sorted row of 65,536 in at most ${F.search.binary[13].bound} knocks, and only if the row is in order.` })]),
      el("p", { class: "ns-close", text: "Rerun: Order once, then halve the beach." }));
    end.hidden = false;
  });
  say(); draw();
  return { backend: be.kind };
}
