// shader-sources.mjs: what the shader room draws from, as the Retro Studio offered it. The shader being written is
// one source; the others are a generative plate, a picture of the visitor's own, a drawing made on the frame, and an
// XY scope whose beam the visitor can draw. A picture source reaches the stack as the base: the base shader becomes a
// plain copy of the source canvas (PASS), so the layers, the picture rack and the hand-overs work on it as on a shader.
// The plate's engine (system/generative-field.js) and the scope's (system/scope-voice.js) load on first use, by address.
export const SOURCE_URLS = Object.freeze({ plate: '/system/generative-field.js?v=20260925-void-plates', scope: '/system/scope-voice.js?v=20260811-crossings' });
export const SOURCES = Object.freeze([['shader', 'Shader'], ['plate', 'Plate'], ['upload', 'Your picture'], ['draw', 'Draw'], ['scope', 'Scope']]);
export const PLATES = Object.freeze([['showpiece-veil', 'Folded light (veil)'], ['showpiece-burst', 'Obsidian burst'], ['riso-moire,dendrite', 'Dendrite over riso'], ['clifford', 'Clifford attractor'], ['phyllotaxis', 'Phyllotaxis'], ['voronoi-glass', 'Voronoi stained glass']]);
export const SYMMETRY = Object.freeze([['none', 'None'], ['mirror', 'Mirror'], ['quad', 'Quad'], ['radial6', 'Radial 6']]);
export const PASS = 'void mainImage(out vec4 O, in vec2 U){ O = vec4(texture2D(iChannel0, U / iResolution.xy).rgb, 1.0); }';
const GROUND = '#07070c';
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const opt = (list, v) => list.map(([id, label]) => `<option value="${id}"${id === v ? ' selected' : ''}>${esc(label)}</option>`).join('');
const rand = () => Math.random().toString(36).slice(2, 9);

export function defaultSource() { return { mode: 'shader', seed: 'folded-light', plate: 'showpiece-veil', brush: 14, ink: '#f2e9dc', brushMode: 'round', erase: false, sym: 'none', persist: 70, beam: false }; }
export function readSource(q) {
  const S = defaultSource(), m = q.get('src');
  if (SOURCES.some(([id]) => id === m)) S.mode = m;
  if (q.get('seed')) S.seed = q.get('seed').slice(0, 40);
  if (PLATES.some(([id]) => id === q.get('plate'))) S.plate = q.get('plate');
  return S;
}
export const sourceAddress = (S) => ({ src: S.mode === 'shader' ? null : S.mode, seed: S.mode === 'plate' && S.seed !== 'folded-light' ? S.seed : null, plate: S.mode === 'plate' && S.plate !== 'showpiece-veil' ? S.plate : null });

export function sourceHtml(S) {
  const tab = ([id, label]) => `<button type="button" role="tab" id="shd-tab-${id}" data-src-tab="${id}" aria-selected="${id === S.mode}" tabindex="${id === S.mode ? 0 : -1}">${esc(label)}</button>`;
  return `<div class="shd-sources"><p class="shd-src-h" id="shd-src-h">Draw from</p><div class="shd-tabs" role="tablist" aria-labelledby="shd-src-h">${SOURCES.map(tab).join('')}</div>
<div class="shd-srcpanel" data-panel="plate"${S.mode === 'plate' ? '' : ' hidden'}><label for="shd-plate-seed">Seed</label><input type="text" id="shd-plate-seed" value="${esc(S.seed)}" spellcheck="false" autocomplete="off">
<label for="shd-plate-kind">Instrument</label><select id="shd-plate-kind">${opt(PLATES, S.plate)}</select><p class="shd-row"><button type="button" id="shd-plate-reseed">New seed</button></p></div>
<div class="shd-srcpanel" data-panel="upload"${S.mode === 'upload' ? '' : ' hidden'}><label for="shd-up-file">A picture of yours (it stays in this tab)</label><input type="file" id="shd-up-file" accept="image/*"></div>
<div class="shd-srcpanel" data-panel="draw"${S.mode === 'draw' ? '' : ' hidden'}><p class="shd-rack-note">Draw on the frame with a pointer or a finger. Control and Z steps back one stroke.</p>
<label for="shd-brush">Brush size <output for="shd-brush">${S.brush}</output></label><input type="range" id="shd-brush" min="2" max="60" value="${S.brush}">
<p class="shd-row"><label for="shd-ink">Ink</label><input type="color" id="shd-ink" value="${S.ink}"></p>
<label for="shd-brush-mode">Brush</label><select id="shd-brush-mode">${opt([['round', 'Round'], ['wet', 'Wet']], S.brushMode)}</select>
<p class="shd-check"><input type="checkbox" id="shd-erase"${S.erase ? ' checked' : ''}> <label for="shd-erase">Erase</label></p>
<label for="shd-sym">Symmetry</label><select id="shd-sym">${opt(SYMMETRY, S.sym)}</select>
<p class="shd-row"><button type="button" id="shd-draw-undo">Undo a stroke</button> <button type="button" id="shd-draw-clear">Clear</button></p></div>
<div class="shd-srcpanel" data-panel="scope"${S.mode === 'scope' ? '' : ' hidden'}><p class="shd-rack-note">The beam idles on a figure the knobs steer, and draws the sound once sound plays.</p>
<label for="shd-persist">Phosphor persistence <output for="shd-persist">${S.persist}</output></label><input type="range" id="shd-persist" min="0" max="100" value="${S.persist}">
<p class="shd-check"><input type="checkbox" id="shd-beam"${S.beam ? ' checked' : ''}> <label for="shd-beam">Draw the beam yourself</label></p>
<p class="shd-row"><button type="button" id="shd-beam-free">Release the figure</button></p></div>
<p class="shd-src-say" role="status" aria-live="polite"></p></div>`;
}

// room: { changed(kind), setBase(glsl or null), setPicture(canvas or null), knobs(), audio() (a promise of the studio's instrument) }
export function wireSources(host, S, room) {
  const $ = (s) => host.querySelector(s), say = (t) => { $('.shd-src-say').textContent = t; };
  const canvas = { plate: mk(1280, 800), upload: mk(1280, 800), draw: mk(1024, 640), scope: mk(1024, 640) };
  for (const k of ['upload', 'draw']) fill(canvas[k]);
  let plateFn = null, scope = null, uploaded = null, drawing = false, last = null, lastT = -1, dirty = true;
  const undo = [], beam = { path: [], figure: null, drawing: false, gen: 0 };
  function mk(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  function fill(c) { const g = c.getContext('2d'); g.fillStyle = GROUND; g.fillRect(0, 0, c.width, c.height); }
  async function plate() {
    try { if (!plateFn) { const m = await import(SOURCE_URLS.plate); plateFn = m.renderSpecimen || m.renderPlate; } } catch (e) { console.error('shader room: the plate engine did not load', e); say('The plate engine did not load.'); return; }
    try { plateFn(canvas.plate, S.seed || 'folded-light', S.plate.split(',').map((s) => s.trim()).filter(Boolean)); say(''); } catch (e) { console.error('shader room: the plate did not draw', e); say(`The plate did not draw: ${e.message}`); }
    room.changed('source');
  }
  async function ensureScope() { if (scope) return scope; try { scope = await import(SOURCE_URLS.scope); } catch (e) { console.error('shader room: the scope did not load', e); say('The scope did not load.'); } return scope; }
  function upload() {
    const c = canvas.upload, g = c.getContext('2d'); fill(c); if (!uploaded) { say('Choose a picture to work on.'); return; }
    const k = Math.min(c.width / uploaded.naturalWidth, c.height / uploaded.naturalHeight), w = uploaded.naturalWidth * k, h = uploaded.naturalHeight * k;
    g.drawImage(uploaded, (c.width - w) / 2, (c.height - h) / 2, w, h); room.changed('source');
  }
  // the scope's frame for time t: the figure the visitor drew, then the path under the finger, then the sound, then the idle figure
  function tick(t, wave) {
    // the trace fades on each new moment; held still (paused), it draws again only when something changed
    if (S.mode !== 'scope' || !scope || (t === lastT && !dirty)) return; lastT = t; dirty = false;
    const c = canvas.scope, g = c.getContext('2d');
    scope.fadeTrace(g, c.width, c.height, 0.03 + (1 - S.persist / 100) * 0.45);
    let pts = beam.figure || (beam.drawing && beam.path.length >= 4 ? Float32Array.from(beam.path) : null);
    if (!pts && wave) { let rms = 0; for (let i = 0; i < wave.length; i += 8) rms += wave[i] * wave[i]; if (Math.sqrt(rms / (wave.length / 8)) > 0.004) pts = scope.delayEmbed(wave, 96, 2); }
    if (!pts) { const k = room.knobs(); pts = scope.idlePath(room.seed() || 'beam', t, k[0], k[1], k[2]); }
    scope.drawTrace(g, pts, c.width, c.height, { beam: 0.9 });
  }
  async function choose(mode) {
    const leaving = S.mode; S.mode = mode;
    for (const b of host.querySelectorAll('[data-src-tab]')) { const on = b.dataset.srcTab === mode; b.setAttribute('aria-selected', String(on)); b.tabIndex = on ? 0 : -1; }
    for (const p of host.querySelectorAll('.shd-srcpanel')) p.hidden = p.dataset.panel !== mode;
    if (leaving === 'scope' && mode !== 'scope') releaseBeam(false);
    if (mode === 'shader') { room.setBase(null); room.changed('source'); return; }
    room.setPicture(canvas[mode]); room.setBase(PASS);
    if (mode === 'plate') await plate(); else if (mode === 'upload') { room.toUpload?.(); upload(); } else if (mode === 'scope') { await ensureScope(); lastT = -1; tick(room.time()); room.changed('source'); } else room.changed('source');
  }
  // one stroke segment, with the studio's symmetry and its wet brush
  function strokeTo(np) {
    const c = canvas.draw, W = c.width, H = c.height, g = c.getContext('2d'), p = { x: np.x * W, y: np.y * H }, from = last || p;
    const mx = (q) => ({ x: W - q.x, y: q.y }), my = (q) => ({ x: q.x, y: H - q.y }), pairs = [[from, p]];
    if (S.sym === 'mirror') pairs.push([mx(from), mx(p)]);
    else if (S.sym === 'quad') pairs.push([mx(from), mx(p)], [my(from), my(p)], [mx(my(from)), mx(my(p))]);
    else if (S.sym === 'radial6') for (let k = 1; k < 6; k++) { const a = (k * Math.PI) / 3, cs = Math.cos(a), sn = Math.sin(a); const rot = (q) => ({ x: W / 2 + (q.x - W / 2) * cs - (q.y - H / 2) * sn, y: H / 2 + (q.x - W / 2) * sn + (q.y - H / 2) * cs }); pairs.push([rot(from), rot(p)]); }
    const ink = S.erase ? GROUND : S.ink, wet = !S.erase && S.brushMode === 'wet', size = S.brush;
    const dark = (h, f) => { const v = parseInt(h.slice(1), 16), q = (x) => Math.round(((v >> x) & 255) * f); return `rgb(${q(16)},${q(8)},${q(0)})`; };
    const seg = (a, b, w, al, col) => { g.globalAlpha = al; g.strokeStyle = col; g.lineWidth = w; g.lineCap = 'round'; g.lineJoin = 'round'; g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke(); };
    for (const [a, b] of pairs) {
      if (!wet) { seg(a, b, size, 1, ink); continue; }
      seg(a, b, size * 2.8, 0.05, dark(ink, 0.6)); seg(a, b, size * 2.1, 0.09, ink); seg(a, b, size * 1.1, 0.28, ink);
      for (let k = 0; k < 2; k++) { g.globalAlpha = 0.1; g.fillStyle = dark(ink, 0.55); g.beginPath(); g.arc(b.x + (Math.random() - 0.5) * size * 2.2, b.y + (Math.random() - 0.5) * size * 2.2, 0.8 + Math.random() * 1.4, 0, Math.PI * 2); g.fill(); }
    }
    g.globalAlpha = 1; last = p;
  }
  const keep = () => { try { const c = canvas.draw; undo.push(c.getContext('2d').getImageData(0, 0, c.width, c.height)); if (undo.length > 6) undo.shift(); } catch (e) { console.error('shader room: a stroke could not be kept for undo', e); } };
  function undoStroke() { const snap = undo.pop(); if (!snap) { say('Nothing to undo.'); return false; } canvas.draw.getContext('2d').putImageData(snap, 0, 0); say('One stroke back.'); room.changed('source'); return true; }
  function releaseBeam(words = true) { dirty = true; beam.figure = null; beam.path = []; beam.drawing = false; beam.gen++; room.stopLoop?.(); if (words) { say('The figure is released: the beam is free.'); room.changed('source'); } }
  async function liftBeam() {
    beam.drawing = false; if (beam.path.length < 16) { beam.path = []; return; }
    beam.figure = Float32Array.from(beam.path); dirty = true; const gen = beam.gen; room.changed('source');
    try { const audio = await room.audio(); if (gen !== beam.gen || !audio) return; const hz = 55 * Math.pow(2, room.knobs()[0] * 3); await audio.playFigure(beam.figure, hz);
      if (gen !== beam.gen) { audio.stopLoop(); return; } say(`The figure sounds at ${Math.round(hz)} Hz: your hand, retraced.`); }
    catch (e) { if (gen === beam.gen) { console.error('shader room: the figure did not sound', e); say('The figure is drawn; it could not sound here.'); } }
  }
  // the pointer on the frame: a stroke while drawing, a path while the beam is being drawn
  const at = (ev, el) => { const r = el.getBoundingClientRect(); return { x: (ev.clientX - r.left) / r.width, y: (ev.clientY - r.top) / r.height }; };
  function onPointer(ev, el) {
    if (ev.type === 'pointerdown') {
      if (S.mode === 'draw') { drawing = true; last = null; keep(); try { el.setPointerCapture(ev.pointerId); } catch { /* the stroke still draws without capture */ } strokeTo(at(ev, el)); room.changed('stroke'); return true; }
      if (S.mode === 'scope' && S.beam) { releaseBeam(false); beam.drawing = true; const p = at(ev, el); beam.path.push(p.x * 2 - 1, 1 - p.y * 2); return true; }
    } else if (ev.type === 'pointermove') {
      if (drawing) { strokeTo(at(ev, el)); room.changed('stroke'); return true; }
      if (beam.drawing) { const p = at(ev, el); beam.path.push(p.x * 2 - 1, 1 - p.y * 2); dirty = true; room.changed('stroke'); return true; }
    } else if (ev.type === 'pointerup') { if (drawing) { drawing = false; last = null; return true; } if (beam.drawing) { liftBeam(); return true; } }
    else if (ev.type === 'pointercancel' || ev.type === 'lostpointercapture') { drawing = false; last = null; if (beam.drawing) { beam.drawing = false; beam.path = []; beam.gen++; } }
    return false;
  }
  function onInput(ev) {
    const t = ev.target, id = t.id;
    if (id === 'shd-plate-seed') { S.seed = t.value.slice(0, 40); plate(); }
    else if (id === 'shd-plate-kind') { S.plate = t.value; plate(); }
    else if (id === 'shd-up-file') { const f = t.files?.[0]; if (!f) return true; const img = new Image(); img.onload = () => { uploaded = img; URL.revokeObjectURL(img.src); say(`Working on ${f.name}, ${img.naturalWidth} by ${img.naturalHeight}.`); upload(); }; img.onerror = () => say('That picture could not be read.'); img.src = URL.createObjectURL(f); }
    else if (id === 'shd-brush') { S.brush = +t.value; host.querySelector('output[for="shd-brush"]').textContent = t.value; room.changed('pending'); }
    else if (id === 'shd-ink') { S.ink = t.value; room.changed('pending'); }
    else if (id === 'shd-brush-mode') { S.brushMode = t.value; room.changed('pending'); }
    else if (id === 'shd-erase') { S.erase = t.checked; room.changed('pending'); }
    else if (id === 'shd-sym') { S.sym = t.value; room.changed('pending'); }
    else if (id === 'shd-persist') { dirty = true; S.persist = +t.value; host.querySelector('output[for="shd-persist"]').textContent = t.value; room.changed('pending'); }
    else if (id === 'shd-beam') { S.beam = t.checked; if (!S.beam) releaseBeam(); room.changed('pending'); }
    else return false;
    return true;
  }
  function onClick(ev) {
    const b = ev.target.closest('button'); if (!b) return false;
    if (b.dataset.srcTab) choose(b.dataset.srcTab);
    else if (b.id === 'shd-plate-reseed') { S.seed = rand(); $('#shd-plate-seed').value = S.seed; plate(); }
    else if (b.id === 'shd-draw-undo') undoStroke();
    else if (b.id === 'shd-draw-clear') { keep(); fill(canvas.draw); say('A fresh ground. Undo brings the drawing back.'); room.changed('source'); }
    else if (b.id === 'shd-beam-free') releaseBeam();
    else return false;
    return true;
  }
  // the tabs keep the tablist keys: arrows walk them, Home and End jump, and moving activates the source
  function onKey(ev) {
    const t = ev.target; if (!t.dataset?.srcTab) return false;
    const tabs = [...host.querySelectorAll('[data-src-tab]')], i = tabs.indexOf(t), n = tabs.length;
    const j = { ArrowRight: i + 1, ArrowDown: i + 1, ArrowLeft: i - 1, ArrowUp: i - 1, Home: 0, End: n - 1 }[ev.key];
    if (j === undefined) return false; ev.preventDefault(); const next = tabs[(j + n) % n]; next.focus(); choose(next.dataset.srcTab); return true;
  }
  // A picture handed over in this tab (the Gallery's or the Studio's, the key the studio read) becomes your picture.
  function takeHandoff() {
    let url = null; try { url = sessionStorage.getItem('re.retro.handoff'); if (url) sessionStorage.removeItem('re.retro.handoff'); } catch { return false; }
    if (!url) return false;
    const img = new Image(); img.onload = () => { uploaded = img; choose('upload').then(() => say('The picture you sent over is the source.')); }; img.onerror = () => say('The picture sent over could not be read.'); img.src = url; return true;
  }
  // every control back to the state, after a patch or an undo
  function sync() {
    const set = (id, v) => { const el = $(`#${id}`); if (el) { if (el.type === 'checkbox') el.checked = !!v; else el.value = String(v); } };
    set('shd-plate-seed', S.seed); set('shd-plate-kind', S.plate); set('shd-brush', S.brush); set('shd-ink', S.ink); set('shd-brush-mode', S.brushMode); set('shd-erase', S.erase); set('shd-sym', S.sym); set('shd-persist', S.persist); set('shd-beam', S.beam);
    for (const id of ['shd-brush', 'shd-persist']) { const o = host.querySelector(`output[for="${id}"]`); if (o) o.textContent = $(`#${id}`).value; }
    dirty = true;
  }
  return { onInput, onClick, onKey, onPointer, tick, choose, undoStroke, takeHandoff, canvas, sync, get drawing() { return S.mode === 'draw'; }, start() { if (S.mode !== 'shader') choose(S.mode); } };
}
