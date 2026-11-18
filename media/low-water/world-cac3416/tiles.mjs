// The world as binary tiles. The generator writes its rasters as text (55 MB for the island);
// tools/pack.mjs turns them into this form once, and the traversal reads this form: a small
// overview of the whole island first, then 256 x 256 cell tiles, nearest the walker first.
//
//   <world>/tiles/index.json     { format, width, height, tile, cols, rows, step, bytes }
//   <world>/tiles/overview.bin   every raster at one cell in `step`, gzip
//   <world>/tiles/t_<col>_<row>.bin   the six rasters of one tile, gzip
//
// Inside a tile or the overview, in this order: height and water as 16-bit codes
// (code = (metres + 512) x 16; water 0 where dry), each stored as the difference from the cell
// to its left, low bytes then high bytes; then biome, region, river and moist as bytes.
// The same code packs and unpacks, in node and in the browser.
export const FORMAT = "lw-tiles-1", TILE = 256, STEP = 8, WIDE = ["height", "water"], BYTE = ["biome", "region", "river", "moist"];

async function pipe(u8, stream) {
  const out = new Response(new Blob([u8]).stream().pipeThrough(stream));
  return new Uint8Array(await out.arrayBuffer());
}
export const gzip = (u8) => pipe(u8, new CompressionStream("gzip")), gunzip = (u8) => pipe(u8, new DecompressionStream("gzip"));

// a block of w x h cells read from rasters of width W at (x0, y0), every `step` cells
export function encodeBlock(codes, W, x0, y0, w, h, step = 1) {
  const n = w * h, out = new Uint8Array(n * (WIDE.length * 2 + BYTE.length)); let o = 0;
  for (const name of WIDE) {
    const src = codes[name];
    for (let y = 0; y < h; y++) { let prev = 0; for (let x = 0; x < w; x++) { const v = src[(y0 + y * step) * W + x0 + x * step], d = (v - prev) & 0xffff; prev = v; out[o + y * w + x] = d & 255; out[o + n + y * w + x] = d >> 8; } }
    o += 2 * n;
  }
  for (const name of BYTE) { const src = codes[name]; for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) out[o + y * w + x] = src[(y0 + y * step) * W + x0 + x * step]; o += n; }
  return out;
}
// the reverse: visit(name, x, y, value) for every cell of the block
export function decodeBlock(u8, w, h, visit) {
  const n = w * h; let o = 0;
  for (const name of WIDE) {
    for (let y = 0; y < h; y++) { let prev = 0; for (let x = 0; x < w; x++) { prev = (prev + (u8[o + y * w + x] | (u8[o + n + y * w + x] << 8))) & 0xffff; visit(name, x, y, prev); } }
    o += 2 * n;
  }
  for (const name of BYTE) { for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) visit(name, x, y, u8[o + y * w + x]); o += n; }
}

// every file of a packed world: { "index.json": text, "overview.bin": bytes, "t_0_0.bin": bytes, ... }
export async function packWorld(codes, W, H) {
  const cols = Math.ceil(W / TILE), rows = Math.ceil(H / TILE), files = {}, ow = Math.floor(W / STEP), oh = Math.floor(H / STEP);
  files["overview.bin"] = await gzip(encodeBlock(codes, W, STEP >> 1, STEP >> 1, ow, oh, STEP));
  let bytes = files["overview.bin"].length;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const w = Math.min(TILE, W - c * TILE), h = Math.min(TILE, H - r * TILE), f = await gzip(encodeBlock(codes, W, c * TILE, r * TILE, w, h));
    files[`t_${c}_${r}.bin`] = f; bytes += f.length;
  }
  files["index.json"] = JSON.stringify({ format: FORMAT, width: W, height: H, tile: TILE, cols, rows, step: STEP, bytes });
  return files;
}
