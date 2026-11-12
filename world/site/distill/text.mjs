// Distill, text side: decide whether bytes are text, and if so what kind, and take it apart by its own structure.
// Parts are line ranges or top-level members, each with its byte range, so they add up to the whole file.

function decode(bytes) {
  let bom = 0, enc = "utf-8";
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) bom = 3;
  else if (bytes[0] === 0xff && bytes[1] === 0xfe) { bom = 2; enc = "utf-16le"; }
  else if (bytes[0] === 0xfe && bytes[1] === 0xff) { bom = 2; enc = "utf-16be"; }
  try { return { text: new TextDecoder(enc, { fatal: true }).decode(bytes.subarray(bom)), enc, bom }; } catch { return null; }
}
// text has no NUL and almost no control bytes; a strict decode alone would accept many binary files
function looksLikeText(bytes, enc) {
  if (enc !== "utf-8") return true;
  const n = Math.min(bytes.length, 65536); let odd = 0;
  for (let i = 0; i < n; i++) { const b = bytes[i]; if (b === 0) return false; if (b < 9 || (b > 13 && b < 32 && b !== 27)) odd++; }
  return odd <= n * 0.01;
}
const count = (s, re) => (s.match(re) || []).length;

function shape(v, depth = 0) {
  if (v === null) return "null";
  if (Array.isArray(v)) return depth > 3 ? "array" : `array of ${v.length}${v.length ? ": " + shape(v[0], depth + 1) : ""}`;
  if (typeof v === "object") { const k = Object.keys(v); return depth > 3 ? "object" : `object {${k.slice(0, 12).join(", ")}${k.length > 12 ? ", ..." : ""}}`; }
  return typeof v;
}
// byte ranges of the top-level members of a JSON object or array, read with a small scanner so no value is copied
function jsonMembers(text, enc8) {
  const parts = []; let seenAt = 0, seenBytes = 0;   // byte offsets are counted forward once, never from the start again
  const off = (i) => { seenBytes += enc8.encode(text.slice(seenAt, i)).length; seenAt = i; return seenBytes; };
  let i = text.search(/\S/); const open = text[i]; if (open !== "{" && open !== "[") return parts;
  let depth = 0, start = -1, inStr = false, n = 0;
  for (; i < text.length; i++) {
    const c = text[i];
    if (inStr) { if (c === "\\") i++; else if (c === '"') inStr = false; continue; }
    if (c === '"') { inStr = true; if (depth === 1 && start < 0) start = i; continue; }
    if (c === "{" || c === "[") { depth++; if (depth === 2 && start < 0) start = i; continue; }
    if (c === "}" || c === "]") { depth--; if (depth === 0 && start >= 0) { parts.push([start, i]); start = -1; } continue; }
    if (depth === 1 && c === ",") { if (start >= 0) parts.push([start, i]); start = -1; continue; }
    if (depth === 1 && start < 0 && !/\s/.test(c)) start = i;
  }
  if (parts.length > 400) return [];
  return parts.map(([a, b]) => { const src = text.slice(a, b).trim(), key = open === "{" ? (src.match(/^"((?:[^"\\]|\\.)*)"/) || [])[1] : String(n); n++;
    const o = off(a); return { name: key ?? `member ${n}`, kind: "member", offset: o, length: enc8.encode(text.slice(a, b)).length }; });
}
function lineParts(text, bom, enc8, isHead) {
  // sections split at heading lines (Markdown #, or a line a format marks as a heading); with none, one part
  const parts = []; let at = 0, byte = bom, name = "opening", startByte = bom;
  for (const line of text.split(/(?<=\n)/)) {
    const h = isHead(line);
    if (h && at > 0 && byte > startByte) { parts.push({ name, kind: "section", offset: startByte, length: byte - startByte }); startByte = byte; }
    if (h) name = h;
    byte += enc8.encode(line).length; at++;
  }
  parts.push({ name, kind: "section", offset: startByte, length: byte - startByte });
  return parts;
}

export function readText(bytes) {
  if (!bytes.length) return { format: "empty", formatName: "Empty file", facts: {}, parts: [] };
  const d = decode(bytes); if (!d || !looksLikeText(bytes, d.enc)) return null;
  const { text, enc, bom } = d, enc8 = new TextEncoder(), utf8 = enc === "utf-8";
  const lines = text.split(/\r\n|\n|\r/), words = count(text, /[\p{L}\p{N}_'-]+/gu);
  const facts = { encoding: enc + (bom ? " with a byte-order mark" : ""), lines: lines.length, words, characters: [...text].length,
    lineEndings: /\r\n/.test(text) ? (/[^\r]\n/.test(text) ? "mixed" : "CRLF") : /\n/.test(text) ? "LF" : /\r/.test(text) ? "CR" : "none",
    longestLine: lines.reduce((m, l) => Math.max(m, l.length), 0) };
  const whole = [{ name: "text", kind: "text", offset: 0, length: bytes.length }];
  const trimmed = text.trimStart();
  if (utf8 && (trimmed[0] === "{" || trimmed[0] === "[")) {
    try { const v = JSON.parse(text); facts.shape = shape(v);
      const members = jsonMembers(text, enc8).map((p) => ({ ...p, offset: p.offset + bom }));
      return { format: "json", formatName: "JSON", facts, parts: members.length ? members : whole }; } catch { /* not JSON: fall through */ }
  }
  if (/^\s*(<\?xml|<!doctype\s+html|<html|<svg)/i.test(text)) {
    const tags = {}; for (const m of text.matchAll(/<([a-zA-Z][\w:-]*)/g)) tags[m[1].toLowerCase()] = (tags[m[1].toLowerCase()] || 0) + 1;
    const top = Object.entries(tags).sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).slice(0, 12);
    const svg = /^\s*(<\?xml[^>]*>\s*)?(<!--[\s\S]*?-->\s*)*<svg/i.test(text), html = /<html|<!doctype\s+html/i.test(text);
    Object.assign(facts, { elements: Object.values(tags).reduce((a, b) => a + b, 0), commonest: top.map(([t, n]) => `${t} ${n}`).join(", "),
      scripts: tags.script || 0, links: count(text, /\shref\s*=/gi) });
    return { format: svg ? "svg" : html ? "html" : "xml", formatName: svg ? "SVG drawing" : html ? "HTML page" : "XML", facts, parts: whole };
  }
  if (utf8 && lines.length > 1) {
    for (const [sep, label] of [[",", "comma"], ["\t", "tab"], [";", "semicolon"]]) {
      const rows = lines.filter((l) => l.length), n = rows[0].split(sep).length;
      if (n > 1 && rows.length > 1 && rows.slice(0, 50).every((r) => r.split(sep).length === n)) {
        Object.assign(facts, { columns: n, rows: rows.length - 1, separator: label, header: rows[0].split(sep).slice(0, 12).join(" | ") });
        return { format: "table", formatName: "Table in text", facts, parts: whole };
      }
    }
  }
  const md = count(text, /^#{1,6}\s/gm);
  if (utf8 && md) { facts.headings = md;
    return { format: "markdown", formatName: "Markdown", facts, parts: lineParts(text, bom, enc8, (l) => (l.match(/^#{1,6}\s+(.*\S)/) || [])[1]) }; }
  return { format: "text", formatName: "Plain text", facts, parts: whole };
}
