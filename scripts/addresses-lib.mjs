// addresses-lib.mjs: the address ledger's rules, shared by scripts/build-addresses.mjs and its tests.
//
// The ledger, site-src/world/addresses.json, has one row for every address the site has published. It is
// append-only: a row is never removed and its path never changes, so an address that has been given out keeps
// answering. A page that moves leaves a redirect stub at the old address; an address with no page any more is kept
// as "gone", with the commit that removed it.
//
// An address is the path a reader types after the host: "/" for the home, "/playground/" for a folder's index,
// "/cmmns.html" for a page, and "/private-practice.html#gate" where the sitemap has listed a place inside a page.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const SITE = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
export const LEDGER = "site-src/world/addresses.json";
export const ORIGIN = "https://harperz9.github.io";

// The six surfaces and the door, at the addresses already in circulation.
export const SURFACES = [
  { id: "playground", path: "/playground/", name: "The Playground", does: "the rendering engine, its instruments and the game made with it" },
  { id: "commons", path: "/cmmns.html", name: "The Commons", does: "where a reply comes from and how it argues" },
  { id: "flywheel", path: "/flywheel.html", name: "The Flywheel", does: "a workstation for any model, with runs you can recheck" },
  { id: "articulate", path: "/articulate.html", name: "Articulate", does: "each writing pattern in your prose, named with its line" },
  { id: "buildlang", path: "/buildlang.html", name: "BuildLang", does: "a language whose types list what a function may touch" },
  { id: "research", path: "/research.html", name: "Research", does: "essays, papers and experiments, nulls included" },
  { id: "door", path: "/", name: "The home page", does: "the door to all six" },
];
export const SITE_INDEX = "/site-index.html";
export const KINDS = ["surface", "leaf", "record", "redirect", "gone"];
export const SURFACE_IDS = [...SURFACES.map((s) => s.id), "unassigned"];

// Other repositories publish their own pages under prefixes of the same host (GitHub Pages serves a project site
// at /<repository>/). They are live addresses, and none of their files are in this repository, so a link or a
// redirect into one of them is accepted without a row. The list is "projectSites" in the ledger's head, where the
// 404 page and the tests read the same copy; add a prefix only for a repository whose pages have been seen answering.
export const inProjectSite = (ledger, address) => (ledger.projectSites || []).some((p) => address.startsWith(p));

// A page may load part of itself after it opens (the index of the work fetches its later rows). "lateParts" in the
// ledger's head names those files, so a place inside one counts as a place on the page.
export function pageText(ledger, address, site = SITE) {
  const page = address.split("#")[0], f = path.join(site, fileOf(page));
  if (!existsSync(f)) return null;
  return [f, ...(ledger.lateParts?.[page] || []).map((p) => path.join(site, p))].map((x) => readFileSync(x, "utf8")).join("\n");
}

// Tracked folders and files that GitHub Pages does not serve (_config.yml), so they are not addresses.
const NOT_SERVED = [/^home\//, /^tests\//, /^docs\//, /^img\/og\/_card\.html$/, /(^|\/)[_.][^/]*/, /(^|\/)node_modules\//];
export const isServed = (file) => !NOT_SERVED.some((re) => re.test(file));

export const addressOf = (file) => "/" + file.replace(/(^|\/)index\.html$/, "$1");
export const fileOf = (address) => {
  const p = address.split("#")[0].replace(/^\//, "");
  return p === "" || p.endsWith("/") ? p + "index.html" : p;
};
// An absolute or relative link, seen on the page at `from`, as an address ("/x/index.html" reads as "/x/").
export function resolveAddress(href, from = "/") {
  const u = new URL(href, ORIGIN + from);
  if (u.origin !== ORIGIN) return null;
  return decodeURIComponent(u.pathname).replace(/\/index\.html$/, "/") + u.hash;
}

export function servedPages(site = SITE) {
  const out = execFileSync("git", ["ls-files", "-co", "--exclude-standard", "--", "*.html"], { cwd: site, encoding: "utf8", maxBuffer: 1 << 26 });
  return out.split("\n").filter((f) => f && isServed(f) && existsSync(path.join(site, f))).sort();
}

const REFRESH = /<meta[^>]+http-equiv="refresh"[^>]+content="\s*\d+\s*;\s*url=([^"]+)"/i;
export function redirectTarget(html, from) {
  const m = REFRESH.exec(html);
  return m ? resolveAddress(m[1].trim(), from) : null;
}
export const hasFragment = (html, id) => new RegExp(`\\b(?:id|name)=["']${id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["']`).test(html);

export function loadLedger(site = SITE) {
  const file = path.join(site, LEDGER);
  return existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : { schema: 1, rows: [] };
}
// One row a line, so a new address is one added line and two branches that each add a row merge cleanly.
export function serialize(ledger) {
  const { rows, ...head } = ledger;
  const top = JSON.stringify(head, null, 1).replace(/\n}$/, "");
  return `${top},\n "rows": [\n${rows.map((r) => "  " + JSON.stringify(r)).join(",\n")}\n ]\n}\n`;
}

// Where a row leads once every redirect is followed: { address } on this site, { project } in another
// repository's pages, or { problem }.
export function follow(row, byPath, ledger, hops = 0) {
  if (row.kind !== "redirect") return { address: row.path };
  if (hops > 5) return { problem: "redirect chain longer than five hops" };
  if (inProjectSite(ledger, row.to)) return { project: row.to };
  const next = byPath.get(row.to) || byPath.get(row.to.split("#")[0]);
  if (!next) return { problem: `redirect target ${row.to} has no row` };
  if (next.kind === "gone") return { problem: `redirect target ${row.to} is gone` };
  return next.kind === "redirect" ? follow(next, byPath, ledger, hops + 1) : { address: row.to };
}

// Every problem with the ledger against the pages on disk; empty means every address answers.
export function validate(ledger, site = SITE, pages = servedPages(site)) {
  const problems = [], byPath = new Map();
  const read = (address) => pageText(ledger, address, site);
  for (const r of ledger.rows) {
    const at = r.path || JSON.stringify(r);
    if (typeof r.path !== "string" || !r.path.startsWith("/")) { problems.push(`${at}: path must start with /`); continue; }
    if (byPath.has(r.path)) problems.push(`${at}: listed twice`);
    byPath.set(r.path, r);
    if (!KINDS.includes(r.kind)) problems.push(`${at}: kind ${r.kind} is not one of ${KINDS.join(", ")}`);
    if (!SURFACE_IDS.includes(r.surface)) problems.push(`${at}: surface ${r.surface} is not known`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(r.since || "")) problems.push(`${at}: since must be a date`);
    if (r.kind === "gone") { if (!r.removed) problems.push(`${at}: a gone row names the commit that removed it`); continue; }
    const html = read(r.path);
    if (html === null) { problems.push(`${at}: no page at ${fileOf(r.path)}`); continue; }
    const frag = r.path.split("#")[1];
    if (frag && !hasFragment(html, frag)) problems.push(`${at}: the page has no place named ${frag}`);
    const target = frag ? null : redirectTarget(html, r.path);
    if (r.kind === "redirect") {
      if (!r.to) problems.push(`${at}: a redirect row names its target in "to"`);
      else if (target !== r.to) problems.push(`${at}: the stub sends readers to ${target}, the row says ${r.to}`);
    } else if (target) problems.push(`${at}: the page is a redirect stub to ${target}, the row says ${r.kind}`);
  }
  for (const r of ledger.rows.filter((x) => x.kind === "redirect" && x.to)) {
    const end = follow(r, byPath, ledger);
    if (end.problem) { problems.push(`${r.path}: ${end.problem}`); continue; }
    if (end.project) continue;
    const [page, frag] = end.address.split("#"), html = read(page);
    if (html === null) problems.push(`${r.path}: redirect ends at ${page}, which has no page`);
    else if (frag && !hasFragment(html, frag)) problems.push(`${r.path}: redirect ends at ${end.address}, and the page has no place named ${frag}`);
  }
  for (const s of SURFACES) if (byPath.get(s.path)?.kind !== "surface") problems.push(`${s.path}: the ${s.id} surface needs a row of kind surface`);
  for (const f of pages) if (!byPath.has(addressOf(f))) problems.push(`${addressOf(f)}: a served page with no row`);
  return problems;
}
