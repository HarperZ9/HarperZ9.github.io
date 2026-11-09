// import-rewrite.mjs: the text changes the importer applies to every copied text file.
//   - each dated workspace folder name becomes its short name, so "../../2026-10-23-ui-direction/shell/shell.js"
//     reads "../../ui/shell/shell.js" and still resolves inside world/;
//   - links to the live site become root-relative ("https://harperz9.github.io/x.html" -> "/x.html");
//   - pages take the house type (data-type="house") when the switch in the config is on;
//   - faces the author retired (config "retiredFaces") are not shipped: their @font-face rules and their names in
//     font stacks are dropped, so each stack falls through to the next face.
// findLocalPaths(text) lists drive paths (C:/, E:\ and the like) that would leak into a public file.

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function rewriteText(text, { folders, houseType, file, retiredFaces = [], held = [] }) {
  let t = text;
  // longest names first, so "2026-10-23-feed-test-22" never matches as "2026-10-23-feed-test-2" plus "2"
  for (const from of Object.keys(folders).sort((a, b) => b.length - a.length)) {
    t = t.replace(new RegExp(escapeRe(from) + "(?![0-9A-Za-z-])", "g"), folders[from]);
  }
  t = t.replace(/https:\/\/harperz9\.github\.io\//g, "/");
  // archive titles that arrived with Wikimedia's QuickStatements tail ("Papyrus of Hunefer title QS:P1476,en:...")
  // keep only the title itself
  t = t.replace(/ title QS:P1476(?:[^<"\\]|\\.)*/g, "");
  // every page gets the site's icon, so no browser asks for a missing /favicon.ico
  // a piece held back from publication (config "hold") is not linked from its neighbours
  if (file.endsWith(".html")) for (const h of held) t = t.replace(new RegExp(`<a\\b[^>]*href="(?:\\./)?${escapeRe(h)}"[^>]*>[\\s\\S]*?</a>`, "g"), "");
  // in scripts the sentence stays and only the link goes: "the <a href="wall.html">last wall</a>" reads "the last wall"
  if (/\.m?js$/.test(file)) for (const h of held) t = t.replace(new RegExp(`<a\\b[^>]*href="(?:\\./)?${escapeRe(h)}"[^>]*>([\\s\\S]*?)</a>`, "g"), "$1");
  if (file.endsWith(".html")) {
    t = t.replace(/<link rel="icon" href="data:,">/g, '<link rel="icon" href="/favicon.svg" type="image/svg+xml">');
    if (!/rel="(?:shortcut )?icon"/.test(t)) t = t.replace(/<head>/i, '<head>\n<link rel="icon" href="/favicon.svg" type="image/svg+xml">');
  }
  // the type rule is dynamic (the author, 2026-10-26: "accession is not the rule ~ dynamic is"): a page shows the
  // still face (Hanken Grotesk and Conso) unless the config turns a house face on
  if (file.endsWith(".html")) t = houseType ? t.replace(/(<html\b[^>]*\bdata-type=")stock(")/, "$1house$2") : t.replace(/(<html\b[^>]*\bdata-type=")house(")/, "$1stock$2");
  // the site's step-down for weak devices (world/site/budget.js sets <html data-ground="off"> before the ground
  // starts): the flow ground then stays off, the same as its own ?medium=off switch
  if (file.endsWith("flow/ground.js")) t = t.replace('if (new URLSearchParams(location.search).get("medium") === "off") return;',
    'if (new URLSearchParams(location.search).get("medium") === "off" || document.documentElement.dataset.ground === "off") return;');
  if (file.endsWith(".css")) {
    for (const f of retiredFaces) {
      t = t.replace(new RegExp(`@font-face\\s*\\{\\s*font-family:\\s*"${escapeRe(f)}";[^}]*\\}\\n?`, "g"), "");
      t = t.replace(new RegExp(`"${escapeRe(f)}"\\s*,\\s*`, "g"), "");
    }
    // Accession Text now reads better than Hanken at 12 px (the typeface's Protocol B: 0.85% against 1.25%)
    // and has a true italic, so the two interim holds in the shell's type tokens are lifted on the site.
    t = t.replace(/:root\[data-type="house"\] \.card,:root\[data-type="house"\] small\{font-family:"Hanken Grotesk"[^}]*\}\n?/g, "");
    t = t.replace(/:root\[data-type="house"\] :is\(i,em,cite\)\{font-style:normal;font-weight:600\}\n?/g, "");
  }
  return scrubLocal(t);
}

// Local paths in comments and data records become workspace-relative names: a path under the workspace root reads relative to it ("<root>/x/y.md" reads "x/y.md"),
// and scratch files on other drives keep only their file name.
export function scrubLocal(text) {
  return text.replace(/(^|[^A-Za-z0-9])([A-Za-z]):[\\/]((?:[A-Za-z0-9_.-]+[\\/]?)+)/g, (m, pre, drive, rest) => {
    const parts = rest.split(/[\\/]/).filter(Boolean);
    if (/^c$/i.test(drive) && parts[0] === "dev") return pre + parts.slice(1).join("/");
    return pre + (parts[parts.length - 1] || "");
  });
}

// A drive letter followed by a slash or backslash and a word, such as a workspace or downloads folder.
const LOCAL = /\b[A-Za-z]:[\\/](?:[A-Za-z0-9_.-]+[\\/]?)+/g;
export function findLocalPaths(text) {
  const hits = [];
  for (const m of text.matchAll(LOCAL)) {
    const before = text.slice(Math.max(0, m.index - 1), m.index);
    if (/[A-Za-z0-9]/.test(before)) continue;           // part of a longer token, such as a URL scheme or hash
    hits.push(m[0].slice(0, 80));
  }
  return [...new Set(hits)];
}

// Pages served from /world/ carry the site's discovery set: an absolute canonical for their own address, a
// description (the page's own, or the config's), and a social card that reuses the home's image when they have none.
const ORIGIN = "https://harperz9.github.io/";
const attr = (s) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
export function discoverySet(html, dest, description) {
  let t = html;
  const url = ORIGIN + dest.replace(/index\.html$/, ""), title = (t.match(/<title>([^<]*)<\/title>/) || [, "Zain Dana Harper"])[1].trim();
  t = t.replace(/<link rel="canonical"[^>]*>\n?/g, "");
  let desc = (t.match(/<meta name="description" content="([^"]*)"/) || [])[1];
  if (!desc && description) { desc = description; t = t.replace(/<\/title>/, `</title>\n<meta name="description" content="${attr(desc)}">`); }
  const tags = [`<link rel="canonical" href="${url}">`];
  if (!/property="og:title"/.test(t)) tags.push(`<meta property="og:type" content="website">`, `<meta property="og:title" content="${attr(title)}">`,
    `<meta property="og:description" content="${attr(desc || title)}">`, `<meta property="og:url" content="${url}">`,
    `<meta property="og:image" content="${ORIGIN}img/og/p/home.jpg?v=2b51e5fb7bb8">`, `<meta name="twitter:card" content="summary_large_image">`);
  return t.replace(/<\/title>/, `</title>\n${tags.join("\n")}`);
}
