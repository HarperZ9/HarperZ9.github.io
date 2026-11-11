// surface-studio.mjs: three of the Studio's own tools, mounted on the bench by their parts. Each reads the well's picture
// as it stands (ctx.picture()) and the blend's colours, and draws with the tool's own code; nothing of a tool is rewritten.
//
//   loom     system/weave-engine.js and system/weave-render.js, the Loom's engine and renderer: the picture becomes a
//            jacquard draft (each crossing's riser count follows its brightness) woven in the blend's colours, warp from the
//            first part, weft rows from the parts nearest each row's tone. Saves the cloth as a picture.
//   ridges   system/plot-maps.js, the Studio's plot maps: the picture read as terrain (bright is high) and drawn as
//            hidden-line ridgelines for a pen, in the blend's ink.
//   voxels   system/voxel.js and system/voxel-forge.js, the Studio's voxels: the picture raised into columns of cubes, height
//            by brightness, lit and painted by the forge's own isometric painter, banded in the blend's colours. Saves a
//            MagicaVoxel .vox file.
// Each surface draws once when mounted and again a moment after the blend changes. Plain view mounts nothing that draws.
import { computeDraft, weftPaletteFor } from '../../../system/weave-engine.js';
import { renderCloth } from '../../../system/weave-render.js';
import { ridgelines } from '../../../system/plot-maps.js';
import { voxelizeHeightGrid } from '../../../system/voxel.js';
import { assignMaterials, renderVoxelScene, toVoxFile } from '../../../system/voxel-forge.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const hexRgb = (h) => [1, 3, 5].map((i) => parseInt((h || '#808080').slice(i, i + 2), 16));
const lum = ([r, g, b]) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
// the well's picture as a brightness grid, w by h, row 0 at the top
function grid(src, w, h) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(src, 0, 0, w, h);
  const d = x.getImageData(0, 0, w, h).data, L = new Float32Array(w * h), rows = [];
  for (let i = 0; i < w * h; i++) L[i] = lum([d[i * 4], d[i * 4 + 1], d[i * 4 + 2]]);
  for (let y = 0; y < h; y++) { let r = 0, g = 0, b = 0; for (let k = 0; k < w; k++) { const o = (y * w + k) * 4; r += d[o]; g += d[o + 1]; b += d[o + 2]; } rows.push([r / w, g / w, b / w]); }
  return { L, rows };
}
function save(name, blob) { const a = document.createElement('a'), url = URL.createObjectURL(blob); a.href = url; a.download = name; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000); }
const colours = (ix, ids) => ids.map((id) => ix.byId.get(id)?.colour?.hex).filter(Boolean);

const KINDS = {
  loom: { says: 'The well woven on the Loom: a jacquard draft, where each crossing lifts more warp the brighter the picture is there.', save: 'Save the cloth',
    draw(c, src, hexes) { const ends = 96, picks = 72, g = grid(src, ends, picks), d = computeDraft(g.L, ends, picks, 'jacquard', { toneDrive: 1 });
      const pal = weftPaletteFor(d, (p) => g.rows[p], hexes.length > 1 ? hexes.slice(1) : hexes), warpHex = hexes[0];
      renderCloth(c, d, { warpHex, weftHexAt: (p) => pal.hexes[pal.indexAt(p)] }, { maxWidth: 720, maxHeight: 540 }); return { ends, picks, warp: warpHex, weft: pal.hexes.length }; },
    file: (st) => ({ name: 'cloth.png', blob: null, canvas: st.canvas }) },
  ridges: { says: 'The well as a plot map: its brightness read as height, drawn as ridgelines a pen could follow, the near rows hiding the far.',
    draw(c, src, hexes) { const w = 240, h = 180, g = grid(src, w, h), lines = ridgelines(g.L, w, h, { rows: 54, lift: 0.3, sampleStep: 2 }), x = c.getContext('2d');
      c.width = 720; c.height = 540; x.fillStyle = '#0c1620'; x.fillRect(0, 0, c.width, c.height); x.strokeStyle = hexes[0] || '#f4efe6'; x.lineWidth = 1.3; x.lineJoin = x.lineCap = 'round';
      const k = c.width / w; for (const l of lines) { x.beginPath(); l.forEach(([px, py], i) => (i ? x.lineTo(px * k, py * k) : x.moveTo(px * k, py * k))); x.stroke(); }
      return { lines: lines.length, points: lines.reduce((s, l) => s + l.length, 0) }; } },
  voxels: { says: 'The well raised in cubes: each column as tall as the picture is bright there, banded in the blend’s colours by height.', save: 'Save the cubes (.vox)',
    draw(c, src, hexes, st) { const w = 40, h = 30, g = grid(src, w, h), rows = Array.from({ length: h }, (_, y) => Array.from(g.L.subarray(y * w, (y + 1) * w)));
      const vox = voxelizeHeightGrid(rows, 16), mat = assignMaterials(vox, () => 0.5, null), cols = hexes.length ? hexes : ['#808080'];
      const palette = [[0, 0, 0], ...[0, 1, 2, 3, 4].map((i) => hexRgb(cols[Math.min(cols.length - 1, Math.floor(i * cols.length / 5))]))];
      st.scene = { vox, mat, palette, meta: { seed: 'bench', study: 'relief', res: [vox.nx, vox.ny, vox.nz] } }; c.width = 720; c.height = 540;
      renderVoxelScene(c.getContext('2d'), st.scene, c.width, c.height, { ground: '#0c1620' }); let n = 0; for (const v of vox.occ) n += v; return { voxels: n, size: [vox.nx, vox.ny, vox.nz] }; },
    file: (st) => ({ name: 'well.vox', blob: new Blob([toVoxFile(st.scene)], { type: 'application/octet-stream' }) }) },
};

function mountKind(kind, host, input, ctx) {
  const K = KINDS[kind], st = { canvas: null, drawn: 0, facts: null, scene: null }; let state = { ...input }, timer = 0;
  host.classList.add('sf-studio', `sf-${kind}`);
  host.innerHTML = `${ctx.plain ? '' : '<canvas class="pl" width="720" height="540"></canvas>'}<p class="ln-note">${esc(K.says)}</p>${K.save && !ctx.plain ? `<button type="button" data-studio-save>${esc(K.save)}</button>` : ''}`;
  st.canvas = host.querySelector('canvas');
  const draw = () => { timer = 0; const src = ctx.picture?.(); if (!st.canvas || !src) return;
    try { st.facts = K.draw(st.canvas, src, colours(ctx.ix, state.elements || []), st); st.drawn++; st.canvas.dataset.drawn = st.drawn; } catch (e) { console.info(`${kind}: not drawn:`, e.message); } };
  const later = () => { clearTimeout(timer); timer = setTimeout(draw, ctx.reduced ? 0 : 400); };
  const onClick = (ev) => { if (!ev.target.closest('[data-studio-save]')) return; const stem = (state.elements || []).join('-') || 'bench';
    if (kind === 'voxels' && st.scene) { const f = K.file(st); save(`${stem}.${f.name}`, f.blob); } else st.canvas?.toBlob((b) => b && save(`${stem}.${kind}.png`, b), 'image/png'); };
  host.addEventListener('click', onClick); later();
  return { update(next) { state = { ...state, ...next }; later(); }, value: () => ({ canvas: st.canvas, drawn: st.drawn, facts: st.facts, redraw: draw }),
    destroy() { clearTimeout(timer); host.removeEventListener('click', onClick); host.innerHTML = ''; host.classList.remove('sf-studio', `sf-${kind}`); } };
}
export const mount_loom = (h, i, c) => mountKind('loom', h, i, c);
export const mount_ridges = (h, i, c) => mountKind('ridges', h, i, c);
export const mount_voxels = (h, i, c) => mountKind('voxels', h, i, c);
