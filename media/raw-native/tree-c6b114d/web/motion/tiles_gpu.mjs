// Tile maps in the Motion frame (ROADMAP M2 criterion 10). A display-list item
//   { kind: "tilemap", map, tileset: "imageName", x, y, scale = 1, opacity = 1, screen, z, fade }
// draws a TileMap (web/world/tiles.mjs) whose first tileset image was added with
// Motion.image(name, ...). Each layer is one quad over the map; the fragment finds its
// cell, the cell's tile and the texel, and loads it from the atlas with no filtering,
// so pixel art stays exact at any integer scale. Layers draw in order, and draw order
// does not depend on the GPU. tilesRef() in web/world/tiles_ref.mjs is the CPU twin.
// fade: { cells, to = 0.25, layers } sees through what stands in front of the player:
// cells is fadeMask() from web/world/iso.mjs, and a faded layer (by name; every layer
// but the first by default) draws cell i at opacity 1 - cells[i] * (1 - to).
import { project, DEFAULT_CAMERA } from "./vector.mjs";

export const TILE_WGSL = /* wgsl */ `
struct T {
  box: vec4f,       // the map's screen rectangle in pixels
  map: vec4f,       // origin x, y in pixels, pixels per map pixel, opacity
  grid: vec4u,      // map width, height in cells; tile width, height in map pixels
  tsp: vec4u,       // firstgid, columns, spacing, margin
  atlas: vec4u,     // the tileset's top-left texel in the atlas, its width, height
  iso: vec4u,       // 1 for an isometric (diamond) map; 1 when this layer fades; the tileset's tile width, height
}
@group(0) @binding(0) var<uniform> U: T;
@group(0) @binding(1) var<storage, read> gids: array<u32>;
@group(0) @binding(2) var<storage, read> flips: array<u32>;
@group(0) @binding(3) var atlas: texture_2d<f32>;
@group(0) @binding(4) var<uniform> V: vec4f;   // frame width, height; the fade's floor opacity
@group(0) @binding(5) var<storage, read> fade: array<f32>;
@vertex fn vs(@builtin(vertex_index) v: u32) -> @builtin(position) vec4f {
  let c = vec2f(f32(v & 1u), f32((v >> 1u) & 1u));
  let p = mix(U.box.xy, U.box.zw, c);
  return vec4f(p.x / V.x * 2.0 - 1.0, 1.0 - p.y / V.y * 2.0, 0.0, 1.0);
}
@fragment fn fs(@builtin(position) q: vec4f) -> @location(0) vec4f {
  let m0 = (q.xy - U.map.xy) / U.map.z;                      // map pixels
  // Isometric: the ground point in cell units (web/world/iso.mjs toGround), then the
  // texel of the diamond within the tile image; orthogonal: cells are rectangles.
  var m = m0;
  if (U.iso.x == 1u) {
    let a = m0.x / (f32(U.grid.z) * 0.5);
    let b = m0.y / (f32(U.grid.w) * 0.5);
    let g = vec2f((a + b) * 0.5, (b - a) * 0.5);
    if (g.x < 0.0 || g.y < 0.0) { discard; }
    let c = floor(g);
    let fr = g - c;
    m = c * vec2f(U.grid.zw) + vec2f((fr.x - fr.y + 1.0) * 0.5 * f32(U.grid.z), (fr.x + fr.y) * 0.5 * f32(U.grid.w));
  }
  if (m.x < 0.0 || m.y < 0.0) { discard; }
  let cell = vec2u(floor(m / vec2f(U.grid.zw)));
  if (cell.x >= U.grid.x || cell.y >= U.grid.y) { discard; }
  let i = cell.y * U.grid.x + cell.x;
  let gid = gids[i];
  if (gid < U.tsp.x) { discard; }
  let local = gid - U.tsp.x;
  var f = vec2u(floor(m)) - cell * U.grid.zw;                 // texel within the tile
  let fl = (flips[i / 4u] >> ((i % 4u) * 8u)) & 7u;
  if ((fl & 4u) != 0u) { f = f.yx; }                          // diagonal first, as Tiled does
  if ((fl & 1u) != 0u) { f.x = U.grid.z - 1u - f.x; }
  if ((fl & 2u) != 0u) { f.y = U.grid.w - 1u - f.y; }
  // Tileset tiles may be taller than the grid (isometric walls): the grid cell is their bottom.
  let tile = vec2u(local % U.tsp.y, local / U.tsp.y);
  let t = vec2u(U.tsp.w) + tile * (U.iso.zw + vec2u(U.tsp.z)) + f + vec2u(0u, U.iso.w - U.grid.w);
  if (t.x >= U.atlas.z || t.y >= U.atlas.w) { discard; }
  let c = textureLoad(atlas, vec2i(U.atlas.xy + t), 0);
  var op = U.map.w;
  if (U.iso.y == 1u) { op = op * (1.0 - fade[i] * (1.0 - V.z)); }
  return vec4f(c.rgb * c.a, c.a) * op;
}`;

export class TileDraw {
  constructor(device, format, blend) {
    this.device = device;
    const module = device.createShaderModule({ label: "motion tiles", code: TILE_WGSL });
    this.pipe = device.createRenderPipeline({ label: "motion tiles", layout: "auto", primitive: { topology: "triangle-strip" },
      vertex: { module, entryPoint: "vs" }, fragment: { module, entryPoint: "fs", targets: [{ format, blend }] } });
    this.layers = new WeakMap(); this.ubufs = []; this.view = device.createBuffer({ size: 16, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
  }
  // GPU copies of a layer's gids and flips, kept while the layer object lives.
  #layer(L) {
    let g = this.layers.get(L);
    if (!g || g.n !== L.gids.length) {
      const mk = (arr) => { const b = this.device.createBuffer({ size: Math.max(16, Math.ceil(arr.byteLength / 4) * 4), usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST }); this.device.queue.writeBuffer(b, 0, arr.buffer, arr.byteOffset, Math.ceil(arr.byteLength / 4) * 4); return b; };
      const fl = new Uint8Array(Math.ceil(L.flip.length / 4) * 4); fl.set(L.flip);
      g = { n: L.gids.length, gids: mk(L.gids), flips: mk(fl) };
      this.layers.set(L, g);
    }
    return g;
  }
  // The fade cells in a storage buffer (16 bytes of zeros when there is no fade).
  #fade(cells) {
    const n = cells ? cells.length * 4 : 16;
    if (!this.fadeBuf || this.fadeBuf.size < n) { if (this.fadeBuf) this.fadeBuf.destroy(); this.fadeBuf = this.device.createBuffer({ size: Math.max(16, Math.ceil(n / 4) * 4), usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST }); }
    if (cells) this.device.queue.writeBuffer(this.fadeBuf, 0, Float32Array.from(cells));
    return this.fadeBuf;
  }
  // Record every visible layer of a tilemap item into a render pass.
  draw(rp, item, cam, W, H, design, images, atlasView, slot) {
    const map = item.map, ts = map.tilesets[0], im = images && images[item.tileset];
    if (!ts || !im) throw new Error(`tilemap: no tileset image ${item.tileset}`);
    const P = project({ ...item, stroke: null }, { ...DEFAULT_CAMERA, ...cam }, W, H, design);
    if (!P) return slot;
    const s = P.k * (item.scale ?? 1), ox = (item.x ?? 0) * P.k + P.ox, oy = (item.y ?? 0) * P.k + P.oy;
    const A = 2048, ax = Math.round(im.uv[0] * A), ay = Math.round(im.uv[1] * A);
    const fd = item.fade, fadeTo = fd ? (fd.to ?? 0.25) : 0;
    this.device.queue.writeBuffer(this.view, 0, new Float32Array([W, H, fadeTo, 0]));
    const fbuf = this.#fade(fd && fd.cells);
    for (const [li, L] of map.layers.entries()) {
      if (!L.visible) continue;
      const fades = !!fd && (fd.layers ? fd.layers.includes(L.name) : li > 0);
      const u = this.ubufs[slot] || (this.ubufs[slot] = this.device.createBuffer({ size: 96, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST }));
      slot++;
      const data = new ArrayBuffer(96), f = new Float32Array(data), U = new Uint32Array(data), iso = map.orientation === "isometric";
      // An isometric map's diamond spans x from -height to width half tiles around the origin.
      const bx0 = iso ? ox - map.height * map.tileW * s / 2 : ox, bx1 = iso ? ox + map.width * map.tileW * s / 2 : ox + map.width * map.tileW * s;
      const by1 = iso ? oy + (map.width + map.height) * map.tileH * s / 2 : oy + map.height * map.tileH * s;
      f.set([Math.max(0, bx0), Math.max(0, oy), Math.min(W, bx1), Math.min(H, by1), ox, oy, s, (item.opacity ?? 1) * (L.opacity ?? 1)]);
      U.set([map.width, map.height, map.tileW, map.tileH, ts.firstgid, Math.max(1, ts.columns || Math.floor(im.size[0] / map.tileW)), ts.spacing || 0, ts.margin || 0, ax, ay, im.size[0], im.size[1], iso ? 1 : 0, fades ? 1 : 0, ts.tileW || map.tileW, Math.max(ts.tileH || map.tileH, map.tileH)], 8);
      this.device.queue.writeBuffer(u, 0, data);
      const g = this.#layer(L);
      rp.setPipeline(this.pipe);
      rp.setBindGroup(0, this.device.createBindGroup({ layout: this.pipe.getBindGroupLayout(0), entries: [
        { binding: 0, resource: { buffer: u } }, { binding: 1, resource: { buffer: g.gids } }, { binding: 2, resource: { buffer: g.flips } },
        { binding: 3, resource: atlasView }, { binding: 4, resource: { buffer: this.view } },
        { binding: 5, resource: { buffer: fbuf } }] }));
      rp.draw(4);
    }
    return slot;
  }
}
