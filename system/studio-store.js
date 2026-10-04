// studio-store.js: work kept in this browser, one entry per source (the author's decision of
// 4 October 2026: "this browser"). What is kept is the source's own snapshot, the same state the
// shared undo walks: settings, strokes, a view. Never a file the visitor dropped in; a source that
// handles uploads keeps at most the file's name (its contract's keep() filter decides).
//
// Every read and write is wrapped, so a browser that blocks storage still runs the Studio; the
// store then says so instead of failing quietly. An entry carries a schema id, and anything that
// does not match it (an older save, a hand edit, another site's key) is set aside, not trusted.

export const KEEP_SCHEMA = "studio.session/1";
export const KEEP_PREFIX = "studio.v1.";
export const KEEP_MAX_BYTES = 256 * 1024;   // per source, counted in UTF-16 code units of the JSON

// Plain words for each outcome, for the inspector's keep line.
export function keepMessage(result, sourceName = "this work") {
  if (!result) return "";
  if (result.ok) return "Kept in this browser.";
  if (result.reason === "blocked") return "Not kept: this browser blocks site storage, so a reload starts fresh.";
  if (result.reason === "too-large") {
    const kb = (n) => Math.ceil(n / 1024);
    return `Not kept: ${sourceName} is ${kb(result.bytes)} KB, over the ${kb(result.max)} KB kept per source. Export it or pin it to keep it.`;
  }
  if (result.reason === "full") return "Not kept: this browser's site storage is full. Export it or pin it to keep it.";
  if (result.reason === "unreadable") return "A saved session could not be read, so this source started fresh.";
  return "Not kept.";
}

/**
 * createStore({ storage, maxBytes }) -> { save, load, clear, available }.
 * storage is a Storage-like object (localStorage in the page); a getter that throws counts as blocked.
 * save(source, state) -> { ok, reason?, bytes, max }. load(source) -> { state } | { state: null, reason? }.
 */
export function createStore({ storage, maxBytes = KEEP_MAX_BYTES, now = () => Date.now() } = {}) {
  const get = () => (typeof storage === "function" ? storage() : storage);
  const key = (source) => KEEP_PREFIX + source;

  function available() {
    try {
      const s = get();
      if (!s) return false;
      const probe = KEEP_PREFIX + "probe";
      s.setItem(probe, "1");
      s.removeItem(probe);
      return true;
    } catch (_) { return false; }
  }

  function save(source, state) {
    let text;
    try { text = JSON.stringify({ schema: KEEP_SCHEMA, source, savedAt: now(), state }); }
    catch (err) { console.error("[studio-store] could not serialise " + source + ":", err); return { ok: false, reason: "unserialisable" }; }
    const bytes = text.length * 2;
    if (bytes > maxBytes) return { ok: false, reason: "too-large", bytes, max: maxBytes };
    let s;
    try { s = get(); } catch (_) { return { ok: false, reason: "blocked", bytes, max: maxBytes }; }
    if (!s) return { ok: false, reason: "blocked", bytes, max: maxBytes };
    try { s.setItem(key(source), text); }
    catch (err) {
      const full = err && (err.name === "QuotaExceededError" || err.code === 22 || err.code === 1014);
      return { ok: false, reason: full ? "full" : "blocked", bytes, max: maxBytes };
    }
    return { ok: true, bytes, max: maxBytes };
  }

  function load(source) {
    let raw = null;
    try { const s = get(); raw = s ? s.getItem(key(source)) : null; }
    catch (_) { return { state: null, reason: "blocked" }; }
    if (raw == null) return { state: null };
    try {
      const doc = JSON.parse(raw);
      if (!doc || doc.schema !== KEEP_SCHEMA || doc.source !== source || doc.state == null) throw new Error("schema");
      return { state: doc.state, savedAt: doc.savedAt };
    } catch (_) {
      clear(source);   // set aside: an entry this version cannot read is never applied
      return { state: null, reason: "unreadable" };
    }
  }

  function clear(source) {
    try { const s = get(); if (s) s.removeItem(key(source)); return true; }
    catch (_) { return false; }
  }

  return { save, load, clear, available, key };
}
