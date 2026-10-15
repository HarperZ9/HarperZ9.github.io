// Pylon's race: three walkers (careful steps, the heavy ball, Adam) on a hill of your choice, each
// with the step you give it, started wherever you click; then the spiral network trained in your
// browser with the walker and step you pick. Mounted on a press. A guess first, never scored.
import { frame, hillView } from "./optimisers-lab-view.mjs";
import { run2d, RACE_BASE } from "./optimisers.mjs";
import { trainNet } from "./optimisers-train.mjs";
import { makeBowl, ROSENBROCK, TWO_VALLEYS } from "./gradients.mjs";
import { twoSpirals, createNet } from "./backprop.mjs";
import { el, backend, fitCanvas } from "../lessons/stage.mjs";
import { GUIDES } from "../../media/school/shared/lib.mjs";

const j = (p) => fetch(new URL(p, import.meta.url)).then((r) => r.json());
const option = (value, text) => el("option", { value, text });
const BOWL = makeBowl();
const HILLS = {
  valley: { ...ROSENBROCK, name: "the long narrow valley", range: [[-2, 2], [-1, 3]], cx: -0.1, cy: 1.05, U: 230, levels: [0.03, 0.1, 0.3, 1, 3, 10, 30, 100, 300, 1000], start: [-1.2, 1], steps: 20000, threshold: 1e-4 },
  bowl: { ...BOWL, name: "the tilted bowl", range: [[-3, 5], [-3, 4]], cx: 1, cy: 0.6, U: 130, levels: Array.from({ length: 14 }, (_, i) => 0.12 * (i + 1) ** 2), start: [-2, 2], steps: 2000, threshold: 1e-6 },
  two: { ...TWO_VALLEYS, name: "two valleys", range: [[-2, 2], [-2, 2]], cx: 0, cy: 0, U: 230, levels: [-0.15, -0.05, 0.1, 0.3, 0.6, 1, 1.6, 2.4, 3.5, 5, 7], start: [2, 0], steps: 3000, threshold: -1 },
};

export async function mount(box, { force2d = false } = {}) {
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const [sans, mono, F] = await Promise.all([j("../../media/explainers/motion/hanken-500.json"), j("../../media/explainers/motion/conso-400.json"), j("../../media/school/optimisers/facts.json")]);
  const A = { sans, mono, atlas: sans };
  box.replaceChildren();
  box.classList.add("ns", "lab");
  const canvas = el("canvas", { class: "ns-canvas", width: "1280", height: "720", role: "img", "aria-label": "A hill seen from above as contour lines, with three walkers' paths: careful steps in light ink, the heavy ball in pale blue, Adam in ember. In the network view, held-out accuracy curves for each training run." });
  const status = el("p", { class: "ns-status", "aria-live": "polite" });
  const guess = el("select", { id: "ol-guess", class: "lab-select" }, [option("sgd", "careful steps"), option("momentum", "the heavy ball"), option("adam", "Adam")]);
  const go = el("button", { type: "button", class: "ns-btn ns-go" }, "Line them up");
  const intro = el("div", { class: "ns-intro" }, [el("p", { text: "Pylon: Before the race. On the long narrow valley, which walker gets down to stay first, each at its best step?" }),
    el("label", { for: "ol-guess", text: "My guess " }), guess, go, el("p", { class: "ns-note", text: "Your guess is never scored. It is shown beside what the race does, at the end." })]);
  const tabRace = el("button", { type: "button", class: "ns-btn" }, "The race"), tabNet = el("button", { type: "button", class: "ns-btn ns-quiet" }, "A real network"), done = el("button", { type: "button", class: "ns-btn ns-quiet" }, "I'm done");
  const hill = el("select", { id: "ol-hill", class: "lab-select" }, Object.entries(HILLS).map(([k, h]) => option(k, h.name)));
  const lr = (id, v) => el("input", { type: "number", id, min: "0.00001", max: "3", step: "any", value: String(v), class: "lab-num", inputmode: "decimal" });
  const E = F.races.rosenbrock.entrants, lrs = { sgd: lr("ol-sgd", E.sgd.chosenLr), momentum: lr("ol-mom", E.momentum.chosenLr), adam: lr("ol-adam", E.adam.chosenLr) };
  const run = el("button", { type: "button", class: "ns-btn" }, "Race");
  const netOpt = el("select", { id: "ol-net", class: "lab-select" }, [option("sgd", "careful steps"), option("momentum", "the heavy ball"), option("adam", "Adam")]);
  const netLr = lr("ol-netlr", 0.3), train = el("button", { type: "button", class: "ns-btn" }, "Train the network");
  const rowRace = el("div", { class: "lab-row" }, [el("label", { for: "ol-hill", text: "Hill " }), hill, el("label", { for: "ol-sgd", text: " steps: careful " }), lrs.sgd, el("label", { for: "ol-mom", text: " heavy " }), lrs.momentum, el("label", { for: "ol-adam", text: " Adam " }), lrs.adam, run]);
  const rowNet = el("div", { class: "lab-row", hidden: "" }, [el("label", { for: "ol-net", text: "Walker " }), netOpt, el("label", { for: "ol-netlr", text: " step " }), netLr, train]);
  const controls = el("div", { class: "lab-controls", hidden: "" }, [el("div", { class: "ns-acts" }, [tabRace, tabNet, done]), rowRace, rowNet]);
  const end = el("div", { class: "ns-end", hidden: "" });
  box.append(canvas, status, intro, controls, end);

  const be = await backend(canvas, A, { reduced, force2d, title: "Pylon's race", images: GUIDES.pylon.textures() });
  const data = twoSpirals(400, 1), held = twoSpirals(400, 2);
  const s = { mode: "race", hill: HILLS.valley, start: HILLS.valley.start, runs: [], k: 0, nets: [] };
  let frameNo = 0, raf = 0;
  const draw = () => be.draw(frame(s, A, performance.now() / 1000), frameNo++);
  const NAME = { sgd: "careful steps", momentum: "the heavy ball", adam: "Adam" };
  const say = () => {
    if (s.mode === "race") status.textContent = `${s.hill.name} from (${s.start[0].toFixed(2)}, ${s.start[1].toFixed(2)}), update ${s.k}: ` + s.runs.map((r) => `${NAME[r.name]} ${r.diverged ? "flew off" : r.stepsToThreshold !== null ? `down at ${r.stepsToThreshold}` : `loss ${r.f.toPrecision(3)}`}`).join("; ") + ".";
    else { const n = s.nets.at(-1); status.textContent = n ? `${NAME[n.name]} at step ${n.lr}: held-out accuracy ${(n.curve.at(-1).heldAccuracy * 100).toFixed(1)}% after 4,000 updates${n.first ? `, past 95% at update ${n.first}` : ", never past 95%"}.` : "Pick a walker and a step and train."; }
  };
  const race = () => {
    const H = s.hill;
    s.runs = ["sgd", "momentum", "adam"].map((n) => run2d(H, s.start, n, { ...RACE_BASE[n], lr: Math.max(1e-6, +lrs[n].value || 1e-3) }, { steps: H.steps, threshold: H.threshold }));
    const max = Math.max(...s.runs.map((r) => (r.stepsToThreshold ?? r.path.length - 1))), t0 = performance.now(), dur = reduced ? 0 : 6000;
    cancelAnimationFrame(raf);
    const tick = () => { const u = dur ? Math.min(1, (performance.now() - t0) / dur) : 1; s.k = u >= 1 ? max : Math.max(0, Math.floor(10 ** (Math.log10(max + 1) * u)) - 1); say(); draw(); if (u < 1) raf = requestAnimationFrame(tick); };
    tick();
  };
  fitCanvas(canvas, be, draw);
  canvas.addEventListener("pointerdown", (e) => {
    if (s.mode !== "race") return;
    const r = canvas.getBoundingClientRect(), x = ((e.clientX - r.left) / r.width) * 1920, y = ((e.clientY - r.top) / r.height) * 1080, H = s.hill;
    const px = H.cx + (x - 960) / H.U, py = H.cy - (y - 540) / H.U;
    if (px < H.range[0][0] || px > H.range[0][1] || py < H.range[1][0] || py > H.range[1][1]) return;
    s.start = [px, py]; race();
  });
  hill.addEventListener("change", () => { s.hill = HILLS[hill.value]; s.start = s.hill.start; const ent = F.races[hill.value === "valley" ? "rosenbrock" : "bowl"]?.entrants; if (ent && hill.value !== "two") for (const n of ["sgd", "momentum", "adam"]) lrs[n].value = String(ent[n].chosenLr); race(); });
  run.addEventListener("click", race);
  train.addEventListener("click", () => {
    const name = netOpt.value, step = Math.max(1e-5, +netLr.value || 0.1), hp = { ...RACE_BASE[name], lr: step };
    const curve = trainNet(createNet(3), data, held, { optimiser: name, hp, steps: 4000, batch: 32, seed: 5, every: 100 });
    const hit = curve.find((p) => p.heldAccuracy >= 0.95);
    s.nets.push({ name, lr: step, curve, first: hit ? hit.step : null }); say(); draw();
  });
  netOpt.addEventListener("change", () => { netLr.value = String(F.spiral.arms[netOpt.value].chosenLr); });
  const tab = (m) => { s.mode = m; rowRace.hidden = m !== "race"; rowNet.hidden = m !== "net"; tabRace.className = `ns-btn${m === "race" ? "" : " ns-quiet"}`; tabNet.className = `ns-btn${m === "net" ? "" : " ns-quiet"}`; say(); draw(); };
  tabRace.addEventListener("click", () => tab("race")); tabNet.addEventListener("click", () => tab("net"));
  go.addEventListener("click", () => { intro.hidden = true; controls.hidden = false; race(); });
  done.addEventListener("click", () => {
    const w = ["sgd", "momentum", "adam"].reduce((b, n) => ((E[n].stepsToThreshold ?? 1e9) < (E[b].stepsToThreshold ?? 1e9) ? n : b), "sgd");
    end.replaceChildren(el("h3", { text: "The race is over" }), el("ul", {}, [
      el("li", { text: `Your guess: ${NAME[guess.value]}. At the steps the film chose, ${NAME[w]} got down to stay first, in ${E[w].stepsToThreshold.toLocaleString("en")} updates (careful steps ${E.sgd.stepsToThreshold.toLocaleString("en")}, Adam ${E.adam.stepsToThreshold.toLocaleString("en")}).` }),
      el("li", { text: `On the gentle bowl, careful steps won (${F.races.bowl.entrants.sgd.stepsToThreshold} updates). No walker is best on every hill.` })]),
      el("p", { class: "ns-close", text: "Pylon: Weight for the zigzags, shoes for uneven ground, and a careful step where the ground is kind." }));
    end.hidden = false;
  });
  say(); draw();
  return { backend: be.kind };
}
