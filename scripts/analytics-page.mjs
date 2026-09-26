/** The one page chassis every analytics figure is rendered into.
 *
 * Both renderers import this, so a figure cannot drift away from the live
 * site design by carrying its own copy of the shell. The stylesheet link and
 * the nav script are versioned here and nowhere else.
 *
 * 2026-09-25 human-first notebook: the chassis turns the renderer's opening
 * label, title and lede into the site masthead, gives every data table the
 * shared table component (one record per row on a phone, each cell labelled
 * from its column head), links the notebook sheet stylesheet, and closes the
 * page with the footer utility line where the save-or-print control mounts.
 */

import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const escapeMarkup = (value) => String(value)
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#39;");

export const number = (value, digits = 2) => new Intl.NumberFormat("en-US", { maximumFractionDigits: digits }).format(value);

const NOTEBOOK_REVISION = "20260925-void-sheets";

const criticalStyle = `<style data-report-critical>
  *,*::before,*::after{box-sizing:border-box}body{margin:0}main{width:100%;max-width:1280px;min-width:0;margin:auto;padding:0 32px 32px}.figure-scroll,.table-wrap,.report-scroll{max-width:100%;min-width:0;overflow-x:auto}.figure-scroll svg{display:block;max-width:none}table:not(.data-table){border-collapse:collapse;width:max-content;min-width:100%;margin:0}code{overflow-wrap:anywhere;word-break:break-word}@media(max-width:720px){main{padding:0 16px 18px}}
</style>`;

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function plainLabel(value) {
  return String(value ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&#183;|&middot;/g, "·")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[.:;,\s]+$/, "");
}

/** "2026-08-28" or "2026-08-28T10:00:00Z" becomes "28 August 2026". */
export function plainDate(value) {
  const match = String(value ?? "").match(/(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return String(value ?? "");
  const [, year, month, day] = match;
  return `${Number(day)} ${MONTHS[Number(month) - 1]} ${year}`;
}

function attributeText(value) {
  return escapeMarkup(plainLabel(value));
}

/** Every table gets the shared table component. Cells take their column head
 * as a data-label, so a phone reads each row as one labelled record. */
function stackTables(markup) {
  return markup.replace(/<div class="table-wrap">(<table>)([\s\S]*?)(<\/table>)<\/div>/g, (match, open, inner, close, offset, source) => {
    const caption = inner.match(/^<caption>([\s\S]*?)<\/caption>/)?.[1];
    const headings = [...source.slice(0, offset).matchAll(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/g)];
    const label = plainLabel(caption) || plainLabel(headings.at(-1)?.[1]) || "report data";
    const heads = [...(inner.match(/<thead>([\s\S]*?)<\/thead>/)?.[1] || "").matchAll(/<th\b[^>]*>([\s\S]*?)<\/th>/g)].map((head) => plainLabel(head[1]));
    const body = inner.replace(/<tbody>([\s\S]*?)<\/tbody>/, (tbody, rows) => `<tbody>${rows.replace(/<tr>([\s\S]*?)<\/tr>/g, (row, cells) => {
      let index = 0;
      const labelled = cells.replace(/<(td|th)(\s[^>]*)?>/g, (cell, tag, attrs = "") => {
        const column = heads[index];
        index += 1;
        if (!column || /\bcolspan=|\bdata-label=|\bscope="row"/.test(attrs)) return cell;
        return `<${tag}${attrs} data-label="${attributeText(column)}">`;
      });
      return `<tr>${labelled}</tr>`;
    })}</tbody>`);
    const note = heads.length > 6 ? `<p class="scroll-note">Scroll sideways for more columns.</p>` : "";
    return `<div class="table-wrap" tabindex="0" role="region" aria-label="Table: ${escapeMarkup(label)}">${note}<table class="data-table" data-stack>${body}${close}</div>`;
  });
}

/** The renderer's opening label, title and lede become the site masthead:
 * a breadcrumb that matches the navigation, the title, one dek, and a meta
 * line with the record type and a plain date. */
function masthead(markup) {
  const opening = markup.match(/^<p class="(?:eyebrow|record-label)">([\s\S]*?)<\/p><h1>([\s\S]*?)<\/h1>(?:<p class="lede">([\s\S]*?)<\/p>)?/);
  if (!opening) return markup;
  const [whole, label, title, lede] = opening;
  const parts = plainLabel(label).split(/\s*·\s*/).filter(Boolean);
  const meta = parts.map((part) => `<span>${escapeMarkup(/\d{4}-\d{2}-\d{2}/.test(part) ? plainDate(part) : part)}</span>`).join("");
  const dek = lede ? `<p class="dek">${lede}</p>` : "";
  return `<header class="masthead"><nav class="masthead-path" aria-label="Breadcrumb"><a href="../research.html">Research</a> / ${title}</nav><h1>${title}</h1>${dek}<p class="meta">${meta}</p></header>${markup.slice(whole.length)}`;
}

const footer = `<footer class="page-footer"><div class="page-footer-line" data-export-slot><a href="../research.html">Research</a><a href="../site-index.html">Site index</a></div></footer>`;

export function page(title, body) {
  const semanticBody = masthead(stackTables(body)
    .replaceAll("SUPPORTING INVENTORY", "Supporting inventory")
    .replaceAll("BENCHMARK EVIDENCE", "Benchmark evidence")
    .replaceAll("EXPLORATORY ACTUAL RESULT", "Exploratory actual result")
    .replaceAll("MEASURED MODEL COMPARISON", "Measured model comparison")
    .replaceAll("REPRODUCIBLE BENCHMARK EVIDENCE", "Reproducible benchmark evidence"));
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeMarkup(title)}</title><link rel="stylesheet" href="../system/system.css?v=20260925-void-plates"><link rel="stylesheet" href="../system/report-editorial.css?v=20260925-void-plates" data-report-editorial><link rel="stylesheet" href="../system/notebook-sheet.css?v=${NOTEBOOK_REVISION}">${criticalStyle}<link rel="stylesheet" href="../system/print.css?v=20260925-void-plates" media="print" data-print-style></head><body class="analytics-page"><a class="skip-link" href="#main">Skip to content</a><div id="site-nav" class="site-nav"></div><noscript><nav class="site-nav"><a href="../index.html">Zain Dana Harper</a> <a href="../research.html">Research</a> <a href="../who-knew-first.html">Who Knew First</a> <a href="../hire.html">Work</a></nav></noscript><script type="module" src="../system/nav.js?v=20260909-pillar-navigation"></script><main id="main">${semanticBody}${footer}</main></body></html>`;
}

// ------------------------------------------------------------------ notebook sheet parts
//
// 2026-09-25, void-and-bone pass: every analytics figure sits on one notebook sheet
// (system/notebook-sheet.css): a title, one plain takeaway sentence, the chart drawn as HTML
// rows over SVG strips in the site's own tokens, a limit line, a closed "How we know" and a
// stamp. Machine detail (digests, model references, test statistics) lives in "How we know".
// The standalone SVG plates are drawn for an img element on another page, so each carries its
// own light and dark values and, when asked, the grotesk face as an embedded subset (the plates
// draw no mono text, so the mono subset stays out). Pages draw their charts as HTML rows.

// The embedded face subsets the benchmark-record plate already carries. A copy of this chassis
// run outside the repository (the renderer tests do this) has no subset beside it, so the plate
// then names the face without embedding it and says so on stderr.
const FONT_PATH = resolve(dirname(fileURLToPath(import.meta.url)), "render-flywheel-benchmark-record.font.json");
let fontCache;
function plateFont() {
  if (fontCache !== undefined) return fontCache;
  fontCache = existsSync(FONT_PATH) ? JSON.parse(readFileSync(FONT_PATH, "utf8")) : null;
  if (!fontCache) console.warn(`plate font subset not found at ${FONT_PATH}; standalone plates name the site faces without embedding them`);
  return fontCache;
}

/** Fill patterns every sheet on the page draws from. */
export const SHEET_DEFS = `<svg class="ns-defs" width="0" height="0" aria-hidden="true" focusable="false"><defs>`
  + `<pattern id="ns-hatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(38)"><line x1="2.5" y1="-1" x2="2.5" y2="6" class="p-d"/></pattern>`
  + `<pattern id="ns-stip" width="4" height="4" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r=".85" class="p-u"/></pattern>`
  + `<pattern id="ns-scan" width="6" height="3" patternUnits="userSpaceOnUse"><rect x="0" y="1" width="6" height="1" class="p-i"/></pattern>`
  + `</defs></svg>`;

export function seal() {
  const ticks = [];
  for (let index = 0; index < 72; index += 1) {
    const angle = (2 * Math.PI * index) / 72;
    const inner = index % 6 === 0 ? 40.4 : 42.4;
    const point = (radius) => [radius * Math.cos(angle), radius * Math.sin(angle)].map((value) => value.toFixed(2));
    const [x1, y1] = point(inner);
    const [x2, y2] = point(45);
    ticks.push(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="sl-t"/>`);
  }
  return `<svg class="ns-seal" viewBox="-50 -50 100 100" aria-hidden="true" focusable="false"><circle r="47.5" class="sl-o"/>${ticks.join("")}`
    + `<circle r="31" class="sl-r"/><circle r="21" class="sl-i"/><circle r="10" class="sl-p"/><circle r="3.2" class="sl-c"/></svg>`;
}

const grain = (uid, seed) => `<svg class="ns-grain" aria-hidden="true" focusable="false"><filter id="ns-grain-${uid}" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">`
  + `<feTurbulence type="fractalNoise" baseFrequency="0.86" numOctaves="2" seed="${seed}" stitchTiles="stitch" result="n"/>`
  + `<feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  3.2 0 0 0 -1.72" result="a"/>`
  + `<feFlood class="ns-grain-ink" result="f"/><feComposite in="f" in2="a" operator="in"/></filter>`
  + `<rect width="100%" height="100%" filter="url(#ns-grain-${uid})"/></svg>`;

/** One sheet: title block, the body the caller draws, and a stamp with a plain date. */
export function sheet({ uid, seed, title, takeaway, body, stamp }) {
  return `<article class="ns-sheet an-sheet" id="sheet-${uid}" aria-labelledby="t-${uid}"><div class="ns-paper">${grain(uid, seed)}<div class="ns-live">`
    + `<header class="ns-head"><h2 class="ns-title" id="t-${uid}">${escapeMarkup(title)}</h2><p class="takeaway">${escapeMarkup(takeaway)}</p></header>`
    + body
    + `<div class="ns-stamp"><p>${escapeMarkup(stamp)}</p>${seal()}</div>`
    + `</div></div></article>`;
}

/** A closed "How we know". Entries are [term, html] pairs; "Does not prove" comes first. */
export function howWeKnow(summary, entries, extraClass = "") {
  const items = entries.map(([term, html]) => `<dt>${escapeMarkup(term)}</dt><dd>${html}</dd>`).join("");
  return `<details class="how-we-know${extraClass ? ` ${extraClass}` : ""}"><summary>${summary}</summary><dl class="hwk-list">${items}</dl></details>`;
}

/** The axis row above a set of strips. Ticks are [percent, label, extra class]. */
export function axisRow(caption, ticks) {
  const spans = ticks.map(([position, label, extra = ""]) => `<span class="ns-tick${extra}" style="left:${position}%">${escapeMarkup(label)}</span>`).join("");
  return `<div class="ns-row is-axis"><p class="ns-rname ns-axcap">${escapeMarkup(caption)}</p><div class="ns-sc"><div class="ns-axis" aria-hidden="true">${spans}</div></div><p class="ns-rval"></p></div>`;
}

const PLATE_TOKENS = {
  light: { paper: "#f1ece1", ink: "#16130f", soft: "#4a443b", hair: "#d6ccb8", frame: "#b9af9b" },
  dark: { paper: "#0a0a0d", ink: "#ece5d6", soft: "#b8b0a0", hair: "#262529", frame: "#38363b" },
};
// Inline, the page's own sheet tokens win (they follow the reader's theme pick); in an img the
// hex values stand in, chosen by the operating system's scheme.
const tokenBlock = (set) => `--p:var(--sheet-paper,${set.paper});--i:var(--sheet-ink,${set.ink});--s:var(--sheet-soft,${set.soft});--h:var(--sheet-hair,${set.hair});--f:var(--sheet-frame,${set.frame})`;

export function plateStyle(embedFonts) {
  const font = embedFonts ? plateFont() : null;
  const faces = font
    ? `@font-face{font-family:"Hanken Grotesk";font-weight:100 900;src:url(data:font/woff2;base64,${font.woff2Base64}) format("woff2")}`
    : "";
  return `<style>${faces}`
    + `.an-plate{${tokenBlock(PLATE_TOKENS.light)}}`
    + `@media (prefers-color-scheme:dark){.an-plate{${tokenBlock(PLATE_TOKENS.dark)}}}`
    + `@media (forced-colors:active){.an-plate{forced-color-adjust:none;--p:Canvas;--i:CanvasText;--s:CanvasText;--h:GrayText;--f:CanvasText}}`
    + `@media print{.an-plate{--p:#ffffff;--i:#000000;--s:#333333;--h:#aaaaaa;--f:#999999}}`
    + `.an-plate text{font-family:"Hanken Grotesk",system-ui,sans-serif;fill:var(--i);paint-order:stroke;stroke:var(--p);stroke-width:3px;stroke-linejoin:round}.an-plate .s{fill:var(--s)}`
    + `.an-plate .bg{fill:var(--p);stroke:var(--f)}.an-plate .g{stroke:var(--h);stroke-dasharray:2 4}.an-plate .h{stroke:var(--h)}.an-plate .z{stroke:var(--i);stroke-width:1.4}`
    + `.an-plate .bar{fill:url(#an-scan);stroke:var(--i)}.an-plate .scan{fill:var(--i)}.an-plate .open{fill:var(--p);stroke:var(--i);stroke-width:1.4}`
    + `.an-plate .fill{fill:var(--i)}.an-plate .unk{fill:url(#an-stip);stroke:var(--s);stroke-width:1.2;stroke-dasharray:3 2}.an-plate .dot{fill:var(--s)}`
    + `.an-plate .focus-ring{fill:none;stroke:none}.an-plate g:focus{outline:none}.an-plate g:focus-visible .focus-ring{stroke:var(--i);stroke-width:2}`
    + `</style>`;
}

/** Characters the embedded subset carries; a plate that draws any other one is refused. */
function checkGlyphs(drawn) {
  const font = plateFont();
  if (!font) return;
  const allowed = new Set(font.characters);
  for (const text of drawn) {
    for (const character of text) {
      if (!allowed.has(character)) throw new Error(`plate draws "${character}", which the embedded face does not carry`);
    }
  }
}

/** Break a line of plate text into lines that fit a width. SVG text does not wrap, so the plate
 * breaks at words using a conservative average glyph width for the face at that weight, then
 * evens the lines out so no single word is left alone on the last one. */
function wrapWords(text, size, width, em) {
  const limit = Math.max(8, Math.floor(width / (size * em)));
  const words = String(text).split(/\s+/).filter(Boolean);
  const greedy = (perLine) => words.reduce((lines, word) => {
    const last = lines.at(-1);
    if (last !== undefined && `${last} ${word}`.length <= perLine) lines[lines.length - 1] = `${last} ${word}`;
    else lines.push(word);
    return lines;
  }, []);
  const lines = greedy(limit);
  for (let target = Math.ceil(words.join(" ").length / lines.length); lines.length > 1 && target < limit; target += 1) {
    const even = greedy(target);
    if (even.length === lines.length) return even;
  }
  return lines;
}

/** A compact bar plate for an img element on another page: one row per subject, the name, its value
 * set large under it, a plain sub-line, then a scanline bar across the full width on a zero-to-one
 * scale. Everything a row says starts at the left edge, so a host that crops the plate from the
 * right still shows every name and value. A row with no measurement draws a stippled band and says so in words.
 * The plate is 400 units wide, so every label stays at 14px or larger from a 358px phone column up
 * to a 514px desktop column, and the scanline period (4 units) survives the downscale.
 * rows: [{ label, detail, value, display }] or [{ label, detail, unavailable: true, display }]. */
export function barPlate({ id, title, description, heading, scaleNote, rows, footnote, embedFonts }) {
  const width = 400;
  const pad = 24;
  const trackW = width - 2 * pad;
  const text = [];
  const drawn = ["0%", "50%", "100%"];
  const lineSet = (lines, x, first, step, size, weight, cls = "") => lines.map((line, index) => {
    drawn.push(line);
    return `<text x="${x}" y="${first + index * step}" font-size="${size}" font-weight="${weight}"${cls ? ` class="${cls}"` : ""}>${escapeMarkup(line)}</text>`;
  }).join("");
  const headLines = wrapWords(heading, 21, trackW, 0.52);
  text.push(lineSet(headLines, pad, 44, 27, 21, 760));
  const noteFirst = 44 + (headLines.length - 1) * 27 + 28;
  const noteLines = wrapWords(scaleNote, 16, trackW, 0.5);
  text.push(lineSet(noteLines, pad, noteFirst, 22, 16, 500, "s"));
  const axisY = noteFirst + (noteLines.length - 1) * 22 + 38;
  const marks = [];
  let top = axisY + 14;
  rows.forEach((row) => {
    const subLines = wrapWords(row.detail, 16, trackW, 0.5);
    const valueY = top + (row.unavailable ? 50 : 60);
    const subFirst = valueY + 26;
    const barY = subFirst + (subLines.length - 1) * 22 + 12;
    const bottom = barY + 24 + 18;
    drawn.push(row.label, row.display);
    const bar = row.unavailable
      ? `<rect x="${pad}" y="${barY + 4}" width="${trackW}" height="16" class="unk"/>`
      : `<line x1="${pad}" y1="${barY - 4}" x2="${pad}" y2="${barY + 28}" class="z"/>`
        + `<rect x="${pad}" y="${barY}" width="${Math.max(0, Math.min(trackW, trackW * row.value)).toFixed(1)}" height="24" class="bar"/>`;
    const value = row.unavailable
      ? `<text x="${pad}" y="${valueY}" font-size="18" font-weight="600" class="s">${escapeMarkup(row.display)}</text>`
      : `<text x="${pad}" y="${valueY}" font-size="32" font-weight="760">${escapeMarkup(row.display)}</text>`;
    marks.push(`<g tabindex="0" role="graphics-symbol" aria-label="${escapeMarkup(row.label)}: ${escapeMarkup(row.display)}, ${escapeMarkup(row.detail)}">`
      + `<rect class="focus-ring" x="${pad - 10}" y="${top - 4}" width="${trackW + 20}" height="${bottom - top}"/>`
      + `<text x="${pad}" y="${top + 24}" font-size="18" font-weight="700">${escapeMarkup(row.label)}</text>${value}`
      + lineSet(subLines, pad, subFirst, 22, 16, 500, "s") + bar + `</g>`);
    top = bottom;
  });
  const grid = [[0, "0%", "start"], [50, "50%", "middle"], [100, "100%", "end"]].map(([position, label, anchor]) => {
    const x = pad + (trackW * position) / 100;
    return `<text x="${x}" y="${axisY}" font-size="16" font-weight="500" class="s" text-anchor="${anchor}">${label}</text>`
      + `<line x1="${x}" y1="${axisY + 8}" x2="${x}" y2="${top - 12}" class="g"/>`;
  }).join("");
  const footLines = wrapWords(footnote, 16, trackW, 0.5);
  const footFirst = top + 22;
  const foot = `<line x1="${pad}" y1="${top}" x2="${width - pad}" y2="${top}" class="h"/>` + lineSet(footLines, pad, footFirst, 22, 16, 500, "s");
  const height = footFirst + (footLines.length - 1) * 22 + 24;
  if (embedFonts) checkGlyphs(drawn);
  return `<svg role="img" xmlns="http://www.w3.org/2000/svg" class="an-plate" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" aria-labelledby="${id}-title ${id}-desc">`
    + `<title id="${id}-title">${escapeMarkup(title)}</title><desc id="${id}-desc">${escapeMarkup(description)}</desc>`
    + plateStyle(embedFonts)
    + `<defs><pattern id="an-scan" width="4" height="4" patternUnits="userSpaceOnUse"><rect x="0" y="1" width="4" height="2" class="scan"/></pattern>`
    + `<pattern id="an-stip" width="4" height="4" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r=".9" class="dot"/></pattern></defs>`
    + `<rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" class="bg"/>`
    + text.join("") + grid + marks.join("") + foot
    + `</svg>`;
}
