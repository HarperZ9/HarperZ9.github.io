// Look keys: parameters keyed to time-of-day slots.
//
// A look term (a direct-light intensity, an ambient level, a fog density, a colour grade, any
// number or vector) is given one value per slot. Eight slots is the default and six is accepted
// (author decision, 2026-10-15); fewer than six is refused, because three keys cannot hold a
// dawn, a dusk and a night apart. Slots sit on a 24-hour circle at the hours below (or at hours
// the caller names), so the day wraps: the last slot blends into the first. Control is fine
// grained by design (every term has its own curve); it is engine data, not a player setting.
//
// Interpolation is a periodic monotone cubic Hermite spline (Fritsch and Carlson, 1980, with a
// tangent of zero at a local extremum): the curve passes through every key exactly and never
// leaves the range of the two keys beside it, so a term cannot overshoot between slots.
// The environment state (project-docs/ENVIRONMENT-STATE.md) reads these curves as its time axis.
export const SLOTS_8 = [
  { name: "midnight", hour: 0 }, { name: "predawn", hour: 4 }, { name: "dawn", hour: 6 }, { name: "morning", hour: 9 },
  { name: "noon", hour: 12.5 }, { name: "golden", hour: 17 }, { name: "dusk", hour: 19.5 }, { name: "night", hour: 22 },
];
export const SLOTS_6 = [
  { name: "night", hour: 0 }, { name: "dawn", hour: 5.5 }, { name: "morning", hour: 9.5 },
  { name: "noon", hour: 13 }, { name: "dusk", hour: 18.5 }, { name: "late", hour: 21.5 },
];
export const MIN_SLOTS = 6;

export function resolveSlots(slots = 8) {
  const list = slots === 8 ? SLOTS_8 : slots === 6 ? SLOTS_6 : slots;
  if (!Array.isArray(list)) throw new Error(`look keys: slots is 8, 6 or an array of { name, hour }, got ${String(slots)}`);
  if (list.length < MIN_SLOTS) throw new Error(`look keys: ${list.length} slots is too few; use at least ${MIN_SLOTS} (8 by default)`);
  let prev = -Infinity;
  for (const s of list) {
    if (!(s.hour >= 0 && s.hour < 24) || !(s.hour > prev)) throw new Error(`look keys: slot hours must increase inside [0, 24); ${s.name} is at ${s.hour}`);
    prev = s.hour;
  }
  return list;
}

const mod24 = (h) => ((h % 24) + 24) % 24;
// Index of the slot at or before the hour, and the fraction t toward the next slot (periodic).
export function locate(slots, hour) {
  const h = mod24(hour), n = slots.length;
  let i = n - 1;
  for (let k = 0; k < n; k++) if (slots[k].hour <= h) i = k;
  const j = (i + 1) % n, a = slots[i].hour, b = slots[j].hour + (j <= i ? 24 : 0), x = h < a ? h + 24 : h;
  return { i, j, t: (x - a) / (b - a), span: b - a };
}

// Fritsch-Carlson tangents for periodic data y at slot hours, one component.
function tangents(slots, y) {
  const n = y.length, d = new Array(n), m = new Array(n);
  for (let k = 0; k < n; k++) { const j = (k + 1) % n, span = slots[j].hour + (j <= k ? 24 : 0) - slots[k].hour; d[k] = (y[j] - y[k]) / span; }
  for (let k = 0; k < n; k++) {
    const p = d[(k + n - 1) % n], q = d[k];
    if (p * q <= 0) { m[k] = 0; continue; }
    const wp = slots[k].hour - slots[(k + n - 1) % n].hour + (k === 0 ? 24 : 0), wq = slots[(k + 1) % n].hour + ((k + 1) % n <= k ? 24 : 0) - slots[k].hour, w1 = 2 * wq + wp, w2 = wq + 2 * wp;
    m[k] = (w1 + w2) / (w1 / p + w2 / q);
  }
  // keep each segment inside the monotone region
  for (let k = 0; k < n; k++) {
    if (d[k] === 0) { m[k] = 0; m[(k + 1) % n] = 0; continue; }
    const a = m[k] / d[k], b = m[(k + 1) % n] / d[k], s = a * a + b * b;
    if (s > 9) { const tau = 3 / Math.sqrt(s); m[k] = tau * a * d[k]; m[(k + 1) % n] = tau * b * d[k]; }
  }
  return m;
}
function hermite(y0, y1, m0, m1, span, t) {
  const t2 = t * t, t3 = t2 * t;
  return (2 * t3 - 3 * t2 + 1) * y0 + (t3 - 2 * t2 + t) * span * m0 + (-2 * t3 + 3 * t2) * y1 + (t3 - t2) * span * m1;
}

// One parameter: values per slot, each a number or a vector of equal length.
function makeSeries(slots, values, name) {
  if (!Array.isArray(values) || values.length !== slots.length) throw new Error(`look keys: ${name} needs ${slots.length} values, one per slot`);
  const dim = Array.isArray(values[0]) ? values[0].length : 0;
  for (const v of values) if ((Array.isArray(v) ? v.length : 0) !== dim || (dim ? !v.every(Number.isFinite) : !Number.isFinite(v))) throw new Error(`look keys: ${name} has a bad value`);
  const comps = dim ? Array.from({ length: dim }, (_, c) => values.map((v) => v[c])) : [values], tans = comps.map((y) => tangents(slots, y));
  return (hour) => {
    const { i, j, t, span } = locate(slots, hour);
    if (t === 0) return dim ? comps.map((y) => y[i]) : comps[0][i];
    const out = comps.map((y, c) => hermite(y[i], y[j], tans[c][i], tans[c][j], span, t));
    return dim ? out : out[0];
  };
}

// params: { name: [values per slot] | { values, min, max } }.
export function createLookKeys({ slots = 8, params }) {
  const list = resolveSlots(slots), series = {}, range = {};
  for (const [name, spec] of Object.entries(params)) {
    const values = Array.isArray(spec) ? spec : spec.values;
    series[name] = makeSeries(list, values, name);
    range[name] = Array.isArray(spec) ? {} : { min: spec.min, max: spec.max };
  }
  const clampTo = (name, v) => { const f = (x) => Math.min(range[name].max ?? Infinity, Math.max(range[name].min ?? -Infinity, x)); return Array.isArray(v) ? v.map(f) : f(v); };
  return {
    slots: list, names: Object.keys(series),
    // Every term at an hour (clamped to its declared range).
    at(hour) { const o = {}; for (const n of this.names) o[n] = clampTo(n, series[n](hour)); return o; },
    term(name, hour) { if (!(name in series)) throw new Error(`look keys: unknown term ${name}`); return clampTo(name, series[name](hour)); },
  };
}
