// Freud's Mystic Writing-Pad, drawn. The sheet takes writing. Lifting the leaf clears the sheet. The wax slab under it keeps every groove,
// and a low light finds them. Writing goes into two canvases: the surface (ink) and a height map (the wax).
import { el, RM } from './core.js';
const W = 640, H = 360, HW = 320, HH = 180;

export function mountPad(D, after) {
  const box = el('section', 'pad'); box.setAttribute('aria-labelledby', 'pad-h');
  box.innerHTML = `<h2 id="pad-h">On the desk: a wax pad</h2>
  <div class="padwrap"><canvas id="padc" width="${W}" height="${H}" tabindex="0" role="img" aria-label="A children's wax writing pad. Draw on it with the pointer, or type below. Lifting the leaf clears the sheet."></canvas></div>
  <div class="padctl">
    <label>Write <input id="padtxt" maxlength="26" value="NO FURTHER ACTION" autocomplete="off"></label>
    <button type="button" id="padw">Write it</button><button type="button" id="padl">Lift the leaf</button>
    <button type="button" id="padb" aria-pressed="false">Look at the wax</button><button type="button" id="padn">New pad</button>
    <label>Light direction <input type="range" id="pada" min="0" max="359" value="205"></label></div>
  <p id="pads" aria-live="polite">The sheet is blank. Write something, or draw with the pointer.</p>`;
  after.after(box);
  const cv = box.querySelector('#padc'), x = cv.getContext('2d'), $ = s => box.querySelector(s);
  const S = document.createElement('canvas'); S.width = W; S.height = H; const sx = S.getContext('2d');
  const Hc = document.createElement('canvas'); Hc.width = HW; Hc.height = HH; const hx = Hc.getContext('2d', { willReadFrequently: true });
  const img = x.createImageData(HW, HH); let bare = false, wrote = 0, lifted = false, ang = 205 * Math.PI / 180, dirty = true, drawing = false, last = null;
  const say = m => { $('#pads').textContent = m; };
  const ink = (a, b) => { sx.strokeStyle = '#1a1a1d'; sx.lineWidth = 3.2; sx.lineCap = 'round'; sx.beginPath(); sx.moveTo(a[0], a[1]); sx.lineTo(b[0], b[1]); sx.stroke();
    hx.globalCompositeOperation = 'lighter'; hx.strokeStyle = 'rgba(70,70,70,1)'; hx.lineWidth = 2.6; hx.lineCap = 'round'; hx.shadowColor = 'rgba(70,70,70,.9)'; hx.shadowBlur = 2; hx.beginPath(); hx.moveTo(a[0] / 2, a[1] / 2); hx.lineTo(b[0] / 2, b[1] / 2); hx.stroke(); hx.shadowBlur = 0; };
  function write(t) {
    sx.font = 'italic 700 54px "Hanken Grotesk",sans-serif'; const fit = Math.min(1, (W - 70) / sx.measureText(t).width), fs = 54 * fit;
    sx.font = `italic 700 ${fs}px "Hanken Grotesk",sans-serif`; sx.fillStyle = '#1a1a1d'; sx.textBaseline = 'middle'; const w = sx.measureText(t).width, y = 90 + (wrote % 4) * 62, xx = 28 + (wrote % 3) * 14;
    sx.save(); sx.beginPath(); sx.rect(0, 0, W, H); sx.clip(); sx.fillText(t, xx, y); sx.restore();
    hx.save(); hx.globalCompositeOperation = 'lighter'; hx.font = `italic 700 ${fs / 2}px "Hanken Grotesk",sans-serif`; hx.textBaseline = 'middle'; hx.fillStyle = 'rgba(70,70,70,1)'; hx.shadowColor = 'rgba(70,70,70,.9)'; hx.shadowBlur = 2; hx.fillText(t, xx / 2, y / 2); hx.restore();
    wrote++; dirty = true; return w;
  }
  function relief() {
    const d = hx.getImageData(0, 0, HW, HH).data, o = img.data, lx = Math.cos(ang), ly = Math.sin(ang), k = 3.4;
    for (let yy = 0; yy < HH; yy++) for (let xx = 0; xx < HW; xx++) { const i = (yy * HW + xx) * 4, a = (yy * HW + Math.min(HW - 1, xx + 1)) * 4, b = (yy * HW + Math.max(0, xx - 1)) * 4, c = (Math.min(HH - 1, yy + 1) * HW + xx) * 4, e = (Math.max(0, yy - 1) * HW + xx) * 4;
      const gx = (d[a] - d[b]) / 255, gy = (d[c] - d[e]) / 255, depth = d[i] / 255, v = 118 + 100 * k * (-gx * lx - gy * ly) / 4 - 26 * depth; const n = ((xx * 7 + yy * 13) % 5) - 2;
      o[i] = Math.max(0, Math.min(255, v + 8 + n)); o[i + 1] = Math.max(0, Math.min(255, v + 4 + n)); o[i + 2] = Math.max(0, Math.min(255, v - 14 + n)); o[i + 3] = 255; }
    const t = document.createElement('canvas'); t.width = HW; t.height = HH; t.getContext('2d').putImageData(img, 0, 0); return t;
  }
  function render() {
    if (!dirty) return; dirty = false; x.clearRect(0, 0, W, H);
    if (bare) { x.imageSmoothingEnabled = true; x.drawImage(relief(), 0, 0, W, H); x.fillStyle = 'rgba(0,0,0,.18)'; x.fillRect(0, 0, W, 6);
      const lx = W / 2 + Math.cos(ang) * 290, ly = H / 2 + Math.sin(ang) * 150; x.fillStyle = '#ffe93a'; x.beginPath(); x.arc(lx, ly, 7, 0, 7); x.fill(); x.strokeStyle = '#151515'; x.lineWidth = 2; x.stroke(); }
    else { x.fillStyle = '#8f8b78'; x.fillRect(0, 0, W, H); const g = x.createLinearGradient(0, 0, W, H); g.addColorStop(0, 'rgba(255,255,255,.18)'); g.addColorStop(.5, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(255,255,255,.12)'); x.fillStyle = g; x.fillRect(0, 0, W, H); x.drawImage(S, 0, 0); }
    x.strokeStyle = '#c9a24a'; x.lineWidth = 6; x.strokeRect(3, 3, W - 6, H - 6);
  }
  const pos = e => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) * W / r.width, (e.clientY - r.top) * H / r.height]; };
  cv.addEventListener('pointerdown', e => { if (bare) return; drawing = true; cv.setPointerCapture(e.pointerId); last = pos(e); ink(last, [last[0] + .1, last[1] + .1]); wrote++; dirty = true; });
  cv.addEventListener('pointermove', e => { if (bare && !e.buttons) { const r = cv.getBoundingClientRect(); ang = Math.atan2((e.clientY - r.top) / r.height - .5, (e.clientX - r.left) / r.width - .5); $('#pada').value = Math.round(((ang * 180 / Math.PI) + 360) % 360); dirty = true; return; } if (!drawing) return; const p = pos(e); ink(last, p); last = p; dirty = true; });
  cv.addEventListener('pointerup', () => { drawing = false; });
  $('#padw').onclick = () => { if (bare) { say('The wax is bare. Put the sheet back before you write.'); return; } const t = $('#padtxt').value.trim(); if (!t) return; write(t); lifted = false; say(`Written: ${t}. The sheet shows it.`); };
  $('#padl').onclick = () => { if (!wrote) { say('There is nothing on the sheet to lift. Write something first.'); return; } sx.clearRect(0, 0, W, H); lifted = true; bare = false; $('#padb').setAttribute('aria-pressed', 'false'); $('#padb').textContent = 'Look at the wax'; dirty = true; say('The leaf is lifted and the sheet is blank. The wax has not changed. Look at the wax to see it.'); };
  $('#padb').onclick = () => { bare = !bare; $('#padb').setAttribute('aria-pressed', String(bare)); $('#padb').textContent = bare ? 'Put the sheet back' : 'Look at the wax'; dirty = true;
    if (bare) { say(wrote ? (lifted ? 'The sheet is off. The grooves are still in the wax: move the pointer over it, or turn the light, until they stand up.' : 'The sheet is off. The grooves are in the wax. The leaf was never lifted, so the writing is still on it.') : 'The wax is smooth. Nothing has been written yet.'); if (wrote && lifted) D.reveal('l2'); } else say('Sheet back on.'); };
  $('#padn').onclick = () => { sx.clearRect(0, 0, W, H); hx.clearRect(0, 0, HW, HH); wrote = 0; lifted = false; bare = false; $('#padb').setAttribute('aria-pressed', 'false'); $('#padb').textContent = 'Look at the wax'; dirty = true; say('A new pad. The wax is smooth.'); };
  $('#pada').oninput = e => { ang = +e.target.value * Math.PI / 180; dirty = true; };
  cv.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); $('#padb').click(); } });
  let raf = 0; const tick = () => { raf = 0; render(); if (!RM) raf = requestAnimationFrame(tick); }; const kick = () => { if (!raf) raf = requestAnimationFrame(tick); };
  if (RM) { setInterval(render, 120); } else tick();
  new IntersectionObserver(en => { if (en[0].isIntersecting) { dirty = true; kick(); } }).observe(cv);
  window.__pad = { write, lift: () => $('#padl').click(), bare: () => $('#padb').click(), sheet: () => bare };
  dirty = true; render(); return box;
}
