// raster.mjs — pure-JS RGBA rasterizer (no canvas). Output is sense-core-perceivable (ch=4).
export function framebuffer(width, height, bg = [10, 12, 16, 255]) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < data.length; i += 4) { data[i] = bg[0]; data[i + 1] = bg[1]; data[i + 2] = bg[2]; data[i + 3] = bg[3]; }
  return { data, width, height };
}
function blend(fb, x, y, r, g, b, a) {
  x = Math.round(x); y = Math.round(y);
  if (x < 0 || y < 0 || x >= fb.width || y >= fb.height) return;
  const o = (y * fb.width + x) * 4, ia = 1 - a;
  fb.data[o] = r * a + fb.data[o] * ia;
  fb.data[o + 1] = g * a + fb.data[o + 1] * ia;
  fb.data[o + 2] = b * a + fb.data[o + 2] * ia;
  fb.data[o + 3] = 255;
}
export function drawLine(fb, x0, y0, x1, y1, [r, g, b, a = 255]) {
  const af = a / 255;
  x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    blend(fb, x0, y0, r, g, b, af);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
}
export function drawDisc(fb, cx, cy, radius, [r, g, b, a = 255]) {
  const af = a / 255, rr = radius * radius;
  for (let y = Math.floor(cy - radius); y <= Math.ceil(cy + radius); y++)
    for (let x = Math.floor(cx - radius); x <= Math.ceil(cx + radius); x++) {
      const d = (x - cx) ** 2 + (y - cy) ** 2;
      if (d <= rr) blend(fb, x, y, r, g, b, af);
    }
}
// Map scene normalized [-1,1] → pixel space (y flipped) and draw segments then glowing vertices.
export function rasterize(scene, { width = 512, height = 512, background } = {}) {
  const fb = framebuffer(width, height, background);
  const toPx = (x, y) => [(x + 1) / 2 * (width - 1), (1 - (y + 1) / 2) * (height - 1)];
  for (const s of scene.segments) {
    const [x1, y1] = toPx(s.x1, s.y1), [x2, y2] = toPx(s.x2, s.y2);
    drawLine(fb, x1, y1, x2, y2, [...s.color, Math.round(s.opacity * 255)]);
  }
  for (const p of scene.points) {
    const [x, y] = toPx(p.x, p.y);
    drawDisc(fb, x, y, p.size, [...p.color, Math.round(p.opacity * 255)]);
  }
  return fb;
}
