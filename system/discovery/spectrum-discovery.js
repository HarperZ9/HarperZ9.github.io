// spectrum-discovery.js: discover the QUANTIZATION RULE of a quantum system, the same way the
// engine discovers conservation laws. The model sees the measured energy levels E_0, E_1, ... and
// proposes which terms in n the rule E_n = f(n) is built from. A least-squares regression fits the
// coefficients on the LOW levels; the verifier certifies the rule only if it PREDICTS the HELD-OUT
// higher levels (the soundness teeth: an overfit rule fails to predict). Reuses expr.js + the
// witnessed certificate; tools have the same shape as the conservation tools so the same LLM loop
// drives both. Zero dependencies.
import { makeFn } from "./expr.js";
import { spectrum } from "./quantum.js";
import { buildCertificate } from "../../shared-frame/certificate.js";

const round = (x) => (Number.isFinite(x) ? Math.round(x * 1e5) / 1e5 : x);

// Solve A x = b for a small system (Gaussian elimination, partial pivoting).
function solveLinear(A, b) {
  const n = A.length, M = A.map((row, i) => [...row, b[i]]);
  for (let col = 0; col < n; col++) {
    let piv = col;
    for (let r = col + 1; r < n; r++) if (Math.abs(M[r][col]) > Math.abs(M[piv][col])) piv = r;
    [M[col], M[piv]] = [M[piv], M[col]];
    const d = M[col][col] || 1e-12;
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const f = M[r][col] / d;
      for (let c = col; c <= n; c++) M[r][c] -= f * M[col][c];
    }
  }
  return M.map((row, i) => row[n] / (M[i][i] || 1e-12));
}

// Fit E ~ sum c_k phi_k(n) on the first nTrain levels, then measure the relative error PREDICTING
// the held-out levels. Returns { expr, coeffs, heldRelErr }.
export function regressLevels(terms, levels, nTrain) {
  const fns = terms.map((t) => makeFn(t, ["n"]));
  const K = terms.length, A = Array.from({ length: K }, () => new Array(K).fill(0)), rhs = new Array(K).fill(0);
  for (let n = 0; n < nTrain; n++) {
    const phi = fns.map((f) => f({ n }));
    for (let a = 0; a < K; a++) { rhs[a] += phi[a] * levels[n]; for (let b = 0; b < K; b++) A[a][b] += phi[a] * phi[b]; }
  }
  const c = solveLinear(A, rhs);
  let se = 0, count = 0;
  for (let n = nTrain; n < levels.length; n++) { const pred = fns.reduce((s, f, k) => s + c[k] * f({ n }), 0); se += (pred - levels[n]) ** 2; count++; }
  const range = Math.abs(levels[levels.length - 1] - levels[0]) + 1e-12;
  const heldRelErr = count ? Math.sqrt(se / count) / range : Infinity;
  return { expr: terms.map((t, k) => `${round(c[k])}*(${t})`).join(" + "), coeffs: c.map(round), heldRelErr };
}

const CRITERION = "quantization: E_n = f(n) fits the low levels and PREDICTS the held-out higher levels to relative error < tol";

function certifySpectrum(expr, levels, nTrain, tol) {
  let fn;
  try { fn = makeFn(String(expr), ["n"]); }
  catch (e) { return buildCertificate({ criterion: CRITERION, claim: `E_n = ${expr}`, oracleVerdict: { tier: "spectrum", oracle: "levels-heldout-v1", certified: true, verdict: "unverifiable", evidence: [["reason", "invalid-expression"], ["error", String(e.message || e)]] } }); }
  let se = 0, count = 0;
  for (let n = nTrain; n < levels.length; n++) { se += (fn({ n }) - levels[n]) ** 2; count++; }
  const range = Math.abs(levels[levels.length - 1] - levels[0]) + 1e-12;
  const relErr = count ? Math.sqrt(se / count) / range : Infinity;
  const verdict = relErr < tol ? "verified" : "refuted";
  const oracle = { tier: "spectrum", oracle: "levels-heldout-v1", certified: true, verdict,
    evidence: [["expr", String(expr)], ["held_rel_err", relErr.toExponential(3)], ["tol", String(tol)], ["n_train", String(nTrain)], ["n_levels", String(levels.length)]] };
  return buildCertificate({ criterion: CRITERION, claim: `E_n = ${expr} (held-out rel err ${relErr.toExponential(3)})`, oracleVerdict: oracle });
}

// Tools with the SAME shape as the conservation tools, so the same LLM loop drives spectrum discovery.
export function makeSpectrumTools(grid, Vfn, name, { K = 7, nTrain = 5, tol = 0.03 } = {}) {
  const levels = spectrum(grid, Vfn, K);
  const trainLevels = levels.slice(0, nTrain);
  const perception = { variables: ["n"], levels, nTrain, trainLevels };

  function fit(terms) {
    if (!Array.isArray(terms) || terms.length === 0) return { ok: false, reason: "give a non-empty list of terms in n, e.g. [\"1\",\"n\"]" };
    let r;
    try { r = regressLevels(terms.map(String), levels, nTrain); }
    catch (e) { return { ok: false, reason: `invalid term: ${String(e.message || e)}` }; }
    return { ok: true, expr: r.expr, verdict: r.heldRelErr < tol ? "verified" : "refuted", conservationScore: r.heldRelErr.toExponential(3) };
  }
  function evaluate() { return { verdict: "refuted", conservationScore: "na", reason: "use fit with terms in n" }; }
  function submit(expr) { return certifySpectrum(String(expr || ""), levels, nTrain, tol); }
  return { perception, fit, evaluate, submit, system: { vars: ["n"], name } };
}

export const spectrumSystemPrompt = () =>
  `You are a physicist shown the measured ENERGY LEVELS of a quantum system: E_0, E_1, E_2, ... Discover the FORMULA for E_n as a function of the level index n.\n` +
  `You do not compute the coefficients; a tool does. Reply with exactly ONE JSON object:\n` +
  `  {"tool":"fit","terms":["<term in n>", ...]}\n` +
  `It fits the coefficients to the LOW levels and checks whether the formula PREDICTS the higher levels (verdict=verified means yes).\n` +
  `Terms are functions of n using numbers, n, + - * / ^, parentheses. Common spectra: EQUALLY SPACED (terms "1","n"), or growing like a SQUARE (terms "1","(n+1)^2"). Start with ["1","n"]; if not verified, try other terms. Output nothing except the single JSON object.`;

export const spectrumUserPrompt = (p) =>
  `measured energy levels (the first ${p.nTrain} are shown; higher ones are held back to test your formula):\n` +
  `  n    E_n\n` +
  p.trainLevels.map((e, i) => `  ${i}    ${round(e)}`).join("\n") +
  `\n\nFind a formula E_n = f(n) that fits these and predicts the held-out higher levels.`;
