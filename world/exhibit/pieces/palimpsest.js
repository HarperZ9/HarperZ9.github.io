import { byId, apply, loadImage, loadVideo, mk } from '../media/index.js';
import { reduced as RM, cover, loop } from './common.js';
import { PW, PH, SC, TW, TH, DW, DH, RY0, RY1, ROWS, SLOT_H, TIMER, SANS, MSGS, prep, drawStatic } from './pal-layers.js';
import { createRenderer } from './pal-gl.js';
import { sound } from '../media/sound.js';
const snd = sound({ teletype: { url: 'assets/audio/teletype.opus', gain: 0.227 }, key: { url: 'assets/audio/key.opus', gain: 0.498 }, hiss: { url: 'assets/audio/hiss.opus', gain: 0.027 } }); snd.mount(document.querySelector('.top')); snd.bed('teletype', .5); snd.bed('hiss', 1);

const $ = id => document.getElementById(id), sheet = $('sheet'), small = innerWidth < 700, sfx = small ? '-s' : '';
const L = n => loadImage(`assets/img/${n}${sfx}.jpg`);
const [scan, cajal, cia, telegr, ticker] = await Promise.all(['palimpsest-c', 'cajal-purkinje', 'redacted-cia', 'telegrapher', 'ticker-engr'].map(L));
const S1 = mk(TW, TH), S2 = mk(TW, TH), D = mk(DW, DH), G = mk(DW, DH), V = mk(512, 512), GT = mk(DW, DH);
await (document.fonts?.ready || Promise.resolve());
drawStatic(S1, S2, V, scan);
const gx = prep(G); const R = createRenderer($('gl'), S1, S2, D, V, sheet);
const state = { lx: .3, ly: .18, z: .26, auto: !RM, idle: 0 }, setZ = () => state.z = .06 + .5 * (+$('zr').value / 100); setZ();
const live = $('live'), fx = $('fx'), fctx = fx.getContext('2d');

// ---- messages: a chat that scrolls up, so a new line never lands on an old groove ----
let hold = null, msgs = [], nMsg = 0, clock = 14 * 60 + 2, lastMsg = -99, dirty = true;
const stamp = () => `${Math.floor(clock / 60)}:${String(clock % 60).padStart(2, '0')}`, rowY = r => 12 + r * SLOT_H;
function text(x, m, font, color, chars) { x.font = font; x.fillStyle = color; const t = m.stamp + '   ' + m.text; x.fillText(chars == null ? t : t.slice(0, chars), 56 + m.indent, rowY(m.row) + 26); }
function bakeGhost(m) { const x = gx; x.save(); x.scale(SC, SC); text(x, m, `600 20px ${SANS}`, 'rgba(0,255,0,0.8)'); x.restore(); }
function post(now, instant) {
  GT.getContext('2d').globalCompositeOperation = 'copy'; GT.getContext('2d').drawImage(G, 0, 0);
  gx.globalCompositeOperation = 'copy'; gx.drawImage(GT, 0, -SLOT_H * SC); gx.globalCompositeOperation = 'lighter';
  msgs.forEach(m => m.row--); msgs = msgs.filter(m => m.row >= 0);
  const t = MSGS[nMsg % MSGS.length]; clock += 1 + nMsg % 2;
  msgs.push({ text: t, stamp: stamp(), t0: now, state: instant ? 'live' : 'typing', indent: (nMsg % 2) * 70, row: ROWS - 1, left: TIMER });
  snd.once('key', { rate: .9 + (nMsg % 3) * .1 }); live.textContent = 'New message: ' + t; nMsg++; dirty = true;
}
function drawD(now) {
  const x = prep(D); x.drawImage(G, 0, 0); x.save(); x.scale(SC, SC); const f = `600 20px ${SANS}`;
  for (const m of msgs) {
    const age = (now - m.t0) / 1000;
    if (m.state === 'typing') { const k = Math.min(1, age / .9); text(x, m, f, 'rgb(255,0,0)', Math.floor(k * (m.stamp.length + 3 + m.text.length))); if (k >= 1) { m.state = 'live'; m.t0 = now; } continue; }
    if (m.state === 'live') { const left = RM ? TIMER - 2 - m.row : TIMER - age; m.left = left; if (left <= 0) { m.state = 'scrape'; m.t0 = now; m.sx = 0; } else { text(x, m, f, 'rgb(255,0,0)'); timer(x, m, left); continue; } }
    if (m.state === 'scrape') {
      const p = hold != null ? hold : Math.min(1, (now - m.t0) / 1100), e = p * p * (3 - 2 * p), bx = 40 + m.indent + e * (PW - 60); m.sx = bx; m.p = p;
      x.save(); x.beginPath(); x.rect(bx, 0, PW, DH); x.clip(); text(x, m, f, 'rgb(255,0,0)'); x.restore();
      x.save(); x.beginPath(); x.rect(0, 0, bx, DH); x.clip(); text(x, m, f, 'rgba(0,255,0,0.8)'); x.restore();
      if (p >= 1) { m.state = 'gone'; bakeGhost(m); }
    }
  }
  x.restore(); msgs = msgs.filter(m => m.state !== 'gone');
}
function timer(x, m, left) { const cx = PW - 74, cy = rowY(m.row) + 18, k = Math.max(0, left / TIMER); x.strokeStyle = 'rgb(0,0,255)'; x.lineWidth = 3; x.beginPath(); x.arc(cx, cy, 13, -Math.PI / 2, -Math.PI / 2 + k * 6.2832); x.stroke(); x.fillStyle = 'rgb(0,0,255)'; x.font = `600 12px ${SANS}`; x.textAlign = 'center'; x.fillText(Math.ceil(left), cx, cy + 4.5); x.textAlign = 'left'; }

// ---- scraping blade and shavings, drawn above the relief ----
let shav = [];
function blades(dt) {
  const W = fx.width, H = fx.height; fctx.clearRect(0, 0, W, H); const k = W / PW;
  for (const m of msgs) if (m.state === 'scrape') {
    const px = m.sx * k, py = (RY0 + rowY(m.row) + 20) * k * (H / (PH * k));
    // The erased words leave as dots: the same row, sampled into points that scatter as the blade passes.
    if (!RM) { const sw = fx.width, sh = Math.round(46 * k); m.strip = m.strip || mk(sw, sh); m.sout = m.sout || mk(sw, sh); const sc = m.strip.getContext('2d'); sc.fillStyle = '#fff'; sc.fillRect(0, 0, sw, sh); sc.fillStyle = '#000'; sc.font = `600 ${20 * k}px ${SANS}`; sc.fillText(m.stamp + '   ' + m.text, (56 + m.indent) * k, sh * .68);
      apply(m.strip, [[byId.dotfield, { mode: 0, invert: 1, thresh: .35, dissolve: Math.min(1, (m.p || 0) * 1.1), size: 1.5, alpha: 1, count: 7000, ptr: [Math.min(1, state.lx / .75), (state.ly * fx.height - (py - sh / 2)) / sh, 1], pr: .25 }]], m.sout, { t: performance.now() / 1000 });
      fctx.save(); fctx.beginPath(); fctx.rect(0, py - sh / 2, px, sh); fctx.clip(); fctx.drawImage(m.sout, 0, py - sh / 2); fctx.restore(); }
    fctx.save(); fctx.translate(px, py); fctx.rotate(.12); const h = 44 * k, g = fctx.createLinearGradient(-8, 0, 8, 0); g.addColorStop(0, '#6c7078'); g.addColorStop(.45, '#f1f3f6'); g.addColorStop(.6, '#9aa0aa'); g.addColorStop(1, '#40434a');
    fctx.shadowColor = 'rgba(0,0,0,.55)'; fctx.shadowBlur = 10 * k; fctx.shadowOffsetX = 6 * k; fctx.fillStyle = g; fctx.fillRect(-5 * k, -h / 2, 10 * k, h); fctx.shadowColor = 'transparent';
    fctx.fillStyle = '#e0177e'; fctx.fillRect(-5 * k, -h / 2 - 3 * k, 10 * k, 4 * k); fctx.fillStyle = '#2b2b30'; fctx.fillRect(2 * k, -h / 2 - 40 * k, 14 * k, 40 * k); fctx.restore();
    if (!RM) for (let i = 0; i < 2; i++) shav.push({ x: px, y: py + (Math.random() - .5) * h * .8, vx: 20 + Math.random() * 40, vy: -30 - Math.random() * 40, a: 1, r: (1 + Math.random() * 2.2) * k });
  }
  shav = shav.filter(s => s.a > 0); for (const s of shav) { s.x += s.vx * dt; s.y += s.vy * dt; s.vy += 160 * dt; s.a -= dt * 1.1; fctx.globalAlpha = Math.max(0, s.a); fctx.fillStyle = '#e8d9b0'; fctx.beginPath(); fctx.ellipse(s.x, s.y, s.r * 1.8, s.r * .7, s.x, 0, 7); fctx.fill(); } fctx.globalAlpha = 1;
}

// ---- desk collage (built with the mediums) and the CRT monitor ----
const desk = $('deskc');
function buildDesk() {
  const r = desk.parentElement.getBoundingClientRect(); desk.width = Math.round(r.width); desk.height = Math.round(r.height); const x = desk.getContext('2d'), W = desk.width, H = desk.height, sc = Math.min(1, W / 900);
  const put = (im, w, h, chain, cx, cy, rot, tape) => { const pad = 28, s = mk(w + pad * 2, h + pad * 2); cover(s.getContext('2d'), im, pad, pad, w, h); const o = mk(s.width, s.height); apply(s, chain, o, { seed: cx | 0 });
    x.save(); x.translate(cx, cy); x.rotate(rot); x.drawImage(o, -o.width / 2, -o.height / 2); if (tape) { x.fillStyle = 'rgba(232,214,150,.75)'; x.fillRect(-30, -h / 2 - 8, 70, 18); } x.restore(); };
  x.clearRect(0, 0, W, H);
  put(cajal, 360 * sc, 420 * sc, [[byId.cutpaper, { tear: .014, shadow: .8 }]], W * .1, H * .38, -.09, true);
  put(cia, 330 * sc, 430 * sc, [[byId.photocopy, { gen: .4 }], [byId.cutpaper, { tear: .012, shadow: .8 }]], W * .92, H * .3, .07, true);
  put(telegr, 250 * sc, 310 * sc, [[byId.newsprint, { gain: .4, age: .7 }], [byId.cutpaper, { tear: .014, shadow: .8 }]], W * .93, H * .78, -.06, true);
  put(ticker, 260 * sc, 290 * sc, [[byId.cyanotype, { exposure: .7 }], [byId.cutpaper, { tear: .014, shadow: .8 }]], W * .07, H * .83, .06, false);
}
const mon = $('mon'), monCtx = mon.getContext('2d'), src = mk(320, 240), vid = await loadVideo('assets/film/typewire.mp4');
function monitor(t) { if (!vid) return; cover(src.getContext('2d'), vid, 0, 0, 320, 240); apply(src, [[byId.crt, { curve: .12, scan: .55, mask: .5, bloom: .8 }]], mon, { t, seed: 1 }); }
if (vid && !RM) vid.play().catch(() => {}); else if (vid) vid.currentTime = 4;

// ---- frame loop and input ----
let last = performance.now(), lastD = 0, dirtyView = true;
function frame(now, dt) {
  if (state.auto && !RM) { const t = now / 1000; state.lx = (.5 + .4 * Math.sin(t * .37)) * .75; state.ly = .5 + .42 * Math.sin(t * .23 + 1); state.z = .08 + .3 * (.5 + .5 * Math.sin(t * .31 - 1)); $('zr').value = Math.round((state.z - .06) / .005); dirtyView = true; }
  else if (!RM && state.idle && now - state.idle > 12000) { state.auto = true; state.idle = 0; }
  const ms = now * 1000; if (!RM && now - lastMsg > 3.4) { lastMsg = now; post(ms); }
  const active = msgs.some(m => m.state !== 'live' || !RM);
  if ((active || dirty) && ms - lastD > 50) { drawD(ms); R.uploadD(); lastD = ms; dirty = active; dirtyView = true; }
  placeLamp(); R.render(state); blades(dt); monitor(now);
}
function placeLamp() { const l = $('lamp'); l.style.left = (state.lx / .75 * 100) + '%'; l.style.top = (state.ly * 100) + '%'; }
function relayout() { R.size(); fx.width = Math.round(sheet.getBoundingClientRect().width); fx.height = Math.round(sheet.getBoundingClientRect().height); buildDesk(); kick(); }
(function lamp() { let s = '<circle r="30" fill="#ffe93a" opacity=".25"/>'; for (let i = 0; i < 16; i++) { const a = i / 16 * 6.2832, a2 = a + .2, r1 = i % 2 ? 22 : 30; s += `<path d="M${Math.cos(a) * 12} ${Math.sin(a) * 12}L${Math.cos(a) * r1} ${Math.sin(a) * r1}L${Math.cos(a2) * 12} ${Math.sin(a2) * 12}Z" fill="#ffe93a" stroke="#151515" stroke-width="1"/>`; }
  $('lamp').innerHTML = s + '<circle r="13" fill="#e3262b" stroke="#151515" stroke-width="2"/><circle r="6" fill="#151515"/><circle r="2" cx="-2" cy="-2" fill="#fff"/>'; })();
let kick = () => {};
const kickOnce = () => { drawD(performance.now() * 1); R.uploadD(); placeLamp(); R.render(state); blades(.016); monitor(1); };
function pointerTo(e) { const r = sheet.getBoundingClientRect(); state.lx = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * .75; state.ly = Math.max(0, Math.min(1, (e.clientY - r.top) / r.height)); state.auto = false; state.idle = performance.now(); kick(); }
let drag = false; sheet.addEventListener('pointerdown', e => { drag = true; sheet.setPointerCapture(e.pointerId); pointerTo(e); }); sheet.addEventListener('pointermove', e => { if (drag || e.pointerType === 'mouse') pointerTo(e); }); sheet.addEventListener('pointerup', () => drag = false);
sheet.addEventListener('keydown', e => { const st = e.shiftKey ? .12 : .04, k = e.key; state.auto = false; state.idle = performance.now();
  if (k === 'ArrowLeft') state.lx -= st * .75; else if (k === 'ArrowRight') state.lx += st * .75; else if (k === 'ArrowUp') state.ly -= st; else if (k === 'ArrowDown') state.ly += st; else return;
  state.lx = Math.max(0, Math.min(.75, state.lx)); state.ly = Math.max(0, Math.min(1, state.ly)); e.preventDefault(); kick(); });
$('zr').addEventListener('input', () => { setZ(); state.auto = false; state.idle = performance.now(); kick(); });
$('send').onclick = () => { const n = performance.now(); lastMsg = n / 1000; post(n, RM); kick(); };
$('reset').onclick = () => { state.lx = .3; state.ly = .18; $('zr').value = 40; setZ(); state.auto = false; state.idle = performance.now(); kick(); };
new ResizeObserver(() => relayout()).observe(sheet);
relayout();
if (RM) { for (let i = 0; i < ROWS + 2; i++) post(0, true); msgs.forEach((m, i) => { if (i % 2 === 0) { m.state = 'gone'; bakeGhost(m); } }); msgs = msgs.filter(m => m.state !== 'gone'); kick = () => requestAnimationFrame(() => { kickOnce(); }); kick(); }
else { lastMsg = performance.now() / 1000 - 3; for (let i = 0; i < 3; i++) post(performance.now(), true); loop(sheet, (t, dt) => frame(t, dt), 45); kick = () => {}; }
$('engine').textContent = R.gl ? '' : 'Canvas 2D fallback in use.';
window.__pal = { holdBlade: q => { hold = q; const m = msgs.find(x => x.state === 'live' || x.state === 'scrape'); if (m) { m.state = 'scrape'; m.t0 = performance.now(); } }, scrapeNow: () => { const m = msgs.find(q => q.state === 'live'); if (m) m.t0 -= 20000; }, post: () => post(performance.now(), true), msgs: () => msgs.map(m => m.state + ':' + m.row + ':' + m.text.slice(0, 6)) };
