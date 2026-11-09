// Shared helpers for the pieces: asset metadata, cover-fit drawing, a fixed-step animation loop.
export const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
let metaP;
export const assetMeta = () => metaP || (metaP = fetch('assets/assets.json').then(r => r.json()).then(a => Object.fromEntries(a.map(x => [x.slug, x]))).catch(() => ({})));
export const credit = (m, slug) => { const a = m[slug]; return a ? `${a.title.replace(/\s+/g, ' ')} (${a.source.replace('_', ' ')}, ${a.licence.toUpperCase()})` : slug; };
export function cover(ctx, img, x, y, w, h, fx = .5, fy = .5) {
  const iw = img.videoWidth || img.naturalWidth || img.width, ih = img.videoHeight || img.naturalHeight || img.height; if (!iw) return;
  const s = Math.max(w / iw, h / ih), sw = w / s, sh = h / s; ctx.drawImage(img, (iw - sw) * fx, (ih - sh) * fy, sw, sh, x, y, w, h);
}
export function contain(ctx, img, x, y, w, h) {
  const iw = img.videoWidth || img.naturalWidth || img.width, ih = img.videoHeight || img.naturalHeight || img.height; if (!iw) return;
  const s = Math.min(w / iw, h / ih); ctx.drawImage(img, x + (w - iw * s) / 2, y + (h - ih * s) / 2, iw * s, ih * s);
}
// Run fn(t seconds, dt) every frame while the element is on screen and the tab is visible.
export function loop(el, fn, fps = 60) {
  let vis = true, last = 0, raf = 0; const gap = 1000 / fps;
  new IntersectionObserver(e => { vis = e[0].isIntersecting; kick(); }, { threshold: 0 }).observe(el);
  const tick = now => { raf = 0; if (!vis || document.hidden) return; if (now - last >= gap) { fn(now / 1000, Math.min(.1, (now - last) / 1000)); last = now; } raf = requestAnimationFrame(tick); };
  const kick = () => { if (!raf && vis) raf = requestAnimationFrame(tick); };
  document.addEventListener('visibilitychange', kick); kick(); return kick;
}
