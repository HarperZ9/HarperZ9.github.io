// addresses-nearest.mjs: for an address with no page, the live address a reader most likely wanted.
//
// This file has no imports, so scripts/build-addresses.mjs sets its text into 404.html as it stands (without the
// word "export") and tests/addresses-nearest.test.mjs calls the same code. `rows` are the ledger's rows; `projectSites` its list of
// prefixes that other repositories publish under.
//
// nearest("/Flywheel", rows) -> { path, why } or null, where why is one of:
//   "moved"      the address is a redirect row; path is where it leads
//   "withdrawn"  the address is a gone row; path is the home
//   "spelling"   the same address in another letter case, or with or without .html or a closing slash
//   "name"       one live page elsewhere has the same file name
//   "close"      the live address within a few letters of the one asked for
//   "folder"     the nearest folder above the address that has a page
const fold = (p) => p.toLowerCase().replace(/\.html?$/, "").replace(/\/$/, "");

// Where a row leads once its redirects are followed; null when the chain ends at a withdrawn page or runs on.
function endOf(row, byPath, projectSites) {
  if (row.kind !== "redirect") return row.kind === "gone" ? null : row.path;
  for (let hops = 0; hops < 6; hops++) {
    if (projectSites.some((p) => row.to.startsWith(p))) return row.to;
    const next = byPath.get(row.to) || byPath.get(row.to.split("#")[0]);
    if (!next || next.kind === "gone") return null;
    if (next.kind !== "redirect") return row.to;
    row = next;
  }
  return null;
}

// Edit distance between two addresses, stopped early once it passes max.
function distance(a, b, max) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i]; let low = i;
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (cur[j] < low) low = cur[j];
    }
    if (low > max) return max + 1;
    prev = cur;
  }
  return prev[b.length];
}

function closest(key, live) {
  const allow = Math.max(2, Math.floor(key.length / 6));
  let best = null, bestD = allow + 1;
  for (const r of live) { const d = distance(key, fold(r.path), allow); if (d < bestD) { best = r; bestD = d; } }
  return best;
}

export function nearest(pathname, rows, projectSites = []) {
  const byPath = new Map(rows.map((r) => [r.path, r])), end = (row) => endOf(row, byPath, projectSites);
  const live = rows.filter((r) => r.kind !== "gone" && r.kind !== "redirect" && !r.path.includes("#"));
  let asked = pathname;
  try { asked = decodeURIComponent(pathname); } catch { /* a malformed escape is compared as typed */ }
  asked = asked.replace(/\/index\.html?$/i, "/");
  const exact = byPath.get(asked);
  if (exact && exact.kind === "redirect" && end(exact)) return { path: end(exact), why: "moved" };
  if (exact && exact.kind === "gone") return { path: "/", why: "withdrawn" };

  const key = fold(asked);
  const same = rows.filter((r) => !r.path.includes("#") && r.kind !== "gone" && fold(r.path) === key);
  const spelled = same.find((r) => r.kind !== "redirect") || same[0];
  if (spelled && end(spelled)) return { path: end(spelled), why: "spelling" };

  const base = key.slice(key.lastIndexOf("/") + 1);
  const named = base ? live.filter((r) => { const k = fold(r.path); return k.slice(k.lastIndexOf("/") + 1) === base; }) : [];
  if (named.length === 1) return { path: named[0].path, why: "name" };

  const close = closest(key, live);
  if (close) return { path: close.path, why: "close" };

  for (let dir = asked.replace(/[^/]*$/, ""); dir.length > 1; dir = dir.replace(/[^/]*\/$/, "")) {
    const row = byPath.get(dir);
    if (row && end(row)) return { path: end(row), why: "folder" };
  }
  return null;
}
