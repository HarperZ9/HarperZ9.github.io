// The link card for a page: its og:image and twitter:image tags, read from
// img/og/p/cards.json, which tools/repo_art/site_cards.py writes when it renders
// the cards. Shared by the system record heads, the site index and the analytics
// pages. It is named analytics-* so the analytics test sandbox, which copies the
// analytics-*.mjs modules beside the renderer, carries it too; in that sandbox
// there is no manifest, and the pages render without card tags.
import { existsSync, readFileSync } from "node:fs";

const MANIFEST = new URL("../img/og/p/cards.json", import.meta.url);
const CARDS = existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, "utf8")) : null;
const PROTECTED = /elder|enb|skyrim/i;

// The same escape as Python's html.escape, so a regenerated head equals a stamped one.
const attr = (v) => String(v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;").replace(/'/g, "&#x27;");

export function cardTags(href) {
  if (!CARDS) return [];
  const card = CARDS[href];
  if (!card && PROTECTED.test(href)) return null;
  if (!card) throw new Error(`${href}: no card in img/og/p/cards.json; run python -m tools.repo_art.site_cards render`);
  const alt = attr(card.alt);
  return [
    `<meta property="og:image" content="${card.image}">`,
    '<meta property="og:image:width" content="1200">', '<meta property="og:image:height" content="630">',
    `<meta property="og:image:alt" content="${alt}">`, '<meta name="twitter:card" content="summary_large_image">',
    `<meta name="twitter:image" content="${card.image}">`, `<meta name="twitter:image:alt" content="${alt}">`,
  ];
}
