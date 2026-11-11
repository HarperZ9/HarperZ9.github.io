// surface-well.mjs: the well as a surface. mount(host, { elements, weights, settings, ground }, ctx).
// The visitor acts on the well: drag to stir, press to pour, arrow keys to tilt, Space to pour in the middle,
// 0 to level, 1 to 4 to choose which pigment pours. The ground is a medium (grounds.mjs). Unless the visitor
// chooses one, it follows the blend: the first material in it that has a ground becomes the ground and the rest
// are the pigments on it; with none, paper by day and water by night. The control says which and why, and
// ctx.onGround(id or null) tells the page. Plain view and a browser without WebGL get the same elements as named
// colour samples, and nothing that moves.
import { createWell } from './well.mjs';
import { driveFor } from './elements-data.mjs';
import { GROUNDS, RULES, groundFor, isNight } from './grounds.mjs';
import { hexToOk } from '../../studio/lib/blend.mjs';

let wells = 0;
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const GROUPS = [...new Set(Object.values(GROUNDS).map((g) => g.group))];

export function mount(host, input, ctx) {
  const { ix } = ctx;
  let state = { ...input, ground: input.ground ?? null }, slot = 0, well = null, down = null, on = null;
  const how = `sf-well-how-${++wells}`;
  host.classList.add('sf-well');
  host.innerHTML = `<div class="sf-water" tabindex="0" role="application" aria-roledescription="well" aria-describedby="${how}"><canvas></canvas></div>
    <p class="sf-how" id="${how}">Drag to stir. Press to pour. Arrow keys tilt the well, Space pours, 0 levels it.</p>
    <div class="sf-acts"><span class="sf-slots" role="radiogroup" aria-label="Which pigment pours"></span>
    <button type="button" data-act="level">Level</button><button type="button" data-act="again">Start again</button>
    <label class="sf-ground">Ground <select data-ground><option value="">follow the blend</option>${GROUPS.map((gr) => `<optgroup label="${esc(gr)}">${Object.entries(GROUNDS).filter(([, g]) => g.group === gr).map(([id, g]) => `<option value="${esc(id)}">${esc(g.name)}</option>`).join('')}</optgroup>`).join('')}</select></label></div>
    <p class="sf-why" role="status"></p>
    <ul class="sf-still" hidden></ul>`;
  const water = host.querySelector('.sf-water'), canvas = host.querySelector('canvas'), slots = host.querySelector('.sf-slots'), still = host.querySelector('.sf-still'), pick = host.querySelector('[data-ground]'), why = host.querySelector('.sf-why');
  const all = () => state.elements.map((id) => ix.byId.get(id)).filter(Boolean).slice(0, 4);
  // the pigments: every chosen element except the one that became the ground
  const parts = () => all().filter((e) => on.pigments.includes(e.id));
  // measured links, either way, as a strength from 0 to 1 between every two parts; linkScale lets a check switch them off
  const link = (a, b) => Math.min(1, Math.max(a.links.find((l) => l.to === b.id)?.weight ?? 0, b.links.find((l) => l.to === a.id)?.weight ?? 0) / 100) * (state.linkScale ?? 1);
  const toWell = () => parts().map((e, i, P) => ({ links: P.map((o) => (o === e ? 0 : link(e, o))), ok: hexToOk(e.colour?.hex || '#8a8a8a'), weight: Math.max(0.02, +(state.weights?.[state.elements.indexOf(e.id)] ?? 1) || 0), drive: driveFor(ix, e, state.settings?.[e.id]).shader }));

  if (!ctx.plain) { try { well = createWell(canvas, { reduced: ctx.reduced }); } catch (e) { console.info('well: no drawing surface here, the samples stand in:', e.message); } }
  if (!well) { water.hidden = true; host.querySelector('.sf-how').hidden = true; host.querySelector('.sf-acts').hidden = true; still.hidden = false; }

  function paint(reseed) {
    const was = on; on = groundFor(ix, state.elements, state.ground, isNight());
    const P = parts(), g = GROUNDS[on.id], moved = !was || was.id !== on.id || was.pigments.join() !== on.pigments.join();
    slot = Math.min(slot, Math.max(0, P.length - 1));
    water.setAttribute('aria-label', `The well: ${P.map((e) => e.name).join(', ') || 'nothing'} on ${g.name}`); water.dataset.ground = on.id;
    slots.hidden = P.length < 2;
    slots.innerHTML = P.map((e, i) => `<button type="button" role="radio" aria-checked="${i === slot}" data-slot="${i}"><i style="background:${esc(e.colour?.hex)}"></i>${esc(e.name)}</button>`).join('');
    still.innerHTML = P.map((e) => `<li><i style="background:${esc(e.colour?.hex)}"></i>${esc(e.name)} <span>${esc(e.colour?.hex)}</span></li>`).join('') + `<li>on ${esc(g.name)}</li>`;
    pick.value = on.auto ? '' : on.id;
    why.innerHTML = `On <b>${esc(g.name)}</b>: ${esc(on.why)}. <small>Here colours combine as ${esc(RULES[g.rule].word)}. Computed.</small>`;
    well?.ground(on.id); well?.set(toWell(), { reseed: reseed || (moved && was && was.pigments.join() !== on.pigments.join()) });
  }
  const at = (ev) => { const r = canvas.getBoundingClientRect(); return [(ev.clientX - r.left) / r.width, (ev.clientY - r.top) / r.height]; };
  const onDown = (ev) => { if (!well) return; const [x, y] = at(ev); down = { x, y, t: ev.timeStamp }; water.setPointerCapture?.(ev.pointerId); well.pour(slot, x, y, 0.35); };
  const onMove = (ev) => { if (!well || !down) return; const [x, y] = at(ev), dt = Math.max(8, ev.timeStamp - down.t) / 1000;
    well.stir(x, y, (x - down.x) / dt * 0.9, (y - down.y) / dt * 0.9); down = { x, y, t: ev.timeStamp }; };
  const onUp = () => { down = null; };
  let tx = 0, ty = 0;
  const onKey = (ev) => {
    if (!well) return;
    const k = ev.key, step = { ArrowLeft: [-0.5, 0], ArrowRight: [0.5, 0], ArrowUp: [0, -0.5], ArrowDown: [0, 0.5] }[k];
    if (step) { tx = Math.max(-1, Math.min(1, tx + step[0])); ty = Math.max(-1, Math.min(1, ty + step[1])); well.tilt(tx, ty); }
    else if (k === ' ' || k === 'Enter') well.pour(slot, 0.5, 0.5, 0.5);
    else if (k === '0' || k === 'Escape') { tx = ty = 0; well.tilt(0, 0); }
    else if (/^[1-4]$/.test(k) && +k <= parts().length) { slot = +k - 1; paint(false); }
    else return;
    ev.preventDefault();
  };
  const onClick = (ev) => {
    const s = ev.target.closest('[data-slot]'), a = ev.target.closest('[data-act]');
    if (s) { slot = +s.dataset.slot; paint(false); }
    else if (a?.dataset.act === 'level') { tx = ty = 0; well?.tilt(0, 0); }
    else if (a?.dataset.act === 'again') { tx = ty = 0; well?.tilt(0, 0); well?.reset(); }
  };
  const onPick = () => { state.ground = pick.value || null; paint(false); ctx.onGround?.(state.ground); };
  // the page turning from day to night moves a ground that follows the page
  const mo = typeof MutationObserver === 'function' ? new MutationObserver(() => { if (!state.ground) paint(false); }) : null;
  mo?.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  water.addEventListener('pointerdown', onDown); water.addEventListener('pointermove', onMove);
  water.addEventListener('pointerup', onUp); water.addEventListener('pointercancel', onUp);
  water.addEventListener('keydown', onKey); host.addEventListener('click', onClick); pick.addEventListener('change', onPick);
  paint(true);

  return {
    // same elements in the same order: only how they are drawn changes, and the well keeps what the visitor did
    update(next) { const same = next.elements && next.elements.join() === state.elements.join() && (next.weights || []).join() === (state.weights || []).join() && (next.linkScale ?? state.linkScale) === state.linkScale;
      state = { ...state, ...next }; paint(!same); },
    value: () => ({ canvas: well ? well.still() : null, well, ground: on.id, auto: on.auto, why: on.why, pigments: on.pigments }),
    destroy() { mo?.disconnect(); water.removeEventListener('pointerdown', onDown); water.removeEventListener('pointermove', onMove); water.removeEventListener('pointerup', onUp);
      water.removeEventListener('pointercancel', onUp); water.removeEventListener('keydown', onKey); host.removeEventListener('click', onClick); pick.removeEventListener('change', onPick);
      well?.destroy(); host.innerHTML = ''; host.classList.remove('sf-well'); },
  };
}
