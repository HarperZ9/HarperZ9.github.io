// room-forge.mjs: the type forge as a room of The Playground (registry row 'forge', anchor #type).
//
// The forge itself is system/type-forge/: mint() draws Zain Mint from six numbers, toTTF() writes the TrueType bytes,
// setText() sets a line in the outlines as SVG. This file is the room around it: the controls, the proof, the two
// files a visitor takes away, the address, and the hand-overs.
//   takes   palette   the blend's colours ink the proof when they can be read on the page; otherwise they rule it
//   gives   text      the visitor's line, which the lettering letters
//           font      the minted face as a .ttf file, made in this tab and saved by the visitor
//           svg       the line set in the minted outlines
// Nothing leaves the tab: the font is built in memory and handed to the browser as a local file.
import { mint, setText } from '../../../system/type-forge/forge.mjs';
import { toTTF } from '../../../system/type-forge/ttf.mjs';

export const KEYS = ['weight', 'contrast', 'width', 'x_height', 'roundness', 'aperture'];
// key: [min, max, step, digits shown, name, default]; the defaults are the forge's own (forge.mjs DEFAULTS)
export const RANGE = { weight: [0.04, 0.2, 0.001, 3, 'Weight', 0.085], contrast: [0.3, 1, 0.01, 2, 'Contrast', 0.82], width: [0.7, 1.4, 0.01, 2, 'Width', 1],
  x_height: [0.4, 0.6, 0.01, 2, 'x-height', 0.5], roundness: [2, 4, 0.05, 2, 'Roundness', 2.4], aperture: [0, 1, 0.01, 2, 'Aperture', 0.6] };
export const TEXT = 'Adhesion, rhythm and 2026 figures.';
const SEED = 58, NAMED = [['Light', 0.058], ['Regular', 0.085], ['Medium', 0.112], ['Bold', 0.145]];
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const clamp = (k, v) => { const [lo, hi, , , , d] = RANGE[k]; return Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d; };

// The still the page is built with, and the reading with scripts off: the face as the forge draws it before any
// change, setting a short line. Coordinates are cut to whole font units to keep the page small.
export function still(text = 'Mint a face.') {
  const face = mint({}, SEED), set = setText(face, text);
  const svg = set.svg.replace('<svg ', `<svg role="img" aria-label="${esc(text)}" `).replace(/ width="\d+" height="\d+"/, '').replace(/(\d+)\.\d/g, '$1');
  return { html: svg, caption: `The type forge: “${text}” set in Zain Mint as the forge draws it before any change, ${Object.keys(face.glyphs).length} glyphs.` };
}

// What the address asks for: tf= the six numbers in KEYS order, caps=runic, line= the text. Out-of-range numbers are clamped.
export function readState(q) {
  const tf = (q.get('tf') || '').split(',').map(Number), state = { caps: q.get('caps') === 'runic' ? 'runic' : '', text: (q.get('line') ?? TEXT).slice(0, 200) };
  KEYS.forEach((k, i) => { state[k] = clamp(k, tf.length === KEYS.length ? tf[i] : NaN); });
  return state;
}
export const writeState = (s) => ({ tf: KEYS.map((k) => +(+s[k]).toFixed(RANGE[k][3])).join(','), caps: s.caps || null, line: s.text === TEXT ? null : s.text });

// WCAG contrast of two #rrggbb colours.
const lum = (hex) => { const n = parseInt(hex.slice(1), 16), f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f((n >> 16) & 255) + 0.7152 * f((n >> 8) & 255) + 0.0722 * f(n & 255); };
export const contrast = (a, b) => { const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05); };
const hexOf = (css) => { const m = /rgba?\((\d+)[, ]+(\d+)[, ]+(\d+)(?:[,/ ]+([\d.]+))?/.exec(css); return m && m[4] !== '0' ? '#' + [m[1], m[2], m[3]].map((v) => (+v).toString(16).padStart(2, '0')).join('') : null; };
function groundOf(el) { for (let e = el; e; e = e.parentElement) { const h = hexOf(getComputedStyle(e).backgroundColor); if (h) return h; } return '#ffffff'; }
const sha256 = async (bytes) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map((b) => b.toString(16).padStart(2, '0')).join('');

export function mount(host, input, ctx) {
  const state = readState(ctx.query || new URLSearchParams()), urls = { ttf: null, svg: null };
  let loaded = null, timer = 0, sendTimer = 0, token = 0, ink = null, face = null;
  host.classList.add('fg');
  host.innerHTML = `<div class="fg-desk">
<div class="fg-proof">
<label for="fg-text">Your text</label>
<textarea id="fg-text" rows="2" spellcheck="false" maxlength="200">${esc(state.text)}</textarea>
<p class="fg-missing" role="status" aria-live="polite"></p>
<p class="fg-sample" translate="no"></p>
<div class="fg-alphabet" translate="no"><p>abcdefghijklmnopqrstuvwxyz</p><p>ABCDEFGHIJKLMNOPQRSTUVWXYZ</p><p>0123456789 . , -</p></div>
<p class="fg-file" role="status" aria-live="polite"></p>
<p class="fg-take"><a class="fg-ttf" download hidden>Save the font (.ttf)</a> <a class="fg-svg" download hidden>Save this line (.svg)</a></p>
<p class="fg-terms">Both files are built in this tab and saved by your browser; nothing is sent anywhere. Zain Mint is unfinished: it covers a to z, A to Z, 0 to 9, the period, the comma and the hyphen, and the family has no release or licence yet, so treat the file as a proof to try.</p>
</div>
<form class="fg-controls" aria-label="Typeface parameters">
<fieldset><legend>Pen</legend>${['weight', 'contrast'].map(slider).join('')}</fieldset>
<fieldset><legend>Proportion</legend>${['width', 'x_height', 'roundness', 'aperture'].map(slider).join('')}</fieldset>
<fieldset><legend>Style</legend><label for="fg-caps">Capitals</label><select id="fg-caps"><option value="">Drawn</option><option value="runic"${state.caps ? ' selected' : ''}>Runic, carved</option></select>
<div class="fg-weights" role="group" aria-label="Named weights">${NAMED.map(([n, w]) => `<button type="button" data-weight="${w}">${n}</button>`).join('')}</div></fieldset>
</form></div>`;
  function slider(k) { const [lo, hi, step, , name] = RANGE[k]; return `<label for="fg-${k}">${name} <output for="fg-${k}"></output></label><input type="range" id="fg-${k}" data-k="${k}" min="${lo}" max="${hi}" step="${step}" value="${state[k]}">`; }
  const $ = (s) => host.querySelector(s), sample = $('.fg-sample'), file = $('.fg-file'), missingEl = $('.fg-missing'), ttf = $('.fg-ttf'), svg = $('.fg-svg');
  const link = (a, key, blob, name) => { if (urls[key]) URL.revokeObjectURL(urls[key]); urls[key] = URL.createObjectURL(blob); a.href = urls[key]; a.download = name; a.hidden = false; };
  const params = () => { const p = {}; for (const k of KEYS) p[k] = +state[k]; if (state.caps) p.style = state.caps; return p; };

  function colour() {
    // the palette inks the proof only where it can be read; a colour too close to the page rules the proof instead
    const ground = groundOf(host), ok = ink && contrast(ink, ground) >= 4.5;
    sample.style.color = ok ? ink : ''; sample.style.borderBottom = ink && !ok ? `0.35rem solid ${ink}` : '';
    host.dataset.ink = ink ? (ok ? 'text' : 'rule') : 'none';
    return ok;
  }
  async function remint() {
    const my = ++token, p = params();
    for (const k of KEYS) $(`output[for="fg-${k}"]`).textContent = (+state[k]).toFixed(RANGE[k][3]);
    sample.textContent = state.text || ' ';
    const made = mint(p, SEED);
    if (made.refused) {
      host.classList.add('fg-refused'); ttf.hidden = svg.hidden = true;
      file.textContent = `Refused, so no file is made and the last face that passed stays greyed: ${made.refusals.join(' ')}`;
      return;
    }
    const bytes = toTTF(made, 'Zain Mint', 'Regular'), sha = await sha256(bytes);
    if (my !== token) return;
    const family = `ZainMint-${sha.slice(0, 12)}`;
    try {
      const ff = new FontFace(family, bytes.buffer, { display: 'block' }); await ff.load();
      if (my !== token) return;
      document.fonts.add(ff); if (loaded && loaded !== ff) document.fonts.delete(loaded); loaded = ff;
    } catch (e) { console.error('forge: the minted font would not load', e); file.textContent = `The browser refused the font: ${e.message}`; return; }
    face = made; host.classList.remove('fg-refused'); host.style.setProperty('--fg-family', `"${family}"`); host.dataset.sha = sha;
    const set = setText(made, state.text);
    missingEl.textContent = set.missing.length ? `Not in the face yet, so shown in the fallback and left out of the SVG: ${set.missing.join(' ')}` : '';
    file.textContent = `Minted ${Object.keys(made.glyphs).length} glyphs and ${Object.keys(made.kerning).length} kerning pairs. The font file is ${bytes.length.toLocaleString('en')} bytes, sha-256 ${sha.slice(0, 16)}.`;
    link(ttf, 'ttf', new Blob([bytes], { type: 'font/ttf' }), `zain-mint-${sha.slice(0, 8)}.ttf`);
    link(svg, 'svg', new Blob([set.svg.replace('<svg ', `<svg color="${colour() ? ink : '#151310'}" `)], { type: 'image/svg+xml' }), `zain-mint-line-${sha.slice(0, 8)}.svg`);
    ctx.address?.(writeState(state));
  }
  const schedule = () => { clearTimeout(timer); timer = setTimeout(() => remint().catch((e) => console.error('forge: mint failed', e)), 60); };
  // the line goes to the other rooms once typing pauses; the recipe is what mints the same face and line again
  const hand = () => { clearTimeout(sendTimer); sendTimer = setTimeout(() => ctx.send?.('text', { text: state.text.trim() }, { recipe: { forge: params(), seed: SEED, text: state.text } }), 400); };

  const onInput = (ev) => {
    const t = ev.target;
    if (t.dataset.k) state[t.dataset.k] = clamp(t.dataset.k, +t.value);
    else if (t.id === 'fg-caps') state.caps = t.value;
    else if (t.id === 'fg-text') { state.text = t.value; hand(); }
    schedule();
  };
  const onClick = (ev) => { const b = ev.target.closest('[data-weight]'); if (!b) return; state.weight = +b.dataset.weight; $('#fg-weight').value = b.dataset.weight; schedule(); };
  const onSubmit = (ev) => ev.preventDefault();
  host.addEventListener('input', onInput); host.addEventListener('click', onClick); host.addEventListener('submit', onSubmit);
  const first = remint().then(() => { if (state.text.trim()) hand(); }).catch((e) => console.error('forge: mint failed', e));

  return {
    ready: first,
    update(next) {
      const env = next?.heard;
      if (env?.medium === 'palette' && /^#[0-9a-f]{6}$/i.test(env.value?.mix || '')) { ink = env.value.mix; colour(); if (face) schedule(); }
    },
    value: () => ({ params: params(), text: state.text, sha256: host.dataset.sha || null, ink: host.dataset.ink || 'none', refused: host.classList.contains('fg-refused') }),
    destroy() {
      clearTimeout(timer); clearTimeout(sendTimer); token++;
      host.removeEventListener('input', onInput); host.removeEventListener('click', onClick); host.removeEventListener('submit', onSubmit);
      for (const k of Object.keys(urls)) if (urls[k]) URL.revokeObjectURL(urls[k]);
      if (loaded) document.fonts.delete(loaded);
      host.innerHTML = ''; host.classList.remove('fg', 'fg-refused'); host.style.removeProperty('--fg-family');
    },
  };
}
