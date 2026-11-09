// gallery.js: the live case. A worker renders the chosen piece at the canvas's device size and sends an
// sRGB ImageBitmap; the display-p3 canvas converts it, so colour is mapped, never stretched.
const canvas = document.querySelector('[data-live]');
if (canvas) {
  const worker = new Worker(new URL('./live-worker.mjs', import.meta.url), { type: 'module' });
  // display-p3 backing on every screen: sRGB bitmaps convert into it exactly, and wide-gamut screens keep it
  const ctx = canvas.getContext('2d', { colorSpace: 'display-p3' });
  const seedOut = document.querySelector('[data-seed]');
  let piece = 'sheet', seed = 25, busy = false, pending = false;

  // Backing store: CSS width x devicePixelRatio, capped at 2600 px per side (QUALITY-SPEC R1 cap: above
  // 2600 a sheet takes over 4 s in the worker on a laptop, measured in PROGRESS.md).
  const deviceSize = () => Math.min(2600, Math.round(canvas.getBoundingClientRect().width * devicePixelRatio));

  // size the backing store before the first render, so the canvas is never stretched
  { const d = deviceSize(); canvas.width = d; canvas.height = d; ctx.fillStyle = '#d4cebe'; ctx.fillRect(0, 0, d, d); }

  const draw = () => {
    if (busy) { pending = true; return; }
    busy = true; canvas.setAttribute('aria-busy', 'true');
    worker.postMessage({ piece, seed, size: deviceSize() });
  };
  worker.onmessage = ({ data }) => {
    busy = false; canvas.removeAttribute('aria-busy');
    if (data.error) { console.error('gallery: live render failed:', data.error); return; }
    if (canvas.width !== data.size) { canvas.width = data.size; canvas.height = data.size; }
    ctx.drawImage(data.bitmap, 0, 0); data.bitmap.close();
    if (seedOut) seedOut.textContent = String(data.seed);
    if (pending) { pending = false; draw(); }
  };
  worker.onerror = (e) => { busy = false; console.error('gallery: worker error', e.message); };

  for (const b of document.querySelectorAll('[data-piece]')) b.addEventListener('click', () => {
    piece = b.dataset.piece;
    for (const o of document.querySelectorAll('[data-piece]')) o.setAttribute('aria-pressed', String(o === b));
    draw();
  });
  document.querySelector('[data-next-seed]')?.addEventListener('click', () => { seed += 1; draw(); });

  const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { io.disconnect(); draw(); } }, { rootMargin: '200px' });
  io.observe(canvas);
}
