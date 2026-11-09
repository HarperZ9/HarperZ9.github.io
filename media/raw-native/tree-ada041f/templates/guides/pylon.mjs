// Pylon, the claims inspector: a heavy harbour seal in an orange traffic cone, a municipal
// sash and a clipboard. A cone marks a claim nobody has checked yet. Original character,
// drawn here in code (raw-native licence). Front view, sitting up, tail at the origin,
// about 650 units to the cone's tip.
import { ellipse, lin, rad, hatch, seeded, INK, deform, rotAbout } from "./rig.mjs";

export const PYLON = {
  body: "#7d838c", dark: "#444a54", belly: "#c2bba8", cone: "#f06a1e", coneDark: "#b8410f", band: "#f3eee2",
  sash: "#7e2a1f", brass: "#c79a2b", board: "#7a5230", paper: "#ece2c8", eye: "#0c0b0d", whisker: "#efe9d8",
};
const C = PYLON;
export let BARK = "round";

// Seal mottling: irregular dark rings and spots with alpha, seeded.
export function pylonTextures() {
  const W = 256, H = 256, data = new Uint8Array(W * H * 4), r = seeded("pylon-spots");
  const spots = Array.from({ length: 70 }, () => [r() * W, r() * H, 3 + r() * 9, r()]);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let a = 0;
    for (const [sx, sy, sr, k] of spots) {
      const dx = Math.min(Math.abs(x - sx), W - Math.abs(x - sx)), dy = Math.min(Math.abs(y - sy), H - Math.abs(y - sy));
      const d = Math.hypot(dx * (1 + 0.4 * Math.sin(k * 9 + y * 0.2)), dy) / sr;
      a = Math.max(a, k < 0.4 ? Math.max(0, 1 - Math.abs(d - 0.8) * 4) : Math.max(0, 1 - d * d));
    }
    data.set([34, 36, 42, Math.round(Math.min(1, a) * 150)], 4 * (y * W + x));
  }
  return { "pylon-spots": { width: W, height: H, data } };
}

// The cone itself, apart from the seal, so a scene can stack them or set one down.
export function coneParts(cx, by, { scale = 1, tilt = 0, pivot = null, z = 0, dz = 0 } = {}) {
  const k = scale, P = pivot || [cx, by, z];
  const base = { pivot: P, rot: tilt, stroke: INK, width: 3, dz };
  return [
    { ...base, d: `M ${cx - 76 * k} ${by} L ${cx + 76 * k} ${by} L ${cx + 70 * k} ${by + 12 * k} L ${cx - 70 * k} ${by + 12 * k} Z`, fill: C.coneDark },
    { ...base, d: `M ${cx - 60 * k} ${by} L ${cx - 8 * k} ${by - 140 * k} C ${cx - 4 * k} ${by - 148 * k} ${cx + 10 * k} ${by - 148 * k} ${cx + 14 * k} ${by - 140 * k} L ${cx + 62 * k} ${by} C ${cx + 26 * k} ${by + 12 * k} ${cx - 24 * k} ${by + 12 * k} ${cx - 60 * k} ${by} Z`,
      fill: lin(cx - 60 * k, 0, cx + 62 * k, 0, [0, "#ff9a4a"], [0.4, C.cone], [1, C.coneDark]), dz: dz + 0.1 },
    { ...base, d: `M ${cx - 43 * k} ${by - 46 * k} L ${cx + 46 * k} ${by - 46 * k} L ${cx + 38 * k} ${by - 68 * k} L ${cx - 35 * k} ${by - 68 * k} Z`, fill: C.band, width: 2, dz: dz + 0.2 },
    { ...base, d: `M ${cx - 25 * k} ${by - 94 * k} L ${cx + 29 * k} ${by - 94 * k} L ${cx + 22 * k} ${by - 112 * k} L ${cx - 19 * k} ${by - 112 * k} Z`, fill: C.band, width: 2, dz: dz + 0.2 },
  ];
}

// opts: tilt (head, degrees), lid (0 open .. 1 shut), bark (0..1 mouth open), hat (true: cone on
// the head), card (true: a claim card balanced on the nose), flipL, flipR (front flippers, degrees
// at the shoulder, + raises outward), board (true: clipboard in the right flipper)
export function pylon(o = {}) {
  const { tilt = 0, lid = 0.5, bark = 0, hat = true, card = false, flipL = 0, flipR = 0, board = true, look = [0, 0] } = o;
  const parts = [], add = (p) => parts.push(p);
  // Rear flippers, splayed behind.
  add({ d: "M -40 -6 C -100 10 -170 30 -206 16 C -200 -6 -150 -24 -60 -26 Z", pivot: [-60, -10, -40], fill: C.dark, stroke: INK, width: 3.5 });
  add({ d: "M 40 -6 C 100 10 170 30 206 16 C 200 -6 150 -24 60 -26 Z", pivot: [60, -10, -40], fill: C.dark, stroke: INK, width: 3.5 });
  // The body: a heavy bean, belly, mottling and pen hatching.
  const body = "M -150 -4 C -196 -44 -198 -156 -158 -244 C -128 -312 -98 -352 -78 -384 L 78 -384 C 98 -352 128 -312 158 -244 C 198 -156 196 -44 150 -4 C 80 14 -80 14 -150 -4 Z";
  add({ d: body, name: "body", pivot: [0, -200, 0], side: 0.75, fill: lin(-190, -380, 190, 0, [0, "#9aa0a8"], [0.5, C.body], [1, "#4d535c"]), stroke: INK, width: 4.5 });
  add({ d: "M -96 -14 C -124 -100 -106 -222 -64 -292 C -24 -322 24 -322 64 -292 C 106 -222 124 -100 96 -14 C 50 -2 -50 -2 -96 -14 Z",
    pivot: [0, -150, 60], face: 0, flat: 0.7, fill: lin(0, -300, 0, 0, [0, "#d6cfba"], [1, "#a69f8b"]), stroke: null, clip: "body" });
  add({ d: "M -200 -400 L 200 -400 L 200 20 L -200 20 Z", pivot: [0, -200, 2], side: 0.75, fill: { image: "pylon-spots", rect: [-200, -400, 400, 420] }, clip: "body" });
  add({ d: hatch(-200, -400, 200, 20, { gap: 10, angle: 112, wobble: 6, seed: "pylon-hatch" }), pivot: [0, -200, 3], side: 0.75, fill: null, stroke: [0.05, 0.05, 0.07, 0.35], width: 1.5, clip: "body" });
  // The sash and its badge.
  add({ d: "M -150 -300 L -118 -326 L 164 -96 L 140 -64 Z", pivot: [0, -200, 70], face: 0, flat: 0.5, fill: lin(-150, -300, 160, -80, [0, "#9a3a2a"], [1, C.sash]), stroke: INK, width: 3, clip: "body" });
  add({ d: ellipse(10, -196, 22, 22), pivot: [10, -196, 74], face: 0, flat: 1, fill: rad(4, -202, 24, [0, "#f2d27a"], [1, C.brass]), stroke: INK, width: 3 });
  add({ d: "M 10 -210 L 14 -199 L 25 -199 L 16 -192 L 19 -181 L 10 -188 L 1 -181 L 4 -192 L -5 -199 L 6 -199 Z", pivot: [10, -196, 75], face: 0, flat: 1, fill: "#7a5a14" });
  // Front flippers. The right one holds the clipboard.
  const flipper = (sgn, ang, held) => {
    const sx = 138 * sgn, sy = -236, rot = -ang * sgn, Z = 70;
    const out = [{ d: `M ${sx} ${sy - 4} C ${sx + 34 * sgn} ${sy + 34} ${sx + 46 * sgn} ${sy + 110} ${sx + 30 * sgn} ${sy + 164} C ${sx + 10 * sgn} ${sy + 178} ${sx - 12 * sgn} ${sy + 150} ${sx - 16 * sgn} ${sy + 100} C ${sx - 20 * sgn} ${sy + 50} ${sx - 18 * sgn} ${sy + 14} ${sx} ${sy - 4} Z`,
      pivot: [sx, sy, Z], rot, fill: lin(sx, sy, sx + 40 * sgn, sy + 160, [0, C.body], [1, C.dark]), stroke: INK, width: 3.5, dz: 1 }];
    for (const f of [0, 1, 2]) out.push({ d: `M ${sx + (12 + f * 8) * sgn} ${sy + 150 - f * 8} L ${sx + (16 + f * 9) * sgn} ${sy + 168 - f * 7}`, pivot: [sx, sy, Z], rot, fill: null, stroke: "#d8d2c0", width: 3, dz: 2 });
    if (held) {
      const hx = sx + 18 * sgn, hy = sy + 120;
      out.push({ d: `M ${hx - 52} ${hy - 70} L ${hx + 44} ${hy - 70} L ${hx + 44} ${hy + 62} L ${hx - 52} ${hy + 62} Z`, pivot: [sx, sy, Z], rot, fill: C.board, stroke: INK, width: 3, dz: 0.1 });
      out.push({ d: `M ${hx - 44} ${hy - 58} L ${hx + 36} ${hy - 58} L ${hx + 36} ${hy + 54} L ${hx - 44} ${hy + 54} Z`, pivot: [sx, sy, Z], rot, fill: C.paper, stroke: INK, width: 2, dz: 0.2 });
      for (let i = 0; i < 6; i++) out.push({ d: `M ${hx - 34} ${hy - 40 + i * 16} L ${hx + (i % 3 === 2 ? 0 : 26)} ${hy - 40 + i * 16}`, pivot: [sx, sy, Z], rot, fill: null, stroke: "#6b6050", width: 2, dz: 0.3 });
      out.push({ d: `M ${hx - 16} ${hy - 76} L ${hx + 8} ${hy - 76} L ${hx + 8} ${hy - 60} L ${hx - 16} ${hy - 60} Z`, pivot: [sx, sy, Z], rot, fill: "#9aa0a6", stroke: INK, width: 2, dz: 0.4 });
    }
    return out;
  };
  flipper(-1, flipL, false).forEach(add);
  flipper(1, flipR, board).forEach(add);
  // The head turns about the neck: everything below shares one pivot and the tilt.
  const H = (p) => add({ ...p, pivot: p.pivot || [0, -384, 30], rot: tilt + (p.rot || 0) });
  H({ d: "M -96 -380 C -112 -446 -74 -512 0 -516 C 74 -512 112 -446 96 -380 C 64 -350 -64 -350 -96 -380 Z", name: "head", fill: rad(-24, -470, 150, [0, "#a3a9b1"], [0.6, C.body], [1, "#565c66"]), stroke: INK, width: 4.5, side: 0.85 });
  H({ d: hatch(-120, -520, 120, -350, { gap: 9, angle: 30, wobble: 4, seed: "pylon-head" }), fill: null, stroke: [0.05, 0.05, 0.07, 0.3], width: 1.4, clip: "head", side: 0.85, dz: 0.5 });
  // Muzzle pads, nose, mouth and whiskers face forward.
  const F = (p) => H({ face: 0, flat: 0.85, off: [0, 80], ...p });
  F({ d: ellipse(-24, -404, 30, 22), fill: rad(-30, -410, 30, [0, "#c9c3b2"], [1, "#8d8a80"]), stroke: INK, width: 2.5, dz: 40 });
  F({ d: ellipse(24, -404, 30, 22), fill: rad(18, -410, 30, [0, "#c9c3b2"], [1, "#8d8a80"]), stroke: INK, width: 2.5, dz: 40 });
  F({ d: "M -16 -432 C -10 -442 10 -442 16 -432 C 10 -420 -10 -420 -16 -432 Z", fill: "#1a1718", stroke: INK, width: 2, dz: 42 });
  // The bark: "wide" is the round 1 open jaw; "round" is a small round "o", level and calm
  // (PROGRESS.md, step 12, for the test between them).
  if (bark > 0 && (o.barkShape ?? BARK) === "round") F({ d: ellipse(0, -378 + 6 * bark, 9 + 3 * bark, 5 + 9 * bark), fill: "#3a1a1c", stroke: INK, width: 2.5, dz: 41 });
  else if (bark > 0) F({ d: `M -22 -384 C -12 ${-382 + 26 * bark} 12 ${-382 + 26 * bark} 22 -384 C 10 -380 -10 -380 -22 -384 Z`, fill: "#3a1a1c", stroke: INK, width: 2.5, dz: 41 });
  else F({ d: "M -17 -381 L 17 -381", fill: null, stroke: INK, width: 2.5, dz: 41 });
  for (const sgn of [-1, 1]) for (let i = 0; i < 4; i++) {
    const y0 = -410 + i * 7;
    F({ tag: sgn < 0 ? "whiskL" : "whiskR", d: `M ${sgn * 36} ${y0} C ${sgn * 80} ${y0 - 12 + i * 4} ${sgn * 120} ${y0 - 4 + i * 8} ${sgn * (150 - i * 6)} ${y0 + 6 + i * 10}`, fill: null, stroke: C.whisker, width: 1.8, dz: 43, flat: 0.6 });
  }
  // Eye style "calm" (default since round 4): a heavier lid line that the paint pass cannot bend
  // into a slant, and the catch-lights toward the outer corners; the round 3 drawing read as a
  // scowl at medium size after painting (PROGRESS.md, step 15).
  // Eyes: large and dark, under heavy lids. The deadpan lives in the lids: each lid's lower
  // edge is level (no slant toward the nose, which read as a scowl), so the look is flat and
  // unbothered.
  for (const sgn of [-1, 1]) {
    const ex = sgn * 40, ey = -456, lidY = ey - 21 + 34 * lid;
    F({ d: ellipse(ex, ey, 18, 21), fill: C.eye, stroke: INK, width: 2, dz: 44, name: sgn < 0 ? "eyeL" : "eyeR" });
    F({ d: ellipse(ex + ((o.eyeStyle ?? "calm") === "calm" ? 5 * sgn : -5) + look[0], ey - 8 + look[1] + 12 * lid, 5, 6), fill: "#f4f4f4", dz: 45 });
    F({ d: `M ${ex - 24} ${ey - 4} C ${ex - 22} ${ey - 32} ${ex + 22} ${ey - 32} ${ex + 24} ${ey - 4} L ${ex + 22} ${lidY} L ${ex - 22} ${lidY} Z`,
      fill: lin(0, ey - 28, 0, lidY, [0, "#8c929a"], [1, "#737981"]), stroke: null, dz: 46, clip: sgn < 0 ? "eyeL" : "eyeR" });
    F({ d: `M ${ex - 19} ${lidY} L ${ex + 19} ${lidY}`, fill: null, stroke: INK, width: (o.eyeStyle ?? "calm") === "calm" ? 5.5 : 3, dz: 47 });
  }
  // Profile parts, seen only near a side view (the front-facing face is hidden there): a
  // snout, one eye with its level lid, a nostril, the mouth line and whiskers. Drawn for the
  // side the guide turns toward; the far side's set is the mirror.
  for (const sgn of [1, -1]) {
    const Pf = (p) => H({ face: -90 * sgn, vis: 0.85, side: 1, dz: 60, ...p });
    const m = (x) => sgn * x;
    Pf({ d: `M ${m(50)} -440 C ${m(96)} -446 ${m(122)} -420 ${m(118)} -396 C ${m(112)} -378 ${m(80)} -372 ${m(52)} -384 Z`, fill: rad(m(80), -420, 60, [0, "#a3a9b1"], [1, C.body]), stroke: INK, width: 3.5 });
    Pf({ d: `M ${m(108)} -424 C ${m(116)} -426 ${m(122)} -418 ${m(120)} -410 C ${m(114)} -408 ${m(108)} -414 ${m(108)} -424 Z`, fill: "#1a1718", stroke: INK, width: 2 });
    Pf({ d: `M ${m(116)} -392 L ${m(78)} -386`, fill: null, stroke: INK, width: 2.5 });
    Pf({ d: ellipse(m(40), -456, 13, 18), fill: C.eye, stroke: INK, width: 2, name: sgn > 0 ? "eyeP" : "eyeQ" });
    Pf({ d: `M ${m(26)} -476 L ${m(54)} -476 L ${m(54)} ${-475 + 30 * lid} L ${m(26)} ${-475 + 30 * lid} Z`, fill: "#7a8088", clip: sgn > 0 ? "eyeP" : "eyeQ", dz: 61 });
    Pf({ d: `M ${m(26)} ${-475 + 30 * lid} L ${m(54)} ${-475 + 30 * lid}`, fill: null, stroke: INK, width: 3, dz: 62 });
    for (let i = 0; i < 3; i++) Pf({ d: `M ${m(96)} ${-404 + i * 6} C ${m(130)} ${-410 + i * 8} ${m(160)} ${-402 + i * 10} ${m(184 - i * 8)} ${-392 + i * 12}`, fill: null, stroke: C.whisker, width: 1.8, dz: 63 });
  }
  if (hat) for (const p of coneParts(4, -500, { scale: 1, pivot: [0, -384, 30] })) H({ ...p, rot: 7 + (p.rot || 0), dz: 80 + (p.dz || 0) });
  if (card) {
    // A claim card balanced on the cone's tip: she can hold it there all day, and it tells her nothing.
    H({ d: "M -60 -636 L 84 -648 L 90 -626 L -54 -614 Z", fill: C.paper, stroke: INK, width: 3, dz: 90, rot: 7 });
    for (let i = 0; i < 2; i++) H({ d: `M -40 ${-628 + i * 8} L ${i ? 20 : 70} ${-638 + i * 8}`, fill: null, stroke: "#5b4e3c", width: 2.5, dz: 91, rot: 7 });
  }
  // Secondary motion: whiskers swing about their roots (whisk, degrees; mirrored per side).
  return deform(deform(parts, "whiskL", rotAbout(-(o.whisk || 0), -36, -404)), "whiskR", rotAbout(o.whisk || 0, 36, -404));
}
