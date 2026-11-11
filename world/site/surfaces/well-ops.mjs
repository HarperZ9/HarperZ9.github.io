// well-ops.mjs: what a visitor can do to the well's ground, read from the state table (states.mjs), and the words the
// page says about it. Pure: no page, runs in node and the browser. surface-well.mjs draws these and acts on them.
//
//   current(ground, chain)     the material the ground shows now: the end of the chain, else the ground's own material
//   opsFor(ground, chain)      heat, cool and grind always, and soak, press and dry where the table has them: each with
//                              where it leads, or why it leads nowhere
//   advance(ground, chain, op) the chain and the ground after one operation, or null
//   jump(chainId, step)        the chain and the ground at a step of a made thing's chain
//   opsHTML, chainsHTML, livingHTML   the controls;  stateWords, didWords   what the page says, labelled computed
//   signalHTML(id, got)        the controls for a picture from a silent signal (signal.mjs), and what the page says of it
//   livingPart(id)             a living pigment as a part the well can carry: PROPOSED colour and strength, not measured
//   letterMask(glyph, lines, w, h)    words set by the lettering library, as a coverage mask for well.write()
import { MATERIALS, STATES, CHAINS, DONE, OP_RULE, LIVING, apply, materialOf, replay, tell, walk } from './states.mjs';
import { GROUNDS, RULES } from './grounds.mjs';
import { SIGNALS, NAMES } from './signal.mjs';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const cap = (s) => s[0].toUpperCase() + s.slice(1);
export const OP_NAME = Object.freeze({ heat: 'Heat', cool: 'Cool', grind: 'Grind', dissolve: 'Soak in water', press: 'Press', dry: 'Dry' });
export const FRONT_WORD = Object.freeze({ heat: 'from the bottom up', cool: 'from the edges in', dry: 'from the edges in', grind: 'from left to right', dissolve: 'from the top down', press: 'from the middle out' });
export const SECONDS = 9;   // how long a front takes to cross the well
// Fading in light. PROPOSED: the table says only fast or slow. The seconds are ours, so the order can be seen; no rate is measured.
export const FADE_SECONDS = Object.freeze({ fast: 40, slow: 160 });

export const validChain = (c) => !!(c && MATERIALS[c.from] && Array.isArray(c.ops) && replay(c.from, c.ops));
export function current(ground, chain) { return validChain(chain) ? replay(chain.from, chain.ops).at(-1) : materialOf(ground); }

export function opsFor(ground, chain = null) {
  const m = current(ground, chain), row = MATERIALS[m];
  return ['heat', 'cool', 'grind', 'dissolve', 'press', 'dry'].filter((op) => ['heat', 'cool', 'grind'].includes(op) || row?.to[op]).map((op) => {
    const to = row ? apply(m, op) : null, g = to ? MATERIALS[to].ground : null;
    const why = !row ? `${GROUNDS[ground]?.name ?? ground} has no row in the state table yet` : !to ? `the table has no ${op} for ${row.name}` : !g ? `${MATERIALS[to].name} has no ground built yet` : `${row.name} becomes ${MATERIALS[to].name}`;
    return { op, to, ground: g, ok: !!g, why };
  });
}
export function advance(ground, chain, op, of = null) {
  const m = current(ground, chain), to = MATERIALS[m] ? apply(m, op) : null, g = to ? MATERIALS[to].ground : null;
  if (!g) return null;
  const base = validChain(chain) ? chain : { from: m, ops: [], of };
  return { ground: g, from: m, to, chain: { from: base.from, ops: [...base.ops, op], of: base.of ?? null } };
}
export function jump(chainId, step) {
  const c = CHAINS[chainId], path = c ? walk(c) : null; if (!path || !(step >= 0 && step < path.length) || !MATERIALS[path[step]].ground) return null;
  return { ground: MATERIALS[path[step]].ground, chain: { from: c.from, ops: c.steps.slice(0, step), of: null } };
}

// Every operation has a home: all six are always drawn, in one order, and the ones the table has no move for are disabled
// with the reason, so nothing moves when the ground changes.
export function opsHTML(ground, chain, busy = false) {
  const have = opsFor(ground, chain), m = MATERIALS[current(ground, chain)];
  return Object.keys(OP_NAME).map((op) => have.find((o) => o.op === op) ?? { op, ok: false, why: m ? `the table has no ${op} for ${m.name}` : `${GROUNDS[ground]?.name ?? ground} has no row in the state table yet` }).map((o) => `<button type="button" data-op="${o.op}"${o.ok && !busy ? '' : ' disabled'} title="${esc(cap(o.why))}">${OP_NAME[o.op]}<span class="sr-only">: ${esc(o.why)}</span></button>`).join('');
}
// Each made thing as steps to walk: the step the ground is on is marked, and each step is a button.
export function chainsHTML(ground, chain) {
  const now = current(ground, chain);
  return Object.entries(CHAINS).map(([id, c]) => { const path = walk(c), at = validChain(chain) && chain.from === c.from && chain.ops.join() === c.steps.slice(0, chain.ops.length).join() ? chain.ops.length : path.indexOf(now);
    return `<li><span class="sf-chain-name">${esc(cap(MATERIALS[id].name))}</span><ol aria-label="${esc(cap(MATERIALS[id].name))}: ${esc(c.says)}">${path.map((m, i) => `<li>${i ? `<i aria-hidden="true">${esc(DONE[c.steps[i - 1]])}</i>` : ''}<button type="button" data-chain="${esc(id)}" data-step="${i}"${i === at ? ' aria-current="step"' : ''}${MATERIALS[m].ground ? '' : ' disabled'}>${esc(MATERIALS[m].name)}</button></li>`).join('')}</ol></li>`; }).join('');
}
export function stateWords(ground, chain) {
  const g = GROUNDS[ground], st = STATES[g.state], path = validChain(chain) && chain.ops.length ? tell(chain.from, chain.ops) : '';
  return `${st ? `State: <b>${esc(g.state)}</b>. A ${esc(g.state)} ${esc(st.holds)}. ` : ''}${path ? `Chain so far: ${esc(path)}. ` : ''}Here colours combine as ${esc(RULES[g.rule].word)}. Computed.`;
}
export function didWords(from, to, op, reduced = false) {
  return `${cap(MATERIALS[from].name)} was ${DONE[op]} and became ${MATERIALS[to].name}: ${OP_RULE[op]}. ${reduced ? 'With reduced motion the change is shown whole, at once.' : `The change crossed the well ${FRONT_WORD[op]}.`} The amount of each pigment is kept through it. Computed by the bench's state table, not measured.`;
}

export function livingHTML(chosen = [], full = false, light = false) {
  return `<p class="sf-living-h">Pigments from living things <small>proposed, not measured</small></p><div class="sf-living-picks">${Object.entries(LIVING).map(([id, p]) => `<button type="button" data-living="${esc(id)}" aria-pressed="${chosen.includes(id)}"${!chosen.includes(id) && full ? ' disabled' : ''}><i style="background:${esc(p.hex)}"></i>${esc(p.name)}</button>`).join('')}</div>` +
    (chosen.length ? `<ul class="sf-living-notes">${chosen.map((id) => { const p = LIVING[id]; return `<li><b>${esc(cap(p.name))}.</b> ${esc(p.made)} Its colour here is a guess, ${esc(p.label)}. What would settle it: ${esc(p.settle)}.</li>`; }).join('')}</ul>
      <label class="sf-light"><input type="checkbox" data-light${light ? ' checked' : ''}> Leave it in the light</label><p class="sf-fade" role="status"></p>` : '');
}
// A picture from a signal: the buttons, and what the page says once one has been poured. Nothing is played.
export function signalHTML(id = null, got = null) {
  return `<p class="sf-living-h">A picture from a signal <small>proposed mapping, no sound is made</small></p><div class="sf-living-picks">${Object.entries(SIGNALS).map(([k, s]) => `<button type="button" data-signal="${k}" aria-pressed="${k === id}">${esc(cap(s.name))}</button>`).join('')}${id ? '<button type="button" data-signal="">Back to the blend</button>' : ''}</div>` +
    (id && got ? `<p class="sf-signal">${esc(cap(SIGNALS[id].name))}: ${esc(SIGNALS[id].says)}. The signal is a list of numbers made on this page and is never played. Its strongest notes became the pigments (${esc(got.classes.map((c) => NAMES[c]).join(', '))}), each note a hue; its loudness set how much was poured, from left to right as the signal runs; its noisiness (${got.noisy.toFixed(2)} on a scale of 0 to 1) set the roughness. Computed by a proposed rule, not measured.</p>` : '');
}
// A living pigment as a part. `like` is a drive for an element with nothing measured (the table's medians); the
// proposed strength stands in for coverage and the proposed transparency sets the opacity.
export function livingPart(id, like, hexToOk) {
  const p = LIVING[id]; if (!p) return null;
  return { id, living: true, name: p.name, ok: hexToOk(p.hex), weight: 1, links: [], fade: 0, rate: p.fade, drive: { ...like, coverage: p.strength, opacity: Math.min(0.92, 1 - p.transparency) } };
}

// Words as a coverage mask, w by h, one line per entry, set by the lettering library's own raster (its face and spacing).
export function letterMask(glyph, lines, w = 640, h = 480) {
  const mask = new Float32Array(w * h), rs = lines.slice(0, 4).map((t) => glyph.rasterText(t, { size: 96, weight: 700, pad: 0.06 }));
  const tall = rs.reduce((s, r) => s + r.h, 0), wide = Math.max(...rs.map((r) => r.w)), k = Math.min(0.86 * w / wide, 0.8 * h / tall); let y0 = (h - tall * k) / 2;
  for (const r of rs) { const x0 = (w - r.w * k) / 2;
    for (let y = Math.max(0, Math.floor(y0)); y < Math.min(h, y0 + r.h * k); y++) for (let x = Math.max(0, Math.floor(x0)); x < Math.min(w, x0 + r.w * k); x++) {
      const sx = Math.min(r.w - 1, Math.max(0, Math.round((x - x0) / k))), sy = Math.min(r.h - 1, Math.max(0, Math.round((y - y0) / k))); mask[y * w + x] = Math.max(mask[y * w + x], r.mask[sy * r.w + sx]); }
    y0 += r.h * k; }
  return mask;
}
