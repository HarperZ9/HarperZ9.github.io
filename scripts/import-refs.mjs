// import-refs.mjs: the references a copied file makes to other files in the workspace.
// referencesOf(relPath, text, srcRoot) returns workspace-relative paths (posix). A reference counts when
//   - it starts with a dated folder name (resolved from the workspace root, the way ROOT + "<folder>/..." works), or
//   - it is relative ("./x", "../x" or "x.ext") and the file exists beside the referring file.
// Strings that only look like paths and resolve to nothing are dropped, except explicit "./" and "../" ones
// and HTML or CSS references, which come back so the importer can report them as unresolved.
import { existsSync } from "node:fs";
import path from "node:path";

const EXT = /\.(m?js|css|json|html|svg|png|jpe?g|webp|avif|gif|woff2?|ttf|otf|opus|ogg|mp3|wav|m4a|mp4|webm|glsl|wgsl|frag|vert|txt|bin|wasm|mid|midi)$/i;
const DATED = /^20\d\d-\d\d-\d\d-[^/]+\//;

function candidatesHTML(text) {
  const out = [];
  for (const m of text.matchAll(/\b(?:src|href|poster|data-src|data-poster|data-still|data-plate)\s*=\s*"([^"]+)"/g)) out.push([m[1], true]);
  for (const m of text.matchAll(/\bsrcset\s*=\s*"([^"]+)"/g)) for (const part of m[1].split(",")) out.push([part.trim().split(/\s+/)[0], true]);
  for (const m of text.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)) out.push(...candidatesJS(m[1]));
  for (const m of text.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/g)) out.push(...candidatesCSS(m[1]));
  for (const m of text.matchAll(/style\s*=\s*"([^"]*url\([^"]*)"/g)) out.push(...candidatesCSS(m[1].replace(/&quot;/g, '"')));
  return out;
}
function candidatesCSS(text) {
  const out = [];
  for (const m of text.matchAll(/url\(\s*(['"]?)([^'")]+)\1\s*\)/g)) out.push([m[2], true]);
  for (const m of text.matchAll(/@import\s+(['"])([^'"]+)\1/g)) out.push([m[2], true]);
  return out;
}
function candidatesJS(text) {
  const out = [];
  for (const m of text.matchAll(/(['"`])((?:(?!\1)[^\\\n$]|\\.)*?)\1/g)) {
    const s = m[2];
    if (!s || s.length > 240 || /\s/.test(s) || s.includes("://")) continue;
    if (EXT.test(s.split(/[?#]/)[0]) || DATED.test(s)) out.push([s, s.startsWith("./") || s.startsWith("../")]);
  }
  return out;
}
function candidatesJSON(text) {
  const out = [];
  for (const m of text.matchAll(/"((?:[^"\\]|\\.)*)"/g)) {
    const s = m[1];
    if (s.length < 240 && !/\s/.test(s) && !s.includes("://") && (EXT.test(s.split(/[?#]/)[0]) || DATED.test(s))) out.push([s, DATED.test(s)]);
  }
  return out;
}

function resolveOne(raw, base, srcRoot) {
  const s = raw.split(/[?#]/)[0];
  if (!s || s.startsWith("/") || /^[a-z][a-z0-9+.-]*:/i.test(s) || s.includes("${")) return null;
  const r = DATED.test(s) ? path.posix.normalize(s) : path.posix.normalize(path.posix.join(base, s));
  if (r.startsWith("..") || r.endsWith("/")) return null;
  return r;
}

export function referencesOf(relPath, text, srcRoot) {
  const ext = path.extname(relPath).toLowerCase(), base = path.posix.dirname(relPath);
  const cands = ext === ".html" ? candidatesHTML(text) : ext === ".css" ? candidatesCSS(text) : ext === ".json" ? candidatesJSON(text) : [".js", ".mjs"].includes(ext) ? candidatesJS(text) : [];
  const out = new Set();
  for (const [raw, strict] of cands) {
    const r = resolveOne(raw, base, srcRoot);
    if (!r) continue;
    // a dated reference from a page or module is resolved from the workspace root; try beside the file too
    if (existsSync(path.join(srcRoot, r))) { out.add(r); continue; }
    if (strict || DATED.test(raw)) out.add(r);
  }
  return [...out];
}
