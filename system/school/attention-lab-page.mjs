// The lamp room lab on a page: train the tiny transformer and watch its heads learn where to look.
// Mounted on a press, never on load. Training runs in a worker (or on the page where module
// workers are missing); drawing uses raw-native's WebGPU renderer, or its Canvas 2D drawer.
// One run of 1,500 steps, a real end, no score. Every number shown comes from the run.
import { frame } from "./attention-lab-view.mjs";
import { LAB, MODES, createRun, snapshot } from "./lab-run.mjs";
import { PROBES } from "./corpus.mjs";
import { el, backend, fitCanvas } from "../lessons/stage.mjs";

const fonts = async () => {
  const j = (p) => fetch(new URL(p, import.meta.url)).then((r) => r.json());
  const [sans, mono, facts] = await Promise.all([j("../../media/explainers/motion/hanken-500.json"), j("../../media/explainers/motion/conso-400.json"), j("../../media/school/attention/facts.json")]);
  return { sans, mono, atlas: sans, facts };
};

// The trainer: a module worker if the browser has one, else the same run on the page.
function trainer(onSnap, onError) {
  try {
    const w = new Worker(new URL("./lab-worker.mjs", import.meta.url), { type: "module" });
    w.onmessage = (e) => (e.data.type === "snapshot" ? onSnap(e.data.data) : onError(e.data.message));
    w.onerror = (e) => onError(e.message || "worker failed");
    return { where: "worker", send: (m) => w.postMessage(m), stop: () => w.terminate() };
  } catch (e) {
    console.warn("lab: no module worker, training on the page:", e);
    let run = null, playing = false;
    const loop = () => { if (!playing || !run) return; run.advance(12); onSnap(snapshot(run)); if (run.done) playing = false; else setTimeout(loop, 0); };
    return { where: "page", stop: () => { playing = false; }, send(m) {
      if (m.cmd === "start") { run = createRun(m); playing = false; onSnap(snapshot(run)); }
      else if (m.cmd === "play") { playing = true; loop(); } else if (m.cmd === "pause") playing = false;
      else if (m.cmd === "step" && run) { run.advance(Infinity, m.n); onSnap(snapshot(run)); } else if (m.cmd === "probe" && run) { run.probe = m.probe; onSnap(snapshot(run)); }
    } };
  }
}

const option = (value, text) => el("option", { value, text });
const f2 = (x) => x.toFixed(2), p0 = (x) => `${Math.round(x * 100)}%`;

export async function mount(box, { force2d = false } = {}) {
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches, A = await fonts();
  box.replaceChildren();
  box.classList.add("ns", "lab");
  const canvas = el("canvas", { class: "ns-canvas", width: "1280", height: "720", role: "img", "aria-label": "Tallow's lamp room. The test sentence is pinned along the glass; the lamp's light on each word is the attention the chosen head gives it. On the right, a grid for every head, and the training curves." });
  const status = el("p", { class: "ns-status", "aria-live": "polite" }), event = el("p", { class: "ns-event" });
  const guess = el("input", { type: "number", min: "0", max: String(LAB.steps), step: "50", value: "500", id: "lab-guess", inputmode: "numeric" });
  const go = el("button", { type: "button", class: "ns-btn ns-go" }, "Start training");
  const intro = el("div", { class: "ns-intro" }, [el("p", { text: `Tallow: Before we start. The model begins knowing nothing. After how many of the ${LAB.steps.toLocaleString("en")} training steps do you think it will fill half of the copy holes correctly?` }),
    el("label", { for: "lab-guess", text: "My guess, in steps " }), guess, go,
    el("p", { class: "ns-note", text: "Your guess is never scored. It is shown beside what happened, at the end." })]);
  const play = el("button", { type: "button", class: "ns-btn" }, "Pause"), step10 = el("button", { type: "button", class: "ns-btn ns-quiet" }, "10 steps");
  const mode = el("select", { id: "lab-mode", class: "lab-select" }, Object.entries(MODES).map(([k, v]) => option(k, v)));
  const probe = el("select", { id: "lab-probe", class: "lab-select" }, PROBES.map((p, i) => option(String(i), p.words.join(" "))));
  const head = el("select", { id: "lab-head", class: "lab-select" }, [0, 1].flatMap((l) => [0, 1].map((h) => option(`${l}.${h}`, `layer ${l + 1}, head ${h + 1}`))));
  head.value = "1.1";
  const again = el("button", { type: "button", class: "ns-btn ns-quiet" }, "New run");
  const controls = el("div", { class: "lab-controls", hidden: "" }, [el("div", { class: "ns-acts" }, [play, step10, again]),
    el("div", { class: "lab-row" }, [el("label", { for: "lab-mode", text: "Lamp " }), mode, el("label", { for: "lab-head", text: "Show " }), head]),
    el("div", { class: "lab-row" }, [el("label", { for: "lab-probe", text: "Test sentence " }), probe])]);
  const end = el("div", { class: "ns-end", hidden: "" });
  box.append(canvas, status, event, intro, controls, end);

  const be = await backend(canvas, A, { reduced, force2d, title: "Lamp room lab" });
  let snap = null, playing = false, seed = (Date.now() % 9973) + 1, crossed = null, raf = 0, frameNo = 0;
  const sel = () => { const [l, h] = head.value.split(".").map(Number); return { layer: l, head: h }; };
  const draw = async () => { if (snap) await be.draw(frame(snap, sel(), A, performance.now() / 1000, { reduced, total: LAB.steps }), frameNo++); };
  const loop = async () => { await draw(); if (playing) raf = requestAnimationFrame(loop); };
  fitCanvas(canvas, be, () => { if (!playing) draw(); });

  const say = () => {
    if (!snap) return;
    const c = snap.last, top = snap.look.top5[0];
    status.textContent = `Step ${snap.step} of ${LAB.steps}. Held-out loss ${f2(c.heldOut)} (a model that knows only word frequencies: ${f2(snap.unigram)}). Copy holes filled: ${p0(c.copy)}. Other words: ${p0(c.local)}. ${snap.msPerStep.toFixed(1)} ms a step, about ${(snap.flops.step / 1e6).toFixed(0)} million multiply-adds, on this device's CPU (${t.where}).`;
    event.textContent = `On "${snap.look.probe.words.join(" ")} ___", the model's best guess is "${top.word}" at ${p0(top.p)}.`;
    if (crossed === null && c.copy >= 0.5) crossed = c.step;
  };
  const t = trainer((s) => { snap = s; say(); if (!playing) draw(); if (s.done && playing) finish(); }, (m) => { event.textContent = `The training stopped: ${m}`; playing = false; });
  const start = () => { crossed = null; t.send({ cmd: "start", seed, mode: mode.value, probe: +probe.value }); };
  const setPlaying = (v) => { playing = v; play.textContent = v ? "Pause" : "Train"; t.send({ cmd: v ? "play" : "pause" }); if (v) loop(); };
  start();
  go.addEventListener("click", () => { intro.hidden = true; controls.hidden = false; setPlaying(true); });
  play.addEventListener("click", () => setPlaying(!playing));
  step10.addEventListener("click", () => { setPlaying(false); t.send({ cmd: "step", n: 10 }); });
  probe.addEventListener("change", () => t.send({ cmd: "probe", probe: +probe.value }));
  head.addEventListener("change", () => draw());
  mode.addEventListener("change", () => { setPlaying(false); start(); event.textContent = `A fresh model with the lamp set to: ${MODES[mode.value]}. Press Train.`; });
  again.addEventListener("click", () => { setPlaying(false); seed = seed * 7 + 13; end.hidden = true; start(); event.textContent = "A fresh model with new random starting numbers. Press Train."; });

  function finish() {
    setPlaying(false); draw();
    const c = snap.last;
    end.replaceChildren(el("h3", { text: "The run is over" }), el("ul", {}, [
      el("li", { text: `Your guess: step ${guess.value}. Half the copy holes were first filled at ${crossed === null ? "no step in this run" : `step ${crossed}`} (measured every ${LAB.evalEvery} steps).` }),
      el("li", { text: `After ${snap.step} steps: held-out loss ${f2(c.heldOut)}, copy holes ${p0(c.copy)}, with the lamp set to "${MODES[snap.mode]}".` }),
      el("li", { text: `Try the same run with the lamp set to each word sees only itself, then to even light. The film's runs of ${A.facts.steps.toLocaleString("en")} steps reached ${p0(A.facts.copyOn)}, ${p0(A.facts.copyOff)} and ${p0(A.facts.copyUniform)}.` })]),
      el("p", { class: "ns-close", text: "Tallow: That is the whole trick. A word learns where to look, and then it can use what it finds." }));
    end.hidden = false;
  }
  return { backend: be.kind, trainer: t.where };
}
