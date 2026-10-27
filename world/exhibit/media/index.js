// media/index.js: the catalogue. Every medium is a small parameterised effect.
// Usage:  import { apply, MEDIA, byId } from './media/index.js';
//         apply(sourceCanvas, [[byId.riso, { misreg: 0.01 }], [byId.crt]], outCanvas, { t, seed });
import { riso, halftone, cyanotype, photocopy } from './mediums/print.js';
import { cutpaper, letraset, newsprint, marbling } from './mediums/paper.js';
import { filmburn, vhs, crt, scope } from './mediums/screen.js';
import { xray, blueprint, polaroid, archival } from './mediums/plate.js';
import { dotfield, dotCount, RAMP } from './mediums/dotfield2.js';
export { dotCount, RAMP };
export { pointer } from './pointer.js';
export { apply, backend, defaults, mk, rng, H } from './core.js';
export const MEDIA = [riso, halftone, cyanotype, photocopy, cutpaper, letraset, newsprint, marbling, filmburn, vhs, crt, scope, xray, blueprint, polaroid, archival, dotfield];
export const byId = Object.fromEntries(MEDIA.map(m => [m.id, m]));

// Small shared helpers for the pieces
// Best image format this browser decodes. Every asset ships as .avif, .webp and .jpg (see FIDELITY-AUDIT.md).
const canDecode = type => { try { return document.createElement('canvas').toDataURL(type).startsWith(`data:${type}`); } catch { return false; } };
const avifOk = (() => { const i = new Image(); i.src = 'data:image/avif;base64,AAAAIGZ0eXBhdmlmAAAAAGF2aWZtaWYxbWlhZk1BMUIAAADybWV0YQAAAAAAAAAoaGRscgAAAAAAAAAAcGljdAAAAAAAAAAAAAAAAGxpYmF2aWYAAAAADnBpdG0AAAAAAAEAAAAeaWxvYwAAAABEAAABAAEAAAABAAABGgAAAB0AAAAoaWluZgAAAAAAAQAAABppbmZlAgAAAAABAABhdjAxQ29sb3IAAAAAamlwcnAAAABLaXBjbwAAABRpc3BlAAAAAAAAAAIAAAACAAAAEHBpeGkAAAAAAwgICAAAAAxhdjFDgQ0MAAAAABNjb2xybmNseAACAAIAAYAAAAAXaXBtYQAAAAAAAAABAAEEAQKDBAAAACVtZGF0EgAKCBgANogQEAwgMg8f8D///8WfhwB8+ErK42A='; return i.decode().then(() => true, () => false); })();
let ext = canDecode('image/webp') ? 'webp' : 'jpg';
avifOk.then(ok => { if (ok) ext = 'avif'; });
export const imageFormatReady = avifOk;
const loadRaw = url => new Promise((res, rej) => { const i = new Image(); i.decoding = 'async'; i.onload = () => res(i); i.onerror = () => rej(new Error('image ' + url)); i.src = url; });
// Archive images under assets/img/ are swapped to the best format this browser decodes; the .jpg stays the fallback.
// Pass { keep: true } where the exact JPEG bytes matter (lossy.html hashes its original).
export const loadImage = async (url, { keep = false } = {}) => {
  if (keep || !/assets\/img\/[^/]+\.jpg$/.test(url)) return loadRaw(url);
  await imageFormatReady;
  const best = url.replace(/\.jpg$/, '.' + ext);
  return best === url ? loadRaw(url) : loadRaw(best).catch(() => loadRaw(url));
};
export const loadVideo = url => new Promise(res => { const v = document.createElement('video'); v.muted = true; v.loop = true; v.playsInline = true; v.preload = 'auto'; v.src = url; v.addEventListener('loadeddata', () => res(v), { once: true }); v.addEventListener('error', () => res(null), { once: true }); v.load(); });

// Pick the small file on narrow screens and the large one otherwise, in the best format decoded here.
export const assetUrl = (slug, small = innerWidth < 700) => `assets/img/${slug}${small ? '-s' : ''}.${ext}`;
export const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
