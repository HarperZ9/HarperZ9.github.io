// Shared behaviours for the direction prototypes. Dependency-free.
//
// This file is what every page runs before anyone touches it: the theme, plain view, demo choices, the shared
// clock and the hand (organic/organic.js). Everything else is a part in its own file, fetched only
//   - on a page that holds its markup (plates.js, slots.js, lettering.js, negative.js, media.js), or
//   - on the first press of its control (sound.js, copy.js).
// A page without the markup, and a visitor who never presses, never download the part. Each import below names
// its file as a plain string so tools that follow references can find it.
import { initOrganic } from "./organic/organic.js";
// Every control here is a native button; every state it changes is visible without it.
const root = document.documentElement;
root.classList.add("js");
const reduced = matchMedia("(prefers-reduced-motion: reduce)");

const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* private mode: keep the session state only */ } },
};

// Theme: follows the system until the visitor picks; the pick is a per-viewer convenience.
function initTheme() {
  const saved = store.get("ui-theme");
  if (saved === "light" || saved === "dark") root.dataset.theme = saved;
  for (const b of document.querySelectorAll("[data-theme-toggle]")) {
    const label = () => {
      const dark = root.dataset.theme ? root.dataset.theme === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
      if (b.dataset.o === "lamp") return;  // the lamp names itself (organic.js)
      b.textContent = dark ? "Light" : "Dark";
      b.setAttribute("aria-label", dark ? "Switch to light" : "Switch to dark");
    };
    label();
    b.addEventListener("click", () => {
      const dark = root.dataset.theme ? root.dataset.theme === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
      root.dataset.theme = dark ? "light" : "dark";
      store.set("ui-theme", root.dataset.theme);
      label();
    });
  }
}

// Plain view: hides every [data-art] layer and all motion, for reading, printing or a slow phone.
function initPlain() {
  if (store.get("ui-plain") === "1") root.classList.add("plain");
  for (const b of document.querySelectorAll("[data-plain-toggle]")) {
    const sync = () => b.setAttribute("aria-pressed", String(root.classList.contains("plain")));
    sync();
    b.addEventListener("click", () => {
      root.classList.toggle("plain");
      store.set("ui-plain", root.classList.contains("plain") ? "1" : "0");
      sync();
    });
  }
}

// Demo choices: [data-demo] holds [data-choices] buttons with data-show and [data-state] panels.
function initChoices() {
  for (const demo of document.querySelectorAll("[data-demo]")) {
    const buttons = [...demo.querySelectorAll("[data-show]")];
    const states = [...demo.querySelectorAll("[data-state]")];
    const show = (n) => {
      buttons.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.show === n)));
      states.forEach((s) => { s.hidden = s.dataset.state !== n; });
      demo.dataset.current = n;
    };
    buttons.forEach((b) => b.addEventListener("click", () => show(b.dataset.show)));
    const first = buttons.find((b) => b.getAttribute("aria-pressed") === "true") || buttons[0];
    if (first) show(first.dataset.show);
  }
}

// A control whose code arrives with its first press. The button shows at once; the press that fetched the code
// is repeated once the part has wired the button, so the first press does what every later press does.
function onFirstPress(sel, load) {
  const all = [...document.querySelectorAll(sel)];
  const first = (e) => {
    const b = e.currentTarget;
    all.forEach((x) => x.removeEventListener("click", first));
    load().then((m) => { m.default(); b.click(); }).catch((err) => {
      console.warn("shell: the code for a control did not load; press again to retry", sel, err);
      all.forEach((x) => x.addEventListener("click", first));
    });
  };
  all.forEach((b) => { b.hidden = false; b.addEventListener("click", first); });
}

// Parts that draw at load, each fetched only where the page holds its markup.
function initParts() {
  const has = (sel) => document.querySelector(sel) !== null;
  const part = (name, run) => run().catch((e) => console.warn(`shell: ${name} did not load; the page stays as built`, e));
  if (has("img[data-halftone], [data-drift]")) part("plates", async () => (await import("./plates.js")).initPlates());
  if (has("[data-receipt]")) part("receipts", async () => (await import("./media.js")).initReceipts());
  // display slots hand their technique to the lettering, so the lettering follows the slots
  const slots = !!root.dataset.lettering || has("[data-display]");
  const letters = slots || has("[data-letter], [data-play-letter]"), negatives = has("[data-negative]");
  if (letters || negatives) part("lettering", async () => {
    const [s, l, n] = await Promise.all([slots && import("./slots.js"), letters && import("./lettering.js"), negatives && import("./negative.js")]);
    try { if (s) await s.initSlots(); } finally { if (l) l.initLettering(); if (n) n.initNegatives(); }
  });
}

// The shared clock. One rAF for every living thing on the page; it stops when the tab is hidden and
// never starts under reduced motion. The alive layer (alive) hooks in through
// UIShell.clock or replaces it with its own governed clock via UIShell.setClock(clock).
function makeClock() {
  const subs = new Set();
  let raf = 0;
  const tick = (ms) => { raf = 0; for (const f of subs) f(ms / 1000); if (subs.size && !document.hidden && !reduced.matches) raf = requestAnimationFrame(tick); };
  const wake = () => { if (!raf && subs.size && !document.hidden && !reduced.matches) raf = requestAnimationFrame(tick); };
  document.addEventListener("visibilitychange", wake);
  reduced.addEventListener("change", wake);
  return { subscribe(f) { subs.add(f); wake(); return () => subs.delete(f); }, get running() { return !!raf; } };
}
window.UIShell = Object.assign(window.UIShell || {}, {
  clock: makeClock(),
  setClock(c) { if (!c || typeof c.subscribe !== "function") throw new TypeError("UIShell.setClock needs { subscribe(fn) }"); this.clock = c; },
  livingSlots: () => [...document.querySelectorAll("[data-alive]")],
  // slots.js replaces this when it loads; a script that registers a renderer on a page with no slots brings it in
  registerLettering(fn) { import("./slots.js").then(() => window.UIShell.registerLettering(fn)).catch((e) => console.warn("shell: slots did not load", e)); },
});

initTheme();
initPlain();
initChoices();
onFirstPress("[data-copy]", () => import("./copy.js"));
onFirstPress("[data-sound]", () => import("./sound.js"));
initParts();
initOrganic().catch((e) => console.warn("organic: init failed", e));
requestAnimationFrame(() => root.classList.add("ready"));
