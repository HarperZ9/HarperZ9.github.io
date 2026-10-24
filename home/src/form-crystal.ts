// Variant B: the crystal. An eight-sided bipyramid drawn in plotter line-work,
// hatched by light, with three nested crystals inside. Each upper face is a
// facet; the selected face turns to the front and fills with a halftone screen.
import { FLARE, TAU, alpha, type FormRenderer, type FormState } from "./form-shared";

type V = [number, number, number];
type P = [number, number, number]; // screen x, y, depth

function project(v: V, s: FormState, size: number, scale: number): P {
  const ry = s.rot;
  const tilt = 0.32 + s.py * 0.12;
  const yaw = s.px * 0.12;
  let [x, y, z] = v;
  // turn around the vertical axis
  const cx = Math.cos(ry + yaw), sx = Math.sin(ry + yaw);
  [x, z] = [x * cx - z * sx, x * sx + z * cx];
  // tilt toward the viewer
  const ct = Math.cos(tilt), st = Math.sin(tilt);
  [y, z] = [y * ct - z * st, y * st + z * ct];
  const persp = 1 / (1 - z * 0.12);
  const k = size * 0.27 * scale * persp;
  return [size / 2 + x * k, size / 2 - y * k + size * 0.02, z];
}

function solid(n: number, s: FormState): V[] {
  const pts: V[] = [[0, 1.3, 0], [0, -1.45, 0]];
  for (let i = 0; i < n; i++) {
    const a = (i * TAU) / n;
    pts.push([Math.cos(a), 0.06 * Math.sin(s.t * 0.5 + i), Math.sin(a)]);
  }
  return pts;
}

// faces: upper i = (0, 2+i, 2+i+1), lower i = (1, 2+i+1, 2+i)
function faces(n: number): Array<[number, number, number, number]> {
  const out: Array<[number, number, number, number]> = [];
  for (let i = 0; i < n; i++) {
    const a = 2 + i, b = 2 + ((i + 1) % n);
    out.push([0, a, b, i], [1, b, a, i]);
  }
  return out;
}

function front(a: P, b: P, c: P): boolean {
  return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]) > 0;
}

function inside(x: number, y: number, a: P, b: P, c: P): boolean {
  const d = (p: P, q: P) => (q[0] - p[0]) * (y - p[1]) - (q[1] - p[1]) * (x - p[0]);
  const d1 = d(a, b), d2 = d(b, c), d3 = d(c, a);
  return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0));
}

function hatch(ctx: CanvasRenderingContext2D, a: P, b: P, c: P, gap: number, angle: number) {
  ctx.save();
  ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.lineTo(c[0], c[1]); ctx.closePath();
  ctx.clip();
  const minX = Math.min(a[0], b[0], c[0]), maxX = Math.max(a[0], b[0], c[0]);
  const minY = Math.min(a[1], b[1], c[1]), maxY = Math.max(a[1], b[1], c[1]);
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
  const r = Math.hypot(maxX - minX, maxY - minY) / 2 + 2;
  const ux = Math.cos(angle), uy = Math.sin(angle);
  ctx.beginPath();
  for (let o = -r; o <= r; o += gap) {
    ctx.moveTo(cx - ux * r - uy * o, cy - uy * r + ux * o);
    ctx.lineTo(cx + ux * r - uy * o, cy + uy * r + ux * o);
  }
  ctx.stroke();
  ctx.restore();
}

function dots(ctx: CanvasRenderingContext2D, a: P, b: P, c: P, step: number, rad: number) {
  ctx.save();
  ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.lineTo(c[0], c[1]); ctx.closePath();
  ctx.clip();
  const minX = Math.min(a[0], b[0], c[0]), maxX = Math.max(a[0], b[0], c[0]);
  const minY = Math.min(a[1], b[1], c[1]), maxY = Math.max(a[1], b[1], c[1]);
  ctx.beginPath();
  for (let y = minY; y <= maxY; y += step) {
    const row = Math.round((y - minY) / step) % 2 ? step / 2 : 0;
    for (let x = minX + row; x <= maxX; x += step) {
      const fy = (y - minY) / Math.max(1, maxY - minY);
      const rr = rad * (0.35 + 0.65 * (1 - fy));
      ctx.moveTo(x + rr, y); ctx.arc(x, y, rr, 0, TAU);
    }
  }
  ctx.fill();
  ctx.restore();
}

export const crystal: FormRenderer = {
  name: "crystal",

  targetRot(i, s) {
    // face i's centre sits at angle (i + 0.5) * TAU / n; the front is +z.
    return Math.PI / 2 - ((i + 0.5) * TAU) / s.n;
  },

  pick(x, y, size, s) {
    const pts = solid(s.n, s).map((v) => project(v, s, size, 1));
    let best: number | null = null, depth = -Infinity;
    for (const [i0, i1, i2, facet] of faces(s.n)) {
      const a = pts[i0], b = pts[i1], c = pts[i2];
      if (!front(a, b, c) || !inside(x, y, a, b, c)) continue;
      const z = (a[2] + b[2] + c[2]) / 3;
      if (z > depth) { depth = z; best = facet; }
    }
    return best;
  },

  draw(ctx, size, s, p) {
    ctx.clearRect(0, 0, size, size);
    const lw = Math.max(0.5, size / 1000);
    const light: V = [-0.4, 0.75, 0.55];

    // Nested crystals, edges only.
    for (const scale of [0.25, 0.5, 0.75]) {
      const pts = solid(s.n, { ...s, rot: s.rot * (1.6 - scale) }).map((v) => project(v, s, size, scale));
      ctx.beginPath();
      for (const [i0, i1, i2] of faces(s.n)) {
        ctx.moveTo(pts[i0][0], pts[i0][1]); ctx.lineTo(pts[i1][0], pts[i1][1]); ctx.lineTo(pts[i2][0], pts[i2][1]);
      }
      ctx.strokeStyle = alpha(p.ink, 0.1 + scale * 0.08);
      ctx.lineWidth = lw;
      ctx.stroke();
    }

    const raw = solid(s.n, s);
    const pts = raw.map((v) => project(v, s, size, 1));
    const list = faces(s.n).map((f) => {
      const [i0, i1, i2] = f;
      return { f, z: (pts[i0][2] + pts[i1][2] + pts[i2][2]) / 3 };
    }).sort((a, b) => a.z - b.z);

    for (const { f } of list) {
      const [i0, i1, i2, facet] = f;
      const a = pts[i0], b = pts[i1], c = pts[i2];
      const isFront = front(a, b, c);
      const on = facet === s.sel || facet === s.preview;
      if (!isFront) {
        ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.lineTo(c[0], c[1]); ctx.closePath();
        ctx.strokeStyle = alpha(p.ink, 0.14); ctx.lineWidth = lw; ctx.stroke();
        continue;
      }
      // light from the world-space face normal
      const A = raw[i0], B = raw[i1], C = raw[i2];
      const u = [B[0] - A[0], B[1] - A[1], B[2] - A[2]], v = [C[0] - A[0], C[1] - A[1], C[2] - A[2]];
      const nx = u[1] * v[2] - u[2] * v[1], ny = u[2] * v[0] - u[0] * v[2], nz = u[0] * v[1] - u[1] * v[0];
      const nl = Math.hypot(nx, ny, nz) || 1;
      const shade = Math.max(0, (nx * light[0] + ny * light[1] + nz * light[2]) / nl);
      ctx.fillStyle = p.paper;
      ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.lineTo(c[0], c[1]); ctx.closePath();
      ctx.globalAlpha = 0.82; ctx.fill(); ctx.globalAlpha = 1;
      if (facet === s.sel) {
        ctx.fillStyle = alpha(p.ink, 0.85);
        dots(ctx, a, b, c, size * 0.012, size * 0.0042);
      } else {
        ctx.strokeStyle = alpha(p.ink, on ? 0.55 : 0.32);
        ctx.lineWidth = lw * 0.8;
        hatch(ctx, a, b, c, size * (0.006 + 0.012 * shade), 0.6 + facet * 0.37);
      }
      ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.lineTo(c[0], c[1]); ctx.closePath();
      ctx.strokeStyle = alpha(p.ink, on ? 0.95 : 0.6);
      ctx.lineWidth = on ? lw * 1.8 : lw * 1.1;
      ctx.stroke();
      if (facet === s.sel && i0 === 0) {
        FLARE.forEach((col, ci) => {
          const off = (ci - 1) * size * 0.004;
          ctx.beginPath(); ctx.moveTo(b[0] + off, b[1]); ctx.lineTo(c[0] + off, c[1]);
          ctx.strokeStyle = col + (p.dark ? "0.8)" : "0.6)"); ctx.lineWidth = lw * 1.6; ctx.stroke();
        });
      }
    }
  },
};
