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
//
// NAMED_IN_TEXT lists the few packages the registry names in prose without a
// link or an install command. coherence-membrane is one: the Accountable Surface
// record says PyPI installed it as a dependency, and it has no record of its own
// to link from. A name here counts only while the registry text still names it,
// so an entry cannot outlive the sentence that needs it.
// tests/test_ident_tokens.py checks each entry against the registry.

const GHSA = "GHSA(?:-[0-9a-z]{4}){3}";
const NAME = /^[a-z0-9]+(?:-[a-z0-9]+)+$/;
const SOURCES = [
  /pypi\.org\/project\/([A-Za-z0-9._-]+)\//g,
  /npmjs\.com\/package\/([A-Za-z0-9._-]+)/g,
  /(?:pip install(?: -U| --upgrade)?|pipx install|npm install(?: -g)?|npx(?: -y)?)\s+([a-z0-9][a-z0-9-]*[a-z0-9])/g,
  /PyPI name ([a-z0-9][a-z0-9-]*[a-z0-9])/g,
];
export const NAMED_IN_TEXT = Object.freeze(["coherence-membrane"]);

export function packageNames(registry) {
  const names = new Set();
  const text = JSON.stringify(registry.systems);
  for (const source of SOURCES) {
    for (const match of text.matchAll(source)) {
      const name = match[1].toLowerCase();
      if (NAME.test(name)) names.add(name);
    }
  }
  for (const name of NAMED_IN_TEXT) {
    if (new RegExp(`(?:^|[^a-z0-9/.-])${name}(?![a-z0-9-])`).test(text)) names.add(name);
  }
  return [...names].sort();
}

// A token stands alone: no letter, digit, dot, slash or hyphen touches it, so a
// name inside a URL, a path or a longer word is left as it is. A pinned version
// (==1.9.1) stays with its package name.
//
// Punctuation that touches the token goes inside the span with it: an opening
// bracket or quote before it, and closing punctuation after it when a space, a
// tag or the end of the text follows. The span is an inline-block, and a line
// may break on either side of one, so a bracket left outside could end a line
// alone ("tool (" then "GHSA-...)" below it).
//
// Group 1 is the text before the token: at most one other character, then at
// most one opening bracket or quote. Group 2 is the token. Group 3, when present,
// is the closing punctuation. The pattern uses no lookbehind and no named group,
// so older browsers and Python's re can both compile it.
const OPENING = `([{\\u201c\\u2018"'`;
const CLOSING = `)\\]}\\u201d\\u2019"'.,;:!?`;
export const IDENT_OPENING = new Set(["(", "[", "{", "“", "‘", '"', "'"]);

export const IDENT_LEAD = `(^[${OPENING}]?|[^A-Za-z0-9_./-][${OPENING}]?)`;
export const IDENT_TRAIL = `((?:[${CLOSING}]+)(?=\\s|$|<))?`;

// The token alone, as one capture group, without the text around it.
export function identTokenSource(names) {
  const alternatives = [...names].sort((a, b) => b.length - a.length || a.localeCompare(b));
  const packages = alternatives.map((name) => name.replaceAll("-", "\\-")).join("|");
  return `(${GHSA}|(?:${packages})(?:==[0-9]+(?:\\.[0-9A-Za-z]+)*)?)(?![A-Za-z0-9_/-])`;
}

export function identSource(names) {
  return `${IDENT_LEAD}${identTokenSource(names)}${IDENT_TRAIL}`;
}

export function identPattern(names) {
  return new RegExp(identSource(names), "g");
}

// The span for one match: the opening bracket joins the token, and whatever
// else came before it stays outside.
export function identSpan(lead, token, trail = "") {
  const glue = IDENT_OPENING.has(lead.at(-1)) ? lead.at(-1) : "";
  const before = glue ? lead.slice(0, -1) : lead;
  return `${before}<span class="ident" translate="no">${glue}${token}${trail}</span>`;
}

// Text in these elements is never marked. In the raw-text ones only their own
// closing tag ends them, so a tag-like string in a script cannot end the skip.
// Text in <pre> is marked: many command blocks wrap long lines, and a span
// changes nothing a reader copies.
const SKIP = new Set(["head", "svg", "title", "textarea", "script", "style"]);
const RAW_TEXT = new Set(["title", "textarea", "script", "style"]);
const VOID = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"]);
const TAG = /(<[^>]+>)/;
const TAG_NAME = /^<(\/?)([a-zA-Z][a-zA-Z0-9-]*)/;
const IDENT_CLASS = /\bclass="(?:[^"]*\s)?ident(?:\s[^"]*)?"/;
// Classes whose own rule already keeps their text on one line (white-space:nowrap in
// system.css). A token inside needs no span, and an inline-block there would only add
// a break before the punctuation that follows.
export const NOWRAP_CLASSES = ["built-stat"];
const NOWRAP_CLASS = new RegExp(`\\bclass="(?:[^"]*\\s)?(?:${NOWRAP_CLASSES.join("|")})(?:\\s[^"]*)?"`);

// Wraps every token in the text of an HTML document. Tags and attributes are
// never changed. Text anywhere inside an element that carries the ident class is
// left alone, so running it again changes nothing.
export function markIdents(html, pattern) {
  const parts = html.split(TAG);
  const stack = [];
  for (let index = 0; index < parts.length; index += 1) {
    const part = parts[index];
    if (index % 2 === 1) {
      const tag = TAG_NAME.exec(part);
      const closing = tag?.[1] === "/";
      const name = tag?.[2].toLowerCase();
      const top = stack.at(-1);
      if (top && RAW_TEXT.has(top.name)) {
        if (closing && name === top.name) stack.pop();
        continue;
      }
      if (!name || VOID.has(name) || part.endsWith("/>")) continue;
      if (!closing) {
        stack.push({ name, skip: SKIP.has(name), ident: IDENT_CLASS.test(part) || NOWRAP_CLASS.test(part) });
      } else {
        let at = stack.length - 1;
        while (at >= 0 && stack[at].name !== name) at -= 1;
        if (at >= 0) stack.length = at;
      }
      continue;
    }
    if (!part || stack.some((element) => element.skip || element.ident)) continue;
    parts[index] = part.replace(pattern, (_, lead, token, trail) => identSpan(lead, token, trail));
  }
  return parts.join("");
}
