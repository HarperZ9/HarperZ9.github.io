// The test that wasn't: a capture-the-flag network on blueprint paper, and one node that is a real repository, drawn warm and human.
// The agent's dot cloud keeps re-labelling it "simulated" until the viewer pins the label. Pointer attention bends the cloud.
import { byId, apply, loadImage, mk, pointer, rng } from '../media/index.js';
import { reduced as RM, cover, loop } from './common.js';
import { sound } from '../media/sound.js';

const $ = id => document.getElementById(id), small = innerWidth < 700, stage = $('stage'), bp = $('bp'), dots = $('dots'), card = $('card');
const photo = await loadImage(`assets/img/${small ? 'brisbane-family-s' : 'brisbane-family'}.jpg`);
const snd = sound({ key: { url: 'assets/audio/key.opus', gain: 0.498 }, teletype: { url: 'assets/audio/teletype.opus', gain: 0.166 }, hiss: { url: 'assets/audio/hiss.opus', gain: 0.027 } }); snd.mount(document.querySelector('.top')); snd.bed('hiss', 1);
const ptr = pointer(stage, { keys: $('pin') });
const NODES = [['gateway', .1, .5], ['web-01', .28, .22], ['web-02', .28, .78], ['app', .46, .5], ['db', .66, .2], ['files', .66, .8], ['flag.txt', .9, .5]], REAL = [.7, .5];
const LINKS = [[0, 1], [0, 2], [1, 3], [2, 3], [3, 4], [3, 5], [4, 6], [5, 6]];
let W = 800, H = 520; const st = { pinned: false, relabels: 0, vis: 0, label: 'simulated', t0: 0, at: 0 };
function build() {
  const r = stage.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 2) /* quality pass: was 1.5, backing below DPR (R1) */; W = Math.round(r.width * dpr); H = Math.round(Math.min(r.width * .66, innerHeight * .75) * dpr); for (const c of [bp, dots]) { c.width = W; c.height = H; } bp.style.height = dots.style.height = H / dpr + 'px'; stage.style.height = H / dpr + 'px';
  const d = mk(W, H), x = d.getContext('2d'); x.fillStyle = '#000'; x.fillRect(0, 0, W, H); x.strokeStyle = '#fff'; x.fillStyle = '#fff'; x.lineWidth = Math.max(2, W / 360); x.font = `700 ${Math.max(14, W / 56)}px "Hanken Grotesk",sans-serif`; x.textAlign = 'center';
  LINKS.forEach(([a, b]) => { x.beginPath(); x.moveTo(NODES[a][1] * W, NODES[a][2] * H); x.lineTo(NODES[b][1] * W, NODES[b][2] * H); x.stroke(); });
  NODES.forEach(([n, nx, ny]) => { const w = W * .09, h = H * .09; x.fillStyle = '#000'; x.fillRect(nx * W - w / 2, ny * H - h / 2, w, h); x.strokeRect(nx * W - w / 2, ny * H - h / 2, w, h); x.fillStyle = '#fff'; x.fillText(n, nx * W, ny * H + 5); });
  x.setLineDash([8, 8]); x.beginPath(); x.moveTo(NODES[3][1] * W, NODES[3][2] * H); x.lineTo(REAL[0] * W, REAL[1] * H); x.stroke();
  apply(d, [[byId.blueprint, { diazo: 0, grid: .6, hatch: .2 }]], bp, { seed: 2 }); const bx = bp.getContext('2d'); bx.font = `800 ${Math.max(15, W / 54)}px "Hanken Grotesk",sans-serif`; bx.textAlign = 'center'; NODES.forEach(([n, nx, ny]) => { const w = W * .09, h = H * .09; bx.fillStyle = '#0d2a5a'; bx.fillRect(nx * W - w / 2 + 3, ny * H - h / 2 + 3, w - 6, h - 6); bx.fillStyle = '#eaf6ff'; bx.fillText(n, nx * W, ny * H + 5); });
  // the real node: a drawn repository card on a warm Polaroid, with a family photograph pinned to it
  const cw = Math.round(W * .2), ch = Math.round(cw * 1.2), src = mk(cw, ch), s = src.getContext('2d'); s.fillStyle = '#efe5d0'; s.fillRect(0, 0, cw, ch); cover(s, photo, cw * .08, ch * .08, cw * .84, ch * .5, .5, .35);
  s.fillStyle = '#2b2118'; s.font = `800 ${cw * .09}px "Hanken Grotesk",sans-serif`; s.textAlign = 'left'; s.fillText('example-repo', cw * .08, ch * .72); s.font = `500 ${cw * .065}px "Hanken Grotesk",sans-serif`; s.fillStyle = '#6b5a45'; s.fillText('invented example', cw * .08, ch * .81); s.fillText('real people behind it', cw * .08, ch * .9);
  card.width = cw; card.height = ch; apply(src, [[byId.polaroid, { lift: .1, fade: .35 }]], card, { seed: 5 }); card.style.width = (cw / dpr) + 'px'; card.style.left = (REAL[0] * 100) + '%'; card.style.top = (REAL[1] * 100) + '%';
}
const rr = rng(8); let agent = { x: .1, y: .5, tx: .1, ty: .5 };
function setLabel(txt) { st.label = txt; $('tag').textContent = txt.toUpperCase(); $('tag').classList.toggle('real', txt === 'real'); }
function tick(t, dt) {
  ptr.update(dt);
  st.at += dt; const stops = [...NODES.map(n => [n[1], n[2], 'node']), [REAL[0] - .02, REAL[1], 'real']], period = 1.6;
  if (st.at > period) { st.at = 0; st.vis = (st.vis + 1) % stops.length; const s = stops[st.vis]; agent.tx = s[0]; agent.ty = s[1]; st.where = s[2];
    if (s[2] === 'real') { if (!st.pinned) { setLabel('real?'); st.t0 = t; } else { setLabel('real'); } }
  }
  if (st.label === 'real?' && t - st.t0 > .7 && !st.pinned) { setLabel('simulated'); st.relabels++; $('count').textContent = `Re-labelled ${st.relabels} time${st.relabels > 1 ? 's' : ''}.`; snd.once('key', { rate: 1.1 }); if (st.relabels % 3 === 1) $('live').textContent = `The agent re-labelled the real repository as simulated, ${st.relabels} times.`; }
  agent.x += (agent.tx - agent.x) * Math.min(1, dt * 3); agent.y += (agent.ty - agent.y) * Math.min(1, dt * 3);
  const cl = [[agent.x, agent.y, .1, 1], [agent.x + .03 * Math.sin(t * 2), agent.y + .03 * Math.cos(t * 1.7), .06, .8], [REAL[0], REAL[1] + .02, .07, st.pinned ? .0 : .9]];
  apply(null, [[byId.dotfield, { mode: 4, clusters: cl, count: small ? 9000 : 24000, size: 1.25, ptr: ptr.arr(), pr: .15 }]], dots, { t });
}
$('pin').onclick = () => { st.pinned = !st.pinned; $('pin').setAttribute('aria-pressed', st.pinned); $('pin').textContent = st.pinned ? 'Label pinned: REAL' : 'Pin the label: this one is real'; if (st.pinned) { setLabel('real'); $('count').textContent = 'The label stays. The cloud cannot move it.'; $('live').textContent = 'You pinned the label. The repository is real, and it stays real.'; snd.once('key', { rate: .7 }); } else $('count').textContent = ''; };
addEventListener('resize', () => { build(); if (RM) tick(1, .016); }); build(); setLabel('simulated');
if (RM) { st.relabels = 6; $('count').textContent = 'Re-labelled 6 times.'; tick(1, .016); } else loop(stage, tick, small ? 24 : 40);
