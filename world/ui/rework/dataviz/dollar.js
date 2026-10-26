// Pilot 01: what a 1913 dollar keeps. US CPI-U (BLS, via FRED), annual averages 1913 to 2024.
import { loadPinned, receiptPanel, alt, plainChart, table, palette, onThemeOrResize } from "./lib/honesty.js";
import { layout, drawSheet, drawScales, ribAt } from "./lib/stripefield.js";
import { sliderGuess, gapWords } from "./lib/guess.js";
import { setWords, weightKey } from "./lib/typeset.js";
import { play } from "./lib/sonify.js";
import { ease } from "./substrate/motion.mjs";

const PINNED = "4cddc419f30ca803007aa4cfb9aea44cc9cfb8b94097c0126ef68eecdab4ffb6"; // data/cpi-annual.json, also in SOURCES.md
const reduced = matchMedia("(prefers-reduced-motion: reduce)");
const $ = (id) => document.getElementById(id);
const canvas = $("sheet");
const state = { rows: [], hot: null, reveal: 0, revealed: false, geo: null, L: null };

const fmtC = (c) => (c >= 10 ? c.toFixed(0) : c.toFixed(1)) + "¢";
const fmtP = (p) => (p == null ? "n/a (first year)" : (p > 0 ? "+" : "") + p.toFixed(1) + "%");

function draw() {
  if (!state.rows.length) return;
  const rows = state.rows, n = rows.length, dpr = Math.min(devicePixelRatio || 1, 2);
  const w = canvas.clientWidth || canvas.parentElement.clientWidth;
  const vertical = w < 700;
  const h = vertical ? n * 7 + 110 : Math.round(Math.min(560, Math.max(380, w * 0.36)));
  canvas.style.height = h + "px";
  canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
  const ctx = canvas.getContext("2d"); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h);
  const colors = palette();
  const L = layout({ w, h, n, orientation: vertical ? "v" : "h", pad: vertical ? { a0: 56, a1: 48, c0: 30, c1: 64 } : { a0: 64, a1: 56, c0: 30, c1: 40 } });
  const font = `${vertical ? 11 : 13}px ${getComputedStyle(document.body).getPropertyValue("--mono") || "monospace"}`;
  const decades = rows.map((r, i) => (r.year % 10 === 0 || i === 0 || i === n - 1 ? i : -1)).filter((i) => i >= 0 && !(i === n - 1 && rows[i].year % 10 < 4 && rows[i].year % 10 > 0));
  drawScales(ctx, L, {
    swayMax: 20, swayShare: vertical ? 0.5 : 0.32, swayTicks: [-10, 0, 10, 20], widthTicks: [{ v: 1, label: "100¢" }, { v: 0.5, label: "50¢" }, { v: 0.1, label: "10¢" }],
    timeTicks: decades, labels: rows.map((r) => r.year), colors, font,
  });
  const out = drawSheet(ctx, L, {
    width: rows.map((r) => r.cents_left / 100), sway: rows.map((r) => r.inflation_pct), swayMax: 20, swayShare: vertical ? 0.5 : 0.32,
    reveal: state.revealed ? state.reveal : 1 / n, hot: state.revealed ? state.hot : null, colors,
  });
  state.geo = out.geo; state.L = L;
}

function readout(i) {
  const r = state.rows[i];
  $("yr").textContent = r.year;
  $("r-cents").textContent = fmtC(r.cents_left);
  $("r-infl").textContent = fmtP(r.inflation_pct);
  $("r-cpi").textContent = r.cpi.toFixed(1);
}

function focus(i) {
  if (!state.revealed || i == null) return;
  state.hot = Math.max(0, Math.min(state.rows.length - 1, i));
  readout(state.hot); draw();
}

function revealSheet() {
  state.revealed = true; state.hot = state.rows.length - 1; readout(state.hot);
  $("giant").textContent = fmtC(state.rows.at(-1).cents_left).replace(".0", "");
  if (reduced.matches) { state.reveal = 1; draw(); return; }
  const f = ease("enter"), T = 2400, t0 = performance.now();
  const step = (now) => { const p = Math.min(1, (now - t0) / T); state.reveal = f(p); draw(); if (p < 1) requestAnimationFrame(step); };
  requestAnimationFrame(step);
}

function plainView(rows) {
  const labels = rows.map((r) => r.year), ticks = rows.map((r, i) => (r.year % 20 === 0 ? i : -1)).filter((i) => i >= 0);
  const cents = rows.map((r) => r.cents_left), infl = rows.map((r) => r.inflation_pct);
  $("plain").innerHTML = `<h3>What a 1913 dollar buys, in cents (axis from zero)</h3>`
    + plainChart({ width: 960, height: 300, series: [{ values: cents, kind: "line" }], labels, yMin: 0, yMax: 100, yTicks: [0, 25, 50, 75, 100], yUnit: "¢", xTicks: ticks, title: "What a 1913 dollar buys", desc: alt(cents, { label: "Cents of a 1913 dollar", unit: "cents", labels }), hot: rows.length - 1 })
    + `<h3>Inflation each year, percent change in the annual average price index</h3>`
    + plainChart({ width: 960, height: 260, series: [{ values: infl, kind: "bar" }], labels, yMin: -15, yMax: 20, yTicks: [-10, 0, 10, 20], yUnit: "%", xTicks: ticks, title: "Inflation each year", desc: alt(infl.slice(1), { label: "Inflation", unit: "percent", labels: labels.slice(1) }) });
}

function typeset(rows) {
  const scale = { lo: 0, hi: 100, wMin: 100, wMax: 900, step: 25 };
  const picks = rows.filter((r) => r.year === 1913 || r.year % 10 === 0 || r.year === rows.at(-1).year);
  $("words").innerHTML = setWords(picks.map((r) => ({ text: String(r.year), value: r.cents_left, label: `${r.year}, a 1913 dollar buys` })), scale, { unit: " cents" });
  $("key").innerHTML = weightKey("1913", scale, { steps: 5, unit: "¢" });
}

async function main() {
  let r;
  try {
    r = await loadPinned("data/cpi-annual.json", {
      pinned: PINNED, name: "cpi-annual", licence: "public domain", title: "CPI-U annual averages 1913 to 2024",
      creator: "US Bureau of Labor Statistics", source: "https://fred.stlouisfed.org/series/CPIAUCNS",
      operation: "annual average of 12 monthly values; inflation as change in annual average; cents left = 100 x CPI(1913) / CPI(year)",
    });
  } catch (e) {
    console.error("dollar: data failed to load", e);
    $("receipt").textContent = "The data file did not load, so nothing is drawn. Open this page through a local web server.";
    return;
  }
  const rows = r.data.rows; state.rows = rows;
  receiptPanel($("receipt"), r, {
    sourceUrl: "https://fred.stlouisfed.org/series/CPIAUCNS", sourceName: "CPIAUCNS, US Bureau of Labor Statistics via FRED (St. Louis Fed)",
    licenceText: "Public domain: a work of the US federal government (17 U.S.C. 105). FRED is the carrier, BLS the publisher.",
    retrieved: "2026-10-23", transform: r.data.method, dropped: "2025: the source has no October 2025 value, so no full-year average exists yet.",
  });
  const labels = rows.map((x) => x.year);
  canvas.setAttribute("aria-label", "Ribbed sheet chart. " + alt(rows.map((x) => x.cents_left), { label: "Cents of a 1913 dollar", unit: "cents", labels }) + " Inflation rides the sheet as its rise and fall; the plain view and the table hold every value.");
  plainView(rows); typeset(rows);
  table($("table"), ["Year", "Price index", "Inflation %", "Cents of 1913 dollar"], rows.map((x) => [x.year, x.cpi.toFixed(2), x.inflation_pct == null ? "" : x.inflation_pct.toFixed(2), x.cents_left.toFixed(2)]));
  draw();
  onThemeOrResize(draw);

  sliderGuess($("guess")).then((g) => {
    const actual = Number(rows.at(-1).cents_left.toFixed(1));
    const half = rows.find((x) => x.cents_left <= 50), y70 = rows.find((x) => x.year === 1970);
    $("said").textContent = gapWords(g, actual, "¢") + ` It fell below half in ${half.year}; by 1970 it bought ${fmtC(y70.cents_left)}.`;
    revealSheet();
  });

  const pick = (ev) => { if (!state.geo) return; const b = canvas.getBoundingClientRect(); focus(ribAt(state.L, state.geo, ev.clientX - b.left, ev.clientY - b.top)); };
  canvas.addEventListener("pointermove", pick);
  canvas.addEventListener("pointerdown", pick);
  canvas.addEventListener("keydown", (ev) => {
    if (!state.revealed) return;
    const d = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1, PageDown: 10, PageUp: -10 }[ev.key];
    if (ev.key === "Home") { focus(0); ev.preventDefault(); } else if (ev.key === "End") { focus(rows.length - 1); ev.preventDefault(); }
    else if (d) { focus((state.hot ?? rows.length - 1) + d); ev.preventDefault(); }
  });

  let player = null;
  const btn = $("listen");
  btn.addEventListener("click", async () => {
    if (player) { player.stop(); return; }
    if (!state.revealed) { $("said").textContent = "Revealed without a guess."; revealSheet(); }
    btn.setAttribute("aria-pressed", "true"); btn.textContent = "Stop";
    const ev = rows.slice(1).map((x, k) => ({ value: x.inflation_pct, voice: "pluck", at: k * 0.075 }));
    try {
      player = await play(ev, { lo: -12, hi: 18, noteLo: 45, noteHi: 81 }, {
        reference: 0, onStep: (k) => focus(k + 1),
        onEnd: () => { player = null; btn.setAttribute("aria-pressed", "false"); btn.textContent = "Listen"; },
      });
    } catch (e) {
      console.warn("dollar: sound unavailable", e); player = null; btn.setAttribute("aria-pressed", "false"); btn.textContent = "Listen";
    }
  });
}
main();
