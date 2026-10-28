// road-layers.js: the road's pictures as layers of the one stage (world/site/stage.js). Each stop's sheets draw into
// offscreen surfaces sized to their layout box; the stage composites the sheets of the stops in view, with each
// sheet's fan offset eased the way the CSS transition used to ease it. The road, the strata and the carried element
// draw into small offscreen surfaces too, and the stage scales them up: the road's blocks stay blocks (nearest
// neighbour), the strata stay soft.
import { stage } from "/world/site/stage.js";

const ease = (a, b, k) => a + (b - a) * k;

// a sheet's surface: an offscreen canvas at its untransformed layout size, at the stage's ratio
export function surface(el) {
  const p = stage.px(), w = Math.max(1, Math.round(el.offsetWidth * p)), h = Math.max(1, Math.round(el.offsetHeight * p));
  let s = el.__surf;
  if (!s) { s = el.__surf = new OffscreenCanvas(w, h); el.__ctx = s.getContext("2d", { willReadFrequently: true }); }  // CPU-backed: the transfer reads it back without a GPU stall
  if (s.width !== w || s.height !== h) { s.width = w; s.height = h; el.__dirty = true; }
  return { w, h, cw: el.offsetWidth, ch: el.offsetHeight, x: el.__ctx };
}

// the eased offset of a sheet toward its target; true while it is still moving
function settle(el, k) {
  const t = el.__o || { x: 0, y: 0, rotate: 0, scale: 1 }, c = el.__oc || (el.__oc = { ...t });
  let moving = false;
  for (const key of ["x", "y", "rotate", "scale"]) {
    c[key] = ease(c[key], t[key], k);
    if (Math.abs(c[key] - t[key]) > (key === "scale" ? 1e-4 : 0.02)) moving = true; else c[key] = t[key];
  }
  return { c, moving };
}

function drawSheet(ctx, el, box, view, k) {
  const s = el.__surf; if (!s || !s.width) return false;
  const { c, moving } = settle(el, k);
  const w = el.offsetWidth, h = el.offsetHeight, cx = box.left + el.offsetLeft + w / 2, cy = box.top + el.offsetTop + h / 2;
  if (cy + h < 0 || cy - h > view.ch) return moving;
  ctx.setTransform(view.px, 0, 0, view.px, 0, 0);
  ctx.translate(cx + c.x, cy + c.y); ctx.rotate((c.rotate * Math.PI) / 180); ctx.scale(c.scale, c.scale);
  ctx.globalAlpha = el.__alpha ?? 1;
  ctx.drawImage(s, -w / 2, -h / 2, w, h);
  return moving;
}

// the stops' sheets: only stops whose box meets the view are composited
export function sheetsLayer(sections, near) {
  let moving = false, last = 0;
  return {
    name: "road-sheets", z: 2,
    live: () => moving,
    draw(ctx, view) {
      const now = performance.now(), dt = last ? Math.min(100, now - last) : 16; last = now;
      const k = view.still ? 1 : 1 - Math.exp(-dt / 160);
      moving = false;
      ctx.globalCompositeOperation = view.dark ? "screen" : "multiply";
      for (const i of near()) {
        const sec = sections[i], sheets = sec.__sheetsEl || (sec.__sheetsEl = sec.querySelector(".sheets"));
        const box = sheets.getBoundingClientRect();
        if (box.bottom < -40 || box.top > view.ch + 40) continue;
        for (const el of sec.__canvasSheets) if (drawSheet(ctx, el, box, view, k)) moving = true;
      }
    },
  };
}

// a full-view picture from a small surface, scaled to the stage
export function surfaceLayer(name, z, surf, { smooth = true, alpha = () => 1, blend = () => "source-over", on = () => true } = {}) {
  return {
    name, z,
    draw(ctx, view) {
      if (!on() || !surf.width) return;
      ctx.imageSmoothingEnabled = smooth;
      ctx.globalAlpha = alpha(view); ctx.globalCompositeOperation = blend(view);
      ctx.drawImage(surf, 0, 0, view.w, view.h);
    },
  };
}

// keep a full-view surface at a fraction of the view's CSS size
export function sizeTo(surf, scale) {
  const w = Math.max(2, Math.round(innerWidth * scale)), h = Math.max(2, Math.round(innerHeight * scale));
  if (surf.width !== w || surf.height !== h) { surf.width = w; surf.height = h; return true; }
  return false;
}
