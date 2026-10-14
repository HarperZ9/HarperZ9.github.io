// Rerun, the hermit crab: a small crab whose shell is a faceted glass prism with its receipts
// visible inside. The shell is the evidence a claim carries with it. Original character,
// drawn here in code (raw-native licence). Front view, feet at the origin, about 400 units
// to the top of the shell.
import { ellipse, lin, rad, limb, INK, deform, shearBelow } from "./rig.mjs";

export const RERUN = {
  shell: "#1b2b3a", glassLit: "#bfe6ea", glassMid: "#6fa9b8", glassDark: "#2b4b5e", line: "#e6f3ee",
  body: "#b4492b", bodyDark: "#6e2a1a", bodyLit: "#e07a4c", eye: "#0b0a0c", tally: "#f3e6cf",
};
const C = RERUN;
// The point where light leaves the prism; the spectral flare starts here.
export const FLARE = [146, -318];
// Legs in side view: "front" keeps the front-view legs at every yaw; "profile" swaps them for
// legs drawn side on near 90 degrees (PROGRESS.md, step 14).
export let LEGS = "profile";
export const setLegs = (v) => { LEGS = v; };

// opts: stalk (eye-stalk length, 1 = rest), clawR, clawL (degrees at the shoulder, + raises),
// look ([dx, dy] of the pupils), flare (0..1), shell ("prism" | "pretty" | "none"), tally (bad
// guesses scratched on the big claw), knock (0..1: the big claw raised to knock)
export function rerun(o = {}) {
  const { stalk = 1, clawR = 0, clawL = 0, look = [0, 0], flare = 1, shell = "prism", tally = 4 } = o;
  const parts = [], add = (p) => parts.push(p);
  // Legs: three a side, jointed, behind the body.
  for (const sgn of [-1, 1]) for (let i = 0; i < 3; i++) {
    const hx = sgn * (46 + i * 14), hy = -78 + i * 6, kx = sgn * (110 + i * 26), ky = -120 + i * 18, fx = sgn * (128 + i * 34), fy = -2;
    // Legs spread front to back in depth, so a side view fans them out instead of stacking
    // them; they narrow side on. The far side's legs sit a little deeper.
    const z = 60 - i * 60 + (sgn < 0 ? 6 : 0);
    const hs = (o.legs ?? LEGS) === "profile" ? 0.8 : null;
    add({ d: limb(hx, hy, kx, ky, 18, 14, -6 * sgn), pivot: [hx, hy, z], side: 0.45, hideSide: hs, fill: lin(hx, hy, kx, ky, [0, C.body], [1, C.bodyDark]), stroke: INK, width: 3, dz: -20 });
    add({ d: limb(kx, ky, fx, fy, 14, 4, 4 * sgn), pivot: [kx, ky, z], side: 0.45, hideSide: hs, fill: lin(kx, ky, fx, fy, [0, C.body], [1, C.bodyLit]), stroke: INK, width: 3, dz: -19 });
  }
  if ((o.legs ?? LEGS) === "profile") {
    // Side-on legs, shown only near 90 degrees: three a side, the near three in front of the
    // body and the far three behind it in a darker shade; front legs reach forward, back legs back.
    for (const [near, dz, shade] of [[true, 30, 0], [false, -40, 1]]) for (const sgn of [1, -1]) for (let i = 0; i < 3; i++) {
      const x = (i - 1) * 46 + (near ? 0 : 10), d = i === 0 ? -1 : i === 2 ? 1 : 0.2, kx = x + d * 26, fx = x + d * 50;
      const fill = shade ? C.bodyDark : C.body;
      add({ d: limb(x, -80, kx, -128, 16, 13, 0), pivot: [0, -80, 0], side: 1, face: -90 * sgn, vis: 0.85, fill, stroke: INK, width: 3, dz });
      add({ d: limb(kx, -128, fx, -2, 13, 4, 0), pivot: [0, -80, 0], side: 1, face: -90 * sgn, vis: 0.85, fill, stroke: INK, width: 3, dz: dz + 0.1 });
    }
  }
  // The shell, on its back.
  if (shell === "prism") {
    const out = "M -150 -110 L -112 -300 L 8 -366 L 146 -318 L 168 -150 L 40 -84 Z";
    add({ d: out, name: "shell", pivot: [0, -220, -60], side: 0.8, fill: lin(-150, -360, 160, -90, [0, "#24384c"], [1, C.shell]), stroke: INK, width: 4 });
    // Receipts inside the glass: fine ruled lines, clipped to the shell.
    let rl = "";
    for (let i = 0; i < 26; i++) { const y = -350 + i * 10, w = 60 + ((i * 37) % 70); rl += `M ${-128 + (i % 4) * 6} ${y + 22} L ${-128 + w} ${y + 22 - w * 0.12} `; }
    add({ d: rl, pivot: [0, -220, -59], side: 0.8, fill: null, stroke: [0.88, 0.95, 0.93, 0.55], width: 2, clip: "shell" });
    add({ d: "M -112 -300 L 8 -366 L 146 -318 L 24 -262 Z", pivot: [0, -220, -58], side: 0.8, fill: [0.75, 0.9, 0.92, 0.42], stroke: [0.9, 1, 1, 0.9], width: 2.5 });
    add({ d: "M -150 -110 L -112 -300 L 24 -262 L 40 -84 Z", pivot: [0, -220, -58], side: 0.8, fill: [0.43, 0.66, 0.72, 0.28], stroke: [0.85, 0.97, 1, 0.6], width: 2 });
    add({ d: "M 24 -262 L 146 -318 L 168 -150 L 40 -84 Z", pivot: [0, -220, -58], side: 0.8, fill: [0.12, 0.22, 0.3, 0.55], stroke: [0.85, 0.97, 1, 0.5], width: 2 });
    add({ d: "M -96 -292 L 4 -348 M 30 -250 L 136 -298", pivot: [0, -220, -57], side: 0.8, fill: null, stroke: [1, 1, 1, 0.85], width: 3 });
    // The one spectral flare: light split by the prism into a fan, the art's one hot mark.
    if (flare > 0) {
      const hues = [[1, 0.2, 0.15], [1, 0.6, 0.1], [0.95, 0.95, 0.2], [0.25, 1, 0.35], [0.2, 0.6, 1], [0.6, 0.3, 1]];
      hues.forEach((h, i) => {
        const a = (-34 + i * 7) * Math.PI / 180, L = 150 * flare;
        add({ d: `M ${FLARE[0]} ${FLARE[1]} L ${FLARE[0] + Math.cos(a) * L} ${FLARE[1] + Math.sin(a) * L}`, pivot: [FLARE[0], FLARE[1], -40], side: 0.8,
          fill: null, stroke: [...h, 0.9], width: 5, blend: "add", dz: 100, face: 0, vis: 0.3 });
      });
      add({ d: ellipse(FLARE[0], FLARE[1], 14, 14), pivot: [FLARE[0], FLARE[1], -40], fill: rad(FLARE[0], FLARE[1], 16, [0, [1, 1, 1, 1]], [1, [1, 1, 1, 0]]), blend: "add", dz: 101, face: 0, vis: 0.3 });
    }
  } else if (shell === "pretty") {
    // The gag: an ornate spiral shell, lovely and empty.
    add({ d: "M -150 -100 C -170 -220 -100 -330 10 -340 C 120 -340 170 -250 150 -150 C 130 -90 60 -80 -20 -84 C -80 -86 -130 -90 -150 -100 Z", name: "shell", pivot: [0, -220, -60], side: 0.8,
      fill: rad(-20, -260, 200, [0, "#f6d6c8"], [0.6, "#e0a090"], [1, "#9a5a50"]), stroke: INK, width: 4 });
    add({ d: "M 0 -220 C 40 -220 50 -270 10 -280 C -50 -290 -70 -220 -40 -180 C 0 -130 80 -150 100 -210 C 120 -270 80 -320 20 -330", pivot: [0, -220, -59], side: 0.8, fill: null, stroke: "#7a3e36", width: 4 });
    add({ d: "M 70 -120 L 90 -96 L 60 -104 Z M -110 -130 L -96 -110 L -126 -112 Z", pivot: [0, -220, -58], fill: INK, opacity: 0.8 });
  }
  // The carapace, in front of the shell's mouth.
  add({ d: "M -96 -44 C -110 -110 -66 -164 0 -164 C 66 -164 110 -110 96 -44 C 54 -24 -54 -24 -96 -44 Z", name: "body", pivot: [0, -100, 10],
    fill: rad(-20, -130, 130, [0, C.bodyLit], [0.55, C.body], [1, C.bodyDark]), stroke: INK, width: 4 });
  add({ d: "M -60 -66 C -30 -56 30 -56 60 -66 M -40 -120 C -20 -128 20 -128 40 -120", pivot: [0, -100, 70], face: 0, flat: 0.6, fill: null, stroke: C.bodyDark, width: 3, clip: "body" });
  // Mouthparts.
  // They part as Rerun talks (mouth 0..1): each plate swings out from the centre and a dark gap shows.
  const mo = o.mouth || 0, sp = 9 * mo;
  if (mo > 0.05) add({ d: `M ${-3 - sp} -44 L ${3 + sp} -44 L ${2 + sp * 0.6} -30 L ${-2 - sp * 0.6} -30 Z`, pivot: [0, -40, 79], face: 0, flat: 0.8, fill: "#1a0c08" });
  add({ d: `M ${-16 - sp} -46 L ${-8 - sp} -30 L ${-2 - sp} -46 Z M ${16 + sp} -46 L ${8 + sp} -30 L ${2 + sp} -46 Z`, pivot: [0, -40, 80], face: 0, flat: 0.8, fill: C.bodyDark, stroke: INK, width: 2 });
  // Eye stalks and eyes, which reach for small print.
  for (const sgn of [-1, 1]) {
    const bx = sgn * 26, by = -150, tx = sgn * (40 + 6 * (stalk - 1)), ty = by - 92 * stalk;
    add({ tag: "stalks", d: limb(bx, by, tx, ty, 14, 9, 6 * sgn), pivot: [bx, by, 60], fill: C.body, stroke: INK, width: 3, dz: 10 });
    add({ tag: "stalks", d: ellipse(tx, ty - 6, 16, 18), pivot: [tx, ty, 60], fill: rad(tx - 4, ty - 12, 18, [0, "#3a3540"], [1, C.eye]), stroke: INK, width: 2.5, dz: 11 });
    add({ tag: "stalks", d: ellipse(tx - 4 + look[0], ty - 12 + look[1], 4.5, 5), pivot: [tx, ty, 61], fill: "#ffffff", dz: 12 });
  }
  // Claws: a small left one and a big right one with the tally of its own bad guesses.
  const claw = (sgn, ang, k) => {
    const sx = sgn * 84, sy = -86, rot = -ang * sgn, pv = [sx, sy, 70];
    const P = (p) => add({ pivot: pv, rot, dz: 40, stroke: INK, width: 3.5, ...p });
    P({ d: limb(sx, sy, sx + sgn * 60 * k, sy - 30 * k, 26 * k, 22 * k, -8 * sgn), fill: lin(sx, sy, sx + 60 * sgn, sy - 30, [0, C.body], [1, C.bodyDark]) });
    const cx = sx + sgn * 60 * k, cy = sy - 30 * k, m = (x, y) => `${(cx + sgn * x * k).toFixed(1)} ${(cy + y * k).toFixed(1)}`;
    P({ d: `M ${m(-6, 10)} C ${m(10, -46)} ${m(70, -70)} ${m(112, -40)} C ${m(96, -36)} ${m(70, -30)} ${m(54, -18)} C ${m(80, -14)} ${m(104, 0)} ${m(108, 18)} C ${m(80, 40)} ${m(20, 40)} ${m(-6, 10)} Z`,
      fill: rad(cx + sgn * 30 * k, cy - 20 * k, 90 * k, [0, C.bodyLit], [0.6, C.body], [1, C.bodyDark]), dz: 41 });
    return { cx, cy, m };
  };
  claw(-1, clawL, 0.7);
  const big = claw(1, clawR, 1.15);
  let tl = "";
  for (let i = 0; i < Math.min(tally, 4); i++) tl += `M ${big.m(30 + i * 10, -20)} L ${big.m(26 + i * 10, 6)} `;
  if (tally >= 5) tl += `M ${big.m(22, -10)} L ${big.m(72, -2)} `;
  add({ d: tl || "M 0 0", pivot: [84, -86, 70], rot: -clawR, fill: null, stroke: C.tally, width: 3, dz: 42, opacity: tl ? 1 : 0 });
  // Secondary motion: the stalks lean from their base (stalkLag, a shear above the body).
  return deform(parts, "stalks", shearBelow(-(o.stalkLag || 0), -150));
}
