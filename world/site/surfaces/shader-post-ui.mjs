// shader-post-ui.mjs: the controls of the shader room's picture rack (shader-post.mjs), as HTML and one set of
// handlers. Three racks, each a <details>: the picture (palette, grid, tube), the effects, and the motion (routes and
// feedback). The racks' modules load when one is first opened, or at once when the address already carries rack state.
// Every control here is a studio control of /retro.html with the same range and default; tests/retro-parity.json maps them.
import { PALETTES, DITHERS, MASKS, SLIDERS, MOD_TARGETS, VIBES, postActive } from './shader-post.mjs';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const opt = (list, v) => list.map(([id, label]) => `<option value="${id}"${id === v ? ' selected' : ''}>${esc(label)}</option>`).join('');
const shown = (v, div) => (div ? (v / div).toFixed(2) : String(v));
const slider = (id, label, lo, hi, v, div, extra = '') => `<label for="${id}">${esc(label)} <output for="${id}">${shown(v, div)}</output></label><input type="range" id="${id}" min="${lo}" max="${hi}" step="1" value="${v}"${extra}>`;

export function rackHtml(P) {
  return `<details class="shd-rack" data-rack="picture"><summary>The picture: palette, grid and tube <span class="shd-rack-on"></span></summary><div class="shd-rack-body">
${slider('shd-rt-amount', 'How much of the rack shows', 0, 100, Math.round(P.amount * 100), 100, ' data-post="amount"')}
<p class="shd-rack-say" role="status" aria-live="polite"></p>
<label for="shd-pal">Hardware palette</label><select id="shd-pal" data-post="pal">${opt(PALETTES, P.pal)}</select>
<fieldset class="shd-yours"><legend>Your palette, six colours</legend>${P.yours.map((h, i) => `<input type="color" id="shd-pal-${i}" data-pal="${i}" value="${h}" aria-label="Your colour ${i + 1}">`).join('')}</fieldset>
<p class="shd-strip-row"><span class="shd-strip" aria-hidden="true"></span> <span class="shd-strip-say"></span> <button type="button" id="shd-pal-adopt">Keep these colours as yours</button></p>
${SLIDERS.slice(0, 1).map(([k, label, lo, hi, , div]) => slider(`shd-rt-${k}`, label, lo, hi, P[k], div, ` data-post="${k}"`)).join('')}
<label for="shd-dith">Dither pattern</label><select id="shd-dith" data-post="dith">${opt(DITHERS, P.dith)}</select>
${SLIDERS.slice(1, 4).map(([k, label, lo, hi, , div]) => slider(`shd-rt-${k}`, label, lo, hi, P[k], div, ` data-post="${k}"`)).join('')}
<label for="shd-mask">Phosphor mask</label><select id="shd-mask" data-post="mask">${opt(MASKS, P.mask)}</select>
${SLIDERS.slice(4).map(([k, label, lo, hi, , div]) => slider(`shd-rt-${k}`, label, lo, hi, P[k], div, ` data-post="${k}"`)).join('')}
<p class="shd-check"><input type="checkbox" id="shd-sdf" data-post="sdf"${P.sdf ? ' checked' : ''}> <label for="shd-sdf">Depth shading (early 3D)</label></p>
<p class="shd-measure" role="status"></p>
</div></details>
<details class="shd-rack" data-rack="fx"><summary>Effects <span class="shd-fx-count"></span></summary><div class="shd-rack-body">
${slider('shd-fx-amount', 'Amount of every effect', 0, 100, P.master, 100, ' data-post="master"')}
<label for="shd-fx-seed">Effects seed</label><input type="text" id="shd-fx-seed" data-post="fxseed" value="${esc(P.fxseed)}" spellcheck="false" autocomplete="off">
<p class="shd-check"><input type="checkbox" id="shd-fx-anim" data-post="fxanim"${P.fxanim ? ' checked' : ''}> <label for="shd-fx-anim">The effects move with time</label></p>
<p class="shd-row"><button type="button" id="shd-fx-random">Roll the whole rack</button></p>
<div class="shd-fx-chips"><p>The effects load with this rack.</p></div>
<p class="shd-vibes-h">Starting points</p><p class="shd-vibes">${VIBES.map(([name], i) => `<button type="button" data-vibe="${i}">${esc(name)}</button>`).join(' ')}</p>
<div class="shd-fx-amts"></div>
</div></details>
<details class="shd-rack" data-rack="motion"><summary>Motion: routes and feedback</summary><div class="shd-rack-body">
<p class="shd-rack-note">A route moves one setting with a source (a sound band, a slow wave, the pointer, a knob). The setting keeps its own place underneath.</p>
<label for="shd-mod-src">Source</label><select id="shd-mod-src"></select>
<label for="shd-mod-tgt">Moves</label><select id="shd-mod-tgt">${MOD_TARGETS.map(([k, label]) => `<option value="${k}"${k === P.pending.tgt ? ' selected' : ''}>${esc(label)}</option>`).join('')}</select>
<p class="shd-row"><button type="button" id="shd-mod-add">Route it</button></p>
<ol class="shd-mod-rows"></ol>
<p class="shd-check"><input type="checkbox" id="shd-fb" data-post="fb"${P.fb.on ? ' checked' : ''}> <label for="shd-fb">Video feedback: the last frame folds back</label></p>
<p class="shd-row"><button type="button" id="shd-fb-flush">Flush the feedback</button></p>
${slider('shd-fb-amt', 'How much of the last frame survives', 0, 95, P.fb.amt, 0, ' data-fb="amt"')}
${slider('shd-fb-zoom', 'Zoom each frame, tenths of a percent', -50, 50, P.fb.zoom, 0, ' data-fb="zoom"')}
${slider('shd-fb-rot', 'Turn each frame, tenths of a degree', -30, 30, P.fb.rot, 0, ' data-fb="rot"')}
</div></details>`;
}

// host: the room's element. P: the post state (shader-post.mjs). post: the engine. room: { changed(kind), knobs() }.
export function wireRack(host, P, post, room) {
  const $ = (s) => host.querySelector(s), say = (t) => { const el = $('.shd-rack-say'); if (el) el.textContent = t; };
  let filled = false;
  async function fill() {
    if (filled) return; filled = true;
    try { await post.ready(); } catch { filled = false; say('The picture rack did not load.'); return; }
    $('.shd-fx-chips').innerHTML = [['feel', 'Feel'], ['glitch', 'Glitch'], ['tone', 'Tone']].map(([cat, label]) => `<p class="shd-fx-group"><span>${label}</span> ${post.meta.filter((m) => m.cat === cat)
      .map((m) => `<button type="button" data-fx="${m.op}" aria-pressed="${P.fx.includes(m.op)}" title="${esc(m.desc || '')}" aria-label="${esc(m.label)}${m.desc ? `: ${esc(m.desc)}` : ''}">${esc(m.label)}</button>`).join(' ')}</p>`).join('');
    $('#shd-mod-src').innerHTML = post.sources.map((s) => `<option value="${s.id}"${s.id === P.pending.src ? ' selected' : ''}>${esc(s.label)}</option>`).join('');
    host.dataset.rack = 'ready'; paint(); room.changed('load');
  }
  // the rows that follow the state: the per-effect dials, the routes, the counts
  function paint() {
    const on = post.meta.filter((m) => P.fx.includes(m.op));
    $('.shd-fx-amts').innerHTML = on.map((m) => { const v = Math.round((m.op in P.amts ? P.amts[m.op] : P.master / 100) * 100);
      return `<label for="shd-fx-a-${m.op}">${esc(m.label)} <output for="shd-fx-a-${m.op}">${(v / 100).toFixed(2)}</output></label><input type="range" id="shd-fx-a-${m.op}" data-fx-amt="${m.op}" min="0" max="100" value="${v}" aria-label="${esc(m.label)} amount">`; }).join('');
    for (const b of host.querySelectorAll('[data-fx]')) b.setAttribute('aria-pressed', String(P.fx.includes(b.dataset.fx)));
    $('.shd-fx-count').textContent = P.fx.length ? `${P.fx.length} on` : '';
    $('.shd-rack-on').textContent = P.amount > 0 ? `${Math.round(P.amount * 100)}% in` : 'out';
    const tgt = (k) => MOD_TARGETS.find(([x]) => x === k)?.[1] || k, src = (k) => post.sources.find((s) => s.id === k)?.label || k;
    $('.shd-mod-rows').innerHTML = P.mod.map((r, i) => `<li><label for="shd-mod-d${i}">${esc(src(r.src))} moves ${esc(tgt(r.tgt).toLowerCase())} <output for="shd-mod-d${i}">${Math.round(r.depth * 100)}%</output></label><input type="range" id="shd-mod-d${i}" data-mod-depth="${i}" min="-100" max="100" value="${Math.round(r.depth * 100)}" aria-label="Depth of route ${i + 1}"> <button type="button" data-mod-rm="${i}" aria-label="Remove route ${i + 1}">Remove</button></li>`).join('');
    host.dataset.post = postActive(P) ? 'on' : 'off';
  }
  const out = (el, text) => { const o = host.querySelector(`output[for="${el.id}"]`); if (o) o.textContent = text; };
  // A picture control moved while the rack is out brings the rack in at full, and says so: a change you cannot see is no change.
  function bringIn() {
    if (P.amount > 0) return;
    P.amount = 1; const a = $('#shd-rt-amount'); a.value = '100'; out(a, '1.00');
    say('The rack came in at full so the change shows. Its first slider fades it back out.');
  }
  function setPost(el) {
    const k = el.dataset.post;
    if (k === 'amount') { P.amount = +el.value / 100; out(el, P.amount.toFixed(2)); say(''); return 'picture'; }
    if (k === 'fb') { P.fb.on = el.checked; if (!P.fb.on) post.flush(); return 'fb'; }
    if (k === 'fxseed') { P.fxseed = el.value.slice(0, 40); return 'fx'; }
    if (k === 'fxanim') { P.fxanim = el.checked; return 'fx'; }
    if (k === 'master') { P.master = +el.value; P.amts = {}; out(el, (P.master / 100).toFixed(2)); return 'fx'; }
    if (k === 'sdf') P.sdf = el.checked; else if (el.tagName === 'SELECT') P[k] = el.value;
    else { P[k] = +el.value; const s = SLIDERS.find(([x]) => x === k); out(el, shown(P[k], s?.[5])); }
    bringIn(); return 'picture';
  }
  function onInput(ev) {
    const t = ev.target; if (!t.closest('.shd-rack')) return false;
    let kind = null;
    if (t.dataset.post) kind = setPost(t);
    else if (t.dataset.pal !== undefined) { P.yours[+t.dataset.pal] = t.value.toLowerCase(); post.userPalette(P); if (P.pal !== 'yours') { P.pal = 'yours'; $('#shd-pal').value = 'yours'; } bringIn(); kind = 'picture'; }
    else if (t.dataset.fb) { P.fb[t.dataset.fb] = +t.value; out(t, t.dataset.fb === 'amt' ? String(t.value) : (t.value / 10).toFixed(1)); kind = 'fb'; }
    else if (t.dataset.fxAmt) { P.amts[t.dataset.fxAmt] = +t.value / 100; out(t, (+t.value / 100).toFixed(2)); kind = 'fx'; }
    else if (t.dataset.modDepth) { const r = P.mod[+t.dataset.modDepth]; if (r) { r.depth = +t.value / 100; out(t, `${t.value}%`); kind = 'mod'; } }
    else if (t.id === 'shd-mod-src') { P.pending.src = t.value; kind = 'pending'; }
    else if (t.id === 'shd-mod-tgt') { P.pending.tgt = t.value; kind = 'pending'; }
    if (!kind) return false;
    paint(); room.changed(kind);
    return true;
  }
  function onClick(ev) {
    const b = ev.target.closest('button'); if (!b || !b.closest('.shd-rack')) return false;
    if (b.dataset.fx) { const i = P.fx.indexOf(b.dataset.fx); if (i >= 0) P.fx.splice(i, 1); else P.fx.push(b.dataset.fx); paint(); room.changed('fx'); }
    else if (b.dataset.vibe !== undefined) { const [, ops, amt] = VIBES[+b.dataset.vibe]; P.fx = [...ops]; P.master = amt; P.amts = {}; const m = $('#shd-fx-amount'); m.value = String(amt); out(m, (amt / 100).toFixed(2)); paint(); room.changed('fx'); }
    else if (b.dataset.modRm !== undefined) { P.mod.splice(+b.dataset.modRm, 1); paint(); room.changed('mod'); }
    else if (b.id === 'shd-mod-add') { if (P.mod.length >= 12) say('Twelve routes is the whole rack.'); else { P.mod.push({ src: P.pending.src, tgt: P.pending.tgt, depth: 0.35 }); paint(); room.changed('mod'); } }
    else if (b.id === 'shd-fb-flush') { post.flush(); say(P.fb.on ? 'Feedback flushed: the next frame starts its memory again.' : 'Nothing to flush: feedback is off.'); room.changed('flush'); }
    else if (b.id === 'shd-pal-adopt') adopt();
    else if (b.id === 'shd-fx-random') randomize();
    else return false;
    return true;
  }
  // the colours the last frame resolved to, shown as a strip; Keep copies them into your six, spread across the strip
  let entries = [];
  function strip(m) {
    if (!m?.entries?.length) return; const key = m.entries.join(','); const el = $('.shd-strip'); if (el.dataset.key === key) return;
    el.dataset.key = key; entries = m.entries.slice(); el.innerHTML = entries.map((h) => `<i style="background:${h}" title="${h}"></i>`).join('');
    $('.shd-strip-say').textContent = `${entries.length} colours${P.pal === 'auto' ? ', cut from the picture' : `, from ${PALETTES.find(([id]) => id === P.pal)?.[1] || P.pal}`}.`;
    $('.shd-measure').textContent = `${m.cells.toLocaleString('en')} cells, ${m.colors} colours, ${P.fx.length} effect${P.fx.length === 1 ? '' : 's'}, output ${m.w} by ${m.h}.`;
  }
  function adopt() {
    if (!entries.length) { say('Nothing to keep yet: bring the rack in first.'); return; }
    P.yours = P.yours.map((_, i) => entries[Math.round((i / 5) * (entries.length - 1))]);
    host.querySelectorAll('[data-pal]').forEach((el, i) => { el.value = P.yours[i]; });
    P.pal = 'yours'; $('#shd-pal').value = 'yours'; post.userPalette(P); bringIn(); paint(); say(`Kept ${P.yours.length} colours as yours.`); room.changed('picture');
  }
  // Roll the whole rack, as the studio's Randomize does: palette, grid, tube, dither, mask, seed and a fresh set of effects.
  function randomize() {
    const r = (n) => Math.floor(Math.random() * n), pals = PALETTES.map(([id]) => id).filter((id) => id !== 'yours');
    Object.assign(P, { pal: pals[r(pals.length)], tw: 60 + r(240), curv: r(40), bloom: r(60), vig: r(50), dstr: 50 + r(51), maskA: r(55), hal: r(45), abr: r(35),
      dith: DITHERS[r(DITHERS.length)][0], mask: MASKS[r(MASKS.length)][0], fxseed: Math.random().toString(36).slice(2, 9), amts: {} });
    P.fx = post.meta.filter(() => Math.random() < 0.4).map((m) => m.op);
    sync(); bringIn(); paint(); room.changed('fx');
  }
  // every control back to the state, after a patch, an undo or a roll
  function sync() {
    for (const el of host.querySelectorAll('.shd-rack [data-post]')) {
      const k = el.dataset.post;
      if (k === 'amount') { el.value = String(Math.round(P.amount * 100)); out(el, P.amount.toFixed(2)); }
      else if (k === 'fb') el.checked = P.fb.on; else if (k === 'sdf') el.checked = P.sdf; else if (k === 'fxanim') el.checked = P.fxanim;
      else if (k === 'fxseed') el.value = P.fxseed; else if (k === 'master') { el.value = String(P.master); out(el, (P.master / 100).toFixed(2)); }
      else { el.value = String(P[k]); if (el.type === 'range') out(el, shown(P[k], SLIDERS.find(([x]) => x === k)?.[5])); }
    }
    host.querySelectorAll('[data-pal]').forEach((el, i) => { el.value = P.yours[i]; });
    for (const el of host.querySelectorAll('[data-fb]')) { el.value = String(P.fb[el.dataset.fb]); out(el, el.dataset.fb === 'amt' ? String(P.fb.amt) : (P.fb[el.dataset.fb] / 10).toFixed(1)); }
    if (filled) paint();
  }
  const onToggle = (ev) => { if (ev.target.matches?.('.shd-rack') && ev.target.open) fill(); };
  return { onInput, onClick, onToggle, fill, sync, strip, randomize, paint: () => filled && paint(), get filled() { return filled; } };
}
