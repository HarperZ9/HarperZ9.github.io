// audit-log.js: the append-only audit trail for witnessed certificates.
//
// Every certificate the Studio issues, and every operator action stamped on one (accept / reject /
// dispute), is appended here as an immutable entry. The trail REPLAYS in order, so a viewer can walk
// the whole history of what was certified and what the operator decided. This mirrors the shipped cdev
// ledger and answers voice-of-user theme 1 (a re-checkable proof trail) on the storage side, the way
// the certificate panel answers it on the render side. Cites: Audit Trails 2601.20727.
//
// Append-only is the binding invariant: this module exposes openLog / append / replay / list and
// NOTHING that updates or deletes an existing entry. The IndexedDB object store is keyed by an
// auto-incrementing sequence, write-once; entries are returned in that insertion order on replay.
//
// Zero external dependencies: IndexedDB is a built-in Web API. The pure entry logic (normaliseEntry,
// orderEntries) is split out so it is node-testable without a browser, and the timestamp is ALWAYS
// passed in by the caller, never read from Date.now() here, so a test can pin it and replay is stable.

export const DB_NAME = "telos-audit";
export const STORE = "certificates";
export const DB_VERSION = 1;

// The seven fields every audit entry carries. operatorAction is "" until the operator stamps one.
// timestamp is caller-supplied (a number of ms, or any string the caller already formatted).
const isStr = v => typeof v === "string";
const isObj = v => v && typeof v === "object";

// Normalise an arbitrary {certificate, timestamp, operatorAction} input into the flat, frozen entry
// shape the store holds. Pure: no IndexedDB, no clock. The verdict/oracle/criterion/evidence are
// copied straight off the certificate the engine produced, never re-decided or fabricated here.
//   timestamp  caller-supplied (required for a meaningful trail; coerced, never invented from a clock)
//   operatorAction  one of "", "accepted", "rejected", "disputed" (free string tolerated, not enforced)
export function normaliseEntry({ certificate = {}, timestamp, operatorAction = "" } = {}) {
  const cert = isObj(certificate) ? certificate : {};
  const evidence = Array.isArray(cert.evidence)
    ? cert.evidence.filter(e => Array.isArray(e) && e.length === 2).map(([k, v]) => [String(k), String(v)])
    : [];
  return Object.freeze({
    // the caller's timestamp, verbatim if number/string, else null (honest absence, never Date.now()).
    timestamp: typeof timestamp === "number" || isStr(timestamp) ? timestamp : null,
    criterion: isStr(cert.criterion) ? cert.criterion : (cert.criterion == null ? null : String(cert.criterion)),
    verdict: isStr(cert.verdict) ? cert.verdict : "unverifiable",
    oracle: isStr(cert.oracle) ? cert.oracle : "none",
    certified: cert.certified === true,
    evidence,
    operatorAction: isStr(operatorAction) ? operatorAction : "",
  });
}

// Return a NEW array of entries in stable insertion order. Entries are ordered by their assigned
// sequence number (seq) if present, falling back to the order received (a stable index). Pure: this is
// the replay ordering the store guarantees, factored out so it can be asserted without a database.
export function orderEntries(entries) {
  const list = Array.isArray(entries) ? entries.slice() : [];
  return list
    .map((e, i) => ({ e, i }))
    .sort((a, b) => {
      const sa = typeof a.e.seq === "number" ? a.e.seq : a.i;
      const sb = typeof b.e.seq === "number" ? b.e.seq : b.i;
      return sa - sb;
    })
    .map(x => x.e);
}

// ----------------------------------------------------------------------------------------------------
// The IndexedDB-backed append-only log. Each method resolves a Promise; all browser-only.
// ----------------------------------------------------------------------------------------------------

function hasIDB() {
  return typeof indexedDB !== "undefined" && indexedDB !== null;
}

// Open (creating on first use) the audit database. The object store is keyed by an auto-incrementing
// sequence, which IS the append order, and carries a `ts` index for convenience. Resolves a handle
// exposing append / replay / list, each operating only in append-safe ways (add, never put/delete).
export function openLog({ dbName = DB_NAME } = {}) {
  return new Promise((resolve, reject) => {
    if (!hasIDB()) { reject(new Error("IndexedDB unavailable (audit trail needs a browser)")); return; }
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
    req.onerror = () => reject(req.error || new Error("failed to open audit db"));
    req.onsuccess = () => resolve(wrapDb(req.result));
  });
}

// Wrap a raw IDBDatabase in the append-only API. No method here ever calls put() or delete(): the only
// write is store.add (which fails if the key exists), so an existing entry can never be overwritten.
function wrapDb(db) {
  function append(input) {
    const entry = normaliseEntry(input);
    return new Promise((resolve, reject) => {
      let tx;
      try { tx = db.transaction(STORE, "readwrite"); }
      catch (e) { reject(e); return; }
      const store = tx.objectStore(STORE);
      // add() writes once; the auto-increment key is the append sequence. No put(), so no overwrite.
      const r = store.add(entry);
      r.onsuccess = () => resolve({ ...entry, seq: r.result });
      r.onerror = () => reject(r.error || new Error("audit append failed"));
    });
  }

  // Replay every entry, in append order, oldest first. Walks the store with a forward cursor so the
  // order is exactly the write order the auto-increment key imposes.
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
      cur.onerror = () => reject(cur.error || new Error("audit replay failed"));
    });
  }

  // list(limit): the most recent `limit` entries, still in append order (oldest-to-newest within the
  // slice). A convenience over replay() for a panel that shows only the tail; replay() is the full walk.
  async function list(limit = 50) {
    const all = await replay();
    if (!Number.isFinite(limit) || limit <= 0 || limit >= all.length) return all;
    return all.slice(all.length - limit);
  }

  function close() { try { db.close(); } catch (_) {} }

  return { append, replay, list, close, _db: db };
}
