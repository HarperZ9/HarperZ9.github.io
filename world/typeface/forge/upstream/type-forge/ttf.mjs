// system/type-forge/ttf.mjs
// Minted outlines become an installable TrueType font, written table by table (port of Flywheel's
// harness/typeface_ttf.py). No curve fitting: the forge's polygon rings are valid TrueType contours
// with every point on-curve, so the file carries exactly the outlines the rules approved. The same
// face in gives the same bytes out; timestamps are pinned.

import { pyRound } from "./pyround.mjs";

const EM = 1000;
const EPOCH = 3768211200n;   // 2023-06-01 in longdatetime units, pinned

class Bytes {
  constructor() { this.parts = []; this.len = 0; }
  push(u8) { this.parts.push(u8); this.len += u8.length; return this; }
  u8() { const out = new Uint8Array(this.len); let o = 0; for (const p of this.parts) { out.set(p, o); o += p.length; } return out; }
}
// Big-endian packer for the struct codes the tables use: H h L I Q 4s.
function pack(fmt, ...vals) {
  const size = { H: 2, h: 2, L: 4, I: 4, Q: 8 };
  const len = [...fmt].reduce((s, c) => s + size[c], 0);
  const dv = new DataView(new ArrayBuffer(len));
  let o = 0;
  [...fmt].forEach((c, i) => {
    const v = vals[i];
    if (c === "H") dv.setUint16(o, v & 0xffff); else if (c === "h") dv.setInt16(o, v);
    else if (c === "L" || c === "I") dv.setUint32(o, v >>> 0); else if (c === "Q") dv.setBigUint64(o, BigInt(v));
    o += size[c];
  });
  return new Uint8Array(dv.buffer);
}
const concat = (...arrs) => { const b = new Bytes(); for (const a of arrs) b.push(a); return b.u8(); };
const pad4 = (b) => (b.length % 4 ? concat(b, new Uint8Array(4 - (b.length % 4))) : b);
const tagBytes = (t) => Uint8Array.from([...t].map((c) => c.charCodeAt(0)));

function checksum(b) {
  const p = pad4(b), dv = new DataView(p.buffer, p.byteOffset, p.length);
  let s = 0;
  for (let i = 0; i < p.length; i += 4) s = (s + dv.getUint32(i)) >>> 0;
  return s;
}

function glyfEntry(contours) {
  const xs = contours.flat().map((p) => p[0]), ys = contours.flat().map((p) => p[1]);
  const box = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
  const b = new Bytes().push(pack("hhhhh", contours.length, box[0], box[1], box[2], box[3]));
  let n = 0;
  for (const c of contours) { n += c.length; b.push(pack("H", n - 1)); }
  b.push(pack("H", 0)).push(new Uint8Array(n).fill(1));
  let px = 0;
  for (const c of contours) for (const [x] of c) { b.push(pack("h", x - px)); px = x; }
  let py = 0;
  for (const c of contours) for (const [, y] of c) { b.push(pack("h", y - py)); py = y; }
  return { entry: b.u8(), box, npts: n, nctr: contours.length };
}

function cmap(map) {
  const codes = Object.keys(map).map(Number).sort((a, z) => a - z);
  const segs = codes.map((c) => [c, c, map[c]]).concat([[0xffff, 0xffff, null]]);
  const segCount = segs.length, sc2 = segCount * 2;
  const search = 2 ** Math.floor(Math.log2(segCount)) * 2;
  const body = new Bytes()
    .push(pack("HH", sc2, search)).push(pack("HH", Math.floor(Math.log2(search / 2)), sc2 - search));
  for (const [, e] of segs) body.push(pack("H", e));
  body.push(pack("H", 0));
  for (const [s] of segs) body.push(pack("H", s));
  for (const [s, , g] of segs) { const d = g !== null ? ((g - s) & 0xffff) : 1; body.push(pack("h", d > 0x7fff ? d - 0x10000 : d)); }
  for (let i = 0; i < segCount; i++) body.push(pack("H", 0));
  const rest = body.u8();
  const sub = concat(pack("HHH", 4, 6 + rest.length, 0), rest);
  return concat(pack("HHHHL", 0, 1, 3, 1, 12), sub);
}

function nameTable(family, style) {
  const recs = [[1, family], [2, style], [3, `${family} ${style}`], [4, `${family} ${style}`], [6, family.replace(/ /g, "") + "-" + style.replace(/ /g, "")]];
  const entries = new Bytes(), stored = new Bytes();
  for (const [id, s] of recs) {
    const enc = new Uint8Array(s.length * 2);
    for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); enc[2 * i] = c >> 8; enc[2 * i + 1] = c & 0xff; }
    entries.push(pack("HHHHHH", 3, 1, 0x409, id, enc.length, stored.len));
    stored.push(enc);
  }
  return concat(pack("HHH", 0, recs.length, 6 + 12 * recs.length), entries.u8(), stored.u8());
}

function sfnt(tables) {
  const tags = Object.keys(tables).sort();
  const n = tags.length, p2 = 2 ** Math.floor(Math.log2(n));
  const header = pack("LHHHH", 0x00010000, n, p2 * 16, Math.floor(Math.log2(p2)), (n - p2) * 16);
  let offset = 12 + 16 * n;
  const dir = new Bytes(), body = new Bytes(), offsets = {};
  for (const tag of tags) {
    const data = tables[tag];
    offsets[tag] = offset;
    dir.push(tagBytes(tag)).push(pack("LLL", checksum(data), offset, data.length));
    const padded = pad4(data);
    body.push(padded);
    offset += padded.length;
  }
  const font = concat(header, dir.u8(), body.u8());
  const adjust = (0xb1b0afba - checksum(font)) >>> 0;
  new DataView(font.buffer).setUint32(offsets.head + 8, adjust);
  return font;
}

// A minted face to TrueType font bytes (Uint8Array).
export function toTTF(face, family = "Zain Mint", style = "Regular") {
  const src = face.glyphs, names = Object.keys(src).sort();
  const order = [".notdef", "space", ...names];
  const cmapMap = { 32: 1 };
  names.forEach((ch, i) => { cmapMap[ch.codePointAt(0)] = 2 + i; });
  const glyf = new Bytes(), loca = [0], hmtx = [];
  let gx0 = 32767, gy0 = 32767, gx1 = -32768, gy1 = -32768, maxPts = 0, maxCtrs = 0;
  for (const name of order) {
    if (name === ".notdef" || name === "space") { hmtx.push([name === "space" ? 250 : 600, 0]); loca.push(glyf.len); continue; }
    const g = src[name];
    const contours = g.contours.map((ring) => ring.slice(0, -1).map(([x, y]) => [pyRound(x), pyRound(y)])).filter((c) => c.length >= 3);
    const { entry, box, npts, nctr } = glyfEntry(contours);
    glyf.push(pad4(entry));
    loca.push(glyf.len);
    hmtx.push([pyRound(g.advance), pyRound(g.lsb)]);
    gx0 = Math.min(gx0, box[0]); gy0 = Math.min(gy0, box[1]); gx1 = Math.max(gx1, box[2]); gy1 = Math.max(gy1, box[3]);
    maxPts = Math.max(maxPts, npts); maxCtrs = Math.max(maxCtrs, nctr);
  }
  const nGlyphs = order.length, ascent = Math.max(gy1 + 60, 900), descent = Math.min(gy0 - 40, -180);
  const head = concat(pack("LLLLHH", 0x00010000, 0x00010000, 0, 0x5f0f3cf5, 0b11, EM), pack("QQ", EPOCH, EPOCH),
    pack("hhhhHHhhh", gx0, gy0, gx1, gy1, 0, 8, 2, 1, 0));
  const hhea = pack("LhhhHhhhhhhhhhhhH", 0x00010000, ascent, descent, 0, Math.max(...hmtx.map((r) => r[0])), Math.min(...hmtx.map((r) => r[1])),
    0, gx1, 1, 0, 0, 0, 0, 0, 0, 0, nGlyphs);
  const maxp = pack("LHHHHHHHHHHHHHH", 0x00010000, nGlyphs, maxPts, maxCtrs, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0);
  const hmtxB = concat(...hmtx.map(([a, l]) => pack("Hh", a, l)));
  const locaB = concat(...loca.map((v) => pack("L", v)));
  const post = pack("LLhhLLLLLL", 0x00030000, 0, -75, 50, 0, 0, 0, 0, 0, 0);
  const xh = Math.trunc((face.metrics && face.metrics.x_height) || 500);
  const weight = (face.receipt && face.receipt.params && face.receipt.params.weight) ?? 0.085;
  const avg = Math.floor(hmtx.reduce((s, r) => s + r[0], 0) / nGlyphs);
  const os2 = concat(
    pack("HhHHHhhhhhhhhhhhh", 4, avg, Math.max(100, Math.min(900, pyRound(weight * 4706))), 5, 0, 650, 600, 0, 0, 650, 600, 0, 0, 75, 50, 0, 0),
    new Uint8Array(10), pack("LLLL", 1, 0, 0, 0), tagBytes("ZLAB"),
    pack("HHHhhhHH", 0x40, 32, 115, ascent, descent, 0, ascent, -descent),
    pack("LLhhHHH", 1, 0, xh, 0, 0, 32, 1));
  const tables = { cmap: cmap(cmapMap), glyf: glyf.u8(), head, hhea, hmtx: hmtxB, loca: locaB, maxp, name: nameTable(family, style), post, "OS/2": os2 };
  const gid = Object.fromEntries(names.map((ch, i) => [ch, 2 + i]));
  const pairs = [];
  for (const [pr, v] of Object.entries(face.kerning || {})) {
    const [l, r] = [...pr];
    if (gid[l] !== undefined && gid[r] !== undefined && Math.trunc(v) !== 0) pairs.push([gid[l], gid[r], Math.trunc(v)]);
  }
  pairs.sort((a, z) => a[0] - z[0] || a[1] - z[1] || a[2] - z[2]);
  if (pairs.length) {
    const np = pairs.length, p2k = 2 ** Math.floor(Math.log2(np));
    const sub = new Bytes().push(pack("HHHHHHH", 0, 14 + 6 * np, 0x0001, np, p2k * 6, Math.floor(Math.log2(p2k)), (np - p2k) * 6));
    for (const [l, r, v] of pairs) sub.push(pack("HHh", l, r, v));
    tables.kern = concat(pack("HH", 0, 1), sub.u8());
  }
  return sfnt(tables);
}
