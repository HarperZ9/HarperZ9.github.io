// Fill lesson F4's numbers ("Backpropagation: blame, passed backwards") so
// no number in the film is typed by hand. Writes media/school/backprop/facts.json.
//
//   node tools/school/fill_backprop.mjs
//
// The MLP and its data come from system/school/backprop.mjs. The link to the
// attention lab rebuilds the trained transformer from
// media/school/attention/model.json and checks its backward pass against
// finite differences on two held-out rows. A few seconds on one core.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { twoSpirals, createNet, train, accuracy, gradCheck, countOps, trace, forward, attentionGradCheck, SIZES } from "../../system/school/backprop.mjs";
import { fromJSON } from "../../system/school/tinyformer.mjs";
import { heldOut } from "../../system/school/corpus.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const MODEL = resolve(ROOT, "media/school/attention/model.json");
const OUT = resolve(ROOT, "media/school/backprop/facts.json");
const sig = (v, k = 5) => Number(v.toPrecision(k));
const sigs = (a, k) => a.map((v) => (Array.isArray(v) ? sigs(v, k) : typeof v === "number" ? sig(v, k) : v));
const t0 = Date.now();

const RUN = Object.freeze({ netSeed: 3, trainSeed: 1, heldSeed: 2, batchSeed: 5, points: 400, steps: 4000, lr: 0.3, batch: 32, every: 100, target: 0.95 });

const data = twoSpirals(RUN.points, RUN.trainSeed), held = twoSpirals(RUN.points, RUN.heldSeed);
const net = createNet(RUN.netSeed);
const probe = { x: held.X[7], y: held.Y[7] };
const traceBefore = trace(net, probe.x, probe.y);
const checkSet = { X: data.X.slice(0, 16), Y: data.Y.slice(0, 16) };
const checkBefore = gradCheck(net, checkSet.X, checkSet.Y), controlBefore = gradCheck(net, checkSet.X, checkSet.Y, { broken: true });
const ops = countOps(net);
const curve = train(net, data, held, { steps: RUN.steps, lr: RUN.lr, batch: RUN.batch, seed: RUN.batchSeed, every: RUN.every });
const final = curve[curve.length - 1];
if (final.heldAccuracy < RUN.target) throw new Error(`held-out accuracy ${final.heldAccuracy} under the stated target ${RUN.target}`);
const checkAfter = gradCheck(net, checkSet.X, checkSet.Y), controlAfter = gradCheck(net, checkSet.X, checkSet.Y, { broken: true });
const traceAfter = trace(net, probe.x, probe.y);
const reached = curve.find((p) => p.heldAccuracy >= RUN.target);

// Class-1 probability over the plane, for the decision boundary.
const B = 41, boundary = [];
for (let j = 0; j < B; j++) {
  const y = -1.2 + 2.4 * j / (B - 1), row = [];
  for (let i = 0; i < B; i++) row.push(sig(forward(net, [-1.2 + 2.4 * i / (B - 1), y], 0).p[1], 3));
  boundary.push(row);
}

const bytes = readFileSync(MODEL), sha256 = createHash("sha256").update(bytes).digest("hex");
const M = JSON.parse(bytes.toString("utf8"));
const model = fromJSON(M.weights), rows = heldOut(2, M.config.ctx);
const att = attentionGradCheck(model, rows), attCtl = attentionGradCheck(model, rows, { brokenSoftmax: true });
const row = (r) => ({ tensor: r.tensor, index: r.index, analytic: sig(r.analytic), numeric: sig(r.numeric), relErr: sig(r.relErr, 3) });
const failing = attCtl.float64.rows.filter((r) => r.relErr > 1e-2);

const tidyCheck = (c) => ({ perTensor: Object.fromEntries(Object.entries(c.perTensor).map(([k, v]) => [k, sig(v, 3)])), worstTensor: c.worstTensor, worst: sig(c.worst, 3), worstEntry: sig(c.worstEntry, 3) });
const tidyTrace = (t) => JSON.parse(JSON.stringify(t, (k, v) => (typeof v === "number" ? sig(v, 4) : v)));
const facts = {
  about: "Lesson F4, backpropagation. Computed by tools/school/fill_backprop.mjs from system/school/backprop.mjs and the attention lab's model.json. Do not edit by hand.",
  modelJsonSha256: sha256,
  net: { about: "Multilayer perceptron, tanh hidden layers, softmax output, weights N(0, 1/fan-in), biases zero.", sizes: SIZES, nParams: checkBefore.nParams, seed: RUN.netSeed },
  data: { about: "Two interleaved spirals, 1.5 turns, jitter 0.04, labels alternate. Training and held-out sets are separate seeded draws.", train: { seed: RUN.trainSeed, X: sigs(data.X, 3), Y: data.Y }, held: { seed: RUN.heldSeed, X: sigs(held.X, 3), Y: held.Y } },
  training: {
    about: "Plain minibatch gradient descent, fixed step, no momentum. Curve every 100 steps: mean loss and accuracy on the training and held-out points.",
    ...RUN, curve: curve.map((p) => ({ step: p.step, loss: sig(p.loss, 4), heldLoss: sig(p.heldLoss, 4), accuracy: sig(p.accuracy, 4), heldAccuracy: sig(p.heldAccuracy, 4) })),
    finalAccuracy: final.accuracy, finalHeldAccuracy: final.heldAccuracy, firstStepAtTarget: reached ? reached.step : null,
  },
  boundary: { about: "Probability of class 1 from the trained net on a 41 x 41 grid over [-1.2, 1.2]^2, rows are y.", n: B, range: [[-1.2, 1.2], [-1.2, 1.2]], values: boundary },
  chain: { about: "One held-out point (index 7) through the net, before and after training: every value, every local derivative (tanh' = 1 - a^2), and the gradient of the loss arriving at each node.", index: 7, before: tidyTrace(traceBefore), after: tidyTrace(traceAfter) },
  gradientCheck: {
    about: "Central differences (eps 1e-6) of the mean loss over 16 training points, for every one of the parameters, against the hand-written backward pass. Error per tensor is the L2 relative error |num - ana| / (|num| + |ana|). The control uses 1 - a instead of 1 - a^2 as the local derivative of the second hidden layer; it must fail there and upstream, and pass downstream (W3, b3).",
    beforeTraining: tidyCheck(checkBefore), afterTraining: tidyCheck(checkAfter), controlBefore: tidyCheck(controlBefore), controlAfter: tidyCheck(controlAfter),
  },
  cost: { about: "Multiply-adds for one point, counted by the loops as they run. Backward includes the weight gradients, the gradients passed back to each layer's input (not to x), and the elementwise local-derivative products. Transcendental calls (tanh, exp, log) are counted apart.", ...ops, ratio: sig(ops.ratio, 4) },
  attention: {
    about: "The attention lab's trained transformer (model.json): central differences of the mean loss on two held-out rows against tinyformer's manual backward pass, on chosen entries (per tensor, the two largest analytic gradients and two seeded random non-zero ones). float64 copies the float32 weights into a float64 model (eps 1e-5); float32 runs the model as trained (eps 1e-2). The control drops the softmax Jacobian term in the attention backward.",
    entries: att.entries, float64Worst: row(att.float64.worst), float32Worst: row(att.float32.worst), float64: att.float64.rows.map(row), float32: att.float32.rows.map(row),
    control: { worst: row(attCtl.float64.worst), failing: failing.length, failingTensors: [...new Set(failing.map((r) => r.tensor))] },
  },
  seconds: Math.round((Date.now() - t0) / 1000),
};
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(facts) + "\n");
console.log(JSON.stringify({
  nParams: facts.net.nParams, finalAccuracy: final.accuracy, finalHeldAccuracy: final.heldAccuracy, firstStepAtTarget: facts.training.firstStepAtTarget,
  curve: facts.training.curve.filter((p) => p.step % 1000 === 0), check: facts.gradientCheck, cost: facts.cost,
  attention: { entries: att.entries, f64: facts.attention.float64Worst, f32: facts.attention.float32Worst, control: facts.attention.control }, seconds: facts.seconds, sha256,
}, null, 1));
