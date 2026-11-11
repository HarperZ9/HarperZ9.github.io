// registry.mjs: one way for any page to mount the site's tools.
//
// THE CONTRACT
//   A surface is a small adapter around a tool that already exists. It declares
//     id        its name, e.g. 'well'
//     tools     the tool folders it loads, e.g. ['world/studio']
//     offers    what it is for, from CAPABILITIES
//     takes     what it accepts, from MEDIA (elements, blend, material, palette, ...)
//     gives     what it hands on, from MEDIA; export formats (png, json, svg) are outputs like any other
//     load()    imports the adapter module, only when a page asks for it
//   and its adapter exports
//     mount(host, input, ctx) -> { update(input), value(), destroy() }
//   input is { elements: [ids], weights, settings }; ctx is { ix, reduced, plain, registry }.
//
//   mount(host, 'well', { elements: ['water', 'ink'] })   mount one surface by element ids
//   mountAll(root)                                        mount every [data-surface] under root (see embed.mjs)
//   chain('elements', 'png')                              the surfaces that carry one medium to another, in order
//                                                         (the bench itself is left out unless skip: [] is passed)
//   toolsFor(elementId), pagesFor(elementId, uses)        what implements an element, and which pages use it
//   unmount(handle), unmountAll()                         tear down: every listener, frame and GL context goes
//
// Reduced motion and plain view are read once here and passed to every adapter: reduced means a settled still,
// plain means no drawn surface at all (the adapter leaves the words and numbers and mounts nothing that moves).
// A bench is the surface 'bench': the design studio's front bench, which other pages open with their own elements.

// What a tool can be for. Wide on purpose: from the shader up to the studio and back down.
export const CAPABILITIES = Object.freeze(['well', 'chart', 'blend', 'field', 'render', 'geometry', 'simulation', 'physics', 'math', 'paint', 'write',
  'type', 'lettering', 'print', 'plot', 'fabricate', 'weave', 'poster', 'sound', 'motion', 'export']);
// What moves between tools.
export const MEDIA = Object.freeze(['elements', 'settings', 'blend', 'material', 'palette', 'field', 'image', 'motion', 'type', 'score', 'graph', 'text', 'numbers',
  'png', 'json', 'svg', 'wav', 'font', 'gcode', 'vox']);

const row = (id, name, offers, takes, gives, mounted, note) => Object.freeze({ id, name, offers, takes, gives, mounted, note });
// Every tool folder on the site, mounted or not. `mounted` names the surface that loads it on the bench, 'frame'
// for the folders every page already shares, or null: not mounted yet.
export const TOOLS = Object.freeze([
  row('world/studio', 'Studio: materials, blend, fluid, lanes', ['blend', 'simulation', 'paint', 'motion', 'type', 'sound'], ['elements', 'material', 'text', 'numbers'], ['material', 'palette', 'image', 'motion', 'type', 'score'], 'well, blend, motion, lettering', 'the bench is built on it'),
  row('system/graph', 'Node graph runtime', ['math', 'export'], ['graph'], ['graph', 'json'], 'recipe', 'runs the recipe as a graph and gives it a stable hash'),
  row('world/lettering', 'Lettering techniques', ['lettering', 'type', 'paint'], ['text', 'type', 'material'], ['image', 'svg'], 'lettering', 'draws the blend’s name in the blend’s technique'),
  row('system/instruments', 'Drawing instruments, wave 8', ['plot', 'poster', 'geometry'], ['palette'], ['image', 'png'], 'plot', 'a pen study in the blend’s inks'),
  row('world/techniques', 'Techniques: noise, timing, rope, burin', ['math', 'paint', 'motion'], ['numbers'], ['field', 'motion'], 'well (through the studio)', 'the fluid and motion lanes read it'),
  row('world/substrate', 'Substrate: measured motion curves, thin film', ['motion', 'physics', 'math'], ['numbers'], ['motion', 'field'], 'motion (through the studio)', 'the motion lane reads its measured curves'),
  row('world/feed-25', 'Compositor: layers, blend modes, grain', ['render', 'paint', 'poster'], ['material', 'field'], ['image'], 'plate (through the studio)', 'the studio’s image lane stacks the blend’s plates on it'),
  row('world/sound', 'Sound engine and voices', ['sound', 'chart'], ['score', 'numbers'], ['wav', 'image'], 'well', 'its short-time Fourier transform (sound/dsp.js) draws the sound ground as a spectrogram; nothing plays'),
  row('world/dataviz', 'Data as sound', ['sound', 'chart'], ['numbers'], ['score'], null, 'a chart row could be heard; waits for the sound layer'),
  row('world/typeengine', 'Living type engine', ['type', 'render', 'motion'], ['text', 'numbers'], ['image', 'png'], 'living', 'sets the blend’s name in a family bent by the leading element’s measurements'),
  row('world/visualizer', 'Sound visualizer', ['render', 'sound', 'field'], ['score'], ['image'], null, 'it draws from a score, and nothing on the bench gives a score until the sound layer exists'),
  row('world/glass', 'Glass, liquid and CRT pieces', ['render', 'physics', 'field'], ['image', 'field'], ['image', 'png'], 'glass', 'shows the blend’s plate through a piece of glass, and gives the well’s glass and ice grounds their refraction (glass-ground.mjs)'),
  row('world/superframe', 'Superframe: the rendering engine', ['render', 'simulation', 'field', 'export'], ['graph', 'material', 'text'], ['image', 'score'], 'well', 'its water medium is the page field; its spectral pigment model (lib/medium/spectral.mjs) mixes wet pigments in the well; its nodes are not on the bench yet'),
  row('world/name-art', 'Name art generators', ['geometry', 'paint', 'poster'], ['text', 'palette'], ['image'], null, ''),
  row('world/creation', 'Creation engine', ['paint', 'math'], ['numbers'], ['image'], null, ''),
  row('world/homage', 'Homage portraits by technique', ['paint', 'lettering'], ['text'], ['image'], null, ''),
  row('world/universe', 'The map and the road', ['geometry', 'field'], ['elements'], ['image'], null, 'a place on the map could open the bench with its own elements'),
  row('world/exhibit', 'Exhibit media runner', ['render', 'field'], ['image'], ['image'], null, ''),
  row('world/playbook', 'Playbook builds and cadence', ['motion', 'render'], ['numbers'], ['motion', 'image'], null, ''),
  row('world/feed-22', 'Chladni plate and sand letters', ['physics', 'simulation', 'lettering'], ['text', 'numbers'], ['image'], null, ''),
  row('world/feed-23', 'Brush engine and Display-P3 canvas studies', ['render', 'paint'], ['numbers'], ['image'], 'well', 'its brush engine (build/brush) paints the chosen pigment in the well, in its own Surface at its own resolution, through brush-field.mjs'),
  row('world/feed-24', 'Bit mosaics and letter tilings', ['geometry', 'lettering'], ['text'], ['image'], null, 'a tiling is the nearest thing to a weave draft on the site'),
  row('world/feed-28', 'Bistable rotation study', ['geometry', 'math'], ['numbers'], ['image'], null, ''),
  row('world/feed-29', 'Capsule lettering', ['lettering'], ['text'], ['image'], null, ''),
  row('world/feed-30', 'Inflated display letters', ['lettering', 'geometry'], ['text'], ['image'], null, ''),
  row('world/feed-32', 'Sequencer written as functions', ['sound', 'math', 'chart'], ['numbers'], ['score', 'image'], null, 'waits for the sound layer'),
  row('system/discovery', 'Discovery lab: laws from data', ['math', 'physics', 'simulation'], ['numbers'], ['numbers', 'json'], null, ''),
  row('system/engine', 'Scalable engine: tiers, workers, particles', ['simulation', 'render'], ['numbers'], ['field'], null, ''),
  row('system/showcase', 'Showcase: orbits and first integrals', ['physics', 'math', 'render'], ['numbers'], ['image', 'json'], null, ''),
  row('system/media', 'Media adapters to one format', ['export'], ['image', 'score', 'text'], ['json'], null, ''),
  row('system/vendor', 'Tutor practice functions', ['write'], ['text'], ['json'], null, ''),
  row('system/kit', 'Kit for standalone tool pages', ['type'], [], [], null, ''),
  row('system/media-engine', 'Media engine: plotter, poster, voxels, fractal', ['plot', 'poster', 'render', 'geometry', 'sound'], ['numbers', 'palette'], ['image', 'svg', 'png'], null, 'its plotter and poster plugins are the next way out to print'),
  row('system/type-forge', 'Type forge: mint a face', ['type'], ['text', 'numbers'], ['font'], null, 'a minted font file is the nearest thing to a made object on the site'),
  row('world/typeface', 'Accession, the type family', ['type'], ['text'], ['font'], null, ''),
  row('system/lessons', 'Lessons on a page', ['write', 'chart'], ['numbers'], ['text'], null, ''),
  row('system/lib', 'Shared system library', ['math'], ['numbers'], ['numbers'], null, ''),
  row('system/explainer', 'Live explainer stage', ['render', 'write'], ['numbers'], ['image'], null, ''),
  row('system/school', 'Night school labs', ['write', 'chart', 'simulation'], ['numbers'], ['image', 'text'], null, ''),
  row('world/site', 'The site’s own parts, this registry among them', ['well', 'chart', 'blend', 'field', 'export'], ['elements', 'settings'], ['blend', 'palette', 'png', 'json'], 'bench', ''),
  row('world/alive', 'The alive layer', ['field', 'motion'], [], ['image'], 'frame', 'on most pages already'),
  row('world/ui', 'The shell, the hand and the old well', ['field', 'type'], ['elements'], ['image'], 'frame', 'on most pages already'),
]);
// Disciplines the vocabulary holds a place for and no tool on the site serves yet.
// Tools that are single files, or live outside world/ and system/ folders, so the folder walk above cannot see them.
// None is mounted on the bench. What each offers is read from its own header; `overlap` names bench code that does
// part of the same job, so the duplication stays visible until it is consolidated.
// Single files and folders outside the world/ and system/ folder rows. `mounted` names the surface that loads it, or null;
// `overlap` names bench code that does part of the same job, so the duplication stays visible until it is consolidated.
const loose = (id, name, offers, note, mounted = null, overlap = null) => Object.freeze({ id, name, offers, takes: [], gives: [], mounted, note, overlap });
export const LOOSE = Object.freeze([
  loose('system/weave-engine.js', 'Weave drafts: threading, tie-up, treadling, WIF', ['weave', 'math'], 'the woven ground’s threads (cloth.mjs) and the Loom lane’s jacquard draft', 'well, loom'),
  loose('system/weave-render.js', 'Cloth and draft chart renderer', ['weave', 'render'], 'draws the Loom lane’s cloth thread by thread', 'loom'),
  loose('system/loom-studio.js', 'The loom: an image to threading, tie-up and treadling', ['weave'], 'runs on the loom page and inside the Studio; the bench reaches its engine and renderer, not its page controller'),
  loose('system/exporters-disciplines.js', 'Exports by discipline: plotter, knitting chart, palette, relief', ['plot', 'fabricate', 'export'], 'its palette writer, under Take it with you (take-files.mjs)', 'recipe'),
  loose('system/relief-stl.js', 'Watertight STL from a height map', ['fabricate'], 'the well leaves as a relief to print, under Take it with you', 'recipe'),
  loose('system/plotter.js', 'Pen plotter: a picture to pen lines, SVG and G-code', ['plot', 'export'], 'the well leaves as a plot and as plotter moves, under Take it with you, with the bench’s own header', 'recipe'),
  loose('system/plot-maps.js', 'Plot maps: terrain and ridgelines for a pen', ['plot', 'geometry'], 'the Plot map lane reads the well as terrain', 'ridges'),
  loose('system/voxel-forge.js', 'Voxel scenes and files', ['fabricate', 'render'], 'the Cubes lane paints the well in cubes and saves a .vox file (with system/voxel.js)', 'voxels'),
  loose('media/raw-native/post-0.8.0/web/shaders/paint', 'Painterly shaders: oil, gouache, watercolour', ['paint', 'render'], 'pigments.mjs mixes four base pigments by Kubelka-Munk over 31 wavelengths, through a latent', null, 'world/site/surfaces/km.mjs: Kubelka-Munk layers from one measured colour and an opacity per element'),
  loose('media/raw-native/tree-ada041f/web/shaders/fibre', 'Watercolour on a random fibre network', ['paint', 'simulation'], 'its fibre network and capillary tensor set how a wash spreads on the fibre sheets (spread.mjs); its own wash is not run', 'well'),
  loose('media/raw-native/tree-ada041f/web/shaders/film', 'Spectral film: negative, print, grain, halation', ['render', 'field'], 'the film stock ground reads its print path through a table, with its halo and grain', 'well'),
]);
export const EMPTY = Object.freeze(CAPABILITIES.filter((c) => ![...TOOLS, ...LOOSE].some((t) => t.offers.includes(c))));

const S = (id, name, tools, offers, takes, gives, file) => Object.freeze({ id, name, tools, offers, takes, gives, load: () => import(file) });
export const SURFACES = Object.freeze({
  bench: S('bench', 'The front bench', ['world/site', 'world/studio', 'system/graph'], ['well', 'chart', 'blend', 'export'], ['elements', 'settings'], ['blend', 'palette', 'png', 'json'], './bench.mjs'),
  well: S('well', 'The well', ['world/studio', 'world/techniques', 'world/feed-23', 'world/superframe', 'world/glass', 'world/sound'], ['well', 'simulation', 'field', 'paint'], ['elements', 'settings', 'blend'], ['image', 'png'], './surface-well.mjs'),
  chart: S('chart', 'Property charts', ['world/studio'], ['chart'], ['elements', 'settings'], ['numbers'], './surface-chart.mjs'),
  blend: S('blend', 'The blend table', ['world/studio'], ['blend', 'chart'], ['elements'], ['blend', 'material', 'palette'], './surface-blend.mjs'),
  motion: S('motion', 'Motion curve', ['world/studio', 'world/substrate', 'world/techniques'], ['motion', 'chart'], ['blend', 'material'], ['motion'], './surface-lanes.mjs'),
  lettering: S('lettering', 'Lettering', ['world/studio', 'world/lettering'], ['lettering', 'type'], ['blend', 'material', 'text'], ['type', 'image'], './surface-lanes.mjs'),
  plot: S('plot', 'Pen study', ['system/instruments'], ['plot', 'poster', 'geometry'], ['palette'], ['image', 'png'], './surface-lanes.mjs'),
  plate: S('plate', 'Plate', ['world/studio', 'world/feed-25', 'world/techniques'], ['render', 'paint', 'poster'], ['blend', 'material'], ['image', 'png'], './surface-more.mjs'),
  glass: S('glass', 'Through glass', ['world/glass', 'world/studio'], ['render', 'physics'], ['blend', 'image'], ['image', 'png'], './surface-more.mjs'),
  living: S('living', 'Living type', ['world/typeengine'], ['type', 'render'], ['elements', 'text', 'numbers'], ['image', 'png'], './surface-more.mjs'),
  loom: S('loom', 'Loom', ['world/site'], ['weave', 'render'], ['image', 'palette'], ['image', 'png'], './surface-studio.mjs'),
  ridges: S('ridges', 'Plot map', ['world/site'], ['plot', 'geometry'], ['image', 'palette'], ['image'], './surface-studio.mjs'),
  voxels: S('voxels', 'Cubes', ['world/site'], ['fabricate', 'render', 'geometry'], ['image', 'palette'], ['image', 'vox'], './surface-studio.mjs'),
  recipe: S('recipe', 'Recipe', ['system/graph', 'world/studio'], ['export', 'math'], ['elements', 'settings', 'blend'], ['graph', 'json'], './recipe.mjs'),
  // A named place for the sound layer. Nothing is mounted behind it in this version and nothing plays.
  // It is shaped to the site music interface being built apart from this work: an object with start(), stop(),
  // setLevel(0..1) and setMood(id), where setMood also takes an element id through a map of moods. When that
  // lands, the adapter here calls setMood with the leading element's id (moods.json is the map, a proposal for
  // the author to edit), never calls start() itself, and hands the music's score on to world/visualizer.
  sound: Object.freeze({ id: 'sound', name: 'Sound layer (not built yet)', tools: ['world/sound', 'world/dataviz', 'world/visualizer'], offers: ['sound'], takes: ['elements', 'blend', 'score'], gives: ['score', 'wav'], load: null,
    wants: Object.freeze(['start', 'stop', 'setLevel', 'setMood']), moods: './moods.json' }),
});

const live = new Set();
let shared = null;
export const prefs = () => ({
  reduced: typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches,
  plain: typeof document !== 'undefined' && document.documentElement.classList.contains('plain'),
});
// The element table is fetched once and shared by every surface on the page.
export async function elements(url = '/world/ui/shell/organic/data/elements.json') {
  if (!shared) shared = (async () => { const { indexElements } = await import('./elements-data.mjs'); return indexElements(await (await fetch(url)).json()); })();
  return shared;
}

export async function mount(host, id, input = {}, ctx = {}) {
  const s = SURFACES[id];
  if (!s) throw new Error(`surfaces: no surface named "${id}" (there are ${Object.keys(SURFACES).join(', ')})`);
  if (!s.load) throw new Error(`surfaces: "${id}" has a place in the registry and nothing behind it yet`);
  const ix = ctx.ix || await elements(), mod = await s.load();
  const fn = mod[`mount_${id}`] || mod.mount;
  const inner = await fn(host, { elements: [], weights: null, settings: {}, ...input }, { ...prefs(), ...ctx, ix, registry: api });
  const handle = { id, host, update: (next) => inner.update?.(next), value: () => inner.value?.(), destroy() { if (!live.delete(handle)) return; inner.destroy?.(); host.removeAttribute('data-surface-live'); } };
  host.setAttribute('data-surface-live', id); live.add(handle);   // the ready signal: the attribute appears only when the surface has finished mounting
  return handle;
}
export const unmount = (h) => h?.destroy();
export function unmountAll() { for (const h of [...live]) h.destroy(); }
export const mounted = () => [...live].map((h) => h.id);

// The surfaces that carry `from` to `to`, shortest first: the bench's settings down to a picture, or back.
export function chain(from, to, { skip = ['bench'] } = {}) {
  const queue = [[from, []]], seen = new Set([from]);
  while (queue.length) {
    const [m, path] = queue.shift();
    for (const s of Object.values(SURFACES)) {
      if (!s.load || skip.includes(s.id) || !s.takes.includes(m) || path.includes(s.id)) continue;
      if (s.gives.includes(to)) return [...path, s.id];
      for (const g of s.gives) if (!seen.has(g)) { seen.add(g); queue.push([g, [...path, s.id]]); }
    }
  }
  return null;
}

// What implements an element: every surface can draw any element of the table, so the honest answer is which
// tools the element's own data reaches. Measured properties reach the well and the charts; a measured colour
// reaches the palette, lettering and the pen study; links reach the blend table.
export function toolsFor(el) {
  const out = [];
  const add = (surface, why) => { for (const t of SURFACES[surface].tools) if (!out.some((o) => o.tool === t && o.surface === surface)) out.push({ tool: t, surface, why }); };
  if ((el.properties || []).length) { add('well', 'its measured properties drive the well'); add('chart', 'its measured properties are charted'); }
  else add('well', 'only its colour reaches the well; nothing else is measured');
  if (el.colour?.hex) { add('lettering', 'its colour inks the lettering'); add('plot', 'its colour is one of the pens'); add('plate', 'its colour tints the plate'); add('glass', 'the plate is seen through glass'); }
  if ((el.properties || []).length >= 3) add('living', 'its measured properties bend the living type');
  if ((el.links || []).length) add('blend', 'its measured links fill the blend table');
  return out;
}
// Which pages use an element: read from the census (scripts/surface-census.mjs writes uses.json).
export const pagesFor = (id, uses) => (uses?.pages || []).filter((p) => (p.elements || []).includes(id)).map((p) => ({ path: p.path, title: p.title, surfaces: p.surfaces }));

const api = { CAPABILITIES, MEDIA, TOOLS, LOOSE, EMPTY, SURFACES, mount, unmount, unmountAll, mounted, chain, toolsFor, pagesFor, elements, prefs };
export default api;
