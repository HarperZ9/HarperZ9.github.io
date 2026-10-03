// system/explainer/state.mjs
// What one explainer frame shows: the JavaScript twin of tools/explainer/scene.py.
//
// The offline renderer (Pillow, then ffmpeg) and the live engine plugin draw from the same
// frameState(): one spec, one timeline and one set of parameter values give the same scene, mark
// alphas, hot mark, bar values and resolved text in both. tests/test_explainer_parity.py runs the
// two side by side over sampled frames, at the defaults and with parameters moved.
//
// Pure module: no DOM, no network, no imports beyond the risk levels.

export const LEVELS = Object.freeze(["low", "moderate", "elevated", "high"]);
// The verdict table tools/explainer/marks.py uses; the parity test keeps the two equal.
export const VERDICT_RISK = Object.freeze({
  MATCH: "low", VERIFIED: "low", PASS: "low", UNVERIFIABLE: "moderate",
  UNKNOWN: "moderate", DRIFT: "elevated", STALE: "elevated", FAIL: "high", REFUSED: "high",
});
const FADE = 0.12, STAGGER = 0.08;
const TEMPLATE = /\{([a-z_][a-z0-9_]*)\}/g;
const COMPARE = { le: (a, b) => a <= b, lt: (a, b) => a < b, ge: (a, b) => a >= b, gt: (a, b) => a > b, eq: (a, b) => a === b };

export const ease = (u) => { u = Math.min(1, Math.max(0, u)); return u * u * (3 - 2 * u); };
const r6 = (x) => Math.round(x * 1e6) / 1e6;
const fmt = (v, digits) => (typeof v === "number" ? v.toFixed(digits) : String(v));

export function riskOf(mark) {
  if (mark.risk) return mark.risk;
  const v = mark.verdict;
  return v ? (VERDICT_RISK[String(v).toUpperCase()] || "moderate") : null;
}

// Every parameter's value (default unless overridden, clamped to its range), then the derived ones.
export function values(spec, overrides = {}) {
  const env = {}, digits = {};
  for (const p of spec.params || []) {
    let v = p.id in overrides ? overrides[p.id] : p.default;
    if ((p.kind || "range") === "range") v = Math.min(p.max, Math.max(p.min, Number(v)));
    else if (!p.options.some((o) => o.value === v)) v = p.default;
    env[p.id] = v; digits[p.id] = p.digits || 0;
  }
  for (const [key, expr] of Object.entries(spec.derived || {})) env[key] = resolve(expr, env, digits);
  Object.defineProperty(env, "__digits__", { value: digits, enumerable: false });
  return env;
}

function condition(cond, env, digits) {
  if (cond.all) return cond.all.every((c) => condition(c, env, digits));
  const [op, [a, b]] = Object.entries(cond)[0];
  return COMPARE[op](resolve(a, env, digits), resolve(b, env, digits));
}

export function resolve(value, env, digits = env.__digits__ || {}) {
  if (typeof value === "string") return value.replace(TEMPLATE, (_, id) => fmt(env[id], digits[id] || 0));
  if (Array.isArray(value)) return value.map((v) => resolve(v, env, digits));
  if (!value || typeof value !== "object") return value;
  if ("param" in value) {
    let v = env[value.param];
    if ("mul" in value) v = v * value.mul;
    if ("over" in value) v = value.over / v;
    return v;
  }
  if ("if" in value) return resolve(condition(value.if, env, digits) ? value.then : value.else, env, digits);
  const out = {};
  for (const [k, v] of Object.entries(value)) out[k] = resolve(v, env, digits);
  return out;
}

// A scene whose narration depends on the figure gives "outcome" (a binding that computes an
// outcome word, such as MATCH or DRIFT) and makes "say" one caption per outcome word. Resolving
// picks the caption for the computed outcome, so the caption and the figure share their values.
export function pickCaption(scene) {
  if (!scene.say || typeof scene.say !== "object") return scene;
  if (!(scene.outcome in scene.say)) throw new Error(`explainer: scene ${scene.key} has no caption for outcome ${scene.outcome}`);
  return { ...scene, say: scene.say[scene.outcome] };
}

export function resolvedScenes(spec, overrides = {}) {
  const env = values(spec, overrides);
  return spec.scenes.map((s) => pickCaption(resolve(s, env)));
}

// [key, start, end] per scene: the narrated timing from a receipt, else each scene's minimum.
export function timeline(spec, receipt = null) {
  if (receipt) return receipt.timeline.map((r) => [r.scene, r.start, r.end]);
  let t = 0;
  return spec.scenes.map((s) => { const d = s.min ?? 3.0; const row = [s.key, t, t + d]; t += d; return row; });
}

export function locate(rows, t) {
  t = Math.min(Math.max(t, 0), rows[rows.length - 1][2] - 1e-9);
  for (let i = 0; i < rows.length; i++) {
    const [, start, end] = rows[i];
    if (start <= t && t < end + 1e-9) return [i, (t - start) / (end - start)];
  }
  return [rows.length - 1, 1];
}

function triesSlots(mark, u, a) {
  const budget = Math.trunc(mark.budget), first = Math.trunc(mark.first_pass);
  const passed = first >= 1 && first <= budget;
  const slots = [];
  for (let i = 1; i <= Math.trunc(mark.max); i++) {
    const alpha = mark.carry ? 1 : a * ease((u - (mark.at || 0) - STAGGER * (i - 1)) / FADE);
    let word = "FAIL";
    if (i > budget) word = "over budget";
    else if (passed && i === first) word = "PASS";
    else if (passed && i > first) word = "not run";
    slots.push({ n: i, word, alpha: r6(alpha), in_budget: i <= budget });
  }
  return slots;
}

function markState(mark, u, alpha, hot) {
  const s = { type: mark.type, alpha: r6(alpha), hot, risk: riskOf(mark) };
  if (mark.type === "bars") {
    s.items = mark.items.map((item) => {
      const to = item.to ?? item.value;
      const v = item.value + (to - item.value) * ease((u - 0.2) / 0.6);
      return { label: item.label, display: item.display, value: r6(v), strong: !!item.strong, alpha: item.carry ? 1 : r6(alpha) };
    });
    s.scale = mark.scale || Math.max(...mark.items.map((i) => Math.max(i.value, i.to || 0)));
  } else if (mark.type === "tries") {
    s.slots = triesSlots(mark, u, alpha);
  } else if (mark.type === "grid") {
    Object.assign(s, { filled: Math.round(mark.filled), count: mark.count, label: mark.label });
  } else {
    for (const k of ["label", "value", "text", "verdict"]) if (k in mark) s[k] = mark[k];
  }
  return s;
}

function hotOf(marks, alphas) {
  let best = -1, rank = -1;
  marks.forEach((m, i) => {
    const level = alphas[i] > 0 ? riskOf(m) : null;
    if (level && LEVELS.indexOf(level) > rank) { best = i; rank = LEVELS.indexOf(level); }
  });
  return best;
}

// Everything a frame shows at time t, for already-resolved scenes.
export function frameState(scenes, rows, t) {
  const [i, u] = locate(rows, t);
  const scene = scenes[i];
  const marks = scene.marks || [];
  const alphas = marks.map((m) => ease((u - (m.at || 0)) / FADE));
  const hot = hotOf(marks, alphas);
  const titled = scene.layout === "title" || scene.layout === "close";
  return {
    scene: scene.key, index: i, u: r6(u), layout: scene.layout || "marks",
    heading: scene.heading || "", say: scene.say, outcome: scene.outcome ?? null, command: scene.command ?? null,
    heading_alpha: r6(scene.carry_heading ? 1 : ease(u / (titled ? 0.15 : FADE))),
    marks: marks.map((m, j) => markState(m, u, alphas[j], j === hot)),
  };
}

// The still a reduced-motion reader sees for a scene: its last moment, every mark settled.
export function stillTime(rows, index) {
  const [, start, end] = rows[index];
  return start + (end - start) * 0.97;
}
