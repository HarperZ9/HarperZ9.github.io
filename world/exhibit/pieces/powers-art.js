// Powers of Ten, for a Lie: the seven levels, each a tile of 1000 units whose centre 100 x 100 is where the next level sits.
// Archive material is cut, halftoned and taped in with the mediums. The Eames film is evoked in structure only; nothing is copied from it.
import { byId, apply, mk, rng } from '../media/index.js';
import { cover } from './common.js';
const SANS = '"Hanken Grotesk",system-ui,sans-serif', SERIF = '"Hanken Grotesk",sans-serif';
const PAL = ['#e0177e', '#1aa3e0', '#ffe93a', '#1f9a4c', '#e3262b', '#151515', '#f6f3ea'];
const rays = (x, n, a, b, R = 900) => { for (let i = 0; i < n; i++) { const a0 = i / n * 6.2832, a1 = (i + .5) / n * 6.2832; x.fillStyle = i % 2 ? a : b; x.beginPath(); x.moveTo(0, 0); x.lineTo(R * Math.cos(a0), R * Math.sin(a0)); x.lineTo(R * Math.cos(a1), R * Math.sin(a1)); x.fill(); } };
// A cut-out: archive image fitted to w x h with transparent margin, run through a chain, drawn at (cx,cy) rotated.
function cut(x, im, w, h, chain, cx, cy, rot, tape, seed = 1) {
  const pad = Math.round(Math.max(w, h) * .05), s = mk(w + pad * 2, h + pad * 2); cover(s.getContext('2d'), im, pad, pad, w, h); const o = mk(s.width, s.height); apply(s, chain, o, { seed });
  x.save(); x.translate(cx, cy); x.rotate(rot); x.drawImage(o, -o.width / 2, -o.height / 2); if (tape) { x.fillStyle = 'rgba(232,214,150,.78)'; x.fillRect(-36, -h / 2 - 8, 72, 20); } x.restore();
}
const hole = (x, r = 50) => { x.fillStyle = '#151515'; x.fillRect(-r, -r, r * 2, r * 2); };
const T = (x, s, X, Y, size, fill, font = SANS, w = 800) => { x.font = `${w} ${size}px ${font}`; x.fillStyle = fill; x.textAlign = 'center'; x.fillText(s, X, Y); };

export function buildLevels(I, TS) {
  const k = TS / 1000, L = {}, make = fn => { const c = mk(TS, TS), x = c.getContext('2d'); x.translate(TS / 2, TS / 2); x.scale(k, k); fn(x); return c; }, r = rng(5), pick = a => a[Math.floor(r() * a.length)];
  L[0] = make(x => { x.fillStyle = '#ffe93a'; x.fillRect(-500, -500, 1000, 1000); rays(x, 28, '#ff9f1c', '#ffe93a');
    cut(x, I.preanger, 700, 520, [[byId.newsprint, { gain: .4, age: .7 }], [byId.cutpaper, { tear: .014 }]], -230, 300, -.08, true, 2);
    cut(x, I.neratja, 520, 640, [[byId.photocopy, { gen: .3 }], [byId.cutpaper, { tear: .014 }]], 330, -260, .07, true, 3);
    x.fillStyle = '#111'; x.beginPath(); x.roundRect(-212, -442, 424, 884, 56); x.fill(); x.fillStyle = '#f6f3ea'; x.beginPath(); x.roundRect(-192, -420, 384, 840, 38); x.fill();
    x.fillStyle = '#111'; x.beginPath(); x.roundRect(-60, -436, 120, 14, 7); x.fill(); x.fillStyle = '#e0177e'; x.beginPath(); x.arc(-140, -340, 32, 0, 7); x.fill(); x.fillStyle = '#151515'; x.fillRect(-92, -362, 160, 16); x.fillStyle = '#9a968c'; x.fillRect(-92, -336, 110, 12);
    x.textAlign = 'left'; x.font = `800 60px ${SANS}`; x.fillStyle = '#151515'; x.fillText('“… is over,', -168, -190); x.fillStyle = '#c9c4b8'; x.fillRect(-168, -140, 250, 14); x.fillRect(-168, -110, 200, 14); x.fillRect(-168, 210, 336, 10); x.fillRect(-168, 250, 280, 10);
    x.strokeStyle = '#151515'; x.lineWidth = 8; x.beginPath(); x.arc(-120, 330, 22, 0, 7); x.moveTo(-12, 330); x.lineTo(44, 330); x.moveTo(20, 310); x.lineTo(44, 330); x.lineTo(20, 350); x.stroke(); hole(x, 56); });
  L[1] = make(x => { x.fillStyle = '#e0177e'; x.fillRect(-500, -500, 1000, 1000); rays(x, 20, '#ff4fa3', '#b0105f'); const P = [['wanted-mcdonald', 'wanted-booth', 'hohenzollerns'], ['broadside-ballad', null, 'wanted-evans'], ['wanted-stephens', 'broadside-tragical', 'newspad-vaudeville']];
    const chains = [[[byId.halftone, { cell: 6 }], [byId.cutpaper, { tear: .016 }]], [[byId.riso, { misreg: .01 }], [byId.cutpaper, { tear: .016 }]], [[byId.photocopy, { gen: .5 }], [byId.cutpaper, { tear: .016 }]]];
    P.forEach((row, j) => row.forEach((n, i) => { if (!n) return; cut(x, I[n], 250, 300, chains[(i + j) % 3], -300 + i * 300 + (r() - .5) * 20, -300 + j * 300 + (r() - .5) * 20, (r() - .5) * .22, true, i + j * 3); }));
    x.fillStyle = '#f6f3ea'; x.strokeStyle = '#151515'; x.lineWidth = 5; x.fillRect(-90, -100, 180, 200); x.strokeRect(-90, -100, 180, 200); hole(x, 56); });
  L[2] = make(x => { x.fillStyle = '#1aa3e0'; x.fillRect(-500, -500, 1000, 1000); rays(x, 36, '#5cc4f2', '#0f7fb8'); const pts = []; for (let i = 0; i < 10; i++) for (let j = 0; j < 10; j++) { const cx = -405 + i * 90, cy = -405 + j * 90; if (Math.abs(cx) < 90 && Math.abs(cy) < 90) continue; pts.push([cx, cy]); }
    x.strokeStyle = 'rgba(255,255,255,.7)'; x.lineWidth = 3; pts.filter(() => r() < .38).forEach(([a, b]) => { x.beginPath(); x.moveTo(0, 0); x.lineTo(a, b); x.stroke(); });
    const faces = [I.operator, I.barclay, I.telegrapher]; pts.forEach(([a, b], n) => { const cvs = mk(80, 80), cx = cvs.getContext('2d'); if (n % 3 === 0) { cx.beginPath(); cx.arc(40, 40, 38, 0, 7); cx.clip(); cover(cx, faces[(n / 3 | 0) % 3], 0, 0, 80, 80); const o = mk(80, 80); apply(cvs, [[byId.halftone, { cell: 4 }]], o, { seed: n }); x.drawImage(o, a - 40, b - 40); x.strokeStyle = '#151515'; x.lineWidth = 4; x.beginPath(); x.arc(a, b, 38, 0, 7); x.stroke(); }
      else { x.fillStyle = pick(PAL); x.strokeStyle = '#151515'; x.lineWidth = 4; x.beginPath(); x.arc(a, b, 36, 0, 7); x.fill(); x.stroke(); x.fillStyle = pick(PAL); x.beginPath(); x.arc(a, b, 13, 0, 7); x.fill(); } });
    x.fillStyle = '#0d4f80'; x.strokeStyle = '#151515'; x.lineWidth = 6; x.fillRect(-90, -90, 180, 180); x.strokeRect(-90, -90, 180, 180); hole(x, 56); });
  L[3] = make(x => { x.fillStyle = '#2b2b2e'; x.fillRect(-500, -500, 1000, 1000); x.fillStyle = '#e0177e'; x.fillRect(-500, -500, 1000, 400); rays(x, 18, '#ffe93a', '#e0177e'); x.globalAlpha = .0;
    x.globalAlpha = 1; [['neratja', -250, -170], ['vrije-woord', 250, -170], ['wilnaer', -250, 250], ['preanger', 250, 250]].forEach(([n, a, b], i) => cut(x, I[n], 390, 520, [[byId.newsprint, { gain: .5, age: .6 }], [byId.cutpaper, { tear: .014 }]], a, b, (i - 1.5) * .05, false, i));
    x.fillStyle = '#e3262b'; x.fillRect(-470, -260, 940, 120); x.save(); x.translate(0, -175); x.font = `800 76px ${SANS}`; x.fillStyle = '#fff'; x.textAlign = 'center'; x.fillText('AID “IS OVER”', 0, 0); x.restore();
    x.fillStyle = '#151515'; x.strokeStyle = '#c9a132'; x.lineWidth = 10; x.fillRect(-190, -124, 380, 248); x.strokeRect(-190, -124, 380, 248); hole(x, 56); });
  L[4] = make(x => { x.fillStyle = '#1f9a4c'; x.fillRect(-500, -500, 1000, 1000);
    cut(x, I.tickerRoom, 980, 760, [[byId.cyanotype, { exposure: .6 }], [byId.cutpaper, { tear: .008 }]], 0, 0, 0, false, 5);
    for (let i = 0; i < 8; i++) { x.save(); x.rotate(i / 8 * 6.2832 + .2); x.fillStyle = i === 0 ? '#e0177e' : '#f6f3ea'; x.strokeStyle = '#151515'; x.lineWidth = 3; x.fillRect(150, -22, 340, 44); x.strokeRect(150, -22, 340, 44); x.fillStyle = '#151515'; x.font = `800 26px ${SANS}`; x.textAlign = 'left'; x.fillText('IS OVER  IS OVER  IS OVER', 160, 9); x.restore(); }
    x.fillStyle = '#151515'; x.strokeStyle = '#c9a132'; x.lineWidth = 8; x.beginPath(); x.arc(0, 0, 86, 0, 7); x.fill(); x.stroke(); hole(x, 56); });
  L[5] = make(x => { x.fillStyle = '#0a0716'; x.fillRect(-500, -500, 1000, 1000); for (let i = 0; i < 120; i++) { x.fillStyle = `rgba(255,255,255,${.3 + r() * .7})`; x.beginPath(); x.arc(r() * 1000 - 500, r() * 1000 - 500, 1 + r() * 2, 0, 7); x.fill(); }
    x.save(); x.beginPath(); x.arc(0, 0, 440, 0, 7); x.clip(); cover(x, I.blueMarble, -440, -440, 880, 880); x.globalCompositeOperation = 'screen'; x.globalAlpha = .55; cover(x, I.blackMarble, -440, -440, 880, 880, .35, .5); x.restore();
    x.strokeStyle = 'rgba(224,23,126,.7)'; x.lineWidth = 5; x.beginPath(); x.arc(0, 0, 470, 0, 7); x.stroke(); x.strokeStyle = 'rgba(255,233,58,.7)'; x.lineWidth = 3; x.beginPath(); x.ellipse(0, 0, 560, 90, -.31, 0, 7); x.stroke();
    const g = x.createRadialGradient(0, 0, 0, 0, 0, 130); g.addColorStop(0, '#fff6b0'); g.addColorStop(.4, 'rgba(224,23,126,.8)'); g.addColorStop(1, 'rgba(224,23,126,0)'); x.fillStyle = g; x.fillRect(-130, -130, 260, 260); hole(x, 56); });
  L[-1] = make(x => { x.fillStyle = '#e3262b'; x.fillRect(-500, -500, 1000, 1000); rays(x, 24, '#b01d22', '#e3262b'); x.save(); x.lineJoin = 'round'; x.lineWidth = 8; x.strokeStyle = '#151515';
    [['only a', -200], ['question', -20], ['of', 160], ['time', 340]].forEach(([s, y]) => { x.font = `700 200px ${SERIF}`; x.textAlign = 'center'; x.strokeText(s, 0, y); x.fillStyle = '#f6f3ea'; x.fillText(s, 0, y); }); x.restore();});
  return L;
}
