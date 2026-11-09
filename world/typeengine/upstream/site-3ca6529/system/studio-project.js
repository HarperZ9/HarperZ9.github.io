// studio-project.js: the whole Studio as one file (9 October 2026). A project file holds every
// source's kept session (the same states studio-store.js keeps in this browser) and the source on
// stage, as JSON under the schema "studio.project/1". Saving reads what this browser kept; opening
// checks the file, writes each session back into this browser's store, and the page reloads onto
// the saved source, so every source resumes exactly as a reload would resume it.
//
// The pure half: no DOM, runs in Node (studio-project.test.mjs).

export const PROJECT_SCHEMA = "studio.project/1";
export const PROJECT_MAX_BYTES = 8 * 1024 * 1024;

/** buildProject(store, sources, active, now) -> the project document (sources with nothing kept are left out). */
export function buildProject(store, sources, active, now = new Date()) {
  const sessions = {};
  for (const s of sources) {
    const got = store.load(s);
    if (got && got.state != null) sessions[s] = got.state;
  }
  return { schema: PROJECT_SCHEMA, savedAt: now.toISOString(), active: sources.includes(active) ? active : null, sessions };
}

/**
 * readProject(text, sources) -> { ok, doc } or { ok: false, reason }. A file is refused whole when
 * it is not this schema, too large, or not JSON; a session for a source this Studio does not have
 * is listed as skipped, never written.
 */
export function readProject(text, sources) {
  if (typeof text !== "string") return { ok: false, reason: "not a text file" };
  if (text.length > PROJECT_MAX_BYTES) return { ok: false, reason: `larger than ${PROJECT_MAX_BYTES / 1048576} MB` };
  let doc;
  try { doc = JSON.parse(text); } catch (_) { return { ok: false, reason: "not JSON" }; }
  if (!doc || doc.schema !== PROJECT_SCHEMA) return { ok: false, reason: "not a Studio project file (schema " + PROJECT_SCHEMA + ")" };
  if (!doc.sessions || typeof doc.sessions !== "object" || Array.isArray(doc.sessions)) return { ok: false, reason: "no sessions in the file" };
  const known = Object.keys(doc.sessions).filter((s) => sources.includes(s));
  const skipped = Object.keys(doc.sessions).filter((s) => !sources.includes(s));
  return { ok: true, doc, known, skipped, active: sources.includes(doc.active) ? doc.active : null };
}

/** applyProject(store, read) -> { written: [...], refused: [{ source, reason }] } */
export function applyProject(store, read) {
  const written = [], refused = [];
  for (const s of read.known) {
    const r = store.save(s, read.doc.sessions[s]);
    if (r && r.ok) written.push(s); else refused.push({ source: s, reason: (r && r.reason) || "not kept" });
  }
  return { written, refused };
}
