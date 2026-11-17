// Every chart the site draws says what its data does (direction, shape, peaks and lows, range) before its axes, and
// the words are computed from the data, so they stay true when it changes. Run: node --test tests/chart-descriptions.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { checkDescription, describeCurve, describeRows, describeScatter, describeTiming } from "../system/chart-describe.mjs";
import { chartHtml, describeChart } from "../scripts/findings-charts.mjs";
import { motion } from "../world/studio/lib/lanes/motion.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const specs = readdirSync(join(ROOT, "findings", "charts")).filter((f) => f.endsWith(".json")).map((f) => JSON.parse(readFileSync(join(ROOT, "findings", "charts", f), "utf8")));
const unesc = (s) => s.replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#39;/g, "'").replace(/&amp;/g, "&");
const DATA_FORMS = ["line", "scatter", "bars", "interval", "band", "dumbbell", "matrix"];

test("planted: a description that names only the axes fails", () => {
  const { facts } = describeCurve([[0, 0], [1, 0.4], [2, 0.9], [3, 1]]);
  assert.ok(checkDescription("Timing curve: progress against time", facts).some((e) => /no trend/.test(e)));
  assert.ok(checkDescription("Progress against time, 0 to 2.7 s.", facts).some((e) => /no trend/.test(e)));
});

test("planted: a description that says rises over falling data fails", () => {
  const { facts } = describeCurve([[0, 5], [1, 4], [2, 2.5], [3, 1]]);
  assert.ok(checkDescription("The value rises from 5 at 0 to 1 at 3.", facts).some((e) => /rises, but it never rises/.test(e)));
  assert.deepEqual(checkDescription(describeCurve([[0, 5], [1, 4], [2, 2.5], [3, 1]]).text, facts), []);
});

test("planted: a row chart that names the wrong row as highest fails", () => {
  const { facts } = describeRows([{ label: "A", value: 1 }, { label: "B", value: 3 }], { form: "bars" });
  assert.ok(checkDescription("A is highest at 1 and B lowest at 3.", facts).length > 0);
});

test("the describer reads shape from known curves", () => {
  const rise = (f) => Array.from({ length: 41 }, (_, i) => [i / 40, f(i / 40)]);
  assert.match(describeCurve(rise((u) => u)).text, /rises .* nearly steady rate/);
  assert.match(describeCurve(rise((u) => 1 - (1 - u) ** 4)).text, /first third, then levelling off/);
  assert.match(describeCurve(rise((u) => 0.5 - 0.5 * Math.cos(Math.PI * u))).text, /slowly at first, .*middle third/);
  assert.match(describeCurve(rise((u) => Math.floor(u * 4.999) / 4)).text, /in \d+ steps with holds/);
  assert.match(describeCurve(rise((u) => Math.sin(Math.PI * u))).text, /rises .* to a peak of 1 at 0\.5, then falls/);
  assert.match(describeCurve(rise((u) => Math.min(1.1, 1.1 * u * 1.5) - Math.max(0, u - 0.8) * 0.5)).text, /overshoots to 1\.1/);
  assert.match(describeCurve([[0, 2], [1, 2], [2, 2.001]]).text, /stays level/);
  assert.match(describeScatter([[0, 0], [1, 1.2], [2, 1.9], [3, 3.1]]).text, /tends to rise as x rises/);
});

test("the timing curve says what it does, for every curve the motion lane draws", () => {
  for (const curve of ["engravingReveal", "glyphCascade", "revealOut", "rope", "linear", "sineInOut", "expoOut", "stepped"]) {
    const mo = motion({ hints: { motion: { curve } }, core: { durationS: 2.7, tension: 0.4 } });
    const d = describeTiming(mo.samples(48), mo.durationS);
    assert.deepEqual(checkDescription(d.text, d.facts), [], `${curve}: ${d.text}`);
    assert.match(d.text, /^Progress rises from 0 percent at 0\.0 s to 100 percent at 2\.7 s/, curve);
  }
});

test("the published playground's timing curve describes the line it draws", () => {
  const html = readFileSync(join(ROOT, "playground", "index.html"), "utf8");
  const svg = html.match(/<svg class="sx-curve"[^>]*aria-label="([^"]*)"[^]*?<polyline points="([^"]*)"/);
  assert.ok(svg, "no timing curve on the playground page");
  const drawn = svg[2].trim().split(/\s+/).map((p) => p.split(",").map(Number)).map(([x, y]) => [(x - 4) / 192, (76 - y) / 72]);
  const { facts } = describeCurve(drawn);
  const label = unesc(svg[1]);
  assert.deepEqual(checkDescription(label, facts), [], label);
  assert.ok(label.indexOf("rises") < label.indexOf("against time"), "the trend comes before the axes");
  const cap = html.match(/<figcaption>Motion curve\.([^<]*)<\/figcaption>/);
  assert.ok(cap && checkDescription(unesc(cap[1]), facts).length === 0, "the caption says what the curve does");
});

test("every findings chart drawn from data carries a computed description that passes against its own data", () => {
  let charts = 0, sentences = 0;
  for (const spec of specs) for (const ch of spec.charts) {
    if (!DATA_FORMS.includes(ch.form)) { assert.deepEqual(describeChart(ch), [], `${spec.finding} ${ch.key}`); continue; }
    const ds = describeChart(ch);
    assert.ok(ds.length > 0, `${spec.finding} ${ch.key} has no description`);
    charts++;
    for (const d of ds) if (d.facts) { sentences++; assert.deepEqual(checkDescription(d.text, d.facts), [], `${spec.finding} ${ch.key}: ${d.text}`); }
  }
  assert.ok(charts >= 100, `only ${charts} charts described`);
  assert.ok(sentences >= charts);
});

test("each findings chart puts the description in its caption and its label, and keeps its data table with headers", () => {
  for (const spec of specs) {
    const src = Object.fromEntries(spec.sources.map((s) => [s.id, s]));
    spec.charts.forEach((ch, i) => {
      if (!DATA_FORMS.includes(ch.form)) return;
      const html = chartHtml(ch, i + 1, src, spec.finding), said = describeChart(ch).map((d) => d.text).join(" ");
      const label = unesc(html.match(/class="fc-draw" role="group" aria-label="([^"]*)"/)[1]);
      assert.ok(label.includes(said), `${spec.finding} ${ch.key}: label lacks the description`);
      assert.ok(unesc(html).includes(`<span class="fc-said">${said}</span>`), `${spec.finding} ${ch.key}: caption lacks the description`);
      assert.match(html, /<table><thead><tr><th scope="col">/, `${spec.finding} ${ch.key}: data table lost its headers`);
    });
  }
});

test("the published findings pages carry the same descriptions the build computes", () => {
  const pages = readdirSync(join(ROOT, "findings")).filter((f) => /^F\d+-.*\.html$/.test(f));
  let found = 0;
  for (const spec of specs) {
    const page = pages.find((p) => p.startsWith(`${spec.finding}-`));
    const html = unesc(readFileSync(join(ROOT, "findings", page), "utf8"));
    for (const ch of spec.charts) if (DATA_FORMS.includes(ch.form)) {
      const said = describeChart(ch).map((d) => d.text).join(" ");
      assert.ok(html.includes(`<span class="fc-said">${said}</span>`), `${page} ${ch.key} is stale; run node scripts/build-findings.mjs`);
      found++;
    }
  }
  assert.ok(found >= 100);
});

test("the live motion surface describes the curve it draws for a blend", async () => {
  const { indexElements } = await import("../world/site/surfaces/elements-data.mjs");
  const { mount_motion } = await import("../world/site/surfaces/surface-lanes.mjs");
  const ix = indexElements(JSON.parse(readFileSync(join(ROOT, "world/ui/shell/organic/data/elements.json"), "utf8")));
  const host = { innerHTML: "", classList: { add() {}, remove() {} } };
  const ids = [...ix.byId.keys()];
  for (const pick of [ids.slice(0, 3), ids.slice(5, 7), ids.slice(-2)]) {
    mount_motion(host, { elements: pick }, { ix });
    const pts = host.innerHTML.match(/<polyline points="([^"]*)"/)[1].trim().split(/\s+/).map((p) => p.split(",").map(Number)).map(([x, y]) => [(x - 4) / 192, (76 - y) / 72]);
    const label = unesc(host.innerHTML.match(/aria-label="([^"]*)"/)[1]);
    assert.deepEqual(checkDescription(label, describeCurve(pts).facts), [], label);
  }
});
