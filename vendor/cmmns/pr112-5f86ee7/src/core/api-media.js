// A file's Content Credentials (C2PA) and AI-generation metadata as evidence items. The words come
// from src/core/mediacheck.js, so the API never calls a file authentic or fake.

import { readCredentials, credentialState } from "./c2pa.js";
import { credentialSignals, CREDENTIALS_DO_NOT_PROVE, NO_CREDENTIALS } from "./mediacheck.js";
import { SRC_FILE } from "./api-words.js";

const row = (rows, key) => (rows.find((r) => r[0] === key) || [])[1] || null;
const KIND = { c2pa: "content-credentials", "c2pa-changed": "credentials-changed", "ai-metadata": "ai-metadata" };

// The evidence for one reading from readCredentials().
export function mediaItems(r) {
  const state = credentialState(r);
  const out = credentialSignals(r).map((s) => ({
    kind: s.fam === "c2pa" && /AI/.test(s.label) ? "credentials-ai" : KIND[s.fam] || s.fam,
    scope: "file", level: s.level, label: s.label,
    shows: [row(s.rows, "What CMMNS read") || row(s.rows, "What CMMNS found"), row(s.rows, "Signed by") ? `Signed by ${row(s.rows, "Signed by")}.` : null].filter(Boolean).join(" "),
    source: SRC_FILE, context: row(s.rows, "What it shows") || CREDENTIALS_DO_NOT_PROVE, posts: [], spans: [], data: { state },
  }));
  if (state === "none") out.push({ kind: "no-credentials", scope: "file", level: "info", label: "no content credentials", shows: NO_CREDENTIALS, source: SRC_FILE, context: "Most platforms remove credentials on upload, so this is the usual case.", posts: [], spans: [], data: { state } });
  if (state === "remote") out.push({ kind: "remote-credentials", scope: "file", level: "info", label: "credentials stored online", shows: "The file points to Content Credentials stored online, which CMMNS leaves unfetched.", source: SRC_FILE, context: CREDENTIALS_DO_NOT_PROVE, posts: [], spans: [], data: { state } });
  return out;
}

// bytes: Uint8Array or ArrayBuffer of the whole file. Returns { state, ai, items }.
export async function mediaReading(bytes) {
  const r = await readCredentials(bytes, { complete: true });
  const ai = !!(r.aiAnywhere || ((r.meta && r.meta.sourceTypes) || []).some((t) => t.kind === "ai") || ((r.meta && r.meta.generators) || []).length);
  return { state: credentialState(r), ai, format: r.format || null, items: mediaItems(r) };
}
