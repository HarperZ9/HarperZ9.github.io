// Retro 3D flags on the GPU (ROADMAP M2 criterion 8): vertex snap and affine UVs. The check
// pass writes, per pixel, the covering triangle's index and the texel its UV fetches into an
// rgba32uint target, so it compares exactly with the CPU twin (web/world/retro3d.mjs).
//   const r = createRetro3d(device);
//   const { ids, texel } = await r.check(scene, { width, height, snap, affine, texSize });
// The vertex arithmetic matches the twin: clip = mvp * position, screen = (ndc * 0.5 + 0.5)
// * size with y down, snapped as floor(p / snap + 0.5) * snap, then written back to clip
// space. Affine mapping is WGSL's @interpolate(linear); perspective is the default.

const WGSL = (affine) => /* wgsl */ `
struct U { mvp: mat4x4f, size: vec2f, snap: f32, tex: f32 }
@group(0) @binding(0) var<uniform> P: U;
@group(0) @binding(1) var<storage, read> pos: array<f32>;
@group(0) @binding(2) var<storage, read> uvs: array<f32>;
@group(0) @binding(3) var<storage, read> idx: array<u32>;
struct V { @builtin(position) clip: vec4f, @location(0) ${affine ? "@interpolate(linear)" : "@interpolate(perspective)"} uv: vec2f, @location(1) @interpolate(flat) tri: u32 }
@vertex fn vs(@builtin(vertex_index) k: u32) -> V {
  let i = idx[k];
  let c = P.mvp * vec4f(pos[3u * i], pos[3u * i + 1u], pos[3u * i + 2u], 1.0);
  var o: V;
  o.clip = c;
  if (P.snap > 0.0) {
    var s = vec2f((c.x / c.w * 0.5 + 0.5) * P.size.x, (1.0 - (c.y / c.w * 0.5 + 0.5)) * P.size.y);
    s = floor(s / P.snap + 0.5) * P.snap;
    o.clip = vec4f((s.x / P.size.x * 2.0 - 1.0) * c.w, (1.0 - s.y / P.size.y * 2.0) * c.w, c.z, c.w);
  }
  o.uv = vec2f(uvs[2u * i], uvs[2u * i + 1u]);
  o.tri = k / 3u + 1u;
  return o;
}
fn wrapf(t: f32) -> u32 { let n = i32(P.tex); return u32(((i32(floor(t * P.tex)) % n) + n) % n); }
@fragment fn fs(v: V) -> @location(0) vec4u { return vec4u(v.tri, wrapf(v.uv.x), wrapf(v.uv.y), 0u); }`;

export function createRetro3d(device) {
  const pipes = {};
  const pipe = (affine) => pipes[affine] || (pipes[affine] = device.createRenderPipeline({
    layout: "auto", primitive: { topology: "triangle-list", cullMode: "none" },
    depthStencil: { format: "depth32float", depthWriteEnabled: true, depthCompare: "less" },
    vertex: { module: device.createShaderModule({ code: WGSL(affine) }), entryPoint: "vs" },
    fragment: { module: device.createShaderModule({ code: WGSL(affine) }), entryPoint: "fs", targets: [{ format: "rgba32uint" }] },
  }));
  const buf = (data, usage) => { const b = device.createBuffer({ size: Math.max(16, data.byteLength), usage: usage | GPUBufferUsage.COPY_DST }); device.queue.writeBuffer(b, 0, data); return b; };
  return {
    async check(scene, { width, height, snap = 0, affine = false, texSize = 64 }) {
      const p = pipe(!!affine), u = new Float32Array(20);
      u.set(scene.mvp, 0); u.set([width, height, snap, texSize], 16);
      const ub = buf(u, GPUBufferUsage.UNIFORM), pb = buf(scene.mesh.positions, GPUBufferUsage.STORAGE);
      const vb = buf(scene.mesh.uvs, GPUBufferUsage.STORAGE), ib = buf(scene.mesh.indices, GPUBufferUsage.STORAGE);
      const color = device.createTexture({ size: [width, height], format: "rgba32uint", usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC });
      const depth = device.createTexture({ size: [width, height], format: "depth32float", usage: GPUTextureUsage.RENDER_ATTACHMENT });
      const bpr = Math.ceil((width * 16) / 256) * 256, rb = device.createBuffer({ size: bpr * height, usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST });
      const enc = device.createCommandEncoder();
      const rp = enc.beginRenderPass({ colorAttachments: [{ view: color.createView(), loadOp: "clear", storeOp: "store", clearValue: [0, 0, 0, 0] }],
        depthStencilAttachment: { view: depth.createView(), depthLoadOp: "clear", depthStoreOp: "store", depthClearValue: 1 } });
      rp.setPipeline(p);
      rp.setBindGroup(0, device.createBindGroup({ layout: p.getBindGroupLayout(0), entries: [ub, pb, vb, ib].map((b, k) => ({ binding: k, resource: { buffer: b } })) }));
      rp.draw(scene.mesh.indices.length); rp.end();
      enc.copyTextureToBuffer({ texture: color }, { buffer: rb, bytesPerRow: bpr }, [width, height]);
      device.queue.submit([enc.finish()]);
      await rb.mapAsync(GPUMapMode.READ);
      const raw = new Uint32Array(rb.getMappedRange().slice(0)), ids = new Uint32Array(width * height), texel = new Uint32Array(2 * width * height);
      for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
        const s = (y * bpr) / 4 + x * 4, o = y * width + x;
        ids[o] = raw[s]; texel[2 * o] = raw[s + 1]; texel[2 * o + 1] = raw[s + 2];
      }
      rb.unmap();
      for (const b of [ub, pb, vb, ib, rb]) b.destroy(); color.destroy(); depth.destroy();
      return { ids, texel };
    },
  };
}
