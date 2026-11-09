// lanes/type.mjs: a material as lettering. The word stays real text; the lettering library draws it from the
// material's technique, through a face cut chosen by the material (the house Accession Display, the minted deco
// cut, or the default grotesk). Pure spec for node; mountType() is browser only.
import { normalize } from '../schema.mjs';

// Face cuts the type lane can set a word in. url is relative to this module.
export const FACES = Object.freeze({
  'accession-display': { id: 'accession-display', family: 'Accession Display', url: new URL('../../../typeface/dist/static/AccessionDisplay-Black.woff2', import.meta.url).href, weights: '900' },
  'mint-deco': { id: 'mint-deco', family: 'Mint Deco', url: new URL('../../../ui/shell/fonts/mint-deco.ttf', import.meta.url).href, weights: '400', caps: true },
});

// Tunings per technique, from each technique's meta.params ranges, driven by the material's core.
function tune(technique, c) {
  switch (technique) {
    case 'engraved': return { dsep: +(2.1 + 4 * (1 - c.line)).toFixed(2), duration: +Math.min(6, Math.max(0.8, c.durationS)).toFixed(2) };
    case 'rope': return { duration: +Math.min(7, Math.max(1.6, c.durationS)).toFixed(2) };
    case 'chladni': return { mode: 1 + (Math.round(c.pitch) % 40), morph: +Math.min(8, Math.max(1, c.durationS)).toFixed(2) };
    case 'light': return { duration: +Math.min(4.2, Math.max(1.8, c.durationS)).toFixed(2), shimmer: +(10 * c.sheen).toFixed(2) };
    case 'nightlights': return { grow: +Math.min(8, Math.max(1.5, c.durationS)).toFixed(2) };
    case 'sound': return { rows: 24 + Math.round(72 * c.order), fLow: Math.round(200 + 1800 * (1 - c.brightness)), fHigh: Math.round(3000 + 7000 * c.brightness) };
    case 'swarm': return { links: 8 + Math.round(32 * c.flow) };
    case 'developed': return { sweep: +Math.min(7, Math.max(3.5, c.durationS * 2)).toFixed(2) };
    default: return {};
  }
}

export function typeSpec(material, { seed = 1 } = {}) {
  const m = normalize(material), t = m.hints.type, face = t.face && FACES[t.face] ? t.face : null;
  return {
    technique: t.technique, face, caps: !!(face && FACES[face].caps),
    opts: { seed, ...tune(t.technique, m.core), ...t.opts, ...(face ? { face } : {}) },
    colours: { ink: m.palette.ink, ground: m.palette.ground, paper: m.palette.ground, accent: m.palette.accent },
    under: t.under,
  };
}

// Browser: set the word in el with the lettering library. Returns the Lettering handle.
// lettering: the module ../../../lettering/lib/letter.mjs; glyph: ../../../lettering/lib/glyph.mjs.
const registered = new Set();
export async function mountType(el, word, material, { seed = 1, lettering, glyph, reduced } = {}) {
  const spec = typeSpec(material, { seed });
  if (spec.face && !registered.has(spec.face)) { glyph.registerFace(FACES[spec.face]); registered.add(spec.face); }
  // replace the text, keep any canvas the host prepared for the art
  for (const n of [...el.childNodes]) if (n.nodeType === 3) n.remove();
  el.append(spec.caps ? word.toUpperCase() : word);
  for (const [k, v] of Object.entries(spec.colours)) el.style.setProperty(`--letter-${k}`, v);
  if (spec.face) el.style.fontFamily = `"${FACES[spec.face].family}", var(--face-display)`; else el.style.fontFamily = '';
  // the minted cuts carry tall vertical metrics; a normal line box keeps the drawn art on the real text
  el.style.lineHeight = spec.caps ? 'normal' : '';
  const d = lettering.letter(el.textContent.trim(), spec.technique, { ...spec.opts, ...(reduced !== undefined ? { reduced } : {}) });
  await d.mount(el);
  return d;
}
