// fidelity-log.js: the append-only PERCEPTION-FIDELITY ledger (the storage half of the self-improvement
// loop). Every perception the Studio assembles appends its per-sense fidelity record here, so the loop
// can replay how WPRE (colour), PBE (audio), and WPIR (vision) move over time and target the weakest
// sense next. This is the sibling of audit-log.js (which logs certificates); same append-only invariant,
// same IndexedDB pattern, same caller-supplied timestamp. Cites: SPEC-telos-sensory-engine.md move D
// (perception-fidelity ledger, append-only like the certificate audit trail).
//
// Append-only is the binding invariant: openLog / append / replay / list and NOTHING that updates or
// deletes. The object store is keyed by an auto-incrementing sequence (write-once). Zero external deps:
// IndexedDB is built-in. The pure entry logic (normaliseFidelityEntry, orderEntries) is node-testable,
// and the timestamp is ALWAYS caller-supplied (never Date.now() here) so a test can pin it.

import { orderEntries } from "./audit-log.js"; // reuse the stable append-order helper (shared invariant)

export { orderEntries };
export const DB_NAME = "telos-fidelity";
export const STORE = "fidelity";
export const DB_VERSION = 1;

const isStr = v => typeof v === "string";
const numOrNull = v => (typeof v === "number" && isFinite(v) ? v : null);

// Normalise a { wpre, pbe, wpir, source, timestamp } input into the flat, frozen record the store holds.
// Pure: no IndexedDB, no clock. Each metric is coerced to a finite number or honest null (a missing or
// non-measurable sense is null, NEVER a fabricated score). timestamp is caller-supplied (coerced, never
// invented). source is a free label (e.g. "the Atelier / 2D") describing what was perceived.
export function normaliseFidelityEntry({ wpre, pbe, wpir, source = "", timestamp } = {}) {
  return Object.freeze({
    timestamp: typeof timestamp === "number" || isStr(timestamp) ? timestamp : null,
    wpre: numOrNull(wpre),
    pbe: numOrNull(pbe),
    wpir: numOrNull(wpir),
    source: isStr(source) ? source : (source == null ? "" : String(source)),
  });
}

function hasIDB() {
  return typeof indexedDB !== "undefined" && indexedDB !== null;
}

// Open (creating on first use) the fidelity database. Keyed by an auto-incrementing sequence (the append
// order) with a `ts` index. Resolves a handle exposing append / replay / list, all append-safe.
export function openLog({ dbName = DB_NAME } = {}) {
  return new Promise((resolve, reject) => {
    if (!hasIDB()) { reject(new Error("IndexedDB unavailable (fidelity ledger needs a browser)")); return; }
    let req;
    try { req = indexedDB.open(dbName, DB_VERSION); }
    catch (e) { reject(e); return; }
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: "seq", autoIncrement: true });
        store.createIndex("ts", "timestamp", { unique: false });
      }
    };
    req.onerror = () => reject(req.error || new Error("failed to open fidelity db"));
    req.onsuccess = () => resolve(wrapDb(req.result));
  });
}

// Wrap a raw IDBDatabase in the append-only API. The only write is store.add (fails if the key exists),
// so an existing record can never be overwritten. No put(), no delete().
function wrapDb(db) {
  function append(input) {
    const entry = normaliseFidelityEntry(input);
    return new Promise((resolve, reject) => {
      let tx;
      try { tx = db.transaction(STORE, "readwrite"); }
      catch (e) { reject(e); return; }
      const store = tx.objectStore(STORE);
      const r = store.add(entry);
      r.onsuccess = () => resolve({ ...entry, seq: r.result });
      r.onerror = () => reject(r.error || new Error("fidelity append failed"));
    });
  }

  function replay() {
    return new Promise((resolve, reject) => {
      const out = [];
      let tx;
      try { tx = db.transaction(STORE, "readonly"); }
      catch (e) { reject(e); return; }
      const store = tx.objectStore(STORE);
      const cur = store.openCursor();
      cur.onsuccess = () => {
        const c = cur.result;
        if (c) { out.push(c.value); c.continue(); }
        else resolve(orderEntries(out));
      };
      cur.onerror = () => reject(cur.error || new Error("fidelity replay failed"));
    });
  }

  async function list(limit = 50) {
    const all = await replay();
    if (!Number.isFinite(limit) || limit <= 0 || limit >= all.length) return all;
    return all.slice(all.length - limit);
  }

  function close() { try { db.close(); } catch (_) {} }

  return { append, replay, list, close, _db: db };
}
