// Pylon in the fog: pick a hill, click the map to place your start, choose a step and walk down by
// gradient descent; then turn the dial on the attention model's last matrix and step it with the
// model's own backward pass. Mounted on a press, never on load. A guess first, never scored.
import { frame, hillView } from "./gradients-lab-view.mjs";
import { makeBowl, ROSENBROCK, TWO_VALLEYS } from "./gradients.mjs";
import { readoutScale } from "./gradients-landscape.mjs";
import { fromJSON } from "./tinyformer.mjs";
import { heldOut } from "./corpus.mjs";
import { el, backend, fitCanvas } from "../lessons/stage.mjs";
import { GUIDES } from "../../media/school/shared/lib.mjs";

const j = (p) => fetch(new URL(p, import.meta.url)).then((r) => r.json());
const option = (value, text) => el("option", { value, text });
const sqrtH = (z) => 2.1 * Math.sqrt(Math.max(0, z)), logH = (z) => 2.3 * Math.log10(1 + Math.max(0, z));
const BOWL = makeBowl();
const HILLS = {
  bowl: { ...BOWL, name: "the tilted bowl", range: [[-2.6, 4.6], [-2.8, 3.8]], h: sqrtH, levels: Array.from({ length: 14 }, (_, i) => 0.12 * (i + 1) ** 2), step: 0.25 },
  valley: { ...ROSENBROCK, name: "the long narrow valley", range: [[-2, 2], [-1, 3]], h: logH, levels: [0.1, 0.5, 1, 2, 5, 10, 25, 50, 100, 200, 400, 800], step: 0.001 },
  two: { ...TWO_VALLEYS, name: "two valleys", range: [[-2, 2], [-2, 2]], h: (z) => 1.6 * (z + 0.3), levels: [-0.15, -0.05, 0.1, 0.3, 0.6, 1, 1.6, 2.4, 3.5, 5, 7], step: 0.02 },
};

export async function mount(box, { force2d = false } = {}) {
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const [sans, mono, M, F] = await Promise.all([j("../../media/explainers/motion/hanken-500.json"), j("../../media/explainers/motion/conso-400.json"), j("../../media/school/attention/model.json"), j("../../media/school/gradients/facts.json")]);
  const A = { sans, mono, atlas: sans }, model = fromJSON(M.weights), held = heldOut(64, M.config.ctx);
  box.replaceChildren();
  box.classList.add("ns", "lab");
  const canvas = el("canvas", { class: "ns-canvas", width: "1280", height: "720", role: "img", "aria-label": "A hill in fog, drawn as a contour map from above or as a relief; your path down it in ember. In the dial view, the attention model's loss as its last matrix is scaled, with your steps on it." });
  const status = el("p", { class: "ns-status", "aria-live": "polite" });
  const guess = el("input", { type: "number", id: "gl-guess", min: "0.01", max: "2", step: "0.05", value: "0.4", class: "lab-num", inputmode: "decimal" });
  const go = el("button", { type: "button", class: "ns-btn ns-go" }, "Into the fog");
  const intro = el("div", { class: "ns-intro" }, [el("p", { text: "Pylon: Before we start. On the tilted bowl, what is the biggest step that still gets me to the bottom, starting from (-2, 2)?" }),
    el("label", { for: "gl-guess", text: "My guess " }), guess, go, el("p", { class: "ns-note", text: "Your guess is never scored. It is shown beside what the bowl does, at the end." })]);
  const tabHill = el("button", { type: "button", class: "ns-btn" }, "The hill"), tabDial = el("button", { type: "button", class: "ns-btn ns-quiet" }, "The model's dial"), done = el("button", { type: "button", class: "ns-btn ns-quiet" }, "I'm done");
  const hillSel = el("select", { id: "gl-hill", class: "lab-select" }, Object.entries(HILLS).map(([k, h]) => option(k, h.name)));
  const step = el("input", { type: "number", id: "gl-step", min: "0.0001", max: "2", step: "0.05", value: "0.25", class: "lab-num", inputmode: "decimal" });
  const one = el("button", { type: "button", class: "ns-btn" }, "Step"), fifty = el("button", { type: "button", class: "ns-btn ns-quiet" }, "50 steps"), reset = el("button", { type: "button", class: "ns-btn ns-quiet" }, "Back to the start");
  const tilt = el("input", { type: "checkbox", id: "gl-tilt" });
  const dstep = el("input", { type: "number", id: "gl-dstep", min: "0.001", max: "1", step: "0.01", value: "0.05", class: "lab-num", inputmode: "decimal" });
  const dOne = el("button", { type: "button", class: "ns-btn" }, "Step the dial"), dTen = el("button", { type: "button", class: "ns-btn ns-quiet" }, "10 steps"), dReset = el("button", { type: "button", class: "ns-btn ns-quiet" }, "Dial back to 0.05");
  const rowHill = el("div", { class: "lab-row" }, [el("label", { for: "gl-hill", text: "Hill " }), hillSel, el("label", { for: "gl-step", text: " step " }), step, one, fifty, reset, tilt, el("label", { for: "gl-tilt", text: " relief" })]);
  const rowDial = el("div", { class: "lab-row", hidden: "" }, [el("label", { for: "gl-dstep", text: "Dial step " }), dstep, dOne, dTen, dReset]);
  const controls = el("div", { class: "lab-controls", hidden: "" }, [el("div", { class: "ns-acts" }, [tabHill, tabDial, done]), rowHill, rowDial]);
  const end = el("div", { class: "ns-end", hidden: "" });
  box.append(canvas, status, intro, controls, end);

  const be = await backend(canvas, A, { reduced, force2d, title: "Pylon in the fog", images: GUIDES.pylon.textures() });
  // The dial's curve is drawn from facts.json (computed by the same function); the reader's steps are computed live.
  const s = { mode: "hill", surface: HILLS.bowl, step: 0.25, tilt: 0, path: [[-2, 2]], curve: F.oneNumber.curve, dpath: [], dstep: 0.05 };
  let frameNo = 0;
  const draw = () => be.draw(frame(s, A, performance.now() / 1000), frameNo++);
  const say = () => {
    if (s.mode === "hill") { const p = s.path[s.path.length - 1], g = s.surface.grad(...p); status.textContent = `${s.surface.name}: ${s.path.length - 1} steps of ${s.step}. At (${p[0].toFixed(3)}, ${p[1].toFixed(3)}) the loss is ${s.surface.f(...p).toPrecision(4)} and the gradient is (${g[0].toFixed(3)}, ${g[1].toFixed(3)}).`; }
    else { const d = s.dpath[s.dpath.length - 1]; status.textContent = d ? `Dial at ${d[0].toFixed(3)}: held-out loss ${d[1].toFixed(4)}, slope ${d[2].toFixed(4)} (from the model's backward pass).` : "The dial starts at 0.05. Press Step the dial."; }
  };
  const update = () => { say(); draw(); };
  const walk = (n) => { for (let k = 0; k < n; k++) { const p = s.path[s.path.length - 1], g = s.surface.grad(...p), q = [p[0] - s.step * g[0], p[1] - s.step * g[1]]; if (!q.every(Number.isFinite) || Math.abs(s.surface.f(...q)) > 1e12) break; s.path.push(q); } update(); };
  const dial = (n) => { if (!s.dpath.length) { const r = readoutScale(model, held, 0.05); s.dpath.push([r.s, r.loss, r.dLds]); n -= 1; } for (let k = 0; k < n; k++) { const [v, , g] = s.dpath[s.dpath.length - 1], r = readoutScale(model, held, v - s.dstep * g); s.dpath.push([r.s, r.loss, r.dLds]); } update(); };
  fitCanvas(canvas, be, draw);
  canvas.addEventListener("pointerdown", (e) => {
    if (s.mode !== "hill" || s.tilt) return;
    const r = canvas.getBoundingClientRect(), x = ((e.clientX - r.left) / r.width) * 1920, y = ((e.clientY - r.top) / r.height) * 1080, V = hillView(s);
    const [[x0, x1], [y0, y1]] = s.surface.range, U = 760 / (x1 - x0), px = (x0 + x1) / 2 + (x - 960) / U, py = (y0 + y1) / 2 - (y - 540) / U;
    if (px < x0 || px > x1 || py < y0 || py > y1 || !V) return;
    s.path = [[px, py]]; update();
  });
  hillSel.addEventListener("change", () => { s.surface = HILLS[hillSel.value]; s.step = s.surface.step; step.value = String(s.step); s.path = [[s.surface === HILLS.valley ? -1.2 : s.surface === HILLS.two ? 0.3 : -2, s.surface === HILLS.valley ? 1 : s.surface === HILLS.two ? 0 : 2]]; update(); });
  step.addEventListener("input", () => { s.step = Math.max(1e-5, +step.value || 0.01); update(); });
  one.addEventListener("click", () => walk(1)); fifty.addEventListener("click", () => walk(50)); reset.addEventListener("click", () => { s.path = [s.path[0]]; update(); });
  tilt.addEventListener("change", () => { s.tilt = tilt.checked ? 1 : 0; update(); });
  dstep.addEventListener("input", () => { s.dstep = Math.max(1e-4, +dstep.value || 0.01); update(); });
  dOne.addEventListener("click", () => dial(1)); dTen.addEventListener("click", () => dial(10)); dReset.addEventListener("click", () => { s.dpath = []; update(); });
  const tab = (m) => { s.mode = m; rowHill.hidden = m !== "hill"; rowDial.hidden = m !== "dial"; tabHill.className = `ns-btn${m === "hill" ? "" : " ns-quiet"}`; tabDial.className = `ns-btn${m === "dial" ? "" : " ns-quiet"}`; update(); };
  tabHill.addEventListener("click", () => tab("hill")); tabDial.addEventListener("click", () => tab("dial"));
  go.addEventListener("click", () => { intro.hidden = true; controls.hidden = false; update(); });
  done.addEventListener("click", () => {
    const b = F.bowl;
    end.replaceChildren(el("h3", { text: "Out of the fog" }), el("ul", {}, [
      el("li", { text: `Your guess for the biggest safe step on the bowl: ${guess.value}. The edge is 2 divided by the steep way's curvature, ${b.curvatures[0]}: ${b.predictedBound}. Below it the walk gets down; above it, every step overshoots further.` }),
      el("li", { text: `The model's dial is lowest at ${F.oneNumber.sStar.toFixed(2)}, not at 1: training stopped near the bottom of this slice, not on it.` })]),
      el("p", { class: "ns-close", text: "Pylon: Feel the slope, step the other way, not too far. Next, how a model gets all its slopes at once." }));
    end.hidden = false;
  });
  update();
  return { backend: be.kind };
}
