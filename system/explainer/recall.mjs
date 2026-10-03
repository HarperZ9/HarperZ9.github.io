// system/explainer/recall.mjs
// Recall checks after each step group of an explainer, run on Learn's browser entry.
//
// The items come from the explainer's recall.json (Learn's learn-items/1 format). The page shows
// each question's public form, so the keyed answer is never on screen before an attempt. A wrong
// choice gets Learn's diagnosis: the misconception that choice matches, never the answer. The
// reader can ask for the answer after two wrong tries.
//
// Spaced review lives in localStorage only, as a convenience for this reader: every read and
// write is wrapped, the page works without it, and nothing is sent anywhere. The first attempt
// at each question per visit is graded into Learn's FSRS schedule; later tries are practice.

import {
  newSessionWithFSRS, recordAttemptWithGrade, due, computeNextReview, validateItemSet, publicItem, diagnoseChoice,
} from "../vendor/learn/browser.mjs";

const KEY = (slug) => `explainer-recall/v1/${slug}`;
const DAY = 86400000;

function load(slug, set) {
  const fresh = () => newSessionWithFSRS({ topic: set.topic, objectives: set.items.map((i) => i.id) });
  try {
    const raw = localStorage.getItem(KEY(slug));
    if (!raw) return fresh();
    const s = JSON.parse(raw);
    return s && Array.isArray(s.attempts) && s.itemState ? s : fresh();
  } catch (_) { return fresh(); }
}
function save(slug, session) {
  session.attempts = session.attempts.slice(-60);
  try { localStorage.setItem(KEY(slug), JSON.stringify(session)); return true; } catch (_) { return false; }
}
function forget(slug) { try { localStorage.removeItem(KEY(slug)); } catch (_) { /* nothing stored */ } }

const el = (tag, attrs = {}, ...kids) => {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "text") n.textContent = v; else if (k === "class") n.className = v; else n.setAttribute(k, v);
  }
  for (const k of kids) if (k) n.append(k);
  return n;
};

function dueIds(session, now) {
  const seen = (id) => (session.itemState[id] || {}).reviewCount > 0;
  try { return due(session, { now, useFSRS: true }).map((d) => d.objective).filter(seen); } catch (_) { return []; }
}

function nextReviewText(session, ids, now) {
  const days = ids.map((id) => session.itemState[id]).filter((s) => s && s.reviewCount > 0)
    .map((s) => computeNextReview(s, { now }).daysUntilDue);
  if (!days.length) return "";
  const d = Math.max(1, Math.round(Math.min(...days)));
  return `Next review: in about ${d} day${d === 1 ? "" : "s"}, if you come back.`;
}

function renderItem(item, ctx) {
  const pub = publicItem(item);
  const name = `${ctx.slug}-${pub.id}`;
  const fs = el("fieldset", { class: "xl-q", "data-item": pub.id });
  fs.append(el("legend", { text: pub.prompt }));
  for (const c of pub.choices) {
    const id = `${name}-${c.id}`;
    fs.append(el("div", { class: "xl-choice" }, el("input", { type: "radio", name, id, value: c.id }), el("label", { for: id, text: c.text })));
  }
  const status = el("p", { class: "xl-feedback", role: "status" });
  const check = el("button", { type: "button", class: "xl-btn", text: "Check" });
  const reveal = el("button", { type: "button", class: "xl-btn xl-quiet", text: "Show the answer", hidden: "" });
  fs.append(el("div", { class: "xl-row" }, check, reveal), status);
  let wrong = 0, graded = false;
  check.addEventListener("click", () => {
    const picked = fs.querySelector("input:checked");
    const d = diagnoseChoice(item, picked ? picked.value : undefined);
    if (d.leaf === "missing.no_attempt") { status.textContent = "Pick a choice first."; return; }
    if (!graded) { graded = true; ctx.record(item, picked.value, d); }
    status.replaceChildren();
    if (d.correct) {
      fs.dataset.result = "right";
      status.append("Right. ", el("span", { class: "xl-src", text: `From the source: "${item.source.quote}"` }));
      reveal.hidden = true;
    } else {
      wrong += 1;
      fs.dataset.result = "wrong";
      status.append(d.note ? `Not this one. It matches a known misconception: ${d.note} ` : "Not this one. ", "Try another choice.");
      if (wrong >= 2) reveal.hidden = false;
    }
    ctx.changed();
  });
  reveal.addEventListener("click", () => {
    const key = item.choices.find((c) => c.id === item.answer);
    status.replaceChildren(`The answer: ${key.text}. `, el("span", { class: "xl-src", text: `From the source: "${item.source.quote}"` }));
    reveal.hidden = true;
  });
  return fs;
}

// mountRecall(host, set, { slug, steps, onContinue }) -> { groups, open(index), dueCount }
// steps: the step number (1-based) each scene key ends, for the group headings.
export function mountRecall(host, set, { slug, steps, onContinue }) {
  validateItemSet(set);
  const byId = new Map(set.items.map((i) => [i.id, i]));
  let session = load(slug, set);
  const firstTry = new Map();
  const groups = [];
  let from = 1;
  const summaries = [];
  const ctx = {
    slug,
    record(item, choice, d) {
      const now = Date.now();
      firstTry.set(item.id, d.correct);
      recordAttemptWithGrade(session, { objective: item.id, prompt: item.prompt, answer: choice, correct: d.correct,
        grade: d.correct ? 3 : 1, now, misconception: d.leaf || undefined });
      save(slug, session);
    },
    changed() { for (const fn of summaries) fn(); },
  };
  set.checks.forEach((check, gi) => {
    const to = steps[check.after];
    const id = `${slug}-check-${gi}`;
    const h = el("h3", { id, tabindex: "-1", text: `Recall check: steps ${from} to ${to}` });
    const sec = el("section", { class: "xl-check", "aria-labelledby": id, "data-after": check.after }, h,
      el("p", { class: "xl-hint", text: "Answer from memory first. A wrong choice is told which misconception it matches. After two wrong tries you can ask for the answer." }));
    for (const itemId of check.items) sec.append(renderItem(byId.get(itemId), ctx));
    const sum = el("p", { class: "xl-summary", role: "status" });
    const row = el("div", { class: "xl-row" });
    if (onContinue && gi < set.checks.length - 1) {
      const go = el("button", { type: "button", class: "xl-btn", text: "Continue the explainer" });
      go.addEventListener("click", () => onContinue(check.after));
      row.append(go);
    }
    sec.append(sum, row);
    summaries.push(() => {
      const tried = check.items.filter((i) => firstTry.has(i));
      if (!tried.length) { sum.textContent = ""; return; }
      const right = tried.filter((i) => firstTry.get(i)).length;
      sum.textContent = `First try: ${right} of ${tried.length} right. ${nextReviewText(session, check.items, Date.now())}`;
    });
    groups.push({ after: check.after, section: sec, heading: h });
    host.append(sec);
    from = to + 1;
  });

  const dueNow = dueIds(session, Date.now());
  const foot = el("p", { class: "xl-store" }, "Your answers and review dates stay in this browser and are never sent anywhere. ");
  const wipe = el("button", { type: "button", class: "xl-btn xl-quiet", text: "Forget my answers" });
  wipe.addEventListener("click", () => {
    forget(slug);
    session = load(slug, set);
    firstTry.clear();
    host.querySelectorAll(".xl-q").forEach((q) => { delete q.dataset.result; delete q.dataset.due; q.querySelector(".xl-feedback").textContent = ""; });
    ctx.changed();
    wipe.textContent = "Forgotten";
  });
  foot.append(wipe);
  host.append(foot);
  for (const idDue of dueNow) {
    const q = host.querySelector(`[data-item="${CSS.escape(idDue)}"]`);
    if (q) q.dataset.due = "";
  }
  return {
    groups,
    dueCount: dueNow.length,
    dueGroups: groups.filter((g) => dueNow.some((i) => set.checks.find((c) => c.after === g.after).items.includes(i))),
    open(index) { const g = groups[index]; if (g) { g.section.scrollIntoView({ block: "start" }); g.heading.focus({ preventScroll: true }); } },
  };
}

export const _test = { KEY, DAY };
