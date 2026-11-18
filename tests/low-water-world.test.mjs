// The island of Low Water, as /low-water.html carries it. Run: node --test tests/low-water-world.test.mjs
//   1. Every carried file holds the SHA-256 its folder's SHA256SUMS pins, and nothing unpinned sits beside them.
//   2. The tiles open with the walk's own reader: the overview and all 48 tiles, every region of the island in them.
//   3. The page's figures match the world it loads: size, regions, ring towns, villages and river lines.
//   4. The page states what a press downloads, and nothing on the page loads the walk before the press.
//   5. The frame page maps the walk's one outside import to the pinned host and points at the pinned world.
import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname, relative } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const WORLD = join(ROOT, "media/low-water/world-cac3416"), HOST = join(ROOT, "media/raw-native/web-sf-cac3416");
const read = (p) => readFileSync(join(ROOT, p), "utf8");
const sha = (p) => createHash("sha256").update(readFileSync(p)).digest("hex");
const walk = (d, out = []) => { for (const f of readdirSync(d)) { const p = join(d, f); statSync(p).isDirectory() ? walk(p, out) : out.push(p); } return out; };
const sums = (dir) => Object.fromEntries(readFileSync(join(dir, "SHA256SUMS"), "utf8").trim().split("\n").map((l) => { const [h, f] = l.split(/\s+\*?/); return [f, h]; }));

test("every carried file holds its pinned SHA-256, and every file beside them is pinned", () => {
  for (const dir of [WORLD, HOST]) {
    const pin = sums(dir), files = walk(dir).map((p) => relative(dir, p).split("\\").join("/")).filter((f) => !["SHA256SUMS", "LICENSE-NOTE.md"].includes(f));
    assert.deepEqual(files.sort(), Object.keys(pin).sort(), `${relative(ROOT, dir)}: the files and the pins name the same set`);
    for (const f of files) assert.equal(sha(join(dir, f)), pin[f], `${f} changed since it was carried`);
  }
  assert.ok(Object.keys(sums(WORLD)).includes("walk/walk.mjs") && Object.keys(sums(HOST)).includes("raw-gpu.mjs"));
});

test("planted: one changed byte in a carried file fails its pin", () => {
  const pin = sums(WORLD), body = readFileSync(join(WORLD, "walk/walk.mjs"));
  const bent = Buffer.from(body); bent[100] ^= 1;
  assert.notEqual(createHash("sha256").update(bent).digest("hex"), pin["walk/walk.mjs"]);
});

test("the tiles open with the walk's own reader, and every region is in them", async () => {
  const { gunzip, decodeBlock, FORMAT } = await import(pathToFileURL(join(WORLD, "tiles.mjs")).href);
  const out = join(WORLD, "out/20261118"), idx = JSON.parse(readFileSync(join(out, "tiles/index.json"), "utf8"));
  assert.equal(idx.format, FORMAT);
  const regions = new Set(); let cells = 0, bytes = 0;
  for (let r = 0; r < idx.rows; r++) for (let c = 0; c < idx.cols; c++) {
    const raw = readFileSync(join(out, `tiles/t_${c}_${r}.bin`)); bytes += raw.length;
    const w = Math.min(idx.tile, idx.width - c * idx.tile), h = Math.min(idx.tile, idx.height - r * idx.tile);
    decodeBlock(await gunzip(new Uint8Array(raw)), w, h, (name, x, y, v) => { if (name === "region") { regions.add(v); cells++; } });
  }
  bytes += readFileSync(join(out, "tiles/overview.bin")).length;
  assert.equal(cells, idx.width * idx.height, "the tiles cover every cell once");
  assert.equal(bytes, idx.bytes, "the tiles hold the bytes their index states");
  for (let id = 1; id <= 11; id++) assert.ok(regions.has(id), `region ${id} is in the tiles`);
});

test("the page's figures are the world's", async () => {
  const j = JSON.parse(readFileSync(join(WORLD, "out/20261118/world.json"), "utf8")), page = read("low-water.html");
  const { ISLAND } = await import(pathToFileURL(join(ROOT, "site-src/world/low-water.mjs")).href);
  const kinds = {}; for (const s of j.settlements) kinds[s.kind] = (kinds[s.kind] || 0) + 1;
  const words = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen"];
  const tens = { 40: "forty" }, say = (n) => n < 16 ? words[n] : `${tens[n - (n % 10)]}-${words[n % 10]}`;
  assert.equal(j.seed, 20261118);
  assert.match(ISLAND.lede, new RegExp(`an island ${Math.round(j.width * j.cell_m / 1000)} km by ${Math.round(j.height * j.cell_m / 1000)} km`));
  assert.match(ISLAND.lede, new RegExp(`${say(j.regions.length)} regions`));
  assert.match(ISLAND.lede, new RegExp(`${say(kinds.seat + kinds.town)} ring towns`));
  assert.match(ISLAND.lede, new RegExp(`${say(kinds.village)} villages`));
  assert.match(ISLAND.makeNote, new RegExp(`${j.checks.river_lines} river lines`));
  assert.equal(j.checks.hydrology_faults, 0);
  assert.ok(page.includes(ISLAND.lede.replace(/'/g, "'")), "the page carries the lede as built");
  assert.equal(ISLAND.stills.length, 15);
  for (const [f] of ISLAND.stills) statSync(join(ROOT, `media/low-water/stills/${f}-640.webp`));
});

test("the page states the press and loads none of the walk before it", async () => {
  const { WALK_BYTES } = await import(pathToFileURL(join(ROOT, "site-src/world/low-water.mjs")).href);
  const page = read("low-water.html"), island = page.slice(page.indexOf('id="island"'), page.indexOf('id="story"'));
  assert.ok(WALK_BYTES > 3e6, "the stated download covers the tiles at least");
  assert.match(island, new RegExp(`downloads ${(WALK_BYTES / 1e6).toFixed(1)} MB when you press, and nothing before`));
  assert.ok(!/<(iframe|script)[^>]+(walk\.html|world-cac3416|web-sf-cac3416)/.test(page), "no frame or script of the walk in the page");
  assert.match(page, /<script type="module" src="\/world\/site\/explore\/walk\.js\?v=world-[0-9a-f]{10}"><\/script>/);
  assert.match(island, /data-world="\.\.\/media\/low-water\/world-cac3416\/out\/20261118"/);
  assert.ok(!island.includes("\u2014"), "no em dash");
});

test("the frame page maps the walk's outside import to the pinned host", () => {
  const frame = read("media/low-water/walk.html"), map = JSON.parse(/<script type="importmap">(.*?)<\/script>/s.exec(frame)[1]);
  assert.equal(map.imports["/rn/web/raw-gpu.mjs"], "/media/raw-native/web-sf-cac3416/raw-gpu.mjs");
  assert.match(read("media/low-water/world-cac3416/walk/walk.mjs"), /import \{ createHost \} from "\/rn\/web\/raw-gpu\.mjs";/);
  assert.match(frame, /src="\/media\/low-water\/world-cac3416\/walk\/walk\.mjs"/);
  for (const id of ["view", "hud", "note"]) assert.match(frame, new RegExp(`id="${id}"`), `the walk finds #${id}`);
});
