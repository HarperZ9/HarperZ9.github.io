// Tile maps from the two common editors: LDtk (JSON, MIT-licensed format) and Tiled
// (TMX, read here with our own parser; Tiled's code is GPL and is not used). Both load
// into one TileMap the tile renderer draws. Pure: runs in Node.
//
//   const map = parseTMX(xmlText, { inflate });   // inflate(Uint8Array) -> Uint8Array, for zlib layers
//   const map = parseLDtk(jsonOrText, { level: 0 });
//   // map: { width, height, tileW, tileH, layers: [{ name, gids: Uint32Array, flip: Uint8Array, opacity }],
//   //        tilesets: [{ firstgid, name, image, columns, count, tileW, tileH, spacing, margin }] }
//
// Every malformed input throws a TileError naming what is wrong: never another
// exception type, and never an unbounded loop (tests/web fuzz: tiles.fuzz.mjs).

export class TileError extends Error { constructor(msg) { super(msg); this.name = "TileError"; } }
const fail = (m) => { throw new TileError(m); };
export const MAX_TILES = 1 << 24;          // 16M cells per layer: refuse bigger maps
const FLIP_H = 0x80000000, FLIP_V = 0x40000000, FLIP_D = 0x20000000;

const int = (v, what, lo = 0, hi = 1 << 30) => {
  const n = typeof v === "number" ? v : typeof v === "string" && /^\s*-?\d+\s*$/.test(v) ? parseInt(v, 10) : NaN;
  if (!Number.isInteger(n) || n < lo || n > hi) fail(`${what}: expected an integer from ${lo} to ${hi}, got ${String(v).slice(0, 40)}`);
  return n;
};
function checkSize(w, h) { if (w * h > MAX_TILES) fail(`map of ${w} x ${h} tiles exceeds ${MAX_TILES}`); }

// Split a gid into the tile id and Tiled's flip bits.
function splitGids(raw, n) {
  const gids = new Uint32Array(n), flip = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const g = raw[i] >>> 0;
    flip[i] = (g & FLIP_H ? 1 : 0) | (g & FLIP_V ? 2 : 0) | (g & FLIP_D ? 4 : 0);
    gids[i] = g & 0x1fffffff;
  }
  return { gids, flip };
}

// ---------------------------------------------------------------- XML (TMX)
// A small XML reader: elements, attributes and text; no DTDs, entities beyond the five
// predefined, or namespaces. Enough for TMX, and bounded: every loop advances.
const ENT = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
const unesc = (s) => s.replace(/&(amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);/g, (_, e) => ENT[e] ?? String.fromCodePoint(e[1] === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10) & 0x10ffff));
export function parseXML(src) {
  if (typeof src !== "string") fail("TMX: expected text");
  if (src.length > 1 << 28) fail("TMX: input too large");
  const root = { name: "#root", attrs: {}, children: [], text: "" }, stack = [root];
  let i = 0;
  while (i < src.length) {
    const lt = src.indexOf("<", i);
    if (lt < 0) { stack[stack.length - 1].text += src.slice(i); break; }
    stack[stack.length - 1].text += src.slice(i, lt);
    if (src.startsWith("<?", lt)) { const e = src.indexOf("?>", lt); if (e < 0) fail("TMX: unterminated declaration"); i = e + 2; continue; }
    if (src.startsWith("<!--", lt)) { const e = src.indexOf("-->", lt); if (e < 0) fail("TMX: unterminated comment"); i = e + 3; continue; }
    if (src.startsWith("<![CDATA[", lt)) { const e = src.indexOf("]]>", lt); if (e < 0) fail("TMX: unterminated CDATA"); stack[stack.length - 1].text += src.slice(lt + 9, e); i = e + 3; continue; }
    if (src.startsWith("<!", lt)) { const e = src.indexOf(">", lt); if (e < 0) fail("TMX: unterminated declaration"); i = e + 1; continue; }
    const gt = src.indexOf(">", lt);
    if (gt < 0) fail("TMX: unterminated tag");
    const body = src.slice(lt + 1, gt);
    i = gt + 1;
    if (body[0] === "/") {
      const name = body.slice(1).trim();
      if (stack.length < 2 || stack[stack.length - 1].name !== name) fail(`TMX: unexpected </${name.slice(0, 40)}>`);
      stack.pop(); continue;
    }
    const self = body.endsWith("/"), m = /^([A-Za-z_][\w.:-]*)/.exec(body);
    if (!m) fail("TMX: bad tag name");
    const el = { name: m[1], attrs: {}, children: [], text: "" };
    const rest = body.slice(m[1].length, self ? -1 : undefined);
    const re = /\s*([A-Za-z_][\w.:-]*)\s*=\s*("([^"]*)"|'([^']*)')/y;
    let j = 0;
    while (j < rest.length) {
      if (/\s/.test(rest[j])) { j++; continue; }
      re.lastIndex = j;
      const a = re.exec(rest);
      if (!a) fail(`TMX: bad attribute in <${m[1]}>`);
      el.attrs[a[1]] = unesc(a[3] ?? a[4]);
      j = re.lastIndex;
    }
    stack[stack.length - 1].children.push(el);
    if (!self) { if (stack.length > 256) fail("TMX: nesting too deep"); stack.push(el); }
  }
  if (stack.length !== 1) fail(`TMX: <${stack[stack.length - 1].name}> is not closed`);
  return root;
}

function base64(s) {
  const t = s.replace(/\s+/g, "");
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(t) || t.length % 4) fail("TMX: bad base64");
  const bin = typeof atob === "function" ? atob(t) : Buffer.from(t, "base64").toString("binary");
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function parseTMX(src, { inflate = null } = {}) {
  const doc = parseXML(src), map = doc.children.find((c) => c.name === "map");
  if (!map) fail("TMX: no <map>");
  const A = map.attrs;
  if ((A.orientation || "orthogonal") !== "orthogonal" && A.orientation !== "isometric") fail(`TMX: orientation ${String(A.orientation).slice(0, 20)} is not supported`);
  if (A.infinite === "1") fail("TMX: infinite maps are not supported");
  const width = int(A.width, "map width", 1, 1 << 16), height = int(A.height, "map height", 1, 1 << 16);
  checkSize(width, height);
  const out = { width, height, tileW: int(A.tilewidth, "tilewidth", 1, 4096), tileH: int(A.tileheight, "tileheight", 1, 4096),
    orientation: A.orientation || "orthogonal", layers: [], tilesets: [] };
  for (const ts of map.children.filter((c) => c.name === "tileset")) {
    const t = ts.attrs, img = ts.children.find((c) => c.name === "image");
    out.tilesets.push({ firstgid: int(t.firstgid, "tileset firstgid", 1), name: t.name || "", source: t.source || null, image: img ? img.attrs.source || null : null,
      columns: t.columns !== undefined ? int(t.columns, "tileset columns", 0, 1 << 16) : null, count: t.tilecount !== undefined ? int(t.tilecount, "tilecount", 0, MAX_TILES) : null,
      tileW: t.tilewidth !== undefined ? int(t.tilewidth, "tileset tilewidth", 1, 4096) : out.tileW, tileH: t.tileheight !== undefined ? int(t.tileheight, "tileset tileheight", 1, 4096) : out.tileH,
      spacing: t.spacing !== undefined ? int(t.spacing, "spacing", 0, 4096) : 0, margin: t.margin !== undefined ? int(t.margin, "margin", 0, 4096) : 0 });
  }
  out.tilesets.sort((a, b) => a.firstgid - b.firstgid);
  for (const layer of map.children.filter((c) => c.name === "layer")) {
    const L = layer.attrs, w = int(L.width ?? width, "layer width", 1, 1 << 16), h = int(L.height ?? height, "layer height", 1, 1 << 16), n = w * h;
    if (w !== width || h !== height) fail("TMX: layer size differs from the map");
    const data = layer.children.find((c) => c.name === "data");
    if (!data) fail("TMX: layer without <data>");
    const enc = data.attrs.encoding || "xml", comp = data.attrs.compression || null;
    let raw;
    if (enc === "csv") {
      const parts = data.text.split(",");
      if (parts.length !== n) fail(`TMX: csv layer has ${parts.length} cells, expected ${n}`);
      raw = new Uint32Array(n);
      for (let i = 0; i < n; i++) raw[i] = int(parts[i].trim(), "csv cell", 0, 0xffffffff);
    } else if (enc === "base64") {
      let bytes = base64(data.text);
      if (comp) {
        if (comp !== "zlib" && comp !== "gzip") fail(`TMX: compression ${comp.slice(0, 20)} is not supported`);
        if (!inflate) fail("TMX: a compressed layer needs an inflate function");
        try { bytes = inflate(bytes, comp); } catch (e) { fail(`TMX: ${comp} data does not inflate`); }
        if (!(bytes instanceof Uint8Array)) fail("TMX: inflate must return bytes");
      }
      if (bytes.length !== 4 * n) fail(`TMX: layer data has ${bytes.length} bytes, expected ${4 * n}`);
      raw = new Uint32Array(n);
      const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      for (let i = 0; i < n; i++) raw[i] = dv.getUint32(4 * i, true);
    } else if (enc === "xml") {
      const tiles = data.children.filter((c) => c.name === "tile");
      if (tiles.length !== n) fail(`TMX: xml layer has ${tiles.length} tiles, expected ${n}`);
      raw = Uint32Array.from(tiles, (t) => int(t.attrs.gid ?? 0, "tile gid", 0, 0xffffffff));
    } else fail(`TMX: encoding ${enc.slice(0, 20)} is not supported`);
    const { gids, flip } = splitGids(raw, n);
    const opacity = L.opacity !== undefined ? Number(L.opacity) : 1;
    if (!(opacity >= 0 && opacity <= 1)) fail("TMX: layer opacity out of range");
    out.layers.push({ name: L.name || "", gids, flip, opacity, visible: L.visible !== "0" });
  }
  return out;
}

// ---------------------------------------------------------------- LDtk
// Reads a level's tile layers (Tiles, AutoLayer, and IntGrid with auto tiles): each
// tile's grid cell from its px position, its tileset index from t, its flips from f.
export function parseLDtk(src, { level = 0 } = {}) {
  let doc = src;
  if (typeof src === "string") { if (src.length > 1 << 28) fail("LDtk: input too large"); try { doc = JSON.parse(src); } catch { fail("LDtk: not JSON"); } }
  if (!doc || typeof doc !== "object" || !Array.isArray(doc.levels)) fail("LDtk: no levels");
  const lv = typeof level === "number" ? doc.levels[level] : doc.levels.find((l) => l && l.identifier === level);
  if (!lv || typeof lv !== "object") fail(`LDtk: no level ${String(level).slice(0, 40)}`);
  if (!Array.isArray(lv.layerInstances)) fail("LDtk: level without layerInstances (external levels are not supported)");
  const defs = doc.defs && Array.isArray(doc.defs.tilesets) ? doc.defs.tilesets : [];
  const out = { width: 0, height: 0, tileW: 0, tileH: 0, orientation: "orthogonal", layers: [], tilesets: [] };
  const tsIndex = new Map();
  // LDtk lists layers top first; the TileMap draws its first layer first, so reverse.
  for (const li of [...lv.layerInstances].reverse()) {
    if (!li || typeof li !== "object") fail("LDtk: bad layer");
    const tiles = li.__type === "Tiles" ? li.gridTiles : li.__type === "AutoLayer" || li.__type === "IntGrid" ? li.autoLayerTiles : null;
    if (!Array.isArray(tiles) || (li.__type === "IntGrid" && !tiles.length)) continue;
    const grid = int(li.__gridSize, "layer __gridSize", 1, 4096), w = int(li.__cWid, "layer __cWid", 1, 1 << 16), h = int(li.__cHei, "layer __cHei", 1, 1 << 16);
    checkSize(w, h);
    if (!out.width) { out.width = w; out.height = h; out.tileW = out.tileH = grid; }
    if (w !== out.width || h !== out.height || grid !== out.tileW) fail("LDtk: layers of different grids are not supported");
    const uid = li.__tilesetDefUid ?? null;
    if (uid !== null && !tsIndex.has(uid)) {
      const d = defs.find((t) => t && t.uid === uid);
      const first = 1 + out.tilesets.reduce((s, t) => s + (t.count || 0), 0);
      const tw = d ? int(d.tileGridSize, "tileset tileGridSize", 1, 4096) : grid;
      const cols = d ? int(d.__cWid, "tileset __cWid", 1, 1 << 16) : 1, rows = d ? int(d.__cHei, "tileset __cHei", 1, 1 << 16) : 1;
      tsIndex.set(uid, out.tilesets.length);
      out.tilesets.push({ firstgid: first, name: d ? String(d.identifier || "") : "", image: d ? d.relPath || null : null, columns: cols, count: cols * rows,
        tileW: tw, tileH: tw, spacing: d ? int(d.spacing ?? 0, "spacing", 0, 4096) : 0, margin: d ? int(d.padding ?? 0, "padding", 0, 4096) : 0 });
    }
    const ts = uid === null ? null : out.tilesets[tsIndex.get(uid)];
    const gids = new Uint32Array(w * h), flip = new Uint8Array(w * h);
    for (const t of tiles) {
      if (!t || !Array.isArray(t.px) || t.px.length !== 2) fail("LDtk: tile without px");
      const x = int(t.px[0], "tile px x", 0, w * grid) / grid, y = int(t.px[1], "tile px y", 0, h * grid) / grid;
      if (!Number.isInteger(x) || !Number.isInteger(y) || x >= w || y >= h) fail("LDtk: tile off the grid");
      const id = int(t.t, "tile t", 0, MAX_TILES), f = int(t.f ?? 0, "tile f", 0, 3);
      if (ts && id >= ts.count) fail("LDtk: tile id beyond its tileset");
      gids[y * w + x] = (ts ? ts.firstgid : 1) + id;
      flip[y * w + x] = (f & 1 ? 1 : 0) | (f & 2 ? 2 : 0);
    }
    const opacity = li.__opacity ?? 1;
    if (typeof opacity !== "number" || !(opacity >= 0 && opacity <= 1)) fail("LDtk: layer opacity out of range");
    out.layers.push({ name: String(li.__identifier || ""), gids, flip, opacity, visible: li.visible !== false });
  }
  if (!out.width) fail("LDtk: the level has no tile layers");
  return out;
}
