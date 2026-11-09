// Every figure on a findings page carries what a reader needs to check it, and the published result copy is the
// file the figure names. Run: node --test tests/findings-charts.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DIR = join(ROOT, "findings", "charts");
const specs = readdirSync(DIR).filter((f) => f.endsWith(".json")).map((f) => ({ f, spec: JSON.parse(readFileSync(join(DIR, f), "utf8")) }));
const pages = readdirSync(join(ROOT, "findings")).filter((f) => /^F\d+-.*\.html$/.test(f));
const DRIVE = /[A-Za-z]:[\\/]/;
const walk = (d) => readdirSync(d).flatMap((n) => (statSync(join(d, n)).isDirectory() ? walk(join(d, n)) : [join(d, n)]));

test("every published finding has a chart spec with two or more figures", () => {
  assert.equal(specs.length, pages.length);
  for (const { f, spec } of specs) {
    assert.equal(`${spec.finding}.json`, f);
    assert.ok(spec.charts.length >= 2, `${f} has ${spec.charts.length} figure`);
    assert.equal(new Set(spec.charts.map((c) => c.key)).size, spec.charts.length, `${f} repeats a key`);
  }
});

test("every figure states its takeaway, its n and its source; every chart also has units, a data table and an interval or the reason there is none", () => {
  for (const { f, spec } of specs) for (const c of spec.charts) {
    const at = `${f} ${c.key}`;
    for (const k of ["title", "takeaway", "n"]) assert.ok(typeof c[k] === "string" && c[k].length > 8, `${at} lacks ${k}`);
    assert.ok(c.claims.length > 0 && c.source.length > 0, `${at} names no claim or source`);
    for (const id of c.source) assert.ok(spec.sources.some((s) => s.id === id), `${at} names unknown source ${id}`);
    if (c.form === "flow") { assert.ok(c.steps.length >= 3, `${at} has under 3 steps`); continue; }
    assert.ok(c.units, `${at} lacks units`);
    assert.ok(typeof c.interval === "string" || typeof c.no_interval === "string", `${at} has no interval and no reason`);
    assert.ok(c.table.length > 0, `${at} has an empty table`);
    for (const row of c.table) assert.equal(row.length, c.columns.length, `${at} has a table row of the wrong width`);
  }
});

test("series slots stay inside the six ink and shape pairs, and a verdict is true, false or null", () => {
  for (const { f, spec } of specs) for (const c of spec.charts) {
    const slots = [...(c.rows || []), ...(c.panels || []).flatMap((p) => p.series), ...(c.series || [])].map((r) => r.series).filter((s) => s !== undefined);
    for (const s of slots) assert.ok(Number.isInteger(s) && s >= 0 && s <= 5, `${f} ${c.key} uses slot ${s}`);
    if (c.form === "rules") for (const r of c.rows) assert.ok([true, false, null].includes(r.holds), `${f} ${c.key} verdict`);
  }
});

test("each named result copy exists and its SHA-256 is the one printed under the figure", () => {
  for (const { f, spec } of specs) for (const s of spec.sources) {
    assert.match(s.sha256_original, /^[0-9a-f]{64}$/, `${f} ${s.id}`);
    const p = join(ROOT, s.href);
    assert.ok(existsSync(p), `${f}: ${s.href} is missing`);
    assert.equal(createHash("sha256").update(readFileSync(p)).digest("hex"), s.sha256_copy, `${f}: ${s.href} does not match its printed hash`);
  }
});

test("Git stores the result copies byte for byte, so the hash printed under a figure is the hash of the served file", () => {
  // A Windows checkout can hold CRLF bytes that a text rule would store as LF; the hash test above would then pass here and fail on the server.
  assert.match(readFileSync(join(ROOT, ".gitattributes"), "utf8"), /^findings\/results\/\*\* -text$/m);
});

test("no spec and no published result copy names a local drive path", () => {
  const files = [...specs.map(({ f }) => join(DIR, f)), ...walk(join(ROOT, "findings", "results"))];
  for (const p of files) assert.ok(!DRIVE.test(readFileSync(p, "utf8")), `${p} names a drive path`);
});

test("each built page draws every figure in its spec, with a real table behind each chart", () => {
  for (const { spec } of specs) {
    const page = pages.find((p) => p.startsWith(`${spec.finding}-`));
    const html = readFileSync(join(ROOT, "findings", page), "utf8");
    assert.ok(!DRIVE.test(html.replace(/https?:\/\//g, "")), `${page} names a drive path`);
    for (const c of spec.charts) {
      const i = html.indexOf(`<figure class="fc`), at = html.indexOf(`id="ch-${c.key}"`);
      assert.ok(i >= 0 && at >= 0, `${page} lacks figure ${c.key}`);
      const body = html.slice(at, html.indexOf("</figure>", at));
      assert.ok(body.includes(spec.sources.find((s) => s.id === c.source[0]).sha256_original), `${page} ${c.key} prints no source hash`);
      if (c.form !== "flow") assert.ok(/<table[\s>]/.test(body) && body.includes("<th"), `${page} ${c.key} has no table`);
    }
  }
});
