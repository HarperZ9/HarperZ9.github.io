// The forest as it stands on the island: which tree grows where, and how each is drawn from the
// walker's place. Trees are placed by rule on a 4 m lattice inside 32 m cells: cover sets how
// thick they stand, a slow noise opens glades, stands of one species follow their own noises
// (birch at edges and along roads, cedar in the wet hollows, pine on the dry rises), and nothing
// grows on a road or in a town. A tree within 55 m is drawn whole, to 170 m with fewer, larger
// parts, and beyond that as one card from the sheet of far trees.
import { growAll, KINDS } from "./grow.mjs";
import { baseGround, cellAt, hash2, CANOPY } from "../data.mjs";
import { ortho } from "../mat.mjs";
import { FRAME_FLOATS, OFF, DEPTH } from "../stage.mjs";

const CELL = 32, STEP = 4, NEAR_R = 55, MID_R = 170, SHEET_W = 1536, SHEET_H = 1024;
const OF = { spruce: [0, 1, 2], pine: [3, 4], cedar: [5, 6], birch: [7, 8], birchLeaf: [9], snag: [10, 11] };
function vn(x, z) {
  const ix = Math.floor(x), iz = Math.floor(z), fx = x - ix, fz = z - iz, ux = fx * fx * (3 - 2 * fx), uz = fz * fz * (3 - 2 * fz);
  return (hash2(ix, iz) * (1 - ux) + hash2(ix + 1, iz) * ux) * (1 - uz) + (hash2(ix, iz + 1) * (1 - ux) + hash2(ix + 1, iz + 1) * ux) * uz;
}

export async function makeForest({ dev, stage, world, roads, near, quality, vbuf }) {
  const forms = growAll(world.json.seed);
  for (const f of forms) { f.nearBuf = vbuf(f.near); f.midBuf = vbuf(f.mid); f.nearN = f.near.length / 12; f.midN = f.mid.length / 12; }
  const mod = await stage.module("materials.wgsl", "tree.wgsl");
  const meshLayout = { arrayStride: 48, attributes: [{ shaderLocation: 0, offset: 0, format: "float32x3" }, { shaderLocation: 1, offset: 12, format: "float32x3" }, { shaderLocation: 2, offset: 24, format: "float32x2" }, { shaderLocation: 3, offset: 32, format: "float32x4" }] };
  const instLayout = (a, b) => ({ arrayStride: 32, stepMode: "instance", attributes: [{ shaderLocation: a, offset: 0, format: "float32x4" }, { shaderLocation: b, offset: 16, format: "float32x4" }] });
  const treePipe = stage.pipe(mod, "vsTree", "fsTree", [meshLayout, instLayout(4, 5)]);
  const farPipe = stage.pipe(mod, "vsFar", "fsFar", [instLayout(0, 1)], { topology: "triangle-strip" });
  const shadowPipe = stage.pipe(mod, "vsTree", "fsTreeShadow", [meshLayout, instLayout(4, 5)], { format: null });

  // ---------------------------------------------------------------- the sheet of far trees
  // every form drawn once, side on, one tree-height tall, at six sizes so a far card never shimmers
  {
    const bakePipe = stage.pipe(mod, "vsTree", "fsTreeBake", [meshLayout, instLayout(4, 5)], { format: "rgba8unorm-srgb" });
    const levels = 6, sheet = dev.createTexture({ size: [SHEET_W, SHEET_H], format: "rgba8unorm-srgb", mipLevelCount: levels, usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.RENDER_ATTACHMENT });
    const fr = new Float32Array(FRAME_FLOATS), vp = ortho([1.5, 1, 0], [0, 0, 1], 1.5, 1, 40);
    fr.set(vp, OFF.viewProj); fr.set([1.5, 1, 30, 0], OFF.cam); fr.set([world.width, world.depth, world.cell, world.W], OFF.world); fr.set([0, 0, 0, 1], OFF.clip);
    stage.writeFrame("bake", fr);
    const inst = new Float32Array(forms.length * 8);
    forms.forEach((f, i) => inst.set([(i % 6) * 0.5 + 0.25, Math.floor(i / 6) === 0 ? 1 : 0, 0, 0, 1 / f.H, 0.37, i, 1], i * 8));
    const ib = vbuf(inst), enc = dev.createCommandEncoder();
    for (let l = 0; l < levels; l++) {
      const depth = dev.createTexture({ size: [SHEET_W >> l, SHEET_H >> l], format: DEPTH, usage: GPUTextureUsage.RENDER_ATTACHMENT });
      const p = enc.beginRenderPass({ colorAttachments: [{ view: sheet.createView({ baseMipLevel: l, mipLevelCount: 1 }), loadOp: "clear", storeOp: "store", clearValue: [0.05, 0.06, 0.05, 0] }], depthStencilAttachment: { view: depth.createView(), depthClearValue: 0, depthLoadOp: "clear", depthStoreOp: "discard" } });
      p.setPipeline(bakePipe); p.setBindGroup(0, stage.st.binds.bake); p.setVertexBuffer(1, ib);
      forms.forEach((f, i) => { p.setVertexBuffer(0, f.nearBuf); p.draw(f.nearN, 1, 0, i); });
      p.end();
    }
    dev.queue.submit([enc.finish()]);
    stage.set("far", sheet);
  }

  // ---------------------------------------------------------------- where trees stand
  // a cell's trees: 8 floats each (x, y, z, turn, size, seed, form, height)
  const cells = new Map(), W = world.width, D = world.depth;
  function grow(cx, cz) {
    const out = [], g0x = cx * (CELL / STEP), g0z = cz * (CELL / STEP);
    for (let j = 0; j < CELL / STEP; j++) for (let i = 0; i < CELL / STEP; i++) {
      const gx = g0x + i, gz = g0z + j, x = (gx + 0.15 + 0.7 * hash2(gx, gz)) * STEP, z = (gz + 0.15 + 0.7 * hash2(gx + 7919, gz)) * STEP;
      if (x < 0 || z < 0 || x >= W || z >= D) continue;
      const k = cellAt(world, x, z), b = world.biome[k], dens = CANOPY[b];
      if (!(dens > 0) || world.height[k] < 0.6 || (world.built && world.built[k] > 70)) continue;
      const roll = hash2(gx * 3 + 11, gz * 5 + 2), glade = vn(x / 110 + 3, z / 110 + 9), thick = b === 5 ? dens * Math.min(1, Math.max(0, (glade - 0.2) / 0.22)) * 0.9 : dens;
      const sapling = b === 5 && roll > thick && roll < thick + 0.07;
      if (roll > thick && !sapling) continue;
      const rd = roads.nearest(x, z, 14);
      if (rd && rd.d < rd.half + 2.6) continue;
      const p = hash2(gx * 7 + 1, gz * 3 + 4), q = hash2(gx + 31, gz * 11 + 8), stand = vn(x / 170 + 7, z / 170 + 3), wet = vn(x / 60 + 11, z / 60 + 5);
      let kind = "spruce", size = 0.62 + 0.55 * q;
      if (b === 5) {
        if (stand > 0.62 || (rd && p < 0.55)) kind = p < 0.72 ? "birch" : "birchLeaf";
        else if (wet < 0.34) kind = p < 0.7 ? "cedar" : "spruce";
        else if (stand < 0.25) kind = p < 0.6 ? "pine" : "spruce";
        else kind = p < 0.86 ? "spruce" : p < 0.90 ? "snag" : p < 0.96 ? "birch" : "pine";
      } else if (b === 6) { kind = p < 0.5 ? "birch" : p < 0.92 ? "spruce" : "snag"; size *= 0.62; }
      else kind = world.river[k] > 0 || p < 0.5 ? "birch" : "pine";
      if (sapling) { kind = "spruce"; size = 0.08 + 0.16 * q; }
      const set = OF[kind], form = set[Math.floor(hash2(gx * 13 + 5, gz * 17 + 3) * set.length)];
      out.push(x, baseGround(world, x, z) - 0.05, z, p * 6.283, size, q, form, forms[form].H * size);
    }
    const c = { t: new Float32Array(out) };
    cells.set(cx * 8192 + cz, c);
    if (cells.size > 9000) cells.delete(cells.keys().next().value);
    return c;
  }
  const cellOf = (cx, cz) => cells.get(cx * 8192 + cz) || grow(cx, cz);

  // crowns, litter and trunks into the near maps
  near.stampers.push(({ A, ox, oz, N, disc }) => {
    for (let cz = Math.floor(oz / CELL) - 1; cz <= Math.floor((oz + N) / CELL) + 1; cz++) for (let cx = Math.floor(ox / CELL) - 1; cx <= Math.floor((ox + N) / CELL) + 1; cx++) {
      const t = cellOf(cx, cz).t;
      for (let i = 0; i < t.length; i += 8) {
        const f = forms[t[i + 6]], s = t[i + 4];
        disc(A, 0, t[i], t[i + 2], f.crown * s * 1.25 + 0.6, f.cover * 255 * Math.min(1, s * 2.2), 0.45);
        if (f.broad) disc(A, 1, t[i], t[i + 2], f.crown * s * 2.4, 255);
        if (s > 0.3) disc(A, 3, t[i], t[i + 2], 1.1, 230);
      }
    }
  });

  // ---------------------------------------------------------------- what to draw from here
  const MAXI = 420000, big = () => dev.createBuffer({ size: MAXI * 32, usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST });
  const bufs = { near: big(), mid: big(), far: big(), edge: big() }, ranges = { near: [], mid: [] };
  let farN = 0, edgeN = 0, at = [1e12, 1e12], farAt = [1e12, 1e12], counts = { near: 0, mid: 0, far: 0 }, reach = 600;
  const scratch = new Float32Array(MAXI * 8);
  function rebuild(x, z, wantFar) {
    const lists = { near: forms.map(() => []), mid: forms.map(() => []) }, edge = [], band = MID_R + 72;
    if (wantFar) farAt = [x, z];
    const c0 = Math.floor((x - reach) / CELL), c1 = Math.floor((x + reach) / CELL), d0 = Math.floor((z - reach) / CELL), d1 = Math.floor((z + reach) / CELL);
    let fo = 0;
    for (let cz = d0; cz <= d1; cz++) for (let cx = c0; cx <= c1; cx++) {
      const mx = (cx + 0.5) * CELL - x, mz = (cz + 0.5) * CELL - z, cd = Math.hypot(mx, mz);
      if (cd > reach) continue;
      // cells well beyond the mid range go to the far list whole, and only when the walker has moved a good way
      if (Math.hypot((cx + 0.5) * CELL - farAt[0], (cz + 0.5) * CELL - farAt[1]) > band) {
        if (wantFar) { const t = cellOf(cx, cz).t; for (let i = 0; i < t.length; i += 8) if (t[i + 4] > 0.3 && fo + 8 <= scratch.length) { scratch.set(t.subarray(i, i + 8), fo); fo += 8; } }
        continue;
      }
      const t = cellOf(cx, cz).t;
      for (let i = 0; i < t.length; i += 8) {
        const d = Math.hypot(t[i] - x, t[i + 2] - z), small = t[i + 4] < 0.3, row = t.subarray(i, i + 8);
        if (d < NEAR_R * quality && !small) lists.near[t[i + 6]].push(...row);
        else if (d < (small ? 90 : MID_R) * quality) lists.mid[t[i + 6]].push(...row);
        else if (!small) edge.push(...row);
      }
    }
    for (const lod of ["near", "mid"]) {
      let o = 0; ranges[lod] = [];
      lists[lod].forEach((l, i) => { if (l.length) { dev.queue.writeBuffer(bufs[lod], o * 32, new Float32Array(l)); ranges[lod].push([i, o, l.length / 8]); o += l.length / 8; } });
      counts[lod] = o;
    }
    edgeN = Math.min(MAXI, edge.length / 8); if (edgeN) dev.queue.writeBuffer(bufs.edge, 0, new Float32Array(edge), 0, edgeN * 8);
    if (wantFar) { farN = fo / 8; if (farN) dev.queue.writeBuffer(bufs.far, 0, scratch, 0, fo); }
    counts.far = farN + edgeN;
    at = [x, z];
  }
  function update({ cam, light, ground }) {
    // as far as a tree can be told from the air round it, and no farther
    const want = Math.min(1700, Math.max(520, 3.2 / (ground.gfog[0] * 0.5 + light.fog[3] + 1e-5))) * Math.min(1, quality);
    const far = Math.hypot(cam.x - farAt[0], cam.z - farAt[1]) > 40 || Math.abs(want - reach) > 150;
    if (far) reach = want;
    if (far || Math.hypot(cam.x - at[0], cam.z - at[1]) > 5) rebuild(cam.x, cam.z, far);
  }
  function draw(pass, which) {
    const shadow = which === "shadow";
    pass.setPipeline(shadow ? shadowPipe : treePipe);
    for (const lod of shadow ? ["near", "mid"] : ["near", "mid"]) for (const [i, o, n] of ranges[lod]) {
      const f = forms[i];
      pass.setVertexBuffer(0, lod === "near" ? f.nearBuf : f.midBuf); pass.setVertexBuffer(1, bufs[lod], o * 32, n * 32);
      pass.draw(lod === "near" ? f.nearN : f.midN, n);
    }
    if (shadow) return;
    pass.setPipeline(farPipe);
    if (farN) { pass.setVertexBuffer(0, bufs.far); pass.draw(4, farN); }
    if (edgeN) { pass.setVertexBuffer(0, bufs.edge); pass.draw(4, edgeN); }
  }
  function landed(x0, z0, x1, z1) {
    for (let cz = Math.floor(z0 / CELL) - 1; cz <= Math.floor(z1 / CELL) + 1; cz++) for (let cx = Math.floor(x0 / CELL) - 1; cx <= Math.floor(x1 / CELL) + 1; cx++) cells.delete(cx * 8192 + cz);
    at = [1e12, 1e12]; farAt = [1e12, 1e12];
  }
  return { forms, update, draw, cellOf, landed, treePipe, shadowPipe, stats: () => ({ trees: counts.near + counts.mid + counts.far, treesNear: counts.near, treesMid: counts.mid, treesFar: counts.far, triangles: ranges.near.reduce((a, [i, , n]) => a + forms[i].nearN / 3 * n, 0) + ranges.mid.reduce((a, [i, , n]) => a + forms[i].midN / 3 * n, 0) + counts.far * 2 }) };
}
