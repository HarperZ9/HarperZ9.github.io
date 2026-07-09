import { mountGenerativeField } from "./generative-field.js";

function setText(el, text) {
  if (el && el.textContent !== text) el.textContent = text;
}

function setHtml(el, html) {
  if (el && el.innerHTML !== html) el.innerHTML = html;
}

function setAttr(el, name, value) {
  if (el && el.getAttribute(name) !== value) el.setAttribute(name, value);
}

function wireDetailsMenu(doc, details, summary, listSelector, abortKey) {
  if (!details || !summary || details.dataset.enhanced === "true") return;

  details.dataset.enhanced = "true";
  summary.setAttribute("aria-expanded", String(details.open));

  if (doc[abortKey]) doc[abortKey].abort();
  const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
  const opts = controller ? { signal: controller.signal } : undefined;
  if (controller) doc[abortKey] = controller;

  const close = (returnFocus = false) => {
    if (!details.open) return;
    details.open = false;
    summary.setAttribute("aria-expanded", "false");
    if (returnFocus && typeof summary.focus === "function") summary.focus();
  };

  details.addEventListener("toggle", () => {
    summary.setAttribute("aria-expanded", String(details.open));
  }, opts);

  details.querySelectorAll(`${listSelector} a`).forEach((link) => {
    link.addEventListener("click", () => close(false), opts);
  });

  doc.addEventListener("click", (event) => {
    if (details.open && !details.contains(event.target)) close(false);
  }, opts);
  doc.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      close(true);
    }
  }, opts);
}

function upgradeHomeMenu(doc) {
  const nav = doc.querySelector(".topnav");
  if (!nav || nav.querySelector(".home-menu")) return;

  const sourceLinks = [...nav.querySelectorAll(".topnav-links a")];
  if (!sourceLinks.length) return;

  const details = doc.createElement("details");
  details.className = "home-menu";

  const summary = doc.createElement("summary");
  summary.textContent = "Menu";
  summary.setAttribute("aria-label", "Open site menu");
  details.appendChild(summary);

  const list = doc.createElement("div");
  list.className = "home-menu-list";
  list.setAttribute("aria-label", "Site sections");
  sourceLinks.forEach((link) => {
    const clone = link.cloneNode(true);
    clone.removeAttribute("class");
    list.appendChild(clone);
  });
  details.appendChild(list);
  nav.appendChild(details);

  wireDetailsMenu(doc, details, summary, ".home-menu-list", "__homeMenuAbort");
}

function normalizeHomeFormFields(doc) {
  doc.querySelectorAll("input, select, textarea").forEach((field, index) => {
    if (field.dataset.homeFieldNormalized === "true") return;
    const base = `home-field-${index + 1}`;
    const label = field.closest("label");
    const labelText = label ? label.textContent.trim().replace(/\s+/g, " ") : "";
    const fallback = field.getAttribute("aria-label") || field.getAttribute("placeholder") || labelText || base;
    if (!field.id) field.id = base;
    if (!field.name) field.name = base;
    if (!field.getAttribute("aria-label")) field.setAttribute("aria-label", fallback.slice(0, 96));
    field.dataset.homeFieldNormalized = "true";
  });
}

function repairHeroReadout(readout) {
  if (!readout) return;
  const label = readout.querySelector(".ro-label");
  const verdicts = readout.querySelector(".ro-verdicts");
  const nextMoves = [
    ["run a live demo", "#demonstrate"],
    ["inspect an engine", "#engines"],
    ["read a paper", "#research"],
    ["start a work thread", "#work"],
  ];

  setText(label, "Common first moves");
  setHtml(verdicts, nextMoves.map(([text, href], index) => (
    `<a class="ro-chip ro-route ro-${index}" href="${href}">${text}</a>`
  )).join(""));
  setAttr(readout, "aria-label", "Common first moves through Project Telos");
}

function removeResearchLaneReadout(doc) {
  const laneReadout = doc.querySelector('.readout[aria-label="public lanes"]');
  if (laneReadout) laneReadout.remove();
}

function repairSectionKickers(doc) {
  const replacements = new Map([
    ["ENGINE ROOM", "Engine room"],
    ["LIVE DEMOS", "Live demos"],
    ["WHERE TO ENTER", "Where to enter"],
    ["RESEARCH", "Research"],
    ["THE RANGE", "Range"],
    ["WORK WITH ME", "Work with me"],
  ]);

  doc.querySelectorAll(".sec-head .kicker, .work-head .kicker").forEach((kicker) => {
    const text = kicker.textContent.trim();
    if (replacements.has(text)) setText(kicker, replacements.get(text));
  });
}

function repairHeroCopy(doc) {
  const kicker = doc.querySelector(".hero .kicker");
  const title = doc.querySelector(".hero-title");
  const lead = doc.querySelector(".hero .lead");
  const readout = doc.querySelector(".hero .readout");
  const note = doc.querySelector(".hero-note");

  setText(kicker, "Zain Dana Harper / Project Telos");

  setHtml(title, "Tools for local AI,<br>codebases,<br><span class=\"hl\">graphics, and research.</span>");

  setHtml(lead, "Project Telos is my public workshop: local-model workflows, codebase maps, compiler tools, graphics systems, generated media, and research infrastructure. <b>Open a demo, inspect an engine, or start a project.</b>");

  repairHeroReadout(readout);
  removeResearchLaneReadout(doc);
  repairSectionKickers(doc);
  upgradeHomeMenu(doc);
  normalizeHomeFormFields(doc);

  setText(note, "The field is live, but the text comes first. Motion reduces automatically when requested.");
}

function keepHeroCopySettled(doc) {
  repairHeroCopy(doc);
  [80, 240, 700, 1600].forEach((delay) => {
    window.setTimeout(() => repairHeroCopy(doc), delay);
  });

  const root = doc.getElementById("root");
  if (!root || typeof MutationObserver === "undefined") return;
  const observer = new MutationObserver(() => repairHeroCopy(doc));
  observer.observe(root, { childList: true, subtree: true });
  window.setTimeout(() => observer.disconnect(), 3000);
}

function placeFieldInHero(doc) {
  const hero = doc.querySelector(".hero");
  const scene = doc.getElementById("gl");
  const motes = doc.getElementById("motes");
  if (!hero || !scene || scene.closest(".hero")) return;

  const anchor = hero.querySelector(".hero-glow") || hero.firstChild;
  scene.classList.add("home-fluid-canvas");
  hero.insertBefore(scene, anchor);
  if (motes) {
    motes.classList.add("home-fluid-motes");
    hero.insertBefore(motes, anchor);
  }
}

function bootHomeArt() {
  if (!document.body) return;
  document.body.classList.add("home-generative-field");
  document.documentElement.classList.add("home-generative-field-ready");
  keepHeroCopySettled(document);
  mountGenerativeField(document).catch(() => {
    document.documentElement.classList.add("generative-field-failed");
  }).then(() => {
    keepHeroCopySettled(document);
    placeFieldInHero(document);
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootHomeArt, { once: true });
} else {
  bootHomeArt();
}
