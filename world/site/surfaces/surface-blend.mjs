// surface-blend.mjs: the blend table as a surface. mount(host, { elements, weights, settings }, ctx).
// Two to four elements side by side: each property with its value, interval and n per part, the mix worked out
// from the parts (marked computed), the measured links between them, and the blended palette from the studio's
// own blend (world/studio/lib/blend.mjs, an OKLab mean). Weight controls call ctx.onWeights(weights);
// a part's Remove calls ctx.onRemove(id).
import { blendTable, materialFor, fmt } from './elements-data.mjs';
import { blend, contrast } from '../../studio/lib/blend.mjs';
import { mark, pos } from './charts.mjs';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// The elements as studio materials, blended by the studio. Returns the blended material and its palette.
export function studioBlend(ix, ids, weights, settings = {}) {
  const els = ids.map((id) => ix.byId.get(id)).filter(Boolean);
  const mats = els.map((e) => materialFor(ix, e, settings[e.id]));
  const material = blend(mats, weights ?? mats.map(() => 1));
  return { material, parts: els.map((e) => ({ id: e.id, name: e.name, hex: e.colour?.hex })), palette: { ...material.palette, mix: material.palette.ink } };
}

export function mount(host, input, ctx) {
  const { ix } = ctx;
  let state = { ...input };
  host.classList.add('sf-blend');
  function render() {
    const ids = state.elements.filter((id) => ix.byId.has(id)).slice(0, 4);
    if (ids.length < 2) { host.innerHTML = `<p class="bl-empty">Choose two to four elements to blend them. Each element lists the ones it was found beside; any of those is a good second.</p>`; return; }
    const t = blendTable(ix, ids, state.weights), els = ids.map((id) => ix.byId.get(id)), sb = studioBlend(ix, ids, t.weights, state.settings);
    const sheetColour = (e) => ix.sheets.find((s) => s.id === e.sheet)?.colour;
    const head = els.map((e, i) => `<th scope="col"><span class="bl-part"><i class="bl-n" style="background:${esc(e.colour?.hex)}">${i + 1}</i>${mark(e.sheet, sheetColour(e))}${esc(e.name)}</span>` +
      `<label class="bl-w"><span class="sr-only">Share of ${esc(e.name)} in the blend</span><input type="range" min="2" max="100" step="1" value="${Math.round(t.weights[i] * 100)}" data-w="${i}"><output>${Math.round(t.weights[i] * 100)}%</output></label>` +
      `<button type="button" class="bl-x" data-remove="${esc(e.id)}">Remove<span class="sr-only"> ${esc(e.name)}</span></button></th>`).join('');
    // each row drawn on the table's own range for that property: the parts as numbered marks, the mix as an open ring
    const where = (r) => { const sp = ix.spread.get(r.name); return `<span class="pc-track" role="img" aria-label="${esc(r.name)}: the parts and the computed mix on the table's range">` +
      r.parts.map((p, i) => (p ? `<i class="bl-dot" style="left:${pos(sp, p.value)}%;background:${esc(els[i].colour?.hex)}">${i + 1}</i>` : '')).join('') + `<i class="pc-set" style="left:${pos(sp, r.computed.value)}%"></i></span>`; };
    const cell = (p) => (p ? `<td><b>${fmt(p.value)}</b><small>${p.iqr ? `${fmt(p.iqr[0])} to ${fmt(p.iqr[1])}` : 'no interval'}, n ${p.n ?? '?'}</small></td>` : `<td class="is-un">not measured</td>`);
    const body = t.rows.map((r) => `<tr data-prop="${esc(r.name)}"><th scope="row">${esc(r.name)}</th>${r.parts.map(cell).join('')}` +
      `<td class="bl-mix" data-value="${r.computed.value}"><b>${fmt(r.computed.value)}</b><small>computed from ${r.computed.of} of ${ids.length}</small>${where(r)}</td></tr>`).join('');
    const link = (l) => (l ? `${l.weight} <small>${esc(l.label)}</small>` : '<span class="is-un">no link recorded</span>');
    const links = t.links.map((l) => `<li data-pair="${esc(l.a)}|${esc(l.b)}"><span>${esc(ix.byId.get(l.a).name)} to ${esc(ix.byId.get(l.b).name)}: ${link(l.ab)}</span><span>${esc(ix.byId.get(l.b).name)} to ${esc(ix.byId.get(l.a).name)}: ${link(l.ba)}</span></li>`).join('');
    host.innerHTML = `<div class="bl-scroll" tabindex="0" role="region" aria-label="Blend table"><table class="bl"><caption class="sr-only">The parts side by side, and the computed mix</caption>
      <thead><tr><th scope="col">Property</th>${head}<th scope="col">Mix <small>computed, not measured. On the line: the numbered parts and a ring for the mix, across the table's range</small></th></tr></thead><tbody>${body}</tbody></table></div>
      <h4>Links between the parts</h4><p class="bl-note">A link counts the studies in which two elements were found together. It is measured, and it is recorded in each direction.</p><ul class="bl-links">${links}</ul>
      <h4>Blended colour</h4><p class="bl-note">The mean of the parts in OKLab, a colour space built to match how even steps look to the eye, weighted by share. Computed.</p>
      <ul class="bl-pal">${sb.parts.map((p) => `<li><i style="background:${esc(p.hex)}"></i>${esc(p.name)} <code>${esc(p.hex)}</code></li>`).join('')}<li class="bl-mixc" data-hex="${esc(sb.palette.mix)}"><i style="background:${esc(sb.palette.mix)}"></i>mix <code>${esc(sb.palette.mix)}</code> <small>computed${contrast(sb.palette.mix, sb.palette.ground) < 3 ? ', close to the ground colour' : ''}</small></li></ul>`;
  }
  const onInput = (ev) => { const r = ev.target.closest('input[data-w]'); if (!r) return;
    const w = [...host.querySelectorAll('input[data-w]')].map((x) => +x.value / 100); r.nextElementSibling.textContent = r.value + '%'; state.weights = w; ctx.onWeights?.(w, { live: true }); };
  const onChange = (ev) => { if (ev.target.closest('input[data-w]')) { render(); ctx.onWeights?.(state.weights, { live: false }); } };
  const onClick = (ev) => { const x = ev.target.closest('[data-remove]'); if (x) ctx.onRemove?.(x.dataset.remove); };
  host.addEventListener('input', onInput); host.addEventListener('change', onChange); host.addEventListener('click', onClick);
  render();
  return {
    update(next) { state = { ...state, ...next }; render(); },
    value: () => (state.elements.length >= 2 ? { table: blendTable(ix, state.elements, state.weights), ...studioBlend(ix, state.elements, state.weights, state.settings) } : null),
    destroy() { host.removeEventListener('input', onInput); host.removeEventListener('change', onChange); host.removeEventListener('click', onClick); host.innerHTML = ''; host.classList.remove('sf-blend'); },
  };
}
