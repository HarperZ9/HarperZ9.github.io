// Palimpsest: the page content, drawn into channel-coded layer canvases. Old text now sits between the new lines.
import { mk, rng } from '../media/index.js';
export const PW = 720, PH = 960, SC = 1.5, TW = PW * SC, TH = PH * SC;
export const RY0 = 665, RY1 = 915, ROWS = 5, SLOT_H = 48, TIMER = 8;
export const DW = TW, DH = (RY1 - RY0) * SC;
export const SERIF = '"Hanken Grotesk",sans-serif', SANS = '"Hanken Grotesk", system-ui, sans-serif';
export const OLD = ['The door was open when we came up the road.', 'Nobody could say who had opened it.', 'We wrote down what we saw, one by one,', 'and each of us put a name to it.', 'Then the names were cut from the sheet', 'and the sheet was sent on without them.', 'Three of us stayed behind to count the stairs.', 'There were forty. We counted them twice.', 'The second count came to forty-one.', 'Someone said the wind had moved a step.', 'We did not say what we thought it was.', 'By morning the road was clear again,', 'and the clerk asked us to sign once more.'];
const NEWP = [
  [['The review found no evidence of '], ['misconduct in the period examined', 1], ['. '], ['Eleven', 1], [' witnesses were interviewed. Their accounts are held '], ['by the office', 1], [' and are not part of this summary.']],
  [['A further '], ['forty-one pages', 1], [' are withheld under section four. The remaining pages have been checked and found to be in order.']],
  [['Recommendation: no further action.']],
];
export const MSGS = ['Did you send it?', 'Yes. Do not forward.', 'Delete this after reading.', 'Who else saw the page?', 'No one. It is gone now.', 'Set the timer to eight seconds.', 'Seen.', 'Stairs again tonight.'];
export const prep = c => { const x = c.getContext('2d'); x.setTransform(1, 0, 0, 1, 0, 0); x.globalCompositeOperation = 'source-over'; x.fillStyle = '#000'; x.fillRect(0, 0, c.width, c.height); x.globalCompositeOperation = 'lighter'; return x; };

function flow(x, para, X, Y, W, lh, font, cb) {
  x.font = font; let cx = X, cy = Y;
  for (const [txt, red] of para) for (const w of txt.split(/(?<=\s)/)) { if (!w) continue; const clean = w.replace(/\s+$/, ''), mw = x.measureText(clean).width;
    if (cx + mw > X + W && cx > X) { cx = X; cy += lh; } cb(clean, cx, cy, mw, red); cx += x.measureText(w).width; }
  return cy;
}
// Builds S1 (R old text, G ghost margin text, B redaction bars), S2 (R new ink, G ruling, B prick holes), V (vellum fibre from a real scan).
export function drawStatic(S1, S2, V, scan) {
  const x = prep(S1); x.scale(SC, SC); const x2 = prep(S2); x2.scale(SC, SC);
  x2.fillStyle = 'rgb(255,0,0)'; x2.font = `800 28px ${SANS}`; x2.fillText('SUMMARY OF FINDINGS', 56, 88);
  x2.font = `600 13px ${SANS}`; x2.fillText('PAGE 3 OF 9. PAGES 4 TO 6 WITHHELD.', 56, 112); x2.fillRect(56, 122, PW - 112, 3);
  const base = [], lh = 40, font = `400 20px ${SERIF}`; let y = 162;
  for (const para of NEWP) {
    y = flow(x2, para, 56, y, PW - 112, lh, font, (w, cx, cy, mw, red) => { if (!base.includes(cy)) base.push(cy); x2.font = font; x2.fillStyle = 'rgb(255,0,0)'; x2.fillText(w, cx, cy); if (red) { x.fillStyle = 'rgb(0,0,255)'; x.fillRect(cx - 3, cy - 18, mw + 6, 25); } }) + lh + 6; base.push(y - lh * .0);
  }
  // Old text goes in the gap under each new baseline, in a smaller italic that stays inside the gap.
  const lines = base.filter((v, i, a) => a.indexOf(v) === i).sort((a, b) => a - b); x.fillStyle = 'rgb(255,0,0)'; x.font = `italic 14.5px ${SERIF}`;
  const slots = []; lines.forEach(b => slots.push(b + 17)); for (let k = 0; k < 6; k++) slots.push(lines[lines.length - 1] + 17 + (k + 1) * 24);
  OLD.forEach((t, i) => { if (slots[i] != null && slots[i] < RY0 - 22) { x.save(); x.translate(60 + (i % 3) * 4, slots[i]); x.rotate(-.004 * (i % 4)); x.fillText(t, 0, 0); x.restore(); } });
  x.save(); x.translate(PW - 32, 90); x.rotate(Math.PI / 2); x.fillStyle = 'rgb(0,255,0)'; x.font = `italic 18px ${SERIF}`;
  flow(x, [['It was a Tuesday. The stairwell smelled of wet coats and chalk. I stopped on the fourth step and could not go up. I still stop there. Nobody asks me why, and I do not say.']], 0, 0, 640, 26, x.font, (w, cx, cy) => x.fillText(w, cx, cy)); x.restore();
  x2.fillStyle = 'rgb(255,0,0)'; x2.font = `600 12px ${SANS}`; x2.fillText('MESSAGES. Timer set to ' + TIMER + ' seconds.', 56, RY0 - 8);
  x2.fillStyle = 'rgb(0,45,0)'; for (let ly = 40; ly < PH - 30; ly += 21) x2.fillRect(34, ly, PW - 68, 1);
  x2.fillStyle = 'rgb(0,0,200)'; for (let py = 40; py < PH - 30; py += 21) { x2.beginPath(); x2.arc(22, py, 2, 0, 7); x2.arc(PW - 22, py, 2, 0, 7); x2.fill(); }
  // Vellum: fibre relief (R) and blotch (G) taken from the real scan, then a little synthetic fibre on top.
  const xv = prep(V); xv.globalCompositeOperation = 'source-over'; xv.drawImage(scan, 0, 0, 512, 512);
  const d = xv.getImageData(0, 0, 512, 512), a = d.data, lum = new Float32Array(512 * 512), blur = new Float32Array(512 * 512);
  for (let i = 0; i < lum.length; i++) lum[i] = (a[i * 4] * .3 + a[i * 4 + 1] * .59 + a[i * 4 + 2] * .11) / 255;
  for (let r = 0; r < 512; r++) { let s = 0; for (let k = -12; k <= 12; k++) s += lum[r * 512 + ((k + 512) % 512)]; for (let c = 0; c < 512; c++) { blur[r * 512 + c] = s / 25; s += lum[r * 512 + ((c + 13) % 512)] - lum[r * 512 + ((c - 12 + 512) % 512)]; } }
  for (let i = 0; i < lum.length; i++) { const hp = Math.max(0, Math.min(1, .5 + (lum[i] - blur[i]) * 2.2)); a[i * 4] = hp * 150; a[i * 4 + 1] = Math.max(0, Math.min(1, blur[i])) * 110; a[i * 4 + 2] = 0; a[i * 4 + 3] = 255; }
  xv.putImageData(d, 0, 0); xv.globalCompositeOperation = 'lighter'; const rn = rng(11);
  for (let i = 0; i < 500; i++) { const px = rn() * 512, py = rn() * 512, an = rn() * 6.28, l = 6 + rn() * 26; xv.strokeStyle = `rgba(${Math.floor(30 + rn() * 70)},0,0,.5)`; xv.lineWidth = .8; xv.beginPath(); xv.moveTo(px, py); xv.lineTo(px + Math.cos(an) * l, py + Math.sin(an) * l); xv.stroke(); }
}
