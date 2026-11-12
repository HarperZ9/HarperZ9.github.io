// Distill: the parts must add up to the file, the same bytes must give the same report, and a damaged or
// hostile file must end in a plain note. Every fixture is built here from bytes, so the test needs no files.
import { test } from "node:test";
import assert from "node:assert/strict";
import { distill, distillFolder, coverage, entropy, receipt, sha256 } from "./core.mjs";
import { unpack } from "./formats.mjs";

const enc = new TextEncoder();
const cat = (...a) => { const out = new Uint8Array(a.reduce((n, x) => n + x.length, 0)); let o = 0; for (const x of a) { out.set(x, o); o += x.length; } return out; };
const le = (v, n) => Uint8Array.from({ length: n }, (_, i) => (v / 2 ** (8 * i)) & 255);
const be = (v, n) => le(v, n).reverse();
const pack = async (bytes, f) => new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new CompressionStream(f))).arrayBuffer());

const chunk = (type, data) => cat(be(data.length, 4), enc.encode(type), data, be(0, 4));
const png = () => cat(Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", cat(be(640, 4), be(360, 4), Uint8Array.from([8, 6, 0, 0, 0]))),
  chunk("tEXt", enc.encode("Title\0x")), chunk("IDAT", new Uint8Array(40)), chunk("IDAT", new Uint8Array(24)), chunk("IEND", new Uint8Array(0)));
const wav = () => { const data = new Uint8Array(44100 * 2); return cat(enc.encode("RIFF"), le(36 + data.length, 4), enc.encode("WAVEfmt "), le(16, 4), le(1, 2), le(1, 2), le(44100, 4), le(88200, 4), le(2, 2), le(16, 2), enc.encode("data"), le(data.length, 4), data); };
// a ZIP written by hand: stored and deflated entries, then the directory and the end record
async function zip(files) {
  const local = [], central = []; let at = 0;
  for (const [name, bytes, deflate] of files) {
    const n = enc.encode(name), data = deflate ? await pack(bytes, "deflate-raw") : bytes, common = cat(le(deflate ? 8 : 0, 2), le(0, 4), le(0xabcdef01, 4), le(data.length, 4), le(bytes.length, 4), le(n.length, 2), le(0, 2));
    const l = cat(Uint8Array.from([0x50, 0x4b, 3, 4]), le(20, 2), le(0, 2), common, n, data);
    central.push(cat(Uint8Array.from([0x50, 0x4b, 1, 2]), le(20, 2), le(20, 2), le(0, 2), common, le(0, 2), le(0, 2), le(0, 2), le(0, 4), le(at, 4), n)); local.push(l); at += l.length;
  }
  const cd = cat(...central);
  return cat(...local, cd, Uint8Array.from([0x50, 0x4b, 5, 6]), le(0, 4), le(files.length, 2), le(files.length, 2), le(cd.length, 4), le(at, 4), le(0, 2));
}
const tar = (files) => cat(...files.map(([name, bytes]) => { const h = new Uint8Array(512); h.set(enc.encode(name)); h.set(enc.encode(bytes.length.toString(8).padStart(11, "0")), 124); h[156] = 48; h.set(enc.encode("ustar"), 257);
  const body = new Uint8Array(Math.ceil(bytes.length / 512) * 512); body.set(bytes); return cat(h, body); }), new Uint8Array(1024));

test("a PNG is read by its chunks, and the parts cover every byte", async () => {
  const d = await distill(png(), "a.png");
  assert.equal(d.format, "png"); assert.deepEqual([d.facts.width, d.facts.height, d.facts.colour], [640, 360, "RGB with alpha"]);
  assert.deepEqual(d.parts.map((p) => p.name), ["signature", "IHDR", "tEXt", "IDAT, picture data in 2 chunks", "IEND"]);
  assert.deepEqual(d.coverage, { covered: d.size, share: 1, residual: [], overlap: 0 });
});
test("control: bytes added after the end are reported as unexplained, not absorbed", async () => {
  const d = await distill(cat(png(), enc.encode("hidden payload")), "a.png");
  assert.deepEqual(d.coverage.residual, [{ offset: d.size - 14, length: 14 }]); assert.ok(d.coverage.share < 1); assert.match(d.notes.join(" "), /14 bytes follow/);
});
test("the format comes from the bytes, whatever the name says", async () => {
  assert.equal((await distill(png(), "report.pdf")).format, "png");
  assert.equal((await distill(enc.encode("plain words\n"), "photo.png")).format, "text");
});
test("a WAV gives its rate, channels and length", async () => {
  const d = await distill(wav(), "a.wav");
  assert.deepEqual([d.format, d.facts.form, d.facts.sampleRate, d.facts.channels, d.facts.seconds], ["riff", "WAVE", 44100, 1, 1]); assert.equal(d.coverage.share, 1);
});
test("a ZIP is opened and each file inside is distilled, archives inside archives included", async () => {
  const inner = await zip([["notes.md", enc.encode("# One\nfirst\n# Two\nsecond\n"), true]]);
  const d = await distill(await zip([["pic.png", png(), false], ["data/rows.csv", enc.encode("a,b\n1,2\n3,4\n"), true], ["inner.zip", inner, false]]), "bundle.zip");
  assert.equal(d.format, "zip"); assert.equal(d.facts.files, 3); assert.equal(d.coverage.share, 1);
  assert.deepEqual(d.inside.items.map((i) => [i.name, i.format]), [["data/rows.csv", "table"], ["inner.zip", "zip"], ["pic.png", "png"]]);
  const md = d.inside.items[1].inside.items[0];
  assert.equal(md.format, "markdown"); assert.deepEqual(md.parts.map((p) => p.name), ["One", "Two"]); assert.equal(md.coverage.share, 1);
  assert.equal(d.inside.items[2].sha256, await sha256(png()), "the file inside hashes the same as the file outside");
});
test("a .tar.gz opens through both layers", async () => {
  const d = await distill(await pack(tar([["a.txt", enc.encode("hello\n")], ["b.json", enc.encode('{"k": [1, 2], "name": "x"}')]]), "gzip"), "set.tar.gz");
  assert.equal(d.format, "gzip"); const t = d.inside.items[0]; assert.equal(t.format, "tar"); assert.equal(t.coverage.share, 1);
  assert.deepEqual(t.inside.items.map((i) => i.format), ["text", "json"]); assert.deepEqual(t.inside.items[1].parts.map((p) => p.name), ["k", "name"]);
});
test("JSON members carry byte ranges that return the member's own text", async () => {
  const src = '{"é": "ü", "list": [1, {"a": 2}], "n": 3}', b = enc.encode(src), d = await distill(b, "x.json");
  const text = d.parts.map((p) => new TextDecoder().decode(b.subarray(p.offset, p.offset + p.length)));
  assert.deepEqual(text, ['"é": "ü"', '"list": [1, {"a": 2}]', '"n": 3']);
});
test("the same bytes give the same receipt, and one changed byte gives another", async () => {
  const a = receipt(await distill(png(), "a.png")), b = receipt(await distill(png(), "a.png")); assert.equal(a, b);
  const bent = png(); bent[60] ^= 1; assert.notEqual((await distill(bent, "a.png")).sha256, JSON.parse(a).sha256);
});
test("a file that breaks its own format ends in a note, with size and hash intact", async () => {
  const d = await distill(png().subarray(0, 50), "cut.png");
  assert.equal(d.format, "png"); assert.match(d.notes.join(" "), /cut short/); assert.equal(d.coverage.share, 1); assert.ok(d.parts.at(-1).cut); assert.equal(d.size, 50); assert.equal(d.sha256.length, 64);
});
test("unknown bytes still get size, hash and entropy", async () => {
  const noise = Uint8Array.from({ length: 4096 }, (_, i) => (i * 197 + 13) & 255); noise[0] = 0;
  const d = await distill(noise, "blob"); assert.equal(d.format, "unknown"); assert.equal(d.entropy, 8); assert.equal(d.coverage.share, 0);
  assert.equal(entropy(new Uint8Array(100)), 0);
});
test("a folder has one root for its bytes and names, and reports files that are the same", async () => {
  const files = [{ path: "b.txt", bytes: enc.encode("same") }, { path: "a.txt", bytes: enc.encode("same") }, { path: "c.png", bytes: png() }];
  const f = await distillFolder(files), g = await distillFolder([...files].reverse());
  assert.equal(f.root, g.root, "order of arrival does not matter"); assert.deepEqual(f.duplicates, [["a.txt", "b.txt"]]); assert.equal(f.byFormat.text.files, 2);
  const renamed = await distillFolder(files.map((x) => ({ ...x, path: x.path.replace("c.", "d.") }))); assert.notEqual(renamed.root, f.root);
});
test("coverage counts overlap once and lists every gap", () => {
  assert.deepEqual(coverage([{ offset: 2, length: 4 }, { offset: 4, length: 4 }, { offset: 12, length: 2 }], 16),
    { covered: 8, share: 0.5, residual: [{ offset: 0, length: 2 }, { offset: 8, length: 4 }, { offset: 14, length: 2 }], overlap: 2 });
});
test("unpacking stops at its cap", async () => {
  await assert.rejects(unpack(await pack(new Uint8Array(4 * 1024 * 1024), "gzip"), "gzip", 1024 * 1024), /more than 1048576 bytes/);
});
