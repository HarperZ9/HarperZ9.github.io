// Builds the bounding volume hierarchy the GPU passes trace through, in a Worker so the page keeps drawing.
// The layout is the engine's own (raw/renderer/bvh.hpp, Bvh::flatten): 8 floats a node, box min, then the leaf's
// first triangle or the interior node's left child (the right child is the one after it), box max, then the leaf's
// triangle count (0 for an interior node); boxes padded by 1e-4. The engine's bvhBlocked (passes.wgsl) reads it
// as written. The split is a binned surface area heuristic over 16 bins on the widest centroid axis, leaves of up
// to 4 triangles; the build here is the page's, the layout is the engine's.
const BINS = 16, LEAF = 4, PAD = 1e-4;

function build(pos) {
  const nt = pos.length / 9;
  const lo = new Float32Array(nt * 3), hi = new Float32Array(nt * 3), ce = new Float32Array(nt * 3);
  for (let t = 0; t < nt; t++) for (let k = 0; k < 3; k++) {
    const a = pos[9 * t + k], b = pos[9 * t + 3 + k], c = pos[9 * t + 6 + k];
    lo[3 * t + k] = Math.min(a, b, c); hi[3 * t + k] = Math.max(a, b, c); ce[3 * t + k] = (lo[3 * t + k] + hi[3 * t + k]) / 2;
  }
  const order = new Uint32Array(nt);
  for (let i = 0; i < nt; i++) order[i] = i;
  let cap = Math.max(64, nt), nodes = new Float32Array(cap * 8), count = 1;
  const grow = () => { const n = new Float32Array(nodes.length * 2); n.set(nodes); nodes = n; };
  const bl = new Float64Array(BINS * 3), bh = new Float64Array(BINS * 3), bn = new Uint32Array(BINS);
  const area = (x0, y0, z0, x1, y1, z1) => { const x = x1 - x0, y = y1 - y0, z = z1 - z0; return x < 0 ? 0 : 2 * (x * y + y * z + z * x); };
  const stack = [[0, 0, nt]];
  while (stack.length) {
    const [n, first, num] = stack.pop();
    let x0 = 1e30, y0 = 1e30, z0 = 1e30, x1 = -1e30, y1 = -1e30, z1 = -1e30, c0 = [1e30, 1e30, 1e30], c1 = [-1e30, -1e30, -1e30];
    for (let i = first; i < first + num; i++) {
      const t = 3 * order[i];
      x0 = Math.min(x0, lo[t]); y0 = Math.min(y0, lo[t + 1]); z0 = Math.min(z0, lo[t + 2]);
      x1 = Math.max(x1, hi[t]); y1 = Math.max(y1, hi[t + 1]); z1 = Math.max(z1, hi[t + 2]);
      for (let k = 0; k < 3; k++) { c0[k] = Math.min(c0[k], ce[t + k]); c1[k] = Math.max(c1[k], ce[t + k]); }
    }
    const o = n * 8;
    nodes[o] = x0 - PAD; nodes[o + 1] = y0 - PAD; nodes[o + 2] = z0 - PAD; nodes[o + 4] = x1 + PAD; nodes[o + 5] = y1 + PAD; nodes[o + 6] = z1 + PAD;
    const leaf = () => { nodes[o + 3] = first; nodes[o + 7] = num; };
    if (num <= LEAF) { leaf(); continue; }
    let axis = 0;
    for (let k = 1; k < 3; k++) if (c1[k] - c0[k] > c1[axis] - c0[axis]) axis = k;
    const span = c1[axis] - c0[axis];
    if (!(span > 1e-12)) { if (num <= 32) { leaf(); continue; } }
    bl.fill(1e30); bh.fill(-1e30); bn.fill(0);
    const scale = span > 1e-12 ? BINS / span : 0;
    for (let i = first; i < first + num; i++) {
      const t = 3 * order[i], b = Math.min(BINS - 1, ((ce[t + axis] - c0[axis]) * scale) | 0);
      bn[b]++;
      for (let k = 0; k < 3; k++) { bl[3 * b + k] = Math.min(bl[3 * b + k], lo[t + k]); bh[3 * b + k] = Math.max(bh[3 * b + k], hi[t + k]); }
    }
    // sweep: cost of splitting after bin s
    const leftA = new Float64Array(BINS), leftN = new Uint32Array(BINS);
    let lx0 = 1e30, ly0 = 1e30, lz0 = 1e30, lx1 = -1e30, ly1 = -1e30, lz1 = -1e30, ln = 0;
    for (let s = 0; s < BINS - 1; s++) {
      if (bn[s]) { lx0 = Math.min(lx0, bl[3 * s]); ly0 = Math.min(ly0, bl[3 * s + 1]); lz0 = Math.min(lz0, bl[3 * s + 2]); lx1 = Math.max(lx1, bh[3 * s]); ly1 = Math.max(ly1, bh[3 * s + 1]); lz1 = Math.max(lz1, bh[3 * s + 2]); }
      ln += bn[s]; leftA[s] = area(lx0, ly0, lz0, lx1, ly1, lz1); leftN[s] = ln;
    }
    let best = -1, bestCost = Infinity, rx0 = 1e30, ry0 = 1e30, rz0 = 1e30, rx1 = -1e30, ry1 = -1e30, rz1 = -1e30, rn = 0;
    for (let s = BINS - 1; s > 0; s--) {
      if (bn[s]) { rx0 = Math.min(rx0, bl[3 * s]); ry0 = Math.min(ry0, bl[3 * s + 1]); rz0 = Math.min(rz0, bl[3 * s + 2]); rx1 = Math.max(rx1, bh[3 * s]); ry1 = Math.max(ry1, bh[3 * s + 1]); rz1 = Math.max(rz1, bh[3 * s + 2]); }
      rn += bn[s];
      const nl = leftN[s - 1];
      if (!nl || !rn) continue;
      const cost = leftA[s - 1] * nl + area(rx0, ry0, rz0, rx1, ry1, rz1) * rn;
      if (cost < bestCost) { bestCost = cost; best = s; }
    }
    let mid;
    if (best < 0) mid = first + (num >> 1);   // every centroid in one bin: split the list in half
    else {
      let i = first, j = first + num - 1;
      while (i <= j) {
        const t = order[i], b = Math.min(BINS - 1, ((ce[3 * t + axis] - c0[axis]) * scale) | 0);
        if (b < best) i++; else { order[i] = order[j]; order[j] = t; j--; }
      }
      mid = i;
      if (mid === first || mid === first + num) mid = first + (num >> 1);
    }
    while ((count + 2) * 8 > nodes.length) grow();
    const left = count; count += 2;
    nodes[o + 3] = left; nodes[o + 7] = 0;
    stack.push([left + 1, mid, first + num - mid], [left, first, mid - first]);
  }
  nodes = nodes.slice(0, count * 8);
  // the triangles' positions in the tree's order, 9 floats each (btris in passes.wgsl)
  const btris = new Float32Array(nt * 9);
  for (let i = 0; i < nt; i++) btris.set(pos.subarray(9 * order[i], 9 * order[i] + 9), 9 * i);
  return { nodes, order, btris, count };
}

self.onmessage = ({ data }) => {
  try {
    const t0 = performance.now(), r = build(data.positions);
    self.postMessage({ ok: true, ...r, ms: performance.now() - t0 }, [r.nodes.buffer, r.order.buffer, r.btris.buffer]);
  } catch (e) {
    self.postMessage({ ok: false, error: String(e && e.message || e) });
  }
};
