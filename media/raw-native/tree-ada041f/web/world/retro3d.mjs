// Retro 3D flags (ROADMAP M2 criterion 8): vertex snap and affine texture mapping. This is
// the CPU twin of web/motion/retro3d_gpu.mjs; both work out, per pixel, which triangle
// covers it and which texel it fetches, so the check compares the two exactly
// (evidence/m2-retro3d-bounds.json).
//   retro3dRef(scene, { width, height, snap = 0, affine = false, texSize = 64, subpixelBits = 0 })
//     -> { ids: Uint32Array (triangle index + 1, 0 where empty), texel: Uint32Array (x, y pairs),
//          edge: Uint8Array (1 where a triangle edge passes within 1 pixel of the centre),
//          tie: Float32Array (distance, in texels, from the sample to the nearest texel boundary) }
// subpixelBits: the rasterizer's vertex precision, which the APIs leave to the hardware
// (D3D12 requires 8 bits; Vulkan allows 4; SwiftShader uses 4). 0 keeps vertices exact.
// Amended 2026-10-10 after the first run, with the reasons in evidence/m2-retro3d-bounds.json.
// snap: vertex screen positions rounded to a grid of `snap` pixels (0: off).
// affine: UVs interpolated linearly in screen space instead of perspective-correctly.
// Arithmetic follows the shader in f32 (Math.fround) where the order is fixed.
const f = Math.fround;

export function project(scene, i, width, height, snap, subpixelBits = 0) {
  const m = scene.mvp, p = scene.mesh.positions, x = p[3 * i], y = p[3 * i + 1], z = p[3 * i + 2];
  const c = [0, 1, 2, 3].map((r) => f(f(f(f(m[r] * x) + f(m[4 + r] * y)) + f(m[8 + r] * z)) + m[12 + r]));
  let sx = f(f(f(c[0] / c[3]) * 0.5 + 0.5) * width), sy = f(f(1 - f(f(c[1] / c[3]) * 0.5 + 0.5)) * height);
  if (snap > 0) { sx = f(Math.floor(f(sx / snap) + 0.5) * snap); sy = f(Math.floor(f(sy / snap) + 0.5) * snap); }
  if (subpixelBits > 0) { const q = 1 << subpixelBits; sx = Math.round(sx * q) / q; sy = Math.round(sy * q) / q; }
  return { sx, sy, w: c[3], z: f(c[2] / c[3]) };
}

export function retro3dRef(scene, { width, height, snap = 0, affine = false, texSize = 64, subpixelBits = 0 }) {
  const n = width * height, tie = new Float32Array(n), ids = new Uint32Array(n), texel = new Uint32Array(2 * n), edge = new Uint8Array(n), depth = new Float32Array(n).fill(Infinity);
  const { indices, uvs } = scene.mesh, verts = new Map();
  const V = (i) => { if (!verts.has(i)) verts.set(i, project(scene, i, width, height, snap, subpixelBits)); return verts.get(i); };
  const wrap = (t) => ((t % texSize) + texSize) % texSize;
  for (let t = 0; t < indices.length; t += 3) {
    const idx = [indices[t], indices[t + 1], indices[t + 2]], v = idx.map(V);
    if (v.some((q) => q.w <= 0)) continue;                       // the sets keep every vertex in front
    const area = (v[1].sx - v[0].sx) * (v[2].sy - v[0].sy) - (v[1].sy - v[0].sy) * (v[2].sx - v[0].sx);
    if (Math.abs(area) < 1e-12) continue;
    // Top-left rule, for either winding: an edge owns its pixels when it is a top or left edge.
    const owns = (a, b) => { const dx = b.sx - a.sx, dy = b.sy - a.sy, s = area > 0 ? 1 : -1; return s * dy < 0 || (dy === 0 && s * dx > 0); };
    const E = [[1, 2], [2, 0], [0, 1]].map(([a, b]) => ({ a: v[a], b: v[b], own: owns(v[a], v[b]) }));
    for (const e of E) markEdge(edge, width, height, e.a, e.b);
    const x0 = Math.max(0, Math.floor(Math.min(v[0].sx, v[1].sx, v[2].sx))), x1 = Math.min(width - 1, Math.ceil(Math.max(v[0].sx, v[1].sx, v[2].sx)));
    const y0 = Math.max(0, Math.floor(Math.min(v[0].sy, v[1].sy, v[2].sy))), y1 = Math.min(height - 1, Math.ceil(Math.max(v[0].sy, v[1].sy, v[2].sy)));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const px = x + 0.5, py = y + 0.5, b = [0, 0, 0];
      let inside = true;
      for (let k = 0; k < 3; k++) {
        const { a, b: c, own } = E[k], e = ((c.sx - a.sx) * (py - a.sy) - (c.sy - a.sy) * (px - a.sx)) / area;
        if (e < 0 || (e === 0 && !own)) { inside = false; break; }
        b[k] = e;
      }
      if (!inside) continue;
      const z = b[0] * v[0].z + b[1] * v[1].z + b[2] * v[2].z, o = y * width + x;
      if (!(z < depth[o]) || z < 0 || z > 1) continue;
      depth[o] = z;
      let u, w;
      if (affine) { u = b[0] * uvs[2 * idx[0]] + b[1] * uvs[2 * idx[1]] + b[2] * uvs[2 * idx[2]]; w = b[0] * uvs[2 * idx[0] + 1] + b[1] * uvs[2 * idx[1] + 1] + b[2] * uvs[2 * idx[2] + 1]; }
      else {
        const q = b.map((bk, k) => bk / v[k].w), s = q[0] + q[1] + q[2];
        u = (q[0] * uvs[2 * idx[0]] + q[1] * uvs[2 * idx[1]] + q[2] * uvs[2 * idx[2]]) / s;
        w = (q[0] * uvs[2 * idx[0] + 1] + q[1] * uvs[2 * idx[1] + 1] + q[2] * uvs[2 * idx[2] + 1]) / s;
      }
      tie[o] = Math.min(Math.abs(u * texSize - Math.round(u * texSize)), Math.abs(w * texSize - Math.round(w * texSize)));
      ids[o] = t / 3 + 1; texel[2 * o] = wrap(Math.floor(u * texSize)); texel[2 * o + 1] = wrap(Math.floor(w * texSize));
    }
  }
  return { ids, texel, edge, tie };
}

function markEdge(edge, width, height, a, b) {
  const x0 = Math.max(0, Math.floor(Math.min(a.sx, b.sx) - 1)), x1 = Math.min(width - 1, Math.ceil(Math.max(a.sx, b.sx) + 1));
  const y0 = Math.max(0, Math.floor(Math.min(a.sy, b.sy) - 1)), y1 = Math.min(height - 1, Math.ceil(Math.max(a.sy, b.sy) + 1));
  const dx = b.sx - a.sx, dy = b.sy - a.sy, L2 = dx * dx + dy * dy || 1;
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const px = x + 0.5, py = y + 0.5, t = Math.max(0, Math.min(1, ((px - a.sx) * dx + (py - a.sy) * dy) / L2));
    if (Math.hypot(px - a.sx - t * dx, py - a.sy - t * dy) < 1) edge[y * width + x] = 1;
  }
}
