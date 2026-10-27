// studio-presets.js: named setups for every source (9 October 2026). A preset is a source's own
// snapshot (the same state its Undo and its kept session use) under a name the visitor chose, kept
// in this browser under "studio.presets.v1.<source>". Applying one puts the setup back as one undo
// step. Project files carry the presets too. The pure half: no DOM, runs in Node.

export const PRESET_PREFIX = "studio.presets.v1.";
export const PRESET_LIMIT = 40;
export const PRESET_MAX_BYTES = 256 * 1024;

const cleanName = (n) => String(n || "").replace(/\s+/g, " ").trim().slice(0, 60);

/** createPresets({ storage }) -> { list, save, remove, all, putAll } */
export function createPresets({ storage, now = () => Date.now() } = {}) {
  const get = () => { try { return typeof storage === "function" ? storage() : storage; } catch (_) { return null; } };
  const read = (source) => {
    const s = get(); if (!s) return [];
    try { const v = JSON.parse(s.getItem(PRESET_PREFIX + source) || "[]"); return Array.isArray(v) ? v.filter((p) => p && typeof p.name === "string" && "state" in p) : []; }
    catch (_) { return []; }
  };
  const write = (source, list) => {
    const s = get(); if (!s) return { ok: false, reason: "blocked" };
    const text = JSON.stringify(list);
    if (text.length > PRESET_MAX_BYTES) return { ok: false, reason: "too large" };
    try { s.setItem(PRESET_PREFIX + source, text); return { ok: true }; } catch (_) { return { ok: false, reason: "full" }; }
  };
  return {
    list: (source) => read(source),
    /** save(source, name, state): a preset with the same name is replaced; the newest comes first. */
    save(source, name, state) {
      const n = cleanName(name);
      if (!n) return { ok: false, reason: "no name" };
      if (state == null) return { ok: false, reason: "nothing to keep yet" };
      const list = read(source).filter((p) => p.name !== n);
      list.unshift({ name: n, savedAt: now(), state: JSON.parse(JSON.stringify(state)) });
      if (list.length > PRESET_LIMIT) list.length = PRESET_LIMIT;
      return { ...write(source, list), name: n };
    },
    remove(source, name) { return write(source, read(source).filter((p) => p.name !== name)); },
    all(sources) { const out = {}; for (const s of sources) { const l = read(s); if (l.length) out[s] = l; } return out; },
    putAll(map, sources) {
      const done = [];
      for (const [s, l] of Object.entries(map || {})) if (sources.includes(s) && Array.isArray(l)) { if (write(s, l.slice(0, PRESET_LIMIT)).ok) done.push(s); }
      return done;
    },
  };
}
