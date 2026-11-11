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
function slow(host, cls, input, ctx, what, draw) {
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
    host.querySelector('canvas')?.toBlob((blob) => { if (!blob) return; const a = document.createElement('a'), url = URL.createObjectURL(blob); a.href = url; a.download = `${ids(ctx.ix, state).join('-')}.${cls.slice(3)}.png`;
      document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000); }, 'image/png'); };
  host.addEventListener('click', onClick);
  return { update(next) { state = { ...state, ...next }; later(); }, value: () => ({ canvas: host.querySelector('canvas'), drawn: +(host.dataset.drawn || 0) }), now: () => { seen = true; return paint(); },
    destroy() { dead = true; clearTimeout(timer); io?.disconnect(); host.removeEventListener('click', onClick); host.innerHTML = ''; host.classList.remove(cls); delete host.dataset.drawn; } };
}

// The blend as the studio's plate: sRGB bytes, w by h.
async function plate(ix, state, w, h) {
  const lane = await import('../../studio/lib/lanes/image.mjs'), sb = studioBlend(ix, ids(ix, state), state.weights, state.settings);
  return { rgba: lane.toRGBA(lane.renderImage(sb.material, { w, h, seed: 3, marks: false }), sb.material), sb };
}
const put = (canvas, rgba, w, h) => { canvas.width = w; canvas.height = h; canvas.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(rgba.buffer, rgba.byteOffset, w * h * 4), w, h), 0, 0); };

export function mount_plate(host, input, ctx) {
  return slow(host, 'sf-plate', input, ctx, 'The plate', async (canvas, state) => {
    const { rgba, sb } = await plate(ctx.ix, state, W, H); put(canvas, rgba, W, H);
    const kinds = sb.material.hints.image.plates.map((p) => p.kind);
    canvas.setAttribute('aria-label', `A plate of ${sb.parts.map((p) => p.name).join(', ')}: ${kinds.join(' over ')}`);
    return `The studio's image lane: ${kinds.join(', ')}, stacked in linear light. Each part brings the plates of its nearest studio material, in its own measured colour.`;
  });
}

export function mount_glass(host, input, ctx) {
  return slow(host, 'sf-glass', input, ctx, 'The glass', async (canvas, state) => {
    const [g, r] = await Promise.all([import('../../glass/glass.js'), import('../../glass/lib/raster.js')]);
    const { rgba, sb } = await plate(ctx.ix, state, W, H), mask = new Float32Array(W * H);
    // one rounded body in the middle of the plate, large enough that its edge bends what lies behind it
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) mask[y * W + x] = Math.hypot((x - W / 2) / 1.35, y - H / 2) < H * 0.36 ? 1 : 0;
    const out = g.renderGlass(r.fromSRGB8(W, H, rgba), g.fromMask(mask, W, H, { radius: 46, thickness: 70 }), { glass: 'crown', gap: 70 });
    put(canvas, r.toSRGB8(out, 1), W, H);
    canvas.setAttribute('aria-label', `The plate of ${sb.parts.map((p) => p.name).join(', ')} seen through a rounded piece of crown glass`);
    return 'The same plate behind a rounded piece of crown glass: the site\'s glass renderer bends each colour by its own amount, so the edge fringes.';
  });
}

export function mount_living(host, input, ctx) {
  let family = null;
  return slow(host, 'sf-living', input, ctx, 'The living type', async (canvas, state) => {
    const eng = await import('../../typeengine/lib/render.mjs');
    family = family || await (await fetch(new URL('../../typeengine/families/current-1.json', import.meta.url))).json();
    const { ix } = ctx, els = ids(ix, state).map((id) => ix.byId.get(id)), lead = els[0];
    // the family reads a series of numbers; here, the leading element's measured properties, each as its place on the table's range
    const series = (lead.properties || []).map((p) => +(pos(ix.spread.get(p.name), p.value) / 12.5).toFixed(2));
    const word = els.map((e) => e.name).join(' + '), opt = { seed: 2, ...(series.length >= 3 ? { inputs: { 'data.series': { values: series, label: `${lead.name}, measured properties`, unit: 'place on the table\'s range' } } } : {}) };
    const out = await eng.renderWord(family, word, W * 2, H, opt), d = out.raster.data, px = new Uint8ClampedArray(W * 2 * H * 4);
    for (let i = 0; i < d.length; i += 4) { for (let c = 0; c < 3; c++) { const v = Math.min(1, Math.max(0, d[i + c])); px[i + c] = 255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055); } px[i + 3] = 255; }
    put(canvas, px, W * 2, H);
    canvas.setAttribute('aria-label', `The words ${word}, set by the type engine`);
    return series.length >= 3 ? `The words “${word}” in the type engine's family ${family.name}. Its letters are bent by a series of numbers: here the ${series.length} measured properties of ${lead.name}.`
      : `The words “${word}” in the type engine's family ${family.name}, on its own series: ${lead.name} has too few measured properties to give it one.`;
  });
}
