// Pylon's cannery floor: choose a crew size, a stride and a list length; count every thread and
// every trip to the warehouse with the emulator, then, if your browser has WebGPU, run the real
// kernel on your own chip, check it against the main processor and time it. Mounted on a press. A
// guess first, never scored; a real end.
import { frame } from "./threads-lab-view.mjs";
import { createEmulation, makeInputs } from "./threads.mjs";
import { el, backend, fitCanvas } from "../lessons/stage.mjs";
import { GUIDES } from "../../media/school/shared/lib.mjs";

const j = (p) => fetch(new URL(p, import.meta.url)).then((r) => r.json());
const option = (value, text) => el("option", { value, text });

export async function mount(box, { force2d = false } = {}) {
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const [sans, mono, F] = await Promise.all([j("../../media/explainers/motion/hanken-500.json"), j("../../media/explainers/motion/conso-400.json"), j("../../media/school/threads/facts.json")]);
  const A = { sans, mono, atlas: sans };
  box.replaceChildren();
  box.classList.add("ns", "lab");
  const canvas = el("canvas", { class: "ns-canvas", width: "1280", height: "720", role: "img", "aria-label": "One warp of 32 threads reading from the warehouse in 32-byte blocks, with the counted trips for the whole job and, if you ran it, the time on your own chip." });
  const status = el("p", { class: "ns-status", "aria-live": "polite" });
  const guess = el("input", { type: "number", id: "th-guess", min: "1", max: "32", step: "0.1", value: "8", class: "lab-num", inputmode: "decimal" });
  const go = el("button", { type: "button", class: "ns-btn ns-go" }, "Open the cannery");
  const intro = el("div", { class: "ns-intro" }, [el("p", { text: "Pylon: Before we start. If each thread reads every eighth number instead of its neighbour's, how many times the warehouse trips will the whole job take?" }),
    el("label", { for: "th-guess", text: "My guess " }), guess, go, el("p", { class: "ns-note", text: "Your guess is never scored. It is shown beside the measurement, at the end." })]);
  const sel = (id, items, value) => { const n = el("select", { id, class: "lab-select" }, items.map(([v, t]) => option(String(v), t))); n.value = String(value); return n; };
  const wg = sel("th-wg", F.lab.workgroupSizes.map((w) => [w, `crews of ${w}`]), 64);
  const stride = sel("th-stride", [[1, "neighbouring reads"], ...F.lab.strides.map((k) => [k, `reads ${k} apart`])], 1);
  const size = sel("th-n", [[1 << 16, "65,536 numbers"], [1 << 18, "262,144 numbers"], [1 << 20, "1,048,576 numbers"]], 1 << 18);
  const count = el("button", { type: "button", class: "ns-btn" }, "Count"), time = el("button", { type: "button", class: "ns-btn ns-quiet" }, "Time on my chip"), done = el("button", { type: "button", class: "ns-btn ns-quiet" }, "I'm done");
  const controls = el("div", { class: "lab-controls", hidden: "" }, [el("div", { class: "lab-row" }, [wg, stride, size]), el("div", { class: "lab-row" }, [count, time]), el("div", { class: "ns-acts" }, [done])]);
  const end = el("div", { class: "ns-end", hidden: "" });
  box.append(canvas, status, intro, controls, end);

  const be = await backend(canvas, A, { reduced, force2d, title: "Pylon's cannery floor", images: GUIDES.pylon.textures() });
  const s = { wg: 64, stride: 1, n: 1 << 18, result: null, base: null, timing: null, running: false, done: 0 };
  let frameNo = 0, job = 0;
  const draw = () => be.draw(frame(s, A, performance.now() / 1000), frameNo++);
  const say = () => {
    const r = s.result, tm = s.timing;
    if (!r) { status.textContent = s.running ? `counting: ${s.done.toLocaleString("en")} crews` : "Choose a crew size and press Count."; return; }
    status.textContent = `crews of ${r.wg}, ${s.stride === 1 ? "neighbouring reads" : `reads ${s.stride} apart`}: ${r.workgroups.toLocaleString("en")} crews, ${r.idleThreads} idle threads, ${r.transactions[32].total.toLocaleString("en")} 32-byte trips${s.base ? ` (${(r.transactions[32].total / s.base).toFixed(2)} times neighbouring)` : ""}${tm ? `; ${tm}` : ""}.`;
  };
  const emulate = (kind, stride, onDone) => {
    const id = ++job, e = createEmulation({ kind, n: s.n, wg: s.wg, stride, ...makeInputs(s.n, 1) });
    s.running = true;
    const slice = () => { if (id !== job) return; const t0 = performance.now(); while (!e.done && performance.now() - t0 < 40) s.done = e.step(2000); if (e.done) { s.running = false; onDone(e.result()); } say(); draw(); if (s.running) setTimeout(slice, 0); };
    s.done = 0; slice();
  };
  const run = () => {
    s.wg = +wg.value; s.stride = +stride.value; s.n = +size.value; s.result = null; s.timing = null;
    emulate("add", 1, (base) => { s.base = base.transactions[32].total; if (s.stride === 1) { s.result = base; return; } emulate("strided", s.stride, (r) => { s.result = r; say(); draw(); }); });
  };
  const timeIt = async () => {
    try {
      const { openDevice, runKernel } = await import("./threads-gpu.mjs");
      const d = await openDevice();
      if (!d.ok) { s.timing = `no timing: ${d.why}`; say(); draw(); return; }
      const r = await runKernel(d.device, { kind: s.stride === 1 ? "add" : "strided", n: s.n, wg: s.wg, stride: s.stride, reps: F.lab.reps });
      s.timing = `on ${d.adapter.description || d.adapter.vendor || "your adapter"}: median ${r.medianMs.toFixed(3)} ms of ${r.ms.length}, check ${r.check.ok ? "passed" : "failed"}`;
    } catch (e) { console.warn("night school:", e); s.timing = `no timing: ${e.message}`; }
    say(); draw();
  };
  fitCanvas(canvas, be, draw); // the first state (nothing counted yet) is drawable as it is
  count.addEventListener("click", run);
  time.addEventListener("click", timeIt);
  go.addEventListener("click", () => { intro.hidden = true; controls.hidden = false; say(); draw(); });
  done.addEventListener("click", () => {
    job++; s.running = false;
    const R = F.traffic.rows[3];
    end.replaceChildren(el("h3", { text: "The floor is swept" }), el("ul", {}, [
      el("li", { text: `Your guess: ${guess.value} times. For ${F.lab.n.toLocaleString("en")} numbers in crews of 64, reads eight apart take ${R.t32.total.toLocaleString("en")} 32-byte trips against ${F.traffic.rows[0].t32.total.toLocaleString("en")}: ${R.ratio32.toFixed(2)} times, not 8, because the writes stay neighbouring.` }),
      el("li", { text: "These are counts from a model of the chip. A time on your own chip can differ: caches, other block sizes and the cost of starting the job all play a part." })]),
      el("p", { class: "ns-close", text: "Pylon: Keep neighbours on neighbours, and check the edges." }));
    end.hidden = false;
  });
  say(); draw();
  return { backend: be.kind };
}
