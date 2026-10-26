// Pilot 02: the room changed. World Bank Gini index (SI.POV.GINI), countries reporting in 2023 and in 2024.
import { loadPinned, receiptPanel, plainChart, table, palette, onThemeOrResize } from "./lib/honesty.js";
import { choiceGuess } from "./lib/guess.js";
import { play } from "./lib/sonify.js";
import { ease } from "./substrate/motion.mjs";
import { escapeXml } from "./substrate/vector.mjs";

const PINNED = "4bd1bc6de552d329b470842a1ab050918af0f4c3f290a21b8dfde8d468bb43b0"; // data/gini-sample.json, also in SOURCES.md
const reduced = matchMedia("(prefers-reduced-motion: reduce)");
const $ = (id) => document.getElementById(id);
const canvas = $("rooms");
const S = { beat: 1, from: 1, t: 1, dots: [], focus: null, stats: null, hits: [] };
const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
const f1 = (v) => v.toFixed(1);

function model(d) {
  const a = d.y2023, b = d.y2024, codes = new Set([...Object.keys(a), ...Object.keys(b)]);
  const dots = [...codes].map((c) => ({
    code: c, name: d.countries[c].name, region: d.countries[c].region, g23: a[c] ?? null, g24: b[c] ?? null,
    kind: a[c] != null && b[c] != null ? "stay" : a[c] != null ? "left" : "joined",
  }));
  const stay = dots.filter((x) => x.kind === "stay");
  const st = {
    n23: Object.keys(a).length, n24: Object.keys(b).length, naive23: mean(Object.values(a)), naive24: mean(Object.values(b)),
    m23: mean(stay.map((x) => x.g23)), m24: mean(stay.map((x) => x.g24)), nStay: stay.length,
    fell: stay.filter((x) => x.g24 < x.g23).length, rose: stay.filter((x) => x.g24 > x.g23).length,
    same: stay.filter((x) => x.g24 === x.g23).length, left: dots.filter((x) => x.kind === "left"), joined: dots.filter((x) => x.kind === "joined"),
  };
  st.leftMean = mean(st.left.map((x) => x.g23));
  return { dots, st };
}

// Deterministic horizontal place inside a room: a small beeswarm by rank within 1-point bins.
function swarm(list, key) {
  const bins = new Map();
  for (const x of [...list].sort((p, q) => p[key] - q[key])) {
    const k = Math.round(x[key]); const i = bins.get(k) || 0; bins.set(k, i + 1);
    x["s_" + key] = (i % 2 ? 1 : -1) * Math.ceil(i / 2);
  }
}

function geometry(w, h) {
  const narrow = w < 700, top = 36, bot = h - 34, left = narrow ? 40 : 64;
  const y = (g) => top + (1 - (g - 20) / 45) * (bot - top);
  const rw = narrow ? (w - left - 16) * 0.42 : Math.min(360, (w - left) * 0.3);
  const c1 = left + (narrow ? rw / 2 + 6 : (w - left) * 0.27), c2 = narrow ? w - 16 - rw / 2 : left + (w - left) * 0.72;
  return { narrow, top, bot, left, y, rw, c1, c2, step: narrow ? 6 : 9 };
}

function room(ctx, G, cx, label, n, col) {
  // a setback room after the 1916 zoning envelope: the wall steps back twice toward the top
  const hw = G.rw / 2, t = G.top - 6, b = G.bot + 6, s1 = t + (b - t) * 0.18, s2 = t + (b - t) * 0.08;
  ctx.strokeStyle = col.line; ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(cx - hw, b); ctx.lineTo(cx - hw, s1); ctx.lineTo(cx - hw * 0.82, s1); ctx.lineTo(cx - hw * 0.82, s2);
  ctx.lineTo(cx - hw * 0.62, s2); ctx.lineTo(cx - hw * 0.62, t); ctx.lineTo(cx + hw * 0.62, t); ctx.lineTo(cx + hw * 0.62, s2);
  ctx.lineTo(cx + hw * 0.82, s2); ctx.lineTo(cx + hw * 0.82, s1); ctx.lineTo(cx + hw, s1); ctx.lineTo(cx + hw, b - 46);
  ctx.moveTo(cx + hw, b - 14); ctx.lineTo(cx + hw, b); ctx.lineTo(cx - hw, b);   // the door: a gap low on the right wall
  ctx.stroke();
  ctx.fillStyle = col.soft; ctx.textAlign = "center"; ctx.textBaseline = "bottom";
  ctx.fillText(G.narrow ? `${label}: ${n}` : `${label}: ${n} countries reported`, cx, t - 6);
}

function draw() {
  if (!S.dots.length) return;
  const dpr = Math.min(devicePixelRatio || 1, 2), w = canvas.clientWidth, h = w < 700 ? 600 : Math.round(Math.min(620, Math.max(460, w * 0.42)));
  canvas.style.height = h + "px"; canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
  const ctx = canvas.getContext("2d"); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h);
  const col = palette(), G = geometry(w, h), st = S.stats, mono = getComputedStyle(document.body).getPropertyValue("--mono") || "monospace";
  ctx.font = `13px ${mono}`;
  // the axis: Gini 20 to 65, labelled
  ctx.strokeStyle = col.line; ctx.fillStyle = col.soft; ctx.textAlign = "right"; ctx.textBaseline = "middle"; ctx.lineWidth = 1;
  for (const g of [20, 30, 40, 50, 60]) { ctx.beginPath(); ctx.moveTo(G.left - 6, G.y(g)); ctx.lineTo(G.left, G.y(g)); ctx.stroke(); ctx.fillText(g, G.left - 10, G.y(g)); }
  room(ctx, G, G.c1, "2023", st.n23, col); room(ctx, G, G.c2, "2024", st.n24, col);
  const k = S.t, mix = (a, b) => a + (b - a) * k;
  const A = (beat) => ({ 1: { stay: 0.18, edge: 0.18, thread: 0, naive: 1, matched: 0 }, 2: { stay: 1, edge: 1, thread: 0, naive: 1, matched: 0 }, 3: { stay: 1, edge: 0.12, thread: 1, naive: 0.35, matched: 1 } })[beat];
  const a0 = A(S.from), a1 = A(S.beat), al = Object.fromEntries(Object.keys(a1).map((x) => [x, mix(a0[x], a1[x])]));
  S.hits = [];
  // threads first, under the dots
  if (al.thread > 0.01) {
    ctx.globalAlpha = al.thread; ctx.strokeStyle = col.soft; ctx.lineWidth = 1;
    for (const d of S.dots) if (d.kind === "stay") { ctx.beginPath(); ctx.moveTo(G.c1 + d.s_g23 * G.step, G.y(d.g23)); ctx.lineTo(G.c2 + d.s_g24 * G.step, G.y(d.g24)); ctx.stroke(); }
    ctx.globalAlpha = 1;
  }
  const dot = (x, y, filled, alpha, d, focus) => {
    ctx.globalAlpha = alpha; ctx.beginPath(); ctx.arc(x, y, focus ? 6.5 : 4.2, 0, 6.2832);
    if (filled) { ctx.fillStyle = focus ? col.hot : col.ink; ctx.fill(); } else { ctx.strokeStyle = focus ? col.hot : col.ink; ctx.lineWidth = 1.5; ctx.stroke(); }
    ctx.globalAlpha = 1; S.hits.push({ x, y, d });
  };
  for (const d of S.dots) {
    const f = S.focus === d.code;
    if (d.g23 != null) dot(G.c1 + d.s_g23 * G.step, G.y(d.g23), d.kind === "stay", d.kind === "stay" ? al.stay : al.edge, d, f);
    if (d.g24 != null) dot(G.c2 + d.s_g24 * G.step, G.y(d.g24), d.kind === "stay", d.kind === "stay" ? al.stay : al.edge, d, f);
  }
  // averages: naive in the hot colour, matched in ink; each labelled with its value
  const line = (cx, g, alpha, color, label, dash) => {
    if (alpha < 0.02) return;
    ctx.globalAlpha = alpha; ctx.strokeStyle = color; ctx.lineWidth = 3; ctx.setLineDash(dash ? [6, 5] : []);
    ctx.beginPath(); ctx.moveTo(cx - G.rw / 2, G.y(g)); ctx.lineTo(cx + G.rw / 2, G.y(g)); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = color; ctx.textAlign = "left"; ctx.textBaseline = "bottom"; ctx.font = `700 ${G.narrow ? 14 : 18}px ${getComputedStyle(document.body).getPropertyValue("--sans")}`;
    if (alpha > 0.5) ctx.fillText(label, cx - G.rw / 2, G.y(g) - 4); ctx.font = `13px ${mono}`; ctx.globalAlpha = 1; // a faded line keeps its place but not its label
  };
  line(G.c1, st.naive23, al.naive, col.hot, G.narrow ? f1(st.naive23) : `all: ${f1(st.naive23)}`, S.beat === 3);
  line(G.c2, st.naive24, al.naive, col.hot, G.narrow ? f1(st.naive24) : `all: ${f1(st.naive24)}`, S.beat === 3);
  line(G.c1, st.m23, al.matched, col.ink, G.narrow ? f1(st.m23) : `same ${st.nStay}: ${f1(st.m23)}`, false);
  line(G.c2, st.m24, al.matched, col.ink, G.narrow ? f1(st.m24) : `same ${st.nStay}: ${f1(st.m24)}`, false);
}

function animateTo(beat) {
  S.from = S.beat; S.beat = beat; S.t = 0;
  document.querySelectorAll("[data-beat]").forEach((b) => b.setAttribute("aria-pressed", String(Number(b.dataset.beat) === beat)));
  const st = S.stats;
  $("big").textContent = beat === 3 ? (st.m24 - st.m23 > 0 ? "+" : "") + f1(st.m24 - st.m23) : "+" + f1(st.naive24 - st.naive23);
  if (reduced.matches) { S.t = 1; draw(); return; }
  const f = ease("enter"), t0 = performance.now(), T = 700;
  const step = (now) => { const p = Math.min(1, (now - t0) / T); S.t = f(p); draw(); if (p < 1) requestAnimationFrame(step); };
  requestAnimationFrame(step);
}

function focusDot(d) {
  if (!d) return;
  S.focus = d.code;
  const part = (y, g) => (g == null ? `no ${y} figure` : `${y}: ${f1(g)}`);
  $("r-focus").textContent = `${d.name} (${d.region}). ${part(2023, d.g23)}, ${part(2024, d.g24)}.`;
  draw();
}

function plainView(d, st) {
  const stay = S.dots.filter((x) => x.kind === "stay").sort((p, q) => p.g23 - q.g23);
  const yr = d.yearly, labels = yr.map((r) => r.year), ticks = labels.map((y, i) => (y % 5 === 0 ? i : -1)).filter((i) => i >= 0);
  $("plain").innerHTML = `<h3>World average of the Gini index, all countries reporting that year</h3>`
    + plainChart({ width: 960, height: 260, series: [{ values: yr.map((r) => r.mean), kind: "line" }], labels, yMin: 0, yMax: 60, yTicks: [0, 20, 40, 60], xTicks: ticks, title: "Average Gini index by year", desc: `Average of the countries that reported each year, ${labels[0]} to ${labels.at(-1)}. 2023: ${st.n23} countries, ${f1(st.naive23)}. 2024: ${st.n24} countries, ${f1(st.naive24)}.`, hot: labels.length - 1 })
    + `<h3>How many countries reported each year</h3>`
    + plainChart({ width: 960, height: 200, series: [{ values: yr.map((r) => r.n), kind: "bar" }], labels, yMin: 0, yMax: 100, yTicks: [0, 50, 100], xTicks: ticks, title: "Countries reporting a Gini index by year", desc: `From ${yr[0].n} in ${labels[0]} to ${yr.at(-1).n} in ${labels.at(-1)}.`, hot: labels.length - 1 })
    + `<h3>The ${st.nStay} countries with both years, 2023 then 2024</h3><ul class="pairs">`
    + stay.map((x) => `<li>${escapeXml(x.name)}: ${f1(x.g23)} to ${f1(x.g24)} (${x.g24 - x.g23 >= 0 ? "+" : ""}${f1(x.g24 - x.g23)})</li>`).join("") + `</ul>`;
}

async function main() {
  let r;
  try {
    r = await loadPinned("data/gini-sample.json", {
      pinned: PINNED, name: "gini-sample", licence: "CC-BY-4.0", title: "Gini index, countries reporting in 2023 and 2024, with yearly averages",
      creator: "World Bank, Poverty and Inequality Platform, in World Development Indicators", source: "https://data.worldbank.org/indicator/SI.POV.GINI",
      operation: "aggregates removed; unweighted mean per year over reporting countries",
    });
  } catch (e) {
    console.error("room: data failed to load", e);
    $("receipt").textContent = "The data file did not load, so nothing is drawn. Open this page through a local web server.";
    return;
  }
  const { dots, st } = model(r.data); S.dots = dots; S.stats = st;
  swarm(dots.filter((x) => x.g23 != null), "g23"); swarm(dots.filter((x) => x.g24 != null), "g24");
  receiptPanel($("receipt"), r, {
    sourceUrl: "https://data.worldbank.org/indicator/SI.POV.GINI", sourceName: "SI.POV.GINI, World Bank, World Development Indicators (API, last updated " + r.data.lastupdated + ")",
    licenceText: "CC BY 4.0, the World Bank's licence for its open datasets (datacatalog.worldbank.org/public-licenses). Attribution: The World Bank.",
    retrieved: "2026-10-23", transform: r.data.method, dropped: "Regional and income aggregates; countries with no figure in either year.",
  });
  $("r-naive").textContent = `${f1(st.naive23)} (${st.n23} countries) to ${f1(st.naive24)} (${st.n24} countries)`;
  $("r-matched").textContent = `${f1(st.m23)} to ${f1(st.m24)} (${st.nStay} countries)`;
  $("r-tally").textContent = `${st.fell} fell, ${st.rose} rose, ${st.same} unchanged`;
  canvas.setAttribute("aria-label", `Two rooms of dots. 2023: ${st.n23} countries, average Gini ${f1(st.naive23)}. 2024: ${st.n24} countries, average ${f1(st.naive24)}. ${st.left.length} countries reported only in 2023 (their average ${f1(st.leftMean)}) and ${st.joined.length} only in 2024. The ${st.nStay} countries with both years averaged ${f1(st.m23)} then ${f1(st.m24)}: ${st.fell} fell, ${st.rose} rose, ${st.same} unchanged.`);
  plainView(r.data, st);
  table($("table"), ["Country", "Region", "2023", "2024", "Change"], dots.sort((p, q) => p.name.localeCompare(q.name)).map((x) => [x.name, x.region, x.g23 ?? "", x.g24 ?? "", x.kind === "stay" ? f1(x.g24 - x.g23) : x.kind === "left" ? "2023 only" : "2024 only"]));
  draw(); onThemeOrResize(draw);

  document.querySelectorAll("[data-beat]").forEach((b) => b.addEventListener("click", () => animateTo(Number(b.dataset.beat))));
  choiceGuess($("guess")).then((c) => {
    const words = {
      rose: `The average says so. But ${st.left.length} countries, with an average of ${f1(st.leftMean)}, had no 2024 figure. Among the ${st.nStay} with both years, ${st.fell} fell and only ${st.rose} rose.`,
      fell: `For the ${st.nStay} countries with both years, yes, slightly: ${f1(st.m23)} to ${f1(st.m24)}. The headline average rose because the room changed.`,
      cant: `Right about the headline: an average over different countries cannot tell you. The ${st.nStay} countries that can tell you fell slightly, ${f1(st.m23)} to ${f1(st.m24)}.`,
    };
    $("said").textContent = words[c]; animateTo(2);
  });

  const nearest = (x, y) => { let best = null, bd = 400; for (const h of S.hits) { const dd = (h.x - x) ** 2 + (h.y - y) ** 2; if (dd < bd) { bd = dd; best = h.d; } } return best; };
  canvas.addEventListener("pointermove", (ev) => { const b = canvas.getBoundingClientRect(); focusDot(nearest(ev.clientX - b.left, ev.clientY - b.top)); });
  const order = () => S.dots.filter((x) => S.beat !== 3 || x.kind === "stay").sort((p, q) => (p.g23 ?? p.g24) - (q.g23 ?? q.g24));
  canvas.addEventListener("keydown", (ev) => {
    const d = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[ev.key]; if (!d) return;
    const o = order(), i = o.findIndex((x) => x.code === S.focus); focusDot(o[(i + d + o.length) % o.length]); ev.preventDefault();
  });

  let player = null; const btn = $("listen");
  btn.addEventListener("click", async () => {
    if (player) { player.stop(); return; }
    btn.setAttribute("aria-pressed", "true"); btn.textContent = "Stop";
    const stay = S.dots.filter((x) => x.kind === "stay").sort((p, q) => p.g23 - q.g23);
    const ev = [{ value: st.naive23, voice: "bell", at: 0 }, { value: st.naive24, voice: "bell", at: 0.9 }];
    stay.forEach((x, k) => { ev.push({ value: x.g23, voice: "pluck", at: 2.2 + k * 0.32 }); ev.push({ value: x.g24, voice: "pluck", at: 2.2 + k * 0.32 + 0.14 }); });
    if (S.beat !== 3) animateTo(3);
    try {
      player = await play(ev, { lo: 25, hi: 55, noteLo: 48, noteHi: 84 }, {
        onStep: (i) => { if (i >= 2) focusDot(stay[Math.floor((i - 2) / 2)]); },
        onEnd: () => { player = null; btn.setAttribute("aria-pressed", "false"); btn.textContent = "Listen"; },
      });
    } catch (e) { console.warn("room: sound unavailable", e); player = null; btn.setAttribute("aria-pressed", "false"); btn.textContent = "Listen"; }
  });
}
main();
