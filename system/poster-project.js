import { POSTER_FORMATS, POSTER_FACES, POSTER_CELLS, POSTER_BLOCK_KINDS } from './poster.js?v=20260907-flex-composition';

export const MAX_PROJECT_BYTES = 9 * 1024 * 1024;
export const MAX_IMAGE_CHARS = 8 * 1024 * 1024;
export const MIN_POSTER_BLOCKS = 1;
export const MAX_POSTER_BLOCKS = 8;
const fail = () => { throw new Error('This is not a supported Poster project. Your current work has not changed.'); };
const object = value => value && typeof value === 'object' && !Array.isArray(value) ? value : fail();
const number = (value, min, max) => typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max ? value : fail();
const choice = (value, values) => values.includes(value) ? value : fail();
const string = (value, max) => typeof value === 'string' && value.length <= max ? value : fail();

export function validateProjectImage(data) {
  if (data === null) return null;
  if (typeof data !== 'string' || data.length > MAX_IMAGE_CHARS || !/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(data)) return fail();
  let header;
  try { header = atob(data.slice(22, 66)); } catch (_) { return fail(); }
  if (header.slice(0, 8) !== '\x89PNG\r\n\x1a\n' || header.slice(12, 16) !== 'IHDR') return fail();
  const uint = offset => ((header.charCodeAt(offset) * 16777216) + (header.charCodeAt(offset + 1) << 16) + (header.charCodeAt(offset + 2) << 8) + header.charCodeAt(offset + 3));
  const width = uint(16), height = uint(20);
  number(width, 1, 8192); number(height, 1, 8192);
  if (width * height > 32000000) return fail();
  return data;
}

function cleanState(input, options) {
  const state = object(input), art = object(state.art);
  const list = (value, allowed, max) => {
    if (!Array.isArray(value) || value.length > max) return fail();
    return value.map(item => choice(item, allowed));
  };
  if (!Array.isArray(state.blocks) || state.blocks.length < MIN_POSTER_BLOCKS || state.blocks.length > MAX_POSTER_BLOCKS) return fail();
  const blocks = state.blocks.map((inputBlock) => {
    const block = object(inputBlock);
    const clean = {
      kind: choice(block.kind, POSTER_BLOCK_KINDS),
      text: string(block.text, 4000), face: choice(block.face, Object.keys(POSTER_FACES)),
      size: number(block.size, 0.01, 0.16), tracking: number(block.tracking, -0.04, 0.4),
      leading: number(block.leading, 0.9, 1.8), align: choice(block.align, ['left', 'center', 'right']),
      cell: choice(block.cell, POSTER_CELLS), caseMode: choice(block.caseMode, ['none', 'upper', 'lower']),
      color: typeof block.color === 'string' && /^#[0-9a-fA-F]{6}$/.test(block.color) ? block.color : fail(),
    };
    if (block.position !== undefined) {
      const position = object(block.position);
      clean.position = { x: number(position.x, 0, 1), y: number(position.y, 0, 1) };
    }
    if (block.weight !== undefined) clean.weight = number(block.weight, 100, 900);
    return clean;
  });
  return {
    format: choice(state.format, Object.keys(POSTER_FORMATS)), margin: number(state.margin, 0.02, 0.2), blocks,
    art: {
      seed: string(art.seed, 80), layers: list(art.layers, ['showpiece-veil', ...(options.layers || [])], 8),
      opacity: number(art.opacity ?? 1, 0, 1), veil: number(art.veil, 0, 0.85),
      veilMode: choice(art.veilMode || 'wash', ['wash', 'panel']),
      retro: art.retro == null ? null : { palette: choice(object(art.retro).palette, ['keep', 'outrun', 'gameboy', 'c64', 'ega', 'pico8', 'aurora']) },
      retroRes: choice(art.retroRes || 'standard', ['fine', 'standard', 'chunky']),
      retroMix: number(art.retroMix ?? 1, 0, 1), fx: list(art.fx || [], options.effects || [], 64),
      fxAmount: number(art.fxAmount ?? 0.6, 0.05, 1),
    },
  };
}

export function encodePosterProject(state, image, options = {}) {
  const clean = cleanState(state, options);
  const png = validateProjectImage(image);
  if (!png && (state.art.image || clean.art.seed.toLowerCase() === 'live')) {
    throw new Error('Choose a fixed artwork seed or add an image before saving this project.');
  }
  const text = JSON.stringify({ schema: 'zentropy.poster', version: 1, state: clean, image: png });
  if (new TextEncoder().encode(text).length > MAX_PROJECT_BYTES) return fail();
  return text;
}

export function decodePosterProject(text, options = {}) {
  if (typeof text !== 'string' || new TextEncoder().encode(text).length > MAX_PROJECT_BYTES) return fail();
  let record;
  try { record = JSON.parse(text); } catch (_) { return fail(); }
  if (record?.schema !== 'zentropy.poster' || record.version !== 1) return fail();
  return { state: cleanState(record.state, options), image: validateProjectImage(record.image) };
}
