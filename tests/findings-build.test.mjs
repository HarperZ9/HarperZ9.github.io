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
import { shortDefinition } from "../scripts/findings-render.mjs";
import { outcomeProblem, verdictsFor } from "../scripts/findings-outcome.mjs";

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
  const quiet = standings([{ id: "F114", href: "/findings/F114-q.html" }], data.ledger.relations);
  assert.equal(flagLinks('<a href="/findings/F114-q.html">F114</a>', quiet), '<a href="/findings/F114-q.html">F114</a>', "an untreated finding gets no mark");
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

test("the site's PDFs and figures carry no hidden author metadata", async () => {
  const { readdirSync } = await import("node:fs");
  const { blankPdf, leftover, stripPng } = await import("../scripts/findings-metadata.mjs");
  const dir = new URL("../findings/", import.meta.url);
  for (const f of readdirSync(new URL("papers/", dir)).filter((x) => x.endsWith(".pdf"))) {
    const b = readFileSync(new URL(`papers/${f}`, dir));
    assert.deepEqual(leftover(b, "pdf"), [], f);
    assert.ok(blankPdf(b).equals(b), `${f}: blanking again changes it`);
  }
  for (const id of readdirSync(new URL("src/", dir))) for (const f of readdirSync(new URL(`src/${id}/`, dir)).filter((x) => x.endsWith(".png"))) {
    const b = readFileSync(new URL(`src/${id}/${f}`, dir));
    assert.deepEqual(leftover(b, "png"), [], `${id}/${f}`);
    assert.ok(stripPng(b).equals(b));
  }
  const sample = Buffer.from("1 0 obj << /Author (Someone Else) /Title (x) >> endobj", "latin1");
  assert.equal(blankPdf(sample).toString("latin1"), "1 0 obj << /Author (            ) /Title (x) >> endobj");
  assert.deepEqual(leftover(sample, "pdf"), ["Author"]);
});

// The outcome word against the verdicts: a page may not say "held" while its kill rule fired or more of its
// preregistered verdicts failed than passed. Checked three ways: the rule itself, the record writer refusing the
// word, and every built page read back from its own header.
test("the outcome rule refuses held when a kill rule fired or most verdicts failed", () => {
  assert.match(outcomeProblem("held", { held: 5, failed: 4 }, { state: "fired", note: "x" }), /kill rule fired/);
  assert.match(outcomeProblem("held", { held: 2, failed: 4 }, undefined), /4 of 6 verdicts failed/);
  assert.equal(outcomeProblem("held", { held: 5, failed: 5 }, { state: "not fired", note: "x" }), null);
  assert.equal(outcomeProblem("mixed", { held: 2, failed: 4 }, { state: "fired", note: "x" }), null);
});

test("the record writer stops on a held outcome that the verdicts contradict", () => {
  const meta = data.meta.F172;
  assert.equal(meta.kill.state, "fired");
  assert.throws(() => verdictsFor("F172", { ...meta, outcome: "held" }), /F172: the outcome is "held" while a kill rule fired/);
  assert.throws(() => verdictsFor("F47", { ...data.meta.F47, outcome: "held" }), /F47: the outcome is "held" while 4 of 6 verdicts failed/);
});

test("no built page says held beside a fired kill rule or a majority of failed verdicts", () => {
  const res = build(data);
  let withVerdicts = 0;
  for (const rec of data.records) {
    const d = rec.document, html = out(res, file(d.id));
    const cell = (label) => (html.match(new RegExp(`<dt>${label}</dt><dd>(.*?)</dd>`, "s")) || [])[1]?.replace(/<[^>]+>/g, "").trim();
    const outcome = cell("Outcome"), verdicts = cell("Verdicts"), kill = cell("Kill rule");
    assert.ok(outcome, `${d.id}: the header names an outcome`);
    if (d.verdicts) {
      withVerdicts += 1;
      assert.equal(verdicts, `${d.verdicts.held} passed, ${d.verdicts.failed} failed${d.verdicts.untestable ? `, ${d.verdicts.untestable} untestable` : ""}`, `${d.id}: the header shows the verdict count`);
    }
    if (outcome !== "held") continue;
    assert.notEqual(kill, "fired", `${d.id}: held beside a fired kill rule`);
    const m = verdicts && verdicts.match(/^(\d+) passed, (\d+) failed/);
    if (m) assert.ok(Number(m[2]) <= Number(m[1]), `${d.id}: held while ${m[2]} verdicts failed and ${m[1]} passed`);
  }
  assert.ok(withVerdicts >= 20, "most findings carry a verdict count");
});

// A term's short definition is what a reader sees before opening the rest. It must read as a whole sentence:
// closed with a full stop on the page, and never stopping on a word that needs something after it.
test("no short definition stops mid-sentence", () => {
  const glossary = JSON.parse(readFileSync(new URL("../findings/records/glossary.json", import.meta.url), "utf8"));
  const DANGLING = /\b(that|which|who|whose|when|where|and|or|but|if|because|than|the|a|an|its|their|each)$/i;
  assert.ok(glossary.terms.length > 100, "the glossary is loaded");
  for (const t of glossary.terms) {
    const [first, rest] = shortDefinition(t.definition);
    assert.ok(first.length > 0, `${t.key}: empty short definition`);
    assert.doesNotMatch(first, DANGLING, `${t.key}: the short definition stops on a word that needs more: "${first.slice(-40)}"`);
    assert.doesNotMatch(first, /[,;:]$/, `${t.key}: the short definition ends on a comma or colon`);
    if (rest) assert.match(t.definition.slice(first.length, first.length + 2), /^[.;] /, `${t.key}: the short form must end where a sentence or clause closes`);
  }
  const res = build(data);
  for (const rec of data.records.slice(0, 5)) {
    const shorts = [...out(res, file(rec.document.id)).matchAll(/<span class="gd-1">(.*?)<\/span>/g)].map((m) => m[1]);
    assert.ok(shorts.length > 0, `${rec.document.id}: the page carries short definitions`);
    for (const s of shorts) assert.match(s, /\.$/, `${rec.document.id}: a short definition lacks its full stop: "${s.slice(-40)}"`);
  }
});
