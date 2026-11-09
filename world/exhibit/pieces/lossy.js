// Lossy: a studio portrait is JPEG-compressed again and again, in this browser, at the quality the viewer picks. Then it is hashed.
import { byId, apply, loadImage, mk, pointer } from '../media/index.js';
import { reduced as RM, cover } from './common.js';
import { sound } from '../media/sound.js';

const $ = id => document.getElementById(id), small = innerWidth < 700;
const img = await loadImage('assets/img/girl-studio.jpg', { keep: true }), W = small ? 300 : 420, H = Math.round(W * 1.5);
const snd = sound({ hiss: { url: 'assets/audio/hiss.opus', gain: 0.027 }, key: { url: 'assets/audio/key.opus', gain: 0.498 } }); snd.mount(document.querySelector('.top')); snd.bed('hiss', 1);
const orig = mk(W, H), cur = mk(W, H), diff = mk(W, H); for (const c of [orig, cur, diff]) c.getContext('2d', { willReadFrequently: true });
const A = $('a'), B = $('b'), C = $('c'); for (const c of [A, B, C]) { c.width = W; c.height = H; }
cover(orig.getContext('2d'), img, 0, 0, W, H, .5, .2); A.getContext('2d').drawImage(orig, 0, 0); cur.getContext('2d').drawImage(orig, 0, 0); B.getContext('2d').drawImage(cur, 0, 0);
const ptr = pointer($('heat'), { keys: $('heat') });
let busy = false, gens = 0;
const toHex = b => [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
const hashOf = async c => { const d = c.getContext('2d').getImageData(0, 0, W, H).data; return toHex(await crypto.subtle.digest('SHA-256', d)); };
const jpeg = (c, q) => new Promise(res => c.toBlob(b => { const im = new Image(); im.onload = () => res(im); im.src = URL.createObjectURL(b); }, 'image/jpeg', q));
async function generation(q) { const im = await jpeg(cur, q), x = cur.getContext('2d'); x.clearRect(0, 0, W, H); x.drawImage(im, (gens % 2 ? 1 : -1) * .5, (gens % 3 ? .5 : -.5), W, H); URL.revokeObjectURL(im.src); gens++; }
const grad = c => { const d = c.getContext('2d').getImageData(0, 0, W, H).data, g = new Float32Array(W * H); for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) { const i = (y * W + x) * 4, l = k => d[k] * .3 + d[k + 1] * .59 + d[k + 2] * .11; g[y * W + x] = Math.abs(l(i + 4) - l(i - 4)) + Math.abs(l(i + W * 4) - l(i - W * 4)); } return g; };
function report() {
  const go = grad(orig), gc = grad(cur), blocks = []; for (let by = 0; by < H - 8; by += 8) for (let bx = 0; bx < W - 8; bx += 8) { let eo = 0, ec = 0; for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { eo += go[(by + y) * W + bx + x]; ec += gc[(by + y) * W + bx + x]; } blocks.push([eo, ec]); }
  blocks.sort((a, b) => b[0] - a[0]); const sum = (arr, i) => arr.reduce((s, b) => s + b[i], 0), top = blocks.slice(0, Math.floor(blocks.length * .2)), flat = blocks.slice(Math.floor(blocks.length * .5));
  const kt = Math.round(100 * sum(top, 1) / Math.max(1, sum(top, 0))), kf = Math.round(100 * sum(flat, 1) / Math.max(1, sum(flat, 0)));
  const dx = diff.getContext('2d'), a = orig.getContext('2d').getImageData(0, 0, W, H), b = cur.getContext('2d').getImageData(0, 0, W, H), o = dx.createImageData(W, H);
  for (let i = 0; i < a.data.length; i += 4) { const v = Math.min(255, (Math.abs(a.data[i] - b.data[i]) + Math.abs(a.data[i + 1] - b.data[i + 1]) + Math.abs(a.data[i + 2] - b.data[i + 2])) * 2.2); o.data[i] = o.data[i + 1] = o.data[i + 2] = v; o.data[i + 3] = 255; } dx.putImageData(o, 0, 0);
  $('rep').innerHTML = `After <b>${gens}</b> saves at quality <b>${Math.round(+$('q').value)}</b>, the finest detail kept <b>${kt}%</b> of its edge energy. The flattest half kept <b>${kf}%</b>. The compressor keeps what is cheap to keep. It was not asked what mattered.`;
  $('live').textContent = $('rep').textContent;
}
async function show() { B.getContext('2d').drawImage(cur, 0, 0); report(); drawHeat(performance.now() / 1000); const h1 = await hashOf(orig), h2 = await hashOf(cur); $('h1').textContent = h1; $('h2').textContent = h2; }
function drawHeat(t) { C.getContext('2d').clearRect(0, 0, W, H); apply(diff, [[byId.dotfield, { mode: 0, invert: 0, thresh: .08, mix: 0, size: 1.15, count: small ? 12000 : 26000, ptr: ptr.arr(), pr: .16 }]], C, { t }); }
$('go').onclick = async () => { if (busy) return; busy = true; $('go').disabled = true; const q = +$('q').value / 100, n = +$('n').value; for (let i = 0; i < n; i++) { await generation(q); if (!RM && i % 3 === 0) { B.getContext('2d').drawImage(cur, 0, 0); await new Promise(r => setTimeout(r, 40)); } } snd.once('key'); await show(); busy = false; $('go').disabled = false; };
$('reset').onclick = () => { cur.getContext('2d').clearRect(0, 0, W, H); cur.getContext('2d').drawImage(orig, 0, 0); gens = 0; show(); $('rep').textContent = ''; };
$('q').oninput = () => { $('qv').textContent = $('q').value; }; $('n').oninput = () => { $('nv').textContent = $('n').value; };
['pointermove', 'pointerdown', 'keydown'].forEach(ev => $('heat').addEventListener(ev, () => { if (!RM) drawHeat(performance.now() / 1000); }));
(function tick() { ptr.update(.016); if (ptr.f > .01 && !RM) drawHeat(performance.now() / 1000); requestAnimationFrame(tick); })();
show();
