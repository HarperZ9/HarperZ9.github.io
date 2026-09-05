// Helpers shared by every page rendered from system/systems.json.
export const MIDDOT = "\u00b7";
export const SITE = "https://harperz9.github.io/";

export function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

// Product copy keeps its apostrophes as typed. Every other registry string
// goes through escapeHtml, which encodes the apostrophe as well.
export function escapeCopy(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

// An evidence link back to this site is written relative so a page resolves
// from a local checkout as well as from the deployed origin.
export function siteRelative(href) {
  return href.startsWith(SITE) ? href.slice(SITE.length) : href;
}

// Registry hrefs are repository-relative; page links are origin-absolute.
export function localHref(href) {
  if (href.startsWith("http") || href.startsWith("/")) return href;
  return `/${href}`;
}

// Controlled-private records keep a catalog row and a boundary page, and stay
// out of every list that reads as a public product route.
export function publicOnly(systems) {
  return systems.filter((system) => system.maturity !== "controlled-private");
}
