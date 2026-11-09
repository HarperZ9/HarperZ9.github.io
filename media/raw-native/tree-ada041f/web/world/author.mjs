// Hand-authored tiles and maps: pixel tiles drawn as rows of characters with a colour key,
// packed into one tileset image, and map layers placed cell by cell from character grids.
// The output is the TileMap the tile parsers produce (tiles.mjs), so an authored map draws
// through the same tile renderer as an LDtk or Tiled one. Pure: runs in Node.
//
//   const key = { ".": null, a: "#1b2a3a", b: [40, 60, 80], c: [40, 60, 80, 128] };
//   const rock = pixelTile(["..aa..", ".abba.", "abbbba"], key);
//   const atlas = tileAtlas([["rock", rock], ["sand", sand]], { tileW: 16, tileH: 16 });
//   const map = authoredMap({ atlas, layers: [{ name: "ground", rows: ["ssr", "srs"], legend: { s: "sand", r: "rock", ".": null } }] });
//   // isometric: authoredMap({ ..., orientation: "isometric" }) over 64 x 32 diamond tiles
//   parallaxZ(0.5)       // the depth z at which a layer scrolls at half the focal plane's rate
//   offPalette(image, palette)   // pixels of an image whose colour is not in a fixed palette
//
// Every malformed input throws an AuthorError naming the tile, row and character at fault.

export class AuthorError extends Error { constructor(msg) { super(msg); this.name = "AuthorError"; } }
const fail = (m) => { throw new AuthorError(m); };

// A colour as RGBA8: "#rgb", "#rgba", "#rrggbb", "#rrggbbaa", [r, g, b] or [r, g, b, a]; null is clear.
export function rgba(c, what = "colour") {
  if (c === null) return [0, 0, 0, 0];
  if (typeof c === "string") {
    const m = /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.exec(c);
    if (!m) fail(`${what}: expected #rgb, #rgba, #rrggbb or #rrggbbaa, got ${c.slice(0, 20)}`);
    let h = m[1];
    if (h.length <= 4) h = [...h].map((x) => x + x).join("");
    const v = [0, 2, 4, 6].map((i) => (i < h.length ? parseInt(h.slice(i, i + 2), 16) : 255));
    return v;
  }
  if (Array.isArray(c) && (c.length === 3 || c.length === 4) && c.every((v) => Number.isInteger(v) && v >= 0 && v <= 255)) return c.length === 3 ? [...c, 255] : [...c];
  return fail(`${what}: expected a hex string or 3 or 4 integers 0..255`);
}

// One tile from rows of characters. Every row must be the same length and every character
// must be in the key. Returns { width, height, data: Uint8Array RGBA8 rows, straight alpha }.
export function pixelTile(rows, key, name = "tile") {
  if (!Array.isArray(rows) || !rows.length) fail(`${name}: expected a non-empty array of rows`);
  const w = [...rows[0]].length, h = rows.length, data = new Uint8Array(w * h * 4), cache = new Map();
  if (!w) fail(`${name}: row 0 is empty`);
  rows.forEach((row, y) => {
    if (typeof row !== "string") fail(`${name}: row ${y} is not a string`);
    const cs = [...row];
    if (cs.length !== w) fail(`${name}: row ${y} has ${cs.length} characters, row 0 has ${w}`);
    cs.forEach((ch, x) => {
      if (!(ch in key)) fail(`${name}: row ${y}, column ${x}: character ${JSON.stringify(ch)} is not in the key`);
      if (!cache.has(ch)) cache.set(ch, rgba(key[ch], `${name}: key ${JSON.stringify(ch)}`));
      data.set(cache.get(ch), 4 * (y * w + x));
    });
  });
  return { width: w, height: h, data };
}

// Mirror a tile left to right, or top to bottom: authored variants without redrawing.
export function mirror(tile, { x = true, y = false } = {}) {
  const { width: w, height: h, data } = tile, out = new Uint8Array(data.length);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const si = 4 * ((y ? h - 1 - j : j) * w + (x ? w - 1 - i : i));
    out.set(data.subarray(si, si + 4), 4 * (j * w + i));
  }
  return { width: w, height: h, data: out };
}

// Pack named tiles into one tileset image, left to right in rows of `columns`. Each tile must
// be tileW x tileH. Returns { image: { width, height, data, columns }, gid: { name: gid },
// tileW, tileH, columns, count }. Gids start at 1, in the order given; gid 0 stays empty.
export function tileAtlas(tiles, { tileW, tileH, columns = 8 } = {}) {
  const list = Array.isArray(tiles) ? tiles : Object.entries(tiles || {});
  if (!list.length) fail("atlas: no tiles");
  if (!Number.isInteger(tileW) || !Number.isInteger(tileH) || tileW < 1 || tileH < 1) fail("atlas: tileW and tileH must be positive integers");
  if (!Number.isInteger(columns) || columns < 1) fail("atlas: columns must be a positive integer");
  const cols = Math.min(columns, list.length), rows = Math.ceil(list.length / cols), W = cols * tileW, H = rows * tileH;
  const data = new Uint8Array(W * H * 4), gid = {};
  list.forEach(([name, t], k) => {
    if (typeof name !== "string" || !name) fail(`atlas: tile ${k} has no name`);
    if (name in gid) fail(`atlas: tile name ${name} is used twice`);
    if (!t || t.width !== tileW || t.height !== tileH) fail(`atlas: tile ${name} is ${t && t.width} x ${t && t.height}, expected ${tileW} x ${tileH}`);
    const ox = (k % cols) * tileW, oy = Math.floor(k / cols) * tileH;
    for (let y = 0; y < tileH; y++) data.set(t.data.subarray(y * tileW * 4, (y + 1) * tileW * 4), 4 * ((oy + y) * W + ox));
    gid[name] = k + 1;
  });
  return { image: { width: W, height: H, data, columns: cols }, gid, tileW, tileH, columns: cols, count: list.length };
}

// One layer's cells from rows of characters: the legend maps a character to a tile name in the
// atlas, or to null for an empty cell. A legend value may also be { tile, flip: "h" | "v" | "hv" }.
export function mapLayer(rows, legend, atlas, name = "layer") {
  if (!Array.isArray(rows) || !rows.length) fail(`${name}: expected a non-empty array of rows`);
  const w = [...rows[0]].length, h = rows.length, gids = new Uint32Array(w * h), flip = new Uint8Array(w * h);
  rows.forEach((row, y) => {
    const cs = [...row];
    if (cs.length !== w) fail(`${name}: row ${y} has ${cs.length} cells, row 0 has ${w}`);
    cs.forEach((ch, x) => {
      if (!(ch in legend)) fail(`${name}: row ${y}, column ${x}: character ${JSON.stringify(ch)} is not in the legend`);
      const v = legend[ch];
      if (v === null) return;
      const tile = typeof v === "string" ? v : v && v.tile, f = typeof v === "object" && v.flip ? v.flip : "";
      if (!(tile in atlas.gid)) fail(`${name}: row ${y}, column ${x}: tile ${tile} is not in the atlas`);
      if (!/^(h|v|hv|vh)?$/.test(f)) fail(`${name}: flip ${f} is not h, v or hv`);
      gids[y * w + x] = atlas.gid[tile];
      flip[y * w + x] = (f.includes("h") ? 1 : 0) | (f.includes("v") ? 2 : 0);
    });
  });
  return { name, width: w, height: h, gids, flip };
}

// A TileMap from authored layers over one atlas. All layers must be the same size. For an
// isometric map, tileH is the diamond's height. The tile pass draws each cell's diamond
// footprint only (the bottom tileH rows of a taller atlas tile), so walls, buildings and
// other tall things are sprites or vector items placed with iso.mjs, not tiles.
export function authoredMap({ atlas, layers, orientation = "orthogonal", tileW = atlas && atlas.tileW, tileH = atlas && atlas.tileH } = {}) {
  if (!atlas || !atlas.gid) fail("map: no atlas");
  if (orientation !== "orthogonal" && orientation !== "isometric") fail(`map: orientation ${orientation} is not orthogonal or isometric`);
  if (!Array.isArray(layers) || !layers.length) fail("map: no layers");
  const built = layers.map((L, i) => ({ ...mapLayer(L.rows, L.legend, atlas, L.name || `layer ${i}`), opacity: L.opacity ?? 1, visible: L.visible ?? true }));
  const { width, height } = built[0];
  for (const L of built) if (L.width !== width || L.height !== height) fail(`map: layer ${L.name} is ${L.width} x ${L.height}, layer ${built[0].name} is ${width} x ${height}`);
  return {
    width, height, tileW, tileH, orientation,
    layers: built.map(({ name, gids, flip, opacity, visible }) => ({ name, gids, flip, opacity, visible })),
    tilesets: [{ firstgid: 1, columns: atlas.columns, count: atlas.count, tileW: atlas.tileW, tileH: atlas.tileH, spacing: 0, margin: 0 }],
  };
}

// The depth z at which a layer scrolls at `factor` times the focal plane's rate under the
// Motion camera (vector.mjs: a point at depth z moves by distance / (distance + z)).
// factor 1 is the focal plane, below 1 is farther (z > 0), above 1 is nearer (z < 0).
export function parallaxZ(factor, distance = 1000) {
  if (!(factor > 0) || !Number.isFinite(factor)) fail(`parallax: factor must be a positive number, got ${factor}`);
  if (!(distance > 0)) fail(`parallax: distance must be positive, got ${distance}`);
  return distance / factor - distance;
}

// The pixels of an RGBA8 image (alpha above 0) whose colour is not in the palette, as
// [{ x, y, rgb }], at most `limit` of them; the count of all of them in `.total`.
export function offPalette(image, palette, { limit = 16 } = {}) {
  const set = new Set(palette.map((c) => { const [r, g, b] = rgba(c, "palette"); return (r << 16) | (g << 8) | b; }));
  const out = [], { width: w, height: h, data } = image;
  let total = 0;
  for (let i = 0; i < w * h; i++) {
    if (!data[4 * i + 3]) continue;
    const k = (data[4 * i] << 16) | (data[4 * i + 1] << 8) | data[4 * i + 2];
    if (set.has(k)) continue;
    total++;
    if (out.length < limit) out.push({ x: i % w, y: Math.floor(i / w), rgb: [data[4 * i], data[4 * i + 1], data[4 * i + 2]] });
  }
  out.total = total;
  return out;
}
