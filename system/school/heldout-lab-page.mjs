// Pylon's practice and test: fit a curve of any flexibility (and any leash) to sixteen points and
// see its error on them and on five hundred held-out points; draw new training points; then train
// the spiral network on as few or as many points as you like and watch the two losses part.
// Mounted on a press. A guess first, never scored; a real end.
import { frame } from "./heldout-lab-view.mjs";
import { samples, fitAndScore, polyval, POLY, SPIRAL } from "./heldout.mjs";
import { trainNet } from "./optimisers-train.mjs";
import { twoSpirals, createNet } from "./backprop.mjs";
import { el, backend, fitCanvas } from "../lessons/stage.mjs";
import { GUIDES } from "../../media/school/shared/lib.mjs";

const j = (p) => fetch(new URL(p, import.meta.url)).then((r) => r.json());
const option = (value, text) => el("option", { value, text });

export async function mount(box, { force2d = false } = {}) {
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const [sans, mono, F] = await Promise.all([j("../../media/explainers/motion/hanken-500.json"), j("../../media/explainers/motion/conso-400.json"), j("../../media/school/heldout/facts.json")]);
  const A = { sans, mono, atlas: sans };
  box.replaceChildren();
  box.classList.add("ns", "lab");
  const canvas = el("canvas", { class: "ns-canvas", width: "1280", height: "720", role: "img", "aria-label": "Pylon's chart: sixteen training points in ink, five hundred held-out points in pale blue, and the fitted curve in rust. In the spiral view, the training and held-out loss over updates." });
  const status = el("p", { class: "ns-status", "aria-live": "polite" });
  const guess = el("input", { type: "number", id: "hl-guess", min: "0", max: String(POLY.maxDegree), step: "1", value: "8", class: "lab-num", inputmode: "numeric" });
  const go = el("button", { type: "button", class: "ns-btn ns-go" }, "Open the chart");
  const intro = el("div", { class: "ns-intro" }, [el("p", { text: `Pylon: Before you start. Curves from degree 0 (flat) to ${POLY.maxDegree} (wild). Which degree will do best on the points it never sees?` }),
    el("label", { for: "hl-guess", text: "My guess " }), guess, go, el("p", { class: "ns-note", text: "Your guess is never scored. It is shown beside what the points say, at the end." })]);
  const tabFit = el("button", { type: "button", class: "ns-btn" }, "Fit a curve"), tabSp = el("button", { type: "button", class: "ns-btn ns-quiet" }, "The spirals"), done = el("button", { type: "button", class: "ns-btn ns-quiet" }, "I'm done");
  const degree = el("input", { type: "range", id: "hl-degree", min: "0", max: String(POLY.maxDegree), step: "1", value: "3" });
  const lambda = el("select", { id: "hl-lambda", class: "lab-select" }, POLY.lambdas.map((l) => option(String(l), l === 0 ? "no leash" : `leash ${l}`)));
  const redraw = el("button", { type: "button", class: "ns-btn ns-quiet" }, "New training points");
  const nPts = el("select", { id: "hl-n", class: "lab-select" }, [10, 20, 40, 100, 400].map((n) => option(String(n), `${n} points`)));
  nPts.value = "40";
  const train = el("button", { type: "button", class: "ns-btn" }, "Train");
  const rowFit = el("div", { class: "lab-row" }, [el("label", { for: "hl-degree", text: "Degree " }), degree, el("label", { for: "hl-lambda", text: " " }), lambda, redraw]);
  const rowSp = el("div", { class: "lab-row", hidden: "" }, [el("label", { for: "hl-n", text: "Training on " }), nPts, train]);
  const controls = el("div", { class: "lab-controls", hidden: "" }, [el("div", { class: "ns-acts" }, [tabFit, tabSp, done]), rowFit, rowSp]);
  const end = el("div", { class: "ns-end", hidden: "" });
  box.append(canvas, status, intro, controls, end);

  const be = await backend(canvas, A, { reduced, force2d, title: "Pylon's practice and test", images: GUIDES.pylon.textures() });
  let seed = POLY.trainSeed, frameNo = 0;
  const held = samples(POLY.nHeld, POLY.heldSeed), sHeld = twoSpirals(SPIRAL.full, SPIRAL.heldSeed);
  const s = { mode: "fit", train: samples(POLY.nTrain, seed), held, fit: null, curve: [], n: 40, steps: 4000, spCurve: null };
  const refit = () => {
    s.fit = fitAndScore(s.train, held, +degree.value, +lambda.value);
    s.curve = Array.from({ length: 321 }, (_, i) => { const x = -1 + i / 160; return [x, polyval(s.fit.c, x)]; });
  };
  const say = () => {
    if (s.mode === "fit") status.textContent = `Degree ${s.fit.degree}${s.fit.lambda ? ` with leash ${s.fit.lambda}` : ""}: error ${s.fit.trainRmse.toExponential(2)} on its ${s.train.x.length} training points, ${s.fit.heldRmse.toPrecision(3)} on ${held.x.length} held-out points.`;
    else status.textContent = s.spCurve ? `${s.n} training points, ${s.steps} updates: training accuracy ${(s.spCurve.at(-1).accuracy * 100).toFixed(1)}%, held-out ${(s.spCurve.at(-1).heldAccuracy * 100).toFixed(1)}%.` : "Choose how many training points, then press Train.";
  };
  const draw = () => be.draw(frame({ ...s, curve: s.mode === "spiral" ? s.spCurve : s.curve }, A, performance.now() / 1000), frameNo++);
  const update = () => { if (s.mode === "fit") refit(); say(); draw(); };
  refit(); // before the first draw, which fitCanvas makes at once
  fitCanvas(canvas, be, draw);
  degree.addEventListener("input", update); lambda.addEventListener("change", update);
  redraw.addEventListener("click", () => { seed += 1; s.train = samples(POLY.nTrain, seed); update(); });
  train.addEventListener("click", () => {
    s.n = +nPts.value;
    s.spCurve = trainNet(createNet(SPIRAL.netSeed), twoSpirals(s.n, SPIRAL.trainSeed), sHeld, { optimiser: "sgd", hp: { lr: SPIRAL.lr }, steps: s.steps, batch: Math.min(32, s.n), seed: SPIRAL.batchSeed, every: 100 });
    say(); draw();
  });
  const tab = (m) => { s.mode = m; rowFit.hidden = m !== "fit"; rowSp.hidden = m !== "spiral"; tabFit.className = `ns-btn${m === "fit" ? "" : " ns-quiet"}`; tabSp.className = `ns-btn${m === "spiral" ? "" : " ns-quiet"}`; update(); };
  tabFit.addEventListener("click", () => tab("fit")); tabSp.addEventListener("click", () => tab("spiral"));
  go.addEventListener("click", () => { intro.hidden = true; controls.hidden = false; update(); });
  done.addEventListener("click", () => {
    end.replaceChildren(el("h3", { text: "Practice over" }), el("ul", {}, [
      el("li", { text: `Your guess: degree ${guess.value}. On the film's sixteen points the held-out error was lowest at degree ${F.poly.bestDegree} (${F.poly.degrees[F.poly.bestDegree].heldRmse.toFixed(2)}); over 200 different draws, degree 3 won ${F.poly.spread.bestDegreeCounts["3"]} times.` }),
      el("li", { text: `On the spirals, 40 training points gave ${(F.spiral.small.finalHeldAccuracy * 100).toFixed(1)}% on new points and 400 gave ${(F.spiral.full.finalHeldAccuracy * 100).toFixed(1)}%.` })]),
      el("p", { class: "ns-close", text: "Pylon: Keep points back, and check on those. Then don't peek." }));
    end.hidden = false;
  });
  say(); draw();
  return { backend: be.kind };
}
