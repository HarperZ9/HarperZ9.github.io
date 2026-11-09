// The swarming sign (project-docs/TECHNIQUES.md, technique 7; DISARM T0049.005 Conduct Swarming and
// T0048 Harass). Rauch describes trolling as a pile-on that manufactures a crowd. In one thread CMMNS
// can see one trace of it: many new or flagged accounts converging on one post within minutes.
// The sign is about the thread, never about an account: it carries counts only, no handles, so it
// cannot become a list to pile on in turn (DESIGN-MAP R12). Thresholds were set on the dev half of
// PHEME and read once on the test half (scripts/techniques-baselines.mjs).
// A ten-minute window needs times to the minute (precision.js); coarser times return null.

import { timePrecision, observable } from "./precision.js";

export const SWARM_WINDOW_SEC = 600, SWARM_MIN = 6, SWARM_SHARE = 0.5, SWARM_MIN_KNOWN = 8;
export const SWARM_DOES_NOT_PROVE = "This describes how the replies arrived. A breaking story, a celebrity post or a link shared in a group chat draws many new accounts at once on its own.";

// rows: [{ author, posted, timePrecision? }] replying to one post; markOf(handle, postedMs) -> { new, flagged } or
// null when CMMNS has not read the account. precision: the thread's timePrecision. Returns null or
// { from, to, accounts, known, marked, newAccounts, flagged, windowSec } for the densest window.
export function swarmSign(rows, markOf, { windowSec = SWARM_WINDOW_SEC, precision } = {}) {
  if (!observable(timePrecision(rows, precision).precision, "swarming")) return null;
  const xs = (rows || []).map((r) => ({ a: String(r.author || "").toLowerCase(), t: Date.parse(r.posted) })).filter((r) => r.a && Number.isFinite(r.t)).sort((p, q) => p.t - q.t);
  let best = null;
  for (let i = 0, j = 0; i < xs.length; i++) {
    while (xs[i].t - xs[j].t > windowSec * 1000) j++;
    const w = windowStats(xs.slice(j, i + 1), markOf);
    if (w.known < SWARM_MIN_KNOWN || w.marked < SWARM_MIN || w.marked / w.known < SWARM_SHARE) continue;
    if (!best || w.marked > best.marked) best = { from: new Date(xs[j].t).toISOString(), to: new Date(xs[i].t).toISOString(), ...w, windowSec };
  }
  return best;
}

function windowStats(win, markOf) {
  const seen = new Map();
  for (const r of win) if (!seen.has(r.a)) seen.set(r.a, markOf(r.a, r.t));
  let known = 0, marked = 0, fresh = 0, flagged = 0;
  for (const m of seen.values()) {
    if (!m) continue;
    known++;
    if (m.new || m.flagged) marked++;
    if (m.new) fresh++;
    if (m.flagged) flagged++;
  }
  return { accounts: seen.size, known, marked, newAccounts: fresh, flagged };
}
