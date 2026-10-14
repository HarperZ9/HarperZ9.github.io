// The CPU twin of the tile pass (web/motion/tiles_gpu.mjs): the same cell, tile, flip
// and texel arithmetic per pixel centre, premultiplied RGBA in [0, 1] over transparent.
//   tilesRef(map, image /* { width, height, data: RGBA8 } */, { ox, oy, s, opacity, fade }, W, H)
export function tilesRef(map, image, { ox = 0, oy = 0, s = 1, opacity = 1, fade = null }, W, H) {
  const out = new Float32Array(W * H * 4), ts = map.tilesets[0];
  const cols = Math.max(1, ts.columns || Math.floor(image.width / map.tileW)), sp = ts.spacing || 0, mg = ts.margin || 0;
  const f32 = Math.fround, to = fade ? f32(fade.to ?? 0.25) : 0;
  for (const [li, L] of map.layers.entries()) {
    if (!L.visible) continue;
    const op0 = f32(opacity * (L.opacity ?? 1)), fades = !!fade && (fade.layers ? fade.layers.includes(L.name) : li > 0);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      let mx = Math.fround(Math.fround(x + 0.5 - ox) / s), my = Math.fround(Math.fround(y + 0.5 - oy) / s);
      if (map.orientation === "isometric") {
        // Fround each step, as the GPU computes in f32.
        const f = Math.fround, a = f(mx / f(map.tileW * 0.5)), b = f(my / f(map.tileH * 0.5));
        const gx = f(f(a + b) * 0.5), gy = f(f(b - a) * 0.5);
        if (gx < 0 || gy < 0) continue;
        const cx = Math.floor(gx), cy = Math.floor(gy), fx = f(gx - cx), fy = f(gy - cy);
        mx = f(cx * map.tileW + f(f(f(fx - fy) + 1) * 0.5) * map.tileW); my = f(cy * map.tileH + f(f(fx + fy) * 0.5) * map.tileH);
      }
      if (mx < 0 || my < 0) continue;
      const cx = Math.floor(mx / map.tileW), cy = Math.floor(my / map.tileH);
      if (cx >= map.width || cy >= map.height) continue;
      const i = cy * map.width + cx, gid = L.gids[i];
      if (gid < ts.firstgid) continue;
      const local = gid - ts.firstgid;
      let fx = Math.floor(mx) - cx * map.tileW, fy = Math.floor(my) - cy * map.tileH;
      const fl = L.flip[i], op = fades ? f32(op0 * f32(1 - f32(f32(fade.cells[i]) * f32(1 - to)))) : op0;
      if (fl & 4) [fx, fy] = [fy, fx];
      if (fl & 1) fx = map.tileW - 1 - fx;
      if (fl & 2) fy = map.tileH - 1 - fy;
      const tw = ts.tileW || map.tileW, th = Math.max(ts.tileH || map.tileH, map.tileH);
      const tx = mg + (local % cols) * (tw + sp) + fx, ty = mg + Math.floor(local / cols) * (th + sp) + fy + (th - map.tileH);
      if (tx >= image.width || ty >= image.height) continue;
      const j = 4 * (ty * image.width + tx), a = image.data[j + 3] / 255, o = 4 * (y * W + x);
      const c = [image.data[j] / 255 * a * op, image.data[j + 1] / 255 * a * op, image.data[j + 2] / 255 * a * op, a * op];
      for (let k = 0; k < 4; k++) out[o + k] = c[k] + out[o + k] * (1 - c[3]);
    }
  }
  return out;
}
