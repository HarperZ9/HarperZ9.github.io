// shader-text.mjs: the shader room's words and address helpers: what a shader can read (INPUTS), the source in the
// address (encodeSource, decodeSource), compile errors by line (errorsOf), the knobs from the address and the still.
import { STARTS } from './shader-starts.mjs';

export const SIZE = [640, 400], LIBRARY = '/system/shader-presets.js';
// What a shader in this room can read, and where each value comes from. The page shows this list as written.
export const INPUTS = Object.freeze([
  ['iResolution', 'vec3', 'the frame in pixels'], ['iTime', 'float', 'seconds since the shader started'], ['iFrame', 'int', 'frames drawn'],
  ['iMouse', 'vec4', 'the pointer over the frame in pixels; z is 1 while pressed'],
  ['iKnobA, iKnobB, iKnobC', 'float', 'the three sliders, 0 to 1'],
  ['iPalette[5], iPaletteSize', 'vec3, float', 'colours handed in by the blend, the lead first, and how many are set'],
  ['iChannel0, iChannelResolution', 'sampler2D, vec3', 'a picture handed in by another module, and its size'],
  ['iAudio', 'vec4', 'bass, mid, treble and level of the music in the sound room while it plays, each 0 to 1; zero while it is silent'],
]);
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const b64 = (bytes) => { let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000)); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
const unb64 = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
const pipe = async (bytes, stream) => new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(stream)).arrayBuffer());

// The source in the address: "z." and the deflated text where the browser can deflate, "b." and the plain text where
// it cannot, both in URL-safe base64. A link made in one browser opens in any other that can inflate.
export async function encodeSource(text) {
  const raw = new TextEncoder().encode(text);
  if (typeof CompressionStream === 'function') { try { return 'z.' + b64(await pipe(raw, new CompressionStream('deflate-raw'))); } catch { /* fall through to the plain form */ } }
  return 'b.' + b64(raw);
}
export async function decodeSource(packed) {
  try {
    const kind = packed.slice(0, 2), bytes = unb64(packed.slice(2));
    if (kind === 'b.') return new TextDecoder().decode(bytes);
    if (kind === 'z.' && typeof DecompressionStream === 'function') return new TextDecoder().decode(await pipe(bytes, new DecompressionStream('deflate-raw')));
  } catch { /* a damaged link opens the first start instead */ }
  return null;
}
// The runner's error text is "line N: message" per line; this gives [{ line, message }], in order, without repeats.
export function errorsOf(text) {
  const out = [], seen = new Set();
  for (const row of String(text || '').split('\n')) { const m = /line (\d+):\s*(.*)$/.exec(row); const e = m ? { line: +m[1], message: m[2].trim() } : (row.trim() ? { line: 0, message: row.trim() } : null);
    if (e && !seen.has(`${e.line}|${e.message}`)) { seen.add(`${e.line}|${e.message}`); out.push(e); } }
  return out;
}
export const knobsOf = (q) => { const k = (q.get('k') || '').split(',').map(Number); return k.length === 3 && k.every((v) => v >= 0 && v <= 1) ? k : [0.5, 0.5, 0.5]; };

// The still the page is built with, and the reading with scripts off: the first shader as written.
export function still() {
  const s = STARTS[0];
  return { html: `<pre class="shd-still" tabindex="0" aria-label="The first shader, as written"><code>${esc(s.glsl)}</code></pre>`, caption: `The shader room: “${s.name}”, the shader the room opens with, as written. ${s.glsl.split('\n').length} lines of GLSL.` };
}
