// zoetrope-compose.js: frames composited into the print geometry. The pure
// layout mathematics live in zoetrope.js; this half owns the canvases.
import { discLayout, stripLayout, drawDiscTemplate, drawStripTemplate } from "./zoetrope.js?v=20260812-cohesion";

// Composite animation frames into the disc's image band, template on top.
// target is a canvas the caller owns; frames are drawable sources. Returns
// the layout used.
export function composeDisc(target, frames, opts = {}) {
  if (!frames || frames.length < 2) throw new RangeError("composeDisc needs at least 2 frames");
  const layout = discLayout(Object.assign({ frames: frames.length }, opts.layout || {}));
  const px = opts.diameterPx || 2400;
  const scale = px / layout.diameterMM;
  target.width = px; target.height = px;
  const ctx = target.getContext("2d");
  ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, px, px);
  const half = Math.PI / layout.frames;
  const rOut = layout.imageOuterRMM * scale, rIn = layout.imageInnerRMM * scale;
  const rMid = (rOut + rIn) / 2, bandH = rOut - rIn;
  const bandW = (2 * Math.PI * rMid) / layout.frames;
  frames.forEach((f, i) => {
    const a = (layout.frameCenterAngleDeg(i) * Math.PI) / 180;
    ctx.save();
    ctx.translate(px / 2, px / 2);
    ctx.rotate(a);
    ctx.beginPath();
    ctx.arc(0, 0, rOut, -Math.PI / 2 - half, -Math.PI / 2 + half);
    ctx.arc(0, 0, rIn, -Math.PI / 2 + half, -Math.PI / 2 - half, true);
    ctx.closePath();
    ctx.clip();
    ctx.translate(0, -rMid);
    const w = f.width || f.naturalWidth, h = f.height || f.naturalHeight;
    const s = Math.max((bandW * 1.12) / w, bandH / h);
    ctx.drawImage(f, (-w * s) / 2, (-h * s) / 2, w * s, h * s);
    ctx.restore();
  });
  ctx.save();
  ctx.translate(px / 2, px / 2);
  ctx.strokeStyle = "#111111"; ctx.lineWidth = Math.max(1, 0.3 * scale);
  ctx.fillStyle = "#111111";
  drawDiscTemplate(ctx, layout, scale);
  ctx.font = Math.round(2.4 * scale) + "px monospace";
  ctx.textAlign = "center";
  const spin = layout.spin(12);
  const lines = [opts.label || "phenakistoscope",
    "cut the rim and the slots, pin the center",
    "spin about " + Math.round(spin.rpm) + " rpm, watch through", "the slots in a mirror"];
  lines.forEach((ln, i) => ctx.fillText(ln, 0, rIn * 0.30 + i * 3.4 * scale));
  ctx.restore();
  return layout;
}

// Composite frames into a zoetrope strip: slot band above, frames below,
// overlap tab at the end, template lines on top. Print, roll into a drum of
// the layout's diameter, tape the tab, spin, look through the slots.
export function composeStrip(target, frames, opts = {}) {
  if (!frames || frames.length < 2) throw new RangeError("composeStrip needs at least 2 frames");
  const layout = stripLayout(Object.assign({ frames: frames.length }, opts.layout || {}));
  const scale = (opts.widthPx || 3300) / layout.totalLengthMM;
  target.width = Math.round(layout.totalLengthMM * scale);
  target.height = Math.round((layout.heightMM + 10) * scale);
  const ctx = target.getContext("2d");
  ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, target.width, target.height);
  frames.forEach((f, i) => {
    const r = layout.frameRectMM(i);
    const x = r.x * scale, y = r.y * scale, w = r.w * scale, h = r.h * scale;
    ctx.save();
    ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
    const fw = f.width || f.naturalWidth, fh = f.height || f.naturalHeight;
    const s = Math.max(w / fw, h / fh);
    ctx.drawImage(f, x + (w - fw * s) / 2, y + (h - fh * s) / 2, fw * s, fh * s);
    ctx.restore();
  });
  ctx.strokeStyle = "#111111"; ctx.lineWidth = Math.max(1, 0.3 * scale);
  drawStripTemplate(ctx, layout, scale);
  ctx.fillStyle = "#111111";
  ctx.font = Math.round(2.6 * scale) + "px monospace";
  ctx.textAlign = "left";
  ctx.fillText("zoetrope strip: roll into a " + Math.round(layout.drumDiameterMM) +
    " mm drum, tape the tab, spin, look through the slots", 4 * scale, target.height - 3 * scale);
  return layout;
}
