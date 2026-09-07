// The document head of a system record page. Everything here is derived from
// system/systems.json and img/og/cards-data.js, so the only way to change a
// title, description, or social card is to edit the record.
import { escapeCopy, escapeHtml, MIDDOT } from "./system-page-parts.mjs";

export const SYSTEM_PAGE_STYLE = `
.system-hero{min-height:auto;padding-block:clamp(4.5rem,10vw,8rem)}
.system-hero .mid{max-width:min(72rem,100%)}
.system-hero h1{max-width:14ch}
.system-hero .lede{max-width:72ch}
.system-facts,.product-status{display:grid;gap:.85rem clamp(1rem,2.4vw,1.6rem);margin:clamp(1.4rem,3vw,2rem) 0 0}
.system-facts{grid-template-columns:repeat(4,minmax(0,1fr))}
.system-fact,.product-status-fact{min-width:0}
.system-fact dt,.product-status-fact dt{font-size:.84rem;line-height:1.4;color:var(--muted)}
.system-fact dd,.product-status-fact dd{margin:.12rem 0 0;color:var(--bone);line-height:1.45}
.domain-nav{display:flex;flex-wrap:wrap;gap:.55rem 1rem;margin-top:1.5rem;line-height:1.55}
.domain-nav a{display:inline-flex;align-items:center;min-height:44px;border-bottom:1px solid var(--hairline);padding:.35rem 0;color:var(--bone);text-decoration:none}
.system-hero-actions,.product-card-actions{display:flex;flex-wrap:wrap;gap:.7rem;margin-top:1.2rem}
.system-hero-actions a,.product-action,.product-secondary-action{display:inline-flex;align-items:center;min-height:44px;border:1px solid var(--hairline);padding:.65rem .9rem;color:var(--bone);text-decoration:none}
.system-hero-actions a:first-child,.product-action{border-color:var(--orange)}
.product-list{display:grid;gap:0;margin-top:1.6rem}
.product-card{display:grid;grid-template-columns:minmax(12rem,.32fr) minmax(0,1fr);gap:1rem clamp(1.4rem,3vw,2.6rem);border-top:1px solid var(--hairline);padding:clamp(1.1rem,2.4vw,1.7rem) 0}
.product-card:last-child{border-bottom:1px solid var(--hairline)}
.product-card-title{margin:0;font-size:clamp(1.22rem,2vw,1.72rem);line-height:1.12}
.product-card-title a{color:var(--bone);text-decoration:none}
.product-type{margin:.4rem 0 0;color:var(--muted);line-height:1.55}
.product-purpose{max-width:78ch;color:var(--bone);font-size:clamp(1rem,1.18vw,1.12rem);line-height:1.68}
.product-limit{max-width:72ch;margin-top:.8rem;color:var(--muted);line-height:1.6}
.product-status{grid-template-columns:repeat(2,minmax(8rem,1fr));margin-top:1rem}
.product-status-line{display:block;margin-top:.7rem;color:var(--muted);line-height:1.5}
.catalog-domain{scroll-margin-top:5rem}
.catalog-count{font-size:clamp(.9rem,1.1vw,1rem);font-weight:500;color:var(--muted)}
.catalog-evidence{display:block;margin-top:1rem;color:var(--muted);line-height:1.65}
.catalog-evidence strong{color:var(--bone);font-weight:600}
.catalog-evidence small{display:block;margin-top:.2rem}
.system-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(16rem,.65fr);gap:clamp(2rem,5vw,5rem);max-width:70rem}
.system-list{max-width:58ch;margin:1rem 0 0;padding-left:1.2rem;color:var(--bone);font-size:clamp(1rem,1.25vw,1.14rem);line-height:1.7}
.system-list li+li{margin-top:.55rem}
.system-command{max-width:60rem;border-top:1px solid var(--hairline);padding:1rem 0;display:grid;grid-template-columns:minmax(9rem,.3fr) 1fr;gap:1rem}
.system-command strong{font-weight:600;color:var(--bone)}
.system-command code{overflow-wrap:anywhere;color:var(--bone)}
.system-null{color:var(--muted)}
.system-evidence{max-width:68rem}
.system-evidence .product-card{grid-template-columns:minmax(12rem,.34fr) minmax(0,1fr)}
.system-family-nav{display:grid;grid-template-columns:minmax(8rem,.28fr) 1fr;gap:.75rem 1rem;max-width:68rem;margin:0 0 1.4rem;padding:1rem 0;border-block:1px solid var(--hairline);line-height:1.7}
.system-family-nav strong{font-weight:600;color:var(--bone)}
.product-record-details{max-width:72rem;margin-top:1rem;border:1px solid var(--hairline);padding:.85rem 1rem;background:color-mix(in srgb,var(--void) 88%,var(--bone) 12%)}
.product-record-details summary{cursor:pointer;color:var(--bone);font-weight:600;min-height:44px;display:flex;align-items:center}
.product-record-details>*+*{margin-top:1rem}
@media(max-width:720px){.system-grid,.system-command,.system-evidence .product-card,.product-card{grid-template-columns:1fr}.system-hero{min-height:auto}.system-facts,.product-status{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:430px){.system-facts,.product-status{grid-template-columns:1fr}.product-record-details{padding:.8rem}}
@media(forced-colors:active){.product-record-details,.product-action,.product-secondary-action,.system-hero-actions a{border-color:CanvasText}}
`;

// A constellation card is the one social image a record page is allowed to
// claim. Records without one fall back to a text summary card.
function social(system, ctx) {
  const name = escapeHtml(system.name);
  const purpose = escapeCopy(system.purpose);
  const shared = [
    '<meta property="og:type" content="website">',
    '<meta property="og:site_name" content="Zentropy Labs">',
    `<meta property="og:title" content="${name} ${MIDDOT} Zentropy Labs">`,
    `<meta property="og:description" content="${purpose}">`,
    `<meta property="og:url" content="https://harperz9.github.io/${escapeHtml(system.href)}">`,
  ];
  const card = ctx.cardById.get(system.id);
  if (!card || !card.constellationCard) {
    return shared
      .concat([
        '<meta name="twitter:card" content="summary">',
        `<meta name="twitter:title" content="${name} ${MIDDOT} Zentropy Labs">`,
        `<meta name="twitter:description" content="${purpose}">`,
      ])
      .join("");
  }
  const image = `https://harperz9.github.io/${escapeHtml(card.imagePath)}`;
  const alt = escapeHtml(`${card.routeTitle} social card. ${card.headline}`);
  return shared
    .concat([
      `<meta property="og:image" content="${image}">`,
      `<meta property="og:image:alt" content="${alt}">`,
      `<meta name="twitter:image" content="${image}">`,
      `<meta name="twitter:image:alt" content="${alt}">`,
      '<meta name="twitter:card" content="summary_large_image">',
      `<meta name="twitter:title" content="${escapeHtml(card.routeTitle)}">`,
      `<meta name="twitter:description" content="${purpose}">`,
    ])
    .join("");
}

export function renderHead(system, ctx) {
  const name = escapeHtml(system.name);
  const purpose = escapeCopy(system.purpose);
  const href = escapeHtml(system.href);
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<!-- Generated by scripts/render-system-pages.mjs. Do not edit. -->
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${name} ${MIDDOT} Zentropy Labs</title>
<meta name="description" content="${purpose}">
<link rel="canonical" href="https://harperz9.github.io/${href}">
  ${social(system, ctx)}
<meta name="color-scheme" content="light dark"><link rel="stylesheet" href="/system/system.css?v=20260907-reading-completion"><style>${SYSTEM_PAGE_STYLE}
</style>
</head>
<body class="inner-clean frame-compact">
<a class="skip-link" href="#main">Skip to content</a><div id="site-nav" class="site-nav"></div><noscript><nav class="site-nav"><a href="/catalog.html">Catalog</a> <a href="/overview.html">Systems</a> <a href="/security.html">Security</a></nav></noscript><script type="module" src="/system/nav.js?v=20260907-simple-menu"></script>
`;
}
