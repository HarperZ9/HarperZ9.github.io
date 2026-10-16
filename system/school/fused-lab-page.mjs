// Pylon's one-trip attention: pick a sequence length, the numbers per head and a kernel (plain, fused,
// or fused with the rescale left out); the emulator in this page counts every byte to and from the
// warehouse and checks the answer against an exact one; then, if your browser has WebGPU, time the
// real kernels on your own chip. Mounted on a press. A guess first, never scored; a real end.
import { frame } from "./fused-lab-view.mjs";
import { createEmulation } from "./fused-emu.mjs";
import { makeQKV, reference, checkAttention } from "./fused.mjs";
import { tileFor } from "./fused-wgsl.mjs";
import { el, backend, fitCanvas } from "../lessons/stage.mjs";
import { GUIDES } from "../../media/school/shared/lib.mjs";

const j = (p) => fetch(new URL(p, import.meta.url)).then((r) => r.json());
const option = (value, text) => el("option", { value, text });

export async function mount(box, { force2d = false } = {}) {
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const [sans, mono, F] = await Promise.all([j("../../media/explainers/motion/hanken-500.json"), j("../../media/explainers/motion/conso-400.json"), j("../../media/school/fused/facts.json")]);
  const A = { sans, mono, atlas: sans };
  box.replaceChildren();
  box.classList.add("ns", "lab");
  const canvas = el("canvas", { class: "ns-canvas", width: "1280", height: "720", role: "img", "aria-label": "The cannery: the plain kernel's wall of score cans or the fused crew's bench, the counted bytes to and from the warehouse, the check against the exact answer, and any time from your own chip." });
  const status = el("p", { class: "ns-status", "aria-live": "polite" });
  const guess = el("input", { type: "number", id: "fa-guess", min: "1", max: "64", step: "0.5", value: "4", class: "lab-num", inputmode: "decimal" });
  const go = el("button", { type: "button", class: "ns-btn ns-go" }, "Open the cannery");
  const intro = el("div", { class: "ns-intro" }, [el("p", { text: "Pylon: Before we start. One head, 4,096 words, 16 numbers per head. How many times less warehouse traffic does the fused kernel need?" }),
    el("label", { for: "fa-guess", text: "My guess " }), guess, go, el("p", { class: "ns-note", text: "Your guess is never scored. It is shown beside the measurement, at the end." })]);
  const sel = (id, items, value) => { const n = el("select", { id, class: "lab-select" }, items.map(([v, t]) => option(String(v), t))); n.value = String(value); return n; };
  const kind = sel("fa-kind", [["unfused", "the plain way"], ["fused", "fused"], ["broken", "fused, rescale left out"]], "fused");
  const N = sel("fa-n", [[64, "64 words"], [256, "256 words"], [512, "512 words"]], 256);
  const d = sel("fa-d", [[16, "16 per head"], [64, "64 per head"]], 16);
  const count = el("button", { type: "button", class: "ns-btn" }, "Count and check"), time = el("button", { type: "button", class: "ns-btn ns-quiet" }, "Time on my chip"), done = el("button", { type: "button", class: "ns-btn ns-quiet" }, "I'm done");
  const controls = el("div", { class: "lab-controls", hidden: "" }, [el("div", { class: "lab-row" }, [kind, N, d]), el("div", { class: "lab-row" }, [count, time]), el("div", { class: "ns-acts" }, [done])]);
  const end = el("div", { class: "ns-end", hidden: "" });
  box.append(canvas, status, intro, controls, end);

  const be = await backend(canvas, A, { reduced, force2d, title: "Pylon's one-trip attention", images: GUIDES.pylon.textures() });
  const s = { kind: "fused", result: null, check: null, timing: null, running: false, done: 0, total: 0 };
  let frameNo = 0, job = 0;
  const draw = () => be.draw(frame(s, A, performance.now() / 1000), frameNo++);
  const name = () => kind.options[kind.selectedIndex].text;
  const say = () => { const r = s.result; status.textContent = r ? `${name()}, ${r.N} words, ${r.d} per head: ${r.globalBytes.toLocaleString("en")} bytes to and from the warehouse; check ${s.check.ok ? "passed" : `failed (${s.check.mismatches} of ${r.N * r.d} wrong)`}${s.timing ? `; ${s.timing}` : ""}.` : s.running ? `counting: ${s.done} of ${s.total} steps` : "Choose a kernel and sizes, and press Count and check."; };
  const run = () => {
    const id = ++job, n = +N.value, dd = +d.value, B = tileFor(dd), { q, k, v } = makeQKV(n, dd, 1); s.kind = kind.value; s.result = null; s.timing = null; s.running = true;
    const e = createEmulation({ kind: s.kind, N: n, d: dd, B, q, k, v });
    s.total = e.items;
    const slice = () => { if (id !== job) return; const t0 = performance.now(); while (!e.done && performance.now() - t0 < 40) s.done = e.step(2);
      if (e.done) { s.result = e.result(); s.check = checkAttention(s.result.o, reference(q, k, v, n, dd)); s.running = false; } say(); draw(); if (s.running) setTimeout(slice, 0); };
    s.done = 0; slice();
  };
  const timeIt = async () => {
    try {
      const { openDevice, runAttention } = await import("./fused-gpu.mjs");
      const dev = await openDevice();
      if (!dev.ok) { s.timing = `no timing: ${dev.why}`; say(); draw(); return; }
      const r = await runAttention(dev.device, { kind: kind.value === "broken" ? "fused" : kind.value, N: +N.value, d: +d.value, reps: F.lab.reps });
      s.timing = `on ${dev.adapter.description || dev.adapter.vendor || "your adapter"}: median ${r.medianMs.toFixed(3)} ms, check ${r.check.ok ? "passed" : "failed"}`;
    } catch (err) { console.warn("night school:", err); s.timing = `no timing: ${err.message}`; }
    say(); draw();
  };
  fitCanvas(canvas, be, draw); // the first state (nothing counted yet) is drawable as it is
  count.addEventListener("click", run);
  time.addEventListener("click", timeIt);
  go.addEventListener("click", () => { intro.hidden = true; controls.hidden = false; say(); draw(); });
  done.addEventListener("click", () => {
    job++; s.running = false;
    const Bd = F.film.bars;
    end.replaceChildren(el("h3", { text: "The cannery is quiet" }), el("ul", {}, [
      el("li", { text: `Your guess: ${guess.value} times. At 4,096 words and 16 per head, the plain way moves ${Bd.d16.unfused[6].bytes.toLocaleString("en")} bytes and fused ${Bd.d16.fused[6].bytes.toLocaleString("en")}: ${(Bd.d16.unfused[6].bytes / Bd.d16.fused[6].bytes).toFixed(2)} times less.` }),
      el("li", { text: `At 64 per head the bench holds fewer keys, and the saving is ${(Bd.d64.unfused[6].bytes / Bd.d64.fused[6].bytes).toFixed(2)} times.` })]),
      el("p", { class: "ns-close", text: "Pylon: Never build the wall." }));
    end.hidden = false;
  });
  say(); draw();
  return { backend: be.kind };
}
