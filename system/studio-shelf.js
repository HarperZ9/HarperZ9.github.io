// studio-shelf.js — the studio's memory: everything a visitor makes, pinned as a recipe.
//
// A pin is not the artefact, it is the RECIPE that reproduces it exactly: the seed, study,
// method, register, blend, the voxel build's edit trail, the sketch module's own payload. The
// artefact can always be rebuilt from the recipe, so the shelf stays small enough to live in
// localStorage and travel as a file. Non-extractive by design: no streaks, no counts shown off,
// no expiry — the shelf is the user's memory, not an engagement mechanic, and deleting from it
// is always the user's call (a full shelf REFUSES a new pin rather than silently dropping an
// old one).
//
// Three rules the whole module bends around:
//
//   determinism — nothing here calls Date.now() or Math.random(). The stamp is an ISO string
//     the CALLER passes in, and the id is a hash of the recipe's canonical JSON (sorted keys),
//     so the same creation re-pinned on any machine, any day, lands on the same id and updates
//     in place instead of duplicating.
//   no lying about persistence — every write is read back and compared before add/remove/
//     retitle report ok. A quota-full or disabled storage surfaces as { ok: false, why } and
//     the in-memory list rolls back to match what storage actually holds; it never throws into
//     the caller and never claims a pin persisted when it did not.
//   whole or nothing on import — a file someone hands us is either taken entirely (every pin
//     validated, every id re-derived and checked against its recipe) or refused entirely with
//     why. Half-imports are how shelves rot. Loading our OWN storage key is the one asymmetry:
//     there the good pins are kept and the broken dropped, because torching a user's whole
//     shelf over one corrupt entry would destroy their work to punish our bug.
//
// The shelf never touches the DOM and never imports the modules whose work it remembers; the
// recipe fields mirror studio.js's plot/voxel state and voxel-forge's meta by shape, not by
// import, so this file stays testable in node with a Map-backed storage stub.

export const STORAGE_KEY = "studio.shelf.v1";
export const THUMB_CAP = 40000; // chars of dataURL — one greedy thumb must not eat the quota

const APP = "studio-shelf";

// Same FNV-1a everything else in the plot family uses (plotter.js, plot-maps.js, …): tiny,
// stable across engines, and already proven on seed strings.
function hash32(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i += 1) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}

// Canonical JSON: object keys sorted at every depth, undefined collapsed to null. JSON.stringify
// alone is NOT canonical — key order follows insertion, so the same recipe built by two code
// paths would hash to two ids and the dedup promise would quietly break.
function canonical(value) {
  if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
  if (value && typeof value === "object") {
    const keys = Object.keys(value).sort();
    return "{" + keys.map((k) => JSON.stringify(k) + ":" + canonical(value[k])).join(",") + "}";
  }
  return JSON.stringify(value === undefined ? null : value);
}

// The id hashes kind + recipe — NOT the thumb (pixels are derived, not identity), NOT the stamp
// (re-pinning tomorrow is the same creation), NOT the title (renaming a pin must not fork it).
// Kind is folded in so two kinds that happen to share a recipe shape cannot collide.
function deriveId(kind, recipe) {
  return hash32(kind + "|" + canonical(recipe)).toString(16).padStart(8, "0");
}

// ── recipe validation ───────────────────────────────────────────────────────
// Only the fields a kind needs are kept: normalization strips junk BEFORE hashing, so a caller
// that passes extra state along for the ride cannot fork the id of an identical creation.

const STR = (x) => typeof x === "string" && x.length > 0;
const NUM = (x) => Number.isFinite(x);
const KIND_FIELDS = {
  field:  { need: { seed: STR, study: STR },
            may:  { register: STR, density: NUM, levels: NUM } },
  image:  { need: { source: STR, method: STR },
            may:  { material: STR, seed: STR, register: STR, density: NUM, levels: NUM, plateId: STR } },
  voxel:  { need: {}, may: { register: STR } },   // carried entirely by the voxel block below
  sketch: { need: {}, may: { seed: STR } },       // carried entirely by the opaque sketch payload
  blend:  { need: { seed: STR, study: STR, material: STR, blend: (x) => x === "under" || x === "over" },
            may:  { source: STR, method: STR, register: STR, density: NUM, levels: NUM, plateId: STR } },
};

// The voxel block mirrors buildVoxelScene's meta (seed, study, res, tune) plus the ORDERED op
// log the studio accumulates. Order is load-bearing: a hand edit made after a quarter turn
// addresses the ROTATED grid, so turns and edits cannot be stored as separate piles — replaying
// "2 turns, then these edits" would land every pre-turn edit on the wrong cell. seed + the ops,
// in the order they happened, is the honest identity of a build. faceId is the pick buffer's
// NUMERIC face id (0 top, 1 right, 2 left), exactly what applyVoxelEdit consumes.
function normVoxel(v) {
  if (!v || typeof v !== "object" || !STR(v.study) || v.seed == null) return null;
  const out = { study: v.study, seed: String(v.seed) };
  if (v.res != null) { if (!Number.isInteger(v.res) || v.res < 8) return null; out.res = v.res; }
  if (v.tune != null) {
    if (typeof v.tune !== "object" || !NUM(v.tune.a) || !NUM(v.tune.b) || !NUM(v.tune.c)) return null;
    out.tune = { a: v.tune.a, b: v.tune.b, c: v.tune.c };
  } else out.tune = null;
  if (v.ops != null) {
    if (!Array.isArray(v.ops)) return null;
    out.ops = [];
    for (const o of v.ops) {
      if (!o || typeof o !== "object") return null;
      if (o.op === "turn") {
        if (o.dir !== 1 && o.dir !== -1) return null;
        out.ops.push({ op: "turn", dir: o.dir });
      } else if (o.op === "edit") {
        if (!Number.isInteger(o.cellIndex) || o.cellIndex < 0
          || !Number.isInteger(o.faceId) || o.faceId < 0 || o.faceId > 2
          || (o.mode !== "build" && o.mode !== "chisel" && o.mode !== "paint")) return null;
        out.ops.push({ op: "edit", cellIndex: o.cellIndex, faceId: o.faceId, mode: o.mode });
      } else return null;
    }
  } else out.ops = [];
  return out;
}

function normalizeRecipe(kind, raw) {
  const spec = KIND_FIELDS[kind];
  if (!spec) return { ok: false, why: `unknown kind "${kind}"` };
  if (!raw || typeof raw !== "object") return { ok: false, why: "recipe must be an object" };
  const out = {};
  for (const name of Object.keys(spec.need)) {
    if (!spec.need[name](raw[name])) return { ok: false, why: `${kind} recipe needs ${name}` };
    out[name] = raw[name];
  }
  for (const name of Object.keys(spec.may)) {
    if (raw[name] != null) {
      if (!spec.may[name](raw[name])) return { ok: false, why: `${kind} recipe: ${name} is malformed` };
      out[name] = raw[name];
    }
  }
  if (kind === "voxel" || (kind === "blend" && raw.voxel != null)) {
    const v = normVoxel(raw.voxel);
    if (!v) return { ok: false, why: `${kind} recipe: voxel block needs { study, seed } and sound edits` };
    out.voxel = v;
  } else out.voxel = null;
  if (kind === "sketch") {
    // Opaque on purpose: the sketch module owns its payload's shape; the shelf only carries it.
    if (raw.sketch == null) return { ok: false, why: "sketch recipe needs its sketch payload" };
    out.sketch = raw.sketch;
  } else out.sketch = null;
  return { ok: true, recipe: out };
}

// Auto title: study/method + seed, enough to recognise a pin on the shelf. User-editable later
// via retitle(); the auto form is a starting point, never re-imposed.
function deriveTitle(kind, recipe) {
  if (kind === "voxel") return `${recipe.voxel.study} ${recipe.voxel.seed}`;
  if (kind === "sketch") return recipe.seed ? `sketch ${recipe.seed}` : "sketch";
  if (kind === "image") return `${recipe.method} ${recipe.source}`;
  if (kind === "blend") return `${recipe.study} + ${recipe.material} ${recipe.seed}`;
  return `${recipe.study} ${recipe.seed}`;
}

// A stamp is caller-supplied ISO text; Date.parse is a pure check here, not a clock.
const isStamp = (s) => typeof s === "string" && s.length >= 10 && !Number.isNaN(Date.parse(s));

// Oversized thumbs are refused but the PIN is kept, flagged thumbless — losing a preview image
// beats losing the recipe, and beats one pin starving the whole shelf of quota.
function fitThumb(t) {
  if (typeof t !== "string" || t.length === 0) return { thumb: null, thumbless: false };
  if (t.length > THUMB_CAP) return { thumb: null, thumbless: true };
  return { thumb: t, thumbless: false };
}

// Full validation of a pin that arrived from OUTSIDE (an import file, or our own storage key
// after who-knows-what touched it). The id is re-derived from the recipe and must match: an id
// is a claim about content, and a mismatch means the file was edited after export.
function readPin(p) {
  if (!p || typeof p !== "object") return { ok: false, why: "pin is not an object" };
  if (p.v !== 1) return { ok: false, why: `pin version ${p.v} is not 1` };
  if (p.kind == null) return { ok: false, why: "pin has no kind" };
  const norm = normalizeRecipe(p.kind, p.recipe);
  if (!norm.ok) return norm;
  if (!isStamp(p.stamp)) return { ok: false, why: "pin stamp is not an ISO date string" };
  if (!STR(p.title)) return { ok: false, why: "pin has no title" };
  const id = deriveId(p.kind, norm.recipe);
  if (p.id !== id) return { ok: false, why: `pin id ${p.id} does not match its recipe (edited file?)` };
  const { thumb, thumbless } = fitThumb(p.thumb);
  const pin = { v: 1, id, kind: p.kind, title: p.title, stamp: p.stamp, recipe: norm.recipe, thumb };
  if (thumb == null && (thumbless || p.thumbless === true)) pin.thumbless = true;
  return { ok: true, pin };
}

const message = (err) => (err && err.message) ? err.message : String(err);

// ── the shelf ───────────────────────────────────────────────────────────────

/**
 * createShelf({ storage, maxPins }) → the shelf API. `storage` is anything with getItem /
 * setItem / removeItem (localStorage in the browser, a Map-backed stub in tests) — injected,
 * never reached for globally, so node tests need no DOM shim.
 */
export function createShelf(opts = {}) {
  const storage = opts.storage;
  if (!storage || typeof storage.getItem !== "function" || typeof storage.setItem !== "function"
    || typeof storage.removeItem !== "function") {
    // A missing storage is a wiring mistake, not a runtime storage failure — fail loudly at
    // construction instead of returning { ok: false } forever.
    throw new TypeError("createShelf needs a storage with getItem/setItem/removeItem");
  }
  const maxPins = Number.isInteger(opts.maxPins) && opts.maxPins > 0 ? opts.maxPins : 60;

  // Newest first, by shelf activity (pin / re-pin), not by stamp: stamps are caller-passed and
  // can tie, but the shelf always knows its own order.
  let pins = [];

  // Load what storage holds. Own-key asymmetry (see header): keep the pins that validate, drop
  // the broken ones, and let the next successful write re-canonicalise the stored bytes.
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (raw) {
      const env = JSON.parse(raw);
      if (env && env.app === APP && env.v === 1 && Array.isArray(env.pins)) {
        for (const p of env.pins) {
          const got = readPin(p);
          if (got.ok && !pins.some((q) => q.id === got.pin.id)) pins.push(got.pin);
        }
      }
    }
  } catch { pins = []; } // malformed bytes: start empty; the stored junk is left until a write replaces it

  // Write-then-read-back: storage that swallows a write (quota hit mid-string, private mode)
  // must not leave us believing a pin persisted. String equality is the strictest cheap check.
  function persist() {
    const body = JSON.stringify({ app: APP, v: 1, pins });
    try {
      storage.setItem(STORAGE_KEY, body);
      if (storage.getItem(STORAGE_KEY) !== body) return { ok: false, why: "storage did not keep the write" };
      return { ok: true };
    } catch (err) {
      return { ok: false, why: "storage refused the write: " + message(err) };
    }
  }

  // Every mutation follows the same shape: build the next list, swap it in, persist, and roll
  // back to the previous list if storage refused — memory and storage never disagree.
  function commit(next, okExtra) {
    const prev = pins;
    pins = next;
    const w = persist();
    if (!w.ok) { pins = prev; return w; }
    return { ok: true, ...okExtra };
  }

  const clone = (pin) => structuredClone(pin);

  function add(input) {
    if (!input || typeof input !== "object") return { ok: false, why: "nothing to pin" };
    if (input.kind == null) return { ok: false, why: "pin has no kind" };
    const norm = normalizeRecipe(input.kind, input.recipe);
    if (!norm.ok) return norm;
    if (!isStamp(input.stamp)) return { ok: false, why: "pin needs an ISO stamp from the caller" };
    const id = deriveId(input.kind, norm.recipe);
    const { thumb, thumbless } = fitThumb(input.thumb);
    const at = pins.findIndex((p) => p.id === id);
    let next;
    if (at >= 0) {
      // Same creation re-pinned: refresh stamp and thumb, KEEP the user's title (a rename is
      // the user's work too), and move it to the front — it is the newest activity.
      const kept = pins[at];
      const pin = { v: 1, id, kind: kept.kind, title: kept.title, stamp: input.stamp, recipe: kept.recipe, thumb };
      if (thumb == null && thumbless) pin.thumbless = true;
      next = [pin, ...pins.slice(0, at), ...pins.slice(at + 1)];
    } else {
      if (pins.length >= maxPins) return { ok: false, why: "shelf full" };
      const title = STR(input.title) ? input.title : deriveTitle(input.kind, norm.recipe);
      const pin = { v: 1, id, kind: input.kind, title, stamp: input.stamp, recipe: norm.recipe, thumb };
      if (thumbless) pin.thumbless = true;
      next = [pin, ...pins];
    }
    return commit(next, thumbless ? { id, thumbless: true } : { id });
  }

  const list = () => pins.map(clone);
  const get = (id) => { const p = pins.find((q) => q.id === id); return p ? clone(p) : null; };

  function remove(id) {
    const at = pins.findIndex((p) => p.id === id);
    if (at < 0) return { ok: false, why: "no such pin" };
    return commit([...pins.slice(0, at), ...pins.slice(at + 1)]);
  }

  function retitle(id, title) {
    if (!STR(title)) return { ok: false, why: "a title needs at least one character" };
    const at = pins.findIndex((p) => p.id === id);
    if (at < 0) return { ok: false, why: "no such pin" };
    const pin = { ...pins[at], title };
    return commit([...pins.slice(0, at), pin, ...pins.slice(at + 1)]);
  }

  function clear() {
    const prev = pins;
    pins = [];
    try {
      storage.removeItem(STORAGE_KEY);
      if (storage.getItem(STORAGE_KEY) != null) { pins = prev; return { ok: false, why: "storage kept the shelf" }; }
    } catch (err) {
      pins = prev;
      return { ok: false, why: "storage refused the clear: " + message(err) };
    }
    return { ok: true };
  }

  // Pretty on purpose: the export is a file the user owns and may read, diff, or hand-edit —
  // though an edit that touches a recipe will trip the id check on the way back in.
  const exportJSON = () => JSON.stringify({ app: APP, v: 1, pins }, null, 2);

  function importJSON(str, iopts = {}) {
    const refuse = (why) => ({ ok: false, added: 0, skipped: 0, why });
    let env;
    try { env = JSON.parse(String(str)); } catch { return refuse("not JSON"); }
    if (!env || typeof env !== "object" || env.app !== APP) return refuse("not a studio-shelf file");
    if (env.v !== 1) return refuse(`shelf file version ${env.v} is not 1 — whole file refused`);
    if (!Array.isArray(env.pins)) return refuse("shelf file has no pin list");
    // Validate EVERY pin before touching the shelf: one bad pin refuses the whole file. A
    // half-import would leave the user unsure which half of their memory survived.
    const incoming = [];
    for (let i = 0; i < env.pins.length; i += 1) {
      const got = readPin(env.pins[i]);
      if (!got.ok) return refuse(`pin ${i + 1}: ${got.why}`);
      incoming.push(got.pin);
    }
    let added = 0, skipped = 0;
    const have = new Set(iopts.merge ? pins.map((p) => p.id) : []);
    const fresh = [];
    for (const pin of incoming) {
      if (have.has(pin.id)) { skipped += 1; continue; } // also dedups repeats inside the file itself
      have.add(pin.id);
      fresh.push(pin);
      added += 1;
    }
    const next = iopts.merge ? [...fresh, ...pins] : fresh;
    if (next.length > maxPins) return refuse("shelf full");
    const out = commit(next, { added, skipped });
    return out.ok ? out : { ok: false, added: 0, skipped: 0, why: out.why };
  }

  return { add, list, get, remove, retitle, clear, exportJSON, importJSON };
}
