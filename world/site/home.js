// home.js: the places after the road. Each place leads with its motion; crossing from one place to the next
// carries the leaving element across the page's water to the next one (universe lib/carry.js), and the stills
// uncover through the stop grammar's mosaic (universe lib/stop.mjs, lib/path-render.js). Distance is the clock;
// when the theme plays, a reveal step waits for its next sixteenth note (hum.js).
// Reduced motion and Plain view: loops stay on their posters, stills show whole, nothing crosses.
import { carrier, flowFrom } from "/world/universe/lib/carry.js";
import { grammar } from "/world/universe/lib/stop.mjs";
import { mosaicSource, drawMosaic } from "/world/universe/lib/path-render.js";
import "/world/site/hum.js";

const root = document.documentElement, reducedQ = matchMedia("(prefers-reduced-motion: reduce)");
const still = () => reducedQ.matches || root.classList.contains("plain") || root.classList.contains("weak");
const dpr = () => Math.min(devicePixelRatio || 1, 2);
const places = [...document.querySelectorAll(".place")];

// ---- loops: play only while in view, never under reduced motion; the poster is the still ----
const loops = [...document.querySelectorAll("video[data-loop]")];
const near = new IntersectionObserver((es) => { for (const e of es) if (e.isIntersecting && e.target.preload === "none") e.target.preload = "auto"; }, { rootMargin: "100% 0px" });
const seen = new IntersectionObserver((es) => {
  for (const e of es) {
    const v = e.target;
    if (e.isIntersecting && !still()) v.play().catch((err) => { if (err.name !== "AbortError") console.info("loop stays on its poster:", err.message); });
    else v.pause();
  }
}, { threshold: 0.25 });
for (const v of loops) { near.observe(v); seen.observe(v); }
reducedQ.addEventListener("change", () => { if (still()) for (const v of loops) v.pause(); });

// ---- past the road: the road's canvases step back once the places begin ----
const bazaar = document.querySelector(".bazaar");
if (bazaar) new IntersectionObserver(([e]) => document.body.classList.toggle("past-road", e.boundingClientRect.top < innerHeight * 0.5), { threshold: [0, 0.05, 0.2] }).observe(bazaar);

// ---- stills uncover through the mosaic as the visitor arrives ----
function uncover(img) {
  if (still()) return;
  const box = img.parentElement, c = document.createElement("canvas"); c.className = "uncover"; c.setAttribute("aria-hidden", "true"); box.append(c);
  const W = 480, H = Math.round(480 * img.height / img.width), o = new OffscreenCanvas(W, H);
  let src = null, shown = -1;
  const ready = () => { try { src = mosaicSource(img, W, H); } catch (e) { console.warn("uncover: no mosaic, the still shows whole", e); c.remove(); } };
  img.complete && img.naturalWidth ? ready() : img.addEventListener("load", ready, { once: true });
  return () => {
    if (!src) return;
    const r = box.getBoundingClientRect(), a = Math.min(1, Math.max(0, (innerHeight - r.top) / (innerHeight * 0.75)));
    const g = grammar(a, { steps: 6 });
    if (g.approach === shown) return; shown = g.approach;
    window.SiteHum.onGrid(() => {
      if (g.settled) { c.style.opacity = "0"; return; }
      c.style.opacity = "1"; c.width = W; c.height = H;
      drawMosaic(o.getContext("2d"), src, g, { w: W, h: H, ground: getComputedStyle(root).getPropertyValue("--wall").trim() || "#e8e3d9", seed: 5 });
      const x = c.getContext("2d"); x.imageSmoothingEnabled = false; x.drawImage(o, 0, 0);
    });
  };
}
const uncovers = [...document.querySelectorAll("img[data-uncover]")].map(uncover).filter(Boolean);

// ---- the theme's waveform in the sound place ----
const wave = document.querySelector(".hum-wave");
function drawWave() {
  if (!wave) return; const r = wave.getBoundingClientRect(); if (r.bottom < 0 || r.top > innerHeight) return;
  const w = Math.round(r.width * dpr()), h = Math.round(r.height * dpr()); if (wave.width !== w || wave.height !== h) { wave.width = w; wave.height = h; }
  const x = wave.getContext("2d"), ink = getComputedStyle(root).getPropertyValue("--ink").trim() || "#16130f", a = window.SiteHum?.analyser;
  x.clearRect(0, 0, w, h); x.strokeStyle = ink; x.lineWidth = 1.5 * dpr(); x.beginPath();
  if (a && !still()) { const d = new Uint8Array(a.fftSize); a.getByteTimeDomainData(d); for (let i = 0; i < d.length; i++) { const X = (i / (d.length - 1)) * w, Y = h / 2 + ((d[i] - 128) / 128) * h * 0.42; i ? x.lineTo(X, Y) : x.moveTo(X, Y); } }
  else { x.moveTo(0, h / 2); x.lineTo(w, h / 2); }
  x.stroke();
}

// ---- crossings: the leaving place's element travels to the next place and changes form ----
const crossing = document.getElementById("crossing"), carry = crossing ? carrier(crossing) : null;
const snaps = new Map();
function snap(pl) {  // the place's lead as it looks now: the loop's frame, the still, or the waveform
  if (snaps.has(pl)) return snaps.get(pl);
  const el = pl.querySelector(".lead video, video.lead, img.lead, .lead img, .lead canvas"); if (!el) return null;
  const c = new OffscreenCanvas(192, 108);
  try { c.getContext("2d").drawImage(el, 0, 0, 192, 108); } catch (e) { console.info("crossing: no frame yet for", pl.id, e.message); return null; }
  snaps.set(pl, c); return c;
}
let flow = null, flowAt = 0;
function cross() {
  if (!carry || still()) return;
  const W = Math.round(innerWidth * dpr()), H = Math.round(innerHeight * dpr());
  if (crossing.width !== W || crossing.height !== H) { crossing.width = W; crossing.height = H; }
  const y0 = innerHeight * 0.5;
  for (let i = 0; i + 1 < places.length; i++) {
    const A = places[i].querySelector(".lead-box"), B = places[i + 1].querySelector(".lead-box");
    const ra = A.getBoundingClientRect(), rb = B.getBoundingClientRect(), a = ra.top + ra.height / 2, b = rb.top + rb.height / 2;
    if (y0 <= a || y0 >= b) continue;
    const from = snap(places[i]), to = snap(places[i + 1]); if (!from || !to) break;
    const m = window.__medium, now = performance.now();
    if (m?.export && now - flowAt > 250) { flowAt = now; try { flow = flowFrom(m.export().velocity); } catch (e) { flow = null; } }
    carry.draw((y0 - a) / (b - a), { key: places[i].id, from: { canvas: from, rect: ra }, to: { canvas: to, rect: rb },
      fromForm: places[i].dataset.form, toForm: places[i + 1].dataset.form, flow, px: dpr(), medium: m });
    return;
  }
  crossing.getContext("2d").clearRect(0, 0, crossing.width, crossing.height);
}

let dirty = true;
addEventListener("scroll", () => { dirty = true; }, { passive: true });
addEventListener("resize", () => { dirty = true; snaps.clear(); });
function tick() {
  if (document.hidden) return;
  if (dirty) { dirty = false; for (const u of uncovers) u(); cross(); }
  if (window.SiteHum?.playing) drawWave();
}
const shared = window.UIShell?.clock;
if (shared) { shared.subscribe(tick); }
const loop = () => { if (!shared || shared.running === false) tick(); requestAnimationFrame(loop); };
requestAnimationFrame(loop);
drawWave();
