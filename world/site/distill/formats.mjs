// Distill, containers and documents: archives, PDF, databases and programs. A reader with open() can hand
// back the files inside, so an archive is distilled all the way down. Programs are read as data and never run.
import { u8, u16le, u16be, u32le, u32be, ascii, starts, utf8, part, lastIndexOf } from "./bytes.mjs";
import { MEDIA } from "./media.mjs";

export const LIMITS = { entries: 2000, inflated: 256 * 1024 * 1024, ratio: 200 };
// unpack one stream with a hard cap, so a small archive cannot expand without bound
export async function unpack(bytes, format, cap) {
  const reader = new Blob([bytes]).stream().pipeThrough(new DecompressionStream(format)).getReader(), chunks = []; let n = 0;
  for (;;) { const { done, value } = await reader.read(); if (done) break; n += value.length; if (n > cap) { await reader.cancel(); throw new Error(`it unpacks to more than ${cap} bytes`); } chunks.push(value); }
  const out = new Uint8Array(n); let o = 0; for (const c of chunks) { out.set(c, o); o += c.length; } return out;
}

const ZIP_KIND = [["word/document.xml", "Word document"], ["xl/workbook.xml", "Excel workbook"], ["ppt/presentation.xml", "PowerPoint deck"], ["META-INF/container.xml", "EPUB book"], ["AndroidManifest.xml", "Android package"], ["META-INF/MANIFEST.MF", "Java archive"], ["content.xml", "OpenDocument file"]];
function zipEntries(b) {
  const eocd = lastIndexOf(b, [0x50, 0x4b, 5, 6], b.length - 22, Math.max(0, b.length - 65557));
  if (eocd < 0) throw new Error("no end-of-archive record was found");
  const total = u16le(b, eocd + 10), cdSize = u32le(b, eocd + 12), cdAt = u32le(b, eocd + 16), entries = []; let o = cdAt;
  for (let i = 0; i < total; i++) {
    if (!starts(b, [0x50, 0x4b, 1, 2], o)) throw new Error(`entry ${i + 1} of the directory is missing its signature`);
    const nl = u16le(b, o + 28), el = u16le(b, o + 30), cl = u16le(b, o + 32), at = u32le(b, o + 42);
    const e = { name: utf8(b, o + 46, nl), method: u16le(b, o + 10), flags: u16le(b, o + 8), crc: u32le(b, o + 16), packed: u32le(b, o + 20), size: u32le(b, o + 24), at };
    e.dataAt = at + 30 + u16le(b, at + 26) + u16le(b, at + 28); entries.push(e); o += 46 + nl + el + cl;
  }
  return { entries, eocd, cdAt, cdSize };
}
function zip(b) {
  const { entries, eocd, cdAt, cdSize } = zipEntries(b), files = entries.filter((e) => !e.name.endsWith("/"));
  const parts = entries.map((e) => part(e.name, "file", e.at, e.dataAt - e.at + e.packed, { size: e.size, packed: e.packed, method: e.method === 0 ? "stored" : e.method === 8 ? "deflate" : `method ${e.method}`, crc32: e.crc.toString(16).padStart(8, "0") }));
  parts.push(part("central directory", "table", cdAt, cdSize), part("end record", "header", eocd, b.length - eocd)); parts.sort((x, y) => x.offset - y.offset);
  const size = files.reduce((a, e) => a + e.size, 0), packed = files.reduce((a, e) => a + e.packed, 0), names = new Set(entries.map((e) => e.name));
  const facts = { files: files.length, folders: entries.length - files.length, unpackedBytes: size, packedBytes: packed, encrypted: entries.some((e) => e.flags & 1) };
  const kind = ZIP_KIND.find(([n]) => names.has(n)); if (kind) facts.holds = kind[1];
  const notes = entries.some((e) => e.flags & 8) ? ["Some entries carry a short data descriptor after their data, which shows as unclaimed bytes."] : [];
  return { facts, parts, notes };
}
async function zipOpen(b) {
  const { entries } = zipEntries(b), out = []; let budget = LIMITS.inflated;
  for (const e of entries.slice(0, LIMITS.entries)) {
    if (e.name.endsWith("/") || e.flags & 1 || (e.method !== 0 && e.method !== 8)) continue;
    if (e.packed && e.size / e.packed > LIMITS.ratio * 5) throw new Error(`"${e.name}" claims to unpack ${Math.round(e.size / e.packed)} times larger; not opened`);
    const raw = b.subarray(e.dataAt, e.dataAt + e.packed), bytes = e.method === 0 ? raw : await unpack(raw, "deflate-raw", Math.min(budget, Math.max(e.size, 1)));
    budget -= bytes.length; out.push({ path: e.name, bytes });
  }
  return out;
}

function gzip(b, name) {
  const flags = u8(b, 3); let o = 10, inner = name.replace(/\.t?gz$/i, (m) => (/tgz/i.test(m) ? ".tar" : "")) || "contents";
  if (flags & 4) o += 2 + u16le(b, o);
  if (flags & 8) { const s = o; while (u8(b, o)) o++; inner = utf8(b, s, o - s); o++; }
  if (flags & 16) { while (u8(b, o)) o++; o++; }
  if (flags & 2) o += 2;
  const facts = { originalName: inner, unpackedBytesMod4GiB: u32le(b, b.length - 4), crc32: u32le(b, b.length - 8).toString(16).padStart(8, "0") };
  return { facts, parts: [part("header", "header", 0, o), part("packed data", "data", o, b.length - 8 - o), part("checksum and length", "header", b.length - 8, 8)], inner };
}
async function gzipOpen(b, name) { return [{ path: gzip(b, name).inner, bytes: await unpack(b, "gzip", LIMITS.inflated) }]; }

const octal = (b, o, n) => parseInt(ascii(b, o, n).replace(/[\0 ]+$/, "").trim() || "0", 8);
const cstr = (b, o, n) => { let e = o; while (e < o + n && b[e]) e++; return utf8(b, o, e - o); };
function tarEntries(b) {
  const entries = []; let o = 0;
  while (o + 512 <= b.length && b[o]) {
    const size = octal(b, o + 124, 12), prefix = cstr(b, o + 345, 155), name = (prefix ? prefix + "/" : "") + cstr(b, o, 100), type = String.fromCharCode(b[o + 156] || 48);
    entries.push({ name, size, type, at: o, dataAt: o + 512 }); o += 512 + Math.ceil(size / 512) * 512;
  }
  return { entries, end: o };
}
function tar(b) {
  const { entries, end } = tarEntries(b), files = entries.filter((e) => e.type === "0");
  const parts = entries.map((e) => part(e.name, e.type === "5" ? "folder" : "file", e.at, Math.min(512 + Math.ceil(e.size / 512) * 512, b.length - e.at), { size: e.size }));
  if (end < b.length) parts.push(part("end blocks", "header", end, b.length - end));
  return { facts: { files: files.length, entries: entries.length, unpackedBytes: files.reduce((a, e) => a + e.size, 0) }, parts };
}
const tarOpen = (b) => tarEntries(b).entries.filter((e) => e.type === "0").slice(0, LIMITS.entries).map((e) => ({ path: e.name, bytes: b.subarray(e.dataAt, e.dataAt + e.size) }));

function pdf(b) {
  const latin = (o, n) => ascii(b, o, Math.min(n, b.length - o)), facts = { version: latin(5, 3) }, sx = lastIndexOf(b, "startxref");
  const SCAN = 64 * 1024 * 1024, text = b.length <= SCAN ? new TextDecoder("latin1").decode(b) : null, headEnd = Math.max(b.indexOf(10), b.indexOf(13)) + 1 || 9;
  if (text) Object.assign(facts, { objects: (text.match(/\d+ \d+ obj\b/g) || []).length, pages: (text.match(/\/Type\s*\/Page(?![a-zA-Z])/g) || []).length, streams: (text.match(/\bendstream\b/g) || []).length,
    encrypted: /\/Encrypt\b/.test(text), scripts: /\/JavaScript\b|\/JS\b/.test(text), embeddedFiles: /\/EmbeddedFile\b/.test(text) });
  const parts = [part("header", "header", 0, headEnd)];
  const xref = sx >= 0 ? parseInt(latin(sx + 9, 24).trim(), 10) : NaN;
  if (Number.isFinite(xref) && xref > headEnd && xref < b.length) parts.push(part("objects", "data", headEnd, xref - headEnd), part("cross-reference and trailer", "table", xref, b.length - xref));
  else parts.push(part("objects", "data", headEnd, b.length - headEnd));
  return { facts, parts, notes: text ? ["Pages inside compressed object streams are not counted."] : ["Too large to count objects here; the layout still holds."] };
}

const WASM = ["custom", "type", "import", "function", "table", "memory", "global", "export", "start", "element", "code", "data", "data count"];
function wasm(b) {
  const parts = [part("header", "header", 0, 8)], facts = { version: u32le(b, 4) }; let o = 8;
  while (o < b.length) { const id = u8(b, o); let p = o + 1, size = 0, shift = 0, c; do { c = u8(b, p++); size += (c & 0x7f) * 2 ** shift; shift += 7; } while (c & 0x80);
    parts.push(part(WASM[id] || `section ${id}`, id === 10 || id === 11 ? "data" : "chunk", o, p - o + size)); o = p + size; }
  facts.sections = parts.length - 1;
  return { facts, parts };
}
function sqlite(b) {
  const page = u16be(b, 16) === 1 ? 65536 : u16be(b, 16), pages = u32be(b, 28);
  return { facts: { pageSize: page, pages, textEncoding: ["", "UTF-8", "UTF-16le", "UTF-16be"][u32be(b, 56)] || "unknown", schemaVersion: u32be(b, 40) },
    parts: [part("database header", "header", 0, 100), part("pages", "data", 100, b.length - 100)] };
}
function pe(b) {
  const at = u32le(b, 0x3c); if (!starts(b, [0x50, 0x45, 0, 0], at)) throw new Error("the MZ stub does not lead to a PE header");
  const n = u16le(b, at + 6), opt = u16le(b, at + 20), table = at + 24 + opt, machine = { 0x14c: "x86", 0x8664: "x64", 0xaa64: "ARM64" }[u16le(b, at + 4)] || "other";
  const parts = [part("headers", "header", 0, table + 40 * n)];
  for (let i = 0; i < n; i++) { const s = table + 40 * i, raw = u32le(b, s + 16), ptr = u32le(b, s + 20); if (raw && ptr < b.length) parts.push(part(cstr(b, s, 8), "data", ptr, Math.min(raw, b.length - ptr))); }
  parts.sort((x, y) => x.offset - y.offset);
  return { facts: { machine, sections: n, library: !!(u16le(b, at + 22) & 0x2000) }, parts, notes: ["A program. It was read as bytes and not run."] };
}
function elf(b) {
  const wide = u8(b, 4) === 2, little = u8(b, 5) === 1, m = little ? u16le(b, 18) : u16be(b, 18), head = wide ? 64 : 52;
  return { facts: { bits: wide ? 64 : 32, byteOrder: little ? "little-endian" : "big-endian", machine: { 3: "x86", 62: "x64", 40: "ARM", 183: "ARM64", 243: "RISC-V" }[m] || `code ${m}` },
    parts: [part("ELF header", "header", 0, head), part("segments and sections", "data", head, b.length - head)], notes: ["A program. It was read as bytes and not run."] };
}

export const READERS = [
  ...MEDIA,
  { id: "zip", name: "ZIP archive", test: (b) => starts(b, [0x50, 0x4b, 3, 4]) || starts(b, [0x50, 0x4b, 5, 6]), read: zip, open: zipOpen },
  { id: "gzip", name: "gzip stream", test: (b) => starts(b, [0x1f, 0x8b, 8]) && b.length >= 18, read: gzip, open: gzipOpen },
  { id: "tar", name: "tar archive", test: (b) => b.length >= 512 && starts(b, "ustar", 257), read: tar, open: tarOpen },
  { id: "pdf", name: "PDF document", test: (b) => starts(b, "%PDF-"), read: pdf },
  { id: "wasm", name: "WebAssembly module", test: (b) => starts(b, [0, 0x61, 0x73, 0x6d]), read: wasm },
  { id: "sqlite", name: "SQLite database", test: (b) => starts(b, "SQLite format 3\0") && b.length >= 100, read: sqlite },
  { id: "pe", name: "Windows program", test: (b) => starts(b, "MZ") && b.length >= 0x40, read: pe },
  { id: "elf", name: "ELF program", test: (b) => starts(b, [0x7f, 0x45, 0x4c, 0x46]) && b.length >= 52, read: elf },
];
