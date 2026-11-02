// How precise a post's time is, and which timing signals can be read at that precision. A time
// shown on screen as "14h" or "1d" and turned into a timestamp is only good to the hour or the day,
// yet it looks like any other timestamp. Several replies then share one second by rounding, and a
// burst test reads that as coordination. Every timing signal checks the precision first and, below
// the resolution it needs, reports that it could not be observed instead of firing.
//
// Precision comes, in order, from a post's own timePrecision, the thread's timePrecision (the
// input, or the importer for a platform format), or the times themselves. A typed time is never
// taken as second-precise without evidence: when most times fall on the same point of the minute,
// hour or day, they are taken as rounded to that unit.

export const PRECISIONS = ["exact", "second", "minute", "hour", "day"];
export const PRECISION_MS = { exact: 1, second: 1000, minute: 60000, hour: 3600000, day: 86400000 };
// The coarsest precision each timing signal can still be read at.
export const SIGNAL_NEEDS = { "timing-burst": "second", "fast-replier": "second", swarming: "minute", "quote-bunching": "minute", "active-hours": "hour", "no-sleep-gap": "hour" };
export const MIN_INFER = 3;
export const NOT_OBSERVABLE = "not observable at this time precision";
export const PRECISION_WORDS = { exact: "to the millisecond", second: "to the second", minute: "to the minute", hour: "to the hour", day: "to the day" };

export const asPrecision = (p) => (PRECISIONS.includes(p) ? p : null);
// The coarser of two precisions; unknown (null) wins, since nothing finer can be assumed.
export const coarser = (a, b) => (a == null || b == null ? null : PRECISION_MS[a] >= PRECISION_MS[b] ? a : b);
// True when a signal can be read at this precision. signal: a key of SIGNAL_NEEDS, or a precision.
export function observable(precision, signal) {
  const p = asPrecision(precision), need = SIGNAL_NEEDS[signal] || asPrecision(signal);
  return p != null && need != null && PRECISION_MS[p] <= PRECISION_MS[need];
}

// From the times alone (ms since the epoch): the coarsest unit on whose same point at least half
// the times, and at least MIN_INFER of them, fall. Genuine second-precise times almost never share
// a second of the minute; times worked out from rounded ages share one by construction. Fewer than
// MIN_INFER distinct times give null: unknown.
export function inferPrecision(times) {
  // Distinct times only: replies that share one time exactly say nothing about the unit.
  const ts = [...new Set(times.filter(Number.isFinite))];
  if (ts.length < MIN_INFER) return null;
  for (const p of ["day", "hour", "minute", "second"]) {
    const unit = PRECISION_MS[p], count = new Map();
    for (const t of ts) { const r = ((t % unit) + unit) % unit; count.set(r, (count.get(r) || 0) + 1); }
    const top = Math.max(...count.values());
    if (top >= MIN_INFER && top * 2 >= ts.length) return p;
  }
  return "exact";
}

// posts: [{ posted, timePrecision? }]; declared: the thread's timePrecision. Returns
// { precision, basis, timed }: the coarsest precision across the timed posts (null when unknown),
// and whether it was "declared", "inferred", "declared and inferred" or "unknown".
export function timePrecision(posts, declared) {
  const timed = (posts || []).filter((p) => p && Number.isFinite(Date.parse(p.posted)));
  const thread = asPrecision(declared);
  let precision = "exact", fromInput = false, fromTimes = false;
  const rest = [];
  for (const p of timed) {
    const own = asPrecision(p.timePrecision) || thread;
    if (own) { precision = coarser(precision, own); fromInput = true; } else rest.push(Date.parse(p.posted));
  }
  if (rest.length) { precision = coarser(precision, inferPrecision(rest)); fromTimes = true; }
  if (!timed.length) precision = null;
  const basis = precision == null ? "unknown" : fromInput && fromTimes ? "declared and inferred" : fromInput ? "declared" : "inferred";
  return { precision, basis, timed: timed.length };
}
