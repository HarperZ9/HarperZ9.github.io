// surface-well.mjs: the well as a surface. mount(host, { elements, weights, settings }, ctx).
// The visitor acts on the water: drag to stir, press to pour, arrow keys to tilt, Space to pour in the middle,
// 0 to level, 1 to 4 to choose which element pours. Plain view and a browser without WebGL get the same
// elements as named colour samples, and nothing that moves.
import { createWell } from './well.mjs';
import { driveFor } from './elements-data.mjs';
import { hexToOk } from '../../studio/lib/blend.mjs';
import { GROUND } from './charts.mjs';

let wells = 0;
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function mount(host, input, ctx) {
  const { ix } = ctx;
  let state = { ...input }, slot = 0, well = null, down = null;
  const how = `sf-well-how-${++wells}`;
  host.classList.add('sf-well');
  host.innerHTML = `<div class="sf-water" tabindex="0" role="application" aria-roledescription="well" aria-describedby="${how}"><canvas></canvas></div>
    <p class="sf-how" id="${how}">Drag to stir. Press to pour. Arrow keys tilt the water, Space pours, 0 levels it.</p>
    <div class="sf-acts"><span class="sf-slots" role="radiogroup" aria-label="Which element pours"></span>
    <button type="button" data-act="level">Level</button><button type="button" data-act="again">Start again</button></div>
    <ul class="sf-still" hidden></ul>`;
  const water = host.querySelector('.sf-water'), canvas = host.querySelector('canvas'), slots = host.querySelector('.sf-slots'), still = host.querySelector('.sf-still');
  const parts = () => state.elements.map((id) => ix.byId.get(id)).filter(Boolean).slice(0, 4);
  // measured links, either way, as a strength from 0 to 1 between every two parts; linkScale lets a check switch them off
  const link = (a, b) => Math.min(1, Math.max(a.links.find((l) => l.to === b.id)?.weight ?? 0, b.links.find((l) => l.to === a.id)?.weight ?? 0) / 100) * (state.linkScale ?? 1);
  const toWell = () => parts().map((e, i, P) => ({ links: P.map((o) => (o === e ? 0 : link(e, o))), ok: hexToOk(e.colour?.hex || '#8a8a8a'), weight: Math.max(0.02, +(state.weights?.[i] ?? 1) || 0), drive: driveFor(ix, e, state.settings?.[e.id]).shader }));

  if (!ctx.plain) { try { well = createWell(canvas, { reduced: ctx.reduced, ground: hexToOk(GROUND) }); } catch (e) { console.info('well: no drawing surface here, the samples stand in:', e.message); } }
  if (!well) { water.hidden = true; host.querySelector('.sf-how').hidden = true; host.querySelector('.sf-acts').hidden = true; still.hidden = false; }

  function paint(reseed) {
    const P = parts();
    slot = Math.min(slot, Math.max(0, P.length - 1));
    water.setAttribute('aria-label', `The well, holding ${P.map((e) => e.name).join(', ') || 'nothing'}`);
    slots.hidden = P.length < 2;
    slots.innerHTML = P.map((e, i) => `<button type="button" role="radio" aria-checked="${i === slot}" data-slot="${i}"><i style="background:${esc(e.colour?.hex)}"></i>${esc(e.name)}</button>`).join('');
    still.innerHTML = P.map((e) => `<li><i style="background:${esc(e.colour?.hex)}"></i>${esc(e.name)} <span>${esc(e.colour?.hex)}</span></li>`).join('');
    well?.set(toWell(), { reseed });
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
  water.addEventListener('pointerdown', onDown); water.addEventListener('pointermove', onMove);
  water.addEventListener('pointerup', onUp); water.addEventListener('pointercancel', onUp);
  water.addEventListener('keydown', onKey); host.addEventListener('click', onClick);
  paint(true);

  return {
    // same elements in the same order: only how they are drawn changes, and the water keeps what the visitor did
    update(next) { const same = next.elements && next.elements.join() === state.elements.join() && (next.weights || []).join() === (state.weights || []).join() && (next.linkScale ?? state.linkScale) === state.linkScale;
      state = { ...state, ...next }; paint(!same); },
    value: () => ({ canvas: well ? well.still() : null, well }),
    destroy() { water.removeEventListener('pointerdown', onDown); water.removeEventListener('pointermove', onMove); water.removeEventListener('pointerup', onUp);
      water.removeEventListener('pointercancel', onUp); water.removeEventListener('keydown', onKey); host.removeEventListener('click', onClick);
      well?.destroy(); host.innerHTML = ''; host.classList.remove('sf-well'); },
  };
}
