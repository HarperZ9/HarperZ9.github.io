// surface-page.mjs: a surface's exchange, started by a press (surface-start.js imports this file on that press).
//
// The page carries a manifest in <script type="application/json" id="sx-manifest">: the modules that start together,
// what the first one sends, and the heavy modules that wait for their own press. Here the modules are mounted from
// the registry, joined to one bus, and every hand-over is written under them in words.
//
// The address holds the state: ?e= the element ids, w= their shares in percent, study= the pen study, start to open
// running. The address is replaced as the state changes, so a copied link opens the same blend and Back leaves the page.
import registry from './registry.mjs';
import { createBus } from './bus.mjs';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const WIDE = new Set(['blend', 'well']);
const list = (names) => (names.length < 2 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`);

// What the address asks for, read against the element table: unknown ids are dropped, shares must match the ids.
export function readAddress(search, ix, fallback) {
  const q = new URLSearchParams(search);
  const ids = (q.get('e') || '').split(',').filter((id) => ix.byId.has(id)).slice(0, 4);
  const elements = ids.length >= 2 ? ids : fallback;
  const w = (q.get('w') || '').split(',').map(Number);
  const weights = w.length === elements.length && w.every((x) => x >= 2 && x <= 100) ? w.map((x) => x / 100) : null;
  return { elements, weights, study: q.get('study') };
}
export function writeAddress(state) {
  const q = new URLSearchParams(location.search);
  q.set('e', state.elements.join(','));
  if (state.weights) q.set('w', state.weights.map((x) => Math.round(x * 100)).join(',')); else q.delete('w');
  if (state.study) q.set('study', state.study); else q.delete('study');
  q.set('start', '');
  history.replaceState(null, '', `${location.pathname}?${q.toString().replace(/=(?=&|$)/g, '').replace(/%2C/g, ',')}${location.hash}`);
}

export async function start() {
  const manifest = JSON.parse(document.getElementById('sx-manifest').textContent), root = document.getElementById('sx-hosts'), say = document.getElementById('sx-say');
  const css = document.createElement('link'); css.rel = 'stylesheet'; css.href = manifest.css;
  await new Promise((done) => { css.onload = css.onerror = done; document.head.append(css); });
  const ix = await registry.elements(), bus = createBus({ surface: manifest.surface });
  const asked = readAddress(location.search, ix, manifest.elements);
  const state = { elements: asked.elements, weights: asked.weights, settings: {}, study: asked.study, ground: null }, handles = {};
  const name = (id) => registry.SURFACES[id].name;

  root.innerHTML = manifest.modules.map((n) => `<div data-part="${n}"${WIDE.has(n) ? ' class="sf-wide"' : ''}><h3>${esc(name(n))}</h3><div></div></div>`).join('');
  const hostOf = (n) => root.querySelector(`[data-part="${n}"] > div`);

  // The first module sends what the manifest names; the bus builds the envelope and decides who hears it.
  const sender = manifest.sends[0][0];
  function send() {
    const v = handles[sender].value(); if (!v) return;
    const recipe = { elements: state.elements, weights: v.table.weights.map((x) => +x.toFixed(4)) }, heard = [];
    const byShare = v.parts.map((p, i) => [p, recipe.weights[i]]).sort((a, b) => b[1] - a[1]).map(([p]) => p.hex).filter(Boolean);
    const values = { blend: { elements: state.elements, weights: recipe.weights, settings: state.settings }, palette: { mix: v.palette.mix, ground: v.palette.ground, inks: [v.palette.mix, ...byShare] } };
    let id = null;
    for (const [from, medium] of manifest.sends) {
      const out = bus.send(from, medium, values[medium], { refs: state.elements, recipe });
      if (!out.ok) { console.error(`surface: ${medium} was refused: ${out.why}`); say.textContent = `The ${medium} was not handed on: ${out.why}.`; return; }
      id = out.id; heard.push(`${medium === 'blend' ? 'its blend' : `a ${medium}`} to ${list(out.heard.map(name))}`);
    }
    say.textContent = `${name(sender)} handed ${list(heard)}. Made here from ${list(state.elements.map((e) => ix.byId.get(e).name))}; its id in this tab is ${id}.`;
    root.dataset.sent = String(bus.log().filter((l) => l.ok).length);
    writeAddress(state);
  }

  const ctx = { ix,
    onWeights(w, how) { state.weights = w; if (!how?.live) send(); },
    onRemove(id) { if (state.elements.length <= 2) return; const i = state.elements.indexOf(id); state.elements = state.elements.filter((e) => e !== id); state.weights = state.weights ? state.weights.filter((_, k) => k !== i) : null; handles[sender].update({ ...state }); send(); },
    picture: () => handles.well?.value()?.canvas || null };

  // Each listener takes its input from the envelope alone: the value, and the element ids in refs.
  const hear = {
    blend: (n) => (env) => handles[n].update({ elements: env.value.elements, weights: env.value.weights, settings: env.value.settings }),
    palette: (n) => (env) => handles[n].update({ elements: env.refs.filter((r) => ix.byId.has(r)), palette: env.value }),
  };
  async function join(n) {
    handles[n] = await registry.mount(hostOf(n), n, n === sender ? { ...state } : { elements: [], ...(n === 'plot' && state.study ? { piece: state.study } : {}) }, ctx);
    if (n === sender) return;
    for (const medium of ['blend', 'palette']) if (registry.SURFACES[n].takes.includes(medium)) { bus.join(n, hear[medium](n)); break; }
  }
  for (const n of manifest.modules) await join(n);
  root.addEventListener('change', (ev) => { if (ev.target.matches('.pl-pick select')) { state.study = ev.target.value; writeAddress(state); } });

  // A heavy module waits for its own press, with its size stated on the button.
  for (const b of document.querySelectorAll('[data-sx-press]')) b.addEventListener('click', async () => {
    const n = b.dataset.sxPress; b.disabled = true;
    const part = document.createElement('div'); part.dataset.part = n; part.className = 'sf-wide'; part.innerHTML = `<h3>${esc(name(n))}</h3><div></div>`; root.append(part);
    try { await join(n); b.closest('p').hidden = true; send(); part.querySelector('h3').tabIndex = -1; part.querySelector('h3').focus(); }
    catch (e) { console.error(`surface: ${n} did not start`, e); part.remove(); b.disabled = false; say.textContent = `${name(n)} did not start.`; }
  });

  document.getElementById('sx-before').hidden = true; root.hidden = false; document.getElementById('sx-more').hidden = false;
  send();
  window.__surface = { bus, handles, state, registry };
  document.documentElement.setAttribute('data-surface-page-ready', '');
  root.focus({ preventScroll: true }); say.scrollIntoView({ block: "start" });
}
