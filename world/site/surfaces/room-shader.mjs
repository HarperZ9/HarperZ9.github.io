// room-shader.mjs: the shader editor as a room of The Playground (registry row 'shader', anchor #shader), and the home
// of the Retro Studio's controls. The engine is system/shader-runner.js through system/shader-stack.js (a base and up to
// seven layers, shader-layers.mjs); the presets are system/shader-presets.js, fetched when asked for, browsed with
// shader-shelf.mjs. Around them: the sources (shader-sources.mjs), the picture rack (shader-post.mjs, its controls in
// shader-post-ui.mjs), the keys and full screen (shader-keys.mjs) and the files for other trades (take-files.mjs).
//   takes   palette (iPalette), image (iChannel0), text (a layer can letter it)
//   gives   image (the frame as shown), png, the source as .glsl, the pixel grid, a plot, plotter moves and a relief
// The inputs every shader here receives are listed in INPUTS and shown in the room. Nothing leaves the tab.
import { createShaderStack } from '../../../system/shader-stack.js';
import { makeFile, FILES } from './take-files.mjs';
import { sessionHash } from './bus-kernel.mjs';
import { STARTS, startOf } from './shader-starts.mjs';
import { MAX_LAYERS, DEFAULT_LAYER, decodeLayers, encodeLayers, wantsLibrary, stackLayer, layerRow, moveLayer, nameOfSrc, propertiesOf } from './shader-layers.mjs';

export { SIZE, LIBRARY, INPUTS, encodeSource, decodeSource, errorsOf, knobsOf, still } from './shader-text.mjs';
import { SIZE, LIBRARY, INPUTS, encodeSource, decodeSource, errorsOf, knobsOf } from './shader-text.mjs';
import { createPost, decodePost, encodePost, postActive } from './shader-post.mjs';
import { rackHtml, wireRack } from './shader-post-ui.mjs';
import { sourceHtml, wireSources, readSource, sourceAddress } from './shader-sources.mjs';
import { shelfHtml, shelfOptions, wireShelf } from './shader-shelf.mjs';
import { studioKey, fullScreen } from './shader-keys.mjs';
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export async function mount(host, input, ctx) {
  const q = ctx.query || new URLSearchParams(), asked = q.get('sh') ? await decodeSource(q.get('sh')) : null;
  const state = { start: startOf(q.get('shp'))?.id || STARTS[0].id, source: '', edited: false, knobs: knobsOf(q), running: !ctx.reduced, preset: '', layers: decodeLayers(q.get('ly')), text: '', post: decodePost(q.get('rp')), from: readSource(q) };
  state.source = asked ?? startOf(state.start).glsl; state.edited = asked !== null && asked !== startOf(state.start).glsl;
  let base = null, handed = null, shelf = null, timer = 0, raf = 0, t0 = 0, held = 0, sendTimer = 0, library = null, visible = true, hash = '', lastGood = '', picture = null, paletteFrom = '';
  const urls = new Set();
  host.classList.add('shd');
  host.innerHTML = `<div class="shd-desk">
<div class="shd-write">
<label for="shd-start">Start from</label>
<select id="shd-start">${STARTS.map((s) => `<option value="${s.id}">${esc(s.name)}</option>`).join('')}</select>
<p class="shd-lib"><button type="button" data-library>Load the preset library</button> <span>254 more shaders from the Retro Engine, 918 KB.</span></p>
<label for="shd-src">The shader</label>
<div class="shd-edit"><div class="shd-gutter" aria-hidden="true"></div><textarea id="shd-src" spellcheck="false" autocapitalize="off" autocomplete="off" wrap="off" aria-describedby="shd-err"></textarea></div>
<div id="shd-err" class="shd-err" role="status" aria-live="polite"></div>
${rackHtml(state.post)}
</div>
<div class="shd-see">
<div class="shd-stage"><canvas class="shd-frame" width="${SIZE[0]}" height="${SIZE[1]}" role="img" aria-label="The shader's frame"></canvas><canvas class="shd-out" hidden role="img" aria-label="The shader's frame through the picture rack"></canvas><p class="shd-fs-hud"><span>F or Escape leaves. R rolls the rack, space pauses, [ and ] set the effects' amount.</span> <button type="button" data-full-leave>Leave full screen</button></p></div>
<p class="shd-run"><button type="button" data-run aria-pressed="false">Pause</button> <button type="button" data-rewind>Start time again</button> <button type="button" id="shd-full" aria-pressed="false">Full screen</button> <span class="shd-clock"></span></p>
${sourceHtml(state.from)}
<form class="shd-knobs" aria-label="Sliders the shader can read"><p class="shd-knob-h">Sliders the shader reads</p>${['A', 'B', 'C'].map((k, i) => `<label for="shd-k${i}">${k} <output for="shd-k${i}"></output></label><input type="range" id="shd-k${i}" data-knob="${i}" aria-label="Slider ${k}" min="0" max="1" step="0.01" value="${state.knobs[i]}">`).join('')}
<p class="shd-knob-say"></p></form>
<div class="shd-layers"><p class="shd-layers-h">Layers on the shader <span class="shd-count"></span></p><ol class="shd-ls"></ol><p class="shd-l-add"><button type="button" data-l-add>Add a layer</button> <span>Up to ${MAX_LAYERS}, drawn in one pass over the shader.</span></p></div>
<p class="shd-in" role="status" aria-live="polite"></p>
<p class="shd-take"><a class="shd-glsl" download hidden>Save the source (.glsl)</a> <button type="button" id="shd-share">Copy a link to this shader</button> <button type="button" data-png>Save this frame (.png)</button> <button type="button" data-one>Save the pixel grid, one pixel a cell (.png)</button> <button type="button" data-send="studio">Send to the Studio</button> <button type="button" data-send="loom">Send to the Loom</button>${FILES.filter((f) => f.kind !== 'palette-gpl').map((f) => ` <button type="button" data-file="${f.kind}">${esc(f.label)}</button>`).join('')}</p>
<p class="shd-made" role="status" aria-live="polite"></p>
</div></div>
<details class="shd-inputs"><summary>What a shader here can read</summary><dl>${INPUTS.map(([n, t, w]) => `<dt><code>${esc(n)}</code> <span>${esc(t)}</span></dt><dd>${esc(w)}</dd>`).join('')}</dl>
<p>Write <code>void mainImage(out vec4 colour, in vec2 pixel)</code>. The language is GLSL for WebGL 1. The shader runs on your own graphics card, in this tab, and nothing is sent anywhere.</p></details>`;
  const $ = (s) => host.querySelector(s), src = $('#shd-src'), gutter = $('.shd-gutter'), errBox = $('.shd-err'), canvas = $('.shd-frame'), inSay = $('.shd-in'), made = $('.shd-made'), glsl = $('.shd-glsl'), runB = $('[data-run]');
  const runner = createShaderStack(canvas, state.source), ls = $('.shd-ls'), outC = $('.shd-out'), post = createPost(outC), P = state.post;
  // what the room shows and hands on: the rack's canvas while the rack is in, the stack's own frame otherwise
  const shown = () => (outC.hidden ? canvas : outC);
  let lastAt = 0, spans = [], textCanvas = null;
  if (!runner.gl) {
    // no WebGL: the room says so and stays a place to read and save the source
    canvas.hidden = true; $('.shd-run').hidden = true; $('.shd-knobs').hidden = true; $('.shd-layers').hidden = true;
    made.textContent = 'This browser has no WebGL, so the shader cannot run here. The source can still be edited and saved.';
  }
  src.value = state.source;
  const stage = $('.shd-stage');
  // a rack change: the address, the frame and the hand-over follow; feedback draws twice so its memory shows
  const sources = wireSources(host, state.from, {
    changed(kind) { if (kind !== 'pending') { again(1); if (kind !== 'stroke') hand(); } writeAddress(); },
    setBase(glsl) { base = glsl; build(); },
    // a picture source is the base's iChannel0; back on the shader, the picture another room handed in returns
    setPicture(c) { if (!runner.gl) return; if (c) runner.setPicture(c, { live: true }); else { const blank = document.createElement('canvas'); blank.width = blank.height = 1; runner.setPicture(handed || blank, { live: !!handed }); } },
    knobs: () => state.knobs, time: () => time(), seed: () => P.fxseed, audio: async () => null,
    toUpload() { if (P.pal !== 'auto' && P.pal !== 'yours') { P.pal = 'auto'; rack.sync(); } },
  });
  const rack = wireRack(host, P, post, { changed(kind) { if (kind !== 'pending') { again(kind === 'fb' || kind === 'flush' ? 2 : 1); hand(); } writeAddress(); } });

  function number() {
    const n = src.value.split('\n').length, bad = new Set(errorsOf(host.dataset.errors || '').map((e) => e.line));
    let html = ''; for (let i = 1; i <= n; i++) html += `<span${bad.has(i) ? ' class="bad"' : ''}>${i}</span>`;
    gutter.innerHTML = html; gutter.scrollTop = src.scrollTop;
  }
  const time = () => (state.running ? (performance.now() - t0) / 1000 : held);
  function frame() {
    raf = 0; if (!runner.gl) return;
    // sound as an input: the sound room's levels while it plays, read each frame; zero when it is silent or closed
    const lv = ctx.levelsFrom?.('sound'), a = lv ? [lv.bass, lv.mid, lv.treble, lv.level] : [0, 0, 0, 0];
    runner.setAudio(...a); host.dataset.audio = a.map((v) => v.toFixed(2)).join(' ');
    const t = time(), now = performance.now(); draw(t, a); host.dataset.frames = String(+(host.dataset.frames || 0) + 1);
    // the frame time is the mean gap between the last 30 frames drawn while running
    if (lastAt && state.running) { spans.push(now - lastAt); if (spans.length > 30) spans.shift(); }
    lastAt = state.running ? now : 0;
    const ms = spans.length >= 10 ? spans.reduce((a, b) => a + b, 0) / spans.length : 0; if (ms) host.dataset.frameMs = ms.toFixed(2);
    $('.shd-clock').textContent = `${t.toFixed(1)} s${ms ? `, ${ms.toFixed(1)} ms a frame` : ''}`;
    if (state.running && visible && !document.hidden) raf = requestAnimationFrame(frame);
  }
  const kick = () => { if (!raf && runner.gl) raf = requestAnimationFrame(frame); };
  // One frame: the routes move the knobs, the stack draws, and the rack (when it is in) draws the stack's frame again.
  function draw(t, a = [0, 0, 0, 0]) {
    Object.assign(post.au, { bass: a[0], mid: a[1], treble: a[2], level: a[3] });
    const k = post.modulate(P, t, state.knobs); runner.setKnobs(...(k || state.knobs));
    sources.tick(t, null);
    runner.renderFrame(t);
    const on = postActive(P) && post.loaded;
    if (on) rack.strip(post.render(P, canvas, t, null));
    if (outC.hidden === on) { outC.hidden = !on; canvas.style.visibility = on ? 'hidden' : ''; }
  }
  // Feedback needs two frames to show: the first fills its memory. Paused, the room draws both at once.
  const again = (n = 1) => { if (state.running) return kick(); for (let i = 0; i < n; i++) draw(time()); };
  function setRunning(on) {
    if (on === state.running) return;
    if (on) t0 = performance.now() - held * 1000; else held = time();
    state.running = on; runB.textContent = on ? 'Pause' : 'Run'; runB.setAttribute('aria-pressed', String(!on)); kick();
  }
  function build() {
    state.source = src.value;
    const out = runner.gl ? runner.setSource(base || state.source) : { ok: true };
    host.dataset.errors = out.ok ? '' : out.error; host.dataset.ok = String(!!out.ok);
    const errs = out.ok ? [] : errorsOf(out.error);
    errBox.innerHTML = errs.length ? `<p>The shader did not compile, so the frame still shows the last one that did.</p><ul>${errs.map((e) => `<li>${e.line ? `<button type="button" data-line="${e.line}">Line ${e.line}</button> ` : ''}${esc(e.message)}</li>`).join('')}</ul>` : '';
    number();
    if (out.ok) { lastGood = state.source; hash = sessionHash(new TextEncoder().encode(state.source)); host.dataset.hash = hash; link(); hand(); kick(); }
    return out.ok;
  }
  function link() {
    for (const u of urls) URL.revokeObjectURL(u); urls.clear();
    const u = URL.createObjectURL(new Blob([lastGood], { type: 'text/plain' })); urls.add(u); glsl.href = u; glsl.download = `shader-${hash.slice(0, 8)}.glsl`; glsl.hidden = false;
  }
  async function writeAddress() {
    const k = state.knobs.every((v) => v === 0.5) ? null : state.knobs.map((v) => +v.toFixed(2)).join(',');
    ctx.address?.({ shp: state.edited || state.preset ? null : state.start, sh: state.edited || state.preset ? await encodeSource(state.source) : null, k, ly: encodeLayers(state.layers), rp: encodePost(P), ...sourceAddress(state.from) });
  }
  // the frame goes to the other modules when a shader compiles and typing has paused; the recipe is what draws it again
  const hand = () => { clearTimeout(sendTimer); sendTimer = setTimeout(() => { if (!runner.gl) return; draw(time()); const f = shown();
    ctx.send?.('image', { width: f.width, height: f.height, of: 'shader' }, { recipe: { shader: hash, knobs: state.knobs.map((v) => +v.toFixed(2)), rack: encodePost(P) } }); }, 500); };
  const schedule = () => { clearTimeout(timer); timer = setTimeout(() => { build(); writeAddress(); }, 250); };
  function load(text, { start = null, preset = '' } = {}) {
    src.value = text; state.edited = false; state.preset = preset; if (start) state.start = start;
    const s = preset ? library?.find((p) => p.name === preset) : startOf(state.start);
    $('.shd-knob-say').textContent = s?.knobs ? `In this shader: ${s.knobs}` : '';
    build(); writeAddress();
  }
  function says() {
    const p = paletteFrom ? `Its colours come from ${paletteFrom}.` : 'No colours have been handed in; a shader that reads iPalette uses its own.';
    const i = picture ? `Its picture comes from ${picture}.` : 'No picture has been handed in; a shader that reads iChannel0 draws its own.';
    inSay.textContent = `${p} ${i}`;
  }
  function pixels() {
    draw(time()); const f = shown();
    const c = document.createElement('canvas'); c.width = f.width; c.height = f.height; const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(f, 0, 0);
    return { data: x.getImageData(0, 0, c.width, c.height).data, w: c.width, h: c.height };
  }
  function save(name, blob, words) { const u = URL.createObjectURL(blob), a = document.createElement('a'); urls.add(u); a.href = u; a.download = name; host.append(a); a.click(); a.remove(); made.textContent = words; host.dataset.saved = name; }

  // The handed line, lettered on a canvas of the frame's size: white letters on nothing, so the layer's mix shows them.
  function letter() {
    if (!state.text) return null;
    if (!textCanvas) { textCanvas = document.createElement('canvas'); textCanvas.width = canvas.width; textCanvas.height = canvas.height; }
    const x = textCanvas.getContext('2d'), w = textCanvas.width, h = textCanvas.height, face = getComputedStyle(host).fontFamily || 'sans-serif';
    x.clearRect(0, 0, w, h); let size = h * 0.42; x.font = `700 ${size}px ${face}`;
    const wide = x.measureText(state.text).width; if (wide > w * 0.9) { size *= (w * 0.9) / wide; x.font = `700 ${size}px ${face}`; }
    x.fillStyle = '#ffffff'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(state.text, w / 2, h / 2);
    return textCanvas;
  }
  // what a layer's row says beside its number: why it shows nothing, if it does
  function layerState(L, err) {
    if (err) return `its shader did not compile (${errorsOf(err)[0]?.message || 'error'})`;
    if (L.src === 'palette' && !+(host.dataset.palette || 0)) return 'no colours handed in yet';
    if (L.src === 'text' && !state.text) return 'no line handed on yet; the type forge hands one on';
    if (L.src.startsWith('pic:') && !ctx.pictureFrom?.(L.src.slice(4))) return 'that picture is not on the page yet';
    if (L.src.startsWith('p:') && !library) return 'loading the preset library';
    return nameOfSrc(L.src);
  }
  function pushLayers() {
    if (!runner.gl) return [];
    return runner.setLayers(state.layers.map((L) => stackLayer(L, { library, pictureOf: (id) => ctx.pictureFrom?.(id) || null, textCanvas: () => textCanvas, rows: ctx.registry?.SURFACES })));
  }
  // the words beside each layer's number, without redrawing the rows (a slider being dragged keeps its place)
  function sayLayers(errs = pushLayers()) { state.layers.forEach((L, i) => { const el = host.querySelector(`[data-layer="${i}"] .shd-l-h span`); if (el) el.textContent = layerState(L, errs[i]); }); kick(); }
  function paintLayers() {
    const errs = pushLayers(), n = state.layers.length, focus = document.activeElement?.id;
    ls.innerHTML = state.layers.map((L, i) => layerRow(L, i, n, { library, state: layerState(L, errs[i]) })).join('');
    $('.shd-count').textContent = n ? `${n} of ${MAX_LAYERS}` : 'none yet';
    $('[data-l-add]').disabled = n >= MAX_LAYERS; host.dataset.layers = String(n);
    if (focus && host.querySelector(`#${focus}`)) host.querySelector(`#${focus}`).focus();
    kick(); hand(); writeAddress();
  }
  async function loadLibrary(button) {
    if (library) return library;
    if (button) { button.disabled = true; button.textContent = 'Loading'; }
    try {
      library = (await import(LIBRARY)).SHADER_PRESETS;
      const groups = new Map(); for (const p of library) (groups.get(p.group) ?? groups.set(p.group, []).get(p.group)).push(p);
      $('.shd-lib').innerHTML = `<label for="shd-preset">Preset library, ${library.length} shaders</label><select id="shd-preset">${shelfOptions(library).html}</select>${shelfHtml(library.length)}`;
      shelf = wireShelf(host, { library, select: () => $('#shd-preset'), pick: (name) => { const p = library.find((x) => x.name === name); if (p) load(p.glsl, { preset: p.name }); }, say: (w) => { made.textContent = w; },
        shareLink: async () => `${location.origin}${location.pathname}?room=shader&sh=${await encodeSource(state.source)}#shader` });
      host.dataset.library = String(library.length); if (button) $('#shd-preset').focus();
      paintLayers();
    } catch (e) { console.error('shader: the preset library did not load', e); if (button) { button.disabled = false; button.textContent = 'Load the preset library'; } made.textContent = 'The preset library did not load.'; }
    return library;
  }
  function onLayer(t) {
    const i = +(t.dataset.lMix ?? t.dataset.lKey ?? t.dataset.lSrc ?? t.dataset.lBlend), L = state.layers[i]; if (!L) return false;
    // the two sliders move the frame as they move, without drawing the rows again
    const slid = t.dataset.lMix !== undefined ? 'mix' : t.dataset.lKey !== undefined ? 'key' : null;
    if (slid) { L[slid] = +t.value; const o = host.querySelector(`output[for="${t.id}"]`); if (o) o.textContent = `${Math.round(L[slid] * 100)}%`; pushLayers(); kick(); hand(); writeAddress(); return true; }
    if (t.dataset.lSrc !== undefined) L.src = t.value; else L.blend = t.value;
    paintLayers(); return true;
  }

  const onInput = (ev) => {
    const t = ev.target;
    if (rack.onInput(ev) || sources.onInput(ev) || shelf?.onInput(ev)) return;
    if (t === src) { state.edited = true; number(); schedule(); }
    else if (t.closest('.shd-ls')) onLayer(t);
    else if (t.dataset.knob) { state.knobs[+t.dataset.knob] = +t.value; paintKnobs(); kick(); hand(); writeAddress(); }
    else if (t.id === 'shd-start') load(startOf(t.value).glsl, { start: t.value });
    else if (t.id === 'shd-preset') { const p = library.find((x) => x.name === t.value); if (p) load(p.glsl, { preset: p.name }); }
  };
  function paintKnobs() { state.knobs.forEach((v, i) => { $(`output[for="shd-k${i}"]`).textContent = v.toFixed(2); }); runner.gl && runner.setKnobs(...state.knobs); }
  const onClick = async (ev) => {
    const t = ev.target.closest('button'); if (!t) return;
    if (rack.onClick(ev) || sources.onClick(ev) || (shelf && await shelf.onClick(ev))) return;
    if (t.id === 'shd-full' || t.dataset.fullLeave !== undefined) return fs.toggle();
    if (t.dataset.run !== undefined) setRunning(!state.running);
    else if (t.dataset.rewind !== undefined) { t0 = performance.now(); held = 0; kick(); }
    else if (t.dataset.lAdd !== undefined) { if (state.layers.length < MAX_LAYERS) { state.layers.push({ ...DEFAULT_LAYER }); paintLayers(); host.querySelector(`#shd-l${state.layers.length - 1}-src`)?.focus(); } }
    else if (t.dataset.lRm !== undefined) { state.layers.splice(+t.dataset.lRm, 1); paintLayers(); $('[data-l-add]').focus(); }
    else if (t.dataset.lLower !== undefined || t.dataset.lRaise !== undefined) { const i = +(t.dataset.lLower ?? t.dataset.lRaise), d = t.dataset.lLower !== undefined ? -1 : 1; state.layers = moveLayer(state.layers, i, d); paintLayers(); host.querySelector(`#shd-l${i + d}-mix`)?.focus(); }
    else if (t.dataset.line) { const lines = src.value.split('\n'), n = Math.min(+t.dataset.line, lines.length), at = lines.slice(0, n - 1).reduce((a, l) => a + l.length + 1, 0); src.focus(); src.setSelectionRange(at, at + lines[n - 1].length); }
    else if (t.dataset.png !== undefined) { draw(time()); const f = shown(); f.toBlob((b) => b && save(`shader-${hash.slice(0, 8)}.png`, b, `Saved the frame at ${time().toFixed(1)} s: ${f.width} by ${f.height} pixels, ${b.size.toLocaleString('en')} bytes.`), 'image/png'); }
    else if (t.dataset.one !== undefined) { await post.ready(); draw(time()); const one = post.oneToOne(P, canvas, null);
      one.toBlob((b) => b && save(`shader-${hash.slice(0, 8)}-grid-${one.width}x${one.height}.png`, b, `Saved the pixel grid: ${one.width} by ${one.height}, one pixel a cell, ${b.size.toLocaleString('en')} bytes.`), 'image/png'); }
    else if (t.dataset.file) {
      const f = makeFile(t.dataset.file, pixels(), [], 'shader', { by: 'made by the shader room (harperz9.github.io/playground/#shader) from the frame of a shader', recipe: `shader ${hash}, at ${time().toFixed(1)} s` });
      const blob = new Blob([f.body], { type: f.mime });
      save(`shader-${hash.slice(0, 8)}.${f.ext}`, blob, `Saved ${f.label.toLowerCase()} of the frame: ${blob.size.toLocaleString('en')} bytes. ${f.says}`);
    } else if (t.dataset.send) {
      // the studio's hand-over: the frame as a PNG in this tab's session storage, then the page that takes it opens
      draw(time()); const { sendPiece } = await import('../../../system/workbench.js'), name = state.preset || (state.edited ? 'your shader' : startOf(state.start).name);
      if (!sendPiece(t.dataset.send, shown().toDataURL('image/png'), { surface: 'retro', label: `${name}${state.layers.length ? ` +${state.layers.length}` : ''}, ${postActive(P) ? P.pal : 'no rack'}` })) made.textContent = 'The frame is too large to hand over in this tab.';
      else { made.textContent = `Opening ${t.dataset.send === 'loom' ? 'the Loom' : 'the Studio'} with this frame.`; host.dataset.sentTo = t.dataset.send; }
    } else if (t.dataset.library !== undefined) loadLibrary(t);
  };
  const onKey = (ev) => {
    if (sources.onKey(ev)) return;
    if (studioKey(ev, { drawing: () => sources.drawing, undoStroke: () => sources.undoStroke(), full: () => fs.toggle(), roll: () => rack.fill().then(() => rack.randomize()), save: () => $('[data-png]').click(), pause: () => setRunning(!state.running),
      amount(d) { const m = $('#shd-fx-amount'); m.value = String(Math.max(0, Math.min(100, +m.value + d))); m.dispatchEvent(new Event('input', { bubbles: true })); } })) return;
    // Tab leaves the text area, as everywhere else; two spaces are typed with the space bar. Escape then Tab is not needed.
    if (ev.target === src && ev.key === 'Enter') { const at = src.selectionStart, line = src.value.slice(src.value.lastIndexOf('\n', at - 1) + 1, at), pad = /^\s*/.exec(line)[0];
      if (pad) { ev.preventDefault(); src.setRangeText('\n' + pad, at, src.selectionEnd, 'end'); src.dispatchEvent(new Event('input', { bubbles: true })); } }
  };
  const onScroll = () => { gutter.scrollTop = src.scrollTop; };
  const onPointer = (ev) => { if (!runner.gl) return; sources.onPointer(ev, shown()); const r = shown().getBoundingClientRect(); post.mouse.x = (ev.clientX - r.left) / r.width; post.mouse.y = (ev.clientY - r.top) / r.height; runner.setMouse((ev.clientX - r.left) / r.width * canvas.width, (1 - (ev.clientY - r.top) / r.height) * canvas.height, ev.buttons > 0, ev.type === 'pointerdown'); kick(); };
  const onEnd = (ev) => sources.onPointer(ev, shown());
  const onLeave = () => { runner.gl && runner.setMouse(0, 0, false, false); kick(); };
  const onSubmit = (ev) => ev.preventDefault();
  const onShow = () => kick();
  host.addEventListener('input', onInput); host.addEventListener('click', onClick); host.addEventListener('keydown', onKey); host.addEventListener('submit', onSubmit);
  src.addEventListener('scroll', onScroll); stage.addEventListener('pointermove', onPointer); stage.addEventListener('pointerdown', onPointer); stage.addEventListener('pointerleave', onLeave, true);
  for (const k of ['pointerup', 'pointercancel', 'lostpointercapture']) stage.addEventListener(k, onEnd);
  const fs = fullScreen(stage, $('#shd-full'), (w) => { made.textContent = w; }); host.addEventListener('toggle', rack.onToggle, true);
  document.addEventListener('visibilitychange', onShow);
  const watch = typeof IntersectionObserver === 'function' ? new IntersectionObserver((es) => { visible = es[es.length - 1].isIntersecting; if (visible) kick(); }) : null;
  watch?.observe(canvas);

  $('#shd-start').value = state.start;
  if (ctx.reduced) { runB.textContent = 'Run'; runB.setAttribute('aria-pressed', 'true'); made.textContent = 'Reduced motion is on, so the shader starts paused on its first frame. Run starts it.'; }
  t0 = performance.now(); ctx.offerPicture?.(() => (runner.gl && host.dataset.ok === 'true' ? shown() : null));
  if (postActive(P)) rack.fill();
  sources.start(); if (q.get('import') === 'plate') sources.takeHandoff();
  paintKnobs(); says(); $('.shd-knob-say').textContent = !state.edited && startOf(state.start).knobs ? `In this shader: ${startOf(state.start).knobs}` : '';
  build(); paintLayers(); if (wantsLibrary(state.layers)) loadLibrary(null);
  // measure(width, frames): the time a whole frame takes with the stack as it stands, at that width (8:5), in ms
  // draw(n): n frames now, for a test that holds the room paused and compares frames
  host.shaderDraw = (n = 1) => again(n);
  host.shaderMeasure = (width = 1280, frames = 30) => { if (!runner.gl) return null; const [w, h] = [canvas.width, canvas.height];
    canvas.width = width; canvas.height = Math.round(width * 5 / 8); const ms = runner.measure(time(), frames); canvas.width = w; canvas.height = h; runner.renderFrame(time()); return ms; };

  return {
    update(next) {
      const env = next?.heard; if (!env || !runner.gl) return;
      if (env.medium === 'palette') { const n = runner.setPalette(env.value?.inks || [env.value?.mix].filter(Boolean)); paletteFrom = n ? `the blend (${n} of them)` : ''; host.dataset.palette = String(n); says(); sayLayers(); hand(); }
      else if (env.medium === 'text' && typeof env.value?.text === 'string') { state.text = env.value.text.slice(0, 80); letter(); sayLayers(); hand(); }
      else if (env.medium === 'image' && env.from.module !== 'shader') { const c = ctx.pictureOf?.(env); if (c) handed = c; if (c && (state.from.mode !== 'shader' || runner.setPicture(c, { live: true }))) { picture = ctx.nameOf?.(env.from.module) || env.from.module; host.dataset.picture = env.value.of; says(); sayLayers(); hand(); } }
    },
    value: () => ({ source: state.source, ok: host.dataset.ok === 'true', errors: errorsOf(host.dataset.errors || ''), hash, running: state.running, knobs: [...state.knobs], start: state.start, preset: state.preset, edited: state.edited,
      palette: +(host.dataset.palette || 0), picture: host.dataset.picture || null, time: time(), layers: state.layers.map((L) => ({ ...L })), makers: state.layers.map((L) => propertiesOf(L.src, ctx.registry?.SURFACES).maker), text: state.text, frameMs: +(host.dataset.frameMs || 0), post: JSON.parse(JSON.stringify(P)), from: { ...state.from }, rack: postActive(P) && post.loaded }),
    destroy() {
      clearTimeout(timer); clearTimeout(sendTimer); if (raf) cancelAnimationFrame(raf); watch?.disconnect(); document.removeEventListener('visibilitychange', onShow);
      host.removeEventListener('input', onInput); host.removeEventListener('click', onClick); host.removeEventListener('keydown', onKey); host.removeEventListener('submit', onSubmit);
      host.removeEventListener('toggle', rack.onToggle, true); post.dispose(); shelf?.destroy(); fs.destroy();
      for (const u of urls) URL.revokeObjectURL(u);
      delete host.shaderMeasure; delete host.shaderDraw; runner.gl && runner.destroy(); host.innerHTML = ''; host.classList.remove('shd'); for (const k of Object.keys(host.dataset)) if (!/^surface/.test(k)) delete host.dataset[k];
    },
  };
}
