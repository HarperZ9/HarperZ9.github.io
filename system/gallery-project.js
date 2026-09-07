import { specimenLayerNames } from "./generative-field.js";
import { OP_META } from "./glitch-ops.js?v=20260813-wet";
import { validateProjectImage } from "./poster-project.js?v=20260907-gallery-projects";

export const MAX_GALLERY_PROJECT_BYTES = 12 * 1024 * 1024;
export const GALLERY_SCHEMA = "zentropy.gallery";
export const GALLERY_VERSION = 1;

const fail = () => { throw new Error("This is not a supported Gallery project. Your current work has not changed."); };
const object = value => value && typeof value === "object" && !Array.isArray(value) ? value : fail();
const number = (value, min, max) => typeof value === "number" && Number.isFinite(value) && value >= min && value <= max ? value : fail();
const string = (value, max) => typeof value === "string" && value.length <= max ? value : fail();

function bytes(value) {
  return new TextEncoder().encode(value).byteLength;
}

function catalog(values, fallback) {
  const list = Array.isArray(values) ? values : fallback;
  return new Set(list.filter(value => typeof value === "string" && value));
}

function uniqueCatalogList(value, allowed, max) {
  if (!Array.isArray(value) || value.length > max) return fail();
  const seen = new Set();
  return value.map(item => {
    const clean = string(item, 80);
    if (!allowed.has(clean) || seen.has(clean)) return fail();
    seen.add(clean);
    return clean;
  });
}

function projectRules(options = {}) {
  return {
    layers: catalog(options.layers, specimenLayerNames()),
    effects: catalog(options.effects, OP_META.map(meta => meta.op)),
  };
}

function baseImage(value) {
  if (value === null) return null;
  const image = object(value);
  let png;
  try { png = validateProjectImage(image.png); } catch (_) { return fail(); }
  if (!png) return fail();
  const name = string(image.name, 120).trim();
  if (!name) return fail();
  return { name, influence: number(image.influence, 0.1, 1), png };
}

function cleanProject(value, options = {}) {
  const project = object(value);
  const recipe = object(project.recipe);
  const rules = projectRules(options);
  const seed = string(recipe.seed, 48).trim();
  if (!seed) return fail();
  const instruments = uniqueCatalogList(recipe.instruments, rules.layers, 3);
  const material = baseImage(project.baseImage);
  if (!material && instruments.length < 1) return fail();
  const locks = uniqueCatalogList(project.locks || [], rules.layers, 3);
  for (const lock of locks) if (!instruments.includes(lock)) return fail();
  return {
    recipe: { seed, instruments },
    locks,
    effects: uniqueCatalogList(project.effects || [], rules.effects, 64),
    strength: number(project.strength ?? 0.6, 0.1, 1),
    baseImage: material,
  };
}

function cleanRecord(value, options = {}) {
  const record = object(value);
  if (record.schema !== GALLERY_SCHEMA || record.version !== GALLERY_VERSION) return fail();
  return { schema: GALLERY_SCHEMA, version: GALLERY_VERSION, project: cleanProject(record.project, options) };
}

export function encodeGalleryProject(project, options = {}) {
  const record = cleanRecord({ schema: GALLERY_SCHEMA, version: GALLERY_VERSION, project }, options);
  const text = JSON.stringify(record);
  if (bytes(text) > MAX_GALLERY_PROJECT_BYTES) return fail();
  return text;
}

export function decodeGalleryProject(text, options = {}) {
  if (typeof text !== "string" || text.length > MAX_GALLERY_PROJECT_BYTES || bytes(text) > MAX_GALLERY_PROJECT_BYTES) return fail();
  let value;
  try { value = JSON.parse(text); } catch (_) { return fail(); }
  return cleanRecord(value, options);
}
