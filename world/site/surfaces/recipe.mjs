// recipe.mjs: what a visitor takes away, and how the bench reads it back.
//   recipeGraph(ix, recipe)   the recipe as a node graph: one node per element, one blend node
//   runRecipe(ix, recipe)     runs that graph on the site's node runtime (system/graph) with the studio's blend,
//                             and returns the blended material with the graph's stable hash
//   mount(host, input, ctx)   the take-away controls: save the picture (PNG), the palette and the recipe (JSON),
//                             the picture as files for other trades (take-files.mjs: a plot, plotter moves, a
//                             relief to print, a palette for paint programs), and load a recipe again. ctx.picture() gives the well's canvas; ctx.onLoad(recipe)
//                             hands a loaded recipe back to the bench.
// A saved file holds only what the bench made and the table's own numbers: element ids and names, shares,
// settings and colours. No reference image and no third-party thumbnail goes into any of them.
import { evaluateGraph, makeNode } from '../../../system/graph/runtime.js';
import { blend } from '../../studio/lib/blend.mjs';
import { materialFor, makeRecipe, readRecipe } from './elements-data.mjs';
import { FILES } from './take-files.mjs';

export function recipeGraph(ix, recipe) {
  const parts = recipe.elements;
  return { id: 'bench',
    nodes: [...parts.map((p, i) => makeNode(`e${i}`, 'element', { id: p.id, settings: p.settings || {} })), makeNode('mix', 'blend', { weights: parts.map((p) => p.weight) })],
    edges: parts.map((_, i) => ({ from: `e${i}.material`, to: `mix.m${i}` })), outputs: ['mix.material'] };
}
export function runRecipe(ix, recipe) {
  const ops = {
    element: { evaluate: (node) => { const el = ix.byId.get(node.params.id); if (!el) throw new Error(`no element ${node.params.id}`); return { material: materialFor(ix, el, node.params.settings) }; } },
    blend: { evaluate: (node, inputs) => ({ material: blend(node.params.weights.map((_, i) => inputs[`m${i}`]), node.params.weights) }) },
  };
  const r = evaluateGraph(recipeGraph(ix, recipe), ops, { backend: 'browser', tier: 'bench' });
  return { ok: r.status === 'MATCH', hash: r.graphHash, material: r.outputs?.['mix.material'] ?? null, order: r.evaluationOrder ?? [] };
}

function save(name, blob) {
  const a = document.createElement('a'), url = URL.createObjectURL(blob);
  a.href = url; a.download = name; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000);
}
const json = (doc) => new Blob([JSON.stringify(doc, null, 1) + '\n'], { type: 'application/json' });

export function mount(host, input, ctx) {
  const { ix } = ctx;
  let state = { ...input }, last = null;
  host.classList.add('sf-take');
  host.innerHTML = `<div class="tk-acts"><button type="button" data-save="png">Save the picture</button><button type="button" data-save="palette">Save the palette</button>
    <button type="button" data-save="recipe">Save the recipe</button><label class="tk-load">Open a recipe<input type="file" accept="application/json,.json" class="sr-only"></label></div>
    <p class="tk-trades-h">For other trades <small>made from the well's picture as it stands; each file is made in this page and saved by your browser, and nothing is sent anywhere</small></p>
    <dl class="tk-trades">${FILES.map((f) => `<div><dt><button type="button" data-file="${f.kind}">${f.label}</button></dt><dd>${f.says}</dd></div>`).join('')}</dl>
    <p class="tk-studio">The plot, relief and palette writers are the Studio's own. <a href="/studio.html">Open the Studio</a>, the site's live media instrument, where the same writers work on moving pictures beside a loom, plot maps and voxels (small cubes that build a solid).</p>
    <p class="tk-note" role="status"></p>`;
  const note = host.querySelector('.tk-note'), say = (t) => { note.textContent = t; };
  const stem = () => state.elements.join('-') || 'bench';
  const build = () => {
    const recipe = makeRecipe(ix, state.elements, state.weights, state.settings, state.ground, state), run = runRecipe(ix, recipe);
    const palette = { format: 'bench.palette/1', colours: [...state.elements.map((id) => ({ name: ix.byId.get(id).name, hex: ix.byId.get(id).colour?.hex, role: 'element, measured colour' })),
      ...(run.material && state.elements.length > 1 ? [{ name: 'mix', hex: run.material.palette.ink, role: 'computed: OKLab mean by share' }] : [])] };
    return { recipe: { ...recipe, graph: run.hash, palette: palette.colours }, palette, run };
  };
  // the picture's pixels at the size the plot and the relief are read at
  const pixels = () => { const c = ctx.picture?.(); if (!c) return null; const s = document.createElement('canvas'); s.width = 420; s.height = Math.max(2, Math.round(420 * c.height / Math.max(1, c.width)));
    const x = s.getContext('2d', { willReadFrequently: true }); x.drawImage(c, 0, 0, s.width, s.height); return { data: x.getImageData(0, 0, s.width, s.height).data, w: s.width, h: s.height }; };
  async function file(kind) {
    const made = build(), px = kind === 'palette-gpl' ? null : pixels(); if (kind !== 'palette-gpl' && !px) { say('There is no picture in plain view. The palette and the recipe still save.'); return null; }
    try { const { makeFile } = await import('./take-files.mjs'), r = made.recipe, about = { recipe: `${r.elements.map((e) => `${e.name} ${e.weight}`).join(', ')}${r.ground ? `, on ${r.ground}` : ''}`, graph: r.graph }, f = makeFile(kind, px, made.palette.colours, stem(), about); save(`${stem()}.${f.ext}`, new Blob([f.body], { type: f.mime })); last = { kind, facts: f.facts, bytes: typeof f.body === 'string' ? f.body.length : f.body.byteLength };
      say(`${f.label} saved${f.facts.lines ? `: ${f.facts.lines} pen lines` : f.facts.triangles ? `: ${f.facts.triangles} triangles` : ''}.`); return last; }
    catch (e) { console.info('take-away: the file could not be made:', e.message); say('That file could not be made here.'); return null; }
  }
  const onClick = (ev) => {
    const fb = ev.target.closest('[data-file]'); if (fb) { file(fb.dataset.file); return; }
    const b = ev.target.closest('[data-save]'); if (!b) return;
    const kind = b.dataset.save, made = build();
    if (kind === 'recipe') { save(`${stem()}.recipe.json`, json(made.recipe)); say('Recipe saved. Open it here again to pick up where you left off.'); }
    else if (kind === 'palette') { save(`${stem()}.palette.json`, json(made.palette)); say('Palette saved.'); }
    else { const c = ctx.picture?.(); if (!c) { say('There is no picture in plain view. The palette and the recipe still save.'); return; }
      c.toBlob((blob) => { if (blob) { save(`${stem()}.png`, blob); say('Picture saved.'); } else say('The picture could not be made here.'); }, 'image/png'); }
  };
  const onFile = async (ev) => {
    const f = ev.target.files?.[0]; if (!f) return;
    try { const r = readRecipe(ix, JSON.parse(await f.text())); ctx.onLoad?.(r); say(`Opened ${r.ids.map((id) => ix.byId.get(id).name).join(', ')}.`); }
    catch (e) { console.info('recipe: could not open:', e.message); say('That file is not a bench recipe.'); }
    ev.target.value = '';
  };
  host.addEventListener('click', onClick); host.querySelector('input[type=file]').addEventListener('change', onFile);
  return { update(next) { state = { ...state, ...next }; }, value: () => ({ ...build(), file, lastFile: last }),
    destroy() { host.removeEventListener('click', onClick); host.innerHTML = ''; host.classList.remove('sf-take'); } };
}
