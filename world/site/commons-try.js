// SPDX-License-Identifier: AGPL-3.0-only
// commons-try.js: THE COMMONS on the visitor's own words and files, in this browser, with nothing sent.
// It calls the unmodified CMMNS core (vendor/cmmns/<version>/, AGPL-3.0-only; see vendor/cmmns/README.md) and shows
// each result with how it was reached: the rule's own wording, its source and what it does not show. Cues CMMNS
// reads but holds back, because their measured precision is below its ship line, are shown apart and say so.
// The core loads only when the visitor starts: a focus in the box, a press, or a chosen file.
const CORE = "/vendor/cmmns/3.9.1/src/core";
const SAMPLE = "Everyone knows the official numbers are fake. As an AI language model, I cannot verify this, but share it before they take it down.";
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

let core = null;
const load = () => (core ??= Promise.all([import(`${CORE}/api.js`), import(`${CORE}/persuasion.js`)])
  .then(([api, pers]) => ({ api, pers }))
  .catch((e) => { console.error("commons-try: the CMMNS core did not load", e); core = null; throw e; }));

// the text with each span marked: shown evidence as <mark>, held-back cues as a dotted underline
function marked(text, shown, held) {
  const cuts = [...shown.map((s) => ({ ...s, k: "shown" })), ...held.map((s) => ({ ...s, k: "held" }))]
    .filter((s) => s.end > s.start).sort((a, b) => a.start - b.start || b.end - a.end);
  let out = "", at = 0;
  for (const c of cuts) {
    if (c.start < at) continue;  // an overlap keeps the first span; the list below names every one
    out += esc(text.slice(at, c.start));
    out += c.k === "shown" ? `<mark class="ct-mark" data-n="${c.n}">${esc(text.slice(c.start, c.end))}</mark>` : `<span class="ct-held" data-n="${c.n}">${esc(text.slice(c.start, c.end))}</span>`;
    at = c.end;
  }
  return out + esc(text.slice(at));
}

function item(e, n) {
  const quotes = (e.spans || []).map((s) => `<q>${esc(s.text)}</q>`).join(" ");
  return `<li class="ct-item" id="ct-e${n}"><p class="ct-label"><span class="ct-n">${n}</span>${esc(e.label)}${e.level ? ` <span class="ct-level">${esc(e.level)}</span>` : ""}</p>
    <dl class="ct-how"><dt>What it shows</dt><dd>${esc(e.shows)}${quotes ? ` ${quotes}` : ""}</dd>
    <dt>How it was reached</dt><dd>${esc(e.source)}</dd>
    ${e.context ? `<dt>What it does not show</dt><dd>${esc(e.context)}</dd>` : ""}</dl></li>`;
}

async function readText(root) {
  const box = root.querySelector("#ct-text"), out = root.querySelector(".ct-out"), text = box.value.trim();
  if (!text) { out.innerHTML = `<p class="ct-empty">Paste or type some text first.</p>`; return; }
  out.setAttribute("aria-busy", "true");
  let C;
  try { C = await load(); } catch { out.innerHTML = `<p class="ct-empty">The checker did not load. Reload the page to try again.</p>`; out.removeAttribute("aria-busy"); return; }
  const env = C.api.analyzeText(text);
  const shown = env.evidence, held = C.pers.techniqueSpans(text);
  let n = 0;
  const shownSpans = shown.flatMap((e) => { n++; return (e.spans || []).map((s) => ({ start: s.start, end: s.end, n })); });
  const heldSpans = held.map((h, i) => ({ start: h.start, end: h.end, n: `c${i + 1}` }));
  const heldList = held.map((h, i) => {
    const st = C.pers.techniqueStatus(h.technique);
    return `<li class="ct-item ct-heldrow"><p class="ct-label"><span class="ct-n">c${i + 1}</span>${esc(h.technique.replace(/[-_]/g, " "))} <q>${esc(h.match)}</q></p>
      <dl class="ct-how"><dt>Why it is not shown as evidence</dt><dd>${esc(st.text)}</dd></dl></li>`;
  }).join("");
  out.innerHTML = `<div class="ct-read" aria-label="Your text, with what was found marked">${marked(text, shownSpans, heldSpans)}</div>
    <h3 class="ct-h">Evidence CMMNS shows <span class="ct-count">${shown.length}</span></h3>
    ${shown.length ? `<ol class="ct-list">${shown.map((e, i) => item(e, i + 1)).join("")}</ol>` : `<p class="ct-empty">Nothing in this text meets a rule CMMNS shows. That describes the wording only.</p>`}
    ${held.length ? `<h3 class="ct-h">Cues it reads and holds back <span class="ct-count">${held.length}</span></h3><p class="ct-note">These patterns matched, and CMMNS keeps them off its evidence because their measured precision is below its ship line.</p><ol class="ct-list">${heldList}</ol>` : ""}
    <p class="ct-limit">${esc((env.limits || []).join(" "))}</p>`;
  out.removeAttribute("aria-busy");
  out.classList.remove("ct-on"); void out.offsetWidth; out.classList.add("ct-on");
}

async function readFile(root, file) {
  const out = root.querySelector(".ct-file-out");
  if (!file) return;
  out.setAttribute("aria-busy", "true");
  let C;
  try { C = await load(); } catch { out.innerHTML = `<p class="ct-empty">The checker did not load. Reload the page to try again.</p>`; out.removeAttribute("aria-busy"); return; }
  const bytes = new Uint8Array(await file.arrayBuffer());
  let env;
  try { env = await C.api.checkMedia(bytes); } catch (e) { console.error("commons-try: checkMedia failed", e); out.innerHTML = `<p class="ct-empty">This file could not be read.</p>`; out.removeAttribute("aria-busy"); return; }
  const st = env.media?.state ?? "none";
  out.innerHTML = `<p class="ct-badge" data-state="${esc(st)}"><span class="ct-badge-dot" aria-hidden="true"></span><b>${esc(file.name)}</b>: ${esc(env.evidence[0]?.label ?? st)}${env.media?.ai ? ", with an AI-generation mark" : ""}</p>
    <ol class="ct-list">${env.evidence.map((e, i) => item(e, i + 1)).join("")}</ol>
    <p class="ct-limit">${esc((env.limits || []).join(" "))}</p>`;
  out.removeAttribute("aria-busy");
}

export function mount(root) {
  const box = root.querySelector("#ct-text"), file = root.querySelector("#ct-file");
  const warm = () => { load().catch(() => {}); };
  box.addEventListener("focus", warm, { once: true });
  root.querySelector(".ct-sample").addEventListener("click", () => { box.value = SAMPLE; readText(root); });
  root.querySelector(".ct-go").addEventListener("click", () => readText(root));
  box.addEventListener("keydown", (e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) readText(root); });
  file.addEventListener("change", () => readFile(root, file.files[0]));
  // a mark and its row point at each other: pressing a mark moves to the row that explains it
  root.querySelector(".ct-out").addEventListener("click", (e) => {
    const m = e.target.closest(".ct-mark"); if (!m) return;
    const row = root.querySelector(`#ct-e${m.dataset.n}`); if (row) { row.setAttribute("tabindex", "-1"); row.focus({ preventScroll: false }); }
  });
}
const host = document.querySelector("[data-commons-try]");
if (host) mount(host);
