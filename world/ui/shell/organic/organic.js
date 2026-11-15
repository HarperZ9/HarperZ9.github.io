// shell/organic: standard UI patterns made of the site's materials. Every component is a native,
// accessible element underneath (button, a, dialog, input, hr); these files only grow its shape and
// keep it alive on the shared clock. Reduced motion and plain view show still material states.
//
// Material: data-material="<studio id>" on any ancestor (torn-paper, ink-brush, raked-concrete,
// light, chladni, rope, ...). The palettes below are a copy of the studio model's
// (studio/lib/materials.mjs); the model itself is fetched only for a material this copy lacks.
//
// This file is the hand: what every page runs before anyone touches it. It holds the menu toggle, the lamp and
// the material palettes, and decides which parts to fetch:
//   made.js        panel, rule, mark, switch, range, record, ripple and node grounds: on a page that holds one
//   band.js        the survey band: where its host is shown
//   menu.js        the menu's sand ground and lettered words: on the first opening of the menu
//   focus-film.js  thin-film focus rings: with the first focus ring the keyboard draws
//   palettes.js    the studio model: for a material the built-in copy lacks
// A page without the markup, and a visitor who never opens the menu or uses the keyboard, never download them.
//
// Components (attribute on a native element):
//   data-o="panel"     container cut from the material: torn edge, blotted ink, or settled sand
//   data-o="rule"      divider drawn as a rope or ink line, never a 1 px hairline
//   data-o="mark"      a living kicker mark grown from the material (only where one is needed)
//   data-o="switch"    <button role="switch"> drawn as an ink drop that rolls between two states
//   data-o="range"     <input type="range"> whose track is a torn strip and thumb an ink drop (CSS)
//   data-o="fold"      the menu toggle: a folded sheet that opens into the navigation dialog
//   data-o="lamp"      the theme control: a real light source that relights the scene
//   data-o="record"    the sound control: the live waveform of what plays, flat when silent
//   data-o="peel"      the plain-view control: the material corner peels back to plain paper
const root = document.documentElement;

const FALLBACK = {
  "torn-paper": { ground: "#d8cfba", ink: "#2a2620", accent: "#efe8d8" },
  "ink-brush": { ground: "#ede6d6", ink: "#14110d", accent: "#3f5f8a" },
  "raked-concrete": { ground: "#8d877c", ink: "#1d1b18", accent: "#d9cdb4" },
  light: { ground: "#07070b", ink: "#f3eee2", accent: "#7fd6e8" },
  chladni: { ground: "#141a2e", ink: "#e4dcc4", accent: "#a9b7d6" },
  rope: { ground: "#e4dccb", ink: "#3b2a1a", accent: "#b58a52" },
  engraving: { ground: "#efe8d8", ink: "#15130f", accent: "#8f3a19" },
};

// Palette into custom properties on each material region.
function paint(region, palettes) {
  const p = palettes[region.dataset.material];
  if (!p) return;
  region.style.setProperty("--m-ground", p.ground);
  region.style.setProperty("--m-ink", p.ink);
  region.style.setProperty("--m-accent", p.accent);
}

// The menu toggle: a sheet folded in thirds. Pressing opens the navigation dialog at once, as plain words on
// the material's ground; the menu's dressing (its sand ground and its lettered words, menu.js) is fetched on
// the first opening and laid over without moving anything.
function fold(btn) {
  const dlg = document.getElementById(btn.getAttribute("aria-controls"));
  if (!dlg || typeof dlg.showModal !== "function") return;
  btn.hidden = false;
  let dressed = false;
  const open = () => {
    dlg.showModal(); btn.setAttribute("aria-expanded", "true"); root.classList.add("o-menu-open");
    if (!dressed) {
      dressed = true;
      import("./menu.js").then((m) => m.dress(dlg)).catch((e) => { dressed = false; console.warn("organic: the menu's ground and lettering did not load; the menu stays as plain words", e); });
    }
  };
  const close = () => { dlg.close(); };
  dlg.addEventListener("close", () => { btn.setAttribute("aria-expanded", "false"); root.classList.remove("o-menu-open"); btn.focus(); });
  dlg.addEventListener("click", (e) => { if (e.target === dlg) close(); });
  btn.addEventListener("click", open);
  addEventListener("keydown", (e) => {
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName) || document.activeElement?.isContentEditable;
    if (typing || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === "m" && !dlg.open) { e.preventDefault(); open(); }
  });
}

// The lamp: the theme is the scene's light. The control is a small lit filament; toggling moves the
// lamp across the page (a light gradient on every room) and swaps ground and ink.
function lamp(btn) {
  const set = () => {
    const dark = root.dataset.theme ? root.dataset.theme === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
    btn.setAttribute("aria-pressed", String(!dark));
    btn.querySelector(".o-name").textContent = "Day"; // a toggle: pressed in daylight, its name says what it sets
    root.style.setProperty("--o-lamp-x", dark ? "18%" : "78%");
  };
  set();
  new MutationObserver(set).observe(root, { attributes: true, attributeFilter: ["data-theme"] });
}

const MADE = '[data-o="panel"], [data-o="rule"], [data-o="mark"], [data-o="record"], [data-o="switch"], input[type="range"][data-o="range"], [data-o="ripple"], [data-o-ripple], [data-o-node]';

export async function initOrganic() {
  const q = (sel) => [...document.querySelectorAll(sel)];
  const each = (sel, f) => q(sel).forEach((el) => { try { f(el); } catch (e) { console.warn("organic:", sel, e); } });
  const regions = q("[data-material]");
  regions.forEach((r) => paint(r, FALLBACK));
  each('[data-o="fold"]', fold);
  each('[data-o="lamp"]', lamp);
  const jobs = [];
  if (regions.some((r) => !FALLBACK[r.dataset.material])) jobs.push(import("./palettes.js").then((m) => m.studioPalettes()).then((P) => regions.forEach((r) => paint(r, { ...FALLBACK, ...P }))));
  if (q(MADE).length) jobs.push(import("./made.js").then((m) => m.initMade()));
  // the survey band is fetched only where its host is shown: a page that hides the band downloads neither its
  // code nor the universe it draws
  const bands = q('[data-o="band"]').filter((h) => getComputedStyle(h).display !== "none");
  if (bands.length) jobs.push(import("./band.js").then((m) => m.initBands(bands)));
  // thin-film focus rings arrive with the first ring the keyboard draws; until then, and for a pointer, the
  // ring is the same film's still colours from organic.css
  const ring = (e) => {
    if (!e.target.matches?.(":focus-visible")) return;
    document.removeEventListener("focusin", ring);
    import("./focus-film.js").then((m) => m.focusFilm()).catch((err) => console.warn("organic: thin-film focus rings did not load; the still colours stay", err));
  };
  document.addEventListener("focusin", ring);
  (await Promise.allSettled(jobs)).forEach((r) => r.status === "rejected" && console.warn("organic: a part did not load; the page stays as built", r.reason));
}
