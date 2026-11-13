// surface-more.mjs: three more of the site's tools behind the contract, each taking the bench's elements or blend.
//   mount_plate   the studio's image lane (world/studio/lib/lanes/image.mjs on the world/feed-25 compositor): the
//                 blend as a printed plate, its plates stacked in linear light
//   mount_glass   the glass renderer (world/glass): that plate seen through a glass body, refracted and fringed
//   mount_living  the type engine (world/typeengine): the blend's name set in a family whose letters are bent by a
//                 series of numbers; here the series is the leading element's measured properties, each placed on
//                 the table's range
// All three draw on the CPU, so they wait until they are near the viewport and until the visitor has stopped
// changing things, then draw once. Plain view leaves each one out and says so.
import { studioBlend } from './surface-blend.mjs';
import { pos } from './charts.mjs';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const ids = (ix, st) => st.elements.filter((id) => ix.byId.has(id)).slice(0, 4);
const W = 420, H = 280;

// One drawing surface: a canvas, a note, a save button. draw(canvas, state) may be slow; it runs when the host is
// near the viewport and 500 ms after the last change.
function slow(host, cls, input, ctx, what, draw, { ground = null } = {}) {
  let state = { ...input }, timer = 0, seen = false, dead = false, run = 0;
  host.classList.add(cls);
  const paint = async () => {
    const mine = ++run; if (dead || !seen) return;
    if (!ids(ctx.ix, state).length) { host.innerHTML = ''; return; }
    if (ctx.plain) { host.innerHTML = `<p class="ln-note">${esc(what)} is a drawing; plain view leaves it out.</p>`; return; }
    if (!host.querySelector('canvas')) host.innerHTML = `<canvas class="pl" width="${W}" height="${H}" role="img"></canvas><button type="button" data-save-more>Save this picture</button><p class="ln-note"></p>`;
    try { const note = await draw(host.querySelector('canvas'), state); if (mine === run && !dead) { host.querySelector('.ln-note').textContent = note; host.dataset.drawn = String(run); } }
    catch (e) { console.info(`${cls}: could not draw:`, e.message); if (!dead) host.querySelector('.ln-note').textContent = `${what} could not be drawn in this browser.`; }
  };
  const later = () => { clearTimeout(timer); timer = setTimeout(paint, 500); };
  const io = typeof IntersectionObserver === 'function' ? new IntersectionObserver((en) => { if (en.some((e) => e.isIntersecting)) { seen = true; io.disconnect(); later(); } }, { rootMargin: '300px' }) : null;
  if (io) io.observe(host); else { seen = true; later(); }
  const onClick = (ev) => { if (!ev.target.closest('[data-save-more]')) return;
    let c = host.querySelector('canvas'); if (!c) return;
    if (ground) { const o = document.createElement('canvas'); o.width = c.width; o.height = c.height; const x = o.getContext('2d'); x.fillStyle = ground; x.fillRect(0, 0, o.width, o.height); x.drawImage(c, 0, 0); c = o; }
    c.toBlob((blob) => { if (!blob) return; const a = document.createElement('a'), url = URL.createObjectURL(blob); a.href = url; a.download = `${ids(ctx.ix, state).join('-')}.${cls.slice(3)}.png`;
      document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000); }, 'image/png'); };
  host.addEventListener('click', onClick);
  return { update(next) { state = { ...state, ...next }; later(); }, value: () => ({ canvas: host.querySelector('canvas'), drawn: +(host.dataset.drawn || 0) }), now: () => { seen = true; return paint(); },
    destroy() { dead = true; clearTimeout(timer); io?.disconnect(); host.removeEventListener('click', onClick); host.innerHTML = ''; host.classList.remove(cls); delete host.dataset.drawn; } };
}

// Exposure. A plate is lifted to a stated target: mean luma 0.42 (on a 0 to 1 scale of the screen's own values) and
// at least 0.38 between its 5th and 95th percentile. measure() reads both; expose() applies one gain and offset.
export const TARGET = Object.freeze({ mean: 0.42, range: 0.38 });
export function measure(rgba) {
  const n = rgba.length / 4, y = new Float32Array(n); let m = 0;
  for (let i = 0; i < n; i++) { y[i] = (0.2126 * rgba[i * 4] + 0.7152 * rgba[i * 4 + 1] + 0.0722 * rgba[i * 4 + 2]) / 255; m += y[i]; }
  const s = Float32Array.from(y).sort(); return { mean: +(m / n).toFixed(3), range: +(s[Math.floor(n * 0.95)] - s[Math.floor(n * 0.05)]).toFixed(3) };
}
function expose(rgba) {
  const b = measure(rgba), gain = Math.max(1, TARGET.range / Math.max(0.02, b.range)), off = TARGET.mean - b.mean * gain;
  for (let i = 0; i < rgba.length; i += 4) for (let c = 0; c < 3; c++) rgba[i + c] = Math.min(255, Math.max(0, rgba[i + c] * gain + off * 255));
  return b;
}
// The blend as a plate. Its colour is the well's own pigment field (so the plate, the glass and the well agree); its
// surface is the studio's image lane, read as light and shade. Without a well (plain view) the blended colour stands in.
async function plate(ix, state, w, h, picture) {
  const lane = await import('../../studio/lib/lanes/image.mjs'), sb = studioBlend(ix, ids(ix, state), state.weights, state.settings);
  const relief = lane.toRGBA(lane.renderImage(sb.material, { w, h, seed: 3, marks: false }), sb.material), raw = measure(relief);
  const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d', { willReadFrequently: true });
  const src = picture?.();
  if (src) x.drawImage(src, 0, 0, w, h); else { x.fillStyle = sb.palette.mix; x.fillRect(0, 0, w, h); }
  const rgba = x.getImageData(0, 0, w, h).data, lo = raw.mean - raw.range, span = Math.max(0.05, raw.range * 2);
  for (let i = 0; i < rgba.length; i += 4) { const y = (0.2126 * relief[i] + 0.7152 * relief[i + 1] + 0.0722 * relief[i + 2]) / 255, k = 0.62 + 0.7 * Math.min(1, Math.max(0, (y - lo) / span));
    for (let ch = 0; ch < 3; ch++) rgba[i + ch] = Math.min(255, rgba[i + ch] * k); }
  expose(rgba);
  return { rgba, sb, raw, after: measure(rgba) };
}
const put = (canvas, rgba, w, h) => { canvas.width = w; canvas.height = h; canvas.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(rgba.buffer, rgba.byteOffset, w * h * 4), w, h), 0, 0); };
const stamp = (canvas, p) => { canvas.dataset.rawMean = p.raw.mean; canvas.dataset.rawRange = p.raw.range; canvas.dataset.mean = p.after.mean; canvas.dataset.range = p.after.range; };

export function mount_plate(host, input, ctx) {
  return slow(host, 'sf-plate', input, ctx, 'The plate', async (canvas, state) => {
    const p = await plate(ctx.ix, state, W, H, ctx.picture); put(canvas, p.rgba, W, H); stamp(canvas, p);
    const kinds = p.sb.material.hints.image.plates.map((k) => k.kind);
    canvas.setAttribute('aria-label', `A plate of ${p.sb.parts.map((e) => e.name).join(', ')}: ${kinds.join(' over ')}`);
    return `The well's own colours, printed through the studio's image lane (${kinds.join(', ')}) as light and shade, and exposed to a middle brightness.`;
  });
}

export function mount_glass(host, input, ctx) {
  return slow(host, 'sf-glass', input, ctx, 'The glass', async (canvas, state) => {
    const [g, r] = await Promise.all([import('../../glass/glass.js'), import('../../glass/lib/raster.js')]);
    const p = await plate(ctx.ix, state, W, H, ctx.picture), word = p.sb.parts.map((e) => e.name).join(' + ');
    // something legible behind the glass: a ruled grid and the blend's name, so the bending can be read
    const c = document.createElement('canvas'); put(c, p.rgba, W, H); const x = c.getContext('2d', { willReadFrequently: true });
    x.strokeStyle = 'rgba(244,239,230,.55)'; x.lineWidth = 1; x.beginPath(); for (let i = 20; i < W; i += 20) { x.moveTo(i + .5, 0); x.lineTo(i + .5, H); } for (let j = 20; j < H; j += 20) { x.moveTo(0, j + .5); x.lineTo(W, j + .5); } x.stroke();
    // the name is set whole: on as many lines as it needs (broken at the plus signs), at the largest size that fits the plate
    const face = (px) => `800 ${px}px "Hanken Grotesk", system-ui, sans-serif`, names = p.sb.parts.map((e, i) => (i ? '+ ' : '') + e.name);
    try { await document.fonts?.load(face(30), word); } catch (e) { console.info('glass: the name is set in the fallback face:', e.message); }
    x.fillStyle = '#f4efe6'; x.textAlign = 'center'; x.textBaseline = 'middle';
    let size = 46, lines = [word];
    for (; size >= 13; size -= 2) { x.font = face(size); lines = [];
      for (const n of names) { const last = lines[lines.length - 1]; if (last && x.measureText(`${last} ${n}`).width <= W * 0.86) lines[lines.length - 1] = `${last} ${n}`; else lines.push(n); }
      if (lines.every((l) => x.measureText(l).width <= W * 0.86) && lines.length * size * 1.15 <= H * 0.8 && (lines.length === 1 || size <= 34)) break; }
    lines.forEach((l, i) => x.fillText(l, W / 2, H / 2 + (i - (lines.length - 1) / 2) * size * 1.15));
    canvas.dataset.nameLines = String(lines.length); canvas.dataset.nameWidest = String(Math.round(Math.max(...lines.map((l) => x.measureText(l).width))));
    const mask = new Float32Array(W * H);
    for (let yy = 0; yy < H; yy++) for (let xx = 0; xx < W; xx++) mask[yy * W + xx] = Math.hypot((xx - W * 0.62) / 1.25, yy - H * 0.5) < H * 0.34 ? 1 : 0;
    const out = g.renderGlass(r.fromSRGB8(W, H, x.getImageData(0, 0, W, H).data), g.fromMask(mask, W, H, { radius: 60, thickness: 46 }), { glass: 'crown', gap: 36 });
    put(canvas, r.toSRGB8(out, 1), W, H); stamp(canvas, p);
    canvas.setAttribute('aria-label', `The plate of ${word}, ruled and named, with a rounded piece of crown glass over its right half`);
    return 'The plate with a ruled grid and the blend\'s name, and a rounded piece of crown glass over part of it. The site\'s glass renderer bends each colour by its own amount: follow the lines and letters through it.';
  });
}

// The type engine draws on its own paper. Here the paper is taken away: how far each pixel stands from the paper
// becomes how much light ink is laid on the page's own ground. A saved picture keeps a ground of its own.
export function mount_living(host, input, ctx) {
  let family = null, timer = 0;
  const h = slow(host, 'sf-living', input, ctx, 'The living type', async (canvas, state) => {
    const eng = await import('../../typeengine/lib/render.mjs');
    family = family || await (await fetch(new URL('../../typeengine/families/current-1.json', import.meta.url))).json();
    const { ix } = ctx, els = ids(ix, state).map((id) => ix.byId.get(id)), lead = els[0];
    const series = (lead.properties || []).map((p) => +(pos(ix.spread.get(p.name), p.value) / 12.5).toFixed(2));
    const word = els.map((e) => e.name).join(' + '), inputs = series.length >= 3 ? { inputs: { 'data.series': { values: series, label: `${lead.name}, measured properties`, unit: 'place on the table\'s range' } } } : {};
    const w = W * 2, hh = Math.round(H * 0.7);
    const frame = async (t) => {
      const out = await eng.renderWord(family, word, w, hh, { seed: 2, t, ...inputs }), d = out.raster.data, px = new Uint8ClampedArray(w * hh * 4), g = [d[0], d[1], d[2]];
      for (let i = 0; i < d.length; i += 4) { const a = Math.min(1, (Math.abs(d[i] - g[0]) + Math.abs(d[i + 1] - g[1]) + Math.abs(d[i + 2] - g[2])) / (g[0] + g[1] + g[2]) * 1.15);
        px[i] = 244; px[i + 1] = 239; px[i + 2] = 230; px[i + 3] = 255 * a; }
      put(canvas, px, w, hh);
    };
    clearTimeout(timer); canvas.classList.add('lv');
    // the engine's own clock: a short, slow run of frames, then it rests. Reduced motion shows the resting frame only.
    if (ctx.reduced) await frame(0); else { let k = 0; const step = async () => { await frame(k * 0.35); if (++k < 8 && canvas.isConnected) timer = setTimeout(step, 420); }; await step(); }
    canvas.setAttribute('aria-label', `The words ${word}, set by the type engine`);
    return series.length >= 3 ? `The words “${word}” in the type engine's family ${family.name}. Its letters are bent by a series of numbers: here the ${series.length} measured properties of ${lead.name}.`
      : `The words “${word}” in the type engine's family ${family.name}, on its own series: ${lead.name} has too few measured properties to give it one.`;
  }, { ground: '#0c1620' });
  const destroy = h.destroy; h.destroy = () => { clearTimeout(timer); destroy(); };
  return h;
}
