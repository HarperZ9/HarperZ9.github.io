import { loadImage, mk, apply, byId } from '../media/index.js';
import { createStepper } from '../media/stepper.js';
import { buildCollage, rays, P as BP } from './balance-art.js';
import { sound } from '../media/sound.js';

const small = innerWidth < 700, sfx = small ? '-s' : '';
const L = n => loadImage(`assets/img/${n}${sfx}.jpg`);
const [heart, justice, famine, bread, gods, hunefer, concrete, layers, rust, hessian] = await Promise.all(['heart-ani', 'justice-etching', 'famine-bangalore', 'bread-line-bowery', 'gods-word', 'heart-hunefer', 'concrete-worn', 'concrete-layers', 'rust-metal', 'hessian'].map(L));
const snd = sound({ key: { url: 'assets/audio/key.opus', gain: 0.498 }, hiss: { url: 'assets/audio/hiss.opus', gain: 0.027 } }); snd.mount(document.querySelector('.top')); snd.bed('hiss', 1);
// The backdrop: the balance's painting. Sunburst, then archive cut-outs.
const bg = mk(1600, 900), bx = bg.getContext('2d'); bx.fillStyle = '#0d4f80'; bx.fillRect(0, 0, 1600, 900); bx.save(); bx.translate(0, 120); bx.translate(0, 0);
const rc = mk(1600, 900), rx = rc.getContext('2d'); rx.translate(800, 380); rx.globalAlpha = 1; for (let i = 0; i < 28; i++) { const a0 = i / 28 * 6.2832, a1 = (i + .5) / 28 * 6.2832; rx.fillStyle = i % 2 ? '#1aa3e0' : '#0a3a66'; rx.beginPath(); rx.moveTo(0, 0); rx.lineTo(1800 * Math.cos(a0), 1800 * Math.sin(a0)); rx.lineTo(1800 * Math.cos(a1), 1800 * Math.sin(a1)); rx.fill(); }
bx.restore(); bx.drawImage(rc, 0, 0); bx.drawImage(buildCollage({ heart, justice, famine, bread, gods, hunefer }, 1600, 800, small), 0, 40);
const o = mk(1600, 900); apply(bg, [[byId.filmburn, { weave: 0, burn: .15, flicker: 0 }]], o, { t: 3 });

const INK = '#eee9df', HOT = '#e0177e', BRASS = '#d9b44a', DARK = 'rgba(17,17,19,.86)';
const lerp = (a, b, t) => a + (b - a) * t;
// Parts of the scale in iso units. e is the transition 0..1 into the step, t is time.
function frame(g, o = {}) {
  const { hl = '', wedge = 0, sack = 1, dial = 1, tilt = 0 } = o; g.grid(5, 1);
  g.box(-1.3, -1.3, 0, 2.6, 2.6, .35, hl === 'base' ? HOT : INK);
  g.box(-.3, -.3, .35, .6, .6, 4, INK);
  g.box(-3.4, -.18, 4.3 + tilt, 6.8, .36, .3, hl === 'beam' ? HOT : INK);
  g.circle(0, 0, 4.6, .32, hl === 'pivot' ? HOT : BRASS, 'rgba(217,180,74,.25)', hl === 'pivot' ? 4 : 2);
  for (const sx of [-3, 3]) { const zt = 4.4 + (sx < 0 ? -tilt : tilt) * 0, zp = 2.6 + (sx < 0 ? 0 : 0); g.line([sx, 0, 4.4], [sx - .5, 0, zp + .2], BRASS, 1.5); g.line([sx, 0, 4.4], [sx + .5, 0, zp + .2], BRASS, 1.5); g.box(sx - .6, -.6, zp, 1.2, 1.2, .2, hl === 'pans' ? HOT : BRASS); }
  if (sack) g.box(-3.3, -.3, 2.8, .6, .6, .7 * sack, hl === 'sack' ? HOT : INK);
  g.box(2.75, -.25, 2.8, .5, .5, .5, INK);
  if (wedge) { const w = wedge; g.poly([[-3.6, -.5, 2.35 - 0], [-2.4, -.5, 2.35], [-2.4, -.5, 2.35 + .9 * w]], HOT, 'rgba(224,23,126,.35)', 3); g.poly([[-3.6, .5, 2.35], [-2.4, .5, 2.35], [-2.4, .5, 2.35 + .9 * w]], HOT, 'rgba(224,23,126,.2)', 2); g.line([-3.6, -.5, 2.35], [-3.6, .5, 2.35], HOT, 3); g.line([-2.4, -.5, 2.35 + .9 * w], [-2.4, .5, 2.35 + .9 * w], HOT, 3); }
  if (dial) { g.circle(0, -.35, 3.2, .5, hl === 'dial' ? HOT : INK, DARK); g.line([0, -.36, 3.2], [.28, -.36, 3.5], hl === 'dial' ? HOT : INK, 3); g.text('TRUE', 0, -.4, 2.4, 13, hl === 'dial' ? HOT : INK); }
}
const steps = [
  { title: 'The beam', text: 'A beam balance compares two weights. The heavier side pulls its end down. A level beam means the two sides weigh the same, and that is all it says.', draw: (g, k, e) => frame(g, { hl: 'beam', sack: e, dial: 0 }) },
  { title: 'The pans', text: 'Whatever you want weighed goes on one pan, and the standard goes on the other. Everything depends on the standard being what the label says.', draw: (g, k, e) => frame(g, { hl: 'pans', dial: 0 }) },
  { title: 'The pivot', text: 'The pivot is the one fixed point. If it sits off centre, every reading carries the same error and none of them shows it.', draw: (g, k, e, t) => { frame(g, { hl: 'pivot', dial: 0 }); g.circle(0, 0, 4.6, .32 + .25 * e * (.6 + .4 * Math.sin(t * 5)), HOT, null, 2); } },
  { title: 'Calibration', text: 'A scale is trusted because someone once checked it against a standard. The shop reads the dial every day. Nobody in the shop re-checks the standard.', draw: (g, k, e) => { frame(g, { hl: 'dial' }); g.text('checked once', -1.8, -.4, 3.9, 14, BRASS); } },
  { title: 'The hidden wedge', text: 'A wedge under one pan adds weight where nobody looks. The beam stays level because the wedge pushes back. Look under the pan, and the sack was never as light as it felt.', draw: (g, k, e, t) => frame(g, { wedge: e, hl: e > .9 ? 'wedge' : '' }) },
  { title: 'The reading', text: 'The dial reads TRUE. It is right about the beam and says nothing about the wedge, because nobody built it to ask.', draw: (g, k, e, t) => { frame(g, { wedge: 1, hl: 'dial' }); g.text('reads TRUE', 1.9, -.4, 4.3, 16, HOT); } },
  { title: 'Who built it', text: "Someone built this scale, chose the standard and set the pivot. Don't look at me like that. Mine reads TRUE too. Funny how everybody's does, huh?", draw: (g, k, e) => { frame(g, { wedge: 1, hl: '' }); g.ctx.save(); const [x, y] = g.P(3.8, 2.6, 0); g.ctx.fillStyle = INK; g.ctx.beginPath(); g.ctx.arc(x, y - g.s * 1.7 * e, g.s * .14, 0, 7); g.ctx.fill(); g.ctx.fillRect(x - g.s * .12, y - g.s * 1.55 * e, g.s * .24, g.s * 1.1 * e); g.ctx.restore(); } },
];
const st = createStepper(document.getElementById('st'), { backdrop: o, steps, aria: 'How a scale lies, in 7 steps. Use the left and right arrow keys.', scale: 1.2 });
document.querySelectorAll('.st-prev, .st-next').forEach(b => b.addEventListener('click', () => snd.once('key')));
