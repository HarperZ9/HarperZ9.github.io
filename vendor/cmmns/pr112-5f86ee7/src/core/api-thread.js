// Thread-level evidence: the thread norm report, near-identical replies, timing bursts, swarming
// and account flags. Items refer to posts by id and never name an account, so an export of them
// cannot become a list of people. Pure: no DOM, no network.

import { threadReport, REPORT_DOES_NOT_PROVE } from "./report.js";
import { duplicateClusters } from "./similarity.js";
import { burstCheck, MIN_ACCOUNTS } from "./timing.js";
import { swarmSign, SWARM_DOES_NOT_PROVE } from "./swarming.js";
import { timePrecision, observable, SIGNAL_NEEDS, PRECISION_WORDS, NOT_OBSERVABLE } from "./precision.js";
import { flagsFor, isFlagged, ageDays, DOES_NOT_PROVE, NEW_ACCOUNT_DAYS } from "./flags.js";
import { baselineLine } from "./baselines.js";
import { FLAG_LABEL, SRC_POSTS, SRC_ACCOUNTS, BURST_DOES_NOT_PROVE, COARSE_DOES_NOT_PROVE } from "./api-words.js";

const thread = (kind, level, label, shows, source, context, posts, data = {}) =>
  ({ kind, scope: "thread", level, label, shows, source, context, posts, spans: [], data });
const withBase = (text, sign, replies) => { const b = baselineLine(sign, { replies }); return b ? `${text} ${b}` : text; };

// Flags for one reply: the input's own list (ids or { id, evidence }), or CMMNS' rules over the
// account details given, or null when neither was given (the account was not read).
export function flagsOf(reply, now) {
  if (Array.isArray(reply.flags)) return reply.flags.map((f) => (typeof f === "string" ? { id: f } : f)).filter((f) => f && f.id);
  if (reply.account && typeof reply.account === "object") return flagsFor(reply.account, { now });
  return null;
}

function flagItems(replies, now) {
  const byKey = new Map();
  for (const r of replies) {
    for (const f of r.flags || []) {
      const key = f.id + "|" + String(r.author).toLowerCase() + "|" + (f.evidence || "");
      const e = byKey.get(key) || { f, posts: [] };
      e.posts.push(r.id);
      byKey.set(key, e);
    }
  }
  return [...byKey.values()].map(({ f, posts }) => ({
    kind: "account-flag", scope: "post", level: f.id === "based-elsewhere" ? "warn" : "flag", label: FLAG_LABEL[f.id] || f.id,
    shows: f.evidence ? `The account behind ${posts.length === 1 ? "this post" : "these posts"}: ${f.evidence}.` : `The input marks the account behind ${posts.length === 1 ? "this post" : "these posts"} with this flag.`,
    source: SRC_ACCOUNTS, context: DOES_NOT_PROVE[f.id] || f.doesNotProve || "A flag is a sign to look at.",
    posts, spans: [], data: { flag: f.id, asOf: new Date(now).toISOString().slice(0, 10) },
  }));
}

function reportItem(replies, R) {
  const ci = (c) => c.map((x) => Math.round(x * 1000) / 1000);
  return thread("thread-report", R.verdict === "skewed-to-flagged" ? "flag" : "info", "thread report", R.sentence,
    `${SRC_POSTS} ${SRC_ACCOUNTS}`, REPORT_DOES_NOT_PROVE, replies.map((r) => r.id), {
      replies: R.replies, accountsRead: R.lookedUp, notRead: R.notLookedUp, verdict: R.verdict,
      extreme: { n: R.extreme.n, flagged: R.extreme.flagged, ci: ci(R.extreme.ci) },
      others: { n: R.others.n, flagged: R.others.flagged, ci: ci(R.others.ci) }, machineSigns: R.machine.n,
    });
}

function burstItems(replies, precision) {
  const check = burstCheck(replies, { precision });
  return check.bursts.map((b) => {
    const who = new Set(b.authors), from = Date.parse(b.from), to = Date.parse(b.to);
    const posts = replies.filter((r) => who.has(String(r.author).toLowerCase()) && Date.parse(r.posted) >= from && Date.parse(r.posted) <= to).map((r) => r.id);
    const secs = Math.max(1, Math.round((to - from) / 1000));
    return thread("timing-burst", "flag", `timing burst, ${b.authors.length} accounts`,
      withBase(`${b.authors.length} accounts replied within ${secs} s at ${b.from.slice(11, 16)} UTC. Chance at this thread's pace: p ${b.p < 1e-6 ? "< 0.000001" : "= " + b.p.toPrecision(2)}.`, "burst", replies.length),
      SRC_POSTS, BURST_DOES_NOT_PROVE, posts, { from: b.from, to: b.to, accounts: b.authors.length, p: b.p, timePrecision: check.precision });
  });
}

// One item naming the timing signals the post times are too coarse for. They report this instead of
// firing: rounded times put replies on the same second by construction (precision.js).
const SIGNAL_NAME = { "timing-burst": "Timing bursts", swarming: "Swarming" };
const BASIS = {
  declared: "The input, or the platform format it was read from, gives this precision.",
  inferred: (p) => `CMMNS inferred this from the times: most of them fall on the same point of the ${p === "day" ? "day" : p === "hour" ? "hour" : "minute"}, as times worked out from rounded ages such as "14h" do.`,
  "declared and inferred": "The input gives the precision for some posts; for the rest CMMNS inferred it from the times.",
  unknown: "Too few posts carry a time to tell how precise the times are.",
};
function coarseItem(replies, root, P) {
  const timed = replies.filter((r) => Number.isFinite(Date.parse(r.posted)));
  const off = [];
  if (timed.length >= MIN_ACCOUNTS + 2 && !observable(P.precision, "timing-burst")) off.push("timing-burst");
  if (root && timed.length >= MIN_ACCOUNTS && !observable(P.precision, "swarming")) off.push("swarming");
  if (!off.length) return [];
  const needs = off.map((k) => `${SIGNAL_NAME[k].toLowerCase()} need${k === "swarming" ? "s" : ""} times ${PRECISION_WORDS[SIGNAL_NEEDS[k]]}`);
  const given = P.precision ? `given ${PRECISION_WORDS[P.precision]}` : "of unknown precision";
  const names = off.map((k, i) => (i ? SIGNAL_NAME[k].toLowerCase() : SIGNAL_NAME[k])).join(" and ");
  const basis = typeof BASIS[P.basis] === "function" ? BASIS[P.basis](P.precision) : BASIS[P.basis];
  return [thread("timing-not-observable", "info", "timing " + NOT_OBSERVABLE,
    `${names} ${off.length > 1 || off[0] === "timing-burst" ? "are" : "is"} ${NOT_OBSERVABLE}. The post times are ${given}, and ${needs.join("; ")}. ${basis}`,
    SRC_POSTS, COARSE_DOES_NOT_PROVE, timed.map((r) => r.id), { signals: off, timePrecision: P.precision, basis: P.basis, needs: Object.fromEntries(off.map((k) => [k, SIGNAL_NEEDS[k]])) })];
}

function sameTextItems(replies, root) {
  return duplicateClusters(replies, { root }).map((c) => thread("same-text", "flag", `near-identical replies, ${c.authors.length} accounts`,
    withBase(`${c.ids.length} replies from ${c.authors.length} different accounts share most of their wording (similarity at least ${c.similarity}).`, "same-text", replies.length),
    SRC_POSTS, DOES_NOT_PROVE["same-text"], c.ids.map(String), { posts: c.ids.length, accounts: c.authors.length, similarity: c.similarity }));
}

function swarmItem(replies, now, precision) {
  const by = new Map(replies.map((r) => [String(r.author).toLowerCase(), r]));
  const markOf = (a, t) => {
    const r = by.get(a);
    if (!r || !Array.isArray(r.flags)) return null;
    const age = r.account && r.account.joinDate ? ageDays(r.account.joinDate, t || now) : null;
    return { new: age != null && age < NEW_ACCOUNT_DAYS, flagged: isFlagged(r.flags) };
  };
  const w = swarmSign(replies, markOf, { precision });
  if (!w) return [];
  const from = Date.parse(w.from), to = Date.parse(w.to);
  const posts = replies.filter((r) => { const t = Date.parse(r.posted); return t >= from && t <= to; }).map((r) => r.id);
  return [thread("swarming", "flag", "swarming", withBase(`${w.marked} of ${w.known} accounts read in a ${Math.round(w.windowSec / 60)}-minute window from ${w.from.slice(11, 16)} UTC were new or flagged (${w.newAccounts} new, ${w.flagged} flagged), all replying to one post.`, "swarm", replies.length),
    `${SRC_POSTS} ${SRC_ACCOUNTS}`, SWARM_DOES_NOT_PROVE, posts, { from: w.from, to: w.to, known: w.known, marked: w.marked, newAccounts: w.newAccounts, flagged: w.flagged })];
}

// replies: normalised [{ id, author, text, posted, timePrecision, flags, extreme, machine }]. root: { text } or
// null. timePrecision: the thread's declared precision (precision.js), or undefined to infer it.
export function threadItems(replies, root, { now = Date.now(), timePrecision: declared } = {}) {
  const accounts = new Set(replies.map((r) => String(r.author).toLowerCase())).size;
  const R = threadReport(replies);
  // One account (a data export, or a thread with one replier) has nothing to compare.
  const out = [...(accounts >= 2 ? [reportItem(replies, R)] : []), ...flagItems(replies, now)];
  const P = timePrecision(replies, declared);
  if (accounts >= 2) out.push(...sameTextItems(replies, root), ...burstItems(replies, declared));
  if (root && accounts >= 2) out.push(...swarmItem(replies, now, declared));
  if (accounts >= 2) out.push(...coarseItem(replies, root, P));
  return { items: out, report: R, accounts, timePrecision: { value: P.precision, basis: P.basis } };
}
