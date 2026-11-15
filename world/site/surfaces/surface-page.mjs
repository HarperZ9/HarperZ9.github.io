// surface-page.mjs: a surface's exchange, started by a press (surface-start.js imports this file on that press).
//
// The page carries a manifest in <script type="application/json" id="sx-manifest">: the modules that start together,
// what the first one sends, and the heavy modules that wait for their own press. Here the modules are mounted from
// the registry, joined to one bus, and every hand-over is written under them in words.
//
// The address holds the state: ?e= the element ids, w= their shares in percent, study= the pen study, start to open
// running. Rooms keep their own fields beside these (rooms.mjs). The address is replaced as the state changes, so a copied link opens the same blend and Back leaves the page.
import registry from './registry.mjs';
import { page } from './rooms.mjs';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const WIDE = new Set(['blend', 'well']);
// What each module's adapter acts on here. The registry says what a module can take; this is what its mounted adapter reads.
const MOUNTED_TAKES = { lettering: ['blend', 'text'], motion: ['blend'], plot: ['palette'], well: ['blend'], loom: ['palette', 'image'], ridges: ['palette', 'image'], voxels: ['palette', 'image'] };
// Modules that hand their picture on, in the order the page falls back through them when nothing was handed on yet.
const PICTURES = ['well', 'plot'];
const list = (names) => (names.length < 2 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`);
const lower = (s) => s[0].toLowerCase() + s.slice(1);
// a module's name inside a sentence: "the well", "the pen study"
const the = (n) => { const l = lower(n); return l.startsWith('the ') ? l : `the ${l}`; };

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
  const manifest = JSON.parse(document.getElementById('sx-manifest').textContent), root = document.getElementById('sx-hosts'), say = document.getElementById('sx-say'), rec = document.getElementById('sx-rec');
  const css = document.createElement('link'); css.rel = 'stylesheet'; css.href = manifest.css;
  await new Promise((done) => { css.onload = css.onerror = done; document.head.append(css); });
  const ix = await registry.elements(), shared = page(manifest.surface), bus = shared.bus;
  const asked = readAddress(location.search, ix, manifest.elements);
  const state = { elements: asked.elements, weights: asked.weights, settings: {}, study: asked.study, ground: null }, handles = shared.handles;
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
      const out = shared.send(from, medium, values[medium], { refs: state.elements, recipe });
      if (!out.ok) { console.error(`surface: ${medium} was refused: ${out.why}`); say.textContent = `The ${medium} was not handed on: ${out.why}.`; return; }
      id = out.id; heard.push(`${medium === 'blend' ? 'its blend' : `a ${medium}`} to ${list(out.heard.map(name))}`);
    }
    const made = state.elements.map((e) => ix.byId.get(e).name);
    say.textContent = `${name(sender)} handed ${list(heard)}. Made here from ${list(made)}.`;
    // the value's record sits behind its own control: the id is internal detail, kept for whoever wants to check it
    if (rec) { rec.hidden = false; rec.dataset.id = id;
      rec.querySelector('dl').innerHTML = `<dt>Shares</dt><dd>${esc(made.map((n, i) => `${n} ${Math.round(recipe.weights[i] * 100)}%`).join(', '))}</dd><dt>Id in this tab</dt><dd><code>${esc(id)}</code></dd><dt>Kept</dt><dd>Only in this tab. The address carries the blend, so a link opens the same one.</dd>`; }
    // the well's picture changes with the blend, so it is handed on again; the pen study hands its own on while there is no well
    const giver = PICTURES.find((n) => shared.pictures[n]?.());
    if (giver && (giver === 'well' || !shared.last.image || shared.last.image.from.module === 'plot')) givePicture(giver, recipe);
    root.dataset.sent = String(bus.log().filter((l) => l.ok).length);
    writeAddress(state);
  }
  function givePicture(n, recipe) {
    const c = shared.pictures[n]?.(); if (!c) return;
    const out = shared.send(n, 'image', { width: c.width, height: c.height, of: n }, { refs: state.elements, recipe: { ...recipe, of: n, study: state.study || null } });
    if (!out.ok) console.error(`surface: the picture was refused: ${out.why}`);
  }
  // The picture the page stands on: the last one handed on, by any module or room, or the first a module here can show.
  function picture() {
    const handed = shared.picture(); if (handed) return handed;
    for (const n of PICTURES) { const canvas = shared.pictures[n]?.(); if (canvas?.width) return { canvas, of: n, name: name(n) }; }
    return null;
  }

  // Take it with you: the picture last handed on, whoever made it, as a PNG and as files for a plotter and a printer.
  const take = document.getElementById('sx-take');
  const showTake = () => { const p = picture(); if (!take || !p) return; take.hidden = false; take.dataset.of = p.of; take.querySelector('#sx-take-of').textContent = `Take the picture from ${the(p.name)} with you:`; };
  const saveFile = (file, blob, words) => { const a = document.createElement('a'), url = URL.createObjectURL(blob); a.href = url; a.download = file; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000); say.textContent = words; take.dataset.saved = file; };
  take?.addEventListener('click', async (ev) => {
    const b = ev.target.closest('[data-sx-file]'), p = b && picture(); if (!p) return;
    const c = document.createElement('canvas'); c.width = p.canvas.width; c.height = p.canvas.height; const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(p.canvas, 0, 0);
    const stem = `${p.of}-picture`, from = the(p.name);
    if (b.dataset.sxFile === 'png') { c.toBlob((blob) => blob && saveFile(`${stem}.png`, blob, `Saved the picture from ${from}: ${c.width} by ${c.height} pixels.`), 'image/png'); return; }
    try {
      const { makeFile } = await import('./take-files.mjs');
      const f = makeFile(b.dataset.sxFile, { data: x.getImageData(0, 0, c.width, c.height).data, w: c.width, h: c.height }, [], stem, { by: `made on The Playground (harperz9.github.io/playground/) from the picture of ${from}`, recipe: state.elements.join(', ') });
      const blob = new Blob([f.body], { type: f.mime });
      saveFile(`${stem}.${f.ext}`, blob, `Saved ${f.label.toLowerCase()} of the picture from ${from}: ${blob.size.toLocaleString('en')} bytes.`);
    } catch (e) { console.error('surface: the file was not made', e); say.textContent = 'The file was not made.'; }
  });
  shared.watch.add((medium) => { if (medium === 'image') showTake(); });

  const ctx = { ix,
    onWeights(w, how) { state.weights = w; if (!how?.live) send(); },
    onRemove(id) { if (state.elements.length <= 2) return; const i = state.elements.indexOf(id); state.elements = state.elements.filter((e) => e !== id); state.weights = state.weights ? state.weights.filter((_, k) => k !== i) : null; handles[sender].update({ ...state }); send(); },
    picture: () => picture()?.canvas || null, pictureName: () => picture()?.name || null };

  // Each listener takes its input from the envelope alone: the value, and the element ids in refs.
  const hear = {
    blend: (n) => (env) => handles[n].update({ elements: env.value.elements, weights: env.value.weights, settings: env.value.settings }),
    palette: (n) => (env) => handles[n].update({ elements: env.refs.filter((r) => ix.byId.has(r)), palette: env.value }),
    // a line of text from a room (the type forge): the lettering letters it in place of the blend's name
    text: (n) => (env) => { handles[n].update({ text: env.value.text }); say.textContent = `${name(n)} took the text from ${name(env.from.module).toLowerCase()}.`; },
    // a picture from the well, the pen study or a room: the module draws it again and the page says whose it is
    image: (n) => (env) => { handles[n].update({}); const part = root.querySelector(`[data-part="${n}"]`); if (part) part.dataset.pictureOf = env.value.of; say.textContent = `${name(n)} took the picture from ${the(name(env.from.module))}.`; },
  };
  async function join(n) {
    handles[n] = await registry.mount(hostOf(n), n, n === sender ? { ...state } : { elements: [], ...(n === 'plot' && state.study ? { piece: state.study } : {}) }, ctx);
    if (n === sender) return;
    if (n === 'well') shared.pictures.well = () => handles.well?.value()?.canvas || null;
    if (n === 'plot') {
      shared.pictures.plot = () => hostOf('plot')?.querySelector('canvas.pl') || null;
      // the pen study draws a moment after it mounts; its picture is handed on once it is there, while no other picture has been
      const seen = new MutationObserver(() => { if (!shared.pictures.plot()) return; seen.disconnect(); if (!shared.last.image) givePicture('plot', { elements: state.elements }); });
      seen.observe(hostOf('plot'), { childList: true });
    }
    const takes = ['blend', 'palette', 'text', 'image'].filter((medium) => MOUNTED_TAKES[n]?.includes(medium));
    if (takes.length) bus.join(n, (env) => { if (takes.includes(env.medium)) hear[env.medium](n)(env); });
    // a room opened before this module may already have sent a line of text
    if (takes.includes('text') && shared.last.text) hear.text(n)(shared.last.text);
    // and a picture may already have been handed on, by the well, the pen study or a room
    if (takes.includes('image') && shared.pictureOf(shared.last.image)) hear.image(n)(shared.last.image);
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
