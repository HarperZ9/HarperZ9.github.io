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

const style = `<style>
  *,*::before,*::after{box-sizing:border-box}:root{color-scheme:dark;background:#070c0f;color:#eef6f6;font-family:"Hanken Grotesk",-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}body{margin:0}main{width:100%;max-width:1280px;min-width:0;margin:auto;padding:32px}h1,h2,h3{line-height:1.08}.record-label{font:600 .86rem "Conso","JetBrains Mono",ui-monospace,monospace;color:#9fc2c7;letter-spacing:.02em;text-transform:none}.lede{max-width:78ch}.figure-scroll,.table-wrap{max-width:100%;min-width:0;overflow-x:auto}.figure-scroll{border:1px solid #33484e;border-radius:14px;background:#070c0f}.figure-scroll svg{display:block;max-width:none}table{border-collapse:collapse;width:100%;margin:18px 0 34px;background:#0c1418}caption{text-align:left;font-weight:700;padding:10px 0}th,td{border:1px solid #33484e;padding:10px;text-align:left;vertical-align:top;line-height:1.45}thead{background:#132127}a{color:#9fe3e8}code{overflow-wrap:anywhere;word-break:break-word}.status{font-family:"Conso","JetBrains Mono",ui-monospace,monospace}.unknown{color:#f3c58f}.scope{display:grid;grid-template-columns:minmax(11rem,15rem) minmax(0,1fr);gap:8px 18px}.scope dt{font-weight:700}.scope dd{min-width:0;margin:0}.does-not-prove{border-left:4px solid #f28a5b;padding-left:12px}.notice{border:1px solid #5a4c35;background:#17130d;padding:16px;border-radius:10px}@media(max-width:720px){main{padding:18px}.scope{display:block}.scope dt{margin-top:14px}}
</style>`;

export function page(title, body) {
  const semanticBody = body
    .replaceAll('class="eyebrow"', 'class="record-label"')
    .replaceAll('class="table-wrap"', 'class="table-wrap" tabindex="0"')
    .replaceAll("SUPPORTING INVENTORY", "Supporting inventory")
    .replaceAll("BENCHMARK EVIDENCE", "Benchmark evidence")
    .replaceAll("EXPLORATORY ACTUAL RESULT", "Exploratory actual result")
    .replaceAll("MEASURED MODEL COMPARISON", "Measured model comparison")
    .replaceAll("REPRODUCIBLE BENCHMARK EVIDENCE", "Reproducible benchmark evidence");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeMarkup(title)}</title><link rel="stylesheet" href="../system/system.css?v=20260902-creative-chassis">${style}<link rel="stylesheet" href="../system/print.css?v=20260902-creative-chassis" media="print" data-print-style></head><body><a class="skip-link" href="#main">Skip to content</a><div id="site-nav" class="site-nav"></div><noscript><nav class="site-nav"><a href="../index.html">Zain Dana Harper</a> <a href="../overview.html">Systems</a> <a href="../research.html">Research</a> <a href="../hire.html">Hire / work</a></nav></noscript><script type="module" src="../system/nav.js?v=20260902-creative-chassis"></script><main id="main">${semanticBody}</main></body></html>`;
}
