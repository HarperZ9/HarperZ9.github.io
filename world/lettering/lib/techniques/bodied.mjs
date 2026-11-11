// Bodied: letters that stand up from the page. Each letter is a solid with a rounded shoulder, side walls that
// run back from the face, and a soft contact shadow where it meets the ground. Nothing is drawn behind the word:
// the page shows through, so the letters sit on whatever the page is (a sky, a sheet, a sea).
//   face     a height field from the letter's own signed distance: a shoulder that rises over a set share of the
//            half stroke, then a flat top; lit by a lamp (Lambert plus a narrow highlight) from its normals;
//   walls    the letter's mask swept along one fixed direction for `depth` pixels, darker with distance from the face,
//            so the body reads the same from every lamp position;
//   shadow   the swept mask continued and blurred, at low strength, so the body touches the ground;
//   lamp     sweeps once, then rests at the upper left; the pointer then holds it. Reduced motion shows the rest state.
// The real text node stays in the page (selectable, read aloud, searchable); this draws beneath it.
// Sizes follow the letter: at running-text sizes the walls are one or two pixels and the face stays flat enough to
// read. `legibility()` below is the number the tests hold: the share of face pixels whose contrast with the ground
// stays above a floor at every lamp position.
import { clamp, smoothstep, canvas, parseColor } from '../paint.mjs';

export const meta = {
  id: 'bodied', title: 'Bodied', renderer: '2d', ground: 'none', weight: 800,
  lineage: 'Dimensional sign letters and cast type; the supergraphic tradition of letters as objects (Barbara Stauffacher Solomon).',
  does: 'Letters as solids: a lit face with a rounded shoulder, side walls and a contact shadow, on a clear ground.',
  params: {
    depth: 'wall length in work pixels (default 0.9 x half stroke, 1 to 16)',
    shoulder: 'shoulder width as a share of the half stroke, 0.15 to 1 (default 0.5)',
    angle: 'direction the body runs back, radians, 0 is right and positive is down (default 0.9)',
    shadow: 'contact shadow strength, 0 to 1 (default 0.45)',
    rest: 'lamp at rest: azimuth 2.35 rad (upper left), elevation 0.75 rad',
  },
};

// Height in [0,1] and unit normals from the signed distance (positive inside). Returns the list of face pixels too.
export function bodyField(g, o = {}) {
  const { w, h, sdf } = g, n = w * h, half = Math.max(1, g.half);
  const sh = Math.max(0.8, half * clamp(o.shoulder ?? 0.5, 0.15, 1));
  const height = new Float32Array(n), cover = new Float32Array(n), face = [];
  for (let i = 0; i < n; i++) {
    const d = sdf[i];
    cover[i] = clamp(d + 0.5, 0, 1);
    if (d > -0.5) { const p = clamp(d / sh, 0, 1); height[i] = Math.sin(p * Math.PI / 2); face.push(i); }   // quarter-round shoulder
  }
  // the shoulder leans about 50 degrees at its steepest: slope = pi/2 per shoulder width, times this gain
  const gain = sh * 0.75, nx = new Float32Array(n), ny = new Float32Array(n), nz = new Float32Array(n);
  for (const i of face) {
    const x = i % w, y = (i / w) | 0;
    const hx = height[y * w + Math.min(w - 1, x + 1)] - height[y * w + Math.max(0, x - 1)];
    const hy = height[Math.min(h - 1, y + 1) * w + x] - height[Math.max(0, y - 1) * w + x];
    const a = -hx * gain * 0.5, b = -hy * gain * 0.5, l = Math.hypot(a, b, 1);
    nx[i] = a / l; ny[i] = b / l; nz[i] = 1 / l;
  }
  return { height, cover, face, nx, ny, nz, shoulder: sh };
}

// Walls and contact shadow: for each ground pixel, how far back along the body direction the nearest face lies.
// wall[i] in (0,1]: 1 next to the face, falling to 0 at `depth`. shade[i]: blurred continuation for the shadow.
export function sweep(g, F, o = {}) {
  const { w, h } = g, n = w * h, depth = Math.round(clamp(o.depth ?? g.half * 0.9, 1, 16));
  const ang = o.angle ?? 0.9, ex = Math.cos(ang), ey = Math.sin(ang);
  const wall = new Float32Array(n), reach = depth + Math.max(2, Math.round(depth * 0.8)), soft = new Float32Array(n);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x; if (F.cover[i] >= 1) continue;
    for (let s = 1; s <= reach; s++) {
      const sx = Math.round(x - ex * s), sy = Math.round(y - ey * s);
      if (sx < 0 || sy < 0 || sx >= w || sy >= h) break;
      const c = F.cover[sy * w + sx];
      if (c > 0.5) { if (s <= depth) wall[i] = 1 - (s - 1) / depth; else soft[i] = 1 - (s - depth) / (reach - depth + 1); break; }
    }
  }
  // one small box blur for the shadow's edge; walls stay crisp
  const r = Math.max(1, Math.round(depth * 0.35)), tmp = new Float32Array(n), shade = new Float32Array(n);
  for (let y = 0; y < h; y++) { let acc = 0; for (let x = -r; x < w; x++) { if (x + r < w) acc += soft[y * w + x + r] + (wall[y * w + x + r] > 0 ? 0.6 : 0); if (x - r - 1 >= 0) acc -= soft[y * w + x - r - 1] + (wall[y * w + x - r - 1] > 0 ? 0.6 : 0); if (x >= 0) tmp[y * w + x] = acc / (2 * r + 1); } }
  for (let x = 0; x < w; x++) { let acc = 0; for (let y = -r; y < h; y++) { if (y + r < h) acc += tmp[(y + r) * w + x]; if (y - r - 1 >= 0) acc -= tmp[(y - r - 1) * w + x]; if (y >= 0) shade[y * w + x] = acc / (2 * r + 1); } }
  return { wall, shade, depth, dir: [ex, ey] };
}

// Light on the face for a lamp at azimuth az (0 is right, counter-clockwise, screen y down) and elevation el.
// Returns a value near 1 on the flat top whatever the lamp does, so the word keeps its ink.
export function faceLight(nx, ny, nz, az, el) {
  const lx = Math.cos(az) * Math.cos(el), ly = -Math.sin(az) * Math.cos(el), lz = Math.sin(el);
  const lam = Math.max(0, nx * lx + ny * ly + nz * lz), flat = lz;
  // half vector with the viewer straight on
  const hx = lx, hy = ly, hz = lz + 1, hl = Math.hypot(hx, hy, hz), spec = Math.pow(Math.max(0, (nx * hx + ny * hy + nz * hz) / hl), 48);
  return { diff: 0.78 + 0.5 * (lam - flat), spec };
}

// Share of face pixels on the flat top (height 1). The top is lit evenly, so this is the part that reads as type.
export function legibility(F) { let top = 0; for (const i of F.face) if (F.height[i] > 0.985) top++; return F.face.length ? top / F.face.length : 0; }

export async function create(g, env) {
  const o = env.opts, F = bodyField(g, o), S = sweep(g, F, o), { w, h } = g;
  const off = canvas(w, h), ox = off.getContext('2d'), img = ox.createImageData(w, h), px = img.data;
  const ink = parseColor(env.theme.ink), dark = env.theme.dark;
  // walls: the ink carried toward the ground's opposite, so the body separates from both face and page
  const wallTo = dark ? [14, 16, 22] : [40, 34, 28], wallMix = dark ? 0.62 : 0.7;
  const wc = ink.map((v, k) => v + (wallTo[k] - v) * wallMix), sstr = clamp(o.shadow ?? 0.45, 0, 1);
  // ground layer (walls and shadow) never changes: paint it once
  const base = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    const wl = S.wall[i], shd = S.shade[i] * sstr;
    if (wl > 0) { const k = 0.55 + 0.45 * wl; base[i * 4] = wc[0] * k; base[i * 4 + 1] = wc[1] * k; base[i * 4 + 2] = wc[2] * k; base[i * 4 + 3] = 255; }
    else if (shd > 0.004) { base[i * 4 + 3] = Math.round(255 * Math.min(0.6, shd)); }
  }
  const REST = { az: 2.35, el: 0.75 }, sweepT = o.sweep ?? 4.5;
  const st = { az: REST.az, el: REST.el, azT: REST.az, elT: REST.el, held: false, done: false };
  function paint() {
    px.set(base);
    for (const i of F.face) {
      const L = faceLight(F.nx[i], F.ny[i], F.nz[i], st.az, st.el), a = F.cover[i], j = i * 4;
      const r = ink[0] * L.diff + 255 * L.spec * 0.55, gg = ink[1] * L.diff + 255 * L.spec * 0.55, b = ink[2] * L.diff + 255 * L.spec * 0.55;
      if (a >= 1) { px[j] = r; px[j + 1] = gg; px[j + 2] = b; px[j + 3] = 255; }
      else { const ba = px[j + 3] / 255, oa = a + ba * (1 - a) || 1; px[j] = (r * a + px[j] * ba * (1 - a)) / oa; px[j + 1] = (gg * a + px[j + 1] * ba * (1 - a)) / oa; px[j + 2] = (b * a + px[j + 2] * ba * (1 - a)) / oa; px[j + 3] = 255 * oa; }
    }
    ox.putImageData(img, 0, 0);
  }
  return {
    fields: F, walls: S,
    draw(ctx, t) {
      if (!st.held && !st.done && t < sweepT) { const u = t / sweepT; st.azT = REST.az + 1.4 * Math.cos(u * Math.PI); st.elT = 0.55 + 0.25 * Math.sin(u * Math.PI); }
      else if (!st.held) { st.azT = REST.az; st.elT = REST.el; }
      st.az += Math.atan2(Math.sin(st.azT - st.az), Math.cos(st.azT - st.az)) * 0.18; st.el += (st.elT - st.el) * 0.18;
      paint();
      ctx.clearRect(0, 0, w, h); ctx.drawImage(off, 0, 0, w, h);
      return (t < sweepT && !st.done) || Math.abs(st.elT - st.el) + Math.abs(Math.sin(st.azT - st.az)) > 0.002;
    },
    pointer(x, y, inside) {
      if (!inside) { st.held = false; return; }
      const nx = (x / w) * 2 - 1, ny = (y / h) * 2 - 1; st.held = true;
      st.azT = Math.atan2(-ny, nx); st.elT = 0.35 + 0.8 * (1 - clamp(Math.hypot(nx, ny * 0.6)));
    },
    finish() { st.done = true; st.az = st.azT = REST.az; st.el = st.elT = REST.el; }, replay() { st.done = false; },
  };
}
export { smoothstep };
