// Lettering from non-type material. Dependency-free.
//
// The element keeps its real text: in the DOM, selectable, read by screen readers and search.
// The text is set transparent and a canvas behind it draws the same words out of another
// material. Plain view, forced colours and print drop the canvas and show the text as ink.
//
//   <h1 class="lettered" data-letter="chladni" data-modes="3,5">Nine ways</h1>
//   data-letter: chladni | dots | spectrogram | scraps | series
//   series:      data-series="file.json" data-series-path="rows" data-series-value="cents_left"
//                columns of dots run through the series left to right; dot area = value / max
//   dots:        data-src="plate.webp"  dot radius = the plate's luminance at that point
//   chladni:     data-modes="n,m"       nodal lines of a square plate driven at mode (n, m)
//   spectrogram: rows are frequencies, columns are time; the same mask drives the audio (play())
const reduced = matchMedia("(prefers-reduced-motion: reduce)");
const DPR = () => Math.min(devicePixelRatio || 1, 2);

// Draw the element's own words into an offscreen mask at the exact place the browser set them.
function textMask(el) {
  const box = el.getBoundingClientRect(), cs = getComputedStyle(el), dpr = DPR();
  const w = Math.max(1, Math.round(box.width * dpr)), h = Math.max(1, Math.round(box.height * dpr));
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  const g = c.getContext("2d", { willReadFrequently: true });
  g.scale(dpr, dpr);
  g.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
  if ("letterSpacing" in g) g.letterSpacing = cs.letterSpacing === "normal" ? "0px" : cs.letterSpacing;
  g.fillStyle = "#000"; g.textBaseline = "alphabetic";
  const met = g.measureText("Hg"), asc = met.fontBoundingBoxAscent, desc = met.fontBoundingBoxDescent;
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT), lines = [];
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    for (const m of n.data.matchAll(/\S+/g)) {
      const r = document.createRange(); r.setStart(n, m.index); r.setEnd(n, m.index + m[0].length);
      const rect = r.getClientRects()[0];
      if (!rect) continue;
      const half = (rect.height - (asc + desc)) / 2;
      g.fillText(m[0], rect.left - box.left, rect.top - box.top + half + asc);
      const top = (rect.top - box.top) * dpr, bot = (rect.bottom - box.top) * dpr, l = (rect.left - box.left) * dpr, rr = (rect.right - box.left) * dpr;
      const line = lines.find((L) => Math.abs(L.top - top) < 2 * dpr);
      if (line) { line.left = Math.min(line.left, l); line.right = Math.max(line.right, rr); } else lines.push({ top, bot, left: l, right: rr });
    }
  }
  lines.sort((a, b) => a.top - b.top);
  return { c, g, w, h, dpr, lines, data: g.getImageData(0, 0, w, h).data };
}

function layer(el) {
  let cv = el.querySelector(":scope > canvas.letter-art");
  if (!cv) {
    cv = document.createElement("canvas"); cv.className = "letter-art"; cv.setAttribute("aria-hidden", "true"); cv.dataset.art = "";
    el.prepend(cv);
  }
  return cv;
}

const inkOf = (el) => getComputedStyle(el).getPropertyValue("--letter-ink").trim() || getComputedStyle(document.body).color;

// Chladni: f = cos(n pi x) cos(m pi y) - cos(m pi x) cos(n pi y). Sand gathers where f is near 0.
function chladni(el, m) {
  const [n, mm] = (el.dataset.modes || "3,5").split(",").map(Number);
  const cv = layer(el); cv.width = m.w; cv.height = m.h;
  const g = cv.getContext("2d", { colorSpace: "display-p3" }), out = g.createImageData(m.w, m.h), o = out.data;
  const ink = parseColor(inkOf(el)), cell = Math.round((Number(el.dataset.cell) || 90) * m.dpr);
  for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
    const i = (y * m.w + x) * 4;
    if (m.data[i + 3] < 128) continue;
    const u = (x % cell) / cell, v = (y % cell) / cell;
    const f = Math.cos(n * Math.PI * u) * Math.cos(mm * Math.PI * v) - Math.cos(mm * Math.PI * u) * Math.cos(n * Math.PI * v);
    const a = Math.max(0, 1 - Math.abs(f) / 0.32);
    const grain = hash(x, y) < 0.18 ? 0.35 : 0;
    const alpha = Math.min(1, 0.14 + a * a + grain);
    if (alpha <= 0) continue;
    o[i] = ink[0]; o[i + 1] = ink[1]; o[i + 2] = ink[2]; o[i + 3] = Math.round(alpha * 255);
  }
  g.putImageData(out, 0, 0);
}

// Dots: a regular grid inside the letters; each dot's radius is a luminance sample of a plate.
function dots(el, m, img) {
  const cv = layer(el); cv.width = m.w; cv.height = m.h;
  const g = cv.getContext("2d", { colorSpace: "display-p3" }); g.fillStyle = inkOf(el);
  const step = Math.round((Number(el.dataset.step) || 7) * m.dpr);
  const s = document.createElement("canvas"); s.width = Math.ceil(m.w / step); s.height = Math.ceil(m.h / step);
  const sg = s.getContext("2d", { willReadFrequently: true });
  const k = Math.max(s.width / img.naturalWidth, s.height / img.naturalHeight);
  sg.drawImage(img, (s.width - img.naturalWidth * k) / 2, (s.height - img.naturalHeight * k) / 2, img.naturalWidth * k, img.naturalHeight * k);
  const lum = sg.getImageData(0, 0, s.width, s.height).data;
  const samples = [];
  for (let y = 0; y < m.h; y += step) for (let x = 0; x < m.w; x += step) {
    const cx = Math.min(m.w - 1, x + step / 2) | 0, cy = Math.min(m.h - 1, y + step / 2) | 0;
    if (m.data[(cy * m.w + cx) * 4 + 3] < 128) continue;
    const j = ((y / step | 0) * s.width + (x / step | 0)) * 4;
    const L = (0.2126 * lum[j] + 0.7152 * lum[j + 1] + 0.0722 * lum[j + 2]) / 255;
    const r = (step / 2) * (0.25 + 0.75 * Math.sqrt(1 - L));
    samples.push([cx, cy, r, L]);
  }
  const draw = (count) => { g.clearRect(0, 0, m.w, m.h); for (let i = 0; i < count; i++) { const [x, y, r] = samples[i]; g.beginPath(); g.arc(x, y, r, 0, 6.2832); g.fill(); } };
  el.lettering = { samples: samples.length, mean: samples.reduce((a, s) => a + s[3], 0) / (samples.length || 1) };
  if (reduced.matches || el.dataset.still !== undefined) return draw(samples.length);
  // build in rank order of the plate's darkness, timed on the measured glyph-cascade curve
  samples.sort((a, b) => a[3] - b[3]);
  const T = 1800, t0 = performance.now(), curve = [[0, 0], [0.294, 0.1], [0.628, 0.5], [0.778, 0.9], [0.833, 1], [1, 1]];
  const at = (p) => { for (let i = 1; i < curve.length; i++) if (p <= curve[i][0]) { const [a, va] = curve[i - 1], [b, vb] = curve[i]; return va + ((p - a) / (b - a)) * (vb - va); } return 1; };
  const tick = (now) => { const p = Math.min(1, (now - t0) / T); draw(Math.round(at(p) * samples.length)); if (p < 1) requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
}

// Series: letters made of a real series. Each column of dots is one record, in order, left to right;
// each dot's area is that record's value over the series maximum. The numbers stay in the page's table.
async function series(el, m) {
  const res = await fetch(new URL(el.dataset.series, document.baseURI));
  if (!res.ok) throw new Error("series: " + res.status + " " + el.dataset.series);
  let rows = await res.json();
  for (const k of (el.dataset.seriesPath || "").split(".").filter(Boolean)) rows = rows[k];
  const vals = rows.map((r) => Number(r[el.dataset.seriesValue])).filter(Number.isFinite);
  const max = Math.max(...vals), step = Math.round((Number(el.dataset.step) || 6) * m.dpr);
  const cv = layer(el); cv.width = m.w; cv.height = m.h;
  const g = cv.getContext("2d", { colorSpace: "display-p3" }); g.fillStyle = inkOf(el);
  const xs = [];
  for (let x = 0; x < m.w; x += step) for (let y = 0; y < m.h; y += step) {
    const cx = Math.min(m.w - 1, x + step / 2) | 0, cy = Math.min(m.h - 1, y + step / 2) | 0;
    if (m.data[(cy * m.w + cx) * 4 + 3] >= 128) xs.push([cx, cy]);
  }
  if (!xs.length) return;
  // reading order: line by line, left to right, so the series runs the way the title is read
  const L = m.lines.length ? m.lines : [{ top: 0, bot: m.h, left: 0, right: m.w }];
  const total = L.reduce((a, l) => a + (l.right - l.left), 0);
  const before = L.map((_, k) => L.slice(0, k).reduce((a, l) => a + (l.right - l.left), 0));
  for (const [x, y] of xs) {
    let k = 0, best = Infinity;
    L.forEach((l, j) => { const d = Math.abs(y - (l.top + l.bot) / 2); if (d < best) { best = d; k = j; } });
    const t = (before[k] + Math.max(0, x - L[k].left)) / total;
    const i = Math.min(vals.length - 1, Math.floor(t * vals.length));
    const r = (step / 2) * Math.sqrt(vals[i] / max);
    if (r < 0.4) continue;
    g.beginPath(); g.arc(x, y, r, 0, 6.2832); g.fill();
  }
  el.lettering = { records: vals.length, first: vals[0], last: vals.at(-1) };
}

// Spectrogram: rows are log-spaced frequencies, columns are time. Drawn as partials with grain.
const BANDS = 64, SECONDS = 2.6, F0 = 220, F1 = 7000;
function spectrogram(el, m) {
  const cv = layer(el); cv.width = m.w; cv.height = m.h;
  const g = cv.getContext("2d", { colorSpace: "display-p3" }), ink = parseColor(inkOf(el));
  const out = g.createImageData(m.w, m.h), o = out.data;
  const rowH = Math.max(3 * m.dpr, Math.round(5 * m.dpr));
  for (let y = 0; y < m.h; y++) {
    const inRow = (y % rowH) / rowH, line = 1 - Math.abs(inRow - 0.5) * 2;
    for (let x = 0; x < m.w; x++) {
      const i = (y * m.w + x) * 4, on = m.data[i + 3] / 255;
      const a = on * (0.15 + 0.85 * line * line) * (0.75 + 0.25 * hash(x >> 2, y)) + (1 - on) * (line > 0.9 ? 0.035 : 0);
      o[i] = ink[0]; o[i + 1] = ink[1]; o[i + 2] = ink[2]; o[i + 3] = Math.round(Math.min(1, a) * 255);
    }
  }
  g.putImageData(out, 0, 0);
  el.lettering = { play: () => playMask(m) };
}

// The audio is synthesised from the same mask the picture shows: one sine per row, gated by column.
function playMask(m) {
  const ctx = new AudioContext(), rate = ctx.sampleRate, N = Math.round(rate * SECONDS);
  const buf = ctx.createBuffer(1, N, rate), d = buf.getChannelData(0);
  const cols = 160, amp = [];
  for (let b = 0; b < BANDS; b++) {
    const row = []; const y = Math.min(m.h - 1, Math.round(((b + 0.5) / BANDS) * m.h));
    for (let c = 0; c < cols; c++) { const x = Math.min(m.w - 1, Math.round(((c + 0.5) / cols) * m.w)); row.push(m.data[(y * m.w + x) * 4 + 3] / 255); }
    amp.push(row);
  }
  for (let b = 0; b < BANDS; b++) {
    const f = F1 * Math.pow(F0 / F1, b / (BANDS - 1)), w = (2 * Math.PI * f) / rate, row = amp[b];
    if (!row.some((v) => v > 0)) continue;
    for (let s = 0; s < N; s++) { const a = row[Math.min(cols - 1, (s / N) * cols | 0)]; if (a) d[s] += a * Math.sin(w * s); }
  }
  let peak = 0; for (let s = 0; s < N; s++) peak = Math.max(peak, Math.abs(d[s]));
  const gain = peak ? 0.3 / peak : 0;
  for (let s = 0; s < N; s++) d[s] *= gain * Math.min(1, s / 800, (N - s) / 800);
  const src = ctx.createBufferSource(); src.buffer = buf; src.connect(ctx.destination); src.start();
  src.onended = () => ctx.close().catch((e) => console.warn("lettering: audio close failed", e));
}

function hash(x, y) { let h = (x * 374761393 + y * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
function parseColor(s) {
  const c = document.createElement("canvas").getContext("2d"); c.fillStyle = s; const v = c.fillStyle;
  if (v.startsWith("#")) return [1, 3, 5].map((i) => parseInt(v.slice(i, i + 2), 16));
  return (v.match(/\d+/g) || [0, 0, 0]).slice(0, 3).map(Number);
}

// Scraps: each letter cut from a different cleared archival plate, set at a slight angle.
// The letters stay real text; the plate shows through them with background-clip.
function scraps(el) {
  if (el.dataset.cut) return;
  const plates = (el.dataset.plates || "").split(",").filter(Boolean).map((p) => new URL(p.trim(), document.baseURI).href);
  if (!plates.length) return;
  el.dataset.cut = "1";
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT), nodes = [];
  for (let n = walker.nextNode(); n; n = walker.nextNode()) nodes.push(n);
  let k = 0;
  for (const n of nodes) {
    const frag = document.createDocumentFragment();
    for (const word of n.data.split(/(\s+)/)) {
      if (!word) continue;
      if (/^\s+$/.test(word)) { frag.append(word); continue; }
      const wrap = document.createElement("span"); wrap.className = "scrap-word"; frag.append(wrap);
      for (const ch of word) {
      const s = document.createElement("span"); s.className = "scrap"; s.textContent = ch;
      const h = hash(k, 7);
      s.style.setProperty("--plate", `url("${plates[k % plates.length]}")`);
      s.style.setProperty("--tilt", `${((h - 0.5) * 7).toFixed(1)}deg`);
      s.style.setProperty("--px", `${Math.round(hash(k, 3) * 100)}%`);
      s.style.setProperty("--py", `${Math.round(hash(k, 5) * 100)}%`);
      wrap.append(s); k++;
      }
    }
    n.replaceWith(frag);
  }
}

const MINE = new Set(["chladni", "dots", "spectrogram", "scraps", "series"]);
function render(el) {
  if (document.documentElement.classList.contains("plain")) return;
  const kind = el.dataset.letter;
  if (!MINE.has(kind) || el.classList.contains("lt-host")) return;  // the lettering library owns its own
  if (kind === "scraps") { scraps(el); el.classList.add("scraps-on"); return; }
  const m = textMask(el);
  if (kind === "chladni") chladni(el, m);
  else if (kind === "spectrogram") spectrogram(el, m);
  else if (kind === "series") series(el, m).catch((e) => { console.warn("lettering: series failed, text shown as ink", e); el.classList.remove("lettered-on"); });
  else if (kind === "dots") {
    const img = new Image(); img.decoding = "async"; img.src = el.dataset.src;
    img.onload = () => dots(el, textMask(el), img);
    img.onerror = () => console.warn("lettering: plate failed to load", el.dataset.src);
  }
  el.classList.add("lettered-on");
}

export function initLettering() {
  const els = [...document.querySelectorAll("[data-letter]")];
  if (!els.length) return;
  const all = () => els.forEach((el) => { try { render(el); } catch (e) { console.warn("lettering: render failed, text shown as ink", e); el.classList.remove("lettered-on"); } });
  document.fonts.ready.then(all);
  let t; addEventListener("resize", () => { clearTimeout(t); t = setTimeout(all, 200); });
  new MutationObserver(() => setTimeout(all, 30)).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "class"] });
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", all);
  for (const b of document.querySelectorAll("[data-play-letter]")) {
    b.hidden = false;
    b.addEventListener("click", () => {
      const el = document.getElementById(b.dataset.playLetter);
      try { el.lettering?.play?.(); } catch (e) { console.warn("lettering: playback failed", e); }
    });
  }
}
