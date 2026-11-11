// charts.mjs: the bench's charts, as markup. Pure: the same data gives the same string, in node and the browser.
//
//   propertyChart(ix, element, { settings })   every measured property of one element against the whole table
//   compareChart(ix, propName, { selected })   every element that has one property, in order of its value
//   mark(sheetId, colour)                      a category's mark: colour and shape together
//   pos(spread, value)                         where a value sits on a property's axis, 0 to 100
//
// A chart row is a track with things placed along it by percentage, so it stays exact at any width. The table's
// values are ticks, the middle half of the table is a band, the element's interquartile range (the middle half of
// its own measurements) is a bar, its median is the sheet's mark, and the visitor's own setting is an open ring.
import { legible } from '../../studio/lib/blend.mjs';
import { DRIVES, fmt, propOf } from './elements-data.mjs';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export const GROUND = '#0c1620';   // the water the bench sits on, in every scheme

// Seven sheets, seven shapes: a category is never told by colour alone.
const SHAPE = {
  material: '<circle cx="8" cy="8" r="6"/>', property: '<rect x="2.5" y="2.5" width="11" height="11"/>', process: '<path d="M8 1.5 15 14H1z"/>',
  form: '<path d="M8 1 15 8 8 15 1 8z"/>', composition: '<path d="M8 1 14 4.5v7L8 15 2 11.5v-7z"/>',
  rules: '<path d="M6 1h4v5h5v4h-5v5H6v-5H1V6h5z"/>', meaning: '<path d="M1 2h14L8 15z"/>',
};
export const SHAPE_NAME = { material: 'circle', property: 'square', process: 'triangle', form: 'diamond', composition: 'hexagon', rules: 'cross', meaning: 'pointing-down triangle' };
// A sheet's colour, moved in lightness until it stands 3:1 off the ground (the rule for drawn marks); hue kept.
export const sheetInk = (hex) => legible({ ink: hex, ground: GROUND, accent: hex }, 3).ink;
export function mark(sheetId, colour, cls = 'mk') {
  return `<svg class="${cls}" viewBox="0 0 16 16" aria-hidden="true" style="fill:${esc(sheetInk(colour))}">${SHAPE[sheetId] || SHAPE.material}</svg>`;
}

export function pos(s, v) {
  if (v == null || !s || s.hi === s.lo) return 50;
  const t = s.log ? Math.log(v / s.lo) / Math.log(s.hi / s.lo) : (v - s.lo) / (s.hi - s.lo);
  return +(Math.min(1, Math.max(0, t)) * 100).toFixed(2);
}
// the inverse, for the controls: a place on the axis back to a value
export function valueAt(s, pct) {
  const t = Math.min(1, Math.max(0, pct / 100));
  return s.log ? s.lo * Math.pow(s.hi / s.lo, t) : s.lo + (s.hi - s.lo) * t;
}

const sheetColour = (ix, id) => ix.sheets.find((s) => s.id === id)?.colour || '#888888';
const shortName = (n) => n.split('/')[1] || n;
const driveOf = (name) => Object.entries(DRIVES).find(([, d]) => d.prop === name) || null;

function track(s, inner) {
  const ticks = s.members.map((m) => `<i class="pc-tick" style="left:${pos(s, m.value)}%"></i>`).join('');
  return `<span class="pc-track"><i class="pc-mid" style="left:${pos(s, s.q1)}%;width:${(pos(s, s.q3) - pos(s, s.q1)).toFixed(2)}%"></i>${ticks}${inner}</span>`;
}

// One element: a row for every property it has, then the drivable ones it lacks, shown as unmeasured.
export function propertyChart(ix, el, { settings = {} } = {}) {
  const colour = sheetColour(ix, el.sheet), have = new Set((el.properties || []).map((p) => p.name));
  const names = [...ix.propNames.filter((n) => have.has(n)), ...Object.values(DRIVES).map((d) => d.prop).filter((n) => !have.has(n))];
  const rows = names.map((name) => {
    const s = ix.spread.get(name), p = propOf(el, name), dv = driveOf(name), key = dv?.[0], set = key != null && typeof settings[key] === 'number' ? settings[key] : null;
    const ring = set != null ? `<i class="pc-set" style="left:${pos(s, set)}%" title="your setting ${fmt(set)}"></i>` : '';
    const body = p
      ? track(s, `${p.iqr ? `<i class="pc-iqr" style="left:${pos(s, p.iqr[0])}%;width:${(pos(s, p.iqr[1]) - pos(s, p.iqr[0])).toFixed(2)}%"></i>` : ''}<i class="pc-at" style="left:${pos(s, p.value)}%">${mark(el.sheet, colour)}</i>${ring}`)
      : track(s, `<i class="pc-at pc-none" style="left:${pos(s, s.median)}%"></i>${ring}`);
    const read = p
      ? `<span class="pc-val" data-value="${p.value}">${fmt(p.value)}</span><span class="pc-meta">${p.iqr ? `${fmt(p.iqr[0])} to ${fmt(p.iqr[1])}` : 'no interval'}, n ${p.n ?? 'not recorded'}, ${esc(p.instrument || 'instrument not recorded')}</span>`
      : `<span class="pc-val pc-un">not measured</span><span class="pc-meta">${s.count} other elements have it; the well uses their median, ${fmt(s.median)}</span>`;
    const ctl = dv ? `<label class="pc-ctl"><span class="sr-only">${esc(dv[1].label)} for ${esc(el.name)}: ${esc(dv[1].does)}</span>` +
      `<input type="range" min="0" max="100" step="0.5" data-drive="${key}" value="${pos(s, set ?? p?.value ?? s.median)}" aria-valuetext="${fmt(set ?? p?.value ?? s.median)}"></label>` : '';
    return `<li class="pc-row${p ? '' : ' is-un'}${dv ? ' is-live' : ''}" data-prop="${esc(name)}"><span class="pc-name" title="${esc(dv ? dv[1].what : name)}">${esc(dv ? dv[1].label : shortName(name))}<small>${esc(name)}</small></span>` +
      `<span class="pc-plot">${body}${ctl}<span class="pc-ends"><span>${fmt(s.lo)}</span><span>${s.log ? 'log scale' : ''}</span><span>${fmt(s.hi)}</span></span></span><span class="pc-read">${read}</span></li>`;
  }).join('');
  return `<ol class="pc" aria-label="Measured properties of ${esc(el.name)}">${rows}</ol>`;
}

// Many elements on one property: each row an element, placed by its median, with its interquartile range as a
// bar. Rows run from the lowest value to the highest. Elements without the property are named underneath.
export function compareChart(ix, name, { selected = [] } = {}) {
  const s = ix.spread.get(name); if (!s) return '<p>No element has this property.</p>';
  const on = new Set(selected);
  const rows = s.members.map((m) => { const e = ix.byId.get(m.id);
    return `<li><button type="button" class="cmp-row${on.has(m.id) ? ' on' : ''}" data-id="${esc(m.id)}" data-value="${m.value}"><span class="cmp-name">${mark(e.sheet, sheetColour(ix, e.sheet))}${esc(e.name)}</span>` +
      `<span class="pc-track">${m.iqr ? `<i class="pc-iqr" style="left:${pos(s, m.iqr[0])}%;width:${(pos(s, m.iqr[1]) - pos(s, m.iqr[0])).toFixed(2)}%"></i>` : ''}<i class="pc-at" style="left:${pos(s, m.value)}%">${mark(e.sheet, sheetColour(ix, e.sheet))}</i></span>` +
      `<span class="cmp-val">${fmt(m.value)}<small>n ${m.n ?? '?'}</small></span></button></li>`; }).join('');
  const have = new Set(s.members.map((m) => m.id)), none = ix.data.elements.filter((e) => !have.has(e.id));
  return `<div class="cmp" data-prop="${esc(name)}"><p class="cmp-axis"><span>${fmt(s.lo)}</span><span>${esc(name)}${s.log ? ', log scale' : ''}, measured with ${esc(s.instrument || 'an unrecorded instrument')}</span><span>${fmt(s.hi)}</span></p>` +
    `<ol class="cmp-rows">${rows}</ol>` +
    `<p class="cmp-none"><b>Not measured on ${none.length} elements:</b> ${none.map((e) => `<button type="button" class="cmp-un" data-id="${esc(e.id)}">${esc(e.name)}</button>`).join(' ')}</p></div>`;
}

export function legend(ix) {
  return `<ul class="lg" aria-label="Sheets, each with its colour and shape">${ix.sheets.map((s) => `<li>${mark(s.id, s.colour)}<span>${esc(s.id)}</span></li>`).join('')}</ul>`;
}
