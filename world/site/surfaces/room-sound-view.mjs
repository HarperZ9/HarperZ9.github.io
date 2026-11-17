// room-sound-view.mjs: the sound room's live view. The notes of the bars around the playhead as they play (the keys,
// the bass and the lead by pitch, the kit as ticks along the bottom), the bar lines with their chords, and the bar a
// change will land on. A press and a drag across it play it like a pad: sideways sets the tempo, up and down sets how
// many notes play. The two sliders beside it are the same controls for the keyboard, and the view moves them.
// With reduced motion the view is redrawn once a second and does not scroll between redraws.
const PARTS = { keys: 0.55, bass: 0.9, lead: 1, drums: 0.7 };
const LO = 28, HI = 92, BEFORE = 2, AFTER = 7;   // pitch range drawn, seconds shown before and after the playhead

export function createView(canvas, { music, onDrag, reduce = false, still = () => [] }) {
  const g = canvas.getContext('2d'); let raf = 0, timer = 0, frames = 0, drag = null, alive = true;
  const colour = () => getComputedStyle(canvas).color || '#000';
  function size() {
    const r = canvas.getBoundingClientRect(), dpr = Math.min(2, globalThis.devicePixelRatio || 1), w = Math.max(1, Math.round(r.width * dpr)), h = Math.max(1, Math.round(r.height * dpr));
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    return { w, h, dpr };
  }
  function drawStill({ w, h, dpr }, ink) {
    const bars = still(), bw = w / Math.max(1, bars.length);
    g.font = `${Math.round(13 * dpr)}px system-ui, sans-serif`; g.textBaseline = 'top';
    bars.forEach((sym, i) => { g.globalAlpha = 0.35; g.fillRect(Math.round(i * bw), 0, Math.max(1, dpr), h); g.globalAlpha = 0.9; g.fillText(sym, i * bw + 6 * dpr, 6 * dpr); });
    g.globalAlpha = 0.6; g.fillText('Press a piece to hear it. Then drag here: sideways for tempo, up and down for notes.', 6 * dpr, h - 20 * dpr);
    g.globalAlpha = 1; void ink;
  }
  function draw() {
    if (!alive) return; frames++; canvas.dataset.frames = String(frames);
    const box = size(), { w, h, dpr } = box, ink = colour(); g.clearRect(0, 0, w, h); g.fillStyle = ink; g.strokeStyle = ink;
    const st = music.state();
    if (!st.playing) { drawStill(box, ink); return; }
    const now = music.now(), span = BEFORE + AFTER, x = (t) => ((t - now + BEFORE) / span) * w, drumH = 22 * dpr, y = (m) => (h - drumH) * (1 - (m - LO) / (HI - LO));
    g.font = `${Math.round(12 * dpr)}px system-ui, sans-serif`; g.textBaseline = 'top';
    for (const b of music.bars()) {
      if (b.t1 < now - BEFORE || b.t0 > now + AFTER) continue;
      const bx = x(b.t0), landing = st.landing !== null && b.index === st.landing;
      g.globalAlpha = landing ? 1 : 0.3; g.fillRect(Math.round(bx), 0, landing ? 3 * dpr : Math.max(1, dpr), h);
      g.globalAlpha = 0.85; g.fillText(`${b.index + 1} ${b.chords.join(' ')}`, bx + 4 * dpr, 4 * dpr);
    }
    const meters = music.meters();
    for (const n of music.notes()) {
      if (n.t + n.d < now - BEFORE || n.t > now + AFTER) continue;
      const lv = 0.25 + 0.75 * Math.min(1, (meters[n.part === 'keys' ? 'keys' : n.part] ?? 0) * 1.4), on = n.t <= now && n.t + n.d >= now;
      g.globalAlpha = (on ? 1 : 0.55) * PARTS[n.part] * lv;
      if (n.part === 'drums') { const kick = /kick/.test(n.m); g.fillRect(x(n.t), h - (kick ? drumH : drumH * 0.55), Math.max(2 * dpr, 3 * dpr * n.v), kick ? drumH : drumH * 0.55); continue; }
      const th = n.part === 'lead' ? 6 * dpr : n.part === 'bass' ? 5 * dpr : 3 * dpr;
      g.fillRect(x(n.t), y(n.m) - th / 2, Math.max(2 * dpr, x(n.t + n.d) - x(n.t)), th);
    }
    g.globalAlpha = 1; g.fillRect(Math.round(x(now)), 0, 2 * dpr, h);   // the playhead
  }
  function loop() { raf = 0; draw(); if (alive && !reduce && music.state().playing && !document.hidden) raf = requestAnimationFrame(loop); }
  const kick = () => { if (reduce) { draw(); return; } if (!raf) raf = requestAnimationFrame(loop); };
  if (reduce) timer = setInterval(draw, 1000);

  // press and drag: the start values are kept, so a drag moves from where the controls were
  const down = (ev) => { if (ev.button > 0) return; canvas.setPointerCapture?.(ev.pointerId); drag = { x: ev.clientX, y: ev.clientY, w: canvas.getBoundingClientRect().width, h: canvas.getBoundingClientRect().height, from: onDrag.start() }; ev.preventDefault(); };
  const move = (ev) => { if (!drag) return; onDrag.move(drag.from, (ev.clientX - drag.x) / drag.w, (drag.y - ev.clientY) / drag.h); };
  const up = (ev) => { if (!drag) return; drag = null; canvas.releasePointerCapture?.(ev.pointerId); onDrag.end?.(); };
  canvas.addEventListener('pointerdown', down); canvas.addEventListener('pointermove', move); canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
  const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(() => draw()) : null; ro?.observe(canvas);
  draw();
  return {
    kick, draw, get frames() { return frames; },
    destroy() { alive = false; cancelAnimationFrame(raf); clearInterval(timer); ro?.disconnect(); canvas.removeEventListener('pointerdown', down); canvas.removeEventListener('pointermove', move); canvas.removeEventListener('pointerup', up); canvas.removeEventListener('pointercancel', up); },
  };
}
