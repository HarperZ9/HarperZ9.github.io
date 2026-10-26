// gallery.js: letters the page title with the capsule technique (letters/capsule.mjs) through the lettering library.
// The h1 keeps its real text; the art draws beneath it.
import { registerTechnique, letter } from '../../lettering/lib/letter.mjs';

registerTechnique('capsule', () => import('./letters/capsule.mjs'));
for (const el of document.querySelectorAll('[data-capsule]')) {
  letter(el.textContent, 'capsule', { seed: 29, palette: el.dataset.palette || 'spectral' }).mount(el).catch(e => console.error('capsule lettering failed', e));
}
