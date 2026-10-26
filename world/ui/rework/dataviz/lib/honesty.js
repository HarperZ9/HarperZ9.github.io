// SPDX-License-Identifier: FSL-1.1-MIT
// Copyright 2026 Zain Dana Harper
//
// dataviz-art/honesty: the layer every artistic chart carries.
//   loadPinned(url, meta)   fetch the data as bytes, hash them, compare with the hash pinned in the page,
//                           and make a sealed asset receipt with the substrate provenance library.
//   receiptPanel(el, r)     render the source line, the licence, both hashes and the verdict.
//   alt(values, opts)       a description computed from the numbers (substrate vector.describeSeries).
//   plainChart(spec)        a plain SVG chart: zero-based where asked, labelled ticks, no art.
//   table(el, cols, rows)   every value, in a table, inside the element given.
// Checking a receipt that the page just made proves nothing by itself, so the verdict here is the
// fetched bytes against a hash pinned in the page source (and in SOURCES.md), a second party to the bytes.
import { assetReceipt, verifyAsset } from "../substrate/provenance.mjs";
import { describeSeries, fmt, escapeXml } from "../substrate/vector.mjs";
import { sha256 } from "../substrate/vendor/superstack.mjs";

export async function loadPinned(url, { pinned, name, licence, source, title, creator, operation }) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`honesty: ${url} answered ${res.status}`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  const got = sha256(bytes);
  const rec = assetReceipt({
    name, producer: "dataviz-art pilot", version: "0.1", media: "application/json", content: bytes,
    licence, source, title, creator, operation,
  });
  const problems = verifyAsset(rec, bytes);
  const verdict = got === pinned && !problems.length ? "verified" : "drift";
  if (verdict === "drift") console.warn("honesty: data hash differs from the pinned value", { url, pinned, got, problems });
  return { data: JSON.parse(new TextDecoder().decode(bytes)), bytes, sha: got, pinned, rec, problems, verdict };
}

const short = (h) => (h || "").slice(0, 16);

export function receiptPanel(el, r, { sourceUrl, sourceName, licenceText, retrieved, transform, dropped }) {
  const word = r.verdict === "verified" ? "Data matches the pinned hash" : "Data differs from the pinned hash";
  el.innerHTML = `
    <p data-verdict="${r.verdict}">${escapeXml(word)}</p>
    <dl>
      <dt>Source</dt><dd><a href="${escapeXml(sourceUrl)}" rel="noopener">${escapeXml(sourceName)}</a>, retrieved ${escapeXml(retrieved)}</dd>
      <dt>Licence</dt><dd>${escapeXml(licenceText)}</dd>
      <dt>Transform</dt><dd>${escapeXml(transform)}</dd>
      ${dropped ? `<dt>Left out</dt><dd>${escapeXml(dropped)}</dd>` : ""}
      <dt>Data SHA-256</dt><dd><code title="${r.sha}">${short(r.sha)}</code> fetched, <code title="${r.pinned}">${short(r.pinned)}</code> pinned</dd>
      <dt>Receipt</dt><dd><code title="${r.rec.receipt_sha256}">${short(r.rec.receipt_sha256)}</code> sealed, licence basis ${escapeXml(r.rec.licence.basis)}</dd>
    </dl>`;
}

export const alt = (values, opts) => describeSeries(values, opts);

// A plain chart. spec: { width, height, series: [{ values, kind: 'line'|'bar', label }], labels,
//   yMin, yMax, yTicks: [..], yUnit, xTicks: [indexes], title, desc, hot: index|null }
export function plainChart(spec) {
  const { width: W, height: H, series, labels, yMin, yMax, yTicks, yUnit = "", xTicks = [], title, desc, hot = null } = spec;
  const L = 56, R = 12, T = 14, B = 34, iw = W - L - R, ih = H - T - B, n = labels.length;
  const x = (i) => L + (n > 1 ? (i / (n - 1)) * iw : iw / 2);
  const y = (v) => T + (1 - (v - yMin) / (yMax - yMin)) * ih;
  let body = `<g class="grid">`;
  for (const t of yTicks) body += `<line x1="${L}" x2="${W - R}" y1="${fmt(y(t))}" y2="${fmt(y(t))}"/><text x="${L - 8}" y="${fmt(y(t) + 4)}" text-anchor="end">${escapeXml(String(t) + yUnit)}</text>`;
  for (const i of xTicks) body += `<text x="${fmt(x(i))}" y="${H - 10}" text-anchor="middle">${escapeXml(String(labels[i]))}</text>`;
  body += `</g>`;
  const bw = Math.max(1, iw / n - 1);
  for (const s of series) {
    if (s.kind === "bar") {
      body += `<g class="bars">` + s.values.map((v, i) => v == null ? "" : `<rect x="${fmt(x(i) - bw / 2)}" y="${fmt(Math.min(y(v), y(0)))}" width="${fmt(bw)}" height="${fmt(Math.abs(y(v) - y(0)))}"${i === hot ? ' class="hot"' : ""}/>`).join("") + `</g>`;
    } else {
      const pts = s.values.map((v, i) => (v == null ? null : `${fmt(x(i))},${fmt(y(v))}`)).filter(Boolean);
      body += `<polyline class="line" fill="none" points="${pts.join(" ")}"/>`;
      if (hot != null && s.values[hot] != null) body += `<circle class="hot" cx="${fmt(x(hot))}" cy="${fmt(y(s.values[hot]))}" r="4"/>`;
    }
  }
  if (yMin < 0 && yMax > 0) body += `<line class="zero" x1="${L}" x2="${W - R}" y1="${fmt(y(0))}" y2="${fmt(y(0))}"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="${escapeXml(title + ". " + desc)}" class="plain-chart"><title>${escapeXml(title)}</title>${body}</svg>`;
}

export function table(el, cols, rows) {
  el.innerHTML = `<table><thead><tr>${cols.map((c) => `<th scope="col">${escapeXml(c)}</th>`).join("")}</tr></thead><tbody>`
    + rows.map((r) => `<tr>${r.map((c, i) => (i ? `<td>${escapeXml(String(c))}</td>` : `<th scope="row">${escapeXml(String(c))}</th>`)).join("")}</tr>`).join("")
    + `</tbody></table>`;
}

// Theme colours for canvas drawing, read from CSS custom properties at draw time.
export function palette(el = document.documentElement) {
  const s = getComputedStyle(el), v = (k, d) => (s.getPropertyValue(k).trim() || d);
  return { paper: v("--paper", "#0b0b0c"), ink: v("--ink", "#ece5d6"), soft: v("--soft", "#b8b0a0"), line: v("--rule", "#3a3833"), hot: v("--hot", "#ff5a36") };
}

// Re-run a draw whenever the theme changes (button or system) or the size changes.
export function onThemeOrResize(fn) {
  new MutationObserver(fn).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "class"] });
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", fn);
  let t; addEventListener("resize", () => { clearTimeout(t); t = setTimeout(fn, 120); });
}
