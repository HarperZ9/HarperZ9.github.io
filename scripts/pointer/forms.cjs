// forms.cjs: the stylus, its states, and the settings that choose its materials.
//
// Units are pixels of the 32 pixel cursor. The stylus lies along one axis from its tip at the upper left: an
// iridium tipping ball, a metal nib with its slit and breather hole, a lacquered section, a metal ferrule, a
// lacquered barrel and a round cap. The tip is the hot spot in every state.
'use strict';
const S = require('./spectral.cjs');
const { lighting, finish } = require('./surface.cjs');

const SIZE = 32, TIP = [6.3, 6.3], AXIS = (() => { const l = Math.hypot(0.6, 0.8); return [0.6 / l, 0.8 / l]; })();
const LIGHT_DIR = [0.5, -0.7, 0.5];   // the site's light: upper right, toward the viewer (depth.css)

// Settings. Each names its light and the material record behind every surface. A platform lacquer is the site's
// colour token used as a dye colour: it is not a measured dye, and the record says so.
const SETTINGS = {
  day: { light: { key: 'D65', sky: 'sky', ground: 'D65', keyI: 1, skyI: 0.85, gndI: 0.25 },
    nib: { metal: 'rhodium', rough: 0.2 }, barrel: { lacquer: { dye: 'rhodamine_6g', d: 1.1e-7 }, rough: 0.12 } },
  night: { light: { key: 'A', sky: 'A', ground: 'A', keyI: 0.95, skyI: 0.5, gndI: 0.1 },
    nib: { metal: 'gold', rough: 0.2 }, barrel: { lacquer: { dye: 'lamp_black', d: 2.2e-7 }, rough: 0.1 } },
  sky: { light: { key: 'D65', sky: 'sky', ground: 'D65', keyI: 1, skyI: 1, gndI: 0.3 },
    nib: { metal: 'silver', rough: 0.18 }, barrel: { lacquer: { dye: 'pedot_pss', d: 3e-6 }, rough: 0.12 } },
};
// platform hues as depth.css sets the face (OKLCH L .86 + lift, chroma, hue): the barrel takes it, the rest is day's
const HUES = { bldlng: [288, 0.1, -0.06], theflywheel: [65, 0.095, 0], theplygrnd: [186, 0.1, 0], thecmmns: [118, 0.105, 0], artiql8: [250, 0.1, -0.06], rsrch: [349, 0.1, -0.03] };
for (const [k, [h, c, lift]] of Object.entries(HUES)) SETTINGS[k] = { ...SETTINGS.day, hue: true, barrel: { lacquer: { oklch: [0.8 + lift, c, h] }, rough: 0.12 } };

function materials(name) {
  const st = SETTINGS[name], li = lighting({ ...st.light, L: LIGHT_DIR });
  return { li, nib: finish(st.nib, li), tip: finish({ metal: 'iridium', rough: 0.3 }, li), barrel: finish(st.barrel, li), pad: finish({ lacquer: { dye: 'lamp_black', d: 1e-6 }, rough: 0.6 }, li),
    ring: S.xyz(new Array(S.GRID.length).fill(0.95), S.LIGHTS[st.light.key]) };
}

const at = (s, off = 0) => [TIP[0] + AXIS[0] * s - AXIS[1] * off, TIP[1] + AXIS[1] * s + AXIS[0] * off];
const seg = (s0, s1, r0, r1, fin, decor) => ({ kind: 'frustum', o: TIP, d: AXIS, s0, s1, r0, r1, fin, decor });

// the stylus: slide pushes the body toward the tip (the nib flexing under a press); phi turns the nib on its axis
function stylus(m, { slide = 0, slitW = 0.34, phi = 0, knurl = null } = {}) {
  const b = 0.85;
  return [
    { kind: 'sphere', c: at(b), r: b, fin: m.tip },
    seg(b, 8 - slide, 0.62, 2.25, m.nib, { slit: [b + 0.5, 6.2 - slide, slitW, phi], hole: [6.3 - slide, 0.42, phi] }),
    seg(8 - slide, 12.6 - slide, 2.45, 2.75, m.barrel, knurl ? { knurl } : undefined),
    seg(12.6 - slide, 13.8 - slide, 3.0, 3.0, m.nib),
    seg(13.8 - slide, 21.6 - slide, 2.9, 2.85, m.barrel),
    { kind: 'sphere', c: at(21.6 - slide), r: 2.85, fin: m.barrel },
  ];
}
const pads = (m, gap) => [-1, 1].map((side) => ({ kind: 'frustum', o: at(0, side * gap), d: AXIS, s0: 8.6, s1: 12.2, r0: 1.05, r1: 1.05, fin: m.pad }))
  .flatMap((p) => [p, { kind: 'sphere', c: [p.o[0] + AXIS[0] * 8.6, p.o[1] + AXIS[1] * 8.6], r: 1.05, fin: m.pad }, { kind: 'sphere', c: [p.o[0] + AXIS[0] * 12.2, p.o[1] + AXIS[1] * 12.2], r: 1.05, fin: m.pad }]);
const ring = (m, r0, r1) => ({ prims: [{ kind: 'annulus', c: TIP, r0, r1, emit: m.ring }] });

const scene = (m, groups, shadow) => ({ size: SIZE, li: m.li, kw: 0.85, kw1: 1.25, rw: 0.5, groups, shadow: shadow && { group: groups.findIndex((g) => g.body), ...shadow } });

// state -> { hot, frames?, build(m, frame) }
const STATES = {
  rest: { hot: [6, 6], build: (m) => scene(m, [{ body: true, prims: stylus(m) }], { off: [-1.1, 1.4], soft: 0.7, alpha: 0.32 }) },
  give: { hot: [6, 6], build: (m) => scene(m, [{ body: true, prims: stylus(m) }, ring(m, 3.1, 3.95)], { off: [-1.9, 2.2], soft: 1, alpha: 0.24 }) },
  pressed: { hot: [6, 6], build: (m) => scene(m, [{ body: true, prims: stylus(m, { slide: 0.7, slitW: 0.62 }) }, ring(m, 0, 2.9)], { off: [-0.45, 0.6], soft: 0.45, alpha: 0.42 }), turn: 18 },
  reach: { hot: [6, 6], build: (m) => scene(m, [{ prims: pads(m, 4.5) }, { body: true, prims: stylus(m) }], { off: [-1.6, 2], soft: 1, alpha: 0.28 }) },
  hold: { hot: [6, 6], build: (m) => scene(m, [{ prims: pads(m, 3.35) }, { body: true, prims: stylus(m, { slide: 0.4, knurl: { period: 0.9, amp: 0.45 } }) }], { off: [-0.6, 0.8], soft: 0.5, alpha: 0.4 }) },
  text: { hot: [16, 16], build: (m) => {
    const bar = (y) => [{ kind: 'frustum', o: [12.9, y], d: [1, 0], s0: 0, s1: 7.2, r0: 1.1, r1: 1.1, fin: m.barrel }, { kind: 'sphere', c: [12.9, y], r: 1.1, fin: m.barrel }, { kind: 'sphere', c: [20.1, y], r: 1.1, fin: m.barrel }];
    return scene(m, [{ prims: bar(5.6) }, { prims: bar(26.4) }, { body: true, prims: [{ kind: 'frustum', o: [16.5, 5.6], d: [0, 1], s0: 0, s1: 20.8, r0: 1.05, r1: 1.05, fin: m.nib }] }], { off: [-0.9, 1.1], soft: 0.6, alpha: 0.3 });
  } },
  busy: { hot: [6, 6], frames: 4, build: (m, f = 0) => {
    const a0 = -Math.PI / 2 + (f * Math.PI) / 2;
    return scene(m, [{ body: true, prims: stylus(m, { phi: [0, 0.75, 0, -0.75][f] }) }, { prims: [{ kind: 'torus', c: [23.4, 8.6], R: 4.1, r: 1.1, arc: [a0, a0 + 1.5 * Math.PI], fin: m.nib }] }], { off: [-1.1, 1.4], soft: 0.7, alpha: 0.32 });
  } },
};
const HUE_STATES = ['rest', 'give', 'pressed'];

// the pressed state turns the key light, so the highlight moves on the form
function sceneFor(setting, state, frame = 0) {
  const m = materials(setting), st = STATES[state];
  if (st.turn) {
    const a = (st.turn * Math.PI) / 180, [x, y, z] = m.li.L;
    m.li = { ...m.li, L: [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a), z] };
    for (const k of ['nib', 'tip', 'barrel']) m[k] = finish(SETTINGS[setting][k] || { metal: 'iridium', rough: 0.3 }, m.li);
  }
  return st.build(m, frame);
}

// which record each surface of a setting uses, for the build's record and the report
function recordOf(setting) {
  const st = SETTINGS[setting], lq = st.barrel.lacquer;
  return { light: st.light.key, nib: st.nib.metal, ferrule: st.nib.metal, tip: 'iridium',
    barrel: lq.dye ? `${lq.dye} dye layer ${lq.d} m under a pmma coat` : `the site's colour token oklch(${lq.oklch.map((v) => +v.toFixed(3)).join(' ')}) as the dye colour under a pmma coat; not a measured dye`,
    grip_pads: 'lamp_black under a matte pmma coat' };
}

module.exports = { SIZE, SETTINGS, HUES, STATES, HUE_STATES, sceneFor, recordOf };
