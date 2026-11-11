// glass-ground.mjs: real refraction for the well's glass and ice grounds, by the site's glass renderer (world/glass).
// Nothing of the renderer is rewritten here. A body is built with its own builders (a pane with a pressed, rounded
// edge from fromMask; a hammered face from pebble), and its own displacementMap() gives, for every point of the pane,
// how far a ray of green light lands from where it entered, how much farther red and blue land (dispersion: each
// colour bends by its own amount), the light the face reflects (Fresnel) and the dark rim of a steep edge. That is the
// renderer's own output for a live page; the well's shader reads it as a texture and bends what lies behind the pane.
//
//   const m = await glassMap('glass' or 'ice');
//   m.data     w by h RGBA bytes: R, G the green ray's offset around 128; B reflected light; A the rim's darkening
//   m.reach    [x, y]: the offset at full range, as a share of the well's width and height
//   m.spread   { r, b }: how far red and blue land, against green (red below 1, blue above 1)
//   BODIES     the two bodies, in plain numbers
//
// Computed, not measured: the pane's shape is ours. The glass is borosilicate crown (index 1.517) from the renderer's
// table. Ice uses the table's entry for water (index 1.333), which stands in for ice (about 1.31).
export const W = 384, H = 288, SCALE = 56;
export const BODIES = Object.freeze({
  // window glass, a little uneven, with a pressed edge: broad shallow pebbles on a 16 px sheet, seen 60 px in front of what is behind
  glass: { glass: 'crown', inset: 5, radius: 14, thickness: 16, cell: 52, depth: 2.6, seed: 4, gap: 60 },
  // ice: thicker, with a rougher frozen face
  ice: { glass: 'water', inset: 3, radius: 9, thickness: 22, cell: 21, depth: 5.5, seed: 9, gap: 70 },
});
const cache = new Map();
export function glassMap(kind = 'glass') {
  if (!cache.has(kind)) cache.set(kind, build(BODIES[kind] ? kind : 'glass'));
  return cache.get(kind);
}
async function build(kind) {
  const g = await import('../../glass/glass.js'), b = BODIES[kind], mask = new Float32Array(W * H);
  for (let y = b.inset; y < H - b.inset; y++) mask.fill(1, y * W + b.inset, y * W + W - b.inset);
  const body = g.pebble(g.fromMask(mask, W, H, { radius: b.radius, thickness: b.thickness }), { cell: b.cell, depth: b.depth, seed: b.seed, soften: 2 });
  const d = g.displacementMap(body, { glass: b.glass, gap: b.gap }, SCALE), data = new Uint8Array(W * H * 4), o = d.overlay.data;
  for (let i = 0; i < W * H; i++) {
    data[i * 4] = d.rgba[i * 4]; data[i * 4 + 1] = d.rgba[i * 4 + 1];
    data[i * 4 + 2] = Math.min(255, 255 * (o[i * 4] + o[i * 4 + 1] + o[i * 4 + 2]) / 3); data[i * 4 + 3] = Math.min(255, 255 * o[i * 4 + 3]);
  }
  return { kind, w: W, h: H, data, reach: [SCALE / W, SCALE / H], spread: d.spread };
}
