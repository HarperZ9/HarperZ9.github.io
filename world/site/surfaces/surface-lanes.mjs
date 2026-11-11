// surface-lanes.mjs: three small surfaces that take the blend onward, each an existing tool behind the contract.
//   mount_motion     the studio's motion lane (world/studio/lib/lanes/motion.mjs): the blend's timing curve, drawn
//   mount_lettering  the studio's type lane into the lettering library (world/lettering): the blend's name, drawn
//                    in the technique of its leading part and inked in the blended colour
//   mount_plot       a pen study from the drawing instruments (system/instruments), its pens inked with the parts
// Each takes { elements, weights, settings } and reads the blended studio material from surface-blend.mjs.
import { studioBlend } from './surface-blend.mjs';
import { motion } from '../../studio/lib/lanes/motion.mjs';
import { GROUND } from './charts.mjs';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const ready = (ix, st) => st.elements.filter((id) => ix.byId.has(id)).slice(0, 4);
const surface = (host, cls, render, clean = () => {}) => { host.classList.add(cls); return { destroy() { clean(); host.innerHTML = ''; host.classList.remove(cls); }, render }; };

export function mount_motion(host, input, ctx) {
  let state = { ...input };
  const draw = () => {
    const ids = ready(ctx.ix, state); if (!ids.length) { host.innerHTML = ''; return; }
    const mo = motion(studioBlend(ctx.ix, ids, state.weights, state.settings).material), pts = mo.samples(48);
    host.innerHTML = `<svg class="mo" viewBox="0 0 200 80" role="img" aria-label="Timing curve: progress against time"><path class="mo-axis" d="M4 76H196M4 76V4"/><polyline points="${pts.map(([u, v]) => `${(4 + u * 192).toFixed(1)},${(76 - v * 72).toFixed(1)}`).join(' ')}"/></svg>` +
      `<p class="ln-note" data-curve="${esc(mo.curve)}">${esc(mo.curve)}. One build takes ${mo.durationS.toFixed(1)} s at ${mo.fps} frames a second. Computed from the parts by the studio's motion lane.</p>`;
  };
  const s = surface(host, 'sf-motion', draw); draw();
  return { update(next) { state = { ...state, ...next }; draw(); }, value: () => (ready(ctx.ix, state).length ? motion(studioBlend(ctx.ix, ready(ctx.ix, state), state.weights, state.settings).material).samples(48) : null), destroy: s.destroy };
}

export function mount_lettering(host, input, ctx) {
  let state = { ...input }, handle = null, run = 0;
  async function draw() {
    const ids = ready(ctx.ix, state), mine = ++run;
    handle?.destroy?.(); handle = null;
    if (!ids.length) { host.innerHTML = ''; return; }
    const sb = studioBlend(ctx.ix, ids, state.weights, state.settings), word = sb.parts.map((p) => p.name).join(' + ');
    const tech = sb.material.hints.type.technique;
    host.innerHTML = `<p class="lt-word" data-technique="${esc(tech)}" style="color:${esc(sb.palette.ink)}">${esc(word)}</p><p class="ln-note">The words “${esc(word)}”, lettered as ${esc(tech)}, the technique of the leading part's nearest studio material, in the blended colour.</p>`;
    if (ctx.plain) return;
    try {
      const [lettering, glyph, lane] = await Promise.all([import('../../lettering/lib/letter.mjs'), import('../../lettering/lib/glyph.mjs'), import('../../studio/lib/lanes/type.mjs')]);
      if (mine !== run) return;
      // the lettering reads the page's ground; here that is the water the bench sits on
      const mat = { ...sb.material, palette: { ...sb.material.palette, ground: GROUND } };
      handle = await lane.mountType(host.querySelector('.lt-word'), word, mat, { lettering, glyph, reduced: ctx.reduced });
      if (mine !== run) { handle?.destroy?.(); handle = null; }
    } catch (e) { console.info('lettering: the word stays as plain type:', e.message); }
  }
  const s = surface(host, 'sf-lettering', draw, () => { run++; handle?.destroy?.(); }); draw();
  return { update(next) { state = { ...state, ...next }; draw(); }, value: () => ({ technique: host.querySelector('.lt-word')?.dataset.technique ?? null, drawn: !!handle }), destroy: s.destroy };
}

const rgb = (hex) => { const n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
export function mount_plot(host, input, ctx) {
  let state = { piece: 'flow-comb', ...input }, lib = null, run = 0;
  async function draw() {
    const ids = ready(ctx.ix, state), mine = ++run; if (!ids.length) { host.innerHTML = ''; return; }
    if (ctx.plain) { host.innerHTML = `<p class="ln-note">The pen study is a drawing; plain view leaves it out.</p>`; return; }
    try { lib = lib || await import('../../../system/instruments/wave8-plotter-density.js'); } catch (e) { console.info('pen study: the instrument did not load:', e.message); return; }
    if (mine !== run) return;
    const sb = studioBlend(ctx.ix, ids, state.weights, state.settings), inks = [...sb.parts.map((p) => p.hex), sb.palette.mix, sb.palette.mix].slice(0, 3).map(rgb);
    if (!host.querySelector('canvas')) host.innerHTML = `<canvas class="pl" width="900" height="600" role="img"></canvas><label class="pl-pick">Study <select>${lib.WAVE8_PLOTTER_META.map((m) => `<option value="${esc(m.name)}">${esc(m.name.replace(/-/g, ' '))}</option>`).join('')}</select></label><button type="button" data-save-plot>Save this study</button><p class="ln-note"></p>`;
    const c = host.querySelector('canvas'), x = c.getContext('2d'), k = c.height / 300, meta = lib.WAVE8_PLOTTER_META.find((m) => m.name === state.piece);
    host.querySelector('select').value = state.piece;
    c.setAttribute('aria-label', `Pen study, ${state.piece.replace(/-/g, ' ')}: ${meta.blurb}`);
    host.querySelector('.ln-note').textContent = `${meta.blurb[0].toUpperCase() + meta.blurb.slice(1)}. Drawn by the site's plotter instrument with the parts' colours as its pens.`;
    x.setTransform(1, 0, 0, 1, 0, 0); x.fillStyle = GROUND; x.fillRect(0, 0, c.width, c.height);
    x.setTransform(k, 0, 0, k, 0, 0); x.lineCap = 'round';
    lib.WAVE8_PLOTTER[state.piece](x, c.width / k, c.height / k, 0, 20261111, { fluid: inks });
    c.dataset.inks = inks.map((i) => i.join(',')).join('|');
  }
  const onChange = (ev) => { if (ev.target.matches('.pl-pick select')) { state.piece = ev.target.value; draw(); } };
  // the study is our own drawing in the table's own colours, so it can be taken away as a picture
  const onClick = (ev) => { if (!ev.target.closest('[data-save-plot]')) return; const c = host.querySelector('canvas');
    c?.toBlob((blob) => { if (!blob) return; const a = document.createElement('a'), url = URL.createObjectURL(blob); a.href = url; a.download = `${ready(ctx.ix, state).join('-')}.${state.piece}.png`;
      document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000); }, 'image/png'); };
  host.addEventListener('change', onChange); host.addEventListener('click', onClick);
  const s = surface(host, 'sf-plot', draw, () => { run++; host.removeEventListener('change', onChange); host.removeEventListener('click', onClick); }); draw();
  return { update(next) { state = { ...state, ...next }; draw(); }, value: () => ({ canvas: host.querySelector('canvas'), piece: state.piece }), destroy: s.destroy };
}
