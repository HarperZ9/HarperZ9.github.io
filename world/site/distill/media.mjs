// Distill, media formats: pictures, sound and film. Each reader walks the container the bytes declare and
// returns the parts in file order with their byte ranges. No pixel or sample is decoded here.
import { u8, u16le, u16be, u32le, u32be, u64be, ascii, starts, part, fold, secs } from "./bytes.mjs";

const PNG_SIG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const PNG_COLOUR = { 0: "greyscale", 2: "RGB", 3: "palette", 4: "greyscale with alpha", 6: "RGB with alpha" };
function png(b) {
  const parts = [part("signature", "header", 0, 8)], facts = {}; let o = 8, text = 0;
  while (o < b.length) {
    const len = u32be(b, o), type = ascii(b, o + 4, 4);
    if (type === "IHDR") Object.assign(facts, { width: u32be(b, o + 8), height: u32be(b, o + 12), bitDepth: u8(b, o + 16), colour: PNG_COLOUR[u8(b, o + 17)] || "unknown", interlaced: u8(b, o + 20) === 1 });
    if (type === "tEXt" || type === "iTXt" || type === "zTXt") text++;
    if (type === "acTL") facts.animationFrames = u32be(b, o + 8);
    parts.push(part(type, type === "IDAT" ? "data" : "chunk", o, len + 12)); o += len + 12;
    if (type === "IEND") break;
  }
  if (text) facts.textChunks = text;
  return { facts, parts: fold(parts, "data", (n) => `IDAT, picture data in ${n} chunks`), notes: o < b.length ? [`${b.length - o} bytes follow the end of the picture.`] : [] };
}

const JPEG_NAME = { 0xd8: "start of image", 0xd9: "end of image", 0xdb: "quantisation table", 0xc4: "Huffman table", 0xda: "scan", 0xdd: "restart interval", 0xfe: "comment", 0xe0: "APP0 (JFIF)", 0xe1: "APP1 (Exif or XMP)", 0xe2: "APP2 (colour profile)", 0xee: "APP14 (Adobe)" };
function jpeg(b) {
  const parts = [], facts = {}; let o = 0, scans = 0;
  while (o < b.length) {
    if (u8(b, o) !== 0xff) throw new Error(`byte ${o} should start a marker`);
    const m = u8(b, o + 1), name = JPEG_NAME[m] || (m >= 0xc0 && m <= 0xcf ? "frame header" : m >= 0xe0 && m <= 0xef ? `APP${m - 0xe0}` : `marker ${m.toString(16)}`);
    if (m === 0xd8 || m === 0xd9) { parts.push(part(name, "marker", o, 2)); o += 2; if (m === 0xd9) break; continue; }
    const len = u16be(b, o + 2);
    if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) Object.assign(facts, { width: u16be(b, o + 7), height: u16be(b, o + 5), bitsPerSample: u8(b, o + 4), components: u8(b, o + 9), coding: m === 0xc2 ? "progressive" : m === 0xc0 ? "baseline" : "other" });
    if (m === 0xe1 && starts(b, "Exif", o + 4)) facts.exif = true;
    let end = o + 2 + len;
    if (m === 0xda) { scans++; while (end < b.length - 1 && !(b[end] === 0xff && b[end + 1] !== 0 && !(b[end + 1] >= 0xd0 && b[end + 1] <= 0xd7))) end++; if (end >= b.length - 1) end = b.length; }
    parts.push(part(name, m === 0xda ? "data" : "segment", o, end - o)); o = end;
  }
  facts.scans = scans;
  return { facts, parts, notes: o < b.length ? [`${b.length - o} bytes follow the end of the picture.`] : [] };
}

function gif(b) {
  const parts = [part("header", "header", 0, 6)], flags = u8(b, 10), facts = { version: ascii(b, 3, 3), width: u16le(b, 6), height: u16le(b, 8) };
  let o = 13; parts.push(part("screen descriptor", "header", 6, 7));
  if (flags & 0x80) { const n = 3 * (2 << (flags & 7)); parts.push(part("global colour table", "table", o, n)); facts.colours = n / 3; o += n; }
  const blocks = (at) => { let p = at; for (;;) { const n = u8(b, p); p += 1 + n; if (!n) return p; } };
  let frames = 0;
  while (o < b.length) {
    const t = u8(b, o), from = o;
    if (t === 0x3b) { parts.push(part("trailer", "marker", o, 1)); o++; break; }
    if (t === 0x21) { o = blocks(o + 2); parts.push(part(u8(b, from + 1) === 0xf9 ? "graphic control" : u8(b, from + 1) === 0xff ? "application extension" : "extension", "chunk", from, o - from)); continue; }
    if (t !== 0x2c) throw new Error(`byte ${o} starts no known block`);
    const lf = u8(b, o + 9); o += 10; if (lf & 0x80) o += 3 * (2 << (lf & 7)); o = blocks(o + 1); frames++;
    parts.push(part(`frame ${frames}`, "data", from, o - from));
  }
  facts.frames = frames;
  return { facts, parts };
}

// RIFF holds WAV sound, WebP pictures and AVI film; the form type says which
function riff(b) {
  const form = ascii(b, 8, 4), parts = [part(`RIFF header (${form.trim()})`, "header", 0, 12)], facts = { form: form.trim() }; let o = 12, rate = 0, block = 0;
  while (o + 8 <= b.length) {
    const id = ascii(b, o, 4), len = u32le(b, o + 4), size = Math.min(8 + len + (len & 1), b.length - o);
    if (id === "fmt ") { rate = u32le(b, o + 12); block = u16le(b, o + 20); Object.assign(facts, { channels: u16le(b, o + 10), sampleRate: rate, bitsPerSample: u16le(b, o + 22), encoding: u16le(b, o + 8) === 1 ? "PCM" : u16le(b, o + 8) === 3 ? "float" : `code ${u16le(b, o + 8)}` }); }
    if (id === "data" && rate && block) facts.seconds = secs(len / block / rate);
    if (id === "VP8X") Object.assign(facts, { width: 1 + (u32le(b, o + 12) & 0xffffff), height: 1 + (u32le(b, o + 15) & 0xffffff) });
    parts.push(part(id.trim() || "chunk", id === "data" ? "data" : "chunk", o, size)); o += size;
  }
  return { facts, parts };
}

const BOX_NAME = { ftyp: "file type", moov: "film index", mdat: "media data", free: "free space", moof: "fragment index", uuid: "extension", meta: "metadata" };
function isoBoxes(b) {
  const parts = [], facts = { brand: ascii(b, 8, 4).trim() }; let o = 0;
  while (o + 8 <= b.length) {
    let size = u32be(b, o); const type = ascii(b, o + 4, 4);
    if (size === 1) size = u64be(b, o + 8); else if (size === 0) size = b.length - o;
    if (size < 8) throw new Error(`the box at byte ${o} gives a size of ${size}`);
    if (type === "moov") { for (let p = o + 8; p + 8 <= o + size && p + 8 <= b.length; ) { const s = u32be(b, p), t = ascii(b, p + 4, 4); if (s < 8) break;
      if (t === "mvhd") { const v = u8(b, p + 8), scale = u32be(b, p + (v ? 28 : 20)), dur = v ? u64be(b, p + 32) : u32be(b, p + 24); if (scale) facts.seconds = secs(dur / scale); }
      if (t === "trak") facts.tracks = (facts.tracks || 0) + 1; p += s; } }
    parts.push(part(BOX_NAME[type] ? `${type}, ${BOX_NAME[type]}` : type, type === "mdat" ? "data" : "chunk", o, Math.min(size, b.length - o))); o += size;
  }
  return { facts, parts };
}

function flac(b) {
  const parts = [part("signature", "header", 0, 4)], facts = {}, names = ["stream info", "padding", "application", "seek table", "comments", "cue sheet", "picture"]; let o = 4, last = false;
  while (!last) {
    const h = u8(b, o), len = (u8(b, o + 1) << 16) | (u8(b, o + 2) << 8) | u8(b, o + 3), type = h & 0x7f; last = !!(h & 0x80);
    if (type === 0) { const rate = (u8(b, o + 14) << 12) | (u8(b, o + 15) << 4) | (u8(b, o + 16) >> 4), total = (u8(b, o + 17) & 0x0f) * 4294967296 + u32be(b, o + 18);
      Object.assign(facts, { sampleRate: rate, channels: ((u8(b, o + 16) >> 1) & 7) + 1, bitsPerSample: (((u8(b, o + 16) & 1) << 4) | (u8(b, o + 17) >> 4)) + 1 }); if (rate) facts.seconds = secs(total / rate); }
    parts.push(part(names[type] || `block ${type}`, "chunk", o, len + 4)); o += len + 4;
  }
  if (o < b.length) parts.push(part("audio frames", "data", o, b.length - o));
  return { facts, parts };
}

function id3(b) {
  const size = ((u8(b, 6) & 0x7f) << 21) | ((u8(b, 7) & 0x7f) << 14) | ((u8(b, 8) & 0x7f) << 7) | (u8(b, 9) & 0x7f), end = Math.min(10 + size, b.length);
  return { facts: { tagVersion: `ID3v2.${u8(b, 3)}` }, parts: [part("ID3 tag", "chunk", 0, end), ...(end < b.length ? [part("audio frames", "data", end, b.length - end)] : [])] };
}

function sfnt(b) {
  const n = u16be(b, 4), parts = [part("table directory", "header", 0, 12 + 16 * n)], tables = [];
  for (let i = 0; i < n; i++) { const o = 12 + 16 * i, tag = ascii(b, o, 4), off = u32be(b, o + 8), len = u32be(b, o + 12); tables.push(tag.trim()); parts.push(part(tag.trim(), tag === "glyf" || tag === "CFF " ? "data" : "chunk", off, Math.min(len, Math.max(0, b.length - off)))); }
  parts.sort((x, y) => x.offset - y.offset);
  return { facts: { outlines: starts(b, "OTTO") ? "CFF (PostScript)" : "TrueType", tables: n, variable: tables.includes("fvar"), colour: tables.includes("COLR") || tables.includes("sbix") }, parts,
    notes: ["Tables are padded to four bytes, so a few bytes between them stay unclaimed."] };
}

export const MEDIA = [
  { id: "png", name: "PNG picture", test: (b) => starts(b, PNG_SIG), read: png },
  { id: "jpeg", name: "JPEG picture", test: (b) => starts(b, [0xff, 0xd8, 0xff]), read: jpeg },
  { id: "gif", name: "GIF picture", test: (b) => starts(b, "GIF87a") || starts(b, "GIF89a"), read: gif },
  { id: "riff", name: "RIFF container (WAV, WebP or AVI)", test: (b) => starts(b, "RIFF") && b.length >= 12, read: riff },
  { id: "isobmff", name: "MP4 family (MP4, MOV, HEIC, AVIF)", test: (b) => b.length >= 12 && starts(b, "ftyp", 4), read: isoBoxes },
  { id: "flac", name: "FLAC sound", test: (b) => starts(b, "fLaC"), read: flac },
  { id: "mp3", name: "MP3 sound with an ID3 tag", test: (b) => starts(b, "ID3") && b.length >= 10, read: id3 },
  { id: "font", name: "Font (TrueType or OpenType)", test: (b) => starts(b, [0, 1, 0, 0]) || starts(b, "OTTO") || starts(b, "true"), read: sfnt },
];
