// schema.mjs: the material. One parameter set that renders in four lanes (type, image, motion, sound).
//
// A material has two parts. The core is a set of physical and perceptual numbers that every lane reads
// (relief depth, lamp angle, grain, particle density, order, sheen, flow, fibre, line work, tension, cadence,
// tempo, pitch, resonance, decay, transient, noise and brightness). The hints name which generator each lane
// starts from (a lettering technique, compositor plates, a timing curve, engine voices). Blending lerps the
// core and layers the hints, so a blend is a real interpolation where the quantity is shared and a stack
// where it is categorical. Dependency-free; runs in node and the browser.

export const SCHEMA = 'studio.material/1';

// [min, max, unit, default]. Ranges are inclusive. Units: 1 means a share from 0 to 1.
export const CORE = Object.freeze({
  relief:      [0, 1, 'share of full height-field depth', 0.2],
  lampDeg:     [2, 90, 'deg above the surface (raking at 2 to 25)', 35],
  lampAzDeg:   [0, 360, 'deg, light direction in the picture plane', 315],
  grainStd:    [0, 0.06, 'display units (1/255 is 0.0039)', 0.008],
  grainPx:     [1.9, 3.1, 'px correlation width at 1x (QUALITY-SPEC R4)', 2.3],
  particles:   [0, 1, 'share: droplet, sand or dab density', 0],
  order:       [0, 1, 'share: 0 random, 1 lattice or modal', 0.3],
  sheen:       [0, 1, 'share of thin-film interference', 0],
  filmMinNm:   [80, 900, 'nm, thinnest film', 180],
  filmMaxNm:   [120, 1200, 'nm, thickest film', 760],
  flow:        [0, 1, 'share: advection, smear or wet mix', 0],
  fibre:       [0, 1, 'share: tear fringe, bristle or strand twist', 0],
  line:        [0, 1, 'share: hatch and contour line work', 0],
  lineDeg:     [0, 180, 'deg, dominant line angle', 45],
  tension:     [0, 1, 'share: 0 drifting sine, 1 snapping expo', 0.5],
  fps:         [8, 60, 'frames per second, declared cadence (M5)', 24],
  on:          [1, 3, 'frames each drawing is held (ones, twos, threes)', 1],
  durationS:   [0.25, 8, 's, one build of the piece', 1.6],
  tempo:       [50, 180, 'bpm', 90],
  pitch:       [24, 96, 'MIDI note of the root', 45],
  resonanceHz: [30, 8000, 'Hz, the body resonance', 120],
  decayS:      [0.02, 6, 's, ring time of a hit', 0.4],
  transient:   [0, 1, 'share: attack sharpness, click', 0.4],
  noise:       [0, 1, 'share of noise in the sound', 0.2],
  brightness:  [0, 1, 'share: spectral tilt and filter opening', 0.5],
});

export const NOISE_COLOURS = ['white', 'pink', 'brown'];
export const CURVES = ['engravingReveal', 'glyphCascade', 'revealOut', 'rope', 'linear', 'sineInOut', 'expoOut', 'stepped'];
export const PLATES = ['relief', 'droplets', 'film', 'chladni', 'hatch', 'fibre', 'strands', 'sunburst', 'blocks', 'brush', 'liquid', 'codecells', 'noise', 'glass', 'crt', 'water'];
export const VOICES = ['kick808', 'kick', 'snare', 'clap', 'hat', 'hatRoll', 'sub', 'pluck', 'bell', 'pad', 'noise', 'scrape', 'rip', 'bubble', 'creak'];
export const MODES = ['normal', 'multiply', 'screen', 'add', 'overlay', 'darken', 'lighten', 'difference'];
const HEX = /^#[0-9a-f]{6}$/i;

const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const isNum = x => typeof x === 'number' && Number.isFinite(x);

// Fill defaults and clamp every core number into its range. Returns a new object; never mutates.
export function normalize(m) {
  const core = {};
  for (const [k, [lo, hi, , d]] of Object.entries(CORE)) core[k] = isNum(m.core?.[k]) ? clamp(m.core[k], lo, hi) : d;
  core.on = Math.round(core.on);
  if (core.filmMaxNm < core.filmMinNm + 40) core.filmMaxNm = Math.min(1200, core.filmMinNm + 40);
  const h = m.hints ?? {};
  return {
    schema: SCHEMA, id: String(m.id ?? 'untitled'), name: String(m.name ?? m.id ?? 'Untitled'),
    genre: [...(m.genre ?? [])].map(String),
    palette: { ground: m.palette?.ground ?? '#e8e3d9', ink: m.palette?.ink ?? '#16130f', accent: m.palette?.accent ?? '#c46a2a' },
    noiseColour: NOISE_COLOURS.includes(m.noiseColour) ? m.noiseColour : 'pink',
    core,
    hints: {
      type: { technique: h.type?.technique ?? 'engraved', weight: h.type?.weight ?? 1, face: h.type?.face ?? null, opts: { ...(h.type?.opts ?? {}) }, under: h.type?.under ?? null },
      image: { plates: (h.image?.plates ?? [{ kind: 'noise' }]).map(p => ({ opacity: 1, mode: 'normal', ...p })) },
      motion: { curve: h.motion?.curve ?? 'revealOut', mix: h.motion?.mix ?? null },
      sound: { voices: (h.sound?.voices ?? []).map(v => ({ gain: 1, ...v })), motif: h.sound?.motif ?? null, bed: h.sound?.bed ?? null },
    },
    gate: m.gate ?? null,
    from: m.from ?? null,
  };
}

// Strict check of a material as written (before normalize). Returns { ok, errors: [string] }.
export function validate(m) {
  const e = [];
  if (!m || typeof m !== 'object') return { ok: false, errors: ['material must be an object'] };
  if (m.schema !== undefined && m.schema !== SCHEMA) e.push(`schema must be ${SCHEMA}`);
  if (typeof m.id !== 'string' || !/^[a-z0-9-]+$/.test(m.id)) e.push('id must be lower-case letters, digits and hyphens');
  for (const k of ['ground', 'ink', 'accent']) if (!HEX.test(m.palette?.[k] ?? '')) e.push(`palette.${k} must be #rrggbb`);
  for (const [k, v] of Object.entries(m.core ?? {})) {
    if (!(k in CORE)) { e.push(`core.${k} is not a core parameter`); continue; }
    const [lo, hi, unit] = CORE[k];
    if (!isNum(v) || v < lo || v > hi) e.push(`core.${k} = ${v} is outside ${lo} to ${hi} (${unit})`);
  }
  if (m.noiseColour !== undefined && !NOISE_COLOURS.includes(m.noiseColour)) e.push('noiseColour must be white, pink or brown');
  const h = m.hints ?? {};
  if (!h.type?.technique && !h.type?.face) e.push('hints.type needs a technique or a face');
  for (const p of h.image?.plates ?? []) {
    if (!PLATES.includes(p.kind)) e.push(`hints.image plate "${p.kind}" is unknown`);
    if (p.mode !== undefined && !MODES.includes(p.mode)) e.push(`hints.image mode "${p.mode}" is unknown`);
    if (p.opacity !== undefined && !(isNum(p.opacity) && p.opacity >= 0 && p.opacity <= 1)) e.push('plate opacity must be 0 to 1');
  }
  if (!(h.image?.plates?.length)) e.push('hints.image needs at least one plate');
  if (h.motion?.curve !== undefined && !CURVES.includes(h.motion.curve)) e.push(`hints.motion curve "${h.motion.curve}" is unknown`);
  for (const v of h.sound?.voices ?? []) if (!VOICES.includes(v.voice)) e.push(`hints.sound voice "${v.voice}" is unknown`);
  if (!(h.sound?.voices?.length)) e.push('hints.sound needs at least one voice');
  return { ok: e.length === 0, errors: e };
}

// Canonical JSON (sorted keys, numbers to 6 places) and a 32-bit FNV-1a hash of it, for goldens and seeds.
export function canonical(x) {
  if (Array.isArray(x)) return `[${x.map(canonical).join(',')}]`;
  if (x && typeof x === 'object') return `{${Object.keys(x).sort().filter(k => x[k] !== undefined).map(k => `${JSON.stringify(k)}:${canonical(x[k])}`).join(',')}}`;
  if (typeof x === 'number') return Number.isFinite(x) ? String(+x.toFixed(6)) : 'null';
  return JSON.stringify(x ?? null);
}
export function fnv(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}
export function fnvBytes(b) {
  let h = 0x811c9dc5;
  for (let i = 0; i < b.length; i++) { h ^= b[i]; h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}
export const hashMaterial = m => fnv(canonical(normalize(m))).toString(16).padStart(8, '0');
