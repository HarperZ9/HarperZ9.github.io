// bench-parts.mjs: the bench's own markup, as pure functions of the data: the table, and the words about one element.
import { orderCells, GROUND_WORD } from './elements-data.mjs';
import { mark, legend, SHAPE_NAME } from './charts.mjs';

export const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmtW = (v) => (v == null ? '' : Math.abs(v) >= 100 ? v.toFixed(0) : Math.abs(v) >= 1 ? v.toFixed(2) : String(+v.toPrecision(2)));
const cap = (s) => s[0].toUpperCase() + s.slice(1);

// The table: seven sheets, each a run of cells from the firmest ground to the least (see orderCells). A cell
// is a real button. Its mark carries the sheet (colour and shape); the line under it carries the ground: solid
// for grounded, dashed for partial, dotted for thought; the small square is the element's own measured colour.
export function tableHTML(ix) {
  return `<div class="bn-key">${legend(ix)}<ul class="lg lg-ground" aria-label="Ground, shown by the line under a cell"><li><i class="gl g-grounded"></i>grounded</li><li><i class="gl g-partial"></i>partial</li><li><i class="gl g-thought"></i>thought</li></ul></div>
  <p class="bn-order">Within a sheet the cells run from the firmest ground to the least, and by the amount of evidence inside each grade. The first cell is the one the studies say most about.</p>` +
    ix.sheets.map((s) => `<section class="bn-sheet" aria-labelledby="sh-${esc(s.id)}"><h2 id="sh-${esc(s.id)}">${mark(s.id, s.colour)}${esc(s.id)} <small>${esc(s.medium)}</small></h2><div class="bn-cells">` +
      orderCells(ix, s.id).map((e) => `<button type="button" class="bn-cell g-${esc(e.ground)}" data-id="${esc(e.id)}" tabindex="-1" aria-pressed="false" aria-label="${esc(e.name)}: ${esc(s.id)}, ${esc(e.ground)}, ${e.evidence ?? 0} pieces of evidence">` +
        `<span class="bn-sym">${esc(e.symbol)}</span><i class="bn-chip" style="background:${esc(e.colour?.hex)}"></i><span class="bn-name">${esc(e.name)}</span></button>`).join('') + `</div></section>`).join('');
}

export function aboutHTML(ix, el) {
  const s = ix.sheets.find((x) => x.id === el.sheet), measuredLaws = (el.laws || []).filter((l) => l.label === 'measured').length;
  const from = el.colour?.from?.url ? ` from <a href="${esc(el.colour.from.url)}" rel="noopener external">${esc(el.colour.from.title || 'its source')}</a>` : '';
  return `<p class="bn-what">${mark(el.sheet, s?.colour)}<span>${esc(cap(el.sheet))} sheet (${esc(SHAPE_NAME[el.sheet])}). ${esc(cap(GROUND_WORD[el.ground] || el.ground))}.</span></p>
    <p>${esc(el.statement || `${cap(el.name)} is a ${el.kind} on the ${el.sheet} sheet, seen in ${el.mediums} media across ${el.evidence} pieces of evidence.`)}</p>
    <p>${measuredLaws ? `${measuredLaws} of its ${el.lawCount ?? el.laws.length} laws has a measured weight.` : 'None of its laws has a measured weight yet.'} ${el.properties?.length ? `${el.properties.length} of its properties are shown here with their measurements.` : 'No property is measured on it yet, so the well shows its colour on the table\'s median values.'}</p>
    ${el.colour?.hex ? `<p class="bn-col"><i style="background:${esc(el.colour.hex)}"></i><code>${esc(el.colour.hex)}</code> <span>${esc(el.colour.label || '')} colour${from}</span></p>` : ''}`;
}

// The elements this one was found beside, strongest first: each can be shown, or added to the blend.
export function besideHTML(ix, el, chosen) {
  const links = el.links.filter((l) => ix.byId.has(l.to)).sort((a, b) => b.weight - a.weight);
  if (!links.length) return '<p>No link to another element is recorded.</p>';
  return `<ul class="bn-beside">${links.map((l) => { const o = ix.byId.get(l.to), s = ix.sheets.find((x) => x.id === o.sheet), on = chosen.includes(o.id);
    return `<li>${mark(o.sheet, s?.colour)}<button type="button" class="bn-go" data-show="${esc(o.id)}">${esc(o.name)}</button><span class="bn-lw">${l.weight} <small>${esc(l.label)}</small></span>` +
      `<button type="button" class="bn-add" data-blend="${esc(o.id)}" aria-pressed="${on}">${on ? 'In the blend' : 'Blend'}<span class="sr-only"> ${esc(el.name)} with ${esc(o.name)}</span></button></li>`; }).join('')}</ul>`;
}

export function lawsHTML(el) {
  if (!el.laws?.length) return '<p>No law recorded.</p>';
  return `<ol class="bn-laws">${el.laws.map((l) => `<li><b>${esc((l.shape || l.family || 'law').replace(/_/g, ' '))}</b> <span class="bn-w ${l.label === 'measured' ? 'm' : 'u'}">${l.label === 'measured' ? `weight ${fmtW(l.weight)}, n ${l.n}` : 'weight not measured'}</span>${l.rule ? `<span class="bn-rule">${esc(l.rule)}</span>` : ''}</li>`).join('')}</ol>` +
    (el.lawCount > el.laws.length ? `<p class="bn-more">${el.lawCount - el.laws.length} more laws are recorded and not listed here.</p>` : '');
}

export function refsHTML(el, assets) {
  if (!el.refs?.length) return '<p>No reference recorded.</p>';
  return `<ul class="bn-refs">${el.refs.map((r) => `<li>${r.thumb ? `<img src="${esc(assets + r.thumb)}" alt="" width="56" height="56" loading="lazy" decoding="async">` : '<span class="bn-nothumb" aria-hidden="true"></span>'}` +
    `<span><a href="${esc(r.source)}" rel="noopener external">${esc(r.title)}</a>${r.creator || r.year ? `<span class="bn-by">${esc([r.creator, r.year].filter(Boolean).join(', '))}</span>` : ''}</span></li>`).join('')}</ul>`;
}

// Which tools draw this element, and which pages use it: read from the registry and the census.
export function madeHTML(registry, el, uses) {
  const tools = registry.toolsFor(el), pages = registry.pagesFor(el.id, uses);
  const name = (id) => registry.TOOLS.find((t) => t.id === id)?.name || id;
  // one row per tool, with every surface that reaches it
  const by = new Map(); for (const t of tools) { if (!by.has(t.tool)) by.set(t.tool, []); by.get(t.tool).push(registry.SURFACES[t.surface].name.toLowerCase()); }
  const why = [...new Set(tools.map((t) => t.why))];
  return `<ul class="bn-made">${[...by].map(([tool, via]) => `<li><b>${esc(name(tool))}</b> <span>through ${esc([...new Set(via)].join(', '))}</span></li>`).join('')}</ul><p class="bn-why">${esc(why.map(cap).join('. '))}.</p>` +
    `<p class="bn-pages">${pages.length ? `Pages that use ${esc(el.name)}: ${pages.map((p) => `<a href="/${esc(p.path)}">${esc(p.title)}</a>`).join(', ')}.` : `No other page uses ${esc(el.name)} yet.`}</p>`;
}

export function toolsHTML(registry) {
  const on = registry.TOOLS.filter((t) => t.mounted), off = registry.TOOLS.filter((t) => !t.mounted);
  const li = (t) => `<li><b>${esc(t.name)}</b> <span>${esc(t.offers.join(', '))}${t.mounted ? `; on the bench as ${esc(t.mounted)}` : '; not mounted yet'}${t.note ? `. ${esc(cap(t.note))}` : ''}</span></li>`;
  return `<p>The bench is one way into the site's tools. ${on.length} of ${registry.TOOLS.length} tool folders are reachable from here; the rest are listed so the gap stays visible.</p>
    <ul class="bn-tools">${on.map(li).join('')}</ul><details><summary>${off.length} tools not mounted yet</summary><ul class="bn-tools">${off.map(li).join('')}</ul>
    ${registry.EMPTY.length ? `<p>No tool on the site serves these yet: ${esc(registry.EMPTY.join(', '))}.</p>` : ''}</details>`;
}
