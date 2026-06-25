// run-discovery.mjs: the LIVE harness. Watch a cheap local LLM solve a system from perception alone,
// using tools, verified by the sound oracle. Two modes: CONSERVATION (a governed system -> a conserved
// quantity) and SPECTRUM (a quantum system's energy levels -> the quantization rule).
// Run: node system/discovery/run-discovery.mjs <target> [model]
//   targets: sho | pendulum | kepler | oscillator2d | qho | free | qho-spectrum | box-spectrum
import { SYSTEMS } from "./systems.js";
import { QSYSTEMS } from "./quantum-system.js";
import { makeTools } from "./tools.js";
import { renderPerception } from "./observables.js";
import { makeSpectrumTools, spectrumSystemPrompt, spectrumUserPrompt } from "./spectrum-discovery.js";
import { makeGrid } from "./quantum.js";
import { solveLoop } from "./llm.js";

const ALL = { ...SYSTEMS, ...QSYSTEMS };
const OPTS = {
  sho: { dt: 0.01, n: 1500, trials: 6, tol: 0.02 },
  pendulum: { dt: 0.01, n: 1500, trials: 6, tol: 0.02 },
  kepler: { dt: 0.004, n: 2000, trials: 6, tol: 0.05 },
  oscillator2d: { dt: 0.01, n: 1500, trials: 6, tol: 0.02 },
  qho: { dt: 0.01, n: 400, trials: 5, tol: 0.05 },
  free: { dt: 0.02, n: 200, trials: 5, tol: 0.05 },
};
const SPECTRA = {
  "qho-spectrum": () => makeSpectrumTools(makeGrid(128, 16), (x) => 0.5 * x * x, "qho-spectrum", { K: 7, nTrain: 5, tol: 0.03 }),
  "box-spectrum": () => makeSpectrumTools(makeGrid(128, 16), (x) => (Math.abs(x) < 4 ? 0 : 5000), "box-spectrum", { K: 7, nTrain: 4, tol: 0.05 }),
};

const name = process.argv[2] || "sho";
const model = process.argv[3] || "qwen2.5:3b";

let tools, render, loopOpts;
if (SPECTRA[name]) {
  tools = SPECTRA[name]();
  render = () => spectrumUserPrompt(tools.perception);
  loopOpts = { model, systemPrompt: spectrumSystemPrompt, userPrompt: spectrumUserPrompt, log: (m) => console.log("  " + m) };
} else if (ALL[name]) {
  tools = makeTools(ALL[name], OPTS[name]);
  render = () => renderPerception(tools.perception);
  loopOpts = { model, log: (m) => console.log("  " + m) };
} else {
  console.error(`unknown target '${name}' (use ${Object.keys(ALL).concat(Object.keys(SPECTRA)).join(" | ")})`);
  process.exit(1);
}

console.log(`\n=== Telos discovery: watching ${model} solve '${name}' ===`);
console.log(`(the model sees ONLY the data below; never the equations, parameters, or the answer)\n`);
console.log(render());
console.log("\n--- the model works ---");

const result = await solveLoop(tools, loopOpts);

console.log("\n--- result ---");
if (result.error) {
  console.log("could not run the live model:", result.error);
  console.log("(start Ollama and `ollama pull " + model + "` to watch it; the substrate + verifier are proven by the node tests regardless.)");
  process.exit(0);
}
console.log("solved:", result.solved);
console.log("submitted law:", result.submittedExpr || "(none)");
if (result.certificate) {
  const c = result.certificate;
  console.log("certificate:", JSON.stringify({ verdict: c.verdict, certified: c.certified, criterion: c.criterion, claim: c.claim }, null, 2));
}
