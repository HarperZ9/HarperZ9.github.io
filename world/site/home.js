// home.js: the places after the road. Each place leads with its motion; crossing from one place to the next carries
// the leaving element across the page's water to the next one (universe lib/carry.js), and the stills uncover through
// the stop grammar's mosaic (universe lib/stop.mjs, lib/path-render.js). All three draw as layers of the one stage
// (world/site/stage.js), never on canvases of their own. Distance is the clock; when the theme plays, a reveal step
// waits for its next sixteenth note (hum.js). Reduced motion and Plain view: loops stay on their posters, stills show
// whole, nothing crosses.
import { carrier, flowFrom } from "/world/universe/lib/carry.js";
import { grammar } from "/world/universe/lib/stop.mjs";
import { mosaicSource, drawMosaic } from "/world/universe/lib/path-render.js";
import { stage, isStill } from "/world/site/stage.js";
import "/world/site/hum.js";

const root = document.documentElement;
const still = () => isStill() || root.classList.contains("weak");
const places = [...document.querySelectorAll(".place")];

// ---- past the road: the road's layers step back once the places begin ----
const bazaar = document.querySelector(".bazaar");
if (bazaar) new IntersectionObserver(([e]) => { document.body.classList.toggle("past-road", e.boundingClientRect.top < innerHeight * 0.5); stage.invalidate(); }, { threshold: [0, 0.05, 0.2] }).observe(bazaar);

// ---- stills uncover through the mosaic as the visitor arrives: one layer for all of them ----
const W = 480;
const covers = [...document.querySelectorAll("img[data-uncover]")].map((img) => {
  const H = Math.round(W * img.height / img.width), o = new OffscreenCanvas(W, H), u = { img, o, H, src: null, g: null, shown: -1 };
  const ready = () => { try { u.src = mosaicSource(img, W, H); stage.invalidate(); } catch (e) { console.warn("uncover: no mosaic, the still shows whole", e); } };
  img.complete && img.naturalWidth ? ready() : img.addEventListener("load", ready, { once: true });
  return u;
});
function updateCover(u) {
  const r = u.img.getBoundingClientRect(), a = Math.min(1, Math.max(0, (innerHeight - r.top) / (innerHeight * 0.75)));
  const g = grammar(a, { steps: 6 }); if (g.approach === u.shown) return; u.shown = g.approach;
  window.SiteHum.onGrid(() => {
    u.g = g; if (g.settled) { stage.invalidate(); return; }
    drawMosaic(u.o.getContext("2d"), u.src, g, { w: W, h: u.H, ground: getComputedStyle(root).getPropertyValue("--wall").trim() || "#e8e3d9", seed: 5 });
    stage.invalidate();
  });
}
stage.add({ name: "uncover", z: 5, draw(ctx, view) {
  if (still()) return;
  ctx.imageSmoothingEnabled = false;
  for (const u of covers) {
    if (!u.src) continue;
    const r = u.img.getBoundingClientRect(); if (r.bottom < 0 || r.top > view.ch) continue;
    updateCover(u); if (!u.g || u.g.settled) continue;
    ctx.setTransform(view.px, 0, 0, view.px, 0, 0); ctx.drawImage(u.o, r.left, r.top, r.width, r.height);
  }
} });

// ---- the theme's waveform in the sound place, drawn while the theme plays ----
const waveBox = document.querySelector(".hum-wave");
stage.add({ name: "hum-wave", z: 6, live: () => !!window.SiteHum?.playing, draw(ctx, view) {
  if (!waveBox) return; const r = waveBox.getBoundingClientRect(); if (r.bottom < 0 || r.top > view.ch) return;
  const a = window.SiteHum?.analyser, ink = getComputedStyle(root).getPropertyValue("--ink").trim() || "#16130f";
  ctx.setTransform(view.px, 0, 0, view.px, 0, 0); ctx.strokeStyle = ink; ctx.lineWidth = 1.5; ctx.beginPath();
  if (a && !still()) { const d = new Uint8Array(a.fftSize); a.getByteTimeDomainData(d); for (let i = 0; i < d.length; i++) { const X = r.left + (i / (d.length - 1)) * r.width, Y = r.top + r.height / 2 + ((d[i] - 128) / 128) * r.height * 0.42; i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y); } }
  else { ctx.moveTo(r.left, r.top + r.height / 2); ctx.lineTo(r.right, r.top + r.height / 2); }
  ctx.stroke();
} });

// ---- crossings: the leaving place's element travels to the next place and changes form ----
const crossSurf = new OffscreenCanvas(2, 2), carry = carrier(crossSurf), snaps = new Map();
function snap(pl) {  // the place's lead as it looks now: the loop's frame or the still
  if (snaps.has(pl)) return snaps.get(pl);
  const el = pl.querySelector(".lead video, video.lead, img.lead, .lead img"); if (!el) return null;
  const c = new OffscreenCanvas(192, 108);
  try { c.getContext("2d").drawImage(el, 0, 0, 192, 108); } catch (e) { console.info("crossing: no frame yet for", pl.id, e.message); return null; }
  snaps.set(pl, c); return c;
}
let flow = null, flowAt = "";
function cross(view) {
  if (crossSurf.width !== view.cw || crossSurf.height !== view.ch) { crossSurf.width = view.cw; crossSurf.height = view.ch; snaps.clear(); }
  const y0 = view.ch * 0.5;
  for (let i = 0; i + 1 < places.length; i++) {
    const ra = places[i].querySelector(".lead-box").getBoundingClientRect(), rb = places[i + 1].querySelector(".lead-box").getBoundingClientRect();
    const a = ra.top + ra.height / 2, b = rb.top + rb.height / 2; if (y0 <= a || y0 >= b) continue;
    const from = snap(places[i]), to = snap(places[i + 1]); if (!from || !to) return false;
    const m = window.__medium;  // the water is read back once per crossing: a readback stalls the GPU queue
    if (m?.export && flowAt !== places[i].id) { flowAt = places[i].id; try { flow = flowFrom(m.export().velocity); } catch (e) { flow = null; } }
    carry.draw((y0 - a) / (b - a), { key: places[i].id, from: { canvas: from, rect: ra }, to: { canvas: to, rect: rb }, fromForm: places[i].dataset.form, toForm: places[i + 1].dataset.form, flow, px: 1, medium: m });
    return true;
  }
  return false;
}
stage.add({ name: "crossing", z: 4, draw(ctx, view) {
  if (still() || !document.body.classList.contains("past-road")) return;
  if (!cross(view)) return;
  ctx.drawImage(crossSurf, 0, 0, view.w, view.h);
} });
