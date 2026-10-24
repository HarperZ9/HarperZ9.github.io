// Effects every form shares, drawn after the form itself: rising water for
// Low Water, click ripples, scan tearing when the cursor moves fast, and the
// hidden eclipse, which inverts the disc.
import { TAU, alpha, type FormState, type Palette } from "./form-shared";

export function drawWater(ctx: CanvasRenderingContext2D, size: number, s: FormState, p: Palette) {
  if (s.water <= 0.001) return;
  const top = size * (1 - 0.42 * s.water);
  ctx.save();
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size * 0.49, 0, TAU);
  ctx.clip();
  ctx.fillStyle = alpha(p.paper, 0.72);
  ctx.fillRect(0, top, size, size - top);
  ctx.strokeStyle = alpha(p.ink, 0.42);
  ctx.lineWidth = Math.max(0.6, size / 900);
  for (let y = top, row = 0; y < size; y += size * 0.012, row++) {
    ctx.beginPath();
    for (let x = 0; x < size; ) {
      const len = size * (0.02 + 0.05 * Math.abs(Math.sin(row * 1.7 + x * 0.013 + s.t * 0.4)));
      ctx.moveTo(x, y); ctx.lineTo(Math.min(size, x + len), y);
      x += len + size * (0.01 + 0.02 * Math.abs(Math.cos(row + x * 0.021)));
    }
    ctx.stroke();
  }
  ctx.restore();
}

export function drawShocks(ctx: CanvasRenderingContext2D, size: number, s: FormState, p: Palette) {
  s.shocks = s.shocks.filter((k) => s.t - k.t < 1.6);
  for (const k of s.shocks) {
    const age = s.t - k.t;
    for (let ring = 0; ring < 3; ring++) {
      const r = (age * 0.55 - ring * 0.05) * size;
      if (r <= 0) continue;
      ctx.beginPath();
      ctx.arc(k.x, k.y, r, 0, TAU);
      ctx.strokeStyle = alpha(p.ink, Math.max(0, 0.5 * (1 - age / 1.6)) / (ring + 1));
      ctx.lineWidth = Math.max(0.6, size / 800);
      ctx.stroke();
    }
  }
}

// Scan tearing: copy a few horizontal bands sideways. Strength follows cursor speed.
export function scanTear(ctx: CanvasRenderingContext2D, size: number, s: FormState) {
  if (s.energy < 0.08) return;
  const bands = 2 + Math.floor(s.energy * 5);
  for (let b = 0; b < bands; b++) {
    const seed = Math.sin(b * 91.7 + Math.floor(s.t * 12) * 13.1) * 43758.5453;
    const r = seed - Math.floor(seed);
    const y = Math.floor(r * size);
    const h = Math.max(2, Math.floor(size * (0.004 + 0.02 * ((r * 7) % 1))));
    const dx = Math.round((r - 0.5) * size * 0.16 * s.energy);
    ctx.drawImage(ctx.canvas, 0, y, size, h, dx, y, size, h);
  }
}

// The hidden eclipse: a disc of ink grows from the centre and the form is
// drawn again inside it in the paper colour.
export function eclipse(ctx: CanvasRenderingContext2D, size: number, s: FormState, p: Palette, redraw: (p: Palette) => void) {
  if (s.eclipse <= 0.001) return;
  const inverse: Palette = { ...p, ink: p.paper, paper: p.ink, dark: !p.dark };
  ctx.save();
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size * 0.49 * s.eclipse, 0, TAU);
  ctx.clip();
  redraw(inverse);
  ctx.globalCompositeOperation = "destination-over";
  ctx.fillStyle = p.ink;
  ctx.fillRect(0, 0, size, size);
  ctx.restore();
}
