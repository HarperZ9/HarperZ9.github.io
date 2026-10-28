// The pilot demo: the same three modules in two lanes.
import { assetReceipt, verifyAsset, verifyLineage, attribution, stampSvg, readSvgStamp } from "../provenance.mjs";
import { sparkline, describeSeries, halftone, dotsSvg, hatch, pathD, svgDoc, fmt } from "../vector.mjs";
import { auditMotion, curveFromSamples, MEASURED } from "../motion.mjs";
import { filmGradientSvg } from "../thinfilm.mjs";
import { rng, sha256, RISK_TOKENS, hotMark, riskOf } from "../vendor/superstack.mjs";

const $ = (id) => document.getElementById(id);
const enc = new TextEncoder();
const short = (h) => h.slice(0, 12);

// ---------------------------------------------------------------- one hot mark per view

function paintVerdicts() {
  const nodes = [...document.querySelectorAll(".verdict")];
  const levels = nodes.map((n) => riskOf(n.dataset.verdict || "UNVERIFIABLE"));
  const hot = hotMark(levels);
  const dark = matchMedia("(prefers-color-scheme: dark)").matches && document.documentElement.dataset.theme !== "light";
  nodes.forEach((n, i) => {
    if (i === hot) { n.dataset.riskHot = ""; n.style.setProperty("--hot-colour", RISK_TOKENS[dark ? "dark" : "light"][levels[i]]); }
    else { delete n.dataset.riskHot; n.style.removeProperty("--hot-colour"); }
  });
}

const devLog = (what, data) => { if (/^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname)) console.info(`substrate demo: ${what}`, data); };
function setVerdict(node, verdict, words) {
  node.dataset.verdict = verdict;
  node.textContent = `${verdict}: ${words}`;
  paintVerdicts();
}

// ---------------------------------------------------------------- lane A: the report figure

const LABELS = ["b1", "b2", "b3", "b4", "b5", "b6", "b7", "b8"];
const SERIES = [6.1, 5.8, 5.9, 4.2, 4.4, 3.1, 3.3, 2.7];
let current = SERIES.slice();
let stamped = "";

function drawChart() {
  const title = "False-accept rate by build (sample)";
  const opts = { width: 480, height: 140, pad: 10, title, unit: "%", labels: LABELS, id: "fa" };
  const data = enc.encode(JSON.stringify({ labels: LABELS, values: SERIES, unit: "%" }));
  const rec = assetReceipt({
    name: "fa-rate-by-build", producer: "flywheel-report", version: "pilot", media: "application/json",
    content: data, licence: "CC-BY-4.0", creator: "Zain Dana Harper", title, operation: "sparkline from values",
  });
  stamped = stampSvg(sparkline(SERIES, opts), rec);
  $("chart").innerHTML = stamped;
  $("chart-desc").textContent = describeSeries(SERIES, { label: title, unit: "%", labels: LABELS });
  devLog("chart receipt", { receipt: rec.receipt_sha256, data: rec.content_sha256, svgBytes: stamped.length });
  $("chart-meta").textContent = "Sample data, drawn by the vector module.";
}

function recheck() {
  const rec = readSvgStamp(stamped);
  const data = enc.encode(JSON.stringify({ labels: LABELS, values: current, unit: "%" }));
  const errs = verifyAsset(rec, data);
  if (!errs.length) setVerdict($("chart-verdict"), "MATCH", "the data hashes to the stamp");
  else setVerdict($("chart-verdict"), "DRIFT", `the data no longer matches (${errs.join(", ")})`);
}

$("recheck").addEventListener("click", recheck);
$("tamper").addEventListener("click", (e) => {
  const on = e.currentTarget.getAttribute("aria-pressed") !== "true";
  e.currentTarget.setAttribute("aria-pressed", String(on));
  e.currentTarget.textContent = on ? "Restore the value" : "Change one value";
  current = SERIES.slice();
  if (on) current[7] = 1.9;
  recheck();
});

// ---------------------------------------------------------------- lane B: the plate

const W = 240, H = 150, CELL = 6;

function field(seed) {
  const r = rng(seed);
  const G = 7, lat = Array.from({ length: (G + 1) * (G + 1) }, () => r.nextFloat());
  const at = (i, j) => lat[j * (G + 1) + i];
  const g = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const u = (x / W) * G, v = (y / H) * G, i = Math.floor(u), j = Math.floor(v), fu = u - i, fv = v - j;
    const n = at(i, j) * (1 - fu) * (1 - fv) + at(i + 1, j) * fu * (1 - fv) + at(i, j + 1) * (1 - fu) * fv + at(i + 1, j + 1) * fu * fv;
    const d = Math.hypot(x - W * 0.62, y - H * 0.34) / (H * 0.24);
    const orb = d < 1 ? 0.12 + 0.3 * d * d : 1;
    g[y * W + x] = Math.round(255 * Math.min(1, d < 1 ? orb * (0.6 + 0.4 * n) : 0.7 + 0.3 * n));
  }
  return g;
}

function drawPlate(seed) {
  const grey = field(seed);
  const tide = { station: "sample station", level_m: 1.4, max_m: 3 };
  const fieldRec = assetReceipt({
    name: "field", producer: "substrate-demo", media: "application/x-grey8", content: grey,
    licence: "CC-BY-4.0", creator: "Zain Dana Harper", title: `Seeded field ${seed}`, operation: "value noise, xmur3-mulberry32/1",
  });
  const tideRec = assetReceipt({
    name: "tide", producer: "open-archives (sample)", media: "application/json", content: JSON.stringify(tide),
    licence: "cc by-sa", creator: "sample archive", title: "Tide record (sample)", source: "a sample record, not a real archive",
  });
  const waterTop = H * (1 - (tide.level_m / tide.max_m) * 0.6);
  const water = [];
  for (let x = 0; x <= W; x += 10) water.push([x, waterTop + 3 * Math.sin(x / 17)]);
  water.push([W, H], [0, H]);
  const lines = hatch(water, { angle: 0, spacing: 4 });
  const dots = halftone(grey, W, Math.floor(waterTop), { cell: CELL });
  // The spectrum stays inside the art: only the moon's dots take the thin-film colour.
  const inMoon = (d) => Math.hypot(d.x - W * 0.62, d.y - H * 0.34) < H * 0.24;
  const moon = dots.filter(inMoon), sky = dots.filter((d) => !inMoon(d));
  const film = filmGradientSvg("film", { dMin: 150, dMax: 650, count: 16, line: [W * 0.62 - H * 0.24, H * 0.1, W * 0.62 + H * 0.24, H * 0.58] });
  const body = `<defs>${film}</defs><rect width="${W}" height="${H}" fill="none"/>`
    + `<g class="plate-dots">${dotsSvg(sky, { precision: 1 })}${dotsSvg(moon, { precision: 1, fill: "url(#film)" })}</g>`
    + `<path d="${pathD(lines, { precision: 1 })}" fill="none" stroke="currentColor" stroke-width="0.6"/>`;
  const svg = svgDoc({ width: W, height: H, body, id: "plate", title: `Low Water plate, seed ${seed}`,
    desc: `A halftone moon over hatched water. ${dots.length} dots, ${lines.length} hatch lines, tide ${fmt(tide.level_m)} m.` });
  const plateRec = assetReceipt({
    name: "plate", producer: "substrate-demo", media: "image/svg+xml", content: svg, licence: "CC-BY-4.0",
    creator: "Zain Dana Harper", title: `Low Water plate ${seed}`, operation: "halftone and hatch", inputs: [fieldRec, tideRec],
  });
  $("plate").innerHTML = stampSvg(svg, plateRec);
  // The dots arrive on the glyph-cascade curve measured from a reference clip (1.8 s, 1.8% overshoot
  // in opacity is clamped by the browser, so the curve reads as its timing only).
  const cascadeCurve = curveFromSamples(MEASURED.glyphCascade);
  const dotsNode = $("plate").querySelector(".plate-dots");
  if (dotsNode && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
    dotsNode.style.animationTimingFunction = cascadeCurve.easing;
    dotsNode.style.animationDuration = `${cascadeCurve.durationMs}ms`;
  }
  const store = new Map([fieldRec, tideRec].map((r) => [r.receipt_sha256, r]));
  const res = verifyLineage(plateRec, store);
  devLog("plate lineage", res);
  if (!res.ok) console.warn("substrate demo: plate lineage broke", res.errors);
  $("credits").innerHTML = "";
  for (const r of [plateRec, fieldRec, tideRec]) {
    const li = document.createElement("li");
    li.textContent = attribution(r);
    $("credits").append(li);
  }
  devLog("plate receipt", { basis: plateRec.licence.basis, receipt: plateRec.receipt_sha256, dots: dots.length });
  $("plate-meta").textContent = `Licence: ${plateRec.licence.basis}. ${dots.length} dots.`;
}

let seedN = 1;
$("reseed").addEventListener("click", () => { seedN += 1; drawPlate(`low-water/plate-${seedN}`); });

// ---------------------------------------------------------------- the audit and the catalogue

const BAD = [
  ".toast{transition:all 600ms ease}",
  ".spinner{animation:spin 1.2s linear infinite}",
  ".drawer{transition:width 300ms, height 300ms}",
  "@keyframes spin{to{transform:rotate(1turn)}}",
].join("\n");

function showAudit(css, scoreId, listId) {
  const r = auditMotion(css);
  $(scoreId).textContent = `${r.score} / 100`;
  const ul = $(listId);
  ul.innerHTML = "";
  if (!r.findings.length) { const li = document.createElement("li"); li.textContent = "No findings."; ul.append(li); }
  for (const f of r.findings) {
    const li = document.createElement("li");
    li.textContent = `Line ${f.line}, ${f.rule} (${f.level}): ${f.fix}`;
    ul.append(li);
  }
}

const MODULES = [
  ["provenance.mjs", "Receipts for any asset, lineage, licence basis, SVG stamps.", 'assetReceipt({ name, producer, content, licence })'],
  ["vector.mjs", "SVG path data, smoothing, hatch, halftone, described sparklines.", "sparkline(values, { title, unit })"],
  ["motion.mjs", "Easing and spring tokens, measured timing curves, and the motion audit.", "auditMotion(cssText)"],
  ["thinfilm.mjs", "Thin-film interference colour by thickness: lookup tables and SVG gradients.", "filmGradientSvg(\"film\", { dMin: 150, dMax: 650 })"],
];

async function catalogue() {
  const ul = $("catalogue");
  for (const [file, job, call] of MODULES) {
    const text = await (await fetch(`../${file}`)).text();
    const imports = [...text.matchAll(/^import .* from "([^"]+)"/gm)].map((m) => m[1]);
    const li = document.createElement("li");
    li.innerHTML = `<strong></strong> <span></span><pre><code></code></pre><span class="meta"></span>`;
    li.querySelector("strong").textContent = file;
    li.querySelector("span").textContent = job;
    li.querySelector("code").textContent = call;
    li.querySelector(".meta").textContent = `${(text.length / 1024).toFixed(1)} KB source | 0 dependencies | imports: ${imports.length ? imports.join(", ") : "none"} `;
    ul.append(li);
  }
}

async function main() {
  drawChart();
  recheck();
  drawPlate("low-water/plate-1");
  const own = await (await fetch("demo.css")).text();
  showAudit(own, "score-own", "find-own");
  showAudit(BAD, "score-bad", "find-bad");
  await catalogue();
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", paintVerdicts);
}

main().catch((err) => {
  console.error("substrate demo failed to start:", err);
  throw err;
});
