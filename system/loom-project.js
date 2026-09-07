// Portable drafts carry actual crossings and color assignments, not generator recipes.
import { STRUCTURES } from './weave-engine.js?v=20260813-wif';
import { validateProjectImage } from './poster-project.js?v=20260907-project-files';

export const MAX_PROJECT_BYTES = 24 * 1024 * 1024;
const fail = () => { throw new Error('This is not a supported Loom project. Your current work has not changed.'); };
const object = v => v && typeof v === 'object' && !Array.isArray(v) ? v : fail();
const num = (v, min, max) => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max ? v : fail();
const int = (v, min, max) => Number.isInteger(num(v, min, max)) ? v : fail();
const bool = v => typeof v === 'boolean' ? v : fail();
const choice = (v, values) => values.includes(v) ? v : fail();
const hex = v => typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v) ? v : fail();
const list = (v, length, check) => Array.isArray(v) && v.length === length ? v.map(check) : fail();
const bit = v => v === true || v === 1 ? true : v === false || v === 0 ? false : fail();

function sourceImage(source) {
  const png = validateProjectImage(source);
  if (!png) return null;
  // Reuse the shared PNG gate, then require Loom's fixed working-image dimensions.
  const h = atob(png.slice(22, 66));
  const uint = o => h.charCodeAt(o) * 16777216 + (h.charCodeAt(o + 1) << 16) + (h.charCodeAt(o + 2) << 8) + h.charCodeAt(o + 3);
  if (uint(16) !== 640 || uint(20) !== 400) return fail();
  return png;
}
function clean(record) {
  object(record);
  if (record.schema !== 'zentropy.loom' || record.version !== 1) return fail();
  const d = object(record.draft), s = object(record.settings), c = object(record.colors);
  const ends = int(d.ends, 1, 2048), picks = int(d.picks, 1, 2048);
  const cells = ends * picks;
  if (cells > 1048576) return fail();
  const shafts = int(d.shafts, 1, 64), treadles = int(d.treadles, 1, 256), perCell = bool(d.perCell);
  const draft = {
    ends, picks, shafts, treadles, perCell,
    threading: list(d.threading, ends, v => int(v, 0, shafts - 1)),
    treadling: list(d.treadling, picks, v => int(v, 0, treadles - 1)),
    tieup: list(d.tieup, treadles, row => list(row, shafts, bit)),
    luma: list(d.luma, cells, v => num(v, 0, 1)),
    pickTone: list(d.pickTone, picks, v => num(v, 0, 1)),
    lifts: perCell ? list(d.lifts, cells, bit) : null,
  };
  const settings = {
    structureId: choice(s.structureId, Object.keys(STRUCTURES)),
    sett: int(s.sett, 48, 240), tone: int(s.tone, 0, 100),
    warp: choice(s.warp, ['bone', 'ink', 'indigo', 'rust', 'gold', 'custom']), warpColor: hex(s.warpColor),
    weft: choice(s.weft, ['image', 'bone-ink', 'ember', 'indigo-bone']),
    speed: int(s.speed, 2, 120), epi: int(s.epi, 6, 60),
    weave: bool(s.weave), woven: int(s.woven, 0, picks),
    view: choice(s.view, ['cloth', 'draft']), zoom: choice(s.zoom, [1, 2, 4, 8]),
  };
  if ((settings.sett - 48) % 8 || (settings.epi - 6) % 2) return fail();
  // Bound the real chart allocation as well as the number of draft cells.
  const cols = ends + treadles + 3, cell = Math.max(3, Math.floor(1200 * settings.zoom / cols));
  const width = cols * cell, height = (picks + shafts + 3) * cell;
  if (width > 16384 || height > 16384 || width * height > 64000000) return fail();
  if (!Array.isArray(c.weftHexes) || c.weftHexes.length < 1 || c.weftHexes.length > 256) return fail();
  const colors = { warpHex: hex(c.warpHex), weftHexes: c.weftHexes.map(hex),
    indices: list(c.indices, picks, v => int(v, 0, c.weftHexes.length - 1)) };
  return { schema: 'zentropy.loom', version: 1, draft, colors, settings,
    source: sourceImage(record.source), edited: bool(record.edited), imported: bool(record.imported) };
}

export function encodeLoomProject(project) {
  const d = object(project.draft), c = object(project.colors);
  // Check dimensions before sampling runtime closures or allocating their grids.
  const ends = int(d.ends, 1, 2048), picks = int(d.picks, 1, 2048);
  if (ends * picks > 1048576) return fail();
  const record = clean({ schema: 'zentropy.loom', version: 1,
    draft: { ends, picks, shafts: d.shafts, treadles: d.treadles, perCell: !!d.perCell,
      threading: d.threading, treadling: d.treadling, tieup: d.tieup,
      luma: Array.from({ length: ends * picks }, (_, i) => d.lumaAt ? d.lumaAt(i % ends, Math.floor(i / ends)) : 0),
      pickTone: Array.from({ length: picks }, (_, p) => d.pickTone?.[p] ?? 0),
      lifts: d.perCell ? Array.from({ length: ends * picks }, (_, i) => d.liftAt(i % ends, Math.floor(i / ends))) : null },
    colors: { warpHex: c.warpHex, weftHexes: c.weftHexes, indices: Array.from({ length: picks }, (_, p) => c.weftIndexAt(p)) },
    settings: project.settings, source: project.source, edited: project.edited, imported: project.imported });
  const text = JSON.stringify(record);
  if (new TextEncoder().encode(text).length > MAX_PROJECT_BYTES) return fail();
  return text;
}

export function decodeLoomProject(text) {
  if (typeof text !== 'string' || text.length > MAX_PROJECT_BYTES || new TextEncoder().encode(text).length > MAX_PROJECT_BYTES) return fail();
  let value;
  try { value = JSON.parse(text); } catch (_) { return fail(); }
  const record = clean(value), { draft, colors } = record;
  draft.liftAt = draft.perCell ? (e, p) => draft.lifts[p * draft.ends + e]
    : (e, p) => draft.tieup[draft.treadling[p]][draft.threading[e]];
  draft.lumaAt = (e, p) => draft.luma[p * draft.ends + e];
  draft.structureId = record.settings.structureId;
  colors.weftIndexAt = p => colors.indices[p];
  colors.weftHexAt = p => colors.weftHexes[colors.indices[p]];
  return record;
}
