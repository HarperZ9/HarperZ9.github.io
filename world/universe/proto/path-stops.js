// path-stops.js: what each stop's sheets draw at a grammar state. The water stops keep their own drawings (the
// ribbon's ink, the marbling through moving water, the page's own water in layers, the drying drop). Every other
// stop is drawn from its data (lib/districts.mjs): a plate uncovers through the mosaic, a stop without a plate draws
// its law across the motion sheet, a bridge stop lays its stones on the ground sheet, and the annotation sheet draws
// the rule in force (small, beside a plate) or the stop's own steps.
import { drawRibbon, mosaicSource, drawMosaic } from "../lib/path-render.js";
import { diffusionRings, courses, coursesRank, drawCourses, coffeeDrop, coffeeProfile, stones, weberSteps } from "../lib/water-laws.js";
import { LAWS } from "../lib/laws-draw.js";

export function makeStops(ctx) {
  const { dpr, medium, world, isDark, loadImg, nodeFrame, dirtyAll, road } = ctx;
  const water = courses(9), waterRank = coursesRank(water);
  const style = (d, data) => ({ ink: d.ink, accent: d.accent, wall: d.wall, px: dpr(), data });
  const plates = new Map();  // src -> { img, src (mosaic source) }
  function plate(p) {
    if (!p) return null; let e = plates.get(p.src);
    if (!e) { e = { img: null, mosaic: null }; plates.set(p.src, e); loadImg(p.src).then((img) => { if (img) { e.img = img; e.mosaic = mosaicSource(img, 480, 300); dirtyAll(); } }); }
    return e;
  }
  function plainGround(c, d) { c.x.fillStyle = d.wall; c.x.fillRect(0, 0, c.w, c.h); c.x.fillStyle = d.accent; c.x.globalAlpha = 0.08; for (let y = 0; y < c.h; y += 14 * dpr()) c.x.fillRect(0, y, c.w, dpr()); c.x.globalAlpha = 1; }
  function beatRule(c, g, d, n = 6) {  // the stop's own steps as a ruler: one tick per step, the reached ones inked
    c.x.clearRect(0, 0, c.w, c.h); const y = c.h - 10 * dpr(), x0 = 16 * dpr(), x1 = c.w * 0.45;
    c.x.fillStyle = d.ink; for (let i = 0; i <= n; i++) { const x = x0 + (i / n) * (x1 - x0), on = i / n <= g.approach + 1e-6; c.x.globalAlpha = on ? 0.9 : 0.25; c.x.fillRect(x, y - (i % 3 ? 6 : 10) * dpr(), Math.max(1, dpr()), (i % 3 ? 6 : 10) * dpr()); }
    c.x.globalAlpha = 1;
  }
  function drawMosaicScaled(c, src, g, d, seed, rank = null) {
    const o = c.__mo || (c.__mo = new OffscreenCanvas(480, 300)), x = o.getContext("2d");
    drawMosaic(x, src, g, { w: 480, h: 300, ground: d.wall, seed, base: 64, rank });
    c.x.clearRect(0, 0, c.w, c.h); c.x.imageSmoothingEnabled = false;
    const s = Math.max(c.w / 480, c.h / 300); c.x.drawImage(o, (c.w - 480 * s) / 2, (c.h - 300 * s) / 2, 480 * s, 300 * s);
  }
  const lawBox = (c, full) => (full ? { x: c.w * 0.06, y: c.h * 0.08, w: c.w * 0.88, h: c.h * 0.62 } : { x: c.w * 0.6, y: c.h * 0.06, w: c.w * 0.36, h: c.h * 0.36 });

  const WATER = {
    ink: { dropped: new Set(),
      annotation(c, g, d) { diffusionRings(c.x, g, { w: c.w, h: c.h, cx: c.w * 0.8, cy: c.h * 0.32, ink: d.ink, px: dpr() }); },
      motion(c, g, d) {
        const digits = [3, 7, 4, 9, 2, 6, 5, 8, 1, 6, 4, 7];  // each tile's digit is the ink it drops, in tenths
        const landed = drawRibbon(c.x, { n: 12, u: g.unroll, digits, inks: [d.accent, "#c8322b", "#d79e35", "#1d2562"], ink: d.wall, w: c.w, h: c.h });
        const m = medium(), box = c.box;
        for (const t of landed) if (!this.dropped.has(t.i) && m) {  // where a tile lands, the ground takes its ink
          this.dropped.add(t.i); m.add("ink", { x: (box.left + t.x / dpr()) / innerWidth, y: (box.top + t.y / dpr() + t.side / dpr()) / innerHeight, r: 0.045, amount: digits[t.i] / 6, always: true });
        }
      },
    },
    "ink-in-water": { src: null, beat: -1,
      annotation(c, g, d) { drawCourses(c.x, g, water, { w: c.w, h: c.h, ink: d.ink, px: dpr() }); },
      async picture(g) {
        if (g.approach === this.beat) return; this.beat = g.approach;
        if (!this.plate) { const p = await loadImg("exhibit/assets/img/marbled-a-s.webp"); this.plate = p ? await createImageBitmap(p) : null; }
        const pl = this.plate ? await createImageBitmap(this.plate) : null;
        const bm = await nodeFrame("iiw:" + g.approach, { id: "universe.seam-liquid", w: 480, h: 300, time: { t: 0.5 + g.approach * 1.5, duration: 2.2 }, inputs: pl ? { plate: pl } : {} });
        if (bm) { this.src = mosaicSource(bm, 480, 300); dirtyAll(); }
      },
      motion(c, g, d) { this.picture(g); if (this.src) drawMosaicScaled(c, this.src, g, d, 2, waterRank); },
    },
    layers: { snap: null, beat: -1,
      take(g) { if (g.approach === this.beat) return; this.beat = g.approach; const m = medium(); try { this.snap = m?.export?.() || null; } catch (e) { console.warn("road: medium export failed", e); this.snap = null; } },
      ground(c, g, d) { this.take(g); const t = this.snap?.tone; if (!t) return plainGround(c, d); const img = new ImageData(t.w, t.h); for (let k = 0; k < t.w * t.h; k++) img.data.set([t.C[3 * k], t.C[3 * k + 1], t.C[3 * k + 2], 255], 4 * k); const o = new OffscreenCanvas(t.w, t.h); o.getContext("2d").putImageData(img, 0, 0); c.x.imageSmoothingEnabled = true; c.x.drawImage(o, 0, 0, c.w, c.h); },
      motion(c, g, d) {
        c.x.clearRect(0, 0, c.w, c.h); const v = this.snap?.velocity; if (!v) return;
        c.x.strokeStyle = d.accent; c.x.lineWidth = 1.2 * dpr(); const step = 6;
        for (let y = step / 2; y < v.h; y += step) for (let x = step / 2; x < v.w; x += step) {
          const k = (y | 0) * v.w + (x | 0), vx = v.vx[k], vy = v.vy[k], sp = Math.hypot(vx, vy); if (sp < 1e-4) continue;
          const px = (x / v.w) * c.w, py = (y / v.h) * c.h, L = Math.min(c.w, c.h) * Math.min(0.035, 0.008 + sp * 2);
          c.x.beginPath(); c.x.moveTo(px, py); c.x.lineTo(px + (vx / sp) * L, py + (vy / sp) * L); c.x.stroke();
        }
      },
      annotation(c, g, d) {  // three measures of the page's own water, each beside its mark
        c.x.clearRect(0, 0, c.w, c.h); const t = this.snap?.tone, v = this.snap?.velocity; if (!t || !v) return;
        let ink = 0; for (const L of t.L) ink += L; const wallL = t.L.reduce((a, b) => Math.max(a, b), 0); const meanInk = Math.round(100 * Math.max(0, 1 - ink / t.L.length / Math.max(1e-3, wallL)));
        let peak = 0; for (let k = 0; k < v.vx.length; k++) peak = Math.max(peak, Math.hypot(v.vx[k], v.vy[k]));
        const rows = [[`${t.w}×${t.h}`, "square"], [`${meanInk}%`, "disc"], [peak.toFixed(3), "stroke"]], f = 13 * dpr();
        c.x.font = `400 ${f}px Conso, ui-monospace, monospace`; c.x.fillStyle = d.ink; c.x.strokeStyle = d.ink; c.x.lineWidth = dpr();
        rows.forEach(([txt, mark], i) => { const x0 = c.w - 150 * dpr(), y0 = c.h * 0.5 + i * 24 * dpr(); if (mark === "square") c.x.strokeRect(x0, y0 - 8 * dpr(), 9 * dpr(), 9 * dpr()); else if (mark === "disc") { c.x.beginPath(); c.x.arc(x0 + 4.5 * dpr(), y0 - 3.5 * dpr(), 4.5 * dpr(), 0, 6.28); c.x.fill(); } else { c.x.beginPath(); c.x.moveTo(x0, y0); c.x.lineTo(x0 + 12 * dpr(), y0 - 8 * dpr()); c.x.stroke(); } c.x.fillText(txt, x0 + 20 * dpr(), y0); });
      },
    },
    "tide-line": {
      motion(c, g, d) { coffeeDrop(c.x, g, { w: c.w, h: c.h, pigment: isDark() ? "#9fc0d2" : world?.place("pigment")?.colour?.hex || d.accent, px: dpr() }); },
      annotation(c, g, d) { coffeeProfile(c.x, g, { w: c.w, h: c.h, ink: d.ink, px: dpr() }); },
    },
    palimpsest: { src: null,
      annotation(c, g, d) { weberSteps(c.x, g, { w: c.w, h: c.h, ink: d.ink, px: dpr() }); },
      async load() { if (this.src || this.loading) return; this.loading = true; const p = await loadImg("exhibit/assets/img/palimpsest-c-s.webp"); if (p) { this.src = mosaicSource(p, 480, 300); dirtyAll(); } },
      motion(c, g, d) { this.load(); if (this.src) drawMosaicScaled(c, this.src, g, d, 3); },
    },
  };

  // every stop: its own drawing where it has one, otherwise drawn from its data
  function draw(i, role, c, g, d) {
    const st = road.stops[i], own = WATER[st.id];
    if (own?.[role]) return own[role](c, g, d);
    const pl = st.plate && st.id !== "layers" ? plate(st.plate) : null, data = { hum: ctx.hum, world, img: pl?.img };
    if (role === "ground") {
      if (st.move === "bridge" || (st.bridge && st.move === "junction")) return stones(c.x, g, { w: c.w, h: c.h, stones: world?.stones(st.bridge) || [], ink: d.ink, wall: d.wall, px: dpr() });
      return plainGround(c, d);
    }
    if (role === "motion") {
      c.x.clearRect(0, 0, c.w, c.h);
      if (st.draw && LAWS[st.draw] && !(st.draw === "rule-recombine-not-copy" && !pl?.img)) { LAWS[st.draw](c.x, g, lawBox(c, true), style(d, data)); return; }
      if (pl?.mosaic) drawMosaicScaled(c, pl.mosaic, g, d, 5 + i, st.rule === "rule-andamento-follows-form" ? waterRank : null);
      return;
    }
    if (role === "annotation") {
      c.x.clearRect(0, 0, c.w, c.h);
      if (st.rule && LAWS[st.rule] && st.draw !== st.rule) { LAWS[st.rule](c.x, g, lawBox(c, false), style(d, data)); return; }
      if (st.rule === "rule-andamento-follows-form") return drawCourses(c.x, g, water, { w: c.w, h: c.h, ink: d.ink, px: dpr() });
      return beatRule(c, g, d, st.steps || 6);
    }
    c.x.clearRect(0, 0, c.w, c.h);
  }
  // the pictures near the walker load ahead, so an arriving element lands on its picture, not on grey
  function warm(i) {
    for (let k = Math.max(0, i - 1); k <= Math.min(road.length - 1, i + 2); k++) { const st = road.stops[k]; if (st.plate && st.id !== "layers") plate(st.plate); }
    if (i <= 5) { WATER["ink-in-water"].picture({ approach: 0 }); WATER.palimpsest.load(); }
  }
  return { draw, warm };
}
