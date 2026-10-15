// Pylon's bucket chain: train the small network on the two spirals in your browser, click any point
// to see its chain (the value in every bucket and the blame arriving at it), and check the walk back
// against nudging, with one link broken on purpose as a control. Mounted on a press, never on load.
// A guess first, never scored; a real end.
import { frame, MAP } from "./backprop-lab-view.mjs";
import { twoSpirals, createNet, train, trace, forward, accuracy, lossOnly, gradCheck } from "./backprop.mjs";
import { el, backend, fitCanvas } from "../lessons/stage.mjs";
import { GUIDES } from "../../media/school/shared/lib.mjs";

const j = (p) => fetch(new URL(p, import.meta.url)).then((r) => r.json());
const N = 41, STEPS = 4000, CHUNK = 100;

export async function mount(box, { force2d = false } = {}) {
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const [sans, mono, F] = await Promise.all([j("../../media/explainers/motion/hanken-500.json"), j("../../media/explainers/motion/conso-400.json"), j("../../media/school/backprop/facts.json")]);
  const A = { sans, mono, atlas: sans };
  box.replaceChildren();
  box.classList.add("ns", "lab");
  const canvas = el("canvas", { class: "ns-canvas", width: "1280", height: "720", role: "img", "aria-label": "Left: the two spirals and the network's answer over the map. Right: the chain of buckets for the chosen point, water for each value and rings for the blame arriving at each bucket." });
  const status = el("p", { class: "ns-status", "aria-live": "polite" });
  const guess = el("input", { type: "number", id: "bl-guess", min: "0", max: String(STEPS), step: "100", value: "1000", class: "lab-num", inputmode: "numeric" });
  const go = el("button", { type: "button", class: "ns-btn ns-go" }, "Fill the buckets");
  const intro = el("div", { class: "ns-intro" }, [el("p", { text: `Pylon: Before we start. The network begins knowing nothing. After how many of the ${STEPS.toLocaleString("en")} steps will it get 95% of points it never trained on right?` }),
    el("label", { for: "bl-guess", text: "My guess, in steps " }), guess, go, el("p", { class: "ns-note", text: "Your guess is never scored. It is shown beside what happened, at the end." })]);
  const play = el("button", { type: "button", class: "ns-btn" }, "Train"), check = el("button", { type: "button", class: "ns-btn ns-quiet" }, "Check the walk back"), breakIt = el("input", { type: "checkbox", id: "bl-break" });
  const again = el("button", { type: "button", class: "ns-btn ns-quiet" }, "New network"), done = el("button", { type: "button", class: "ns-btn ns-quiet" }, "I'm done");
  const controls = el("div", { class: "lab-controls", hidden: "" }, [el("div", { class: "ns-acts" }, [play, check, again, done]),
    el("div", { class: "lab-row" }, [breakIt, el("label", { for: "bl-break", text: " break one link (the second layer's local slope) as a control" })])]);
  const end = el("div", { class: "ns-end", hidden: "" });
  box.append(canvas, status, intro, controls, end);

  const be = await backend(canvas, A, { reduced, force2d, title: "Pylon's bucket chain", images: GUIDES.pylon.textures() });
  const data = twoSpirals(F.data.train.X.length, F.data.train.seed), held = twoSpirals(F.data.held.X.length, F.data.held.seed);
  let net, seed = F.net.seed, playing = false, crossed = null, frameNo = 0;
  const s = { grid: [], held, point: held.X[7], pointY: held.Y[7], trace: null, step: 0, acc: 0, loss: 0, check: null, broken: false };
  const boundary = () => { const g = []; for (let jj = 0; jj < N; jj++) { const row = []; for (let i = 0; i < N; i++) row.push(forward(net, [-1.2 + (2.4 * i) / (N - 1), -1.2 + (2.4 * jj) / (N - 1)], 0).p[1]); g.push(row); } return g; };
  const refresh = () => { s.grid = boundary(); s.trace = trace(net, s.point, s.pointY); s.acc = accuracy(net, held.X, held.Y); s.loss = lossOnly(net, held.X, held.Y); if (crossed === null && s.acc >= 0.95) crossed = s.step; };
  const say = () => { status.textContent = `Step ${s.step} of ${STEPS}. Held-out accuracy ${(s.acc * 100).toFixed(1)}% on ${held.X.length} points it never trained on; held-out loss ${s.loss.toFixed(3)}.${s.check ? ` Check: worst layer ${s.check.worstTensor} at ${s.check.worst.toExponential(1)}${s.broken ? " (one link broken)" : ""}.` : ""}`; };
  const draw = () => be.draw(frame(s, A, performance.now() / 1000), frameNo++);
  const update = () => { say(); draw(); };
  const fresh = () => { net = createNet(seed); s.step = 0; s.check = null; crossed = null; refresh(); update(); };
  const loop = () => { if (!playing) return; train(net, data, held, { steps: CHUNK, seed: 5 + s.step, every: CHUNK }); s.step += CHUNK; refresh(); update(); if (s.step >= STEPS) { setPlaying(false); return; } setTimeout(loop, 0); };
  const setPlaying = (v) => { playing = v; play.textContent = v ? "Pause" : s.step >= STEPS ? "Trained" : "Train"; if (v) loop(); };
  net = createNet(seed); refresh(); // before the first draw, which fitCanvas makes at once
  fitCanvas(canvas, be, draw);
  canvas.addEventListener("pointerdown", (e) => {
    const r = canvas.getBoundingClientRect(), x = ((e.clientX - r.left) / r.width) * 1920, y = ((e.clientY - r.top) / r.height) * 1080;
    if (x < MAP.x || x > MAP.x + MAP.size || y < MAP.y || y > MAP.y + MAP.size) return;
    const u = -1.2 + ((x - MAP.x) / MAP.size) * 2.4, v = 1.2 - ((y - MAP.y) / MAP.size) * 2.4;
    let best = 0, bd = Infinity; held.X.forEach(([a, b], k) => { const d = (a - u) ** 2 + (b - v) ** 2; if (d < bd) { bd = d; best = k; } });
    s.point = held.X[best]; s.pointY = held.Y[best]; s.trace = trace(net, s.point, s.pointY); update();
  });
  play.addEventListener("click", () => setPlaying(!playing));
  check.addEventListener("click", () => { s.broken = breakIt.checked; s.check = gradCheck(net, data.X.slice(0, 16), data.Y.slice(0, 16), { broken: s.broken }); update(); });
  breakIt.addEventListener("change", () => { s.broken = breakIt.checked; s.check = gradCheck(net, data.X.slice(0, 16), data.Y.slice(0, 16), { broken: s.broken }); update(); });
  again.addEventListener("click", () => { setPlaying(false); seed = seed * 7 + 13; fresh(); });
  go.addEventListener("click", () => { intro.hidden = true; controls.hidden = false; setPlaying(true); });
  done.addEventListener("click", () => {
    setPlaying(false);
    end.replaceChildren(el("h3", { text: "The buckets are still" }), el("ul", {}, [
      el("li", { text: `Your guess: step ${guess.value}. This run was first past 95% on new points at ${crossed === null ? "no step yet" : `step ${crossed}`} (measured every ${CHUNK} steps).` }),
      el("li", { text: `The film's run was past 95% by step ${F.training.firstStepAtTarget.toLocaleString("en")} and reached ${(F.training.finalHeldAccuracy * 100).toFixed(1)}% after ${F.training.steps.toLocaleString("en")} steps.` })]),
      el("p", { class: "ns-close", text: "Pylon: Forward once, blame back once, and every number knows its slope. Next, better ways to step." }));
    end.hidden = false;
  });
  fresh();
  return { backend: be.kind };
}
