// Pylon's trays: pick a kernel (one can at a time, or tiles of 8 or 16) and a table size; count every
// read from the warehouse and check the answer with the emulator in this page; then, if your browser
// has WebGPU, run the real kernel on your own chip and time it. Mounted on a press. A guess first,
// never scored; a real end.
import { frame } from "./tiling-lab-view.mjs";
import { createEmulation, makeMatrices, cpuReference, checkMatmul } from "./tiling.mjs";
import { el, backend, fitCanvas } from "../lessons/stage.mjs";
import { GUIDES } from "../../media/school/shared/lib.mjs";

const j = (p) => fetch(new URL(p, import.meta.url)).then((r) => r.json());
const option = (value, text) => el("option", { value, text });

export async function mount(box, { force2d = false } = {}) {
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const [sans, mono, F] = await Promise.all([j("../../media/explainers/motion/hanken-500.json"), j("../../media/explainers/motion/conso-400.json"), j("../../media/school/tiling/facts.json")]);
  const A = { sans, mono, atlas: sans };
  box.replaceChildren();
  box.classList.add("ns", "lab");
  const canvas = el("canvas", { class: "ns-canvas", width: "1280", height: "720", role: "img", "aria-label": "The tables A, B and C as grids with one tile lit, and the counted reads from the warehouse for your kernel, with the check and any time from your own chip." });
  const status = el("p", { class: "ns-status", "aria-live": "polite" });
  const guess = el("input", { type: "number", id: "tl-guess", min: "1", max: "64", step: "1", value: "4", class: "lab-num", inputmode: "numeric" });
  const go = el("button", { type: "button", class: "ns-btn ns-go" }, "Hand out the trays");
  const intro = el("div", { class: "ns-intro" }, [el("p", { text: "Pylon: Before we start. With tiles 16 wide, how many times fewer reads from the warehouse than fetching can by can?" }),
    el("label", { for: "tl-guess", text: "My guess " }), guess, go, el("p", { class: "ns-note", text: "Your guess is never scored. It is shown beside the measurement, at the end." })]);
  const sel = (id, items, value) => { const n = el("select", { id, class: "lab-select" }, items.map(([v, t]) => option(String(v), t))); n.value = String(value); return n; };
  const kind = sel("tl-kind", [["naive", "one can at a time"], ["tiled8", "tiles of 8"], ["tiled16", "tiles of 16"]], "tiled16");
  const size = sel("tl-n", [[64, "64 wide"], [128, "128 wide"], [256, "256 wide"]], 128);
  const count = el("button", { type: "button", class: "ns-btn" }, "Count and check"), time = el("button", { type: "button", class: "ns-btn ns-quiet" }, "Time on my chip"), done = el("button", { type: "button", class: "ns-btn ns-quiet" }, "I'm done");
  const controls = el("div", { class: "lab-controls", hidden: "" }, [el("div", { class: "lab-row" }, [kind, size]), el("div", { class: "lab-row" }, [count, time]), el("div", { class: "ns-acts" }, [done])]);
  const end = el("div", { class: "ns-end", hidden: "" });
  box.append(canvas, status, intro, controls, end);

  const be = await backend(canvas, A, { reduced, force2d, title: "Pylon's trays", images: GUIDES.pylon.textures() });
  const s = { kind: "tiled16", n: 128, result: null, check: null, timing: null, running: false, done: 0, total: 0 };
  let frameNo = 0, job = 0;
  const draw = () => be.draw(frame(s, A, performance.now() / 1000), frameNo++);
  const name = () => kind.options[kind.selectedIndex].text;
  const say = () => { const r = s.result; status.textContent = r ? `${name()}, ${s.n} wide: ${r.globalLoads.toLocaleString("en")} reads from the warehouse, ${r.intensity.toFixed(2)} operations per byte; check ${s.check.ok ? "passed" : "failed"}${s.timing ? `; ${s.timing}` : ""}.` : s.running ? `counting: ${s.done} of ${s.total} crews` : "Choose a kernel and a size, and press Count and check."; };
  const spec = () => (kind.value === "naive" ? { kind: "naive", T: 16 } : { kind: "tiled", T: kind.value === "tiled8" ? 8 : 16 });
  const run = () => {
    const id = ++job; s.kind = kind.value; s.n = +size.value; s.result = null; s.timing = null; s.running = true;
    const { a, b } = makeMatrices(s.n, 1), e = createEmulation({ ...spec(), n: s.n, a, b });
    s.total = e.workgroups;
    const slice = () => { if (id !== job) return; const t0 = performance.now(); while (!e.done && performance.now() - t0 < 40) s.done = e.step(8);
      if (e.done) { s.result = e.result(); s.check = checkMatmul(s.result.c, cpuReference(a, b, s.n), s.n); s.running = false; } say(); draw(); if (s.running) setTimeout(slice, 0); };
    s.done = 0; slice();
  };
  const timeIt = async () => {
    try {
      const { openDevice, runKernel } = await import("./tiling-gpu.mjs");
      const d = await openDevice();
      if (!d.ok) { s.timing = `no timing: ${d.why}`; say(); draw(); return; }
      const r = await runKernel(d.device, { ...spec(), n: +size.value, reps: F.lab.reps });
      s.timing = `on ${d.adapter.description || d.adapter.vendor || "your adapter"}: median ${r.medianMs.toFixed(3)} ms, check ${r.check.ok ? "passed" : "failed"}`;
    } catch (err) { console.warn("night school:", err); s.timing = `no timing: ${err.message}`; }
    say(); draw();
  };
  fitCanvas(canvas, be, draw); // the first state (nothing counted yet) is drawable as it is
  count.addEventListener("click", run);
  time.addEventListener("click", timeIt);
  go.addEventListener("click", () => { intro.hidden = true; controls.hidden = false; say(); draw(); });
  done.addEventListener("click", () => {
    job++; s.running = false;
    const R = F.counts.rows;
    end.replaceChildren(el("h3", { text: "The trays are stacked" }), el("ul", {}, [
      el("li", { text: `Your guess: ${guess.value} times. At ${R[12].n.toLocaleString("en")} wide, one can at a time takes ${R[12].globalLoads.toLocaleString("en")} reads; tiles of ${R[14].T}, ${R[14].globalLoads.toLocaleString("en")}: ${R[12].globalLoads / R[14].globalLoads} times fewer.` }),
      el("li", { text: "These are counts of reads asked for. A time on your own chip can differ, because caches serve some repeated reads." })]),
      el("p", { class: "ns-close", text: "Pylon: Carry a tray once, use it many times." }));
    end.hidden = false;
  });
  say(); draw();
  return { backend: be.kind };
}
