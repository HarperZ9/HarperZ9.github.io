// states.mjs: materials have a state, operations change it, and made things come from chains. The well reads this
// table: its heat, cool and grind controls and the fibre chain (well-ops.mjs) move the ground along it, and each
// material names the ground in grounds.mjs that shows it. No number in this file is measured.
//
//   STATES        solid, liquid, gas, powder (a ground-up solid), and how each holds pigment, by the rule the well has
//   OPERATIONS    heat, cool, grind, dissolve, press, dry
//   MATERIALS     a small table: each material's resting state and where each operation leads
//   CHAINS        how a made thing is made, step by step
//   LIVING        pigments from living sources: PROPOSED entries, no measured colour or fade rate behind them
//   SENSES        a two-way rule between the well's picture and sound: PROPOSED, data only, nothing plays
//   apply(id, op) the material an operation leads to, or null
//   chainOf(id)   the chain that ends in a material, or null
//   materialOf(ground)   the material a ground shows, or null
//   replay(from, ops)    the materials passed through from a start by a list of operations, or null if one is not allowed
//   tell(from, ops)      the same path in plain words: "stone, ground to sand, heated to melt"
// Pure: no page, runs in node and the browser.
export const STATES = Object.freeze({
  solid: { holds: 'holds pigment on its surface or in its tooth', rule: 'layers', grounds: ['paper', 'stone-sand', 'metal-plate', 'glass', 'ice', 'wood', 'wet-sheet', 'fibre-sheet'] },
  liquid: { holds: 'carries pigment and lets it spread', rule: 'geometric', grounds: ['water', 'melt', 'pulp'] },
  gas: { holds: 'scatters pigment through its volume, like smoke', rule: 'volume', grounds: ['air', 'cloud-mist'] },
  powder: { holds: 'is a field of grains that pigment stains, or that is itself the pigment', rule: 'partitive', grounds: ['sand', 'snow', 'wood-chips'] },
});
export const OPERATIONS = Object.freeze(['heat', 'cool', 'grind', 'dissolve', 'press', 'dry']);

const M = (name, state, to = {}, ground = null) => Object.freeze({ name, state, to: Object.freeze(to), ground });
// `ground` names the ground in grounds.mjs that shows this material today, where one exists.
export const MATERIALS = Object.freeze({
  stone: M('stone', 'solid', { grind: 'sand' }, 'stone-sand'),
  sand: M('sand', 'powder', { heat: 'melt', grind: 'stone-powder' }, 'sand'),
  'stone-powder': M('stone powder', 'powder', { dissolve: 'slurry' }),
  slurry: M('slurry', 'liquid', { dry: 'stone-powder' }),
  melt: M('melt', 'liquid', { cool: 'glass' }, 'melt'),
  glass: M('glass', 'solid', { heat: 'melt', grind: 'sand' }, 'glass'),
  water: M('water', 'liquid', { heat: 'vapour', cool: 'ice' }, 'water'),
  vapour: M('vapour', 'gas', { cool: 'water' }, 'cloud-mist'),
  ice: M('ice', 'solid', { heat: 'water', grind: 'snow' }, 'ice'),
  snow: M('snow', 'powder', { heat: 'water', press: 'ice' }, 'snow'),
  wood: M('wood', 'solid', { grind: 'wood-chips' }, 'wood'),
  'wood-chips': M('wood chips', 'powder', { dissolve: 'pulp' }, 'wood-chips'),
  pulp: M('pulp', 'liquid', { press: 'wet-sheet' }, 'pulp'),
  'wet-sheet': M('wet fibre sheet', 'solid', { dry: 'fibre-sheet' }, 'wet-sheet'),
  'fibre-sheet': M('fibre sheet', 'solid', { dissolve: 'pulp' }, 'fibre-sheet'),
});
export const apply = (id, op) => MATERIALS[id]?.to[op] ?? null;
export const materialOf = (ground) => Object.keys(MATERIALS).find((id) => MATERIALS[id].ground === ground) ?? null;
// What each operation is called once it is done, and the rule it follows, in plain words.
export const DONE = Object.freeze({ heat: 'heated', cool: 'cooled', grind: 'ground', dissolve: 'soaked in water', press: 'pressed', dry: 'dried' });
export const OP_RULE = Object.freeze({ heat: 'heat loosens what holds a material together', cool: 'cooling lets a material set', grind: 'grinding breaks a solid into grains',
  dissolve: 'water takes the grains apart into loose fibres', press: 'pressing drives the water out and mats the fibres together', dry: 'drying takes the last water away and the fibres lock' });
export function replay(from, ops = []) { const path = [from]; if (!MATERIALS[from]) return null; for (const op of ops) { const next = apply(path[path.length - 1], op); if (!next) return null; path.push(next); } return path; }
export function tell(from, ops = []) { const path = replay(from, ops); return path ? path.map((id, i) => (i ? `${DONE[ops[i - 1]]} to ${MATERIALS[id].name}` : MATERIALS[id].name)).join(', ') : ''; }

// A chain is a start and the operations that lead to the made thing. Each step must be a move the table allows.
export const CHAINS = Object.freeze({
  'fibre-sheet': { from: 'wood', steps: ['grind', 'dissolve', 'press', 'dry'], says: 'wood, chipped, pulped in water, pressed into a sheet and dried' },
  glass: { from: 'stone', steps: ['grind', 'heat', 'cool'], says: 'stone, ground to sand, melted and cooled' },
  ice: { from: 'water', steps: ['cool'], says: 'water, cooled' },
});
export const chainOf = (id) => CHAINS[id] ?? null;
export const walk = (chain) => replay(chain.from, chain.steps);

// Pigments from living sources, as the author named them. PROPOSED: the colour, the strength, the transparency and
// the fade are the lead's guesses, entered so the shape exists. None is measured. `settle` names the public
// measurement that would turn each guess into a number. `made` is one line at the level of a craft book.
const L = (name, hex, strength, transparency, fade, made, settle) => Object.freeze({ name, hex, strength, transparency, fade, made, settle, label: 'proposed, not measured' });
export const LIVING = Object.freeze({
  'crushed-grass': L('crushed grass', '#6f8f3a', 0.4, 0.8, 'fast', 'Fresh blades are crushed and the juice is strained.', 'a reflectance spectrum of chlorophyll extract on paper, and a lightfastness rating (blue wool scale) for it'),
  dandelion: L('dandelion', '#e2b72e', 0.5, 0.75, 'fast', 'Flower heads are simmered in water and the liquid is strained.', 'a reflectance spectrum of a dandelion flower dye on fibre, and its blue wool rating'),
  'insect-shell': L('insect shell', '#9e1b34', 0.9, 0.5, 'slow', 'Dried scale insects are ground to a powder and steeped in water.', 'a published reflectance spectrum and blue wool rating for carmine (cochineal) lake'),
});

// Crossing senses. PROPOSED and data only: nothing in this pull request makes or reads sound. Each rule names what
// it reads and what it sets, so the same table can be run either way when a sound layer exists.
export const SENSES = Object.freeze({
  label: 'proposed, data only',
  seeToHear: Object.freeze([['pigment amount by hue', 'pitch class'], ['lightness', 'octave'], ['flow speed', 'tempo'], ['roughness slope', 'noise in the tone'], ['ink coverage', 'loudness']]),
  hearToSee: Object.freeze([['spectrum, band by band', 'hue of the pigment poured'], ['envelope', 'ink coverage'], ['tempo', 'flow speed'], ['noisiness', 'roughness slope'], ['loudness', 'amount poured']]),
});
