// Advisory IDs and package names are single tokens with hyphens inside, such as
// GHSA-82fg-qprm-q5r7 or flywheel-relay==0.5.0. A browser may end a line after
// any hyphen, which splits the token across two lines. Pages wrap each token in
// <span class="ident" translate="no">, and the .ident rule in the page's sheet
// keeps it whole unless its container is narrower than the token.
//
// Package names come from the registry itself: every PyPI or npm project its
// evidence links to, every name its install commands install, and every PyPI
// name its text says belongs to another publisher. Only hyphenated names can
// break, so only they are kept.

const GHSA = "GHSA(?:-[0-9a-z]{4}){3}";
const NAME = /^[a-z0-9]+(?:-[a-z0-9]+)+$/;
const SOURCES = [
  /pypi\.org\/project\/([A-Za-z0-9._-]+)\//g,
  /npmjs\.com\/package\/([A-Za-z0-9._-]+)/g,
  /(?:pip install(?: -U| --upgrade)?|pipx install|npm install(?: -g)?|npx(?: -y)?)\s+([a-z0-9][a-z0-9-]*[a-z0-9])/g,
  /PyPI name ([a-z0-9][a-z0-9-]*[a-z0-9])/g,
];

export function packageNames(registry) {
  const names = new Set();
  const text = JSON.stringify(registry.systems);
  for (const source of SOURCES) {
    for (const match of text.matchAll(source)) {
      const name = match[1].toLowerCase();
      if (NAME.test(name)) names.add(name);
    }
  }
  return [...names].sort();
}

// A token stands alone: no letter, digit, dot, slash or hyphen touches it, so a
// name inside a URL, a path or a longer word is left as it is. A pinned version
// (==1.9.1) stays with its package name. Group 1 is the character before the
// token (or nothing at the start of the text) and group 2 is the token. The
// pattern uses no lookbehind, so older browsers can compile it in the home bundle.
export function identSource(names) {
  const alternatives = [...names].sort((a, b) => b.length - a.length || a.localeCompare(b));
  const packages = alternatives.map((name) => name.replaceAll("-", "\\-")).join("|");
  return `(^|[^A-Za-z0-9_./-])(${GHSA}|(?:${packages})(?:==[0-9]+(?:\\.[0-9A-Za-z]+)*)?)(?![A-Za-z0-9_/-])`;
}

export function identPattern(names) {
  return new RegExp(identSource(names), "g");
}

// Text in these elements is never marked. In the raw-text ones only their own
// closing tag ends them, so a tag-like string in a script cannot end the skip.
// Text in <pre> is marked: many command blocks wrap long lines, and a span
// changes nothing a reader copies.
const SKIP = new Set(["head", "svg", "title", "textarea", "script", "style"]);
const RAW_TEXT = new Set(["title", "textarea", "script", "style"]);
const TAG = /(<[^>]+>)/;
const TAG_NAME = /^<(\/?)([a-zA-Z][a-zA-Z0-9-]*)/;
const IDENT_CLASS = /\bclass="(?:[^"]*\s)?ident(?:\s[^"]*)?"/;

// Wraps every token in the text of an HTML document. Tags and attributes are
// never changed, and text directly inside an element that already carries the
// ident class is not wrapped twice, so running it again changes nothing.
export function markIdents(html, pattern) {
  const parts = html.split(TAG);
  const open = [];
  let insideIdent = false;
  for (let index = 0; index < parts.length; index += 1) {
    const part = parts[index];
    if (index % 2 === 1) {
      const tag = TAG_NAME.exec(part);
      const closing = tag?.[1] === "/";
      const name = tag?.[2].toLowerCase();
      const top = open.at(-1);
      if (RAW_TEXT.has(top)) {
        if (closing && name === top) open.pop();
      } else if (name && SKIP.has(name) && !part.endsWith("/>")) {
        if (!closing) open.push(name);
        else if (name === top) open.pop();
      }
      insideIdent = !closing && IDENT_CLASS.test(part);
      continue;
    }
    if (open.length || insideIdent || !part) continue;
    parts[index] = part.replace(
      pattern,
      (_, lead, token) => `${lead}<span class="ident" translate="no">${token}</span>`,
    );
  }
  return parts.join("");
}
