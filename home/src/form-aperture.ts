// Variant A: the aperture. Concentric plotter rings around a luminous core,
// cut into one arc per facet, with a corona of ticks outside. The selected arc
// opens outward and carries the one spectral flare.
import { FLARE, TAU, alpha, field, wrap, type FormRenderer } from "./form-shared";

const RINGS = 30;
const STEPS = 22;

export const aperture: FormRenderer = {
  name: "aperture",

  targetRot(i, s) {
    const theta = -Math.PI / 2 + (i * TAU) / s.n;
    return s.pointAngle - theta;
  },

  pick(x, y, size, s) {
    const c = size / 2;
    const dx = x - c, dy = y - c;
    const r = Math.hypot(dx, dy);
    if (r < size * 0.08 || r > size * 0.5) return null;
    const a = wrap(Math.atan2(dy, dx) - s.rot + Math.PI / 2);
    const seg = TAU / s.n;
    return ((Math.round(a / seg) % s.n) + s.n) % s.n;
  },

  draw(ctx, size, s, p) {
    const c = size / 2;
    const rMax = size * 0.4;
    const r0 = size * (0.085 + 0.012 * Math.sin(s.t * 0.6) + 0.02 * (1 - Math.min(1, Math.hypot(s.px, s.py))));
    const seg = TAU / s.n;
    const gap = 0.035;
    ctx.clearRect(0, 0, size, size);

    // Core: a soft glow with a halftone ring around the pupil.
    const g = ctx.createRadialGradient(c, c, 0, c, c, r0 * 2.6);
    g.addColorStop(0, alpha(p.ink, p.dark ? 0.95 : 0.9));
    g.addColorStop(0.38, alpha(p.ink, p.dark ? 0.35 : 0.25));
    g.addColorStop(1, alpha(p.ink, 0));
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(c, c, r0 * 2.6, 0, TAU); ctx.fill();
    ctx.fillStyle = alpha(p.ink, 0.55);
    for (let k = 0; k < 3; k++) {
      const rr = r0 * (1.25 + k * 0.32);
      const count = 48 + k * 16;
      for (let d = 0; d < count; d++) {
        const a = (d / count) * TAU + s.rot * 0.25 + k * 0.1;
        ctx.beginPath();
        ctx.arc(c + Math.cos(a) * rr, c + Math.sin(a) * rr, size * 0.0016 * (3 - k), 0, TAU);
        ctx.fill();
      }
    }

    const lit = (j: number) => j === s.sel || j === s.preview;
    const lw = Math.max(0.5, size / 1100);

    for (let j = 0; j < s.n; j++) {
      const theta = -Math.PI / 2 + j * seg + s.rot;
      const on = lit(j);
      const open = j === s.sel ? 1 : j === s.preview ? 0.6 : 0;
      for (let k = 0; k < RINGS; k++) {
        const f = k / (RINGS - 1);
        const rk = r0 * 1.9 + f * (rMax - r0 * 1.9) + open * size * 0.025 * f;
        const amp = size * (0.004 + 0.01 * f + open * 0.01);
        ctx.beginPath();
        for (let q = 0; q <= STEPS; q++) {
          const a = theta - seg / 2 + gap + (q / STEPS) * (seg - 2 * gap);
          const r = rk + amp * field(a - s.rot, k, s.t * 0.35);
          const x = c + Math.cos(a) * r, y = c + Math.sin(a) * r;
          if (q === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = alpha(p.ink, on ? 0.35 + 0.5 * f : 0.1 + 0.18 * f);
        ctx.lineWidth = on ? lw * 1.15 : lw;
        ctx.stroke();
      }

      // The selected arc also takes a halftone screen, so it reads at a glance.
      if (j === s.sel) {
        ctx.fillStyle = alpha(p.ink, p.dark ? 0.7 : 0.6);
        ctx.beginPath();
        const inner = r0 * 2.2, outer = rMax + size * 0.02;
        for (let r = inner; r < outer; r += size * 0.014) {
          const f = (r - inner) / (outer - inner);
          const arcStep = (size * 0.014) / r;
          const dot = size * 0.0045 * (0.25 + 0.75 * Math.sin(f * Math.PI));
          for (let a = theta - seg / 2 + gap * 2; a < theta + seg / 2 - gap * 2; a += arcStep) {
            const x = c + Math.cos(a) * r, y = c + Math.sin(a) * r;
            ctx.moveTo(x + dot, y);
            ctx.arc(x, y, dot, 0, TAU);
          }
        }
        ctx.fill();
      }

      // Corona ticks.
      const ticks = 26;
      for (let q = 0; q < ticks; q++) {
        const a = theta - seg / 2 + gap + ((q + 0.5) / ticks) * (seg - 2 * gap);
        const len = size * (0.012 + 0.03 * Math.abs(field(a - s.rot, j, s.t * 0.25))) * (on ? 1.6 : 1);
        const r1 = rMax + size * 0.02 + open * size * 0.025;
        ctx.beginPath();
        ctx.moveTo(c + Math.cos(a) * r1, c + Math.sin(a) * r1);
        ctx.lineTo(c + Math.cos(a) * (r1 + len), c + Math.sin(a) * (r1 + len));
        ctx.strokeStyle = alpha(p.ink, on ? 0.75 : 0.28);
        ctx.lineWidth = lw;
        ctx.stroke();
      }

      // The flare: channel-split copies of the selected arc's outer edge.
      if (j === s.sel) {
        const rk = rMax + size * 0.025;
        FLARE.forEach((col, ci) => {
          ctx.beginPath();
          const off = (ci - 1) * size * 0.004;
          for (let q = 0; q <= STEPS; q++) {
            const a = theta - seg / 2 + gap + (q / STEPS) * (seg - 2 * gap);
            const r = rk + off + size * 0.006 * field(a - s.rot, 31, s.t * 0.35);
            const x = c + Math.cos(a) * r, y = c + Math.sin(a) * r;
            if (q === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
          }
          ctx.strokeStyle = col + (p.dark ? "0.75)" : "0.55)");
          ctx.lineWidth = lw * 1.6;
          ctx.stroke();
        });
      }
    }

    // The notch: a fixed mark where the selected facet comes to rest.
    const na = s.pointAngle;
    const nr = rMax + size * 0.085;
    ctx.beginPath();
    ctx.moveTo(c + Math.cos(na) * nr, c + Math.sin(na) * nr);
    ctx.lineTo(c + Math.cos(na) * (nr + size * 0.035), c + Math.sin(na) * (nr + size * 0.035));
    ctx.strokeStyle = alpha(p.ink, 0.9);
    ctx.lineWidth = lw * 2;
    ctx.stroke();
  },
};
