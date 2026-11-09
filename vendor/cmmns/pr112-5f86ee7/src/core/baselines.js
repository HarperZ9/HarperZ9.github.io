// What normal looks like for each coordination sign: how often the same sign showed up in
// ordinary threads, measured by scripts/baselines.mjs on the PHEME corpus of Twitter threads
// (CC BY 4.0) and kept in baselines-data.js. The window puts this line beside the observed count,
// so a reader can tell a sign that is rare in ordinary threads from one that turns up anyway.
// PHEME threads come from 2014 and 2015 news events on Twitter; they are a public research
// corpus, not a sample of today's X, and some of their accounts may themselves have coordinated.

import { BASELINES } from "./baselines-data.js";
import { TECHNIQUE_BASELINES } from "./techniques-data.js";
import { sizeBin, viewBin } from "./baselines-bins.js";

export const BASELINE_SOURCE = "Ordinary threads: the PHEME corpus of Twitter threads from 2014 and 2015 news events (CC BY 4.0), a public research corpus from an earlier X.";

const share = (x) => (x > 0 && x < 0.001 ? `${(x * 100).toFixed(2)}%` : x < 0.1 ? `${(x * 100).toFixed(1)}%` : `${Math.round(x * 100)}%`);
const range = (ci) => `${share(ci[0])} to ${share(ci[1])}`.replace(/% to/, " to");
const size = (b) => (b.max === Infinity || b.max == null ? `${b.min} or more replies` : `${b.min} to ${b.max} replies`);

// The measured rate for one sign: { k, n, share, ci, bin } or null when the thread falls outside
// every bin. ctx: { replies } for signs in one thread, { viewed } for signs across threads.
export function baselineFor(sign, ctx = {}) {
  const inThread = { "same-text": "same", burst: "burst", flood: "flood", "cross-language": "cross", swarm: "swarm" }[sign];
  const across = { together: "together", "copied-elsewhere": "echo" }[sign];
  const bin = inThread ? sizeBin(ctx.replies || 0) : across ? viewBin(ctx.viewed || 0) : null;
  const table = sign === "flood" || sign === "cross-language" || sign === "swarm" ? TECHNIQUE_BASELINES : BASELINES;
  const r = bin && table[inThread || across] && table[inThread || across][bin.id];
  return r && r.n ? { ...r, bin } : null;
}

const WHAT = {
  "same-text": ["a group of near-identical replies from different accounts", "threads"],
  burst: ["a burst of replies like this", "threads"],
  together: ["a pair of accounts seen together in two or more other threads", "threads"],
  "copied-elsewhere": ["wording that turned up in another thread", "replies of 8 words or more"],
  flood: ["a flood of replies from very high-rate accounts", "threads"],
  "cross-language": ["one link or upload carried by replies in different languages", "threads"],
  swarm: ["many new or flagged accounts replying within ten minutes", "threads"],
};

// One sentence for the window, or null: "In ordinary threads with 20 to 49 replies, ... showed up
// in 1.4% of threads (95% interval 0.9 to 2.2%, 1,384 threads)."
export function baselineLine(sign, ctx = {}) {
  const r = baselineFor(sign, ctx);
  if (!r) return null;
  const [what, unit] = WHAT[sign];
  const where = r.bin.w ? `For someone who opened about ${r.bin.w} threads on one news story` : `In ordinary threads with ${size(r.bin)}`;
  return `${where}, ${what} showed up in ${share(r.share)} of ${unit} (95% interval ${range(r.ci)}, ${r.n.toLocaleString("en")} ${unit.split(" ")[0]}).`;
}

// For the feed page's "seen together" table: the median number of pairs in three or more of the
// same threads, for someone who opened about as many threads on one news story.
export function pairsLine(viewed) {
  const bin = viewBin(viewed || 0), r = bin && BASELINES.pairs3 && BASELINES.pairs3[bin.id];
  if (!r || !r.draws) return null;
  return `In ordinary threads, someone who opened about ${bin.w} threads on one news story saw a median of ${r.median} such pair${r.median === 1 ? "" : "s"} (${r.draws} simulated readers). ${BASELINE_SOURCE}`;
}
