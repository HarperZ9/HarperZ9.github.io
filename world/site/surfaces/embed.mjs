// embed.mjs: mount the registry's surfaces on any page, from markup alone.
//
//   <div data-surface="well chart" data-elements="pigment ink paper"></div>
//   <script type="module" src="/world/site/surfaces/embed.mjs"></script>
//
// Each name in data-surface is a surface in registry.mjs; data-elements are ids from the element table (one to
// four). The surfaces in one host share their state: a control moved on the chart changes the well beside it.
// A link under them opens the same elements on the full bench. mountAll returns the handles; unmountAll (from the
// registry) tears every one down.
import registry from './registry.mjs';

const WIDE = new Set(['blend', 'chart', 'living']);
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export async function mountHost(host) {
  const names = (host.dataset.surface || '').split(/\s+/).filter((n) => registry.SURFACES[n]?.load && n !== 'bench');
  const ix = await registry.elements(), ids = (host.dataset.elements || '').split(/[\s,]+/).filter((id) => ix.byId.has(id)).slice(0, 4);
  if (!names.length || !ids.length) { console.info('surfaces: nothing to mount on', host); return []; }
  const state = { elements: ids, weights: null, settings: {}, focus: ids[0] }, handles = {};
  const others = (skip) => { for (const [n, h] of Object.entries(handles)) if (n !== skip) h.update({ ...state }); };
  const ctx = { ix,
    onSet(id, key, value) { if (key === null) delete state.settings[id]; else state.settings[id] = { ...(state.settings[id] || {}), [key]: value }; others('chart'); },
    onWeights(w) { state.weights = w; others('blend'); },
    onPick(id) { state.focus = id; handles.chart?.update({ ...state }); },
    picture: () => handles.well?.value()?.canvas || null };
  host.innerHTML = names.map((n) => `<div data-part="${n}"${WIDE.has(n) ? ' class="sf-wide"' : ''}><h4>${esc(registry.SURFACES[n].name)}</h4><div></div></div>`).join('') +
    `<p class="sf-more">${ids.map((id) => esc(ix.byId.get(id).name)).join(', ')}, from the element table. <a href="/elements.html?e=${esc(ids.join(','))}">Open ${ids.length > 1 ? 'this blend' : 'it'} on the bench</a> to change it and take it with you.</p>`;
  for (const n of names) handles[n] = await registry.mount(host.querySelector(`[data-part="${n}"] > div`), n, { ...state }, ctx);
  return Object.values(handles);
}
export async function mountAll(root = document) {
  const out = [];
  for (const host of root.querySelectorAll('[data-surface]:not([data-surface-done])')) {
    host.setAttribute('data-surface-done', '');
    try { out.push(...await mountHost(host)); } catch (e) { console.error('surfaces: could not mount', host.dataset.surface, e); }
  }
  return out;
}
// data-surfaces-ready on <html> is the ready signal: every host on the page has finished mounting
if (typeof document !== 'undefined') { window.__surfaces = registry; mountAll().then(() => document.documentElement.setAttribute('data-surfaces-ready', '')); }
