/** The one page chassis every analytics figure is rendered into.
 *
 * Both renderers import this, so a figure cannot drift away from the live
 * site design by carrying its own copy of the shell. The stylesheet link and
 * the nav script are versioned here and nowhere else.
 */

export const escapeMarkup = (value) => String(value)
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#39;");

export const number = (value, digits = 2) => new Intl.NumberFormat("en-US", { maximumFractionDigits: digits }).format(value);

const criticalStyle = `<style data-report-critical>
  *,*::before,*::after{box-sizing:border-box}body{margin:0}main{width:100%;max-width:1280px;min-width:0;margin:auto;padding:32px}.figure-scroll,.table-wrap,.report-scroll{max-width:100%;min-width:0;overflow-x:auto}.figure-scroll svg{display:block;max-width:none}table{border-collapse:collapse;width:max-content;min-width:100%;margin:0}code{overflow-wrap:anywhere;word-break:break-word}@media(max-width:720px){main{padding:18px}}
</style>`;

function plainLabel(value) {
  return String(value ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[.:;,\s]+$/, "");
}

function labelTableWraps(markup) {
  return markup.replace(/<div class="table-wrap">(?=<table>)/g, (match, offset, source) => {
    const after = source.slice(offset);
    const caption = after.match(/^<div class="table-wrap"><table><caption>([\s\S]*?)<\/caption>/)?.[1];
    const headings = [...source.slice(0, offset).matchAll(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/g)];
    const heading = headings.at(-1)?.[1];
    const label = plainLabel(caption) || plainLabel(heading) || "report data";
    return `<div class="table-wrap report-scroll" tabindex="0" role="region" aria-label="Scrollable table: ${escapeMarkup(label)}">`;
  });
}

export function page(title, body) {
  const semanticBody = labelTableWraps(body)
    .replaceAll('class="eyebrow"', 'class="record-label"')
    .replaceAll("SUPPORTING INVENTORY", "Supporting inventory")
    .replaceAll("BENCHMARK EVIDENCE", "Benchmark evidence")
    .replaceAll("EXPLORATORY ACTUAL RESULT", "Exploratory actual result")
    .replaceAll("MEASURED MODEL COMPARISON", "Measured model comparison")
    .replaceAll("REPRODUCIBLE BENCHMARK EVIDENCE", "Reproducible benchmark evidence");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeMarkup(title)}</title><link rel="stylesheet" href="../system/system.css?v=20260906-reading-cascade"><link rel="stylesheet" href="../system/report-editorial.css?v=20260906" data-report-editorial>${criticalStyle}<link rel="stylesheet" href="../system/print.css?v=20260902-creative-chassis" media="print" data-print-style></head><body class="analytics-page"><a class="skip-link" href="#main">Skip to content</a><div id="site-nav" class="site-nav"></div><noscript><nav class="site-nav"><a href="../index.html">Zain Dana Harper</a> <a href="../overview.html">Systems</a> <a href="../research.html">Research</a> <a href="../hire.html">Hire / work</a></nav></noscript><script type="module" src="../system/nav.js?v=20260902-creative-chassis"></script><main id="main">${semanticBody}</main></body></html>`;
}
