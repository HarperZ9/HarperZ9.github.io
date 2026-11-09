// The harbour's buildings and props, each a drawable { d: depth, items } for the painter's
// sort. The claims office, a half-fallen net shed, a leaning crane, the lamp, bollards, crates,
// the noticeboard, a moored boat, the pier and the far lighthouse. Original art in code.
import { INK, lin, rad, ellipse, P } from "../rig.mjs";
import { S, box, onWall, wallI, wallJ, poly, line, quad, groundShadow, depth } from "./iso_kit.mjs";
import { text } from "../../../web/motion/text.mjs";

export const HC = {
  plaster: "#8f8a69", plasterShade: "#56584a", trim: "#33292a", roof: "#3a3231", rust: "#8a4127", rustDark: "#4e2a1f",
  window: "#f0bf62", windowCore: "#ffe3a3", frame: "#241a15", door: "#3b2a21", bone: "#e3d9bf", iris: "#3d6a6a",
  shed: "#6f4532", shedDark: "#3f2a22", crate: "#7a5a3a", crateDark: "#4a3524", iron: "#1e1c1d", lamp: "#ffd27a",
  hull: "#2b3a44", hullDark: "#172128", deck: "#6b5240", paper: "#e6dcc2", granite: "#8a8478", wall: "#4a4a4f",
};
const C = HC;

// The claims office: plaster walls, a lit window row, the door, the painted eye over it,
// a pitched roof with a chimney, and a CLAIMS board on the roof ridge.
export function office(atlas, { i0 = 0, j0 = 4, i1 = 4, j1 = 11, h = 3.6 } = {}) {
  const items = [], W = wallI(i1), J = wallJ(j1);
  items.push(...box(i0, j0, i1, j1, 0, h, { faceI: lin(...S(i1, j0, h), ...S(i1, j1, 0), [0, "#a39c76"], [1, C.plaster]), faceJ: C.plasterShade, width: 4 }));
  // A plinth of dark stone, a cornice, damp stains running down from the roof.
  items.push(onWall(W, j0, j1, 0, 0.35, "#3b3936", { stroke: INK, width: 2 }), onWall(J, i0, i1, 0, 0.35, "#2e2d2b", { stroke: INK, width: 2 }));
  items.push(onWall(W, j0, j1, h - 0.22, h, C.trim, { stroke: INK, width: 2 }), onWall(J, i0, i1, h - 0.22, h, "#251e1e", { stroke: INK, width: 2 }));
  for (const [u, l] of [[4.6, 1.4], [6.9, 0.9], [9.8, 1.8], [10.6, 0.7]]) items.push({ shape: poly([W(u, h - 0.2), W(u + 0.25, h - 0.2), W(u + 0.12, h - 0.2 - l)]), fill: [0.22, 0.22, 0.17, 0.35] });
  // Windows on the long wall, lit from inside; one dark; mullions.
  for (const [u, lit] of [[4.5, 1], [5.8, 1], [9.2, 0.35], [10.2, 1]]) {
    items.push(onWall(W, u, u + 0.75, 1.0, 2.3, C.frame, { stroke: INK, width: 3 }));
    items.push(onWall(W, u + 0.08, u + 0.67, 1.08, 2.22, lit > 0.5 ? lin(...W(u, 2.2), ...W(u, 1.1), [0, C.windowCore], [1, C.window]) : "#2b2a26"));
    items.push({ shape: line([W(u + 0.375, 1.08), W(u + 0.375, 2.22)]), fill: null, stroke: C.frame, width: 3 }, { shape: line([W(u + 0.08, 1.7), W(u + 0.67, 1.7)]), fill: null, stroke: C.frame, width: 3 });
  }
  // The door, ajar, warm light spilling, a step, and the eye painted above it.
  items.push(onWall(W, 7.0, 8.2, 0, 2.2, C.trim, { stroke: INK, width: 3 }), onWall(W, 7.1, 8.1, 0.05, 2.1, lin(...W(7.1, 2), ...W(7.1, 0), [0, "#ffd890"], [1, "#e09a48"])));
  items.push(onWall(W, 7.1, 7.55, 0.05, 2.1, C.door, { stroke: INK, width: 2 }));
  const [ex, ey] = W(7.6, 3.0);
  items.push({ shape: P(ellipse(ex, ey, 70, 30)), fill: C.bone, stroke: INK, width: 4 }, { shape: P(ellipse(ex, ey, 24, 24)), fill: rad(ex, ey, 24, [0, "#5e8d88"], [1, C.iris]), stroke: INK, width: 3 },
    { shape: P(ellipse(ex, ey, 10, 10)), fill: "#070607" }, { shape: P(ellipse(ex + 6, ey - 7, 4, 4)), fill: "#fffaf0" });
  for (let k = -3; k <= 3; k++) { const a = (k / 3) * 0.9 - Math.PI / 2; items.push({ shape: line([[ex + Math.cos(a) * 78, ey + Math.sin(a) * 36], [ex + Math.cos(a) * 104, ey + Math.sin(a) * 50]]), fill: null, stroke: C.bone, width: 4 }); }
  // A side window on the short wall, dark, and a drainpipe.
  items.push(onWall(J, 1.4, 2.4, 1.2, 2.3, "#24221f", { stroke: INK, width: 3 }));
  items.push({ shape: line([W(j0 + 0.15, h), W(j0 + 0.15, 0)]), fill: null, stroke: "#2a2a2c", width: 9 });
  // The roof: a ridge along j, two slopes, rust streaks, a chimney with smoke, the sign.
  const rz = h + 1.5, mi = (i0 + i1) / 2;
  items.push({ shape: poly([S(i1, j0, h), S(i1, j1, h), S(mi, j1, rz), S(mi, j0, rz)]), fill: lin(...S(i1, j0, h), ...S(mi, j0, rz), [0, "#4a3d38"], [1, C.roof]), stroke: INK, width: 4 });
  items.push({ shape: poly([S(i0, j1, h), S(i1, j1, h), S(mi, j1, rz)]), fill: "#2a2322", stroke: INK, width: 4 });
  for (let u = j0 + 0.4; u < j1; u += 0.55) items.push({ shape: line([S(i1 - 0.05, u, h + 0.04), S(mi + 0.05, u + 0.03, rz - 0.06)]), fill: null, stroke: [0.12, 0.09, 0.08, 0.6], width: 2 });
  for (const u of [5.3, 8.6, 9.1]) items.push({ shape: line([S(mi + 0.4, u, rz - 0.4), S(i1, u + 0.1, h + 0.05)]), fill: null, stroke: [0.55, 0.26, 0.15, 0.55], width: 6 });
  items.push(...box(mi - 0.35, j0 + 1, mi + 0.35, j0 + 1.7, h + 0.8, rz + 1.1, { faceI: "#5a4740", faceJ: "#3a2e2a", top: "#151313" }));
  for (let k = 0; k < 6; k++) { const [sx, sy] = S(mi, j0 + 1.35, rz + 1.3 + k * 0.45); items.push({ shape: P(ellipse(sx - 10 - k * 14, sy, 26 + k * 9, 16 + k * 5)), fill: [0.38, 0.4, 0.42, 0.22 - k * 0.03] }); }
  // The CLAIMS board on two posts over the ridge.
  const sb = (u, z) => S(mi + 0.05, u, z);
  for (const u of [6.4, 9.2]) items.push({ shape: line([sb(u, rz - 0.1), sb(u, rz + 0.75)]), fill: null, stroke: C.iron, width: 7 });
  items.push({ shape: poly([sb(6.0, rz + 0.6), sb(9.6, rz + 0.6), sb(9.6, rz + 1.45), sb(6.0, rz + 1.45)]), fill: "#d8cfae", stroke: INK, width: 4 });
  if (atlas) {
    const [tx, ty] = sb(7.8, rz + 0.92), t = text("CLAIMS", { atlas, size: 70, x: 0, y: 0, anchor: "center" }).shape;
    items.push({ shape: t.map((c) => ({ ...c, pts: shear(c.pts, tx, ty) })), fill: "#7a2a1c" });
  }
  // Everything on the quay stands in front of the office walls, so it sorts by its back corner.
  return { d: depth(i1, j0), items };
}
// Lay text along the +j-facing slope of the board: x along the wall's direction.
function shear(pts, tx, ty) {
  const o = new Float32Array(pts.length), [ux, uy] = [S(0, 1)[0] - S(0, 0)[0], S(0, 1)[1] - S(0, 0)[1]], k = 1 / Math.hypot(ux, uy);
  for (let i = 0; i < pts.length; i += 2) { const x = pts[i], y = pts[i + 1]; o[i] = tx - x * ux * k; o[i + 1] = ty - x * uy * k + y; }
  return o;
}

// The net shed at the back, its roof fallen in: architecture in collapse.
export function shed({ i0 = 0.4, j0 = 0.4, i1 = 3.4, j1 = 3.2, h = 2.4 } = {}) {
  const items = [...box(i0, j0, i1, j1, 0, h, { faceI: lin(...S(i1, j0, h), ...S(i1, j1, 0), [0, C.shed], [1, C.shedDark]), faceJ: "#3a261d", width: 4 })];
  const W = wallI(i1);
  for (let u = j0 + 0.2; u < j1; u += 0.22) items.push({ shape: line([W(u, 0.05), W(u, h - 0.05)]), fill: null, stroke: [0.18, 0.1, 0.07, 0.7], width: 2.5 });
  items.push(onWall(W, j0 + 0.9, j0 + 2.1, 0, 1.7, "#120e0d", { stroke: INK, width: 3 }));
  // Roof: the near half still on, the far half a few hanging sheets and bare rafters.
  items.push(quad([[i0, j1 - 1.2, h], [i1, j1 - 1.2, h + 0.1], [i1 + 0.2, j1 + 0.2, h - 0.3], [i0, j1 + 0.2, h - 0.2]], "#5a3527", { stroke: INK, width: 3 }));
  for (const u of [0.8, 1.4, 2.0]) items.push({ shape: line([S(i0, j0 + u, h + 0.5), S(i1, j0 + u, h + 0.3)]), fill: null, stroke: C.rustDark, width: 6 });
  items.push(quad([[i1 - 0.9, j0 + 0.3, h + 0.4], [i1, j0 + 0.4, h + 0.25], [i1 + 0.3, j0 + 0.6, 0.9], [i1 - 0.4, j0 + 0.5, 1.1]], C.rust, { stroke: INK, width: 3 }));
  // Nets hung to dry on the front wall.
  for (let k = 0; k < 7; k++) items.push({ shape: line([W(j1 - 0.2 - k * 0.12, h - 0.3), W(j1 - 0.5 - k * 0.1, 0.6 + (k % 3) * 0.2)]), fill: null, stroke: [0.55, 0.6, 0.5, 0.45], width: 2 });
  return { d: depth(i1, j0), items };
}

// A crate stack, a bollard, a mooring post and the lamp.
export function crates(ci, cj, n = 3) {
  const items = [...groundShadow(ci + 0.3, cj + 0.3, 0.9, 0.8)];
  const at = [[0, 0, 0], [0.75, 0, 0], [0.2, 0.1, 0.62], [0, 0.8, 0]].slice(0, n + 1);
  for (const [di, dj, z] of at) {
    const i0 = ci + di, j0 = cj + dj;
    items.push(...box(i0, j0, i0 + 0.7, j0 + 0.7, z, z + 0.6, { top: "#8e6c47", faceI: C.crate, faceJ: C.crateDark }));
    items.push({ shape: line([S(i0 + 0.7, j0 + 0.05, z + 0.05), S(i0 + 0.7, j0 + 0.65, z + 0.55)]), fill: null, stroke: C.crateDark, width: 4 });
  }
  return { d: depth(ci + 1.4, cj + 1.5), items };
}
export function bollard(ci, cj) {
  const [x, y] = S(ci, cj), [, yt] = S(ci, cj, 0.42);
  return { d: depth(ci, cj), items: [...groundShadow(ci, cj, 0.32, 0.9),
    { shape: P(`M ${x - 20} ${y} C ${x - 14} ${y - 10} ${x - 12} ${yt + 10} ${x - 22} ${yt} C ${x - 22} ${yt - 16} ${x + 22} ${yt - 16} ${x + 22} ${yt} C ${x + 12} ${yt + 10} ${x + 14} ${y - 10} ${x + 20} ${y} C ${x + 10} ${y + 9} ${x - 10} ${y + 9} ${x - 20} ${y} Z`),
      fill: lin(x - 22, 0, x + 22, 0, [0, "#7a4a32"], [0.5, "#4e2e22"], [1, "#24160f"]), stroke: INK, width: 3 },
    { shape: P(ellipse(x, yt - 5, 21, 8)), fill: "#8a5a3c", stroke: INK, width: 2.5 }] };
}
export function lamp(ci, cj, h = 3.4) {
  const [x, y] = S(ci, cj), [, yt] = S(ci, cj, h), items = [...groundShadow(ci, cj, 0.35, 1)];
  items.push({ shape: P(`M ${x - 7} ${y} L ${x - 5} ${yt} L ${x + 5} ${yt} L ${x + 7} ${y} Z`), fill: C.iron, stroke: INK, width: 3 });
  items.push({ shape: P(`M ${x - 16} ${y} L ${x - 10} ${y - 34} L ${x + 10} ${y - 34} L ${x + 16} ${y} Z`), fill: C.iron, stroke: INK, width: 3 });
  // A crooked arm and the lantern.
  items.push({ shape: P(`M ${x} ${yt + 6} C ${x + 30} ${yt - 30} ${x + 60} ${yt - 20} ${x + 58} ${yt + 10}`), fill: null, stroke: C.iron, width: 7 });
  const lx = x + 58, ly = yt + 34;
  items.push({ shape: P(`M ${lx - 20} ${ly - 22} L ${lx + 20} ${ly - 22} L ${lx + 14} ${ly + 18} L ${lx - 14} ${ly + 18} Z`), fill: rad(lx, ly, 26, [0, "#fff4d0"], [0.6, C.lamp], [1, "#c98a3a"]), stroke: INK, width: 4 });
  items.push({ shape: P(`M ${lx - 26} ${ly - 22} L ${lx} ${ly - 40} L ${lx + 26} ${ly - 22} Z`), fill: C.iron, stroke: INK, width: 3 });
  return { d: depth(ci, cj), items, light: [lx, ly] };
}
// The noticeboard by the door, claims pinned to it.
export function noticeboard(ci, cj) {
  const W = (u, z) => S(ci, u, z), items = [...groundShadow(ci, cj + 0.5, 0.45, 0.8)];
  for (const u of [cj, cj + 1]) items.push({ shape: line([W(u, 0), W(u, 1.5)]), fill: null, stroke: "#2a1f19", width: 7 });
  items.push({ shape: poly([W(cj - 0.1, 0.8), W(cj + 1.1, 0.8), W(cj + 1.1, 1.7), W(cj - 0.1, 1.7)]), fill: "#4a3a2a", stroke: INK, width: 3 });
  for (const [u, z, w, hh] of [[0, 0.95, 0.35, 0.45], [0.42, 1.05, 0.3, 0.5], [0.75, 0.9, 0.28, 0.35], [0.2, 1.3, 0.25, 0.3]])
    items.push({ shape: poly([W(cj + u, z), W(cj + u + w, z), W(cj + u + w, z + hh), W(cj + u, z + hh)]), fill: C.paper, stroke: INK, width: 1.5 });
  return { d: depth(ci, cj + 1), items };
}

// The crane on the quay edge, leaning out over the water, its jib a dark diagonal.
export function crane(ci, cj) {
  const items = [...groundShadow(ci, cj, 0.7, 0.9)], base = S(ci, cj), top = S(ci + 0.5, cj - 0.3, 6.2), tip = S(ci + 3.6, cj - 1.2, 5.6);
  const lattice = (a, b, w) => { const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy), nx = (-dy / L) * w, ny = (dx / L) * w; const out = [{ shape: poly([[a[0] + nx, a[1] + ny], [b[0] + nx * 0.6, b[1] + ny * 0.6], [b[0] - nx * 0.6, b[1] - ny * 0.6], [a[0] - nx, a[1] - ny]]), fill: null, stroke: C.rust, width: 5 }]; for (let k = 0; k < 10; k++) { const t0 = k / 10, t1 = (k + 1) / 10, s0 = 1 - 0.4 * t0, s1 = 1 - 0.4 * t1; out.push({ shape: line([[a[0] + dx * t0 + nx * s0, a[1] + dy * t0 + ny * s0], [a[0] + dx * t1 - nx * s1, a[1] + dy * t1 - ny * s1]]), fill: null, stroke: C.rustDark, width: 3 }); } return out; };
  items.push(...box(ci - 0.5, cj - 0.5, ci + 0.5, cj + 0.5, 0, 0.5, { top: "#3a3532", faceI: "#2a2624", faceJ: "#1e1b1a" }));
  items.push(...lattice(base, top, 26), ...lattice(top, tip, 14));
  items.push({ shape: line([tip, [tip[0], tip[1] + 330]]), fill: null, stroke: "#151313", width: 3 }, { shape: P(ellipse(tip[0], tip[1] + 340, 12, 16)), fill: C.iron, stroke: INK, width: 2 });
  return { d: depth(ci + 0.5, cj + 0.5), items };
}

// A small fishing boat moored in the water, drawn in screen space round the cell it floats
// on: a hull with a sheer that rises to the bow, a rust strake and tyre fenders, a low
// wheelhouse with one lit window, a net pile on the stern, a mast with a lantern.
export function boat(ci, cj, z = -0.6) {
  const [x, y] = S(ci, cj, z), items = [], q = (dx, dy) => `${(x + dx).toFixed(1)} ${(y + dy).toFixed(1)}`;
  items.push({ shape: P(`M ${q(-200, 6)} C ${q(-120, 36)} ${q(130, 36)} ${q(220, 0)} C ${q(130, 20)} ${q(-120, 20)} ${q(-200, 6)} Z`), fill: [0.01, 0.02, 0.03, 0.6] });
  items.push({ shape: P(`M ${q(-180, -58)} C ${q(-60, -70)} ${q(120, -82)} ${q(214, -118)} C ${q(200, -60)} ${q(170, -18)} ${q(120, 2)} C ${q(40, 10)} ${q(-120, 10)} ${q(-162, 0)} C ${q(-176, -18)} ${q(-182, -40)} ${q(-180, -58)} Z`),
    fill: lin(x, y - 100, x, y + 8, [0, "#2f4652"], [0.55, C.hull], [1, C.hullDark]), stroke: INK, width: 4 });
  items.push({ shape: P(`M ${q(-178, -58)} C ${q(-60, -70)} ${q(120, -82)} ${q(212, -116)}`), fill: null, stroke: "#d8cfb4", width: 5 });
  items.push({ shape: P(`M ${q(-170, -30)} C ${q(-60, -40)} ${q(110, -50)} ${q(190, -74)}`), fill: null, stroke: "#8a3a24", width: 9 });
  for (const dx of [-110, -20, 70]) items.push({ shape: P(ellipse(x + dx, y - 40 - dx * 0.06, 13, 15)), fill: "#151414", stroke: INK, width: 2 });
  items.push({ shape: P(`M ${q(-140, -64)} C ${q(-120, -96)} ${q(-80, -100)} ${q(-60, -70)} Z`), fill: "#5e6a52", stroke: INK, width: 3 });
  items.push({ shape: P(`M ${q(-30, -74)} L ${q(70, -82)} L ${q(66, -150)} L ${q(-26, -144)} Z`), fill: lin(x - 30, 0, x + 70, 0, [0, "#7a6550"], [1, "#4c3d30"]), stroke: INK, width: 4 });
  items.push({ shape: P(`M ${q(-14, -112)} L ${q(30, -116)} L ${q(28, -138)} L ${q(-16, -134)} Z`), fill: "#f0bf62", stroke: INK, width: 3 });
  items.push({ shape: P(`M ${q(-40, -142)} L ${q(80, -152)} L ${q(74, -164)} L ${q(-34, -156)} Z`), fill: "#2c2420", stroke: INK, width: 3 });
  const mx = x + 120, my = y - 86;
  items.push({ shape: line([[mx, my], [mx - 6, my - 250]]), fill: null, stroke: "#2a201a", width: 6 }, { shape: line([[mx - 6, my - 250], [x - 176, y - 62]]), fill: null, stroke: "#2a201a", width: 2 });
  const lx = mx - 5, ly = my - 190;
  items.push({ shape: P(ellipse(lx, ly, 10, 13)), fill: rad(lx, ly, 13, [0, "#fff4d0"], [1, C.lamp]), stroke: INK, width: 2 });
  return { d: depth(ci, cj, -1), items, light: [lx, ly] };
}

// The pier: planks on posts running out over the water from the quay.
export function pier(i0, i1, j0, j1, z = 0.05) {
  const items = [];
  for (let i = i0 + 0.4; i < i1; i += 1.1) for (const j of [j0 + 0.1, j1 - 0.1]) {
    const a = S(i, j, z), b = S(i, j, -1.2);
    items.push({ shape: P(`M ${a[0] - 7} ${a[1]} L ${b[0] - 7} ${b[1]} L ${b[0] + 7} ${b[1]} L ${a[0] + 7} ${a[1]} Z`), fill: "#2a211b", stroke: INK, width: 2 });
  }
  items.push(...box(i0, j0, i1, j1, z - 0.12, z, { top: "#5f4a39", faceI: "#3a2d24", faceJ: "#33281f" }));
  for (let j = j0 + 0.22; j < j1; j += 0.22) items.push({ shape: line([S(i0, j, z), S(i1, j, z)]), fill: null, stroke: "#2a1f18", width: 2.5 });
  return { d: depth(i1, j1, -1), items };
}

// The lighthouse far out in the void, a point of warm light and a pale beam: the lone figure
// against something vast.
export function lighthouse(x = 1760, y = 330) {
  return [
    { shape: P(`M ${x - 16} ${y} L ${x - 10} ${y - 120} L ${x + 10} ${y - 120} L ${x + 16} ${y} Z`), fill: "#11141b" },
    { shape: P(`M ${x - 60} ${y + 6} C ${x - 20} ${y - 14} ${x + 30} ${y - 12} ${x + 90} ${y + 6} Z`), fill: "#0d1016" },
    { shape: P(`M ${x} ${y - 128} L ${x - 760} ${y - 210} L ${x - 760} ${y - 140} Z`), blend: "add", fill: lin(x, y - 128, x - 760, y - 170, [0, [0.9, 0.85, 0.7, 0.18]], [1, [0.9, 0.85, 0.7, 0]]) },
    { shape: P(ellipse(x, y - 128, 7, 7)), blend: "add", fill: rad(x, y - 128, 40, [0, [1, 0.85, 0.55, 1]], [1, [1, 0.6, 0.2, 0]]) },
  ];
}
