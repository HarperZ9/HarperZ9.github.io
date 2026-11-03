// Finds a C2PA manifest store inside a media file and parses its JUMBF boxes (ISO/IEC 19566-5).
// Containers, per the C2PA 2.x specification's embedding rules:
//   JPEG  APP11 segments carrying "JP" JUMBF fragments, joined by box instance and sequence number
//   PNG   a caBX chunk
//   WebP  a RIFF chunk named C2PA
//   MP4   a top-level uuid box with the C2PA UUID, purpose "manifest"
// Each parsed box keeps its byte offsets in the file it came from, so hashes can be recomputed.

import { bytesConcat } from "./cbor.js";

const u32 = (b, i) => ((b[i] << 24) >>> 0) + (b[i + 1] << 16) + (b[i + 2] << 8) + b[i + 3];
const ascii = (b, i, n) => String.fromCharCode(...b.subarray(i, i + n));
const hex = (b) => [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
export const C2PA_BMFF_UUID = "d8fec3d61b0e483c92975828877ec481";

export function mediaFormat(b) {
  if (b.length < 12) return null;
  if (b[0] === 0xff && b[1] === 0xd8) return "jpeg";
  if (b[0] === 0x89 && ascii(b, 1, 3) === "PNG") return "png";
  if (ascii(b, 0, 4) === "RIFF" && ascii(b, 8, 4) === "WEBP") return "webp";
  if (ascii(b, 4, 4) === "ftyp") return "bmff";
  if (ascii(b, 0, 3) === "GIF") return "gif";
  return null;
}

// JPEG segments before the image data: [{ marker, start, end, data }] (data excludes the length).
export function jpegSegments(b) {
  const out = [];
  let i = 2;
  while (i + 4 <= b.length && b[i] === 0xff) {
    const marker = b[i + 1];
    if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) { i += 2; continue; }
    if (marker === 0xff) { i++; continue; }
    const len = (b[i + 2] << 8) | b[i + 3];
    out.push({ marker, start: i, end: i + 2 + len, data: b.subarray(i + 4, i + 2 + len) });
    if (marker === 0xda) break;
    i += 2 + len;
  }
  return out;
}

export function pngChunks(b) {
  const out = [];
  for (let i = 8; i + 12 <= b.length;) {
    const len = u32(b, i), type = ascii(b, i + 4, 4);
    out.push({ type, start: i, end: i + 12 + len, data: b.subarray(i + 8, i + 8 + len) });
    if (type === "IEND") break;
    i += 12 + len;
  }
  return out;
}

export function riffChunks(b) {
  const out = [];
  const le = (i) => b[i] + (b[i + 1] << 8) + (b[i + 2] << 16) + ((b[i + 3] << 24) >>> 0);
  for (let i = 12; i + 8 <= b.length;) {
    const len = le(i + 4), type = ascii(b, i, 4);
    out.push({ type, start: i, end: i + 8 + len + (len & 1), data: b.subarray(i + 8, i + 8 + len) });
    i += 8 + len + (len & 1);
  }
  return out;
}

// Top-level ISO BMFF boxes: [{ type, start, end, header, uuid }].
export function bmffBoxes(b, from = 0, to = b.length) {
  const out = [];
  for (let i = from; i + 8 <= to;) {
    let size = u32(b, i), header = 8;
    const type = ascii(b, i + 4, 4);
    if (size === 1) { size = Number((BigInt(u32(b, i + 8)) << 32n) | BigInt(u32(b, i + 12))); header = 16; }
    else if (size === 0) size = to - i;
    if (size < header || i + size > to) break;
    const box = { type, start: i, end: i + size, header };
    if (type === "uuid") { box.uuid = hex(b.subarray(i + header, i + header + 16)); box.header += 16; }
    out.push(box);
    i += size;
  }
  return out;
}

// The manifest store's bytes and where they sit in the file: { format, store, ranges } or null.
export function findManifestStore(b) {
  const format = mediaFormat(b);
  if (format === "jpeg") {
    const parts = new Map();
    for (const s of jpegSegments(b)) {
      if (s.marker !== 0xeb || s.data[0] !== 0x4a || s.data[1] !== 0x50) continue;
      const en = (s.data[2] << 8) | s.data[3], z = u32(s.data, 4), body = s.data.subarray(8);
      if (!parts.has(en)) parts.set(en, []);
      parts.get(en).push({ z, body, s });
    }
    for (const list of parts.values()) {
      list.sort((a, c) => a.z - c.z);
      if (ascii(list[0].body, 4, 4) !== "jumb") continue;
      const store = bytesConcat(list.map((p, k) => (k === 0 ? p.body : p.body.subarray(8))));
      if (labelOf(store) === "c2pa") return { format, store, ranges: list.map((p) => [p.s.start, p.s.end]) };
    }
    return { format, store: null };
  }
  if (format === "png") {
    const c = pngChunks(b).find((x) => x.type === "caBX");
    return { format, store: c ? c.data : null, ranges: c ? [[c.start, c.end]] : [] };
  }
  if (format === "webp") {
    const c = riffChunks(b).find((x) => x.type === "C2PA");
    return { format, store: c ? c.data : null, ranges: c ? [[c.start, c.end]] : [] };
  }
  if (format === "bmff") {
    for (const x of bmffBoxes(b)) {
      if (x.type !== "uuid" || x.uuid !== C2PA_BMFF_UUID) continue;
      let i = x.start + x.header + 4;                       // FullBox version and flags
      let purpose = ""; while (i < x.end && b[i]) purpose += String.fromCharCode(b[i++]);
      i++;
      if (purpose !== "manifest") continue;
      i += 8;                                               // offset of the first merkle box
      return { format, store: b.subarray(i, x.end), ranges: [[x.start, x.end]] };
    }
    return { format, store: null };
  }
  return { format, store: null };
}

function labelOf(store) {
  try { return parseBox(store, 0).label; } catch { return null; }
}

// One JUMBF box at offset i: superboxes ("jumb") get { type, uuid, label, children },
// content boxes get { type, data }. start/end/contentStart are offsets within buf.
export function parseBox(buf, i, depth = 0) {
  if (depth > 16 || i + 8 > buf.length) throw new Error("jumbf: truncated");
  let size = u32(buf, i), header = 8;
  const type = ascii(buf, i + 4, 4);
  if (size === 1) { size = Number((BigInt(u32(buf, i + 8)) << 32n) | BigInt(u32(buf, i + 12))); header = 16; }
  else if (size === 0) size = buf.length - i;
  const end = i + size;
  if (size < header || end > buf.length) throw new Error("jumbf: bad box size");
  const box = { type, start: i, end, contentStart: i + header };
  if (type !== "jumb") { box.data = buf.subarray(i + header, end); return box; }
  box.children = [];
  for (let k = i + header; k < end;) { const c = parseBox(buf, k, depth + 1); box.children.push(c); k = c.end; }
  const d = box.children[0];
  if (!d || d.type !== "jumd") throw new Error("jumbf: superbox without description");
  box.uuid = hex(d.data.subarray(0, 16));
  const toggles = d.data[16];
  if (toggles & 2) { const z = d.data.indexOf(0, 17); box.label = new TextDecoder().decode(d.data.subarray(17, z < 0 ? d.data.length : z)); }
  box.content = box.children.slice(1);
  return box;
}

// The store as nested boxes, plus a lookup by label path ("c2pa/urn:.../c2pa.claim").
export function parseStore(store) {
  const root = parseBox(store, 0);
  return { root, buf: store, manifests: (root.content || []).filter((x) => x.type === "jumb") };
}

export const childByLabel = (box, label) => (box.content || []).find((c) => c.type === "jumb" && (c.label === label || (c.label || "").startsWith(label + "__")));
