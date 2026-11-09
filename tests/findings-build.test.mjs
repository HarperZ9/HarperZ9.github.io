// The findings build's rules, run on the real records with fixture ledgers (node --test tests/findings-build.test.mjs):
// the redirect rule for refuted and retracted findings, the standing flag on every link to a finding, the schema
// check refusing a broken record, and the maths writer.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { build, loadAll } from "../scripts/build-findings.mjs";
import { flagLinks, standings } from "../scripts/finding-flags.mjs";
import { validate } from "../scripts/findings-schema.mjs";
import { mathml } from "../scripts/findings-math.mjs";

const data = loadAll();
const withLedger = (relations, redirects) => ({ ...data, ledger: { relations: [...data.ledger.relations, ...relations], redirects } });
const out = (res, name) => (res.outputs.find(([f]) => f === name) || [])[1];
const file = (id) => `${id}-${data.meta[id].slug}.html`;
const REFUTE = { from: "F675", to: "F132", type: "refuted", scope: "fixture", date: "2026-11-10", note: "A fixture refutation for the test." };

test("a refuted finding with no redirect target stops the build", () => {
  assert.throws(() => build(withLedger([REFUTE], {})), /F132 is refuted and has no redirect target/);
});

test("a refuted finding redirects to the finding that replaced it, which carries the old record", () => {
  const res = build(withLedger([REFUTE], { F132: "F675" }));
  const stub = out(res, file("F132")), repl = out(res, file("F675"));
  assert.match(stub, /<meta http-equiv="refresh" content="0; url=\/findings\/F675-[a-z0-9-]+\.html">/);
  assert.match(stub, /<meta name="robots" content="noindex">/);
  assert.match(repl, /<h3>Findings this one replaced<\/h3>/);
  assert.match(repl, /id="replaced-F132"[\s\S]*?A fixture refutation for the test\.[\s\S]*?href="\/findings\/papers\/F132\.pdf"/);
  const pages = JSON.parse(out(res, "pages.json")).pages;
  assert.equal(pages.find((p) => p.id === "F132").indexable, false);
  assert.match(out(res, "index.html"), /id="f132"[\s\S]*?Its page now opens <a href="\/findings\/F675-/);
});

test("a retracted finding with no replacement redirects to its own entry on the index", () => {
  const res = build(withLedger([{ ...REFUTE, type: "retracted" }], { F132: null }));
  assert.match(out(res, file("F132")), /url=\/findings\/#f132"/);
  assert.match(out(res, "index.html"), /id="f132"[^>]*data-standing="retracted"[\s\S]*?Its page now opens this entry\./);
});

test("a redirect to a finding with no page stops the build", () => {
  assert.throws(() => build(withLedger([REFUTE], { F132: "F9999" })), /redirects to F9999, which has no page/);
});

test("every link to a finding gets its flag, once, and none inside a drawing", () => {
  const s = standings([{ id: "F63", href: "/findings/F63-x.html" }, { id: "F14", href: "/findings/F14-y.html" }], data.ledger.relations);
  const html = '<p><a href="/findings/F63-x.html">F63</a> and <a href="https://harperz9.github.io/findings/F14-y.html#c1">F14</a> and <a href="/findings/F1-z.html">F1</a></p><svg><a href="/findings/F63-x.html"></a></svg>';
  const once = flagLinks(html, s);
  assert.equal(flagLinks(once, s), once, "flagging twice changes nothing");
  assert.match(once, /F63<\/a><a class="sflag s-narrowed" data-flag="F63"[^>]*>.*?<span>narrowed in part<\/span><\/a>/);
  assert.match(once, /F14<\/a><a class="sflag s-extended" data-flag="F14"/);
  assert.doesNotMatch(once, /data-flag="F1"/, "an unpublished finding gets no flag");
  assert.doesNotMatch(once.slice(once.indexOf("<svg>")), /sflag/, "no flag inside an SVG");
});

test("the schema check refuses a broken record", () => {
  const schema = JSON.parse(readFileSync(new URL("../findings/data/research-record.schema.json", import.meta.url), "utf8"));
  const rec = structuredClone(data.records[0]);
  assert.deepEqual(validate(schema, rec), []);
  rec.document.outcome = "maybe"; delete rec.verified; rec.claims[0].id = "claim1";
  assert.equal(validate(schema, rec).length, 3);
});

test("maths becomes MathML, and an unknown command stops the build", () => {
  assert.equal(mathml("\\frac{k + 1}{n + 1}"), "<math><mrow><mfrac><mrow><mi>k</mi><mo>+</mo><mn>1</mn></mrow><mrow><mi>n</mi><mo>+</mo><mn>1</mn></mrow></mfrac></mrow></math>");
  assert.match(mathml("\\sum_{i} p_i \\log_2 p_i", true), /<munder><mo largeop="true" movablelimits="false">∑<\/mo>/);
  assert.throws(() => mathml("\\unheardof x"), /unknown command/);
});
