// system/type-forge/skeletons-caps.mjs
// The capitals, and the runic style (carved caps after the Elder Futhark hand: bowls become facets
// and triangular lobes). Port of the uppercase half of Flywheel's harness/typeface_skeletons.py.
// The caps ride to the cap line on their own proportions with the same pen and roles.

import { superellipse, line, stroke, stem, diag, bar } from "./geometry.mjs";

const PI = Math.PI;

export function buildCaps(params) {
  const w = params.width, n = params.roundness, ap = params.aperture;
  const C = 1.40, cs = 0.02, crx = 0.50 * w;
  const n22 = Math.min(n, 2.2);
  const cring = (cx, rx) => stroke(superellipse(cx, C / 2, rx, C / 2, n), "bowl", true);
  const crhalf = (cy, ry, rx) => stroke(superellipse(cs, cy, rx, ry, Math.min(n, 2.4), 0.5 * PI, -0.5 * PI), "bowl");
  const g = {};

  g.A = { advance: 0.94 * w, strokes: [diag(cs, 0.0, 0.46 * w, C), diag(0.46 * w, C, 0.92 * w, 0.0), bar(0.17 * w, 0.75 * w, 0.42 * C)] };
  g.B = { advance: 0.86 * w, strokes: [stem(cs, 0.0, C), crhalf(C * 0.74, C * 0.26, 0.44 * w), crhalf(C * 0.26, C * 0.26, 0.50 * w)] };
  g.C = { advance: 0.92 * w, strokes: [stroke(superellipse(crx + cs, C / 2, crx, C / 2, n, 0.30 * PI, 2 * PI - 0.30 * PI), "bowl")] };
  g.D = { advance: 0.98 * w, strokes: [stem(cs, 0.0, C), stroke(superellipse(cs, C / 2, 0.88 * w, C / 2, n, 0.5 * PI, -0.5 * PI), "bowl")] };
  g.E = { advance: 0.80 * w, strokes: [stem(cs, 0.0, C), bar(cs, 0.74 * w, C), bar(cs, 0.64 * w, C / 2), bar(cs, 0.74 * w, 0.0)] };
  g.F = { advance: 0.76 * w, strokes: [stem(cs, 0.0, C), bar(cs, 0.74 * w, C), bar(cs, 0.64 * w, C / 2)] };
  g.G = { advance: 1.0 * w, strokes: [stroke(superellipse(crx + cs, C / 2, crx, C / 2, n, 0.30 * PI, 2 * PI - 0.06 * PI), "bowl"),
    stem(2 * crx + cs - 0.02, 0.0, C * 0.46), bar(0.60 * w, 2 * crx + cs, C * 0.46)] };
  g.H = { advance: 0.94 * w, strokes: [stem(cs, 0.0, C), stem(0.90 * w, 0.0, C), bar(cs, 0.90 * w, C / 2)] };
  g.I = { advance: 0.30 * w, strokes: [stem(0.14 * w, 0.0, C)] };
  g.J = { advance: 0.72 * w, strokes: [stem(0.56 * w, C * 0.30, C), stroke(superellipse(0.28 * w, C * 0.30, 0.28 * w, 0.30, n22, 0.0, -PI), "tail")] };
  g.K = { advance: 0.92 * w, strokes: [stem(cs, 0.0, C), diag(cs + 0.04, C * 0.50, 0.86 * w, C), diag(cs + 0.20 * w, C * 0.58, 0.90 * w, 0.0)] };
  g.L = { advance: 0.74 * w, strokes: [stem(cs, 0.0, C), bar(cs, 0.72 * w, 0.0)] };
  g.M = { advance: 1.30 * w, strokes: [stem(cs, 0.0, C), diag(cs, C, 0.64 * w, C * 0.34), diag(0.64 * w, C * 0.34, 1.26 * w, C), stem(1.26 * w, 0.0, C)] };
  g.N = { advance: 0.98 * w, strokes: [stem(cs, 0.0, C), diag(cs, C, 0.92 * w, 0.0), stem(0.92 * w, 0.0, C)] };
  g.O = { advance: 1.0 * w, strokes: [cring(0.50 * w, 0.50 * w)] };
  g.P = { advance: 0.82 * w, strokes: [stem(cs, 0.0, C), crhalf(C * 0.72, C * 0.28, 0.46 * w)] };
  g.Q = { advance: 1.0 * w, strokes: [cring(0.50 * w, 0.50 * w), diag(0.56 * w, C * 0.30, 0.98 * w, -0.12)] };
  g.R = { advance: 0.90 * w, strokes: [stem(cs, 0.0, C), crhalf(C * 0.72, C * 0.28, 0.46 * w), diag(0.40 * w, C * 0.44, 0.92 * w, 0.0)] };
  const sTerm = 0.45 + 0.4 * ap;
  const sTop = superellipse(0.48 * w, C * 0.735, 0.40 * w, C * 0.265, n22, sTerm, 1.5 * PI);
  const sBot = superellipse(0.48 * w, C * 0.265, 0.40 * w, C * 0.265, n22, 0.5 * PI, -PI + sTerm);
  g.S = { advance: 0.92 * w, strokes: [stroke(sTop.concat(sBot.slice(1)), "spine")] };
  g.T = { advance: 0.86 * w, strokes: [bar(cs, 0.84 * w, C), stem(0.43 * w, 0.0, C)] };
  g.U = { advance: 0.94 * w, strokes: [stem(cs, C * 0.28, C), stroke(superellipse(0.46 * w, C * 0.28, 0.46 * w - cs, C * 0.28, n, PI, 2 * PI), "arch"), stem(0.92 * w - cs, C * 0.28, C)] };
  g.V = { advance: 0.94 * w, strokes: [diag(cs, C, 0.47 * w, 0.0), diag(0.47 * w, 0.0, 0.92 * w, C)] };
  g.W = { advance: 1.40 * w, strokes: [diag(cs, C, 0.36 * w, 0.0), diag(0.36 * w, 0.0, 0.69 * w, C * 0.86), diag(0.69 * w, C * 0.86, 1.02 * w, 0.0), diag(1.02 * w, 0.0, 1.38 * w, C)] };
  g.X = { advance: 0.94 * w, strokes: [diag(cs, C, 0.92 * w, 0.0), diag(cs, 0.0, 0.92 * w, C)] };
  g.Y = { advance: 0.92 * w, strokes: [diag(cs, C, 0.46 * w, C * 0.52), diag(0.90 * w, C, 0.46 * w, C * 0.52), stem(0.46 * w, 0.0, C * 0.52)] };
  g.Z = { advance: 0.88 * w, strokes: [bar(cs, 0.86 * w, C), diag(0.86 * w, C, cs, 0.0), bar(cs, 0.86 * w, 0.0)] };

  if (params.style === "runic") Object.assign(g, runic(w, C, cs));
  return g;
}

function runic(w, C, cs) {
  const poly = (points, role = "bowl", closed = false) => {
    const pts = [points[0]];
    for (let i = 1; i < points.length; i++) pts.push(...line(points[i - 1][0], points[i - 1][1], points[i][0], points[i][1], 4).slice(1));
    return stroke(pts, role, closed);
  };
  const tri = (y0, y1, tip) => poly([[cs, y1], [tip, (y0 + y1) / 2.0], [cs, y0]]);
  const diamond = [[0.50 * w, C], [0.98 * w, C / 2], [0.50 * w, 0.0], [0.02 * w, C / 2], [0.50 * w, C]];
  return {
    B: { advance: 0.86 * w, strokes: [stem(cs, 0.0, C), tri(C * 0.52, C, 0.60 * w), tri(0.0, C * 0.50, 0.68 * w)] },
    D: { advance: 0.96 * w, strokes: [stem(cs, 0.0, C), poly([[cs, C], [0.94 * w, C / 2], [cs, 0.0]])] },
    P: { advance: 0.82 * w, strokes: [stem(cs, 0.0, C), tri(C * 0.52, C, 0.58 * w)] },
    R: { advance: 0.90 * w, strokes: [stem(cs, 0.0, C), tri(C * 0.52, C, 0.58 * w), diag(0.30 * w, C * 0.52, 0.92 * w, 0.0)] },
    C: { advance: 0.90 * w, strokes: [poly([[0.86 * w, C], [0.16 * w, C * 0.74], [0.16 * w, C * 0.26], [0.86 * w, 0.0]])] },
    G: { advance: 0.98 * w, strokes: [poly([[0.86 * w, C], [0.16 * w, C * 0.74], [0.16 * w, C * 0.26], [0.86 * w, 0.0], [0.86 * w, C * 0.42], [0.52 * w, C * 0.42]])] },
    O: { advance: 1.0 * w, strokes: [poly(diamond, "bowl", true)] },
    Q: { advance: 1.0 * w, strokes: [poly(diamond, "bowl", true), diag(0.58 * w, C * 0.30, 0.98 * w, -0.14)] },
    S: { advance: 0.88 * w, strokes: [poly([[0.80 * w, C * 0.98], [0.16 * w, C * 0.66], [0.80 * w, C * 0.34], [0.16 * w, C * 0.02]], "spine")] },
    J: { advance: 0.70 * w, strokes: [stem(0.56 * w, C * 0.20, C), poly([[0.56 * w, C * 0.20], [0.30 * w, 0.0], [0.06 * w, C * 0.20]], "tail")] },
    U: { advance: 0.94 * w, strokes: [poly([[cs, C], [cs, C * 0.22], [0.46 * w, 0.0], [0.92 * w, C * 0.22], [0.92 * w, C]], "arch")] },
  };
}
