// Distill: take any file apart into named parts, deterministically, in the reader's own browser.
//
//   const d = await distill(bytes, "name.ext")   one file
//   const f = await distillFolder([{ path, bytes }])   a folder or a dropped set of files
//
// A result holds only measurements: the file's size and SHA-256, the format the bytes themselves declare, the
// parts with the byte range each one occupies, and how much of the file those parts account for. Bytes that
// no part claims are listed as the residual, so the report says how much is still unexplained.
// The same bytes always give the same report. Nothing is uploaded and nothing in the file is run.
import { READERS } from "./formats.mjs";
import { readText } from "./text.mjs";

export const SCHEMA = "distill/1";
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
export async function sha256(bytes) { return hex(await crypto.subtle.digest("SHA-256", bytes)); }

// Shannon entropy of the byte values, in bits per byte: 0 for one repeated value, 8 for uniform noise
export function entropy(bytes, start = 0, end = bytes.length) {
  const n = end - start; if (n <= 0) return 0;
  const count = new Uint32Array(256); for (let i = start; i < end; i++) count[bytes[i]]++;
  let h = 0; for (let v = 0; v < 256; v++) if (count[v]) { const p = count[v] / n; h -= p * Math.log2(p); }
  return +h.toFixed(4);
}
// the same measure over equal slices, so a reader can see where a file is text, structure or packed data
export function entropyMap(bytes, slices = 64) {
  const n = Math.min(slices, Math.max(1, bytes.length)), out = [];
  for (let i = 0; i < n; i++) out.push(entropy(bytes, Math.floor((i * bytes.length) / n), Math.floor(((i + 1) * bytes.length) / n)));
  return out;
}

// how much of the file the top-level parts claim, and the ranges nothing claims
export function coverage(parts, size) {
  const spans = parts.filter((p) => p.length > 0).map((p) => [p.offset, p.offset + p.length]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const residual = []; let at = 0, covered = 0, overlap = 0;
  for (const [a, b] of spans) {
    if (a > at) residual.push({ offset: at, length: a - at });
    if (a < at) overlap += Math.min(at, b) - a;
    if (b > at) { covered += b - Math.max(a, at); at = b; }
  }
  if (at < size) residual.push({ offset: at, length: size - at });
  return { covered, share: size ? +(covered / size).toFixed(6) : 1, residual, overlap };
}

export async function distill(bytes, name = "", { depth = 4 } = {}) {
  if (!(bytes instanceof Uint8Array)) bytes = new Uint8Array(bytes);
  const out = { schema: SCHEMA, name, size: bytes.length, sha256: await sha256(bytes), format: null, formatName: null, facts: {}, parts: [], notes: [] };
  for (const reader of READERS) {
    if (!reader.test(bytes, name)) continue;
    try {
      const r = await reader.read(bytes, name);
      Object.assign(out, { format: reader.id, formatName: reader.name, facts: r.facts || {}, parts: r.parts || [] });
      if (r.notes) out.notes.push(...r.notes);
      // an archive is opened and each file inside is distilled in turn, to a fixed depth
      if (reader.open && depth > 0) {
        try { out.inside = await distillFolder(await reader.open(bytes, name), { depth: depth - 1 }); }
        catch (e) { out.notes.push(`The contents were not opened: ${e.message}`); }
      }
    } catch (e) {
      // a file that declares a format and then breaks its rules is a finding, and the report says so
      Object.assign(out, { format: reader.id, formatName: reader.name });
      out.notes.push(`The bytes start as ${reader.name} and then stop following it: ${e.message}`);
    }
    break;
  }
  if (!out.format) {
    const t = readText(bytes);
    if (t) Object.assign(out, { format: t.format, formatName: t.formatName, facts: t.facts, parts: t.parts });
    else { out.format = "unknown"; out.formatName = "No format recognised"; out.notes.push("The bytes match no reader here. Size, hash and entropy still hold."); }
  }
  // a part may not claim bytes the file does not have: it is cut to the file and the report says the file is short
  for (const p of out.parts) {
    if (p.offset + p.length <= bytes.length) continue;
    out.notes.push(`"${p.name}" should run to byte ${p.offset + p.length}, and the file ends at ${bytes.length}: it does not stop following its format cleanly, so it may be cut short.`);
    p.length = Math.max(0, bytes.length - p.offset); p.cut = true;
  }
  out.entropy = entropy(bytes); out.entropyMap = entropyMap(bytes);
  out.coverage = coverage(out.parts, bytes.length);
  return out;
}

// A folder is its files, sorted by path. The root is the SHA-256 of the lines "sha256  path", so two folders
// with the same root hold the same bytes under the same names.
export async function distillFolder(files, opts = {}) {
  const sorted = [...files].sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0)), items = [];
  for (const f of sorted) items.push(await distill(f.bytes, f.path, opts));
  const lines = items.map((d) => `${d.sha256}  ${d.name}\n`).join("");
  const byFormat = {}; let size = 0;
  for (const d of items) { size += d.size; const k = byFormat[d.format] ||= { name: d.formatName, files: 0, size: 0 }; k.files++; k.size += d.size; }
  const seen = new Map(), duplicates = [];
  for (const d of items) { if (seen.has(d.sha256)) duplicates.push([seen.get(d.sha256), d.name]); else seen.set(d.sha256, d.name); }
  return { schema: SCHEMA, kind: "folder", files: items.length, size, root: await sha256(new TextEncoder().encode(lines)), byFormat, duplicates, items };
}

// the report as a file a reader can keep: stable key order, no dates, so equal inputs give equal bytes
export function receipt(result) { return JSON.stringify(result, null, 1) + "\n"; }
