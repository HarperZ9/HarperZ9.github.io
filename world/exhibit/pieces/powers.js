import { byId, apply, loadImage, mk, backend, dotCount, pointer } from '../media/index.js';
import { reduced as RM } from './common.js';
import { buildLevels } from './powers-art.js';
import { sound } from '../media/sound.js';
const snd = sound({ projector: { url: 'assets/audio/projector.opus', gain: 0.126 }, teletype: { url: 'assets/audio/teletype.opus', gain: 0.254 }, hiss: { url: 'assets/audio/hiss.opus', gain: 0.027 } }); snd.mount(document.querySelector('.top')); snd.bed('projector', 1); snd.bed('hiss', 1);

const $ = id => document.getElementById(id), small = innerWidth < 700, sfx = small ? '-s' : '';
const names = { im: ['preanger', 'neratja', 'operator', 'barclay', 'telegrapher', 'wanted-mcdonald', 'wanted-booth', 'hohenzollerns', 'broadside-ballad', 'wanted-evans', 'wanted-stephens', 'broadside-tragical', 'newspad-vaudeville', 'vrije-woord', 'wilnaer', 'ticker-room', 'blue-marble', 'black-marble'] };
const key = n => n.replace(/-(\w)/g, (_, c) => c.toUpperCase());
const loaded = await Promise.all(names.im.map(n => loadImage(`assets/img/${n}${sfx}.jpg`)));
const I = Object.fromEntries(names.im.map((n, i) => [key(n), loaded[i]])); names.im.forEach((n, i) => { I[n] = loaded[i]; });
await (document.fonts?.ready || Promise.resolve());
const TS = small ? 900 : 1400, LV = buildLevels(I, TS);
const KS = [-1, 0, 1, 2, 3, 4, 5], NAMES = { '-1': 'the words that were cut', 0: 'one post', 1: 'a thread', 2: 'the reposters', 3: 'an outlet', 4: 'the attention market', 5: 'server halls' };
// One medium per level: the material the message travels on at that scale.
const LOOK = { '-1': () => [[byId.photocopy, { gen: .3 }]], 0: () => [[byId.crt, { curve: .06, scan: .35, mask: .3, bloom: .5 }]], 1: () => [[byId.halftone, { cell: 4 }]], 2: () => [[byId.riso, { misreg: .006, grain: .25, dropout: .15 }]], 3: () => [[byId.filmburn, { weave: .002, burn: .3, flicker: .15 }]], 4: () => [[byId.vhs, { tracking: .35, bleed: .45, noise: .2 }]], 5: () => [[byId.crt, { curve: .1, scan: .45, mask: .4, bloom: .8 }]] };
const ptr = pointer($('cvwrap'), { keys: $('art') }), track = $('track'), cv = $('z'), ctx = cv.getContext('2d'), dots = $('dots'), N = 11;
const S = mk(2, 2), OA = mk(2, 2), OB = mk(2, 2), sx = S.getContext('2d');
let size = 0, target = 0, cur = 0, raf = 0, lastLabel = null, idleT;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), stepPx = () => Math.max(1, (track.offsetHeight - innerHeight) / N), uOf = p => p <= 10 ? 5 - Math.abs(p - 5) : 10 - p;
const dotsEl = $('dotsbar'); dotsEl.innerHTML = Array.from({ length: N + 1 }, () => '<i></i>').join('');

function fit() { const b = $('cvwrap').getBoundingClientRect(); size = Math.max(200, Math.floor(Math.min(b.width, b.height))); const dpr = Math.min(devicePixelRatio || 1, 2) /* quality pass: was small ? 1.5 : 1.25, backing below DPR (R1) */, px = Math.round(size * dpr);
  for (const c of [cv, dots, S, OA, OB]) { c.width = px; c.height = px; } cv.style.width = dots.style.width = size + 'px'; cv.style.height = dots.style.height = size + 'px'; }
function compose(u) { // draw the levels into S, highest first
  const px = S.width, sc = px / 1000; sx.setTransform(1, 0, 0, 1, 0, 0); sx.fillStyle = '#111'; sx.fillRect(0, 0, px, px);
  for (const k of [...KS].reverse()) { const d = k - u; if (!(d < .999 && d >= -2.3 && (k !== -1 || cur > 9.2))) continue; sx.save(); sx.translate(px / 2, px / 2); sx.rotate(RM ? 0 : d * .157); const s = Math.pow(10, d) * sc * 1000 / TS; sx.scale(s, s); sx.drawImage(LV[k], -TS / 2, -TS / 2);
    sx.lineWidth = 4 / s; sx.strokeStyle = '#f6e08a'; sx.strokeRect(-TS / 2, -TS / 2, TS, TS); sx.restore(); }
}
const uu0 = u => Math.max(0, 1 - Math.abs(u - 3.5) / 1.8);
function render(t = 0) {
  const u = uOf(cur), inb = clamp((cur - 5) / .6, 0, 1), lvl = Math.round(u), frac = u - lvl; compose(u);
  const a = LOOK[clamp(lvl, -1, 5)](), nb = clamp(lvl + (frac >= 0 ? 1 : -1), -1, 5), mixB = Math.abs(frac) * 2 * (nb !== lvl ? 1 : 0), mid = Math.sin(Math.PI * clamp(Math.abs(frac) * 2, 0, 1));
  apply(S, a, OA, { t, seed: 3 + lvl }); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.drawImage(OA, 0, 0);
  if (mixB > .02) { apply(S, LOOK[nb](), OB, { t, seed: 4 + nb }); ctx.globalAlpha = Math.min(1, mixB * .8); ctx.drawImage(OB, 0, 0); ctx.globalAlpha = 1; }
  // Each world dissolves into dots between scales and re-forms as the next.
  ptr.update(.016); const dctx = dots.getContext('2d'); if (ptr.f > .02 && mid <= .04 && !RM) { cv.style.opacity = 1; apply(S, [[byId.dotfield, { mode: 0, mix: .5, size: 1.2, only: 1, ptr: [ptr.x * 1, ptr.y * 1, ptr.f], pr: .22, count: small ? 14000 : 30000 }]], dots, { t }); }
  else if (mid > .04 && !RM) { cv.style.opacity = 1 - .8 * mid; apply(S, [[byId.dotfield, { mode: 0, mix: .6, dissolve: mid * mid, size: 1.25, alpha: 1, ptr: [ptr.x, ptr.y, ptr.f], pr: .2, count: small ? 14000 : 26000 }]], dots, { t }); dots.style.opacity = 1; }
  else { cv.style.opacity = 1; dctx.clearRect(0, 0, dots.width, dots.height); }
  snd.bed('teletype', uu0(u));
  const n = Math.round(cur), uu = Math.round(u), dir = cur > 5 ? 'in' : 'out', lab = n + '|' + uu;
  if (lab !== lastLabel) { lastLabel = lab; $('exp').innerHTML = `10<sup>${uu < 0 ? '−' + Math.abs(uu) : uu}</sup>`; $('nm').textContent = NAMES[uu] + (n === 0 || n === 11 || n === 5 ? '' : dir === 'in' ? ', going in' : ', going out'); dotsEl.querySelectorAll('i').forEach((e, i) => e.classList.toggle('on', i <= n)); $('live').textContent = `Scale ten to the ${uu}: ${NAMES[uu]}.`; }
}
function loop(now) { raf = 0; cur = RM ? target : cur + (target - cur) * .14; if (Math.abs(target - cur) < .0008) cur = target; render(now / 1000); if (cur !== target || ptr.f > .01 || ptr.tf || (!RM && cur > 4.4 && cur < 6.6)) raf = requestAnimationFrame(loop); }
const kick = () => { if (!raf) raf = requestAnimationFrame(loop); };
['pointermove', 'pointerdown', 'keydown'].forEach(ev => $('art').addEventListener(ev, kick));
const goStep = n => scrollTo({ top: clamp(n, 0, N) * stepPx(), behavior: RM ? 'auto' : 'smooth' });
addEventListener('scroll', () => { target = clamp(scrollY / stepPx(), 0, N); kick(); clearTimeout(idleT); idleT = setTimeout(() => { const n = Math.round(target); if (Math.abs(target - n) > .01) goStep(n); }, 200); }, { passive: true });
addEventListener('resize', () => { fit(); target = clamp(scrollY / stepPx(), 0, N); kick(); });
$('prev').onclick = () => goStep(Math.round(target) - 1); $('next').onclick = () => goStep(Math.round(target) + 1);
addEventListener('keydown', e => { if (e.target.closest && e.target.closest('button, a, input')) return; const k = e.key, fwd = ['ArrowDown', 'ArrowRight', 'PageDown', ' '].includes(k), back = ['ArrowUp', 'ArrowLeft', 'PageUp'].includes(k);
  if (fwd) goStep(Math.round(target) + 1); else if (back) goStep(Math.round(target) - 1); else if (k === 'Home') goStep(0); else if (k === 'End') goStep(N); else return; e.preventDefault(); });
fit(); target = clamp(scrollY / stepPx(), 0, N); cur = target; render(1);
window.__powers = { go: n => { target = cur = n; render(1.3); }, goMid: n => { target = cur = n; render(1.3); } };
