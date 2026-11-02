// The thread norm report: are the most extreme replies coming disproportionately from accounts
// with authenticity flags? It compares the flagged share among extreme replies with the flagged
// share among the other replies, each with a 95% Wilson interval. Replies whose account has not
// been looked up are left out of both groups and counted as coverage.
//
// What it does not prove: a skew can come from how the platform ranks replies, from which
// accounts the viewer happened to look up, or from real people who joined during the event.

import { score } from "./rhetoric.js";
import { isFlagged } from "./flags.js";
import { persuasion, shownTechniques, TECHNIQUES } from "./persuasion.js";

export const MIN_EXTREME = 10;   // below this, the report says "too few to compare"

export function wilson(k, n, z = 1.96) {
  if (!n) return [0, 0];
  const p = k / n, d = 1 + (z * z) / n, c = p + (z * z) / (2 * n), r = z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n));
  return [Math.max(0, (c - r) / d), Math.min(1, (c + r) / d)];
}

const pct = (x) => Math.round(x * 100);

// replies: [{ id, author, text, flags: [...] | null, extreme?, techniques? }]  (null = account not
// looked up). `extreme` and `techniques` may come precomputed from the content script's memo.
export function threadReport(replies, shown = shownTechniques()) {
  const known = [], unknown = [];
  for (const r of replies) (Array.isArray(r.flags) ? known : unknown).push(r);
  const isExtreme = (r) => (typeof r.extreme === "boolean" ? r.extreme : score(r.text).extreme);
  const rows = known.map((r) => ({ ...r, extreme: isExtreme(r), flagged: isFlagged(r.flags) }));
  const ext = rows.filter((r) => r.extreme), rest = rows.filter((r) => !r.extreme);
  const kE = ext.filter((r) => r.flagged).length, kR = rest.filter((r) => r.flagged).length;
  const out = {
    replies: replies.length,
    lookedUp: known.length,
    notLookedUp: unknown.length,
    extreme: { n: ext.length, flagged: kE, share: ext.length ? kE / ext.length : 0, ci: wilson(kE, ext.length) },
    others: { n: rest.length, flagged: kR, share: rest.length ? kR / rest.length : 0, ci: wilson(kR, rest.length) },
  };
  out.machine = { n: replies.filter((r) => r.machine).length };
  out.origins = origins(known);
  out.joinBurst = joinBurst(known);
  out.persuasion = persuasionShare(replies, shown);
  // For the feed dashboard: replies with strong rhetoric signs (the report's "extreme" score), over
  // every reply, and how many replies used each shown technique.
  out.strong = { n: rows.filter((r) => r.extreme).length + unknown.filter(isExtreme).length, of: replies.length };
  out.techniques = techniqueCounts(replies, shown);
  out.verdict = verdict(out);
  out.sentence = sentence(out);
  return out;
}

// Where the looked-up accounts are labelled as based, most common first: [{ place, n }].
export function origins(rows) {
  const counts = new Map();
  for (const r of rows) if (r.basedIn) counts.set(r.basedIn, (counts.get(r.basedIn) || 0) + 1);
  return [...counts].map(([place, n]) => ({ place, n })).sort((a, b) => b.n - a.n);
}

// The most accounts that joined within any 14-day window: { n, of, from, to }. Many accounts made
// in the same fortnight replying to one post is a coordination sign; it is also what a news event
// that brings new people to a platform looks like.
export function joinBurst(rows, windowDays = 14) {
  const t = [...new Set(rows.filter((r) => r.joinDate).map((r) => r.author + "|" + r.joinDate))]
    .map((k) => Date.parse(k.split("|")[1])).filter(Number.isFinite).sort((a, b) => a - b);
  let best = { n: 0, of: t.length, from: null, to: null };
  for (let i = 0, j = 0; j < t.length; j++) {
    while (t[j] - t[i] > windowDays * 86400000) i++;
    if (j - i + 1 > best.n) best = { n: j - i + 1, of: t.length, from: new Date(t[i]).toISOString().slice(0, 10), to: new Date(t[j]).toISOString().slice(0, 10) };
  }
  return best;
}

// "skewed" only when the two intervals do not overlap; the report never goes further than that.
function verdict(r) {
  if (r.extreme.n < MIN_EXTREME) return "too-few";
  if (r.extreme.ci[0] > r.others.ci[1]) return "skewed-to-flagged";
  if (r.extreme.ci[1] < r.others.ci[0]) return "skewed-away";
  return "no-clear-difference";
}

function sentence(r) {
  const e = r.extreme, o = r.others;
  const base = `${e.flagged} of ${e.n} extreme replies (${pct(e.share)}%) come from flagged accounts, against ${o.flagged} of ${o.n} other replies (${pct(o.share)}%).`;
  const cover = r.notLookedUp ? ` ${r.notLookedUp} repl${r.notLookedUp === 1 ? "y is" : "ies are"} left out until the account${r.notLookedUp === 1 ? " is" : "s are"} looked up.` : "";
  switch (r.verdict) {
    case "too-few": return `Too few extreme replies to compare (${e.n}; the report needs ${MIN_EXTREME}).${cover}`;
    case "skewed-to-flagged": return `${base} The difference is larger than the uncertainty.${cover}`;
    case "skewed-away": return `${base} Extreme replies come less often from flagged accounts here.${cover}`;
    default: return `${base} The difference is within the uncertainty.${cover}`;
  }
}

// A separate line for persuasion techniques: the share of looked-up replies using any shown
// technique, among flagged and among unflagged accounts. It never feeds "flagged" or the verdict.
// Returns null when no technique is shown.
export function persuasionShare(replies, shown = shownTechniques()) {
  if (!shown.length) return null;
  const known = replies.filter((r) => Array.isArray(r.flags));
  const group = (rs) => {
    const k = rs.filter((r) => persuasion(r.text, shown).length).length;
    return { n: rs.length, k, share: rs.length ? k / rs.length : 0, ci: wilson(k, rs.length) };
  };
  const flagged = group(known.filter((r) => isFlagged(r.flags))), unflagged = group(known.filter((r) => !isFlagged(r.flags)));
  const names = shown.map((t) => TECHNIQUES[t].name.toLowerCase()).join(" or ");
  const part = (g, who) => `${g.k} of ${g.n} from ${who} accounts${g.n ? ` (${pct(g.share)}%, 95% interval ${pct(g.ci[0])} to ${pct(g.ci[1])}%)` : ""}`;
  const sentence = `Replies using ${names}: ${part(flagged, "flagged")}, ${part(unflagged, "unflagged")}.`;
  return { techniques: shown, flagged, unflagged, notLookedUp: replies.length - known.length, sentence };
}

function techniqueCounts(replies, shown) {
  const out = {};
  if (!shown.length) return out;
  for (const r of replies) {
    const ids = Array.isArray(r.techniques) ? r.techniques.filter((t) => shown.includes(t)) : persuasion(r.text, shown).map((h) => h.technique);
    for (const t of new Set(ids)) out[t] = (out[t] || 0) + 1;
  }
  return out;
}

export const REPORT_DOES_NOT_PROVE = "A skew compares the thread as a whole, separate from any one reply or account. It can come from how the platform ranks replies, from which accounts were looked up, or from real people who joined during the event.";
