import { byId, apply, loadImage, mk, dotCount, pointer } from '../media/index.js';
import { reduced as RM, cover, loop } from './common.js';
import * as A from './balance-art.js';
import { CLAIMS, SOURCES } from './mirror-data.js';
import { sound } from '../media/sound.js';
const snd = sound({ clink: { url: 'assets/audio/clink.opus', gain: 1.118 }, hiss: { url: 'assets/audio/hiss.opus', gain: 0.027 } }); snd.mount(document.querySelector('.top')); snd.bed('hiss', 1);

const $ = id => document.getElementById(id), cv = $('cv'), ctx = cv.getContext('2d'), small = innerWidth < 700, sfx = small ? '-s' : '';
const L = n => loadImage(`assets/img/${n}${sfx}.jpg`);
const [concrete, layers, rust, hessian, ...paper] = await Promise.all(['concrete-worn', 'concrete-layers', 'rust-metal', 'hessian', 'wanted-booth', 'broadside-ballad', 'hohenzollerns', 'wilnaer', 'neratja', 'vrije-woord', 'newspad-vaudeville', 'wanted-stephens', 'wanted-mcdonald'].map(L));
await (document.fonts?.ready || Promise.resolve());
const pt = A.makePatterns(ctx, { concrete, layers, rust, hessian });
const WX0 = -400, WW = 1600, WH = 800, sm = t => t * t * (3 - 2 * t), lerp = (a, b, t) => a + (b - a) * t;
$('sources').innerHTML = SOURCES.map(([t, u]) => `<li><a href="${u}">${t}</a></li>`).join('');

// Background: real broadsides and newspapers, cut and pasted.
const bg = mk(WW, WH), bx = bg.getContext('2d');
[[0, 0, 'wanted-booth'], [1, 1, 'broadside'], [2, 2, 'hohen'], [3, 3, 'wilnaer'], [4, 4, 'neratja'], [5, 5, 'vrije'], [6, 6, 'vaud'], [7, 7, 'stephens'], [8, 8, 'mcd']].forEach(([i, k]) => {
  const w = 230 + (i % 3) * 40, h = 300 + (i % 2) * 50, pad = 24, s = mk(w + pad * 2, h + pad * 2); cover(s.getContext('2d'), paper[i], pad, pad, w, h); const o = mk(s.width, s.height);
  apply(s, [[i % 3 === 0 ? byId.halftone : i % 3 === 1 ? byId.photocopy : byId.newsprint, i % 3 === 0 ? { cell: 5 } : i % 3 === 1 ? { gen: .3 } : { gain: .3, age: .6 }], [byId.cutpaper, { tear: .015, shadow: .7 }]], o, { seed: i + 1 });
  const cx = 70 + (i % 5) * 330 + (i > 4 ? 160 : 0), cy = 130 + Math.floor(i / 5) * 360 + (i % 2) * 40; bx.save(); bx.translate(cx, cy); bx.rotate((i % 5 - 2) * .07); bx.drawImage(o, -o.width / 2, -o.height / 2); bx.fillStyle = 'rgba(232,214,150,.75)'; bx.fillRect(-30, -h / 2 - 6, 64, 18); bx.restore(); });

const ptr = pointer($('stage'), { keys: document.body }); let portrait = false, S = mk(2, 2), sctx = S.getContext('2d'), OUT = mk(2, 2);
const st = { ang: 0, name: 'YOUR PICKS', door: 0, hint: .12, t: 0 }; let shown = false, look = 0, lookT = 0, vel = 0, rot = 0, drop = { i: -1, t0: 0 }, picks = [], revealed = false;
function layout() { portrait = innerWidth < 700; const r = $('stage').getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 2) /* quality pass: was small ? 1.5 : 1.25, backing below DPR (R1) */, w = Math.round(r.width * dpr), h = Math.round((portrait ? r.width * .95 : Math.min(r.width * .5, innerHeight * .62)) * dpr);
  cv.style.height = h / dpr + 'px'; for (const c of [cv, S, OUT, $('dots')]) { c.width = w; c.height = h; } $('dots').style.width = r.width + 'px'; $('dots').style.height = h / dpr + 'px'; }
function view() { const a = cv.width / cv.height, base = portrait ? { h: 640, cx: 250, cy: 380 } : { h: 800, cx: 400, cy: 400 }, und = { h: portrait ? 360 : 330, cx: 185, cy: 440 }, v = sm(look), h = lerp(base.h, und.h, v), cx = lerp(base.cx, und.cx, v), cy = lerp(base.cy, und.cy, v), w = h * a; return { s: cv.height / h, x: cx - w / 2, y: cy - h / 2 }; }
const wpos = () => { const th = st.ang * Math.PI / 180; return [A.P.x - A.ARM * Math.cos(th), A.P.y - A.ARM * Math.sin(th), A.P.x + A.ARM * Math.cos(th), A.P.y + A.ARM * Math.sin(th)]; };

function slips(c, now) {
  const on = picks.filter(p => p.choice !== 'none');
  on.forEach((p, i) => { let y = -9 - i * 16, a = 1; if (drop.i === i && now - drop.t0 < 380) { const k = (now - drop.t0) / 380; y -= (1 - k) * (1 - k) * 160; }
    const hot = revealed && p.choice === 'loud', lift = hot ? Math.min(1, look) * 6 : 0; c.save(); c.translate(0, y - lift); c.rotate(((i * 37) % 7 - 3) * .018); c.fillStyle = hot ? '#e0177e' : '#efe8d6'; c.strokeStyle = '#151515'; c.lineWidth = 2; c.fillRect(-42, -8, 84, 16); c.strokeRect(-42, -8, 84, 16);
    c.fillStyle = hot ? '#fff' : '#151515'; c.font = '800 9px "Hanken Grotesk",sans-serif'; c.textAlign = 'center'; c.fillText(p.claim.short, 0, 3.5); c.restore(); });
}
function world(c, t) {
  const V = view(); c.setTransform(V.s, 0, 0, V.s, -V.x * V.s, -V.y * V.s); const [lx, ly, rx, ry] = wpos();
  c.fillStyle = '#0d4f80'; c.fillRect(WX0, -300, WW, 1400); A.rays(c, '#1aa3e0', '#0a3a66', 28, rot);
  if (look > .01) { c.globalAlpha = sm(look); A.rays(c, '#ffe93a', '#e0177e', 28, -rot * 1.6); c.globalAlpha = 1; }
  c.drawImage(bg, WX0, 0); c.fillStyle = pt.floor; c.fillRect(WX0, 700, WW, 140); c.fillStyle = 'rgba(0,0,0,.4)'; c.fillRect(WX0, 700, WW, 140);
  st.t = t; A.stage(c, pt, st); A.beam(c, pt, st.ang);
  c.save(); c.translate(lx, ly); A.pan(c, pt, true, st); c.save(); c.translate(0, 150); slips(c, performance.now()); c.restore(); c.restore();
  c.save(); c.translate(rx, ry); A.pan(c, pt, false, st); c.save(); c.translate(0, 150); c.fillStyle = '#1d1d20'; c.strokeStyle = pt.brass; c.lineWidth = 3; const p = new Path2D('M-38 0V-16H38V0ZM-28 -16V-34H28V-16ZM-16 -34V-50H16V-34Z'); c.fill(p); c.stroke(p); c.restore(); c.restore();
  c.setTransform(1, 0, 0, 1, 0, 0);
}
function wedge(t) { // one cluster of dots per louder pick, inside the iron chamber under the left pan
  const d = $('dots'), V = view(), [lx, ly] = wpos(), loud = picks.filter(p => p.choice === 'loud'), n = loud.length;
  if (!revealed || look < .5 || !n) { d.getContext('2d').clearRect(0, 0, d.width, d.height); return; }
  const uv = (x, y) => [(x - V.x) * V.s / cv.width, (y - V.y) * V.s / cv.height];
  const cl = loud.map((p, i) => { const f = n === 1 ? .6 : i / (n - 1), [u, v] = uv(lx - 30 + f * 62, ly + 304 - (f * 62 + 8) * .4); return [u, v, .028 + .004 * n, 1]; });
  apply(null, [[byId.dotfield, { mode: 4, clusters: cl, count: small ? 12000 : 30000, size: 1.5, alpha: sm(look), ptr: ptr.arr(), pr: .14 }]], d, { t });
}
function present(t) {
  world(sctx, t); const ch = [[byId.filmburn, { weave: RM ? 0 : .0012, burn: .08 + .4 * sm(look), flicker: RM ? 0 : .08 }]]; if (look > .02) ch.push([byId.crt, { curve: .04 * look, scan: .5 * look, mask: .35 * look, bloom: .6 * look }]);
  apply(S, ch, OUT, { t, seed: 2 }); ctx.clearRect(0, 0, cv.width, cv.height); ctx.drawImage(OUT, 0, 0); wedge(t);
}
function step(dt) { ptr.update(dt); rot += dt * 2; look += (lookT - look) * Math.min(1, dt * 3.5); if (Math.abs(lookT - look) < .002) look = lookT; vel += (-70 * st.ang - 3.2 * vel) * dt; st.ang += vel * dt; if (Math.abs(st.ang) < .02 && Math.abs(vel) < .08) { st.ang = 0; vel = 0; }
  st.door = sm(Math.max(0, Math.min(1, (look - .45) / .55))); st.hint = .15 * (1 - st.door); if (revealed && look > .95 && !shown) showResult(); }

// ---- the interaction ----
const panel = $('panel'); let idx = 0;
function ask() {
  const c = CLAIMS[idx], opts = [{ k: 'careful', t: c.careful }, { k: 'loud', t: c.loud }]; if (Math.random() < .5) opts.reverse();
  panel.innerHTML = `<div class="count">Claim ${idx + 1} of ${CLAIMS.length}</div><h2 id="q" tabindex="-1">${c.topic}</h2><p class="lede">${idx === 0 ? 'Two versions of the same claim. Put the one you would share on the scale. You can leave a claim off.' : 'Which one would you share?'}</p>
  <div class="opts">${opts.map((o, i) => `<button type="button" class="opt" data-k="${o.k}"><b>Version ${'AB'[i]}</b>${o.t}</button>`).join('')}</div><button type="button" class="skip" data-k="none">Share neither</button>
  <p class="src">Source: <a href="${SOURCES[c.src - 1][1]}">${SOURCES[c.src - 1][0]}</a></p>`;
  panel.querySelectorAll('button').forEach(b => b.onclick = () => choose(b.dataset.k));
  if (idx) $('q').focus({ preventScroll: true });
}
function choose(k) {
  const c = CLAIMS[idx]; picks.push({ claim: c, choice: k }); const on = picks.filter(p => p.choice !== 'none').length;
  if (k !== 'none') { snd.once('clink', { rate: .9 + Math.random() * .3 }); drop = { i: on - 1, t0: performance.now() }; vel = RM ? 0 : -9; $('live').textContent = `Slip ${on} placed on the left pan. The arm reads level.`; } else $('live').textContent = 'Left off the scale.';
  idx++; if (RM) present(performance.now() / 1000);
  if (idx < CLAIMS.length) ask(); else { panel.innerHTML = '<p class="lede">The arm reads level. Look under the pan.</p>'; setTimeout(() => { revealed = true; lookT = 1; if (RM) { look = 1; step(.016); present(1); } }, RM ? 0 : 700); }
}
function showResult() {
  shown = true;
  const loud = picks.filter(p => p.choice === 'loud'), none = picks.filter(p => p.choice === 'none').length, n = loud.length;
  const rows = picks.map(p => p.choice === 'loud' ? `<li class="loud"><strong>${p.claim.topic}.</strong> You put the louder version on the pan. <em>Dropped: ${p.claim.dropped}</em></li>` : p.choice === 'careful' ? `<li><strong>${p.claim.topic}.</strong> You put the careful version on the pan. It kept: ${p.claim.dropped.split('.')[0].toLowerCase()}.</li>` : `<li><strong>${p.claim.topic}.</strong> You left it off. It is still moving.</li>`).join('');
  const head = n ? `${n} of the ${CLAIMS.length - none} you weighed ${n === 1 ? 'is' : 'are'} the louder version. ${n === 1 ? 'That is the wedge' : 'Those are the wedge'} under the pan, one cluster of dots for each pick, and each dot is something it dropped.` : `Nothing is propping the pan up. Check what you left off it.`;
  panel.innerHTML = `<div class="result" id="result"><h2 id="rh" tabindex="-1">${head}</h2><ol>${rows}</ol>${none ? `<p class="src">You left ${none} claim${none > 1 ? 's' : ''} off the scale.</p>` : ''}
    <div class="confess"><p>Don&#39;t look at me like that. Mine reads TRUE too. Funny how everybody&#39;s does, huh?</p><small>The author</small></div></div>`;
  $('rh').focus({ preventScroll: true }); $('live').textContent = head + " The author says: Don't look at me like that. Mine reads TRUE too. Funny how everybody's does, huh?";
}
addEventListener('resize', () => { layout(); if (RM) present(1); });
layout(); ask();
if (RM) present(1); else loop($('stage'), (t, dt) => { step(Math.min(dt, .05)); present(t); }, small ? 30 : 45);
window.__mirror = { choose, state: () => ({ idx, n: picks.length, look }) };
