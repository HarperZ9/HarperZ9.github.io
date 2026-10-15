// GPU particle fields for Motion. A system holds formations (point sets of the
// same count, in scene units) and per-particle colours, delays and sizes; a
// frame's item says which two formations it moves between and how far along it
// is. The compute pass (PARTICLE_WGSL) places every particle from that alone,
// so scrubbing to a time gives the same frame as playing to it.
//
//   const sys = motion.particles({ count: 636, formations: [cloud, grid], colors: [ink, ink], delay, size });
//   items.push({ kind: "particles", system: sys, from: 0, to: 1, t: 0.4, spread: 0.6, drift: 6,
//                size: [3, 2.5], blur: 0, blend: "add", opacity: 1, z: 0 });
// One system can appear once per frame.
import { project } from "./vector.mjs";

// Pack [r, g, b, a] (0..1) or "#rrggbb" into the u32 unpack4x8unorm reads.
export function packColor(c) {
  if (typeof c === "number") return c >>> 0;
  let v = c;
  if (typeof c === "string") { const h = c.replace("#", ""); v = [0, 2, 4, 6].map((i) => (i < h.length ? parseInt(h.slice(i, i + 2), 16) / 255 : 1)); }
  const b = (x) => Math.max(0, Math.min(255, Math.round((x ?? 1) * 255)));
  return (b(v[0]) | (b(v[1]) << 8) | (b(v[2]) << 16) | (b(v[3]) << 24)) >>> 0;
}

export class ParticleSystem {
  constructor(motion, { count, formations, colors, delay = null, size = null, seed = 1 }) {
    this.motion = motion; this.n = count; this.seed = seed;
    this.formations = formations;
    this.colors = colors.map((c) => (c instanceof Uint32Array ? c : (Array.isArray(c) && c.length === count ? Uint32Array.from(c, packColor) : new Uint32Array(count).fill(packColor(c)))));
    this.delay = delay || new Float32Array(count);
    this.size = size || new Float32Array(count).fill(1);
    const h = motion.host;
    this.parts = h.buffer({ size: count * 32, usage: ["storage", "copy-dst"], label: "motion particles" });
    this.out = h.buffer({ size: count * 16, label: "motion particle pos" });
    this.outc = h.buffer({ size: count * 16, label: "motion particle colour" });
    this.uni = h.buffer({ size: 64, usage: ["uniform", "copy-dst"], label: "motion particle uniforms" });
    this.loaded = "";
  }
  #upload(from, to, cfrom, cto) {
    const key = `${from},${to},${cfrom},${cto}`;
    if (key === this.loaded) return;
    const n = this.n, buf = new ArrayBuffer(n * 32), f = new Float32Array(buf), u = new Uint32Array(buf);
    const A = this.formations[from], B = this.formations[to], CA = this.colors[cfrom], CB = this.colors[cto];
    for (let i = 0; i < n; i++) {
      const o = i * 8;
      f[o] = A[2 * i]; f[o + 1] = A[2 * i + 1]; f[o + 2] = B[2 * i]; f[o + 3] = B[2 * i + 1];
      u[o + 4] = CA[i]; u[o + 5] = CB[i]; f[o + 6] = this.delay[i]; f[o + 7] = this.size[i];
    }
    this.motion.host.write(this.parts, buf);
    this.loaded = key;
  }
  // Replace one colour set (an array of colours, or packed u32s); the next frame uploads it.
  setColors(i, colors) {
    this.colors[i] = colors instanceof Uint32Array ? colors : Uint32Array.from(colors, packColor);
    this.loaded = "";
  }
  dispatch(pass, item, cam, W, H) {
    const from = item.from ?? 0, to = item.to ?? from;
    this.#upload(from, to, item.colorFrom ?? Math.min(from, this.colors.length - 1), item.colorTo ?? Math.min(to, this.colors.length - 1));
    const P = project({ z: item.z || 0, screen: item.screen, blur: item.blur || 0 }, cam, W, H, this.motion.design);
    const sz = item.size || [3, 3];
    this.motion.host.write(this.uni, new Float32Array([
      P.k, P.ox, P.oy, 0,
      item.t ?? 0, item.spread ?? 0.5, item.drift ?? 0, item.time ?? 0,
      P.blur, item.glow ?? 0, this.n, this.seed,
      (sz[0] * P.k) / 2, ((sz[1] ?? sz[0]) * P.k) / 2, item.opacity ?? 1, 0]));
    const pipe = this.motion.partPipe;
    pass.setPipeline(pipe);
    pass.setBindGroup(0, this.motion.host.bind(pipe, [this.uni, this.parts, this.out, this.outc]));
    pass.dispatchWorkgroups(Math.ceil(this.n / 256));
  }
  draw(rp, pipe, view) {
    rp.setPipeline(pipe);
    rp.setBindGroup(0, this.motion.host.bind(pipe, [view, this.out, this.outc]));
    rp.draw(4, this.n);
  }
  destroy() { for (const b of [this.parts, this.out, this.outc, this.uni]) b.destroy(); }
}
