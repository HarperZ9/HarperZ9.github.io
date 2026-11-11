// bench.mjs: the front bench of the design studio. One surface, 'bench', made of the others: the element table,
// the well, the charts, the blend table, the studio's lanes and the take-away. Any page can open it:
//
//   registry.mount(host, 'bench', { elements: ['water', 'ink'] })
//
// One element chosen: the well shows it, the charts show its measurements, and every measured property the well
// can use is a control. Two to four chosen: they share the well, and the blend table sets them side by side.
// Keys in the table: arrows move, Enter or Space chooses, Home and End jump. Nothing here plays sound.
import { glossary } from './charts.mjs';
import { tableHTML, aboutHTML, besideHTML, lawsHTML, refsHTML, madeHTML, toolsHTML, esc } from './bench-parts.mjs';

const SECTIONS = [['about', 'About'], ['properties', 'Properties'], ['blend', 'Blend'], ['compare', 'Compare'], ['words', 'Words'], ['laws', 'Laws'], ['made', 'Made with'], ['sources', 'Sources'], ['take', 'Take it with you']];

export async function mount(host, input, ctx) {
  const { ix, registry } = ctx, assets = ctx.assets ?? '/world/ui/shell/organic/';
  const first = ix.data.elements.find((e) => e.id === 'water') ? 'water' : ix.data.elements[0].id;
  const state = { elements: (input.elements || []).filter((id) => ix.byId.has(id)).slice(0, 4), weights: input.weights || null, settings: { ...(input.settings || {}) }, focus: null, blending: false };
  if (!state.elements.length) state.elements = [first];
  state.focus = state.elements[state.elements.length - 1]; state.blending = state.elements.length > 1;
  let uses = null;

  host.classList.add('bn');
  host.innerHTML = `<div class="bn-main"><div class="bn-table">${tableHTML(ix)}</div>
    <div class="bn-detail">${SECTIONS.map(([id, t]) => `<section id="bn-${id}" aria-labelledby="bn-${id}-h"><h3 id="bn-${id}-h" tabindex="-1">${t}</h3><div class="bn-${id}"></div></section>`).join('')}</div></div>
    <aside class="bn-side" aria-label="The well"><div data-part="well"></div>
      <p class="bn-now" aria-live="polite"></p>
      <p class="bn-mode"><button type="button" class="bn-blendmode" aria-pressed="false">Blend elements</button><span class="bn-modehint"></span></p>
      <nav class="bn-jump" aria-label="On this bench">${SECTIONS.map(([id, t]) => `<a href="#bn-${id}">${t}</a>`).join('')}</nav></aside>`;
  const $ = (s) => host.querySelector(s), cells = [...host.querySelectorAll('.bn-cell')];
  $('.bn-blend').innerHTML = `<div class="bn-beside-wrap"></div><div data-part="blend"></div><div class="bn-lanes"><div><h4>Timing</h4><div data-part="motion"></div></div><div><h4>Lettering</h4><div data-part="lettering"></div></div><div><h4>Pen study</h4><div data-part="plot"></div></div><div><h4>Plate</h4><div data-part="plate"></div></div><div><h4>Through glass</h4><div data-part="glass"></div></div><div class="bn-wide"><h4>Living type</h4><div data-part="living"></div></div></div>`;
  $('.bn-words').innerHTML = glossary(ix);
  $('.bn-properties').innerHTML = '<div data-part="chart"></div>'; $('.bn-compare').innerHTML = '<div data-part="compare"></div>';
  $('.bn-take').innerHTML = `<p>Save what is in the well as a picture, its colours as a palette, or the whole setting as a recipe: a small file naming the elements, their shares and your settings, which this bench opens again. The files hold only what the bench made.</p><div data-part="recipe"></div><div class="bn-toolbox"><h4>The tools behind the bench</h4>${toolsHTML(registry)}</div>`;

  const shared = () => ({ elements: state.elements, weights: state.weights, settings: state.settings, focus: state.focus });
  const part = (n) => $(`[data-part="${n}"]`);
  const hooks = {
    onSet(id, key, value) { if (key === null) delete state.settings[id]; else state.settings[id] = { ...(state.settings[id] || {}), [key]: value };
      for (const k of ['well', 'blend', 'motion', 'lettering', 'plot', 'plate', 'glass', 'living', 'recipe']) S[k].update(shared()); },
    onPick(id) { choose(id, { scroll: false }); },
    onWeights(w, { live }) { state.weights = w; S.well.update(shared()); S.recipe.update(shared()); if (!live) for (const k of ['motion', 'lettering', 'plot', 'plate', 'glass', 'living']) S[k].update(shared()); },
    onRemove(id) { drop(id); },
    picture: () => S.well.value()?.canvas || null,
    onLoad(r) { state.elements = r.ids; state.weights = r.weights; state.settings = r.settings; state.focus = r.ids[r.ids.length - 1]; state.blending = r.ids.length > 1; sync(); },
  };
  const c = { ...ctx, ...hooks }, S = {};
  S.well = await registry.mount(part('well'), 'well', shared(), c);
  S.chart = await registry.mount(part('chart'), 'chart', shared(), c);
  S.compare = await registry.mount(part('compare'), 'chart', { ...shared(), view: 'compare' }, c);
  S.blend = await registry.mount(part('blend'), 'blend', shared(), c);
  S.motion = await registry.mount(part('motion'), 'motion', shared(), c);
  S.lettering = await registry.mount(part('lettering'), 'lettering', shared(), c);
  S.plot = await registry.mount(part('plot'), 'plot', shared(), c);
  S.plate = await registry.mount(part('plate'), 'plate', shared(), c);
  S.glass = await registry.mount(part('glass'), 'glass', shared(), c);
  S.living = await registry.mount(part('living'), 'living', shared(), c);
  S.recipe = await registry.mount(part('recipe'), 'recipe', shared(), c);

  function words() {
    const el = ix.byId.get(state.focus), names = state.elements.map((id) => ix.byId.get(id).name);
    $('.bn-now').innerHTML = state.elements.length > 1 ? `<b>${names.map(esc).join(' + ')}</b> <span>a blend of ${names.length}</span>` : `<b><span class="bn-bigsym">${esc(el.symbol)}</span> ${esc(el.name)}</b> <span>${esc(el.ground)}, ${esc(el.sheet)}</span>`;
    const bm = $('.bn-blendmode'); bm.setAttribute('aria-pressed', state.blending);
    $('.bn-modehint').textContent = state.blending ? (state.elements.length >= 4 ? 'Four is the most the well holds.' : 'Choose up to four cells.') : '';
    $('#bn-about-h').innerHTML = `<span class="bn-bigsym">${esc(el.symbol)}</span> ${esc(el.name)}`;
    $('.bn-about').innerHTML = aboutHTML(ix, el);
    $('.bn-beside-wrap').innerHTML = `<h4>Found beside ${esc(el.name)}</h4>${besideHTML(ix, el, state.elements)}`;
    $('.bn-laws').innerHTML = lawsHTML(el); $('.bn-sources').innerHTML = refsHTML(el, assets); $('.bn-made').innerHTML = madeHTML(registry, el, uses);
    for (const cell of cells) { const i = state.elements.indexOf(cell.dataset.id); cell.setAttribute('aria-pressed', i >= 0); cell.classList.toggle('is-focus', cell.dataset.id === state.focus);
      if (i >= 0 && state.elements.length > 1) cell.dataset.slot = i + 1; else delete cell.dataset.slot; }
  }
  function sync() {
    if (state.weights && state.weights.length !== state.elements.length) state.weights = null;
    words();
    for (const k of Object.keys(S)) S[k].update(k === 'compare' ? { elements: state.elements } : shared());
    try { const u = new URL(location.href); u.searchParams.set('e', state.elements.join(',')); history.replaceState(null, '', u); } catch (e) { console.info('bench: the address stays as it is:', e.message); }
  }
  function choose(id, { add = state.blending } = {}) {
    if (!ix.byId.has(id)) return;
    if (add) { const i = state.elements.indexOf(id);
      if (i >= 0 && state.elements.length > 1) state.elements = state.elements.filter((x) => x !== id);
      else if (i < 0 && state.elements.length < 4) state.elements = [...state.elements, id];
      else if (i < 0) { $('.bn-modehint').textContent = 'Four is the most the well holds. Remove one to add another.'; return; }
    } else state.elements = [id];
    state.focus = state.elements.includes(id) ? id : state.elements[state.elements.length - 1];
    sync();
  }
  function drop(id) { if (state.elements.length < 2) return; state.elements = state.elements.filter((x) => x !== id); if (state.elements.length < 2) state.blending = false;
    if (!state.elements.includes(state.focus)) state.focus = state.elements[state.elements.length - 1]; sync(); }

  const go = (cell) => { if (!cell) return; for (const x of cells) x.tabIndex = -1; cell.tabIndex = 0; cell.focus(); };
  const onClick = (ev) => {
    const cell = ev.target.closest('.bn-cell'); if (cell) { for (const x of cells) x.tabIndex = -1; cell.tabIndex = 0; choose(cell.dataset.id, { add: state.blending || ev.shiftKey }); return; }
    const show = ev.target.closest('[data-show]'); if (show) { choose(show.dataset.show, { add: false }); return; }
    const bl = ev.target.closest('[data-blend]'); if (bl) { state.blending = true; choose(bl.dataset.blend, { add: true }); return; }
    if (ev.target.closest('.bn-blendmode')) { state.blending = !state.blending; if (!state.blending && state.elements.length > 1) state.elements = [state.focus]; sync(); return; }
    const j = ev.target.closest('.bn-jump a'); if (j) { ev.preventDefault(); const t = host.querySelector(j.getAttribute('href') + '-h');
      t?.scrollIntoView({ behavior: ctx.reduced ? 'auto' : 'smooth', block: 'start' }); t?.focus({ preventScroll: true }); }
  };
  const onKey = (ev) => {
    const cell = ev.target.closest('.bn-cell'); if (!cell) return;
    const i = cells.indexOf(cell), r = cell.getBoundingClientRect(), cx = r.left + r.width / 2;
    const nearest = (dir) => { let best = null, bd = 1e9; for (const x of cells) { const q = x.getBoundingClientRect(), dy = (q.top - r.top) * dir; if (dy <= 4) continue;
      const d = dy * 4 + Math.abs(q.left + q.width / 2 - cx); if (d < bd) { bd = d; best = x; } } return best; };
    const k = { ArrowRight: cells[i + 1], ArrowLeft: cells[i - 1], ArrowDown: nearest(1), ArrowUp: nearest(-1), Home: cells[0], End: cells[cells.length - 1] }[ev.key];
    if (k !== undefined) { ev.preventDefault(); go(k); }
  };
  host.addEventListener('click', onClick); host.addEventListener('keydown', onKey);
  (cells.find((x) => x.dataset.id === state.focus) || cells[0]).tabIndex = 0;
  words();
  // which pages use which elements: the census file, if the site has built one
  fetch(ctx.usesUrl ?? '/world/site/surfaces/uses.json').then((r) => (r.ok ? r.json() : null)).then((u) => { uses = u; if (u) $('.bn-made').innerHTML = madeHTML(registry, ix.byId.get(state.focus), uses); })
    .catch((e) => console.info('bench: no census of pages here:', e.message));

  return {
    update(next) { if (next.elements) { state.elements = next.elements.filter((id) => ix.byId.has(id)).slice(0, 4); state.focus = state.elements[state.elements.length - 1]; state.blending = state.elements.length > 1; }
      if (next.weights) state.weights = next.weights; if (next.settings) state.settings = { ...next.settings }; sync(); },
    value: () => ({ ...shared(), surfaces: S }),
    destroy() { host.removeEventListener('click', onClick); host.removeEventListener('keydown', onKey); for (const h of Object.values(S)) h.destroy(); host.innerHTML = ''; host.classList.remove('bn'); },
  };
}
