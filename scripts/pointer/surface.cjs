// surface.cjs: a finish (metal, or a dyed lacquer under a clear coat) and its shading at one point of the form.
//
// Metal: reflection only, spectral Fresnel from the record's n and k at every angle, of the setting's sky and
// ground and of its key light through a GGX lobe. Lacquer: a clear coat (PMMA's measured n) that reflects the same
// way, over a dye layer on a white ground that returns the light the coat lets through, twice filtered by the coat.
'use strict';
const S = require('./spectral.cjs');

const norm3 = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
const add = (a, b, w = 1) => [a[0] + b[0] * w, a[1] + b[1] * w, a[2] + b[2] * w];
const mul = (a, w) => [a[0] * w, a[1] * w, a[2] * w];

// A setting's light. key: the light's spectrum and its direction (x right, y down the screen, z toward the viewer).
function lighting({ key, sky, ground, keyI, skyI, gndI, L }) {
  return { key: S.LIGHTS[key], sky: S.LIGHTS[sky], gnd: S.LIGHTS[ground], keyI, skyI, gndI, L: norm3(L), names: { key, sky, ground } };
}

// spec: { metal: id, rough } or { lacquer: { dye: id, d } | { oklch: [L, C, h] }, rough }
function finish(spec, li) {
  const f = { spec, rough: spec.rough };
  const tables = (id) => ({ key: S.fresnelTable(id, li.key), sky: S.fresnelTable(id, li.sky), gnd: S.fresnelTable(id, li.gnd), white: S.fresnelTable(id, S.LIGHTS.D65) });
  if (spec.metal) { f.kind = 'metal'; f.t = tables(spec.metal); return f; }
  f.kind = 'lacquer'; f.t = tables('pmma');
  const dye = spec.lacquer;
  if (dye.dye) {
    const body = S.dyeLayer(dye.dye, dye.d);
    f.body = { key: S.xyz(body, li.key), sky: S.xyz(body, li.sky) };
  } else {
    // the site's colour token as the dye's colour under daylight, carried to the setting's light by its white
    const lin = S.oklch(...dye.oklch), base = S.fromLinear(lin), wk = S.xyz(new Array(S.GRID.length).fill(1), li.key), ws = S.xyz(new Array(S.GRID.length).fill(1), li.sky);
    const tint = (w) => [base[0] * w[0] / 0.95047, base[1] * w[1], base[2] * w[2] / 1.08883];
    f.body = { key: tint(wk), sky: tint(ws) };
  }
  return f;
}

// environment weights from a direction's upward component (screen y is down)
const skyWeight = (up) => { const t = Math.min(Math.max((up + 0.35) / 0.95, 0), 1); return t * t * (3 - 2 * t); };

// shade one point: n the unit normal, li the lighting. Returns XYZ (white under the key at full light is Y = 1).
function shade(f, n, li) {
  const cv = Math.max(n[2], 1e-3), L = li.L;
  const r = [2 * cv * n[0], 2 * cv * n[1], 2 * cv * n[2] - 1];
  const ws = skyWeight(-r[1]);
  const cl = n[0] * L[0] + n[1] * L[1] + n[2] * L[2];
  let out = add(mul(S.look(f.t.sky, cv), li.skyI * ws), S.look(f.t.gnd, cv), li.gndI * (1 - ws));
  if (cl > 0) {
    const h = norm3([L[0], L[1], L[2] + 1]), ch = Math.max(n[0] * h[0] + n[1] * h[1] + n[2] * h[2], 0), cd = Math.max(h[2], 0);
    const a = Math.max(f.rough * f.rough, 1e-3);
    const spec = (S.ggxD(ch, a) * S.smithG1(cv, a) * S.smithG1(cl, a)) / (4 * cv * cl) * cl;
    out = add(out, S.look(f.t.key, cd), li.keyI * spec);
  }
  if (f.kind === 'lacquer') {
    const Fy = (c) => S.look(f.t.white, c)[1];
    const through = (1 - Fy(cv)) * (1 - Fy(Math.max(cl, 0)));
    const amb = 0.55 + 0.45 * -n[1];
    out = add(out, f.body.key, li.keyI * Math.max(cl, 0) * through);
    out = add(out, f.body.sky, li.skyI * 0.32 * amb * (1 - Fy(cv)));
  }
  return out;
}

// the rim: the same finish at grazing incidence, reflecting the sky or ground the edge faces. With the key line
// outside it, this is the two-tone edge.
function rim(f, side, li) {
  const c = 0.06, ws = skyWeight(-side[1] * 0.9 + 0.25);
  const lit = Math.max(0, side[0] * li.L[0] - side[1] * -li.L[1]);
  let out = add(mul(S.look(f.t.sky, c), li.skyI * (0.75 + 0.25 * ws)), S.look(f.t.gnd, c), li.gndI * (1 - ws) * 0.5);
  out = add(out, S.look(f.t.key, c), li.keyI * 0.35 * lit);
  return out;
}

module.exports = { lighting, finish, shade, rim, norm3 };
