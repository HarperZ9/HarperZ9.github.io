// shader-layers.mjs: the layer stack of the shader room, as data. The room (room-shader.mjs) draws it with
// system/shader-stack.js; this file says what a layer can be, reads and writes it in the address, and writes its row.
//
// A layer is { src, blend, mix, key }. mix runs from 0 to 1, so any other room's output fades in and out of the frame
// continuously instead of switching on and off. key, also 0 to 1, lets the layer's own light decide how much of it lands
// on each pixel (system/shader-stack.js weightOf), so a bright part of a layer can come through while its dark part fades.
// Every source is also an element with properties (propertiesOf): the registry row of the module that makes it. src is one of:
//   s:<id>        one of the room's starts (shader-starts.mjs)
//   p:<name>      a shader from the preset library, by name (the library loads when a link asks for one)
//   palette       the blend's colours, laid as a slow gradient (the blend room's palette)
//   text          the line of text last handed on (the type forge's), lettered across the frame
//   pic:<module>  the picture a module shows as it stands: the well, the pen study, the loom's weave
//
// In the address the stack is ly=<blend>.<mix in hundredths>[-<key in hundredths>].<src>, one per layer, bottom first,
// comma between. The key is left out at 0, so links made before it existed still open.
import { STARTS, startOf } from './shader-starts.mjs';
import { BLENDS, MAX_LAYERS } from '../../../system/shader-stack.js';
import registry from './registry.mjs';

export { BLENDS, MAX_LAYERS };
// The pictures another module can lend a layer, by the module's registry id, in the order the list shows them.
export const PICTURE_MAKERS = Object.freeze([['well', 'The well, as it stands'], ['plot', 'The pen study'], ['loom', 'The loom’s weave']]);
export const PALETTE_GLSL = `// The blend's colours as a slow gradient, the lead colour first. Black until colours are handed in.
void mainImage(out vec4 O, in vec2 U){
  vec2 p = U / iResolution.xy;
  float n = max(iPaletteSize, 1.0);
  float t = clamp(p.x * (n - 1.0) + 0.15 * sin(p.y * 3.0 + iTime * 0.3), 0.0, n - 1.0);
  vec3 c = iPalette[0];
  for (int k = 1; k < 5; k++) if (float(k) < iPaletteSize) c = mix(c, iPalette[k], clamp(t - float(k - 1), 0.0, 1.0));
  O = vec4(iPaletteSize < 1.0 ? vec3(0.0) : c, 1.0);
}`;
export const DEFAULT_LAYER = Object.freeze({ src: 's:interference', blend: 'screen', mix: 0.5, key: 0 });
const BLEND_IDS = new Set(BLENDS.map(([id]) => id));
const MAKERS = new Set(PICTURE_MAKERS.map(([id]) => id));
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const round2 = (v) => Math.round(Math.max(0, Math.min(1, v)) * 100) / 100;

// A source string is kept only if the room can draw it; a preset name is kept as written, since the library may not be loaded yet.
export function validSrc(src) {
  if (src === 'palette' || src === 'text') return true;
  if (src.startsWith('s:')) return !!startOf(src.slice(2));
  if (src.startsWith('pic:')) return MAKERS.has(src.slice(4));
  return src.startsWith('p:') && src.length > 2;
}
export function encodeLayers(layers) {
  if (!layers.length) return null;
  return layers.map((L) => `${L.blend}.${Math.round(round2(L.mix) * 100)}${L.key > 0 ? `-${Math.round(round2(L.key) * 100)}` : ''}.${L.src.startsWith('p:') ? `p:${encodeURIComponent(L.src.slice(2))}` : L.src}`).join(',');
}
export function decodeLayers(text) {
  const out = [];
  for (const part of String(text || '').split(',')) {
    const m = /^([a-z]+)\.(\d{1,3})(?:-(\d{1,3}))?\.(.+)$/.exec(part); if (!m || !BLEND_IDS.has(m[1]) || +m[2] > 100 || +(m[3] || 0) > 100) continue;
    let src = m[4]; if (src.startsWith('p:')) { try { src = `p:${decodeURIComponent(src.slice(2))}`; } catch { continue; } }
    if (!validSrc(src)) continue;
    out.push({ src, blend: m[1], mix: round2(+m[2] / 100), key: round2(+(m[3] || 0) / 100) });
    if (out.length === MAX_LAYERS) break;
  }
  return out;
}
export const wantsLibrary = (layers) => layers.some((L) => L.src.startsWith('p:'));

// What the stack draws for one layer. pictureOf(id) returns a module's canvas or null; textCanvas is the room's lettering.
export function stackLayer(L, { library, pictureOf, textCanvas }) {
  const base = { blend: L.blend, mix: L.mix, key: L.key || 0, props: propertiesOf(L.src) };
  if (L.src === 'palette') return { ...base, kind: 'shader', glsl: PALETTE_GLSL };
  if (L.src === 'text') return { ...base, kind: 'picture', source: () => textCanvas() };
  if (L.src.startsWith('pic:')) { const id = L.src.slice(4); return { ...base, kind: 'picture', source: () => pictureOf(id) }; }
  if (L.src.startsWith('s:')) return { ...base, kind: 'shader', glsl: startOf(L.src.slice(2)).glsl };
  const p = library?.find((x) => x.name === L.src.slice(2));
  return p ? { ...base, kind: 'shader', glsl: p.glsl } : { ...base, kind: 'picture', source: null };
}
// A source as an element: the module that makes it, from the registry (the one table of what each module offers, takes
// and gives), with the medium it arrives as. The room shows these and the stack carries them with the layer.
export function maker(src) {
  if (src === 'palette') return 'blend';
  if (src === 'text') return 'forge';
  if (src.startsWith('pic:')) return src.slice(4);
  return 'shader';
}
export function propertiesOf(src) {
  const id = maker(src), row = registry.SURFACES[id];
  return Object.freeze({ maker: id, name: row?.name || id, medium: src === 'palette' ? 'palette' : src === 'text' ? 'text' : src.startsWith('pic:') ? 'image' : 'shader',
    offers: row ? [...row.offers] : [], gives: row ? [...row.gives] : [] });
}
export function nameOfSrc(src) {
  if (src === 'palette') return 'the blend’s colours';
  if (src === 'text') return 'the handed line, lettered';
  if (src.startsWith('pic:')) return (PICTURE_MAKERS.find(([id]) => id === src.slice(4))?.[1] || src).toLowerCase();
  if (src.startsWith('s:')) return startOf(src.slice(2))?.name || src;
  return src.slice(2);
}

function sourceOptions(L, library) {
  const opt = (v, label) => `<option value="${esc(v)}"${v === L.src ? ' selected' : ''}>${esc(label)}</option>`;
  let html = `<optgroup label="The room’s shaders">${STARTS.map((s) => opt(`s:${s.id}`, s.name)).join('')}</optgroup>`;
  html += `<optgroup label="From the other rooms">${opt('palette', 'The blend’s colours')}${opt('text', 'The handed line, lettered')}${PICTURE_MAKERS.map(([id, label]) => opt(`pic:${id}`, label)).join('')}</optgroup>`;
  if (library) {
    const groups = new Map(); for (const p of library) (groups.get(p.group) ?? groups.set(p.group, []).get(p.group)).push(p);
    html += [...groups].map(([g, list]) => `<optgroup label="${esc(g)}">${list.map((p) => opt(`p:${p.name}`, p.name)).join('')}</optgroup>`).join('');
  } else if (L.src.startsWith('p:')) html += opt(L.src, L.src.slice(2));
  return html;
}
// One row of the layer list. The number is the layer's place: 1 sits on the base shader, the last is on top.
export function layerRow(L, i, n, { library = null, state = '' } = {}) {
  const id = `shd-l${i}`;
  return `<li data-layer="${i}"><p class="shd-l-h">Layer ${i + 1}: <span>${esc(state)}</span></p>
<label for="${id}-src">Source</label><select id="${id}-src" data-l-src="${i}">${sourceOptions(L, library)}</select>
<label for="${id}-blend">Blend</label><select id="${id}-blend" data-l-blend="${i}">${BLENDS.map(([v, label]) => `<option value="${v}"${v === L.blend ? ' selected' : ''}>${label}</option>`).join('')}</select>
<label for="${id}-mix">Mix <output for="${id}-mix">${Math.round(L.mix * 100)}%</output></label><input type="range" id="${id}-mix" data-l-mix="${i}" min="0" max="1" step="0.01" value="${L.mix}">
<label for="${id}-key">Its light decides <output for="${id}-key">${Math.round((L.key || 0) * 100)}%</output></label><input type="range" id="${id}-key" data-l-key="${i}" min="0" max="1" step="0.01" value="${L.key || 0}">
<p class="shd-l-do"><button type="button" data-l-lower="${i}"${i === 0 ? ' disabled' : ''} aria-label="Move layer ${i + 1} down the stack">Lower</button> <button type="button" data-l-raise="${i}"${i === n - 1 ? ' disabled' : ''} aria-label="Move layer ${i + 1} up the stack">Raise</button> <button type="button" data-l-rm="${i}" aria-label="Remove layer ${i + 1}">Remove</button></p></li>`;
}
// Move layer i by d places (-1 lowers it toward the base, +1 raises it), as a new list.
export function moveLayer(layers, i, d) {
  const j = i + d; if (j < 0 || j >= layers.length) return layers;
  const out = [...layers]; [out[i], out[j]] = [out[j], out[i]]; return out;
}
