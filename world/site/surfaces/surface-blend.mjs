// surface-blend.mjs: the blend table as a surface. mount(host, { elements, weights, settings }, ctx).
// Two to four elements side by side: each property with its value, interval and n per part, the mix worked out
// from the parts (marked computed), the measured links between them, and the blended palette from the studio's
// own blend (world/studio/lib/blend.mjs, an OKLab mean). Under the links, every pair is painted twice as two
// washes on paper, each order once, by the optics the well uses (glaze.mjs), with the overlap's colour and how far
// the two orders are apart. Weight controls call ctx.onWeights(weights); a part's Remove calls ctx.onRemove(id).
import { blendTable, materialFor, fmt, RULE_WORD } from './elements-data.mjs';
import { blend, contrast } from '../../studio/lib/blend.mjs';
import { mark, pos, term } from './charts.mjs';
import { paintOf, glazeOf, orderGap, paintGlaze } from './glaze.mjs';
import { GROUNDS, RULES, groundFor, isNight } from './grounds.mjs';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
// Marks that would cover one another on a mix line (closer than NEAR percent of the line, about one mark's width)
// are set side by side as one group at their mean place, so every part's number stays readable. The exact values
// are in the row's cells.
const NEAR = 12;
function together(marks) {
  const out = [];
  for (const m of [...marks].sort((a, b) => a.x - b.x)) { const g = out[out.length - 1]; if (g && m.x - g[g.length - 1].x < NEAR) g.push(m); else out.push([m]); }
  return out;
}
// the digit on a numbered mark: white or black, whichever reads better on the mark's colour. The better of the
// two is never under 4.58 to 1, so every digit passes AA
const digit = (hex) => (!hex || contrast(hex, '#ffffff') >= contrast(hex, '#000000') ? '#ffffff' : '#000000');

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
    const head = els.map((e, i) => `<th scope="col"><span class="bl-part"><i class="bl-n" style="background:${esc(e.colour?.hex)};color:${digit(e.colour?.hex)}">${i + 1}</i>${mark(e.sheet, sheetColour(e))}${esc(e.name)}</span>` +
      `<label class="bl-w"><span class="sr-only">Share of ${esc(e.name)} in the blend</span><input type="range" min="2" max="100" step="1" value="${Math.round(t.weights[i] * 100)}" data-w="${i}"><output>${Math.round(t.weights[i] * 100)}%</output></label>` +
      `<button type="button" class="bl-x" data-remove="${esc(e.id)}">Remove<span class="sr-only"> ${esc(e.name)}</span></button></th>`).join('');
    // each row drawn on the table's own range for that property: the parts as numbered marks, the mix as a pointer above them
    const where = (r) => { const sp = ix.spread.get(r.name); return `<span class="pc-track" role="img" aria-label="${esc(r.name)}: the parts and the computed mix on the table's range">` +
      together(r.parts.map((p, i) => (p ? { i, x: +pos(sp, p.value) } : null)).filter(Boolean)).map((g) => `<span class="bl-grp" style="left:${(g.reduce((a, m) => a + m.x, 0) / g.length).toFixed(2)}%">` +
        g.map((m) => `<i class="bl-dot" style="background:${esc(els[m.i].colour?.hex)};color:${digit(els[m.i].colour?.hex)}">${m.i + 1}</i>`).join('') + '</span>').join('') + `<i class="pc-set" style="left:${pos(sp, r.computed.value)}%"></i></span>`; };
    const cell = (p) => (p ? `<td><b>${fmt(p.value)}</b><small>${p.iqr ? `${fmt(p.iqr[0])} to ${fmt(p.iqr[1])}` : 'no interval'}, n ${p.n ?? '?'}</small></td>` : `<td class="is-un">not measured</td>`);
    const body = t.rows.map((r) => `<tr data-prop="${esc(r.name)}"><th scope="row">${term(r.name)}<small>${esc(r.name)}</small></th>${r.parts.map(cell).join('')}` +
      `<td class="bl-mix" data-value="${r.computed.value}"><b>${fmt(r.computed.value)}</b><small>computed from ${r.computed.of} of ${ids.length}: ${RULE_WORD[r.computed.rule]}</small>${where(r)}</td></tr>`).join('');
    const link = (l) => (l ? `${l.weight} <small>${esc(l.label)}</small>` : '<span class="is-un">no link recorded</span>');
    const links = t.links.map((l) => `<li data-pair="${esc(l.a)}|${esc(l.b)}"><span>${esc(ix.byId.get(l.a).name)} to ${esc(ix.byId.get(l.b).name)}: ${link(l.ab)}</span><span>${esc(ix.byId.get(l.b).name)} to ${esc(ix.byId.get(l.a).name)}: ${link(l.ba)}</span></li>`).join('');
    host.innerHTML = `<p class="bl-note bl-how">The Mix column is computed, not measured. Each row names its rule: an angle takes a circular mean, a ratio a geometric mean, the rest a weighted mean. The line under each mix runs across the table's range for that property, with the numbered parts on it and a pointer above them at the mix.</p>
      <div class="bl-scroll" tabindex="0" role="region" aria-label="Blend table"><table class="bl"><caption class="sr-only">The parts side by side, and the computed mix</caption>
      <thead><tr><th scope="col">Property</th>${head}<th scope="col" class="bl-mixh">Mix <small>computed</small></th></tr></thead><tbody>${body}</tbody></table></div>
      <h4>Links between the parts</h4><p class="bl-note">A link counts the studies in which two elements were found together. It is measured, and it is recorded in each direction.</p><ul class="bl-links">${links}</ul>
      <h4>Glazes</h4><p class="bl-note">${term('glaze')}: each pair as two washes, one laid over the other, in both orders, on the well's ground. The ground now is <b>${esc(GROUNDS[gid()].name)}</b>, where the rule is ${esc(RULES[GROUNDS[gid()].rule].word)}. The swatches are painted by that rule at full strength (the rules are under Words). Computed.</p>
      <ul class="bl-glazes">${glazes(els)}</ul>
      <h4>Blended colour</h4><p class="bl-note">The mean of the parts in OKLab, a colour space built to match how even steps look to the eye, weighted by share. Computed.</p>
      <ul class="bl-pal">${sb.parts.map((p) => `<li><i style="background:${esc(p.hex)}"></i>${esc(p.name)} <code>${esc(p.hex)}</code></li>`).join('')}<li class="bl-mixc" data-hex="${esc(sb.palette.mix)}"><i style="background:${esc(sb.palette.mix)}"></i>mix <code>${esc(sb.palette.mix)}</code> <small>computed${contrast(sb.palette.mix, sb.palette.ground) < 3 ? ', close to the ground colour' : ''}</small></li></ul>`;
    swatches();
  }
  // every pair, each order once: the swatch, the overlap's colour, and how far apart the two orders are
  function glazes(els) {
    const on = groundFor(ix, state.elements, state.ground, isNight()), P = els.filter((e) => on.pigments.includes(e.id)).map((e) => paintOf(ix, e, state.settings?.[e.id])), out = [], G = on.id, gn = GROUNDS[G].name, ordered = RULES[GROUNDS[G].rule].ordered;
    const fig = (t, u) => { const g = glazeOf(t, u, G); return `<figure><canvas width="216" height="144" role="img" data-top="${esc(t.id)}" data-under="${esc(u.id)}" data-hex="${g.hex}" data-on="${esc(G)}" aria-label="${esc(t.name)} over ${esc(u.name)} on ${esc(gn)}: the overlap is ${g.hex}"></canvas>` +
      `<figcaption><i style="background:${g.hex}"></i>${esc(t.name)} over ${esc(u.name)}, on ${esc(gn)} <code>${g.hex}</code></figcaption></figure>`; };
    for (let i = 0; i < P.length; i++) for (let j = i + 1; j < P.length; j++) { const gap = orderGap(P[i], P[j], G);
      out.push(`<li data-pair="${esc(P[i].id)}|${esc(P[j].id)}" data-gap="${gap.toFixed(2)}">${fig(P[j], P[i])}${fig(P[i], P[j])}<p class="bl-gap">${!ordered ? `On ${esc(gn)} the order does not matter: the two overlaps are the same colour.` : gap >= 1 ? `The order changes the overlap by ${gap.toFixed(0)} of 255 at most in one colour channel.` : `The two orders match to within 1 of 255: at these opacities neither pigment scatters enough for the order to show.`} ` +
        `<small>Opacity: ${esc(P[i].name)} ${P[i].opacity.toFixed(2)}, ${esc(P[j].name)} ${P[j].opacity.toFixed(2)}, each from its ink coverage (${esc(P[i].opacityFrom)}, ${esc(P[j].opacityFrom)}).</small></p></li>`); }
    return out.join('') || `<li class="bl-one">One pigment lies on ${esc(gn)}, so there is no pair to glaze. Choose a ground yourself under the well to keep every element as a pigment.</li>`;
  }
  const gid = () => groundFor(ix, state.elements, state.ground, isNight()).id;
  let brush = 0;
  function swatches() { clearTimeout(brush); if (ctx.plain || typeof document === 'undefined') return; brush = setTimeout(() => { const P = new Map(state.elements.filter((id) => ix.byId.has(id)).map((id) => [id, paintOf(ix, ix.byId.get(id), state.settings?.[id])]));
    for (const c of host.querySelectorAll('.bl-glazes canvas')) { const t = P.get(c.dataset.top), u = P.get(c.dataset.under); if (t && u) { paintGlaze(c, t, u, c.dataset.on); c.dataset.painted = '1'; } } }, 60); }
  const onInput = (ev) => { const r = ev.target.closest('input[data-w]'); if (!r) return;
    const w = [...host.querySelectorAll('input[data-w]')].map((x) => +x.value / 100); r.nextElementSibling.textContent = r.value + '%'; state.weights = w; ctx.onWeights?.(w, { live: true }); };
  // the table is drawn again on a change; a share moved by keyboard keeps the focus, so the next arrow key still lands on it
  const onChange = (ev) => { const r = ev.target.closest('input[data-w]'); if (!r) return; const i = r.dataset.w, had = document.activeElement === r;
    render(); if (had) host.querySelector(`input[data-w="${i}"]`)?.focus(); ctx.onWeights?.(state.weights, { live: false }); };
  const onClick = (ev) => { const x = ev.target.closest('[data-remove]'); if (x) ctx.onRemove?.(x.dataset.remove); };
  host.addEventListener('input', onInput); host.addEventListener('change', onChange); host.addEventListener('click', onClick);
  render();
  return {
    update(next) { state = { ...state, ...next }; render(); },
    value: () => (state.elements.length >= 2 ? { table: blendTable(ix, state.elements, state.weights), ...studioBlend(ix, state.elements, state.weights, state.settings) } : null),
    destroy() { clearTimeout(brush); host.removeEventListener('input', onInput); host.removeEventListener('change', onChange); host.removeEventListener('click', onClick); host.innerHTML = ''; host.classList.remove('sf-blend'); },
  };
}
