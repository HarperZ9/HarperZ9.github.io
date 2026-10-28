// Shared behaviours for the direction prototypes. Dependency-free.
import { initLettering } from "./lettering.js";
import { initReceipts } from "./media.js";
import { initSlots } from "./slots.js";
import { initNegatives } from "./negative.js";
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

// Sound: off until pressed. A room tone, filtered noise under two low sines, faded in and out.
function initSound() {
  let ctx = null, out = null;
  const start = () => {
    ctx = new AudioContext();
    out = ctx.createGain();
    out.gain.value = 0;
    const analyser = ctx.createAnalyser(); analyser.fftSize = 512;
    out.connect(analyser); analyser.connect(ctx.destination);
    window.UIShell = Object.assign(window.UIShell || {}, { audio: { ctx, analyser } });
    const len = ctx.sampleRate * 2, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = last * 3.5; }
    const noise = ctx.createBufferSource(); noise.buffer = buf; noise.loop = true;
    const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 420;
    noise.connect(lp).connect(out); noise.start();
    for (const [f, g] of [[55, 0.05], [82.4, 0.025]]) {
      const o = ctx.createOscillator(), og = ctx.createGain();
      o.frequency.value = f; og.gain.value = g; o.connect(og).connect(out); o.start();
    }
    out.gain.linearRampToValueAtTime(0.5, ctx.currentTime + 0.6);
  };
  const stop = () => {
    if (!ctx) return;
    const c = ctx; out.gain.linearRampToValueAtTime(0, c.currentTime + 0.3);
    setTimeout(() => c.close().catch((e) => console.warn("sound: close failed", e)), 400);
    ctx = null;
    if (window.UIShell) window.UIShell.audio = null;
  };
  for (const b of document.querySelectorAll("[data-sound]")) {
    b.hidden = false;
    b.addEventListener("click", () => {
      const on = b.getAttribute("aria-pressed") !== "true";
      try { on ? start() : stop(); } catch (e) { console.warn("sound: Web Audio unavailable", e); return; }
      document.querySelectorAll("[data-sound]").forEach((x) => x.setAttribute("aria-pressed", String(on)));
      root.classList.toggle("sound-on", on);
    });
  }
}

// Drift: art layers move against the scroll at their own rate. Off under reduced motion.
function initDrift() {
  const layers = [...document.querySelectorAll("[data-drift]")];
  if (!layers.length) return;
  let ticking = false;
  const apply = () => {
    ticking = false;
    if (reduced.matches) { layers.forEach((l) => { l.style.transform = ""; }); return; }
    const y = scrollY;
    layers.forEach((l) => {
      const d = (y * Number(l.dataset.drift)).toFixed(1);
      l.style.transform = l.dataset.axis === "x" ? `translate3d(${d}px, -50%, 0)` : `translate3d(0, ${d}px, 0)`;
    });
  };
  addEventListener("scroll", () => { if (!ticking) { ticking = true; requestAnimationFrame(apply); } }, { passive: true });
  reduced.addEventListener("change", apply);
  apply();
}

// Halftone: an archival photograph re-screened as dots whose size follows the tone, drawn in
// the colour of its container. The <img> stays in the markup for no-JS and plain view.
function halftone(img) {
  const draw = () => {
    const box = img.parentElement, r = box.getBoundingClientRect();
    if (!r.width || !img.naturalWidth) return;
    const cell = Number(img.dataset.halftone) || 6, dpr = Math.min(devicePixelRatio || 1, 2);
    let c = box.querySelector("canvas.ht");
    if (!c) { c = document.createElement("canvas"); c.className = "ht"; c.setAttribute("aria-hidden", "true"); c.dataset.art = ""; box.appendChild(c); }
    c.width = Math.round(r.width * dpr); c.height = Math.round(r.height * dpr);
    const cols = Math.ceil(r.width / cell), rows = Math.ceil(r.height / cell);
    const s = document.createElement("canvas"); s.width = cols; s.height = rows;
    const sx = s.getContext("2d", { willReadFrequently: true });
    const k = Math.max(cols / img.naturalWidth, rows / img.naturalHeight);
    const w = img.naturalWidth * k, h = img.naturalHeight * k;
    // data-halftone-y picks the vertical focus (0 top, 1 bottom) when the plate is taller than its slab
    const fy = img.dataset.halftoneY !== undefined ? Number(img.dataset.halftoneY) : 0.5;
    sx.drawImage(img, (cols - w) / 2, (rows - h) * fy, w, h);
    const px = sx.getImageData(0, 0, cols, rows).data;
    const g = c.getContext("2d", { colorSpace: "display-p3" }) || c.getContext("2d"); g.scale(dpr, dpr);
    g.fillStyle = getComputedStyle(c).color;
    const invert = img.dataset.halftoneInvert !== undefined;
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      const i = (y * cols + x) * 4, lum = (0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2]) / 255;
      const t = invert ? lum : 1 - lum, rad = (cell / 2) * Math.sqrt(Math.min(1, t * 1.15));
      if (rad < 0.35) continue;
      g.beginPath(); g.arc(x * cell + cell / 2 + (y % 2 ? cell / 2 : 0), y * cell + cell / 2, rad, 0, 6.2832); g.fill();
    }
    box.classList.add("ht-on");
  };
  if (img.complete) draw(); else img.addEventListener("load", draw, { once: true });
  let t; addEventListener("resize", () => { clearTimeout(t); t = setTimeout(draw, 150); });
  new MutationObserver(() => setTimeout(draw, 30)).observe(root, { attributes: true, attributeFilter: ["data-theme"] });
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", draw);
}

// Copy buttons: [data-copy] copies the text of the element its value names.
function initCopy() {
  for (const b of document.querySelectorAll("[data-copy]")) {
    b.hidden = false;
    b.addEventListener("click", async () => {
      const src = document.getElementById(b.dataset.copy);
      try { await navigator.clipboard.writeText(src.textContent.trim()); b.textContent = "Copied"; }
      catch (e) { console.warn("copy: clipboard refused", e); b.textContent = "Select and copy"; }
      setTimeout(() => { b.textContent = "Copy"; }, 1600);
    });
  }
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
});

initTheme();
initCopy();
document.querySelectorAll("img[data-halftone]").forEach(halftone);
initPlain();
initChoices();
initSound();
initDrift();
initSlots().finally(() => { initLettering(); initNegatives(); });
initOrganic().catch((e) => console.warn("organic: init failed", e));
initReceipts();
requestAnimationFrame(() => root.classList.add("ready"));
