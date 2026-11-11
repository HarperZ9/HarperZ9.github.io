// surface-well.mjs: the well as a surface. mount(host, { elements, weights, settings, ground, chain, living, written }, ctx).
// The visitor acts on the well: drag to stir, press to pour, arrow keys to tilt, Space to pour in the middle,
// 0 to level, 1 to 4 to choose which pigment pours. The ground is a medium (grounds.mjs). Unless the visitor
// chooses one, it follows the blend: the first material in it that has a ground becomes the ground and the rest
// are the pigments on it; with none, paper by day and water by night. The control says which and why.
// The ground has a state, and Heat, Cool and Grind move it along the state table (states.mjs, through well-ops.mjs):
// the change crosses the well behind a front, the page says what happened and by which rule, and the chain so far is
// kept. Made things (a fibre sheet, glass, ice) are shown as steps to walk. Three pigments from living things can be
// added, each marked proposed. The blend's names can be written on a ground that takes paint layers.
// ctx.onGround(id or null) and ctx.onWell({ chain, living, written }) tell the page. Plain view and a browser without
// WebGL get the same elements as named colour samples and the same words, and nothing that moves.
import { createWell } from './well.mjs';
import { driveFor } from './elements-data.mjs';
import { GROUNDS, groundFor, isNight } from './grounds.mjs';
import { MATERIALS, CHAINS, LIVING, materialOf } from './states.mjs';
import { SECONDS, FADE_SECONDS, validChain, advance, jump, opsHTML, chainsHTML, stateWords, didWords, livingHTML, livingPart, letterMask, signalHTML } from './well-ops.mjs';
import { SIGNALS, toWell as signalToWell } from './signal.mjs';
import { okToLinear, linToHex } from './km.mjs';
import { BRUSHES, brushName, beginStroke, replay, cleanStrokes } from './brush-field.mjs';
import { hexToOk } from '../../studio/lib/blend.mjs';

let wells = 0;
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const GROUPS = [...new Set(Object.values(GROUNDS).map((g) => g.group))];
const clean = (s) => ({ ...s, ground: s.ground ?? null, chain: validChain(s.chain) ? s.chain : null, living: (s.living || []).filter((id) => LIVING[id]).slice(0, 3), written: !!s.written, strokes: cleanStrokes(s.strokes) });

export function mount(host, input, ctx) {
  const { ix } = ctx;
  let state = clean(input), sig = null, brush = '', stroke = null, kx = 0.5, ky = 0.5, slot = 0, well = null, down = null, on = null, key = '', did = '', light = false, timer = 0, glyph = null;
  const how = `sf-well-how-${++wells}`, fades = {}, like = driveFor(ix, { id: '', properties: [] }).shader;
  host.classList.add('sf-well');
  host.innerHTML = `<div class="sf-bar"><label class="sf-ground">Ground <select data-ground><option value="">follow the blend</option>${GROUPS.map((gr) => `<optgroup label="${esc(gr)}">${Object.entries(GROUNDS).filter(([, g]) => g.group === gr).map(([id, g]) => `<option value="${esc(id)}">${esc(g.name)}</option>`).join('')}</optgroup>`).join('')}</select></label>
    <span class="sf-ops" role="group" aria-label="Change the ground's state"></span>
    <label class="sf-ground">Brush <select data-brush><option value="">hand: stir and pour</option>${BRUSHES.map((b) => `<option value="${esc(b)}">${esc(brushName(b))}</option>`).join('')}</select></label></div>
    <div class="sf-water" tabindex="0" role="application" aria-roledescription="well" aria-describedby="${how}"><canvas></canvas><i class="sf-cursor" hidden></i></div>
    <p class="sf-how" id="${how}">Drag to stir. Press to pour. Arrow keys tilt the well, Space pours, 0 levels it.</p>
    <div class="sf-acts"><span class="sf-slots" role="radiogroup" aria-label="Which pigment pours"></span>
    <button type="button" data-act="level">Level</button><button type="button" data-act="again">Start again</button><button type="button" data-act="write" aria-pressed="false">Write on it</button></div>
    <p class="sf-why" role="status"></p><p class="sf-did" role="status"></p>
    <ul class="sf-chains" aria-label="Made things, step by step"></ul><div class="sf-living"></div><div class="sf-sig"></div>
    <ul class="sf-still" hidden></ul>`;
  const $ = (q) => host.querySelector(q), water = $('.sf-water'), canvas = $('canvas'), slots = $('.sf-slots'), still = $('.sf-still'), pick = $('[data-ground]'), why = $('.sf-why');
  const els = () => state.elements.map((id) => ix.byId.get(id)).filter(Boolean).slice(0, 4);
  // the pigments: every chosen element except the one that became the ground, then the living pigments, four at most
  // a silent signal, when one is chosen, takes the well: its notes are the pigments (signal.mjs; proposed)
  const parts = () => sig ? sig.got.parts.map((p) => ({ ...p, colour: { hex: linToHex(okToLinear(p.ok)) } })) : [...els().filter((e) => on.pigments.includes(e.id)), ...state.living.map((id) => ({ id, name: LIVING[id].name, colour: { hex: LIVING[id].hex }, links: [], living: true }))].slice(0, 4);
  // measured links, either way, as a strength from 0 to 1 between every two parts; linkScale lets a check switch them off
  const link = (a, b) => Math.min(1, Math.max(a.links.find((l) => l.to === b.id)?.weight ?? 0, b.links.find((l) => l.to === a.id)?.weight ?? 0) / 100) * (state.linkScale ?? 1);
  const toWell = () => parts().map((e, i, P) => (e.signal ? e : e.living ? { ...livingPart(e.id, like, hexToOk), links: P.map(() => 0), fade: fades[e.id] ?? 0 }
    : { links: P.map((o) => (o === e ? 0 : link(e, o))), ok: hexToOk(e.colour?.hex || '#8a8a8a'), weight: Math.max(0.02, +(state.weights?.[state.elements.indexOf(e.id)] ?? 1) || 0), drive: driveFor(ix, e, state.settings?.[e.id]).shader }));

  if (!ctx.plain) { try { well = createWell(canvas, { reduced: ctx.reduced }); } catch (e) { console.info('well: no drawing surface here, the samples stand in:', e.message); } }
  if (!well) { water.hidden = true; $('.sf-how').hidden = true; $('.sf-acts').hidden = true; still.hidden = false; }

  // which ground, and which elements are pigments. An element that became the ground stays the ground through its chain.
  function resolve() {
    const g = groundFor(ix, state.elements, state.ground, isNight()), c = state.chain;
    if (c?.of && g.pigments.includes(c.of) && g.pigments.length > 1) g.pigments = g.pigments.filter((id) => id !== c.of);
    if (!g.auto && c?.ops.length) g.why = `reached by ${c.ops.length === 1 ? 'one operation' : `${c.ops.length} operations`}`;
    return g;
  }
  // redrawing a group of buttons must not drop the keyboard's place in it
  function fill(el, html) { const a = document.activeElement, at = el.contains(a) ? ['op', 'living', 'chain', 'step', 'signal'].map((k) => a.dataset[k] ?? '').join('|') : null; el.innerHTML = html;
    if (at !== null) [...el.querySelectorAll('button, input')].find((b) => ['op', 'living', 'chain', 'step', 'signal'].map((k) => b.dataset[k] ?? '').join('|') === at && !b.disabled)?.focus(); }
  async function writing() {
    const can = GROUNDS[on.id].rule === 'layers', b = $('[data-act="write"]');
    b.disabled = !can; b.setAttribute('aria-pressed', state.written && can); b.title = can ? 'The names in the well, set by the lettering library and laid as ink' : 'Writing is a paint layer, so it needs a ground that takes layers: a sheet, stone, wood or metal';
    if (!well) return;
    if (!state.written || !can) { well.write(null); return; }
    try { glyph = glyph || await import('../../lettering/lib/glyph.mjs'); await glyph.ensureFont(); if (state.written) well.write(letterMask(glyph, parts().map((p) => p.name)), 640, 480); }
    catch (e) { console.info('well: the words could not be set:', e.message); }
  }
  function paint(reseed) {
    on = resolve();
    const P = parts(), g = GROUNDS[on.id], k = P.map((p) => p.id).join(), moved = key !== '' && key !== k; key = k;
    slot = Math.min(slot, Math.max(0, P.length - 1));
    water.setAttribute('aria-label', `The well: ${P.map((e) => e.name).join(', ') || 'nothing'} on ${g.name}`); water.dataset.ground = on.id; water.dataset.state = g.state || '';
    slots.hidden = P.length < 2;
    slots.innerHTML = P.map((e, i) => `<button type="button" role="radio" aria-checked="${i === slot}" data-slot="${i}"><i style="background:${esc(e.colour?.hex)}"></i>${esc(e.name)}</button>`).join('');
    still.innerHTML = P.map((e) => `<li><i style="background:${esc(e.colour?.hex)}"></i>${esc(e.name)} <span>${esc(e.colour?.hex)}${e.living ? ', proposed' : ''}</span></li>`).join('') + `<li>on ${esc(g.name)}${g.state ? `, a ${esc(g.state)}` : ''}</li>`;
    pick.value = on.auto ? '' : on.id;
    why.innerHTML = `On <b>${esc(g.name)}</b>: ${esc(on.why)}. <small>${stateWords(on.id, state.chain)}</small>`;
    $('.sf-did').textContent = did;
    fill($('.sf-ops'), opsHTML(on.id, state.chain, !!well?.changing())); fill($('.sf-chains'), chainsHTML(on.id, state.chain));
    fill($('.sf-living'), sig ? '' : livingHTML(state.living, els().filter((e) => on.pigments.includes(e.id)).length + state.living.length >= 4, light)); fadeWords();
    if (well && well.ground() !== on.id && well.changing()?.to !== on.id) well.ground(on.id);
    fill($('.sf-sig'), signalHTML(sig?.id, sig?.got));
    well?.set(toWell(), { reseed: reseed || moved }); writing();
    if (!sig && well && (reseed || moved) && state.strokes.length) { replay(well.brush(), state.strokes, P.length); well.touch(); }   // a painting is its strokes, laid again
    if (sig && well && (reseed || moved)) { well.sim.clear(); for (const p of sig.got.pours) well.sim.pour(p.slot, p.x, p.y, p.amount); well.tilt(0, 0); }   // the signal's pours, left to right
  }
  const tellPage = () => { ctx.onGround?.(state.ground); ctx.onWell?.({ chain: state.chain, living: state.living, written: state.written, strokes: state.strokes }); };
  // the brush engine (world/feed-23) paints the chosen pigment into the well's field; each stroke is kept so the painting can be laid again
  const HOW = { hand: 'Drag to stir. Press to pour. Arrow keys tilt the well, Space pours, 0 levels it.', brush: 'Drag to paint with the chosen pigment. Arrow keys move the brush and paint, Space lays one dab, 1 to 4 choose the pigment.' };
  const cursor = () => { const c = $('.sf-cursor'); c.hidden = !brush; c.style.left = `${kx * 100}%`; c.style.top = `${ky * 100}%`; };
  const begin = () => (slot < parts().length ? beginStroke(well.brush(), slot, brush, state.strokes.length + 1) : null);
  const keep = (st) => { const s = st.done(); if (s.pts.length) { state.strokes = cleanStrokes([...state.strokes, s]); tellPage(); } };
  const keyStroke = (x, y) => { const st = begin(); if (!st) return; for (let i = 0; i <= 4; i++) st.add(kx + (x - kx) * i / 4, ky + (y - ky) * i / 4, 0.8, i * 0.03); kx = x; ky = y; keep(st); well.touch(); cursor(); };
  // one operation: the table says where it leads; the well shows the change crossing; the page says what happened
  function act(op) {
    if (well?.changing()) return;
    const of = on.auto ? state.elements.find((id) => ix.byId.has(id) && !on.pigments.includes(id)) ?? null : state.chain?.of ?? null, nx = advance(on.id, state.chain, op, of);
    if (!nx) return;
    state.chain = nx.chain; state.ground = nx.ground; did = didWords(nx.from, nx.to, op, ctx.reduced || !well);
    well?.transform(nx.ground, op, SECONDS, () => paint(false)); paint(false); tellPage();
  }
  function step(id, n) {
    const j = jump(id, n); if (!j || well?.changing()) return;
    const op = CHAINS[id].steps[n - 1], nx = n > 0 ? advance(on.id, state.chain, op) : null;
    if (nx && nx.ground === j.ground && nx.chain.ops.join() === j.chain.ops.join()) { act(op); return; }   // the next step of the chain the well is on: walk it
    state.ground = j.ground; state.chain = j.chain; did = `Set to ${MATERIALS[materialOf(j.ground)].name}, step ${n + 1} of ${CHAINS[id].steps.length + 1} toward ${MATERIALS[id].name}: ${CHAINS[id].says}.`; paint(false); tellPage();
  }
  function fadeWords() { const p = $('.sf-fade'); if (p) p.textContent = state.living.some((id) => fades[id]) ? `Fade shown: ${state.living.map((id) => `${LIVING[id].name} ${Math.round(100 * (fades[id] ?? 0))}%`).join(', ')}. The table proposes only fast or slow; the speed here is ours, so the order can be seen. Not measured.` : ''; }
  function fadeOn() {
    clearInterval(timer); timer = 0; if (!light) return;
    const tick = (dt) => { let more = false; state.living.forEach((id) => { fades[id] = Math.min(1, (fades[id] ?? 0) + dt / FADE_SECONDS[LIVING[id].fade]); if (fades[id] < 1) more = true; well?.fade(parts().findIndex((p) => p.id === id), fades[id]); }); fadeWords(); if (!more) { clearInterval(timer); timer = 0; } };
    if (ctx.reduced || !well) tick(1e6); else timer = setInterval(() => tick(0.5), 500);
  }
  const at = (ev) => { const r = canvas.getBoundingClientRect(); return [(ev.clientX - r.left) / r.width, (ev.clientY - r.top) / r.height]; };
  const pen = (ev) => (ev.pointerType === 'pen' && ev.pressure > 0 ? ev.pressure : null);
  const onDown = (ev) => { if (!well) return; const [x, y] = at(ev); down = { x, y, t: ev.timeStamp }; water.setPointerCapture?.(ev.pointerId);
    if (brush && !sig) { stroke = begin(); stroke?.add(x, y, pen(ev), 0); kx = x; ky = y; cursor(); well.touch(); } else well.pour(slot, x, y, 0.35); };
  const onMove = (ev) => { if (!well || !down) return; const [x, y] = at(ev), dt = Math.max(8, ev.timeStamp - down.t) / 1000;
    if (stroke) { stroke.add(x, y, pen(ev), (ev.timeStamp - down.t) / 1000); kx = x; ky = y; cursor(); well.touch(); return; }
    well.stir(x, y, (x - down.x) / dt * 0.9, (y - down.y) / dt * 0.9); down = { x, y, t: ev.timeStamp }; };
  const onUp = () => { if (stroke) { keep(stroke); stroke = null; } down = null; };
  let tx = 0, ty = 0;
  const onKey = (ev) => {
    if (!well) return;
    const k = ev.key, d = { ArrowLeft: [-0.5, 0], ArrowRight: [0.5, 0], ArrowUp: [0, -0.5], ArrowDown: [0, 0.5] }[k];
    if (brush && !sig && (d || k === ' ' || k === 'Enter')) keyStroke(Math.max(0.02, Math.min(0.98, kx + (d ? d[0] * 0.12 : 0))), Math.max(0.02, Math.min(0.98, ky + (d ? d[1] * 0.12 : 0))));
    else if (d) { tx = Math.max(-1, Math.min(1, tx + d[0])); ty = Math.max(-1, Math.min(1, ty + d[1])); well.tilt(tx, ty); }
    else if (k === ' ' || k === 'Enter') well.pour(slot, 0.5, 0.5, 0.5);
    else if (k === '0' || k === 'Escape') { tx = ty = 0; well.tilt(0, 0); }
    else if (/^[1-4]$/.test(k) && +k <= parts().length) { slot = +k - 1; paint(false); }
    else return;
    ev.preventDefault();
  };
  const onClick = (ev) => {
    const t = (q) => ev.target.closest(q), s = t('[data-slot]'), a = t('[data-act]'), o = t('[data-op]'), c = t('[data-chain]'), l = t('[data-living]'), g = t('[data-signal]');
    if (s) { slot = +s.dataset.slot; paint(false); }
    else if (g) { const id = g.dataset.signal; sig = SIGNALS[id] ? { id, got: signalToWell(SIGNALS[id].make(), like) } : null; paint(true); }
    else if (o) act(o.dataset.op);
    else if (c) step(c.dataset.chain, +c.dataset.step);
    else if (l) { const id = l.dataset.living; state.living = state.living.includes(id) ? state.living.filter((x) => x !== id) : [...state.living, id]; delete fades[id]; paint(false); tellPage(); }
    else if (a?.dataset.act === 'level') { tx = ty = 0; well?.tilt(0, 0); }
    else if (a?.dataset.act === 'again') { tx = ty = 0; well?.tilt(0, 0); for (const id of Object.keys(fades)) delete fades[id]; state.strokes = []; well?.reset(); paint(false); fadeOn(); tellPage(); }
    else if (a?.dataset.act === 'write') { state.written = !state.written; writing(); tellPage(); }
  };
  const onPick = (ev) => {
    if (ev.target === pick) { state.ground = pick.value || null; const m = state.ground && materialOf(state.ground); state.chain = m ? { from: m, ops: [], of: null } : null; did = ''; paint(false); tellPage(); }
    else if (ev.target.matches('[data-light]')) { light = ev.target.checked; fadeOn(); }
    else if (ev.target.matches('[data-brush]')) { brush = ev.target.value; $('.sf-how').textContent = brush ? HOW.brush : HOW.hand; water.style.cursor = brush ? 'crosshair' : ''; cursor(); }
  };
  // the page turning from day to night moves a ground that follows the page
  const mo = typeof MutationObserver === 'function' ? new MutationObserver(() => { if (!state.ground) paint(false); }) : null;
  mo?.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  water.addEventListener('pointerdown', onDown); water.addEventListener('pointermove', onMove);
  water.addEventListener('pointerup', onUp); water.addEventListener('pointercancel', onUp);
  water.addEventListener('keydown', onKey); host.addEventListener('click', onClick); host.addEventListener('change', onPick);
  paint(true);

  // paint one stroke through the engine, as the pointer does: points are [x, y] fractions of the well
  const paintStroke = (name, pts, s = slot) => { if (!well) return 0; const was = [brush, slot]; brush = name; slot = s; const st = begin(); brush = was[0]; slot = was[1]; if (!st) return 0; pts.forEach(([x, y], i) => st.add(x, y, null, i * 0.02)); keep(st); well.touch(); return st.dabs; };
  return {
    // same elements in the same order: only how they are drawn changes, and the well keeps what the visitor did
    update(next) { const same = next.elements && next.elements.join() === state.elements.join() && (next.weights || []).join() === (state.weights || []).join() && (next.linkScale ?? state.linkScale) === state.linkScale;
      const redo = next.strokes !== undefined && JSON.stringify(cleanStrokes(next.strokes)) !== JSON.stringify(state.strokes);   // a recipe brought a painting: lay it on a fresh well
      state = clean({ ...state, ...next }); paint(!same || redo); },
    value: () => ({ canvas: well ? well.still() : null, well, ground: on.id, auto: on.auto, why: on.why, pigments: on.pigments, state: GROUNDS[on.id].state, chain: state.chain, living: state.living, written: state.written, strokes: state.strokes, brush, paint: paintStroke, did, fades: { ...fades }, signal: sig ? { id: sig.id, classes: sig.got.classes, pours: sig.got.pours.length } : null }),
    act, step,
    destroy() { clearInterval(timer); mo?.disconnect(); water.removeEventListener('pointerdown', onDown); water.removeEventListener('pointermove', onMove); water.removeEventListener('pointerup', onUp);
      water.removeEventListener('pointercancel', onUp); water.removeEventListener('keydown', onKey); host.removeEventListener('click', onClick); host.removeEventListener('change', onPick);
      well?.destroy(); host.innerHTML = ''; host.classList.remove('sf-well'); },
  };
}
