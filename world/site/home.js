// home.js: the places after the road. Each place leads with its motion, and each piece arrives and leaves by a
// transition that belongs to its medium: an iris for light, letters set one by one for type, tiles for mosaic, a
// spreading blot for ink. The transitions and their driver are Motion's, from The Playground (taken at a pinned
// commit by tools/raw_native_tree.py); this page only names one per place (site-src/world/bazaar.mjs) and binds it
// to the piece's passage through the viewport, so it moves with the hand and runs backwards on the way up.
// Reduced motion and Plain view: loops stay on their posters, every piece shows whole, nothing moves.
import "/world/site/hum.js";
import { Alive } from "/world/alive/alive.js";

// the alive layer starts once the first screen has settled (the page opts out of its auto start); on touch screens
// at the visitor's first touch or scroll (budget.js)
const startAlive = () => new Alive().start().then((a) => { window.Alive = a; document.dispatchEvent(new CustomEvent("alive:ready", { detail: a })); })
  .catch((e) => console.error("alive: start failed", e));
const idle = (fn) => () => ("requestIdleCallback" in window ? requestIdleCallback(fn, { timeout: 2000 }) : setTimeout(fn, 400));
const afterLoad = () => (window.__siteWhenVisited ? window.__siteWhenVisited(idle(startAlive)) : idle(startAlive)());
if (document.readyState === "complete") afterLoad(); else addEventListener("load", afterLoad, { once: true });

const root = document.documentElement, reducedQ = matchMedia("(prefers-reduced-motion: reduce)");
const still = () => reducedQ.matches || root.classList.contains("plain") || root.classList.contains("weak");
const dpr = () => Math.min(devicePixelRatio || 1, 2);
const places = [...document.querySelectorAll(".place")];

// ---- loops: play only while in view, never under reduced motion; the poster is the still ----
const loops = [...document.querySelectorAll("video[data-loop]")];
// a loop's poster and its file load only as it comes near; phones get the 640 px poster
const near = new IntersectionObserver((es) => { for (const e of es) if (e.isIntersecting) {
  const v = e.target; if (v.dataset.poster && !v.poster) v.poster = `${v.dataset.poster}-poster${innerWidth <= 860 ? "-640" : ""}.webp`;
  if (v.preload === "none" && !still()) { if (v.dataset.eager !== undefined && !loaded) return; v.preload = "auto"; }
} }, { rootMargin: "100% 0px" });
// the arrival's loop (data-eager) waits for the page to load and the main thread to idle: its poster is the first screen
let loaded = false;
const arrival = () => { loaded = true; for (const v of loops) if (v.dataset.eager !== undefined) { near.unobserve(v); near.observe(v); seen.unobserve(v); seen.observe(v); } };
const afterIdle = () => ("requestIdleCallback" in window ? requestIdleCallback(arrival, { timeout: 2500 }) : setTimeout(arrival, 600));
if (document.readyState === "complete") afterIdle(); else addEventListener("load", afterIdle, { once: true });
const seen = new IntersectionObserver((es) => {
  for (const e of es) {
    const v = e.target;
    if (e.isIntersecting && !still() && (loaded || v.dataset.eager === undefined)) v.play().catch((err) => { if (err.name !== "AbortError") console.info("loop stays on its poster:", err.message); });
    else v.pause();
  }
}, { threshold: 0.25 });
for (const v of loops) { near.observe(v); seen.observe(v); }
reducedQ.addEventListener("change", () => { if (still()) for (const v of loops) v.pause(); });

// the arrival opens on its small poster; wide screens swap in the full one once it has loaded
for (const v of document.querySelectorAll("video[data-poster-full]")) if (innerWidth > 860) { const i = new Image(); i.onload = () => { v.poster = v.dataset.posterFull; }; i.src = v.dataset.posterFull; }

// ---- past the road: the road's canvases step back once the places begin ----
const bazaar = document.querySelector(".bazaar");
if (bazaar) new IntersectionObserver(([e]) => document.body.classList.toggle("past-road", e.boundingClientRect.top < innerHeight * 0.5), { threshold: [0, 0.05, 0.2] }).observe(bazaar);

// ---- the walk: Motion's transitions, bound to each piece as the bazaar comes near ----
const MOTION = "/media/raw-native/pick-dc350a1/native/web/motion/";
const pieces = [...document.querySelectorAll("[data-walk]")];
let unbind = [];
async function bindWalk() {
  if (still() || unbind.length || matchMedia("(max-width: 860px), (hover: none)").matches) return;
  try {
    const [{ transitions, walk }, { bind }] = await Promise.all([import(`${MOTION}transitions.mjs`), import(`${MOTION}scroll.mjs`)]);
    for (const el of pieces) {
      const make = transitions[el.dataset.walk];
      if (!make) { console.warn("walk: no transition named", el.dataset.walk); continue; }
      unbind.push(bind(el, walk(make(JSON.parse(el.dataset.walkO || "{}")), { enter: [0.0, 0.24], exit: [0.78, 1.0] }), { subject: el.parentElement }));
    }
  } catch (err) { console.error("walk: the pieces stay whole", err); }
}
const stopWalk = () => { for (const u of unbind) u(); unbind = []; };
if (pieces.length && bazaar) {
  const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { io.disconnect(); bindWalk(); } }, { rootMargin: "200% 0px" });
  io.observe(bazaar);
  reducedQ.addEventListener("change", () => (still() ? stopWalk() : bindWalk()));
  new MutationObserver(() => (still() ? stopWalk() : 0)).observe(root, { attributes: true, attributeFilter: ["class"] });
}

// ---- the theme's waveform in the sound place ----
const wave = document.querySelector(".hum-wave");
function drawWave() {
  if (!wave) return; const r = wave.getBoundingClientRect(); if (r.bottom < 0 || r.top > innerHeight) return;
  const w = Math.round(r.width * dpr()), h = Math.round(r.height * dpr()); if (wave.width !== w || wave.height !== h) { wave.width = w; wave.height = h; }
  const x = wave.getContext("2d"), ink = getComputedStyle(root).getPropertyValue("--ink").trim() || "#16130f", a = window.SiteHum?.analyser;
  x.clearRect(0, 0, w, h); x.strokeStyle = ink; x.lineWidth = 1.5 * dpr(); x.beginPath();
  if (a && !still()) { const d = new Uint8Array(a.fftSize); a.getByteTimeDomainData(d); for (let i = 0; i < d.length; i++) { const X = (i / (d.length - 1)) * w, Y = h / 2 + ((d[i] - 128) / 128) * h * 0.42; i ? x.lineTo(X, Y) : x.moveTo(X, Y); } }
  else {   // at rest: two bars of the theme's beat, the first and third beats of each bar the strongest (half time)
    x.moveTo(0, h / 2);
    for (let i = 0; i < 8; i++) { const X = ((i + 0.5) / 8) * w, a = (i % 4 === 0 ? 0.34 : i % 4 === 2 ? 0.2 : 0.07) * h, u = dpr(); x.lineTo(X - 8 * u, h / 2); x.lineTo(X, h / 2 - a); x.lineTo(X + 3 * u, h / 2 + a * 0.55); x.lineTo(X + 12 * u, h / 2); }
    x.lineTo(w, h / 2);
  }
  x.stroke();
  // the line stops either side of the press, so the press's words never have the line behind them
  const b = wave.parentElement.querySelector(".hum-press")?.getBoundingClientRect();
  if (b) x.clearRect((b.left - r.left - 12) * dpr(), 0, (b.width + 24) * dpr(), h);
}

// the waveform redraws on the shared clock while the theme plays
function tick() { if (!document.hidden && window.SiteHum?.playing) drawWave(); }
const shared = window.UIShell?.clock;
if (shared) { shared.subscribe(tick); }
const loop = () => { if (!shared || shared.running === false) tick(); requestAnimationFrame(loop); };
requestAnimationFrame(loop);
if (wave) new IntersectionObserver(([e]) => { if (e.isIntersecting) drawWave(); }).observe(wave);
addEventListener("resize", drawWave);
