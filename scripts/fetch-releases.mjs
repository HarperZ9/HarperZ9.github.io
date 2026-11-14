#!/usr/bin/env node
// Read every release, registry version and pull request the home's Verified lines rest on, and write them to
// site-src/world/releases.json. The home build turns that file into versions and Verified lines, so they can only
// say what this fetch saw, on the day it saw it.
//
//   node scripts/fetch-releases.mjs            fetch and write the file
//   node scripts/fetch-releases.mjs --check    fetch and compare; exit 1 when a release shipped that the file lacks
//   node scripts/fetch-releases.mjs --offline  no network: check that the file exists and covers every source
//
// GITHUB_TOKEN or GH_TOKEN raises GitHub's rate limit; without one the 15 or so reads fit the anonymous limit.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SOURCES } from "../site-src/world/release-sources.mjs";

const site = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const OUT = path.join(site, "site-src/world/releases.json");
const args = process.argv.slice(2);
const UA = "harperz9-site-releases (https://github.com/HarperZ9/HarperZ9.github.io)";
const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || "";

async function get(url, gh = false) {
  const headers = { "User-Agent": UA, Accept: gh ? "application/vnd.github+json" : "application/json" };
  if (gh && token) headers.Authorization = `Bearer ${token}`;
  const r = await fetch(url, { headers });
  if (!r.ok) throw new Error(`releases: ${url} answered ${r.status}`);
  return r.json();
}
const day = (iso) => (iso ? iso.slice(0, 10) : null);

async function registry({ kind, name }) {
  if (kind === "pypi") { const d = await get(`https://pypi.org/pypi/${name}/json`); return { kind, name, version: d.info.version, url: `https://pypi.org/project/${name}/${d.info.version}/` }; }
  if (kind === "crates") { const d = await get(`https://crates.io/api/v1/crates/${name}`); const v = d.crate.max_stable_version; return { kind, name, version: v, url: `https://crates.io/crates/${name}/${v}` }; }
  if (kind === "npm") { const d = await get(`https://registry.npmjs.org/${name}/latest`); return { kind, name, version: d.version, url: `https://www.npmjs.com/package/${name}/v/${d.version}` }; }
  throw new Error(`releases: unknown registry ${kind}`);
}

// The first release that contained a merged change: the oldest release whose tag has the merge commit in its
// history. The publish time only picks where to start looking; the tag's history decides. null when no release
// carries the change yet (it is on main after the latest release, or the repository has no release).
const RELEASES = new Map(), FIRST = new Map();
function releasesOf(repo) {
  if (!RELEASES.has(repo)) RELEASES.set(repo, get(`https://api.github.com/repos/${repo}/releases?per_page=100`, true)
    .then((list) => list.filter((r) => !r.draft && !r.prerelease).sort((a, b) => a.published_at.localeCompare(b.published_at))));
  return RELEASES.get(repo);
}
function firstRelease(repo, sha, mergedTime) {
  const key = `${repo}@${sha}`;
  if (!FIRST.has(key)) FIRST.set(key, (async () => {
    for (const rel of (await releasesOf(repo)).filter((r) => r.published_at >= mergedTime)) {
      const c = await get(`https://api.github.com/repos/${repo}/compare/${encodeURIComponent(rel.tag_name)}...${sha}`, true);
      if (c.status === "behind" || c.status === "identical") return { version: rel.tag_name.replace(/^v/, ""), published: day(rel.published_at), url: rel.html_url };
    }
    return null;
  })());
  return FIRST.get(key);
}

async function one(id, s) {
  const row = { id };
  if (s.github) {
    const rel = await get(`https://api.github.com/repos/${s.github}/releases/latest`, true);
    row.github = { repo: s.github, tag: rel.tag_name, version: rel.tag_name.replace(/^v/, ""), published: day(rel.published_at), publishedAt: rel.published_at, url: rel.html_url };
    if (s.asset) {
      const want = s.asset.replace("{v}", row.github.version);
      row.github.asset = { name: want, attached: (rel.assets || []).some((a) => a.name === want) };
    }
  }
  if (s.registry) row.registry = await registry(s.registry);
  if (s.prs) {
    row.prs = [];
    for (const [repo, n] of s.prs) {
      const p = await get(`https://api.github.com/repos/${repo}/pulls/${n}`, true);
      const pr = { repo, number: n, title: p.title, merged: !!p.merged_at, mergedAt: day(p.merged_at), mergedTime: p.merged_at, commit: p.merged_at ? p.merge_commit_sha.slice(0, 7) : null, url: p.html_url };
      // --check compares versions and merge states only, so it skips these extra reads
      if (p.merged_at && !args.includes("--check")) pr.firstRelease = await firstRelease(repo, p.merge_commit_sha, p.merged_at);
      row.prs.push(pr);
    }
  }
  return row;
}

async function fetchAll() {
  const ids = Object.keys(SOURCES);
  // independent reads run together
  const rows = await Promise.all(ids.map((id) => one(id, SOURCES[id])));
  return { checkedAt: new Date().toISOString().slice(0, 19) + "Z", products: Object.fromEntries(rows.map((r) => [r.id, r])) };
}

// what a reader would see change: versions, registry versions, attached downloads and merge states
function facts(d) {
  return Object.values(d.products).flatMap((p) => [
    p.github && `${p.id} release ${p.github.version}`, p.registry && `${p.id} ${p.registry.kind} ${p.registry.version}`,
    p.github?.asset && `${p.id} asset ${p.github.asset.name} ${p.github.asset.attached}`,
    ...(p.prs || []).map((x) => `${x.repo}#${x.number} merged ${x.merged}`),
  ].filter(Boolean));
}

async function main() {
  if (args.includes("--offline")) {
    if (!existsSync(OUT)) { console.error("releases: site-src/world/releases.json is missing; run without --offline once"); process.exit(2); }
    const d = JSON.parse(readFileSync(OUT, "utf8")), missing = Object.keys(SOURCES).filter((id) => !d.products[id]);
    if (missing.length) { console.error(`releases: no fetched row for ${missing.join(", ")}`); process.exit(2); }
    console.log(`releases: kept the fetch of ${d.checkedAt}`);
    return;
  }
  const live = await fetchAll();
  if (args.includes("--check")) {
    const have = existsSync(OUT) ? new Set(facts(JSON.parse(readFileSync(OUT, "utf8")))) : new Set();
    const stale = facts(live).filter((f) => !have.has(f));
    if (stale.length) { console.error(`releases: the site is behind:\n  ${stale.join("\n  ")}\nRun node scripts/build-world.mjs --site-only and commit.`); process.exit(1); }
    console.log("releases: the site names every current release");
    return;
  }
  writeFileSync(OUT, JSON.stringify(live, null, 1) + "\n");
  console.log(`releases: ${Object.keys(live.products).length} sources read at ${live.checkedAt}`);
}
main().catch((e) => { console.error(`releases: ${e.message}`); process.exit(1); });
