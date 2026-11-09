// system/type-forge/skeletons.mjs
// The alphabet's topology, held apart from style: the centerline a pen travels, what makes an "n" an
// "n" regardless of weight, contrast or width. A line-for-line port of Flywheel's
// harness/typeface_skeletons.py (Zain Mint). Units: y = 1.0 is the x-height, baseline at 0.
// Lowercase, digits and punctuation live here; the capitals and the runic style in skeletons-caps.mjs.

import { buildCaps } from "./skeletons-caps.mjs";
import { superellipse, line, stroke, stem, diag } from "./geometry.mjs";

export { superellipse, line };

const PI = Math.PI;

export function build(params) {
  const w = params.width, n = params.roundness, ap = params.aperture;
  const asc = params.ascender ?? 1.5;
  const bowlRx = 0.52 * w;
  const bowl = { cx: bowlRx, cy: 0.5, rx: bowlRx, ry: 0.5 + 0.0, n };
  const advRound = 2 * bowlRx;
  const stemGap = 0.98 * w;
  const shoulder = 0.98;
  const n22 = Math.min(n, 2.2);
  const bowlRing = () => stroke(superellipse(bowl.cx, bowl.cy, bowl.rx, bowl.ry, bowl.n), "bowl", true);
  const arch = (x0, x1) => stroke(superellipse((x0 + x1) / 2.0, 0.55, (x1 - x0) / 2.0, shoulder - 0.55, n, PI, 0.0), "arch");
  const dot = (x, y, r) => stroke(superellipse(x, y, r, r, 2.0), "dot", true);
  const g = {};

  g.i = { advance: 0.30 * w + 0.0, strokes: [stem(0.15 * w, 0.0, 1.0), dot(0.15 * w, 1.32, 0.07)] };
  g.n = { advance: stemGap + 0.30 * w, strokes: [stem(0.15 * w, 0.0, 1.0), arch(0.15 * w, 0.15 * w + stemGap), stem(0.15 * w + stemGap, 0.0, 0.62)] };
  g.h = { advance: stemGap + 0.30 * w, strokes: [stem(0.15 * w, 0.0, asc), arch(0.15 * w, 0.15 * w + stemGap), stem(0.15 * w + stemGap, 0.0, 0.62)] };
  g.o = { advance: advRound, strokes: [bowlRing()] };

  const eGap = 0.55 + 0.6 * ap, eT0 = -PI / 4 + eGap / 2;
  g.e = { advance: advRound, strokes: [
    stroke(superellipse(bowl.cx, 0.5, bowlRx, 0.5, n, eT0, eT0 + 2 * PI - eGap), "bowl"),
    stroke(line(bowl.cx - bowlRx * 0.92, 0.55, bowl.cx + bowlRx * 0.92, 0.55), "crossbar")] };
  g.d = { advance: advRound + 0.12 * w, strokes: [bowlRing(), stem(2 * bowlRx - 0.02, 0.0, asc)] };
  g.a = { advance: advRound + 0.10 * w, strokes: [bowlRing(), stem(2 * bowlRx - 0.02, 0.0, 1.0)] };

  const sTerm = 0.45 + 0.4 * ap;
  const sTop = superellipse(0.46 * w, 0.735, 0.30 * w, 0.265, n22, sTerm, 1.5 * PI);
  const sBot = superellipse(0.46 * w, 0.265, 0.30 * w, 0.265, n22, 0.5 * PI, -PI + sTerm);
  g.s = { advance: 0.92 * advRound, strokes: [stroke(sTop.concat(sBot.slice(1)), "spine")] };

  const desc = -0.45;
  g.b = { advance: advRound + 0.12 * w, strokes: [stem(0.02, 0.0, asc), bowlRing()] };
  g.p = { advance: advRound + 0.12 * w, strokes: [stem(0.02, desc, 1.0), bowlRing()] };
  g.q = { advance: advRound + 0.12 * w, strokes: [bowlRing(), stem(2 * bowlRx - 0.02, desc, 1.0)] };
  const gHook = superellipse(2 * bowlRx - 0.02 - 0.26 * w, desc + 0.22, 0.26 * w, 0.22, n22, 0.0, -PI + 0.4);
  g.g = { advance: advRound + 0.12 * w, strokes: [bowlRing(), stem(2 * bowlRx - 0.02, desc + 0.20, 1.0), stroke(gHook, "tail")] };
  const cGap = 0.75 + 0.5 * ap;
  g.c = { advance: advRound, strokes: [stroke(superellipse(bowl.cx, 0.5, bowlRx, 0.5, n, cGap / 2, 2 * PI - cGap / 2), "bowl")] };
  g.l = { advance: 0.30 * w, strokes: [stem(0.15 * w, 0.0, asc)] };
  const fHook = superellipse(0.15 * w + 0.24 * w, asc - 0.24, 0.24 * w, 0.24, n22, PI, 0.5 * PI);
  g.f = { advance: 0.52 * w, strokes: [stem(0.15 * w, 0.0, asc - 0.24), stroke(fHook.slice().reverse(), "hook"), stroke(line(-0.02, 1.0, 0.44 * w, 1.0), "crossbar")] };
  g.t = { advance: 0.52 * w, strokes: [stem(0.15 * w, 0.0, 1.28), stroke(line(-0.02, 1.0, 0.44 * w, 1.0), "crossbar")] };
  const jHook = superellipse(0.15 * w - 0.22 * w, desc + 0.20, 0.22 * w, 0.20, n22, 0.0, -PI + 0.5);
  g.j = { advance: 0.34 * w, strokes: [stem(0.15 * w, desc + 0.18, 1.0), stroke(jHook, "tail"), dot(0.15 * w, 1.32, 0.07)] };
  g.k = { advance: 0.92 * w + 0.2 * w, strokes: [stem(0.15 * w, 0.0, asc), diag(0.15 * w, 0.42, 0.15 * w + 0.72 * w, 1.0), diag(0.15 * w + 0.26 * w, 0.60, 0.15 * w + 0.78 * w, 0.0)] };
  const mGap = 0.62 * w;
  g.m = { advance: 2 * mGap + 0.30 * w, strokes: [stem(0.15 * w, 0.0, 1.0), arch(0.15 * w, 0.15 * w + mGap), stem(0.15 * w + mGap, 0.0, 0.62),
    arch(0.15 * w + mGap, 0.15 * w + 2 * mGap), stem(0.15 * w + 2 * mGap, 0.0, 0.62)] };
  const rArc = superellipse(0.15 * w + 0.38 * w, 0.60, 0.38 * w, 0.38, n, PI, 0.35 * PI);
  g.r = { advance: 0.62 * w, strokes: [stem(0.15 * w, 0.0, 1.0), stroke(rArc, "arch")] };
  const uArc = superellipse((0.3 * w + stemGap) / 2 + 0.0, 0.45, stemGap / 2, 0.43, n, PI, 2 * PI);
  const uShift = 0.15 * w - ((0.3 * w + stemGap) / 2 - stemGap / 2);
  g.u = { advance: stemGap + 0.30 * w, strokes: [stem(0.15 * w, 0.45, 1.0), stroke(uArc.map(([x, y]) => [x + uShift, y]), "arch"), stem(0.15 * w + stemGap, 0.0, 1.0)] };
  g.v = { advance: 1.04 * w, strokes: [diag(0.02, 1.0, 0.52 * w, 0.0), diag(0.52 * w, 0.0, 1.02 * w, 1.0)] };
  g.w = { advance: 1.46 * w, strokes: [diag(0.02, 1.0, 0.38 * w, 0.0), diag(0.38 * w, 0.0, 0.72 * w, 0.92), diag(0.72 * w, 0.92, 1.06 * w, 0.0), diag(1.06 * w, 0.0, 1.42 * w, 1.0)] };
  g.x = { advance: 1.0 * w, strokes: [diag(0.02, 1.0, 0.98 * w, 0.0), diag(0.02, 0.0, 0.98 * w, 1.0)] };
  g.y = { advance: 1.04 * w, strokes: [diag(0.02, 1.0, 0.52 * w, 0.0), diag(1.02 * w, 1.0, 0.52 * w + desc * (-0.5 * w / 1.0) * -1, desc)] };
  g.z = { advance: 0.94 * w, strokes: [stroke(line(0.04, 1.0, 0.90 * w, 1.0), "crossbar"), diag(0.90 * w, 1.0, 0.04, 0.0), stroke(line(0.04, 0.0, 0.90 * w, 0.0), "crossbar")] };

  // Digits: figure height rides above the x-height, one style DNA.
  const fh = 1.28, dr = 0.40 * w, dcx = dr + 0.02;
  g["0"] = { advance: 2 * dr + 0.04, strokes: [stroke(superellipse(dcx, fh / 2, dr, fh / 2, n), "bowl", true)] };
  g["1"] = { advance: 0.46 * w, strokes: [stem(0.30 * w, 0.0, fh), diag(0.10 * w, fh - 0.22, 0.30 * w, fh)] };
  const arc2 = superellipse(0.42 * w, fh - 0.36, 0.38 * w, 0.36, n22, 0.85 * PI, -0.25 * PI);
  const last2 = arc2[arc2.length - 1];
  g["2"] = { advance: 0.88 * w, strokes: [stroke(arc2.concat(line(last2[0], last2[1], 0.06 * w, 0.0).slice(1)), "spine"), stroke(line(0.06 * w, 0.0, 0.84 * w, 0.0), "crossbar")] };
  g["3"] = { advance: 0.86 * w, strokes: [
    stroke(superellipse(0.40 * w, fh - 0.33, 0.34 * w, 0.33, n22, 0.80 * PI, -0.45 * PI), "bowl"),
    stroke(superellipse(0.40 * w, 0.36, 0.38 * w, 0.36, n22, 0.52 * PI, -0.85 * PI), "bowl")] };
  g["4"] = { advance: 0.92 * w, strokes: [diag(0.58 * w, fh, 0.04, 0.38), stroke(line(0.04, 0.38, 0.86 * w, 0.38), "crossbar"), stem(0.58 * w, 0.0, fh)] };
  g["5"] = { advance: 0.86 * w, strokes: [stroke(line(0.72 * w, fh, 0.10 * w, fh), "crossbar"), stem(0.10 * w, fh - 0.52, fh),
    stroke(superellipse(0.38 * w, 0.40, 0.40 * w, 0.40, n22, 0.70 * PI, -0.90 * PI), "bowl")] };
  g["6"] = { advance: 0.88 * w, strokes: [stroke(superellipse(0.42 * w, 0.40, 0.40 * w, 0.40, n), "bowl", true),
    stroke(superellipse(0.52 * w, fh - 0.52, 0.50 * w, 0.52, n22, 0.55 * PI, 1.0 * PI), "spine")] };
  g["7"] = { advance: 0.84 * w, strokes: [stroke(line(0.04, fh, 0.80 * w, fh), "crossbar"), diag(0.80 * w, fh, 0.26 * w, 0.0)] };
  g["8"] = { advance: 0.88 * w, strokes: [stroke(superellipse(0.42 * w, fh - 0.31, 0.34 * w, 0.31, n), "bowl", true),
    stroke(superellipse(0.42 * w, 0.36, 0.40 * w, 0.36, n), "bowl", true)] };
  g["9"] = { advance: 0.88 * w, strokes: [stroke(superellipse(0.42 * w, fh - 0.40, 0.40 * w, 0.40, n), "bowl", true),
    stroke(superellipse(0.32 * w, 0.52, 0.50 * w, 0.52, n22, -0.45 * PI, 0.0), "spine")] };

  // The minimum punctuation a working face owes its user.
  g["."] = { advance: 0.26 * w, strokes: [dot(0.13 * w, 0.075, 0.075)] };
  g[","] = { advance: 0.26 * w, strokes: [dot(0.13 * w, 0.075, 0.075), stroke(line(0.13 * w, 0.0, 0.06 * w, -0.16), "tail")] };
  g["-"] = { advance: 0.52 * w, strokes: [stroke(line(0.06 * w, 0.5, 0.46 * w, 0.5), "crossbar")] };

  Object.assign(g, buildCaps(params));
  return g;
}
