// The parameter block the CRT passes read, as one f32 array. The same field list makes
// the JavaScript packer and the WGSL index constants, so they cannot drift apart.
import { YIQ, YUV, YIQ_INV, YUV_INV } from "./signal.mjs";
import { maskMean } from "./geometry.mjs";
import { LUMA } from "./glass.mjs";

const FIELDS = [
  ["srcW"], ["srcH"], ["N"], ["lines"], ["mode"], ["pal"], ["comb"], ["lineCyc"], ["frameCyc"], ["frame"],
  ["tapRgb", 2], ["tapEnc", 2], ["tapSep", 2], ["tapLum", 2], ["tapI", 2], ["tapQ", 2],
  ["fwd", 9], ["inv", 9],
  ["outW"], ["outH"], ["viewW"], ["viewH"], ["cx"], ["cy"], ["rx"], ["ry"], ["dist"],
  ["faceW"], ["faceH"], ["rasterW"], ["rasterH"], ["lineMm"], ["corner"],
  ["contrast"], ["brightness"], ["gamma"], ["spotLo"], ["spotHi"], ["spotExp"],
  ["maskType"], ["pitch"], ["fill"], ["slotH"], ["slotGap"], ["dampers", 2], ["nDampers"], ["damperW"], ["maskMix"], ["maskMean"],
  ["conv", 5], ["mono"], ["interlace"], ["decay", 15], ["fieldT"],
  ["haloQ"], ["haloR"], ["haloDirect"], ["gw"], ["gh"],
  ["M", 9], ["luma", 3], ["ambient"], ["transmission"], ["reflection"], ["glassN"], ["bezel", 3], ["exposure"],
];
export const INDEX = {};
let n = 0;
for (const [name, len = 1] of FIELDS) { INDEX[name] = n; n += len; }
export const PARAM_COUNT = n;

// WGSL constants: const P_srcW: u32 = 0u; ...
export const LAYOUT_WGSL = Object.entries(INDEX).map(([k, v]) => `const P_${k}: u32 = ${v}u;`).join("\n");

export function packParams(plan, taps, frameNo, exposure = 1) {
  const a = new Float32Array(PARAM_COUNT), p = plan.p, set = (k, v, o = 0) => { a[INDEX[k] + o] = v; };
  const arr = (k, vs) => vs.forEach((v, i) => set(k, v, i));
  set("srcW", plan.src.w); set("srcH", plan.src.h); set("N", plan.N); set("lines", plan.lines); set("mode", plan.mode);
  set("pal", plan.pal ? 1 : 0); set("comb", p.signal.decoder === "comb" && !plan.pal ? 1 : 0);
  set("lineCyc", plan.lineCyc - Math.floor(plan.lineCyc)); set("frameCyc", plan.frameCyc - Math.floor(plan.frameCyc)); set("frame", frameNo);
  for (const [k, name] of [["tapRgb", "rgb"], ["tapEnc", "encodeC"], ["tapSep", "lumaSep"], ["tapLum", "lumaLp"], ["tapI", "demodI"], ["tapQ", "demodQ"]]) arr(k, taps.info[name]);
  arr("fwd", plan.pal ? YUV : YIQ); arr("inv", plan.pal ? YUV_INV : YIQ_INV);
  set("outW", plan.out.w); set("outH", plan.out.h); set("viewW", plan.viewW); set("viewH", plan.viewH);
  set("cx", p.view.centre[0]); set("cy", p.view.centre[1]); set("rx", p.curvature.rx); set("ry", p.curvature.ry); set("dist", plan.distance);
  set("faceW", plan.faceW); set("faceH", plan.faceH); set("rasterW", plan.rasterW); set("rasterH", plan.rasterH); set("lineMm", plan.lineMm); set("corner", p.tube.corner);
  set("contrast", p.tube.contrast); set("brightness", p.tube.brightness); set("gamma", p.tube.gamma);
  set("spotLo", p.spot.lo); set("spotHi", p.spot.hi); set("spotExp", p.spot.exponent);
  const m = p.mask;
  set("maskType", plan.screen.mono ? 0 : { none: 0, grille: 1, slot: 2, delta: 3 }[m.type]);
  set("pitch", m.pitch); set("fill", m.fill); set("slotH", m.slotHeight); set("slotGap", m.slotGap);
  arr("dampers", m.dampers.slice(0, 2)); set("nDampers", Math.min(2, m.dampers.length)); set("damperW", m.damperWidth);
  set("maskMix", m.mix); set("maskMean", maskMean(m));
  const cv = p.convergence; arr("conv", [cv.r[0], cv.r[1], cv.b[0], cv.b[1], cv.radial]);
  set("mono", plan.screen.mono ? 1 : 0); set("interlace", p.interlace ? 1 : 0);
  arr("decay", plan.decay.flat()); set("fieldT", plan.field);
  set("haloQ", plan.halo.q); set("haloR", plan.halo.R); set("haloDirect", plan.halo.direct);
  set("gw", Math.ceil(plan.out.w / plan.halo.q)); set("gh", Math.ceil(plan.out.h / plan.halo.q));
  arr("M", plan.screen.matrix); arr("luma", LUMA[p.phosphor.output]);
  set("ambient", p.room.ambient); set("transmission", p.glass.transmission); set("reflection", p.room.reflection);
  set("glassN", p.glass.n); arr("bezel", p.room.bezel); set("exposure", exposure);
  return a;
}
