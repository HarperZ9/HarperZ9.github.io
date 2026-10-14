// The isometric camera (ROADMAP M2 criterion 9): diamond tiles of tileW x tileH, cells
// to screen and back, picking, depth order and the occlusion fade. Pure: runs in Node.
//
//   const iso = isoCamera({ tileW: 64, tileH: 32, origin: [960, 120], zoom: 1 });
//   iso.toScreen(cx, cy, z = 0)   // a point in cell units (cell (i, j) spans [i, i+1) x [j, j+1)) to pixels
//   iso.pick(sx, sy)              // the cell under a pixel on the ground plane, [i, j], or null off the map
//   iso.depth(cx, cy, z)          // draw order key: larger draws later (nearer the viewer)
//   fadeMask(map, iso, target, { radius })   // which cells hide the target, and by how much
//
// The ground is the plane z = 0; height z lifts a point straight up the screen by
// z * tileH (one cell of height is as tall as a tile is high). Picking inverts the
// projection exactly on that plane: a ray from the eye along the view direction meets
// the ground at one point, and the cell is its floor.

export function isoCamera({ tileW = 64, tileH = 32, origin = [0, 0], zoom = 1, width = Infinity, height = Infinity } = {}) {
  const hw = (tileW / 2) * zoom, hh = (tileH / 2) * zoom, [ox, oy] = origin;
  const cam = {
    tileW, tileH, zoom, origin, width, height,
    toScreen(cx, cy, z = 0) { return [ox + (cx - cy) * hw, oy + (cx + cy) * hh - z * tileH * zoom]; },
    // The ground point under a pixel, in cell units (the exact inverse of toScreen at z = 0).
    toGround(sx, sy) { const a = (sx - ox) / hw, b = (sy - oy) / hh; return [(a + b) / 2, (b - a) / 2]; },
    pick(sx, sy) {
      const [gx, gy] = cam.toGround(sx, sy), i = Math.floor(gx), j = Math.floor(gy);
      return i < 0 || j < 0 || i >= width || j >= height ? null : [i, j];
    },
    // Painter's order: farther rows first, and higher things over lower ones in a cell.
    depth(cx, cy, z = 0) { return (cx + cy) * 1024 + z; },
  };
  return cam;
}

// The occlusion fade: a cell with something tall (heights[j * w + i] > 0) hides the target
// when it is nearer the viewer (larger depth) and its screen footprint covers the target's
// screen point. The fade is 1 inside radius cells of the target's screen point, falling
// linearly to 0 at twice the radius, so the player sees through what stands in front.
// Returns a Float32Array of fade amounts per cell; the GPU pass is checked against it.
export function fadeMask({ width, height, heights }, iso, target, { radius = 1.5 } = {}) {
  const out = new Float32Array(width * height), [tx, ty, tz = 0] = target;
  const [px, py] = iso.toScreen(tx, ty, tz), tDepth = iso.depth(tx, ty, tz);
  const unitX = (iso.tileW / 2) * iso.zoom, unitY = (iso.tileH / 2) * iso.zoom;
  for (let j = 0; j < height; j++) for (let i = 0; i < width; i++) {
    const h = heights[j * width + i];
    if (!(h > 0) || iso.depth(i + 0.5, j + 0.5, 0) <= tDepth) continue;
    // The cell's column spans its diamond's width and from its base up to its top.
    const [bx, by] = iso.toScreen(i + 0.5, j + 0.5, 0), top = by - h * iso.tileH * iso.zoom - unitY;
    if (py < top || py > by + unitY) continue;
    const dx = Math.abs(px - bx) / unitX;
    if (dx > 1) continue;
    // Distance from the target to the column's centre line, in cells along the ground.
    const d = Math.hypot(i + 0.5 - tx, j + 0.5 - ty);
    out[j * width + i] = d <= radius ? 1 : d >= 2 * radius ? 0 : (2 * radius - d) / radius;
  }
  return out;
}
