// lib/fourier/ttf.mjs: glyph outlines straight from a TrueType font (glyf outlines, cmap formats 4 and 12, hmtx).
// Runs in node and in a page: give it the font's bytes. Outlines come back as closed polylines in em units, y up
// from the baseline, with each counter (the hole of an o) kept as its own contour and marked by its winding.
//   const f = parseTTF(bytes); f.glyph('a') -> { advance, contours: [{ pts: Float64Array, hole }] }
// Composite glyphs (accents built from parts) are assembled with their offsets and 2x2 scales.
// Variable fonts give their default instance; WOFF and WOFF2 must be unpacked first.

export function parseTTF(buf) {
  const u8 = buf instanceof Uint8Array ? buf : new Uint8Array(buf), dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  const tag = String.fromCharCode(u8[0], u8[1], u8[2], u8[3]);
  if (tag === 'wOFF' || tag === 'wOF2') throw new Error('ttf: unpack WOFF/WOFF2 before parsing (give the .ttf)');
  const nt = dv.getUint16(4), tables = {};
  for (let i = 0; i < nt; i++) { const o = 12 + 16 * i; tables[String.fromCharCode(u8[o], u8[o + 1], u8[o + 2], u8[o + 3])] = { off: dv.getUint32(o + 8), len: dv.getUint32(o + 12) }; }
  for (const t of ['head', 'maxp', 'hhea', 'hmtx', 'loca', 'glyf', 'cmap']) if (!tables[t]) throw new Error(`ttf: no ${t} table (CFF outlines are not read here)`);
  const head = tables.head.off, upm = dv.getUint16(head + 18), longLoca = dv.getInt16(head + 50) === 1;
  const numGlyphs = dv.getUint16(tables.maxp.off + 4), nhm = dv.getUint16(tables.hhea.off + 34);
  const locaAt = (g) => (longLoca ? dv.getUint32(tables.loca.off + 4 * g) : 2 * dv.getUint16(tables.loca.off + 2 * g));
  const advanceOf = (g) => dv.getUint16(tables.hmtx.off + 4 * Math.min(g, nhm - 1));
  const cmap = readCmap(dv, tables.cmap.off);

  function points(g, depth = 0) {
    if (g >= numGlyphs || depth > 8) return [];
    const a = locaAt(g), b = locaAt(g + 1);
    if (b <= a) return [];
    let o = tables.glyf.off + a;
    const nc = dv.getInt16(o); o += 10;
    if (nc >= 0) return simple(o, nc);
    const out = []; let more = true;
    while (more) {
      const flags = dv.getUint16(o), gi = dv.getUint16(o + 2); o += 4;
      let dx, dy;
      if (flags & 1) { dx = dv.getInt16(o); dy = dv.getInt16(o + 2); o += 4; } else { dx = dv.getInt8(o); dy = dv.getInt8(o + 1); o += 2; }
      let m = [1, 0, 0, 1];
      if (flags & 8) { const s = dv.getInt16(o) / 16384; m = [s, 0, 0, s]; o += 2; }
      else if (flags & 0x40) { m = [dv.getInt16(o) / 16384, 0, 0, dv.getInt16(o + 2) / 16384]; o += 4; }
      else if (flags & 0x80) { m = [dv.getInt16(o) / 16384, dv.getInt16(o + 2) / 16384, dv.getInt16(o + 4) / 16384, dv.getInt16(o + 6) / 16384]; o += 8; }
      if (!(flags & 2)) { dx = 0; dy = 0; } // point-matched placement is rare in Latin faces; placed at the origin
      for (const c of points(gi, depth + 1)) out.push(c.map((p) => ({ x: m[0] * p.x + m[2] * p.y + dx, y: m[1] * p.x + m[3] * p.y + dy, on: p.on })));
      more = !!(flags & 0x20);
    }
    return out;
  }

  function simple(o, nc) {
    const ends = []; for (let i = 0; i < nc; i++) { ends.push(dv.getUint16(o)); o += 2; }
    const np = nc ? ends[nc - 1] + 1 : 0, il = dv.getUint16(o); o += 2 + il;
    const flags = new Uint8Array(np);
    for (let i = 0; i < np;) { const f = u8[o++]; flags[i++] = f; if (f & 8) { let r = u8[o++]; while (r-- > 0 && i < np) flags[i++] = f; } }
    const xs = new Int32Array(np), ys = new Int32Array(np);
    let v = 0;
    for (let i = 0; i < np; i++) { const f = flags[i]; if (f & 2) { const d = u8[o++]; v += f & 16 ? d : -d; } else if (!(f & 16)) { v += dv.getInt16(o); o += 2; } xs[i] = v; }
    v = 0;
    for (let i = 0; i < np; i++) { const f = flags[i]; if (f & 4) { const d = u8[o++]; v += f & 32 ? d : -d; } else if (!(f & 32)) { v += dv.getInt16(o); o += 2; } ys[i] = v; }
    const out = []; let s = 0;
    for (const e of ends) { const c = []; for (let i = s; i <= e; i++) c.push({ x: xs[i], y: ys[i], on: !!(flags[i] & 1) }); out.push(c); s = e + 1; }
    return out;
  }

  const cache = new Map();
  return {
    upm, numGlyphs,
    glyphIndex: (ch) => cmap(ch.codePointAt(0)),
    has: (ch) => cmap(ch.codePointAt(0)) > 0,
    // tol: flattening tolerance in font units (the polyline stays within tol of the quadratic curve)
    glyph(ch, tol = 0.5) {
      const key = ch + '|' + tol; if (cache.has(key)) return cache.get(key);
      const g = cmap(ch.codePointAt(0)), contours = [];
      for (const c of points(g)) {
        const pts = flatten(c, tol); if (pts.length < 6) continue;
        for (let i = 0; i < pts.length; i++) pts[i] /= upm;
        contours.push({ pts, hole: signedArea(pts) > 0 }); // TrueType outers wind clockwise (y up): negative area
      }
      const r = { advance: advanceOf(g) / upm, contours }; cache.set(key, r); return r;
    },
  };
}

function readCmap(dv, base) {
  const n = dv.getUint16(base + 2); let best = null, fmt = 0;
  for (let i = 0; i < n; i++) {
    const pid = dv.getUint16(base + 4 + 8 * i), eid = dv.getUint16(base + 6 + 8 * i), off = base + dv.getUint32(base + 8 + 8 * i), f = dv.getUint16(off);
    if (pid === 3 && eid === 10 && f === 12) { best = off; fmt = 12; break; }
    if (((pid === 3 && eid === 1) || pid === 0) && f === 4 && !best) { best = off; fmt = 4; }
  }
  if (!best) throw new Error('ttf: no Unicode cmap');
  if (fmt === 12) {
    const ng = dv.getUint32(best + 12);
    return (cp) => { for (let i = 0; i < ng; i++) { const o = best + 16 + 12 * i, a = dv.getUint32(o), b = dv.getUint32(o + 4); if (cp >= a && cp <= b) return dv.getUint32(o + 8) + cp - a; } return 0; };
  }
  const seg = dv.getUint16(best + 6) / 2, ends = best + 14, starts = ends + 2 * seg + 2, deltas = starts + 2 * seg, ranges = deltas + 2 * seg;
  return (cp) => {
    for (let i = 0; i < seg; i++) {
      if (cp > dv.getUint16(ends + 2 * i)) continue;
      const st = dv.getUint16(starts + 2 * i); if (cp < st) return 0;
      const ro = dv.getUint16(ranges + 2 * i), d = dv.getInt16(deltas + 2 * i);
      if (!ro) return (cp + d) & 0xffff;
      const g = dv.getUint16(ranges + 2 * i + ro + 2 * (cp - st)); return g ? (g + d) & 0xffff : 0;
    }
    return 0;
  };
}

// On and off curve points to a closed polyline: two off points in a row imply an on point between them.
function flatten(c, tol) {
  const n = c.length; if (n < 2) return new Float64Array(0);
  let s = c.findIndex((p) => p.on), start;
  if (s < 0) { start = { x: (c[0].x + c[1].x) / 2, y: (c[0].y + c[1].y) / 2 }; s = 0; } else { start = c[s]; s = s + 1; }
  const out = [start.x, start.y]; let cur = start, ctrl = null;
  const quadTo = (q, p) => {
    const dd = Math.abs(cur.x - 2 * q.x + p.x) + Math.abs(cur.y - 2 * q.y + p.y), k = Math.max(1, Math.ceil(Math.sqrt(dd / (4 * tol))));
    for (let i = 1; i <= k; i++) { const t = i / k, u = 1 - t; out.push(u * u * cur.x + 2 * u * t * q.x + t * t * p.x, u * u * cur.y + 2 * u * t * q.y + t * t * p.y); }
    cur = p;
  };
  for (let i = 0; i < n; i++) {
    const p = c[(s + i) % n];
    if (p.on) { if (ctrl) { quadTo(ctrl, p); ctrl = null; } else { out.push(p.x, p.y); cur = p; } }
    else if (ctrl) { const mid = { x: (ctrl.x + p.x) / 2, y: (ctrl.y + p.y) / 2, on: true }; quadTo(ctrl, mid); ctrl = p; }
    else ctrl = p;
  }
  if (ctrl) quadTo(ctrl, start);
  // drop the closing duplicate and any zero-length steps
  const pts = [];
  for (let i = 0; i < out.length; i += 2) { const L = pts.length; if (L && pts[L - 2] === out[i] && pts[L - 1] === out[i + 1]) continue; pts.push(out[i], out[i + 1]); }
  if (pts.length >= 4 && pts[0] === pts[pts.length - 2] && pts[1] === pts[pts.length - 1]) pts.length -= 2;
  return Float64Array.from(pts);
}

export function signedArea(p) { let a = 0; const n = p.length / 2; for (let i = 0; i < n; i++) { const j = (i + 1) % n; a += p[2 * i] * p[2 * j + 1] - p[2 * j] * p[2 * i + 1]; } return a / 2; }
