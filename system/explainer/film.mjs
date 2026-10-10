// system/explainer/film.mjs
// The player for the long explainer films on explainers.html. The page's <video> stays the
// player: this adds chapter buttons, pauses at the end of a chapter group the first time
// through to ask its recall questions, and keeps spaced review through recall.mjs (Learn's FSRS
// schedule, this browser's localStorage only). Without script the video, its captions, the
// transcript, the sources and every question's text stay readable in the page.

import { mountRecall } from "./recall.mjs";

const FILES = ["recall.json", "timing.json"];

async function own(folder, name) {
  if (!/^media\/explainers\/[a-z0-9-]+$/.test(folder) || !FILES.includes(name)) throw new Error("film: not a film file");
  const res = await fetch(`${folder}/${name}`, { credentials: "same-origin" });
  if (!res.ok) throw new Error(`${name}: ${res.status}`);
  return res.json();
}

const el = (tag, attrs = {}, text = "") => {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  if (text) n.textContent = text;
  return n;
};

const clock = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

// Segment starts from timing.json: the first sentence of each segment, the title at zero.
function chapters(timing, headings) {
  const starts = [];
  for (const row of timing) if (starts[row.segment] === undefined) starts[row.segment] = row.start;
  starts[0] = 0;
  return headings.map((h, i) => ({ ...h, start: starts[i] ?? 0, end: starts[i + 1] ?? Infinity }));
}

async function build(fig) {
  const folder = fig.dataset.folder, slug = fig.dataset.film;
  const video = fig.querySelector("video");
  const headings = [...fig.querySelectorAll("[data-chapter]")].map((n) => ({ key: n.dataset.chapter, heading: n.textContent.trim() }));
  const [recall, timing] = await Promise.all(FILES.map((f) => own(folder, f)));
  const chaps = chapters(timing, headings);

  const nav = el("ol", { class: "fl-chapters", "aria-label": "Chapters" });
  chaps.forEach((c, i) => {
    const b = el("button", { type: "button" }, `${clock(c.start)}  ${i === 0 ? "Title" : c.heading}`);
    b.addEventListener("click", () => { video.currentTime = c.start + 0.01; video.play().catch(() => {}); });
    const li = el("li");
    li.append(b);
    nav.append(li);
  });
  video.after(nav);
  const mark = () => {
    const t = video.currentTime;
    nav.querySelectorAll("button").forEach((b, i) => b.setAttribute("aria-current", t >= chaps[i].start && t < chaps[i].end ? "step" : "false"));
  };

  const host = fig.querySelector(".fl-recall");
  host.querySelectorAll("[data-static]").forEach((n) => n.remove()); // the no-script copy of the questions
  const steps = Object.fromEntries(chaps.map((c, i) => [c.key, i + 1]));
  const r = mountRecall(host, recall, { slug, steps, onContinue: () => { video.scrollIntoView({ block: "center" }); video.focus({ preventScroll: true }); video.play().catch(() => {}); } });
  const reached = new Set();
  const show = (gi) => { const g = r.groups[gi]; if (g) { g.section.hidden = false; reached.add(gi); } };
  r.groups.forEach((g) => { g.section.hidden = true; });
  const at = r.groups.map((g) => chaps[steps[g.after] - 1].end);
  const lead = el("p", { class: "fl-lead" }, "The questions open as you reach them in the film. ");
  const all = el("button", { type: "button", class: "xl-btn xl-quiet" }, "Show every question now");
  all.addEventListener("click", () => { r.groups.forEach((_, gi) => show(gi)); all.hidden = true; });
  lead.append(all);
  const head = host.querySelector("h3");
  if (head) head.after(lead); else host.prepend(lead);
  if (r.dueCount) {
    const due = el("p", { class: "xl-due", role: "status" }, `${r.dueCount} question${r.dueCount === 1 ? " is" : "s are"} due for review from an earlier visit. `);
    const go = el("button", { type: "button", class: "xl-btn" }, "Review them now");
    go.addEventListener("click", () => { r.dueGroups.forEach((g) => show(r.groups.indexOf(g))); r.open(r.groups.indexOf(r.dueGroups[0])); });
    due.append(go);
    host.prepend(due);
  }

  // The timed transcript and the source cards seek this film: a sentence, a chapter time or a
  // "Heard at" link moves the video there and plays. The sentence being spoken is marked.
  const section = fig.closest("section") || fig.parentElement;
  const seek = (t) => {
    video.currentTime = Math.max(0, t) + 0.01;
    video.scrollIntoView({ block: "center", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    video.play().catch(() => {});
  };
  section.addEventListener("click", (e) => {
    const hit = e.target.closest("[data-seek], .fl-s[data-t]");
    if (!hit || !section.contains(hit)) return;
    e.preventDefault();
    seek(parseFloat(hit.dataset.seek ?? hit.dataset.t));
  });
  const said = [...section.querySelectorAll(".fl-s[data-t]")].map((n) => ({ n, t: parseFloat(n.dataset.t) }));
  let now = null;
  const follow = () => {
    const t = video.currentTime;
    let cur = null;
    for (const s of said) { if (s.t <= t + 0.05) cur = s.n; else break; }
    if (cur !== now) { now?.classList.remove("is-now"); cur?.classList.add("is-now"); now = cur; }
  };

  let last = 0;
  video.addEventListener("timeupdate", () => {
    const t = video.currentTime;
    mark();
    follow();
    if (!video.seeking && t > last) {
      at.forEach((end, gi) => {
        const stop = Math.min(end, video.duration || end) - 0.25;
        if (last < stop && t >= stop && !reached.has(gi)) { video.pause(); show(gi); r.open(gi); }
      });
    }
    last = t;
  });
  video.addEventListener("ended", () => r.groups.forEach((_, gi) => show(gi)));
  fig.dataset.ready = "";
}

for (const fig of document.querySelectorAll("figure.film[data-film]")) {
  build(fig).catch((e) => console.error("[film] the player failed; the video, transcript and sources stay:", e));
}
