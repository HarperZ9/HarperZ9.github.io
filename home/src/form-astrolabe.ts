// Variant C: the astrolabe. An orrery of bodies on their own rings, a turning
// rete numbered like the facet list, eccentric almucantar circles, and the
// instrument's hub and pin at the centre. Each body is a facet. Hold it and the
// rings come apart; leave it alone and the rings drift on their own.
import { FLARE, TAU, alpha, wrap, type FormRenderer, type FormState } from "./form-shared";

const phase: number[] = [];
const bodies: Array<{ x: number; y: number; r: number }> = [];
let lastT = 0;

// The rete is numbered like the facet list: 00, 01, 02 and on.
function numeral(ctx: CanvasRenderingContext2D, x: number, y: number, h: number, i: number) {
  ctx.font = `600 ${Math.round(h)}px "Hanken Grotesk", system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(String(i).padStart(2, "0"), x, y);
}

function ringRadius(i: number, R: number, s: FormState) {
  const base = R * (0.27 + (0.55 * i) / Math.max(1, s.n - 1));
  return base * (1 + s.split * (0.08 + 0.35 * (i / 8)));
}

function advance(s: FormState) {
  if (!s.calm && s.t === lastT && phase.length === s.n) return; // drawn twice this frame
  const dt = Math.max(0, Math.min(0.05, s.t - lastT));
  lastT = s.t;
  for (let i = 0; i < s.n; i++) {
    if (phase[i] === undefined) phase[i] = i * 2.399;
    if (i === s.sel) {
      phase[i] += wrap(s.pointAngle - phase[i]) * (s.calm ? 1 : 1 - Math.exp(-dt * 3));
    } else if (!s.calm) {
      const w = (0.04 + 0.025 * (s.n - i)) * (1 + s.idle * 0.6) + s.spin * (i % 2 ? -1 : 1);
      phase[i] += w * dt;
    }
  }
}

// The hub: the pin and wedge that hold an astrolabe's plates together.
function drawHub(ctx: CanvasRenderingContext2D, c: number, size: number, s: FormState, ink: string) {
  const e = size * 0.05, lw = Math.max(0.8, size / 600);
  ctx.strokeStyle = alpha(ink, 0.9);
  ctx.lineWidth = lw;
  for (const k of [1, 0.62, 0.3]) { ctx.beginPath(); ctx.arc(c, c, e * k, 0, TAU); ctx.stroke(); }
  ctx.fillStyle = alpha(ink, 0.9);
  ctx.beginPath(); ctx.arc(c, c, e * 0.18, 0, TAU); ctx.fill();
  ctx.save();
  ctx.translate(c, c);
  ctx.rotate(s.rot * 0.5);
  ctx.fillRect(-e * 1.5, -e * 0.09, e * 3, e * 0.18);
  ctx.restore();
}

function drawFrame(ctx: CanvasRenderingContext2D, c: number, R: number, size: number, s: FormState, ink: string) {
  const lw = Math.max(0.5, size / 1100);
  ctx.lineWidth = lw;
  // Eccentric circles, like an astrolabe plate's almucantars.
  for (let k = 1; k <= 6; k++) {
    ctx.beginPath();
    ctx.arc(c, c + R * 0.12 * k * (1 + s.split * 0.4), R * (0.18 + 0.11 * k), 0, TAU);
    ctx.strokeStyle = alpha(ink, 0.1);
    ctx.stroke();
  }
  // Hour lines.
  for (let k = 0; k < 24; k++) {
    const a = (k / 24) * TAU + s.rot * 0.15;
    ctx.beginPath();
    ctx.moveTo(c + Math.cos(a) * R * 0.24, c + Math.sin(a) * R * 0.24);
    ctx.lineTo(c + Math.cos(a) * R * 0.86, c + Math.sin(a) * R * 0.86);
    ctx.strokeStyle = alpha(ink, 0.09);
    ctx.stroke();
  }
  // The limb: two circles and a scale of ticks, broken apart by a hold.
  const lim = R * (1 + s.split * 0.12);
  for (const rr of [lim, lim * 0.86]) {
    ctx.beginPath(); ctx.arc(c, c, rr, 0, TAU);
    ctx.strokeStyle = alpha(ink, 0.5); ctx.stroke();
  }
  for (let k = 0; k < 120; k++) {
    const a = (k / 120) * TAU + s.rot;
    const len = k % 15 === 0 ? 0.06 : k % 5 === 0 ? 0.035 : 0.018;
    ctx.beginPath();
    ctx.moveTo(c + Math.cos(a) * lim, c + Math.sin(a) * lim);
    ctx.lineTo(c + Math.cos(a) * lim * (1 - len), c + Math.sin(a) * lim * (1 - len));
    ctx.strokeStyle = alpha(ink, 0.4); ctx.stroke();
  }
}


// Art-deco sunburst: stepped wedges fanning from the eye, alternating three lengths.
function drawSunburst(ctx: CanvasRenderingContext2D, c: number, R: number, s: FormState, ink: string) {
  const rays = 32;
  ctx.fillStyle = alpha(ink, 0.06 + 0.04 * s.idle);
  ctx.beginPath();
  for (let k = 0; k < rays; k++) {
    const a = (k / rays) * TAU - s.rot * 0.5;
    const len = R * [0.86, 0.62, 0.74, 0.62][k % 4] * (1 + s.split * 0.2);
    const w = (TAU / rays) * 0.32;
    ctx.moveTo(c + Math.cos(a) * R * 0.18, c + Math.sin(a) * R * 0.18);
    ctx.lineTo(c + Math.cos(a - w) * len, c + Math.sin(a - w) * len);
    ctx.lineTo(c + Math.cos(a + w) * len, c + Math.sin(a + w) * len);
    ctx.closePath();
  }
  ctx.fill();
}

// Brutalist mass: a heavy band around the limb, cut by one notch per facet.
function drawMass(ctx: CanvasRenderingContext2D, c: number, R: number, s: FormState, ink: string) {
  const r1 = R * (1.045 + s.split * 0.1), r2 = R * (1.125 + s.split * 0.1);
  const seg = TAU / s.n;
  ctx.fillStyle = alpha(ink, 0.88);
  for (let i = 0; i < s.n; i++) {
    const mid = s.pointAngle + i * seg + s.rot + seg / 2;
    const cut = (i === s.sel || (i + 1) % s.n === s.sel) ? 0.07 : 0.035;
    const a0 = mid - seg / 2 + cut, a1 = mid + seg / 2 - cut;
    ctx.beginPath();
    ctx.arc(c, c, r2, a0, a1);
    ctx.arc(c, c, r1, a1, a0, true);
    ctx.closePath();
    ctx.fill();
  }
}

export const astrolabe: FormRenderer = {
  name: "astrolabe",

  targetRot(i, s) { return -(i * TAU) / s.n; },

  pick(x, y, size, s) {
    let best: number | null = null, bestD = Infinity;
    bodies.forEach((b, i) => {
      const d = Math.hypot(x - b.x, y - b.y);
      if (d < Math.max(b.r * 2.6, size * 0.04) && d < bestD) { bestD = d; best = i; }
    });
    if (best !== null) return best;
    const c = size / 2, R = size * 0.44, r = Math.hypot(x - c, y - c);
    if (r < R * 0.8 || r > R * 1.05) return null;
    const a = wrap(Math.atan2(y - c, x - c) - s.pointAngle - s.rot);
    return ((Math.round(a / (TAU / s.n)) % s.n) + s.n) % s.n;
  },

  draw(ctx, size, s, p) {
    advance(s);
    const c = size / 2, R = size * 0.44, ink = p.ink;
    const lw = Math.max(0.5, size / 1100);
    ctx.clearRect(0, 0, size, size);
    drawSunburst(ctx, c, R, s, ink);
    drawMass(ctx, c, R, s, ink);
    drawFrame(ctx, c, R, size, s, ink);

    // The rete's numerals, one per facet.
    for (let i = 0; i < s.n; i++) {
      const a = s.pointAngle + (i * TAU) / s.n + s.rot;
      const on = i === s.sel || i === s.preview;
      ctx.strokeStyle = alpha(ink, on ? 0.95 : 0.4);
      ctx.lineWidth = on ? lw * 1.8 : lw * 1.2;
      ctx.fillStyle = alpha(ink, on ? 0.95 : 0.5);
      numeral(ctx, c + Math.cos(a) * R * 0.93, c + Math.sin(a) * R * 0.93, R * 0.06, i);
    }

    // Orbits and bodies.
    for (let i = 0; i < s.n; i++) {
      const rr = ringRadius(i, R, s);
      const wob = s.split * size * 0.012 * Math.sin(s.t * 9 + i * 1.7);
      const ox = (i % 2 ? 1 : -1) * s.split * size * 0.02;
      const on = i === s.sel || i === s.preview;
      ctx.beginPath(); ctx.arc(c + ox, c, rr + wob, 0, TAU);
      ctx.setLineDash(i % 2 ? [size * 0.004, size * 0.008] : []);
      ctx.strokeStyle = alpha(ink, on ? 0.6 : 0.24);
      ctx.lineWidth = lw; ctx.stroke();
      ctx.setLineDash([]);
      const a = phase[i];
      const x = c + ox + Math.cos(a) * (rr + wob), y = c + Math.sin(a) * (rr + wob);
      const br = size * (0.011 + 0.003 * (i % 3)) * (i === s.sel ? 1.7 : 1);
      bodies[i] = { x, y, r: br };
      ctx.beginPath(); ctx.arc(x, y, br, 0, TAU);
      ctx.fillStyle = p.paper; ctx.fill();
      ctx.strokeStyle = alpha(ink, on ? 1 : 0.7); ctx.lineWidth = lw * 1.4; ctx.stroke();
      ctx.fillStyle = alpha(ink, 0.8);
      ctx.beginPath();
      for (let d = 0; d < 7; d++) {
        const da = d * 0.9 + 2.2, dr = br * 0.55;
        ctx.moveTo(x + Math.cos(da) * dr, y + Math.sin(da) * dr);
        ctx.arc(x + Math.cos(da) * dr, y + Math.sin(da) * dr, br * 0.16, 0, TAU);
      }
      ctx.fill();
    }

    // The chosen body: a beam from the eye, and the one spectral flare.
    const b = bodies[s.sel];
    if (b) {
      const pulse = Math.max(0, 1 - (s.t - s.selAt) / 1.2);
      ctx.beginPath(); ctx.moveTo(c, c); ctx.lineTo(b.x, b.y);
      ctx.strokeStyle = alpha(ink, 0.35 + 0.5 * pulse); ctx.lineWidth = lw * (1 + 3 * pulse); ctx.stroke();
      FLARE.forEach((col, ci) => {
        ctx.beginPath();
        ctx.arc(b.x + (ci - 1) * size * 0.003, b.y, b.r * (2 + pulse * 2), 0, TAU);
        ctx.strokeStyle = col + (p.dark ? "0.8)" : "0.6)"); ctx.lineWidth = lw * 1.3; ctx.stroke();
      });
    }
    drawHub(ctx, c, size, s, ink);
  },
};
