// observables.js: the PERCEPTION channel (the measurimeter, physical not visual).
//
// Turns a trajectory into the named observable readings the solving model perceives: the
// state variables sampled over time, plus their ranges. The model sees ONLY this. It never
// sees the governing equations, the parameters, or the known invariant. Zero dependencies.

const round = (x) => (typeof x === "number" ? Math.round(x * 1e4) / 1e4 : x);
const pad = (x) => String(x).padStart(10);

export function perceive(system, states, { sample = 14 } = {}) {
  const vars = system.vars;
  const step = Math.max(1, Math.floor(states.length / sample));
  const samples = [];
  for (let i = 0; i < states.length; i += step) {
    const row = { t: i };
    for (const v of vars) row[v] = round(states[i][v]);
    samples.push(row);
  }
  const ranges = {};
  for (const v of vars) {
    let min = Infinity, max = -Infinity, sum = 0;
    for (const s of states) { const x = s[v]; if (x < min) min = x; if (x > max) max = x; sum += x; }
    ranges[v] = { min: round(min), max: round(max), mean: round(sum / states.length) };
  }
  return { variables: vars, count: states.length, samples, ranges };
}

// Render the perception as readable text for the model's prompt.
export function renderPerception(p) {
  const header = ["t", ...p.variables].map(pad).join("");
  const rows = p.samples
    .map((r) => [r.t, ...p.variables.map((v) => r[v])].map(pad).join(""))
    .join("\n");
  const ranges = p.variables
    .map((v) => `  ${v}: [${p.ranges[v].min}, ${p.ranges[v].max}], mean ${p.ranges[v].mean}`)
    .join("\n");
  return (
    `variables: ${p.variables.join(", ")}\n` +
    `${p.count} time steps total; a downsampled view:\n${header}\n${rows}\n\n` +
    `ranges over the full trajectory:\n${ranges}`
  );
}
