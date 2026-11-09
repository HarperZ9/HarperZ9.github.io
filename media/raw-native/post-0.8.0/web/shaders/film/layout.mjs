// The film passes' parameter block and spectral tables, packed for the GPU. Field names the
// CRT halo passes read (outW, outH, gw, gh, haloQ, haloR) are shared, so those passes run here.
import { weave } from "./film.mjs";
import { LAMBDA } from "./stocks.mjs";
import { J_TABLE_N, MU_LEVELS, MU_MAX, POIS_K } from "./grain.mjs";

const FIELDS = [
  ["outW"], ["outH"], ["inW"], ["inH"], ["evK"], ["E", 9], ["weave", 2], ["umPerPx"], ["grainR", 3], ["grainCs", 3], ["frame"],
  ["haloQ"], ["haloR"], ["gw"], ["gh"], ["haloS", 3],
  ["negDmin", 3], ["negSpan", 3], ["negK", 3], ["negX0", 3], ["interimage"],
  ["prtDmin", 3], ["prtSpan", 3], ["prtK", 3], ["logGain", 3], ["bleach"], ["printBase"], ["outM", 9], ["mtfDir"],
];
export const FILM_INDEX = {};
let n = 0;
for (const [name, len = 1] of FIELDS) { FILM_INDEX[name] = n; n += len; }
export const FILM_PARAM_COUNT = n;
export const FILM_LAYOUT_WGSL = Object.entries(FILM_INDEX).map(([k, v]) => `const P_${k}: u32 = ${v}u;`).join("\n");

const L = LAMBDA.length;
export const TAB = { negPrim: 0, negConst: 3 * L, printW: 4 * L, printPrim: 7 * L, projV: 10 * L, J: 13 * L, count: 13 * L + J_TABLE_N };
export const TAB_WGSL = Object.entries(TAB).map(([k, v]) => `const T_${k}: u32 = ${v}u;`).join("\n")
  + `\nconst NL: u32 = ${L}u;\nconst JN: u32 = ${J_TABLE_N}u;\nconst MU_LEVELS: u32 = ${MU_LEVELS}u;\nconst POIS_K: u32 = ${POIS_K}u;\nconst MU_MAX: f32 = ${MU_MAX};`;

export function packTables(plan) {
  const t = plan.t, a = new Float32Array(TAB.count);
  for (let w = 0; w < L; w++) {
    for (let c = 0; c < 3; c++) {
      a[TAB.negPrim + w * 3 + c] = t.negPrim[w][c]; a[TAB.printW + w * 3 + c] = t.printW[w][c];
      a[TAB.printPrim + w * 3 + c] = t.printPrim[w][c]; a[TAB.projV + w * 3 + c] = t.projV[w][c];
    }
    a[TAB.negConst + w] = t.negConst[w];
  }
  a.set(plan.jTable, TAB.J);
  return a;
}

export function packFilmParams(plan, f) {
  const a = new Float32Array(FILM_PARAM_COUNT), t = plan.t, set = (k, v, o = 0) => { a[FILM_INDEX[k] + o] = v; };
  const arr = (k, vs) => vs.forEach((v, i) => set(k, v, i));
  set("outW", plan.out.w); set("outH", plan.out.h); set("inW", plan.input.w); set("inH", plan.input.h);
  set("evK", Math.pow(2, plan.p.ev)); arr("E", t.E); arr("weave", weave(plan, f)); set("umPerPx", plan.umPerPx);
  arr("grainR", plan.grainUm); arr("grainCs", plan.grainContrast.map((c) => c * plan.p.grainAmount)); set("frame", f);
  set("haloQ", plan.halo.q); set("haloR", plan.halo.R); set("gw", Math.ceil(plan.out.w / plan.halo.q)); set("gh", Math.ceil(plan.out.h / plan.halo.q));
  arr("haloS", plan.haloStrength);
  arr("negDmin", t.neg.dmin); arr("negSpan", t.neg.span); arr("negK", t.neg.k); arr("negX0", t.neg.x0); set("interimage", t.interimage);
  arr("prtDmin", t.prt.dmin); arr("prtSpan", t.prt.span); arr("prtK", t.prt.k); arr("logGain", t.logGain);
  set("bleach", t.bleach); set("printBase", t.printBase); arr("outM", t.out);
  return a;
}
