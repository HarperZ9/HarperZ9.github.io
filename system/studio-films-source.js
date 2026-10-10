// studio-films-source.js: the Films source (9 October 2026). The author's brief names "the Films
// and Worlds integrated as sources". Every film on the site plays on the Studio's stage:
//   - the five narrated explainers, with everything explainers.html gives them: captions, chapter
//     buttons, the recall questions and their spaced review, the transcript, the sources, and the
//     interactive version drawn live by raw-native where WebGPU answers;
//   - the seven One Step films (studio-films.js), poster first, nothing loaded until play.
// The explainers' sections are read from explainers.html once and their own modules (film.mjs,
// motion-film.mjs) run against them unchanged. The chosen film's video moves onto the stage; its
// section stays in the inspector. Nothing plays on its own.

import { FILMS, filmUrl, posterUrl, aboutNote } from "./studio-films.js?v=20261004-films";

const PAGE = "explainers.html?v=20261009-films-source";
const STYLES = ["system/explainer/explainer.css?v=20261003-explainers", "system/explainer/film.css?v=20261009-motion"];
const SCOPE = "#films-mount, #films-stage";

let built = null, loading = null, current = null, stageBox = null;

async function scopedSheet(href) {
  const r = await fetch(href, { credentials: "same-origin" });
  if (!r.ok) return null;
  const src = new CSSStyleSheet();
  try { src.replaceSync(await r.text()); } catch (_) { return null; }
  const out = [];
  const walk = (rules, wrap) => {
    for (const rule of rules) {
      if (rule.selectorText != null && rule.style) {
        const sel = rule.selectorText.split(",").map((s) => s.trim()).filter((s) => s && !/^(html|body|:root)\b/.test(s)).map((s) => `:is(${SCOPE}) ${s}`);
        if (sel.length) out.push(wrap(`${sel.join(", ")}{${rule.style.cssText}}`));
      } else if (rule.media && rule.cssRules) walk(rule.cssRules, (t) => wrap(`@media ${rule.media.mediaText}{${t}}`));
    }
  };
  walk(src.cssRules, (t) => t);
  const s = new CSSStyleSheet();
  try { s.replaceSync(out.join("\n")); } catch (_) { return null; }
  return s;
}

function button(label, cls, onClick, attrs = {}) {
  const b = document.createElement("button");
  b.type = "button"; b.className = cls; b.textContent = label;
  for (const [k, v] of Object.entries(attrs)) b.setAttribute(k, v);
  b.addEventListener("click", onClick);
  return b;
}

async function build(mount, stage) {
  const res = await fetch(PAGE, { credentials: "same-origin" });
  if (!res.ok) throw new Error("explainers.html answered " + res.status);
  const doc = new DOMParser().parseFromString(await res.text(), "text/html");
  const sheets = (await Promise.all(STYLES.map(scopedSheet))).filter(Boolean);
  if (sheets.length) document.adoptedStyleSheets = [...document.adoptedStyleSheets, ...sheets];

  stageBox = document.createElement("div");
  stageBox.id = "films-stage";
  stageBox.className = "studio-hub-preview films-stage";
  stageBox.hidden = true;
  stage.append(stageBox);

  const picker = document.createElement("div");
  picker.className = "films-picker";
  picker.setAttribute("role", "radiogroup");
  picker.setAttribute("aria-label", "Choose a film");
  const sections = document.createElement("div");
  sections.className = "films-sections";
  const transport = document.createElement("div");
  transport.className = "src-actions films-transport";
  transport.append(button("Play or pause", "btn", togglePlay, { id: "films-play", title: "Play or pause the film on the stage" }));
  mount.replaceChildren(transport, picker, sections);

  const items = [];
  const head = (t) => { const h = document.createElement("p"); h.className = "films-group"; h.textContent = t; picker.append(h); };

  head("Explainers, narrated");
  for (const sec of doc.querySelectorAll("section.mv")) {
    const fig = sec.querySelector("figure.film[data-film]");
    if (!fig) continue;
    const node = document.adoptNode(sec);
    node.hidden = true;
    sections.append(node);
    const title = (node.querySelector("h2") || {}).textContent || fig.dataset.film;
    const video = node.querySelector("figure.film video");
    const item = { id: fig.dataset.film, title, section: node, video, home: video && video.parentNode, next: video && video.nextSibling };
    item.btn = button(title, "chip films-pick", () => choose(item), { role: "radio", "aria-checked": "false", "data-film": item.id });
    picker.append(item.btn);
    items.push(item);
  }

  head("One Step films");
  for (const f of FILMS) {
    const v = document.createElement("video");
    v.controls = true; v.preload = "none"; v.playsInline = true;
    v.poster = posterUrl(f); v.src = filmUrl(f);
    v.setAttribute("aria-label", `${f.title}, ${f.length}`);
    const note = document.createElement("div");
    note.className = "films-note";
    note.hidden = true;
    const p = document.createElement("p"); p.className = "transform-note";
    p.append(Object.assign(document.createElement("b"), { textContent: f.title }), ` ${f.length}. ${f.note}`);
    note.append(p);
    const about = aboutNote(f);
    if (about) note.append(about);
    sections.append(note);
    const item = { id: f.id, title: f.title, section: note, video: v, home: null };
    item.btn = button(`${f.title} (${f.length})`, "chip films-pick", () => choose(item), { role: "radio", "aria-checked": "false", "data-film": f.id });
    picker.append(item.btn);
    items.push(item);
  }

  // The explainers' own modules, against the sections now in the document.
  await Promise.all([import("./explainer/film.mjs?v=20261004-films"), import("./explainer/motion-film.mjs?v=20261009-motion")]);
  // film.mjs adds each film's chapter list right after its video once its timing arrives. Wait for
  // that (up to 4 s) before any video moves to the stage, so the chapters stay in the inspector.
  const figs = items.filter((i) => i.home).map((i) => i.section.querySelector("figure.film"));
  for (let t = 0; t < 40 && figs.some((f) => f && !("ready" in f.dataset)); t++) await new Promise((r) => setTimeout(r, 100));
  // The interactive version mounts its player inside its box in the rail; it belongs on the stage.
  new MutationObserver((list) => {
    for (const m of list) for (const n of m.addedNodes) {
      if (n.nodeType === 1 && n.classList.contains("mf-stage") && current && current.section.contains(n)) {
        if (current.video) current.video.hidden = true;
        stageBox.append(n);
      }
    }
  }).observe(sections, { childList: true, subtree: true });
  return { items };
}

// Play or pause what is on the stage: the interactive version when it is open, else the video.
function togglePlay() {
  if (!current) return;
  const live = stageBox && stageBox.querySelector(".mf-stage:not([hidden])");
  const lb = live && live.querySelector('button[aria-label="Play"], button[aria-label="Pause"]');
  if (lb) { lb.click(); return; }
  const v = current.video;
  if (!v) return;
  if (v.paused) v.play().catch((e) => console.warn("[films] play refused:", e)); else v.pause();
}

// The readings and the PNG frame read the Studio's canvas, so the film's current frame is copied
// onto it (hidden behind the video) a few times a second while it plays and on every pause or seek.
// Only same-origin films can be read; the One Step films come from the release assets on another
// origin, so for them the canvas holds the poster's place and the readings say nothing new.
let lastCopy = 0;
function copyFrame(v, force) {
  if (!current || current.video !== v || !v.videoWidth) return;
  const now = performance.now();
  if (!force && now - lastCopy < 400) return;
  lastCopy = now;
  let same = false;
  try { same = new URL(v.currentSrc || v.src, location.href).origin === location.origin; } catch (_) {}
  if (!same) return;
  const c = document.getElementById("studio-canvas");
  if (!c) return;
  if (c.width !== v.videoWidth || c.height !== v.videoHeight) { c.width = v.videoWidth; c.height = v.videoHeight; }
  try { c.getContext("2d").drawImage(v, 0, 0, c.width, c.height); } catch (e) { return; }
  if (typeof window.__studioStartMeterLoop === "function") window.__studioStartMeterLoop();
}
function watchVideo(v) {
  if (!v || v.dataset.filmsWatched) return;
  v.dataset.filmsWatched = "1";
  for (const ev of ["loadeddata", "seeked", "pause"]) v.addEventListener(ev, () => copyFrame(v, true));
  v.addEventListener("timeupdate", () => copyFrame(v, false));
}

function choose(item) {
  if (!built) return;
  if (current === item) return;
  if (current) {
    if (current.video) { try { current.video.pause(); } catch (_) {} current.video.hidden = false; }
    for (const n of [...stageBox.children]) {
      if (n.classList.contains("mf-stage")) { n.hidden = true; current.section.querySelector("[data-motion-film]")?.append(n); }
      else if (current.home && n === current.video) current.home.insertBefore(n, current.next);
      else n.remove();
    }
    current.section.hidden = true;
    current.btn.setAttribute("aria-checked", "false");
    current.btn.classList.remove("active");
  }
  current = item;
  item.section.hidden = false;
  item.btn.setAttribute("aria-checked", "true");
  item.btn.classList.add("active");
  const live = item.section.querySelector(".mf-stage");
  if (live) { live.hidden = false; stageBox.append(live); if (item.video) item.video.hidden = true; }
  if (item.video) { stageBox.append(item.video); watchVideo(item.video); copyFrame(item.video, true); }
  document.dispatchEvent(new CustomEvent("films:chosen", { detail: { film: item.id } }));
}

/** Show the Films source: the picker in the inspector, the chosen film on the stage. */
export async function enterFilms({ mount, stage, film }) {
  if (!built) {
    if (!loading) loading = build(mount, stage).then((b) => { built = b; return b; }).finally(() => { loading = null; });
    await loading;
  }
  const canvas = document.getElementById("studio-canvas");
  if (canvas) canvas.hidden = true;
  stageBox.hidden = false;
  const want = built.items.find((i) => i.id === film) || current || built.items[0];
  choose(want);
}

/** Leave: pause whatever plays and give the stage back. */
export function leaveFilms() {
  if (!built) return;
  for (const i of built.items) if (i.video) { try { i.video.pause(); } catch (_) {} }
  for (const a of document.querySelectorAll("#films-stage audio, #films-stage video")) { try { a.pause(); } catch (_) {} }
  // The interactive player keeps its sound in an Audio element of its own; its Pause button stops it.
  for (const b of document.querySelectorAll('.mf-stage button[aria-label="Pause"]')) { try { b.click(); } catch (_) {} }
  stageBox.hidden = true;
  const canvas = document.getElementById("studio-canvas");
  if (canvas) canvas.hidden = false;
}

export const filmsState = () => (current ? { film: current.id } : null);
export function chooseFilm(id) { if (built) { const i = built.items.find((x) => x.id === id); if (i) choose(i); } }
export const filmsList = () => (built ? built.items.map((i) => i.id) : []);
