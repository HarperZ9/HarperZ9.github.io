// SPDX-License-Identifier: FSL-1.1-MIT
// Copyright 2026 Zain Dana Harper
//
// dataviz-art/stripefield: a series drawn as a ribbed sheet (family G in feed-test-21 CLAIMS.md).
// One rib per observation along the sheet. Two readable encodings, each with its own printed scale:
//   width  the sheet's thickness at a rib, 0..1 of full scale     (read against the width ruler)
//   sway   the offset of the sheet's centre line from the zero line (read against the sway ticks)
// A thin-film tint (substrate thinfilm.mjs) tracks the width, so colour is redundant, never the only signal.
// drawSheet returns the geometry it drew, so a test can read the numbers back from the drawing itself.
import { filmRgb8 } from "../substrate/thinfilm.mjs";

// orientation 'h': time runs left to right; 'v': time runs top to bottom (narrow screens).
export function layout({ w, h, n, orientation = "h", pad = { a0: 64, a1: 24, c0: 40, c1: 40 } }) {
  const along = orientation === "h" ? w : h, across = orientation === "h" ? h : w;
  const a0 = pad.a0, a1 = along - pad.a1, c0 = pad.c0, c1 = across - pad.c1;
  const pitch = (a1 - a0) / n;
  const P = orientation === "h" ? (u, v) => [u, v] : (u, v) => [v, u];
  return { along, across, a0, a1, c0, c1, pitch, P, orientation, mid: (c0 + c1) / 2, span: c1 - c0 };
}

// spec: { width: [0..1], sway: [signed], swayMax, swayShare, film: true, reveal: 0..1, hot, colors }
export function drawSheet(ctx, L, spec) {
  const { width, sway, swayMax, swayShare = 0.32, film = true, filmSat = 0.5, reveal = 1, hot = null, colors } = spec;
  const n = width.length, halfMax = L.span * (1 - swayShare) / 2, swayPx = (L.span * swayShare) / 2;
  const geo = [];
  for (let i = 0; i < n; i++) {
    const s = sway[i] == null ? 0 : sway[i];
    const centre = L.mid - (s / swayMax) * swayPx;  // positive sway lifts the sheet (h) or moves it left (v)
    geo.push({ i, u0: L.a0 + i * L.pitch, u1: L.a0 + (i + 1) * L.pitch, centre, half: width[i] * halfMax, value: width[i], sway: s });
  }
  const shown = Math.max(0, Math.min(n, Math.ceil(reveal * n)));
  const { P } = L;
  for (let k = 0; k < shown; k++) {
    const g = geo[k], nx = geo[Math.min(n - 1, k + 1)];
    // the rib spans its slot; its far edge leans toward the next rib so the sheet reads as one surface
    const cA = g.centre, hA = g.half, cB = (g.centre + nx.centre) / 2, hB = (g.half + nx.half) / 2;
    const quad = [P(g.u0, cA - hA), P(g.u1, cB - hB), P(g.u1, cB + hB), P(g.u0, cA + hA)];
    // the film colour, desaturated toward its own grey so the material reads before the spectrum does
    const raw = film ? filmRgb8(40 + 860 * g.value) : [200, 196, 188], lum = (raw[0] + raw[1] + raw[2]) / 3;
    const [r, gg, b] = raw.map((c) => Math.round(lum + (c - lum) * filmSat) * 0.85 + 34);
    const g0 = P(g.u0, cA), g1 = P(g.u1, cA);
    const grad = ctx.createLinearGradient(g0[0], g0[1], g1[0], g1[1]);
    // rib lighting: dark trough, lit crest, dark trough (measured ribbing reads as material at 38 to 62 per frame)
    const lit = (a) => `rgb(${Math.round(r * a)},${Math.round(gg * a)},${Math.round(b * a)})`;
    grad.addColorStop(0, lit(0.42)); grad.addColorStop(0.55, lit(1)); grad.addColorStop(1, lit(0.5));
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.moveTo(...quad[0]); for (let q = 1; q < 4; q++) ctx.lineTo(...quad[q]); ctx.closePath(); ctx.fill();
  }
  // the sheet's two edges as ink lines (the contour the eye reads the width from)
  ctx.strokeStyle = colors.ink; ctx.lineWidth = 1.25;
  for (const sign of [-1, 1]) {
    ctx.beginPath();
    for (let k = 0; k < shown; k++) { const g = geo[k], p = P(g.u0 + L.pitch / 2, g.centre + sign * g.half); k ? ctx.lineTo(...p) : ctx.moveTo(...p); }
    ctx.stroke();
  }
  if (hot != null && hot < shown) {
    const g = geo[hot];
    ctx.strokeStyle = colors.hot; ctx.lineWidth = 2;
    const a = P(g.u0 + L.pitch / 2, L.c0 - 8), b2 = P(g.u0 + L.pitch / 2, L.c1 + 8);
    ctx.beginPath(); ctx.moveTo(...a); ctx.lineTo(...b2); ctx.stroke();
    const t = P(g.u0 + L.pitch / 2, g.centre - g.half), bt = P(g.u0 + L.pitch / 2, g.centre + g.half);
    ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(...t); ctx.lineTo(...bt); ctx.stroke();
  }
  return { geo, halfMax, swayPx };
}

// The printed scales: zero line and sway ticks, a width ruler, and time ticks. Text stays upright.
export function drawScales(ctx, L, { swayMax, swayTicks, swayShare = 0.32, widthTicks, timeTicks, labels, colors, font }) {
  const { P } = L, halfMax = L.span * (1 - swayShare) / 2, swayPx = (L.span * swayShare) / 2;
  ctx.save();
  ctx.font = font; ctx.fillStyle = colors.soft; ctx.strokeStyle = colors.line; ctx.lineWidth = 1;
  // zero line, dashed, the whole length
  ctx.setLineDash([3, 5]);
  let a = P(L.a0, L.mid), b = P(L.a1, L.mid); ctx.beginPath(); ctx.moveTo(...a); ctx.lineTo(...b); ctx.stroke();
  ctx.setLineDash([]);
  // sway ticks on the leading edge
  ctx.textAlign = L.orientation === "h" ? "right" : "center"; ctx.textBaseline = "middle";
  for (const t of swayTicks) {
    const c = L.mid - (t / swayMax) * swayPx, p0 = P(L.a0 - 10, c), p1 = P(L.a0 - 2, c);
    ctx.beginPath(); ctx.moveTo(...p0); ctx.lineTo(...p1); ctx.stroke();
    const lp = P(L.a0 - (L.orientation === "h" ? 14 : 24), c);
    ctx.fillText((t > 0 ? "+" : "") + t + "%", lp[0], lp[1]);
  }
  // width ruler at the trailing end: one line spanning full scale, centred on the zero line,
  // with a tick pair at each value (the sheet is symmetric about its centre) and the value printed once
  ctx.strokeStyle = colors.soft;
  const ur = L.a1 + 10;
  let p0 = P(ur, L.mid - halfMax), p1 = P(ur, L.mid + halfMax);
  ctx.beginPath(); ctx.moveTo(...p0); ctx.lineTo(...p1); ctx.stroke();
  ctx.textAlign = L.orientation === "h" ? "left" : "center"; ctx.textBaseline = L.orientation === "h" ? "middle" : "top";
  for (const wt of widthTicks) {
    const hh = wt.v * halfMax;
    for (const sgn of [-1, 1]) { const q0 = P(ur - 4, L.mid + sgn * hh), q1 = P(ur + 4, L.mid + sgn * hh); ctx.beginPath(); ctx.moveTo(...q0); ctx.lineTo(...q1); ctx.stroke(); }
    const lp = L.orientation === "h" ? P(ur + 7, L.mid - hh) : P(ur + 8, L.mid - hh);
    ctx.fillText(wt.label, lp[0], lp[1]);
  }
  // time ticks along the far edge
  ctx.textAlign = L.orientation === "h" ? "center" : "left"; ctx.textBaseline = L.orientation === "h" ? "top" : "middle";
  for (const i of timeTicks) {
    const u = L.a0 + (i + 0.5) * L.pitch, p0 = P(u, L.c1 + 2), p1 = P(u, L.c1 + 8);
    ctx.strokeStyle = colors.line; ctx.beginPath(); ctx.moveTo(...p0); ctx.lineTo(...p1); ctx.stroke();
    const lp = P(u, L.c1 + (L.orientation === "h" ? 12 : 12));
    ctx.fillText(String(labels[i]), lp[0], lp[1]);
  }
  ctx.restore();
}

// Inverse of the encoding: which rib is under a point, and the numbers read back from geometry.
export function ribAt(L, geo, x, y) {
  const u = L.orientation === "h" ? x : y;
  const i = Math.floor((u - L.a0) / L.pitch);
  return i >= 0 && i < geo.length ? i : null;
}
export function readBack(g, { halfMax, swayPx, swayMax, mid }) {
  return { width: g.half / halfMax, sway: ((mid - g.centre) / swayPx) * swayMax };
}
