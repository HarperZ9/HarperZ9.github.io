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

export const escapeMarkup = (value) => String(value)
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#39;");

export const number = (value, digits = 2) => new Intl.NumberFormat("en-US", { maximumFractionDigits: digits }).format(value);

const NOTEBOOK_REVISION = "20260925-human-notebook";

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
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeMarkup(title)}</title><link rel="stylesheet" href="../system/system.css?v=20260907-reading-completion"><link rel="stylesheet" href="../system/report-editorial.css?v=20260906" data-report-editorial><link rel="stylesheet" href="../system/notebook-sheet.css?v=${NOTEBOOK_REVISION}">${criticalStyle}<link rel="stylesheet" href="../system/print.css?v=20260902-creative-chassis" media="print" data-print-style></head><body class="analytics-page"><a class="skip-link" href="#main">Skip to content</a><div id="site-nav" class="site-nav"></div><noscript><nav class="site-nav"><a href="../index.html">Zain Dana Harper</a> <a href="../research.html">Research</a> <a href="../who-knew-first.html">Who Knew First</a> <a href="../hire.html">Work</a></nav></noscript><script type="module" src="../system/nav.js?v=20260909-pillar-navigation"></script><main id="main">${semanticBody}${footer}</main></body></html>`;
}
