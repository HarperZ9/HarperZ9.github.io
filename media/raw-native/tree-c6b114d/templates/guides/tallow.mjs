// Tallow, the night clerk: a tall, stooped clerk whose head is a lit candle, one eye in the
// wax under the wick. The wax is the budget of hours; the flame is what has been checked.
// Original character, drawn here in code (raw-native licence). Front view, feet at the
// origin, about 800 units from the soles to the flame tip.
import { ellipse, lin, rad, limb, hatch, INK, deform, shearBelow } from "./rig.mjs";

export const TALLOW = {
  coat: "#262531", coatLit: "#4a4252", trouser: "#17161c", shoe: "#0d0c0e", wax: "#efe3c9", waxMid: "#d6c29b",
  waxShade: "#9c845c", hand: "#d8c6a5", ledger: "#6e2a22", page: "#ebdfc2", brass: "#b8892e", iris: "#6b4420",
};
const C = TALLOW;
// The flame's tip, for lights and glows the scene adds.
export const FLAME = [6, -738];
// The flame's default look; set from the flame test in PROGRESS.md, step 9.
export let FLAME_STYLE = "over";
export const setFlameStyle = (v) => { FLAME_STYLE = v; };
export let MOUTH = "open";
export const setMouth = (v) => { MOUTH = v; };

// opts: armL, armR (degrees at the shoulder, + swings the hand outward), elbL, elbR (degrees
// at the elbow, added to the shoulder angle), prop ("ledger" | "card" |
// "jar" | "loupe" | null), propL ("ledger" | "jar" | null), lid (0 open .. 1 shut), look ([dx, dy]
// of the iris), flame (scale), lean (flame lean in degrees), drip (0..1 of a drip pinched off)
export function tallow(o = {}) {
  const { armL = 10, armR = 6, prop = null, propL = "ledger", lid = 0.5, look = [0, 0], flame = 1, lean = 0, mouth = 0 } = o;
  const parts = [];
  const add = (p) => parts.push(p);
  // Shoes and legs.
  for (const sgn of [-1, 1]) {
    const x = 26 * sgn;
    add({ d: `M ${x - 10 * sgn} -22 C ${x + 4 * sgn} -26 ${x + 44 * sgn} -18 ${x + 52 * sgn} -4 C ${x + 40 * sgn} 2 ${x + 4 * sgn} 2 ${x - 14 * sgn} 0 Z`,
      pivot: [x, -10, 10], dz: -60, fill: C.shoe, stroke: INK, width: 3, side: 0.8 });
    add({ d: limb(x, -330, x + 2 * sgn, -18, 40, 26, 4 * sgn), pivot: [x, -170, 0], dz: -60, fill: lin(x - 20, 0, x + 20, 0, [0, "#232129"], [1, C.trouser]), stroke: INK, width: 3, side: 0.9 });
  }
  // The coat: long, flared, stooped.
  add({ tag: "coat", d: "M -80 -505 C -104 -470 -114 -380 -120 -300 C -126 -220 -140 -160 -156 -104 C -96 -90 -36 -98 0 -108 C 36 -98 96 -90 156 -104 C 140 -160 126 -220 120 -300 C 114 -380 104 -470 80 -505 C 40 -520 -40 -520 -80 -505 Z",
    pivot: [0, -300, 0], side: 0.62, fill: lin(-150, -500, 150, -110, [0, C.coatLit], [0.45, C.coat], [1, "#16151c"]), stroke: INK, width: 4, name: "coat" });
  // Folds and the front edge, drawn as ink.
  add({ tag: "coat", d: "M -4 -470 C -2 -380 -8 -250 -2 -110", pivot: [0, -300, 30], fill: null, stroke: INK, width: 3, face: 0, flat: 0.8 });
  add({ tag: "coat", d: "M -70 -330 C -84 -260 -96 -190 -110 -120 M 64 -360 C 78 -280 92 -200 112 -118", pivot: [0, -300, 20], fill: null, stroke: "#0f0e14", width: 2.5, face: 0, flat: 0.6 });
  for (const yb of [-430, -372, -314]) add({ tag: "coat", d: ellipse(10, yb, 6, 6), pivot: [10, yb, 34], fill: C.brass, stroke: INK, width: 2, face: 0, flat: 1 });
  // Lapels and the high collar.
  add({ tag: "coat", d: "M -6 -470 L -44 -505 L -70 -500 C -56 -470 -36 -440 -10 -400 Z", pivot: [-30, -470, 30], fill: "#1c1b23", stroke: INK, width: 3, face: 0, flat: 0.7 });
  add({ tag: "coat", d: "M 6 -470 L 44 -505 L 70 -500 C 56 -470 36 -440 10 -400 Z", pivot: [30, -470, 30], fill: "#1c1b23", stroke: INK, width: 3, face: 0, flat: 0.7 });
  add({ tag: "coat", d: hatch(-160, -520, 160, -90, { gap: 8, angle: 62, wobble: 5, seed: "tallow-coat" }), pivot: [0, -300, 1], side: 0.62, fill: null, stroke: [0.02, 0.02, 0.03, 0.55], width: 1.4, clip: "coat" });
  add({ tag: "coat", d: hatch(-160, -520, 160, -90, { gap: 13, angle: -30, wobble: 7, seed: "tallow-coat-2" }), pivot: [0, -300, 1], side: 0.62, fill: null, stroke: [0.02, 0.02, 0.03, 0.3], width: 1.2, clip: "coat" });
  // Wax spattered on the shoulders: hours already spent.
  add({ tag: "coat", d: "M -70 -500 C -66 -512 -50 -512 -48 -500 C -50 -486 -56 -470 -60 -478 C -62 -488 -72 -490 -70 -500 Z", pivot: [-60, -495, 12], fill: C.waxMid, stroke: INK, width: 2 });
  add({ tag: "coat", d: "M 52 -498 C 56 -508 72 -506 72 -496 C 70 -488 66 -462 60 -470 C 58 -480 50 -488 52 -498 Z", pivot: [62, -490, 12], fill: C.waxMid, stroke: INK, width: 2 });
  add({ tag: "coat", d: "M -78 -500 C -86 -540 -64 -566 -46 -548 L -34 -500 Z", pivot: [-56, -520, 4], dz: -30, fill: C.coat, stroke: INK, width: 3 });
  add({ tag: "coat", d: "M 78 -500 C 86 -540 64 -566 46 -548 L 34 -500 Z", pivot: [56, -520, 4], dz: -30, fill: C.coat, stroke: INK, width: 3 });
  // The candle head, with its drips, the pool and the wick.
  add({ d: "M -44 -492 L -46 -636 C -46 -650 -30 -658 -14 -654 C -4 -662 8 -661 16 -655 C 30 -660 46 -650 46 -638 L 44 -492 C 20 -484 -20 -484 -44 -492 Z",
    pivot: [0, -570, 0], fill: lin(-46, 0, 46, 0, [0, C.waxShade], [0.28, C.wax], [0.62, C.wax], [1, C.waxMid]), stroke: INK, width: 3.5, name: "head" });
  add({ d: hatch(-50, -660, 50, -490, { gap: 7, angle: 100, wobble: 2, seed: "tallow-wax" }), pivot: [0, -570, 1], fill: null, stroke: [0.42, 0.3, 0.16, 0.35], width: 1.3, clip: "head" });
  add({ d: "M 46 -632 C 56 -600 54 -560 50 -536 C 47 -524 38 -526 38 -540 L 40 -628 Z", pivot: [46, -580, 4], fill: C.waxMid, stroke: INK, width: 2.5 });
  add({ d: "M -22 -652 C -18 -626 -28 -606 -24 -596 C -19 -588 -12 -594 -12 -606 L -8 -652 Z", pivot: [-16, -620, 46], fill: C.wax, stroke: INK, width: 2, face: 0, flat: 0.9 });
  add({ d: "M -46 -620 C -56 -590 -52 -566 -46 -560 Z", pivot: [-46, -590, 4], fill: C.waxMid, stroke: INK, width: 2 });
  add({ d: "M -38 -650 C -26 -664 30 -664 40 -650 C 28 -642 -26 -642 -38 -650 Z", pivot: [0, -652, 10], fill: "#fff5dc", stroke: null, opacity: 0.95 });
  add({ d: "M 2 -655 C 0 -668 8 -676 4 -688", pivot: [2, -670, 12], fill: null, stroke: INK, width: 4 });
  // The eye: sclera, iris, pupil, a highlight, a heavy lid and a bag beneath.
  const [lx, ly] = look, ey = -572, lidY = -590 + 30 * lid;
  add({ d: "M -28 -572 C -14 -590 14 -590 28 -572 C 14 -556 -14 -556 -28 -572 Z", pivot: [0, ey, 46], fill: "#f6eedd", stroke: INK, width: 2.5, face: 0, flat: 1, name: "eye" });
  add({ d: ellipse(2 + lx, ey + ly, 11, 11), pivot: [0, ey, 47], fill: rad(2 + lx, ey + ly, 11, [0, "#e3a24a"], [0.55, C.iris], [1, "#2a1a0e"]), clip: "eye", face: 0, flat: 1 });
  add({ d: ellipse(2 + lx, ey + ly, 5, 5), pivot: [0, ey, 48], fill: "#090808", clip: "eye", face: 0, flat: 1 });
  add({ d: ellipse(6 + lx, ey + ly - 4, 2.5, 2.5), pivot: [0, ey, 49], fill: "#ffffff", clip: "eye", face: 0, flat: 1 });
  // The lid: a dome whose lower edge is a straight line, level with the eye, so the look is
  // half-shut and flat, never a scowl.
  add({ d: `M -31 -571 C -15 -596 15 -596 31 -571 L 31 ${lidY} L -31 ${lidY} Z`, pivot: [0, ey, 50], fill: lin(0, -594, 0, lidY, [0, C.wax], [1, C.waxMid]), stroke: INK, width: 2.5, face: 0, flat: 1, clip: "eye" });
  add({ d: `M -31 ${lidY} L 31 ${lidY}`, pivot: [0, ey, 51], fill: null, stroke: INK, width: 3, face: 0, flat: 1 });
  add({ d: "M -28 -572 C -14 -590 14 -590 28 -572 C 14 -556 -14 -556 -28 -572 Z", pivot: [0, ey, 52], fill: null, stroke: INK, width: 2.5, face: 0, flat: 1 });
  add({ d: "M -20 -555 C -8 -549 8 -549 20 -555", pivot: [0, -553, 46], fill: null, stroke: C.waxShade, width: 2.5, face: 0, flat: 1 });
  // The mouth: "line" is a drawn crease that bends open; "open" is a dark opening in the wax
  // with a lip of shadow, readable at medium size (PROGRESS.md, step 14).
  if (mouth && (o.mouthStyle ?? MOUTH) === "open") {
    add({ d: `M -20 -531 C -11 ${-530 + 26 * mouth} 11 ${-530 + 26 * mouth} 20 -531 C 10 ${-527 + 3 * mouth} -10 ${-527 + 3 * mouth} -20 -531 Z`, pivot: [0, -528, 45], fill: "#24120a", stroke: C.waxShade, width: 2.5, face: 0, flat: 1 });
    add({ d: `M -14 -533 C -6 -536 6 -536 14 -533`, pivot: [0, -533, 45.5], fill: null, stroke: C.waxShade, width: 2, face: 0, flat: 1 });
  } else if (mouth) add({ d: `M -12 -528 C -4 ${-528 + 10 * mouth} 6 ${-528 + 10 * mouth} 14 -530`, pivot: [0, -528, 45], fill: null, stroke: C.waxShade, width: 3, face: 0, flat: 1 });
  // Arms: an upper sleeve that swings at the shoulder, a forearm that bends at the elbow, a cuff
  // and a mitten hand with a thumb. Angles: 0 hangs down, + swings the hand outward; the elbow
  // adds to the shoulder angle. Props are held at the fingers and turn with the forearm.
  const arm = (sgn, ang, elb, held) => {
    const sx = 76 * sgn, sy = -482, L1 = 116, L2 = 100, R = Math.PI / 180;
    const dir = (t) => [sgn * Math.sin(t * R), Math.cos(t * R)];
    const [ux, uy] = dir(ang), ex = sx + 8 * sgn + ux * L1, ey = sy + 6 + uy * L1;
    const t2 = ang + elb, [vx, vy] = dir(t2), wx = ex + vx * L2, wy = ey + vy * L2, rot = -sgn * t2;
    const sleeve = (d, fill, dz) => ({ d, pivot: [sx, sy, 0], fill, stroke: INK, width: 3.5, dz });
    const out = [
      sleeve(limb(sx, sy - 4, ex, ey, 46, 36, 5 * sgn), lin(sx - 30, sy, sx + 40, sy + 120, [0, "#5a5163"], [1, "#3a3646"]), 30),
      sleeve(ellipse(ex, ey, 18, 18), "#3a3646", 30.5),
      sleeve(limb(ex, ey, wx, wy, 36, 31, -3 * sgn), lin(ex, ey, wx, wy, [0, "#443f52"], [1, "#2e2c38"]), 31),
    ];
    // Cuff and hand in the forearm's own frame: the wrist at the origin, fingers toward +y.
    const H = (d, fill, extra = {}) => out.push({ d, pivot: [wx, wy, 0], rot, fill, stroke: INK, width: 2.5, dz: 32, ...extra });
    const q = (x, y) => `${(wx + x).toFixed(1)} ${(wy + y).toFixed(1)}`;
    H(`M ${q(-18, -6)} L ${q(18, -6)} L ${q(17, 8)} L ${q(-17, 8)} Z`, "#1e1c25", { dz: 32.2 });
    H(`M ${q(-15, 6)} C ${q(-19, 22)} ${q(-17, 42)} ${q(-8, 50)} C ${q(-2, 55)} ${q(8, 55)} ${q(13, 48)} C ${q(19, 38)} ${q(18, 20)} ${q(15, 6)} Z`, C.hand, { dz: 32.1 });
    H(`M ${q(-14 * sgn, 14)} C ${q(-28 * sgn, 16)} ${q(-30 * sgn, 30)} ${q(-18 * sgn, 34)} C ${q(-14 * sgn, 34)} ${q(-12 * sgn, 28)} ${q(-12 * sgn, 24)}`, C.hand, { dz: 32.15 });
    H(`M ${q(-4, 34)} L ${q(-4, 48)} M ${q(5, 34)} L ${q(5, 48)}`, null, { stroke: C.waxShade, width: 2, dz: 32.3 });
    // Props stay upright and hang from the fingertips (the loupe turns with the hand).
    const fx = wx + vx * 44, fy = wy + vy * 44;
    const Pp = (d, fill, extra = {}) => out.push({ d, pivot: [wx, wy, 0], fill, stroke: INK, width: 2.5, dz: 33, ...extra });
    const g = (x, y) => `${(fx + x).toFixed(1)} ${(fy + y).toFixed(1)}`;
    if (held === "ledger") {
      Pp(`M ${g(-44, -26)} L ${g(30, -36)} L ${g(40, 56)} L ${g(-34, 66)} Z`, C.ledger, { dz: 31.5 });
      Pp(`M ${g(30, -36)} L ${g(36, -32)} L ${g(46, 58)} L ${g(40, 56)} Z`, C.page, { dz: 31.6 });
      Pp(`M ${g(-28, 10)} L ${g(20, 4)}`, null, { stroke: C.brass, width: 3, dz: 31.7 });
    } else if (held === "card" || held === "blank") {
      const cx = vx * 30, cy = vy * 30;
      Pp(`M ${g(cx - 48, cy - 34)} L ${g(cx + 44, cy - 44)} L ${g(cx + 50, cy + 18)} L ${g(cx - 42, cy + 28)} Z`, C.page);
      if (held === "card") for (let i = 0; i < 4; i++) Pp(`M ${g(cx - 32, cy - 20 + i * 11)} L ${g(cx + (i === 3 ? 4 : 34), cy - 28 + i * 11)}`, null, { stroke: "#5b4e3c", width: 2.5, dz: 33.1 });
    } else if (held === "jar") {
      Pp(`M ${g(-30, -6)} L ${g(30, -6)} L ${g(34, 76)} C ${g(20, 86)} ${g(-20, 86)} ${g(-34, 76)} Z`, [0.75, 0.82, 0.8, 0.35]);
      Pp(`M ${g(-28, 50)} C ${g(-10, 42)} ${g(10, 56)} ${g(30, 46)} L ${g(32, 76)} C ${g(20, 84)} ${g(-20, 84)} ${g(-32, 76)} Z`, C.waxMid, { stroke: null, dz: 32.9 });
      Pp(`M ${g(-24, 12)} L ${g(24, 12)} L ${g(24, 30)} L ${g(-24, 30)} Z`, C.page, { width: 1.5, dz: 33.1 });
      Pp(`M ${g(-34, -16)} L ${g(34, -16)} L ${g(32, -4)} L ${g(-32, -4)} Z`, C.brass, { dz: 33.1 });
    } else if (held === "loupe") {
      const L = (d, fill, extra) => out.push({ d, pivot: [wx, wy, 0], rot, fill, stroke: INK, width: 2.5, dz: 33, ...extra });
      L(`M ${q(-3, 40)} L ${q(1, 78)}`, null, { stroke: "#3b2a1a", width: 9, dz: 32.9 });
      L(ellipse(wx + 2, wy + 106, 30, 30), [0.85, 0.9, 0.95, 0.22], { stroke: C.brass, width: 7 });
    }
    return out;
  };
  // Default elbows: a little bend when hanging, a crook when raised, folded up when the arm
  // crosses the body (the loupe to the eye).
  const elbow = (a) => (a > 90 ? 22 : a < -20 ? -75 : 12);
  arm(-1, armL, o.elbL ?? elbow(armL), propL).forEach(add);
  arm(1, armR, o.elbR ?? elbow(armR), prop).forEach(add);
  // The flame, last: an outer tongue and a hot core, leaning by `lean`. flameStyle "add" lays
  // them on as light; "over" paints them as opaque colour with an ink edge, so a paint pass or
  // a palette keeps the hue (see PROGRESS.md, step 9, for the test that chose between them).
  const fx = FLAME[0], h = 92 * flame, over = (o.flameStyle ?? FLAME_STYLE) === "over";
  const outer = `M 4 -686 C ${-20 * flame} ${-700 - h * 0.15} ${-22 * flame} ${-700 - h * 0.6} ${fx} ${-686 - h} C ${26 * flame} ${-700 - h * 0.55} ${28 * flame} ${-700 - h * 0.15} 4 -686 Z`;
  const core = `M 4 -688 C -6 -696 -8 ${-700 - h * 0.3} 4 ${-690 - h * 0.55} C 14 ${-700 - h * 0.3} 12 -696 4 -688 Z`;
  if (over) {
    add({ d: outer, pivot: [4, -686, 12], rot: lean, fill: lin(4, -686, 4, -686 - h, [0, "#e8641c"], [0.45, "#f59a2e"], [1, "#ffc04a"]), stroke: INK, width: 2.5, dz: 200 });
    add({ d: core, pivot: [4, -686, 12], rot: lean, fill: lin(4, -688, 4, -690 - h * 0.55, [0, "#ffd36b"], [1, "#fff2c2"]), dz: 201 });
  } else {
    add({ d: outer, pivot: [4, -686, 12], rot: lean, fill: rad(4, -700 - h * 0.25, h * 0.75, [0, "#fff8e8"], [0.35, "#ffd27a"], [0.75, "#ff8a2a"], [1, [1, 0.35, 0.05, 0]]), blend: "add", dz: 200 });
    add({ d: core, pivot: [4, -686, 12], rot: lean, fill: rad(4, -700, h * 0.4, [0, "#ffffff"], [0.6, "#fff0c8"], [1, [1, 0.8, 0.45, 0.6]]), blend: "add", dz: 201 });
  }
  // Secondary motion: the coat's skirt trails below the collar (coatSway, a shear).
  return deform(parts, "coat", shearBelow(o.coatSway || 0, -505));
}
