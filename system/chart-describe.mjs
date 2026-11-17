// chart-describe.mjs: what a chart's data does, in one or two plain sentences, computed from the data itself.
//
//   describeCurve(points, opts)   [[x, y], ...] in x order: direction, shape, peaks and lows, where it levels off,
//                                 the range, and the largest single jump when one step carries much of the change
//   describeRows(rows, opts)      labelled values (bars, intervals, bands, before-and-after pairs): highest, lowest,
//                                 the range, and what stands out (values below zero, intervals across zero, values
//                                 outside their control range, which way the pairs move)
//   checkDescription(text, facts) the errors a description has against the facts it was made from: no trend word,
//                                 no extremum or shape, or a direction the data does not take
//
// Pure: the same data gives the same words, in node and the browser. Every chart the site draws reads its sentence
// from here, so the words change when the data does. Axes and units are said after this sentence, by the caller.

// Three significant figures for small values; whole numbers from 100 up, so a year reads as itself; millions and
// billions in words, which a screen reader says better than an exponent.
export const sig = (v) => {
  if (!Number.isFinite(v)) return String(v);
  const a = Math.abs(v);
  let s;
  if (a >= 1e9) s = `${Number((v / 1e9).toPrecision(3))} billion`;
  else if (a >= 1e6) s = `${Number((v / 1e6).toPrecision(3))} million`;
  else if (a >= 100) s = String(Math.round(v));
  else if (a !== 0 && a < 1e-3) s = v.toExponential(2).replace(/\.?0+e/, "e");
  else s = String(Number(v.toPrecision(3)));
  return s.replace(/^-/, "\u2212");
};
const fmtOf = (o) => (o && o.fmt) || sig;
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const at = (fx, x) => (fx.at ? fx.at(x) : `at ${fx(x)}`);

// Turning points with a threshold, so a wiggle smaller than a tenth of the range is not called a turn.
export function legs(ys, frac = 0.1) {
  const lo = Math.min(...ys), hi = Math.max(...ys), T = (hi - lo) * frac;
  const piv = [0];
  let dir = 0, ext = 0;
  for (let i = 1; i < ys.length; i++) {
    if (dir === 0) { if (Math.abs(ys[i] - ys[0]) > T) { dir = Math.sign(ys[i] - ys[0]); ext = i; } continue; }
    if ((ys[i] - ys[ext]) * dir > 0) ext = i;
    else if ((ys[ext] - ys[i]) * dir > T) { piv.push(ext); dir = -dir; ext = i; }
  }
  if (dir !== 0) piv.push(ext);
  if (piv[piv.length - 1] !== ys.length - 1 && Math.abs(ys[ys.length - 1] - ys[piv[piv.length - 1]]) > T) piv.push(ys.length - 1);
  const out = [];
  for (let k = 1; k < piv.length; k++) out.push({ from: piv[k - 1], to: piv[k], dir: ys[piv[k]] > ys[piv[k - 1]] ? "rise" : "fall" });
  return out;
}

// How a single rise or fall spends its change across the first, middle and last third of its x range.
function pace(P, a, b) {
  const x0 = P[a][0], x1 = P[b][0], total = P[b][1] - P[a][1];
  if (!(x1 > x0) || total === 0) return "";
  const yAt = (x) => { let i = a; while (i < b && P[i + 1][0] < x) i++; const [xa, ya] = P[i], [xb, yb] = P[Math.min(i + 1, b)]; return xb > xa ? ya + (yb - ya) * (x - xa) / (xb - xa) : ya; };
  const t1 = x0 + (x1 - x0) / 3, t2 = x0 + 2 * (x1 - x0) / 3;
  const f = [(yAt(t1) - P[a][1]) / total, (yAt(t2) - yAt(t1)) / total, (P[b][1] - yAt(t2)) / total];
  if (f[1] >= 0.45 && f[0] < 0.3 && f[2] < 0.3) return "slowly at first, covering most of its change in the middle third, then easing into its end";
  if (f[0] > 0.5) return "covering most of its change in the first third, then levelling off";
  if (f[2] > 0.5) return "slowly at first, covering most of its change in the last third";
  if (f.every((v) => v > 0.2 && v < 0.47)) return "at a nearly steady rate";
  if (Math.abs(f[0] - f[2]) < 0.05) return "covering most of its change in the middle";
  return f[0] > f[2] ? "covering more of its change in its first half" : "covering more of its change in its second half";
}

// Runs of two or more steps with almost no change between two moves: the curve moves in steps with holds between.
// A slow start or a slow finish is not a hold, so runs touching either end are not counted.
function holds(P, a, b) {
  const span = Math.abs(P[b][1] - P[a][1]) || 1, still = (i) => Math.abs(P[i][1] - P[i - 1][1]) <= span * 0.002;
  let s = a + 1, e = b;
  while (s <= b && still(s)) s++;
  while (e > s && still(e)) e--;
  let runs = 0, len = 0;
  for (let i = s; i <= e; i++) {
    if (still(i)) len++;
    else { if (len >= 2) runs++; len = 0; }
  }
  return runs;
}

export function describeCurve(points, opts = {}) {
  const P = points.filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y)).slice().sort((p, q) => p[0] - q[0]);
  const name = cap(opts.name || "The curve"), fx = fmtOf(opts.x), fy = fmtOf(opts.y);
  if (P.length < 2) return { text: P.length ? `${name} has one point, ${fy(P[0][1])} ${at(fx, P[0][0])}.` : `${name} has no points.`, facts: { kind: "curve", trend: "none", dirs: [] } };
  const ys = P.map((p) => p[1]), lo = Math.min(...ys), hi = Math.max(...ys), span = hi - lo, ref = Math.max(Math.abs(lo), Math.abs(hi), span) || 1;
  const iLo = ys.indexOf(lo), iHi = ys.indexOf(hi), first = P[0], last = P[P.length - 1];
  const facts = { kind: "curve", n: P.length, lo, hi, iLo, iHi, start: first[1], end: last[1] };
  if (span / ref < 0.01) return { text: `${name} stays level at about ${fy((lo + hi) / 2)} from ${fx(first[0])} to ${fx(last[0])}.`, facts: { ...facts, trend: "flat", dirs: [] } };
  const L = legs(ys), dirs = L.map((l) => l.dir), net = last[1] - first[1];
  facts.dirs = dirs; facts.trend = dirs.length === 1 ? dirs[0] : Math.abs(net) < span * 0.1 ? "mixed" : net > 0 ? "rise" : "fall";
  const word = (d) => (d === "rise" ? "rises" : "falls");
  let s;
  if (L.length === 1) {
    const d = dirs[0], h = holds(P, 0, P.length - 1), p = pace(P, 0, P.length - 1);
    s = `${name} ${word(d)} from ${fy(first[1])} ${at(fx, first[0])} to ${fy(last[1])} ${at(fx, last[0])}`;
    s += h >= 2 ? `, in ${h + 1} steps with holds between them.` : p ? `, ${p}.` : ".";
    if (h < 2 && p && p !== "at a nearly steady rate") s += ` It is steepest around ${fx(steepest(P))}.`;
    const done = P.findIndex(([, y]) => Math.abs(last[1] - y) <= Math.abs(net) * 0.05);
    if (done > 0 && done < P.length - 1 && (P[done][0] - first[0]) < (last[0] - first[0]) * 0.8) s += ` It is within 5 percent of its end by ${fx(P[done][0])}.`;
  } else if (L.length === 2) {
    const m = L[0].to, peak = dirs[0] === "rise";
    s = `${name} ${word(dirs[0])} from ${fy(first[1])} ${at(fx, first[0])} to a ${peak ? "peak" : "low"} of ${fy(P[m][1])} ${at(fx, P[m][0])}, then ${word(dirs[1])} to ${fy(last[1])} ${at(fx, last[0])}.`;
  } else {
    const ends = Math.abs(net) < span * 0.1 ? "ending near where it starts" : `ending ${net > 0 ? "higher" : "lower"} than it starts, at ${fy(last[1])}`;
    s = `${name} turns ${L.length - 1} times between ${fx(first[0])} and ${fx(last[0])}, ranging from a low of ${fy(lo)} ${at(fx, P[iLo][0])} to a high of ${fy(hi)} ${at(fx, P[iHi][0])}, and ${ends}. It ${word(dirs[0])} first.`;
  }
  s += surprise(P, L, span, fx, fy);
  return { text: s, facts };
}

// The x at the middle of the steepest stretch, slope taken over three steps so one noisy step does not decide it.
function steepest(P) {
  const w = Math.min(3, P.length - 1);
  let best = -1, x = P[0][0];
  for (let i = w; i < P.length; i++) {
    const dx = P[i][0] - P[i - w][0], m = dx > 0 ? Math.abs(P[i][1] - P[i - w][1]) / dx : 0;
    if (m > best) { best = m; x = (P[i][0] + P[i - w][0]) / 2; }
  }
  return x;
}

// What a reader would not guess from the ends: an overshoot past the end value, or one step carrying most of the change.
function surprise(P, L, span, fx, fy) {
  const last = P[P.length - 1][1], ys = P.map((p) => p[1]);
  if (L.length === 1 && L[0].dir === "rise") {
    const top = Math.max(...ys), i = ys.indexOf(top);
    if (top - last > span * 0.02 && i < P.length - 1) return ` It overshoots to ${fy(top)} ${at(fx, P[i][0])} before settling.`;
  }
  if (P.length >= 8) {
    let best = 0, k = 1;
    for (let i = 1; i < P.length; i++) { const d = P[i][0] > P[i - 1][0] ? Math.abs(P[i][1] - P[i - 1][1]) : 0; if (d > best) { best = d; k = i; } }
    if (best > span * 0.3) return ` The largest single change, ${fy(best)}, comes between ${fx(P[k - 1][0])} and ${fx(P[k][0])}.`;
  }
  return "";
}

const rowName = (r) => [r.group, r.label].filter(Boolean).join(", ");

// One value on its own has no trend: say the value, and where it sits against its interval or control range.
function single(r, form, fy) {
  let s = `${rowName(r)} is ${fy(r.value)}, the only value drawn`;
  if (Number.isFinite(r.lo) && Number.isFinite(r.hi)) {
    const range = form === "band" ? "its control range" : "its interval";
    const where = r.value < r.lo ? "below" : r.value > r.hi ? "above" : "inside";
    s += `, ${where} ${range} of ${fy(r.lo)} to ${fy(r.hi)}`;
    if (form !== "band" && r.lo <= 0 && r.hi >= 0) s += ", which includes zero";
  }
  return s + ".";
}

// Labelled values. form: "bars", "interval" or "band" read r.value (with r.lo and r.hi as an interval or a control
// range); "dumbbell" reads r.a and r.b as two values for the same row.
export function describeRows(rows, opts = {}) {
  const fy = fmtOf(opts), form = opts.form || "bars", name = opts.name || "";
  if (form === "dumbbell") return pairs(rows, opts, fy);
  const R = rows.filter((r) => Number.isFinite(r.value));
  if (!R.length) return { text: `${name ? `${name}: ` : ""}no row has a value.`, facts: { kind: "rows", trend: "none" } };
  const top = R.reduce((m, r) => (r.value > m.value ? r : m)), bot = R.reduce((m, r) => (r.value < m.value ? r : m));
  const facts = { kind: "rows", n: R.length, hi: top.value, lo: bot.value, top: rowName(top), bottom: rowName(bot), trend: "rank" };
  if (R.length === 1) return { text: cap(`${name ? `${name}: ` : ""}${single(top, form, fy)}`), facts: { ...facts, kind: "single", trend: "single" } };
  let s = top.value === bot.value ? `All ${R.length} rows are ${fy(top.value)}.`
    : `${rowName(top)} is highest at ${fy(top.value)} and ${rowName(bot)} lowest at ${fy(bot.value)}, a range of ${fy(top.value - bot.value)} across ${R.length} rows.`;
  if (name) s = `${name}: ${s}`;
  const neg = R.filter((r) => r.value < 0).length;
  if (neg && neg < R.length) s += ` ${neg} of ${R.length} ${neg === 1 ? "is" : "are"} below zero.`;
  const iv = R.filter((r) => Number.isFinite(r.lo) && Number.isFinite(r.hi));
  if (iv.length && form === "band") {
    const out = iv.filter((r) => r.value < r.lo || r.value > r.hi);
    s += out.length ? ` ${out.length} of ${iv.length} fall outside their control range${out.length <= 3 ? `: ${out.map(rowName).join("; ")}` : ""}.` : ` All ${iv.length} fall inside their control range.`;
    facts.outside = out.length;
  } else if (iv.length && iv.some((r) => r.lo < 0) && iv.some((r) => r.hi > 0)) {
    const cross = iv.filter((r) => r.lo <= 0 && r.hi >= 0).length;
    s += ` ${cross} of ${iv.length} interval${iv.length === 1 ? "" : "s"} include${cross === 1 ? "s" : ""} zero.`;
  }
  const ordered = opts.ordered ?? R.every((r) => /^\s*[-−]?\d+(\.\d+)?\s*$/.test(String(r.label)));
  if (ordered && R.length >= 3) {
    const c = describeCurve(R.map((r) => [Number(String(r.label).replace("−", "-")), r.value]), { name: "In label order the value", y: opts });
    s += ` ${c.text}`; facts.dirs = c.facts.dirs; facts.trend = c.facts.trend;
  }
  return { text: cap(s), facts };
}

function pairs(rows, opts, fy) {
  const R = rows.filter((r) => Number.isFinite(r.a) && Number.isFinite(r.b)), A = opts.aName || "the first value", B = opts.bName || "the second";
  if (!R.length) return { text: "No row has both values.", facts: { kind: "pairs", trend: "none" } };
  const up = R.filter((r) => r.b > r.a).length, down = R.filter((r) => r.b < r.a).length;
  const big = R.reduce((m, r) => (Math.abs(r.b - r.a) > Math.abs(m.b - m.a) ? r : m));
  const all = R.flatMap((r) => [r.a, r.b]), lo = Math.min(...all), hi = Math.max(...all);
  const eq = R.length - up - down, dir = up === R.length ? "rise" : down === R.length ? "fall" : up && down ? "mixed" : up ? "rise" : down ? "fall" : "flat";
  const rest = [down && up ? `lower in ${down}` : "", eq ? `equal in ${eq}` : ""].filter(Boolean).join(" and ");
  const lead = up === R.length ? `${B} is higher than ${A} in all ${R.length} rows` : down === R.length ? `${B} is lower than ${A} in all ${R.length} rows`
    : !up && !down ? `${B} equals ${A} in all ${R.length} rows`
    : `${B} is ${up ? "higher" : "lower"} than ${A} in ${up || down} of ${R.length} rows${rest ? ` and ${rest}` : ""}`;
  const text = `${cap(lead)}. The largest gap is ${rowName(big)}, from ${fy(big.a)} to ${fy(big.b)}; values range from ${fy(lo)} to ${fy(hi)}.`;
  return { text, facts: { kind: "pairs", n: R.length, up, down, lo, hi, trend: dir, dirs: dir === "mixed" ? ["rise", "fall"] : [dir] } };
}

const RISE = /\b(rises?|rising|climbs?|climbing|increases?|increasing|grows?|growing|goes up|higher than)\b/i;
const FALL = /\b(falls?|falling|drops?|dropping|declines?|declining|decreases?|decreasing|goes down|lower than)\b/i;
const FLAT = /\b(level|flat|steady|unchanged|constant)\b/i;
const TREND = new RegExp(`${RISE.source}|${FALL.source}|${FLAT.source}|\\b(peaks?|dips?|turns?|highest|lowest|no clear trend)\\b`, "i");
const SHAPE = /\b(peak|low of|high of|highest|lowest|maximum|minimum|levell?ing off|levels off|steady rate|slowly|steepest|most of its change|more of its change|steps|holds|overshoots?|range|from .{1,80}? to )\b/i;

// The errors a description has against the facts of the data it describes; an empty list means it passes.
export function checkDescription(text, facts) {
  const errs = [], t = String(text || "").replace(/\bas x (rises|falls)\b/g, "");
  const one = facts && facts.kind === "single";
  if (!one && !TREND.test(t)) errs.push("names no trend: it says what is on the chart, not what the data does");
  if ((!one && !SHAPE.test(t)) || !/\d/.test(t)) errs.push("names no extremum, range or shape with a value");
  const dirs = (facts && facts.dirs) || [];
  if (facts && facts.kind !== "rows") {
    if (RISE.test(t) && !dirs.includes("rise") && facts.trend !== "rise") errs.push("says the data rises, but it never rises");
    if (FALL.test(t) && !dirs.includes("fall") && facts.trend !== "fall") errs.push("says the data falls, but it never falls");
    if (facts.trend !== "flat" && dirs.length && FLAT.test(t) && !RISE.test(t) && !FALL.test(t)) errs.push("calls the data level, but it moves");
  }
  // the row named as highest: "<row> is highest at" or "the highest is <row> at"
  if (facts && facts.kind === "rows" && /\bhighest\b/i.test(t)) {
    const low = t.toLowerCase(), top = String(facts.top).toLowerCase();
    if (!low.includes(`${top} is highest`) && !low.includes(`highest is ${top} at`)) errs.push(`names the wrong row as highest; it is ${facts.top}`);
  }
  return errs;
}

// A timing curve: samples [[u, progress]] on normalised time u in 0..1, over a build of durationS seconds.
export function describeTiming(samples, durationS) {
  const pct = (v) => `${Math.round(v * 100)} percent`;
  return describeCurve(samples, { name: "Progress", x: { fmt: (u) => `${(u * durationS).toFixed(1)} s` }, y: { fmt: pct } });
}

// A cloud of points: does y go with x (Pearson correlation), and where are the highest and lowest y.
export function describeScatter(points, opts = {}) {
  const P = points.filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y)), name = cap(opts.name || "The points"), fx = fmtOf(opts.x), fy = fmtOf(opts.y);
  if (P.length < 3) return describeCurve(P, opts);
  const n = P.length, mx = P.reduce((s, p) => s + p[0], 0) / n, my = P.reduce((s, p) => s + p[1], 0) / n;
  let sxy = 0, sxx = 0, syy = 0;
  for (const [x, y] of P) { sxy += (x - mx) * (y - my); sxx += (x - mx) ** 2; syy += (y - my) ** 2; }
  const r = sxx > 0 && syy > 0 ? sxy / Math.sqrt(sxx * syy) : 0;
  const top = P.reduce((m, p) => (p[1] > m[1] ? p : m)), bot = P.reduce((m, p) => (p[1] < m[1] ? p : m));
  const dir = r > 0.3 ? "rise" : r < -0.3 ? "fall" : "none";
  const how = dir === "rise" ? "y tends to rise as x rises" : dir === "fall" ? "y tends to fall as x rises" : "y shows no clear trend with x";
  const text = `${name}: across ${n} points ${how} (correlation ${sig(r)}); y runs from a low of ${fy(bot[1])} ${at(fx, bot[0])} to a high of ${fy(top[1])} ${at(fx, top[0])}.`;
  return { text, facts: { kind: "scatter", n, r, lo: bot[1], hi: top[1], trend: dir, dirs: dir === "none" ? [] : [dir] } };
}

// A grid of values: the highest and lowest cell and the spread.
export function describeMatrix(rowLabels, cols, values, opts = {}) {
  const fy = fmtOf(opts), cells = [];
  values.forEach((row, i) => row.forEach((v, j) => { if (Number.isFinite(v)) cells.push({ v, at: `${rowLabels[i]}, ${cols[j]}` }); }));
  if (!cells.length) return { text: "The grid has no values.", facts: { kind: "rows", trend: "none" } };
  const top = cells.reduce((m, c) => (c.v > m.v ? c : m)), bot = cells.reduce((m, c) => (c.v < m.v ? c : m));
  return { text: `Across ${cells.length} cells the highest is ${top.at} at ${fy(top.v)} and the lowest ${bot.at} at ${fy(bot.v)}, a range of ${fy(top.v - bot.v)}.`, facts: { kind: "rows", n: cells.length, hi: top.v, lo: bot.v, top: top.at, trend: "rank" } };
}
