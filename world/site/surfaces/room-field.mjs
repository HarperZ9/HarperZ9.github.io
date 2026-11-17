// room-field.mjs: the field on The Playground (registry row 'field', anchor #field). There are no rooms in it: light,
// flow, measurement, shape, voice, territory and circuitry are properties, and every element on the page can carry
// every one of them at a weight from 0 to 1. Where a lens meets moving water the light bends by both at once.
//
// The scene is world-field.mjs, built in superframe (packages/world) from the packages' own cores and carried here
// unchanged (world-field.vendored.json pins it). field-draw.mjs draws it. This file is the page around it: who is
// chosen, the weights, moving things, the readings, the words, the address and the hand-overs.
//   takes  palette  the blend's colours: its mix colours the dye
//   gives  numbers  the readings and the dimensions, after a change
//          image    the picture as it stands
// Reduced motion: the scene settles first and stays still; every control still works and redraws once per change.
import { createScene, DEFAULTS, PROPERTY_IDS, PROPERTIES } from './world-field.mjs';
import { VIEW, COLOURS, paintGround, marks, drawMarks, stillSvg } from './field-draw.mjs';

export const SETTLE = 90;   // steps run before the first picture, so the dye has spread and the wave has crossed
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const pct = (w) => `${Math.round(w * 100)} percent`;
const IDS = DEFAULTS.map((d) => d.id);

// The address: fw= every element's weights, element by element in IDS order, properties in PROPERTY_IDS order, 0 to 100;
// fe= the chosen element. A link opens the same field.
export function readState(q) {
  const raw = (q.get('fw') || '').split(',').map(Number), ok = raw.length === IDS.length * PROPERTY_IDS.length && raw.every((v) => v >= 0 && v <= 100);
  const weights = Object.fromEntries(IDS.map((id, e) => [id, Object.fromEntries(PROPERTY_IDS.map((p, i) => [p, ok ? raw[e * PROPERTY_IDS.length + i] / 100 : (DEFAULTS[e].carries[p] ?? 0)]))]));
  return { weights, chosen: IDS.includes(q.get('fe')) ? q.get('fe') : 'water' };
}
export const writeState = (scene, chosen) => ({ fw: IDS.map((id) => PROPERTY_IDS.map((p) => Math.round(scene.elements.find((e) => e.id === id).carries[p] * 100)).join(',')).join(','), fe: chosen === 'water' ? null : chosen });

export function settled(state = readState(new URLSearchParams())) {
  const s = createScene();
  for (const id of IDS) s.set(id, { carries: state.weights[id] });
  for (let i = 0; i < SETTLE; i++) s.step();
  return s;
}

export function still() {
  const s = settled(), rays = s.trace(), d = s.dims();
  return { html: stillSvg(s, rays, d, s.describe()), caption: `The field as it stands after ${SETTLE} steps: ${rays.length} rays of light bent by a Luneburg glass and by stirred water, the water dimensioned, the probe reading it. ${s.read().readings.filter((q) => q.show).length} readings, every one simulated.` };
}

function desk(chosen) {
  const who = IDS.filter((id) => id !== 'ground').concat('ground').map((id) => `<label class="fd-pick"><input type="radio" name="fd-who" value="${id}"${id === chosen ? ' checked' : ''}><i style="background:${COLOURS[id]}"></i>${esc(DEFAULTS.find((d) => d.id === id).name)}</label>`).join('');
  const props = PROPERTY_IDS.map((p) => `<label class="fd-w"><span>${esc(PROPERTIES[p].name)}</span><input type="range" min="0" max="100" step="1" data-p="${p}"><output></output></label>`).join('');
  return `<div class="fd-stage"><canvas class="fd-canvas" width="${VIEW.w}" height="${VIEW.h}" tabindex="0" role="img" aria-describedby="fd-said" aria-keyshortcuts="ArrowLeft ArrowRight ArrowUp ArrowDown"></canvas>
<p class="fd-said" id="fd-said"></p><p class="sr-only" role="status" aria-live="polite" data-fd-tell></p></div>
<div class="fd-desk"><fieldset class="fd-who"><legend>Element</legend>${who}</fieldset>
<fieldset class="fd-props"><legend data-fd-legend></legend>${props}</fieldset>
<p class="fd-move">Move the chosen element with the arrow keys while the picture has focus (Shift moves farther), or drag it. <span data-fd-where></span></p>
<p><button type="button" class="fd-run" aria-pressed="false"></button></p>
<h3>Readings</h3><dl class="fd-read"></dl><p class="fd-state"></p>
<h3>Dimensions</h3><p class="fd-dims"></p><p class="fd-frame"></p></div>`;
}

export function mount(host, input, ctx) {
  const state = readState(ctx.query || new URLSearchParams()), scene = settled(state), dark = () => { const t = document.documentElement.dataset.theme; return t ? t === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches; };
  let chosen = state.chosen, running = !ctx.reduced, dye = COLOURS.water, raf = 0, dirty = true, lastWords = 0, tellTimer = 0, sendTimer = 0, drag = null;
  host.classList.add('fd'); host.innerHTML = desk(chosen);
  const $ = (q) => host.querySelector(q), canvas = $('.fd-canvas'), g2 = canvas.getContext('2d'), PW = 200, PH = 120;
  const off = typeof OffscreenCanvas === 'function' ? new OffscreenCanvas(PW, PH) : Object.assign(document.createElement('canvas'), { width: PW, height: PH });
  const og = off.getContext('2d'), img = og.createImageData(PW, PH);
  if (ctx.plain) { running = false; canvas.hidden = true; }   // plain view: the words and the numbers, nothing drawn
  const times = { scene: [], draw: [] }, el = () => scene.elements.find((e) => e.id === chosen);
  let rays = scene.trace(), dims = scene.dims();

  function controls() {
    $('[data-fd-legend]').textContent = `What ${el().name.toLowerCase()} carries`;
    for (const r of host.querySelectorAll('input[data-p]')) { const w = el().carries[r.dataset.p]; r.value = Math.round(w * 100); r.nextElementSibling.textContent = `${r.value}%`; r.setAttribute('aria-valuetext', `${PROPERTIES[r.dataset.p].name} ${pct(w)}`); }
    $('[data-fd-where]').textContent = `${el().name} is at ${Math.round(el().x * 100)} mm across and ${Math.round(el().y * 100)} mm down.`;
    $('.fd-run').textContent = running ? 'Hold still' : 'Let it move'; $('.fd-run').setAttribute('aria-pressed', String(!running));
  }
  function words(now, force = false) {
    if (!force && now - lastWords < 2000) return;   // the words change at most every 2 s
    lastWords = now;
    const said = scene.describe(), r = scene.read();
    $('#fd-said').textContent = said; canvas.setAttribute('aria-label', `The field. ${said}`);
    $('.fd-read').innerHTML = r.readings.filter((q) => q.show).map((q) => `<dt>${esc(q.name)}</dt><dd>${esc(q.text)}</dd>`).join('') || '<dt>Nothing</dt><dd>no element carries measurement</dd>';
    $('.fd-state').textContent = r.instrument ? `Instrument state: ${r.label} Simulated, not a measured part.` : r.label;
    $('.fd-dims').textContent = dims ? `${dims.major.label} ${dims.major.text}, ${dims.minor.label} ${dims.minor.text}, carried area ${Math.round(dims.area)} mm squared. Toleranced by the CAD rule: no dimension without one.` : 'Nothing carries shape, so nothing is dimensioned.';
    const med = (a) => (a.length ? [...a].sort((x, y) => x - y)[a.length >> 1] : 0);
    if (times.scene.length > 10) $('.fd-frame').textContent = `Frame: scene ${med(times.scene).toFixed(1)} ms and drawing ${med(times.draw).toFixed(1)} ms, medians over the last ${times.scene.length} frames in this browser.`;
  }
  function draw() {
    const t0 = performance.now();
    paintGround(img.data, PW, PH, scene, { dark: dark(), dye }); og.putImageData(img, 0, 0);
    g2.imageSmoothingEnabled = true; g2.drawImage(off, 0, 0, VIEW.w, VIEW.h);
    drawMarks(g2, marks(scene, rays, dims, chosen), { dark: dark() });
    return performance.now() - t0;
  }
  const keep = (a, v) => { a.push(v); if (a.length > 120) a.shift(); };
  function frame(now) {
    raf = 0;
    if (running || dirty) {
      const t0 = performance.now();
      if (running) scene.step(); else scene.field();
      rays = scene.trace(); dims = scene.dims();
      const t1 = performance.now(); keep(times.scene, t1 - t0); keep(times.draw, draw());
      words(now, dirty && !running); dirty = false;
    }
    if (running) raf = requestAnimationFrame(frame);
  }
  const kick = () => { dirty = true; if (!raf) raf = requestAnimationFrame(frame); };
  const tell = (text) => { clearTimeout(tellTimer); tellTimer = setTimeout(() => { $('[data-fd-tell]').textContent = text; }, 700); };
  const changed = (what) => {
    controls(); kick(); tell(what); ctx.address?.(writeState(scene, chosen));
    clearTimeout(sendTimer); sendTimer = setTimeout(() => ctx.send?.('numbers', { readings: scene.read().readings.map(({ id, value, unit }) => ({ id, value, unit })), dims: dims?.dims ?? [] }, { recipe: writeState(scene, chosen) }), 500);
  };

  const onInput = (ev) => {
    const r = ev.target.closest('input[data-p]');
    if (r) { scene.set(chosen, { carries: { [r.dataset.p]: +r.value / 100 } }); return changed(`${el().name} carries ${PROPERTIES[r.dataset.p].name.toLowerCase()} at ${r.value} percent.`); }
    const who = ev.target.closest('input[name="fd-who"]');
    if (who) { chosen = who.value; changed(`${el().name} chosen.`); }
  };
  const move = (dx, dy) => { const e = el(); scene.set(chosen, { x: Math.min(2, Math.max(0, e.x + dx)), y: Math.min(1.2, Math.max(0, e.y + dy)) }); changed(`${e.name} moved to ${Math.round(e.x * 100)} mm across, ${Math.round(e.y * 100)} mm down.`); };
  const onKey = (ev) => { const k = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[ev.key]; if (!k) return; ev.preventDefault(); const s = ev.shiftKey ? 0.1 : 0.02; move(k[0] * s, k[1] * s); };
  const at = (ev) => { const b = canvas.getBoundingClientRect(); return [((ev.clientX - b.left) / b.width) * 2, ((ev.clientY - b.top) / b.height) * 1.2]; };
  const onDown = (ev) => {
    const [x, y] = at(ev), hit = scene.elements.filter((e) => e.id !== 'ground' && Math.hypot(e.x - x, e.y - y) < e.radius + e.edge).sort((a, b) => a.radius - b.radius)[0];
    if (!hit) return; chosen = hit.id; host.querySelector(`input[value="${hit.id}"]`).checked = true; drag = [x - hit.x, y - hit.y]; canvas.setPointerCapture(ev.pointerId); controls(); kick();
  };
  const onMove = (ev) => { if (!drag) return; const [x, y] = at(ev); scene.set(chosen, { x: Math.min(2, Math.max(0, x - drag[0])), y: Math.min(1.2, Math.max(0, y - drag[1])) }); kick(); };
  const onUp = () => { if (drag) { drag = null; changed(`${el().name} placed at ${Math.round(el().x * 100)} mm across, ${Math.round(el().y * 100)} mm down.`); } };
  const onRun = () => { running = !running; controls(); kick(); tell(running ? 'The field moves.' : 'The field holds still.'); };
  host.addEventListener('input', onInput); host.addEventListener('change', onInput); canvas.addEventListener('keydown', onKey);
  canvas.addEventListener('pointerdown', onDown); canvas.addEventListener('pointermove', onMove); canvas.addEventListener('pointerup', onUp); $('.fd-run').addEventListener('click', onRun);
  ctx.offerPicture?.(() => canvas);
  window.__field = { scene, times, get running() { return running; } };
  controls(); words(performance.now(), true); kick();
  return {
    update(next) { const env = next?.heard; if (env?.medium === 'palette' && env.value) { dye = env.value.mix || env.value.ink || dye; kick(); } },
    value: () => ({ weights: writeState(scene, chosen).fw, chosen, running, description: scene.describe(), readings: scene.read().readings, dims: dims?.dims ?? [] }),
    destroy() { cancelAnimationFrame(raf); clearTimeout(tellTimer); clearTimeout(sendTimer); ctx.offerPicture?.(null); host.innerHTML = ''; host.classList.remove('fd'); delete window.__field; },
  };
}
