import { validateProjectImage } from './poster-project.js?v=20260907-native-project';

export const MAX_RETRO_PROJECT_BYTES = 32 * 1024 * 1024;
export const PATCH_CONTROLS = {
  pal: 're-palette', tw: 're-tw', dith: 're-dither', gam: 're-gam', sdf: 're-sdf',
  curv: 're-curv', bloom: 're-bloom', vig: 're-vig', scan: 're-scan', dstr: 're-dstr',
  mask: 're-mask', maskA: 're-maskamt', hal: 're-hal', abr: 're-abr',
  master: 're-fxamount', fxseed: 're-fxseed', fxanim: 're-fxanim', reactAmt: 're-react',
  seed: 're-seed', plate: 're-layers',
};
export const EDITOR_CONTROLS = ['re-brush', 're-ink', 're-brushmode', 're-sym', 're-erase', 're-scope-persist'];
const fail = () => { throw new Error('Unsupported Shader Room project. Your current work has not changed.'); };
const obj = v => v && typeof v === 'object' && !Array.isArray(v) ? v : fail();
const num = (v, lo, hi) => typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi ? v : fail();
const str = (v, max) => typeof v === 'string' && v.length <= max ? v : fail();
const bool = v => typeof v === 'boolean' ? v : fail();
const choice = (v, choices) => choices.includes(v) ? v : fail();
const list = (v, max, fn) => Array.isArray(v) && v.length <= max ? v.map(fn) : fail();
const color = v => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v) ? v : fail();

function control(value, spec) {
  if (!spec) return fail();
  if (spec.choices) return choice(value, spec.choices);
  if (spec.type === 'checkbox') return bool(value);
  if (spec.type === 'range') return num(value, spec.min, spec.max);
  if (spec.type === 'color') return color(value);
  return str(value, 256);
}

function image(value, width, height) {
  if (value === null) return null;
  try { validateProjectImage(value); } catch (_) { return fail(); }
  const h = atob(value.slice(22, 66));
  const uint = i => h.charCodeAt(i) * 16777216 + h.charCodeAt(i + 1) * 65536 + h.charCodeAt(i + 2) * 256 + h.charCodeAt(i + 3);
  if (uint(16) !== width || uint(20) !== height) return fail();
  return value;
}

function clean(input, rules) {
  const r = obj(input), p = obj(r.patch), assets = obj(r.assets), editor = obj(r.editor);
  if (r.schema !== 'zentropy.shader-room' || r.version !== 1 || p.v !== 1) return fail();
  const patch = { v: 1, src: choice(p.src, ['plate', 'upload', 'draw', 'scope', 'shader']), glsl: str(p.glsl, 100000) };
  patch.outputMode = p.outputMode === undefined ? 'retro' : choice(p.outputMode, ['retro', 'clean']);
  for (const [key, id] of Object.entries(PATCH_CONTROLS)) patch[key] = control(p[key], rules.controls[id]);
  patch.fx = list(p.fx, rules.effects.length, v => choice(v, rules.effects));
  patch.amts = {};
  for (const [key, value] of Object.entries(obj(p.amts))) {
    choice(key, rules.effects); patch.amts[key] = num(value, 0, 1);
  }
  patch.knobs = list(p.knobs, 3, v => num(v, 0, 100));
  if (patch.knobs.length !== 3) return fail();
  patch.react = list(p.react, 4, v => choice(v, ['shader', 'pixel', 'bloom', 'effects']));
  patch.layers = list(p.layers, 4, v => {
    const l = obj(v);
    return { name: str(l.name, 120), glsl: str(l.glsl, 100000), blend: choice(l.blend, rules.blends), opacity: num(l.opacity, 0, 1) };
  });
  if (p.userPal !== undefined) {
    patch.userPal = list(p.userPal, 6, color);
    if (patch.userPal.length !== 6) return fail();
  } else if (patch.pal === 'yours') return fail();
  patch.mod = list(p.mod, 12, v => {
    const m = obj(v);
    return { src: choice(m.src, rules.sources), tgt: choice(m.tgt, rules.targets), depth: num(m.depth, -1, 1) };
  });
  const fb = obj(p.fb);
  patch.fb = { on: bool(fb.on), amt: control(fb.amt, rules.controls['re-fb-amt']), zoom: control(fb.zoom, rules.controls['re-fb-zoom']), rot: control(fb.rot, rules.controls['re-fb-rot']) };
  const cleanEditor = {};
  for (const id of EDITOR_CONTROLS) cleanEditor[id] = control(editor[id], rules.controls[id]);
  const cleanAssets = {
    source: image(assets.source, 1280, 800), upload: image(assets.upload, 1280, 800),
    drawing: image(assets.drawing, 1024, 640), scope: image(assets.scope, 1024, 640),
  };
  if (!cleanAssets.source || !cleanAssets.drawing || !cleanAssets.scope || (patch.src === 'upload' && !cleanAssets.upload)) return fail();
  return { schema: r.schema, version: 1, patch, editor: cleanEditor, assets: cleanAssets };
}

export function encodeRetroProject(record, rules) {
  const text = JSON.stringify(clean(record, rules));
  if (new TextEncoder().encode(text).length > MAX_RETRO_PROJECT_BYTES) return fail();
  return text;
}
export function decodeRetroProject(text, rules) {
  if (typeof text !== 'string' || new TextEncoder().encode(text).length > MAX_RETRO_PROJECT_BYTES) return fail();
  let record;
  try { record = JSON.parse(text); } catch (_) { return fail(); }
  return clean(record, rules);
}
