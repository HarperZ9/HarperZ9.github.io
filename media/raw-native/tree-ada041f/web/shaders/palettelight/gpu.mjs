// Palette-locked lighting on the GPU: the pass of palettelight.mjs.
//   const p = await createGpuPalettelight(host, plan, { w, h });
//   p.frame(gbuffer, time);  await p.read() -> { idx: Uint32Array, packed: Uint8Array RGBA8 }
import { gpuKit } from "../lab/gpu-kit.mjs";
import { PALETTELIGHT_WGSL } from "./palettelight.wgsl.mjs";

const CLASSES = ["ground", "stone", "wood", "foliage"];
export function packTable(plan) {
  const r = plan.palette.ramp, K = plan.steps, t = [];
  for (const c of CLASSES) for (let v = 0; v < 2; v++) for (let s = 0; s < K; s++) t.push(r[c][v][s]);
  t.push(...r.void, ...r.window, ...r.lamp, r.night);
  return Uint32Array.from(t);
}
export function packEntries(plan) { return Uint32Array.from(plan.palette.entries.map((e) => e.rgb[0] | (e.rgb[1] << 8) | (e.rgb[2] << 16) | (255 << 24))); }
const radial = (L) => [...L.pos, L.radius, L.core, L.intensity, L.wrap, 0];
export function packParams(plan, size, time) {
  const P = new Float32Array(40);
  P.set([size.w, size.h, plan.steps, plan.voidSteps, plan.gain, plan.ambient, plan.moon, plan.cycleRate, time, ...plan.moonDir, ...radial(plan.lamp), ...radial(plan.glows[0]), ...radial(plan.glows[1])], 0);
  return P;
}
export function packGbuffer(g) {
  const n = g.w * g.h, o = new Float32Array(n * 16);
  for (let i = 0; i < n; i++) {
    const b = i * 16;
    o[b] = g.hit[i]; o[b + 1] = g.cls[i]; o[b + 2] = g.a[i]; o[b + 3] = g.phase[i];
    o[b + 4] = g.P[i * 3]; o[b + 5] = g.P[i * 3 + 1]; o[b + 6] = g.P[i * 3 + 2]; o[b + 7] = g.vis[i * 3];
    o[b + 8] = g.N[i * 3]; o[b + 9] = g.N[i * 3 + 1]; o[b + 10] = g.N[i * 3 + 2]; o[b + 11] = g.vis[i * 3 + 1];
    o[b + 12] = g.vis[i * 3 + 2];
  }
  return o;
}
export async function createGpuPalettelight(host, plan, size) {
  const pipe = await host.compute("palettelight", PALETTELIGHT_WGSL), kit = gpuKit(host), n = size.w * size.h, tbl = packTable(plan), ent = packEntries(plan);
  const B = { P: kit.st(4 * 40, "pl params"), gb: kit.st(64 * n, "pl gbuffer"), tbl: kit.st(4 * tbl.length, "pl table", tbl), ent: kit.st(4 * ent.length, "pl entries", ent), idx: kit.st(4 * n, "pl index"), out8: kit.st(4 * n, "pl packed") };
  const list = [[pipe, [B.P, B.gb, B.tbl, B.ent, B.idx, B.out8], Math.ceil(size.w / 8), Math.ceil(size.h / 8)]];
  return {
    upload(g, time) { host.write(B.P, packParams(plan, size, time)); if (g) host.write(B.gb, packGbuffer(g)); },
    record(enc) { kit.record(enc, list); },
    frame(g, time) { this.upload(g, time); kit.run(list); },
    async read() { return { idx: new Uint32Array(await kit.read(B.idx, 4 * n)), packed: new Uint8Array(await kit.read(B.out8, 4 * n)) }; },
    destroy() { kit.destroy(); },
  };
}
