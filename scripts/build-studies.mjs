#!/usr/bin/env node
// Build the study pages and the study boards from the reference library.
//
//   node scripts/build-studies.mjs [--src WORKSHOP]   (or MISSION_CONTROL=WORKSHOP)
//
// Reads <src>/2026-10-25-reference-library: studies/*/STUDY.md (with parts.json for the post and our
// measures), units.json (each study's concepts and medium), concepts.jsonl (names) and boards/*.json
// (refdb.board/1). Writes studies/<id>.html, studies/boards/<key>.html, studies/index.html and
// studies/pages.json. Text only: no third-party picture, frame or thumbnail is copied or linked as media.
// Each study credits its creator by name and handle and links the original post.
//
// Which studies: only those whose sections carry written prose (at least MIN_WORDS words after the
// header); the rest are still empty templates. Which sections: what the study is, its parts, the framework
// behind it, the same idea in distant fields, and its two edges. The workshop sections (our libraries, the
// build to try, open questions) stay in the library.
//
// Lanes. A study's lane comes from its concepts in units.json:
//   journalism  it reads arguments or claims (argument-structure, rule-argument-movements, witness-transparency)
//               and its medium is writing, data or talk (a poster that merely carries words stays in design);
//   research    otherwise, its medium is data, code, writing, sound or game-3d, or it carries two or more laws;
//   design      everything else (the visual, print, type and moving-image studies).
// Boards take the same rule over the union of their plates' concepts.
//
// Publication: every study's own header records it as a private study, so the pages carry noindex until
// the author clears them; flip INDEXABLE to true once he has, and they join the sitemap through pages.json.
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { esc, publicText, toHTML } from "./studies-markdown.mjs";
import { page } from "./studies-shell.mjs";

const INDEXABLE = false;
const MIN_WORDS = 150;
const KEEP = new Set([1, 2, 3, 4, 7]);
const site = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const LIB = path.join(path.resolve(arg("--src", null) ?? process.env.MISSION_CONTROL ?? (console.error("set MISSION_CONTROL to the workshop folder, or pass --src"), process.exit(2))), "2026-10-25-reference-library");
const OUT = path.join(site, "studies");
const read = (p) => readFileSync(p, "utf8");
const ROBOTS = INDEXABLE ? "" : "noindex, follow";

function loadLibrary() {
  const units = JSON.parse(read(path.join(LIB, "units.json")));
  const concepts = new Map(read(path.join(LIB, "concepts.jsonl")).split("\n").filter(Boolean).map((l) => JSON.parse(l)).map((c) => [c.concept, c]));
  const records = new Map(read(path.join(LIB, "index.jsonl")).split("\n").filter(Boolean).map((l) => JSON.parse(l)).map((r) => [r.id, r]));
  return { units, concepts, records };
}

export function laneOf(conceptIds, medium) {
  const c = new Set(conceptIds);
  if (["argument-structure", "rule-argument-movements", "witness-transparency"].some((x) => c.has(x)) && ["writing", "data", "talk"].includes(medium)) return "journalism";
  const laws = [...c].filter((x) => x.startsWith("law-")).length;
  if (["data", "code", "writing", "sound", "game-3d"].includes(medium) || laws >= 2) return "research";
  return "design";
}

// The STUDY.md sections, numbered "## N. Title"; returns [{ n, title, body }].
function sections(md) {
  const parts = md.split(/^## (?=\d+\.)/m).slice(1);
  return parts.map((p) => { const nl = p.indexOf("\n"), head = p.slice(0, nl); return { n: parseInt(head, 10), title: head.replace(/^\d+\.\s*/, "").trim(), body: p.slice(nl + 1) }; });
}
const prose = (s) => s.body.replace(/<!--[\s\S]*?-->/g, "").replace(/^#.*$/gm, "").split(/\s+/).filter(Boolean).length;
const plainTitle = (md) => (md.match(/^# (.*)$/m)?.[1] || "Study").replace(/^Study:\s*/, "").replace(/\*/g, "").replace(/https?:\/\/\S+/g, "").replace(/\s+/g, " ").trim();

function firstSentence(html, fallback) {
  const t = html.replace(/<[^>]+>/g, " ").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&")
    .replace(/\*+/g, "").replace(/\s+([,.;:])/g, "$1").replace(/\s+/g, " ").trim();
  let s = (t.match(/^.{40,}?[.!?](?=\s|$)/) || [t])[0];
  if (s.length > 158) s = s.slice(0, 157).replace(/\s+\S*$/, "") + ".";
  if (s.length < 70) s = `${fallback}. ${s}`.slice(0, 158);
  return s;
}

// Our measures, per image: palette chips (each hex as text) and a few values that describe the surface.
function measures(parts) {
  const surface = (parts.concepts || []).find((c) => c.label === "measured");
  if (!surface) return "";
  const pick = { palette: "Palette", "contrast p99-p1": "Contrast", "edge density": "Edge density", "dominant wavelength": "Dominant wavelength", "edge softness": "Edge softness", "mean saturation": "Mean saturation" };
  const blocks = (surface.layers || []).slice(0, 6).map((L) => {
    const props = (L.parts || []).flatMap((p) => p.properties || []).filter((p) => pick[p.property]);
    const pal = props.find((p) => p.property === "palette");
    const chips = Array.isArray(pal?.value) ? `<ul class="st-chips">${pal.value.map(([hex, share]) => `<li><span class="st-chip" style="--c:${esc(hex)}" aria-hidden="true"></span>${esc(hex)} <span class="st-share">${Math.round(share * 100)}%</span></li>`).join("")}</ul>` : "";
    const rows = props.filter((p) => p.property !== "palette" && typeof p.value === "number").map((p) => `<dt>${pick[p.property]}</dt><dd>${esc(p.value)}</dd>`).join("");
    return `<section class="st-measure" aria-label="${esc(L.name)}"><h3>${esc(L.name.replace(/^image/, "Image"))}</h3>${chips}${rows ? `<dl>${rows}</dl>` : ""}</section>`;
  });
  return blocks.length ? `<h2 id="measured">Measured</h2><div class="st-measures">${blocks.join("")}</div>` : "";
}

function conceptList(ids, concepts) {
  return `<ul class="st-concepts">${ids.map((id) => `<li>${esc(concepts.get(id)?.concept?.replace(/-/g, " ") || id.replace(/-/g, " "))}</li>`).join("")}</ul>`;
}

function credit(src) {
  const a = src?.author || {}, who = a.name && a.handle ? `${esc(a.name)} (@${esc(a.handle)})` : a.handle ? `@${esc(a.handle)}` : esc(a.name || "the creator");
  const when = src?.postedAt ? `, ${esc(src.postedAt.slice(0, 10))}` : "";
  return src?.postUrl ? `<p class="st-credit">Post by <a href="${esc(src.postUrl)}">${who}</a>${when}</p>` : `<p class="st-credit">Post by ${who}${when}</p>`;
}

function buildStudy(id, lib) {
  const dir = path.join(LIB, "studies", id), md = read(path.join(dir, "STUDY.md"));
  const secs = sections(md);
  if (secs.reduce((a, s) => a + prose(s), 0) < MIN_WORDS) return { skip: "no written prose yet (empty template)" };
  const parts = existsSync(path.join(dir, "parts.json")) ? JSON.parse(read(path.join(dir, "parts.json"))) : {};
  const unit = lib.units[id] || { concepts: [], medium: "visual" }, lane = laneOf(unit.concepts, unit.medium);
  const title = plainTitle(md);
  const body = secs.filter((s) => KEEP.has(s.n)).map((s) => `## ${s.title}\n${publicText(s.body)}`).join("\n\n");
  const html = toHTML(body, { idPrefix: "s" });
  if (/[A-Za-z]:[\\/]/.test(html)) throw new Error(`study ${id}: a drive path survived the filter`);
  const description = firstSentence(html.replace(/<h2[\s\S]*?<\/h2>/, ""), title);
  const main = `<article class="st">
<header class="st-head"><p class="st-lane">${esc(lane)}</p><h1>${esc(title)}</h1>${credit(parts.source)}</header>
${html}
${measures(parts)}
<h2 id="concepts">Concepts</h2>
${conceptList(unit.concepts, lib.concepts)}
<p class="st-back"><a href="/studies/">All studies</a></p>
</article>`;
  const rel = `studies/${id}.html`;
  writeFileSync(path.join(site, rel), page({ path: rel, title, description, body: main, robots: ROBOTS }));
  return { path: rel, title, description, lane, creator: parts.source?.author || null };
}

const slug = (k) => k.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

function boardTitle(b, studyTitles) {
  if (b.kind === "study") return studyTitles.get(b.key) || b.key;
  const name = (k) => k.replace(/-/g, " ");
  const t = b.key.split(/__|\s*\+\s*/).map(name).join(", ");
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function buildBoard(file, lib, studyTitles) {
  const b = JSON.parse(read(file));
  if (b.format !== "refdb.board/1") return { skip: `${path.basename(file)}: format ${b.format}` };
  const title = boardTitle(b, studyTitles), all = [...new Set(b.plates.flatMap((p) => p.concepts))], lane = laneOf(all, b.plates[0]?.medium);
  const plates = b.plates.map((p) => {
    const rec = lib.records.get(p.item_ids?.[0]), url = rec?.source_url && /^https?:/.test(rec.source_url) ? rec.source_url : null;
    const caption = (publicText(p.caption || "") || p.unit).replace(/https?:\/\/\S*|(?:^|\s)https?(?=\s|$)|…/g, "").replace(/\s{2,}/g, " ").replace(/\s+([).,])/g, "$1").trim();
    const head = url ? `<a href="${esc(url)}">${esc(caption)}</a>` : esc(caption);
    return `<li class="bd-plate"><span class="bd-n" aria-hidden="true">${p.n}</span><div><p class="bd-cap">${head}</p><p class="bd-medium">${esc(p.medium)}</p>${conceptList(p.concepts, lib.concepts)}</div></li>`;
  }).join("\n");
  const rh = b.running_head || {};
  const main = `<article class="bd">
<header class="bd-head"><p class="bd-run"><span>${esc(rh.left || "")}</span><span>${esc(rh.right || "")}</span></p><h1>${esc(title)}</h1>
<p class="bd-keys">${(b.keyword_line || []).map(esc).join(" ")}</p><p class="st-lane">${esc(lane)}</p></header>
<ol class="bd-plates" aria-label="Plates">
${plates}
</ol>
<p class="bd-also">Also in ${esc(b.also_in?.units ?? 0)} more units, ${esc(b.also_in?.documents ?? 0)} of them documents.</p>
<p class="st-back"><a href="/studies/">All studies</a></p>
</article>`;
  const rel = `studies/boards/${slug(b.key)}.html`;
  const description = `A study board for ${title.toLowerCase()}: ${b.plates.length} numbered plates from the reference library, each with its medium and concepts.`.slice(0, 160);
  writeFileSync(path.join(site, rel), page({ path: rel, title: `${title}, a board`, description, body: main, robots: ROBOTS }));
  return { path: rel, title: `${title}, a board`, description, lane };
}

function buildIndex(studies, boards) {
  const lanes = ["design", "research", "journalism"];
  const item = (s) => `<li><a href="/${s.path}">${esc(s.title)}</a>${s.creator?.handle ? ` <span class="st-by">@${esc(s.creator.handle)}</span>` : ""}</li>`;
  const main = `<article class="st st-index"><h1>Studies</h1>
${lanes.map((l) => { const list = studies.filter((s) => s.lane === l); return list.length ? `<section aria-labelledby="lane-${l}"><h2 id="lane-${l}">${l.charAt(0).toUpperCase() + l.slice(1)}</h2><ul class="st-list">${list.map(item).join("")}</ul></section>` : ""; }).join("\n")}
<section aria-labelledby="lane-boards"><h2 id="lane-boards">Boards</h2><ul class="st-list">${boards.map((b) => `<li><a href="/${b.path}">${esc(b.title.replace(/, a board$/, ""))}</a> <span class="st-by">${esc(b.lane)}</span></li>`).join("")}</ul></section>
</article>`;
  const rel = "studies/index.html";
  const description = `${studies.length} close readings of other people's work, measured and taken apart into layers, in design, research and journalism, with ${boards.length} boards.`;
  writeFileSync(path.join(site, rel), page({ path: rel, title: "Studies", description, body: main, robots: ROBOTS }));
  return { path: rel, title: "Studies", description };
}

function main() {
  const lib = loadLibrary();
  for (const f of existsSync(OUT) ? readdirSync(OUT) : []) if (f.endsWith(".html")) rmSync(path.join(OUT, f));
  rmSync(path.join(OUT, "boards"), { recursive: true, force: true });
  mkdirSync(path.join(OUT, "boards"), { recursive: true });
  const studies = [], skipped = [];
  for (const id of readdirSync(path.join(LIB, "studies")).filter((d) => existsSync(path.join(LIB, "studies", d, "STUDY.md"))).sort()) {
    const r = buildStudy(id, lib);
    r.skip ? skipped.push({ id, why: r.skip }) : studies.push(r);
  }
  const titles = new Map(studies.map((s) => [path.basename(s.path, ".html"), s.title]));
  const boards = readdirSync(path.join(LIB, "boards")).filter((f) => f.endsWith(".json")).sort().map((f) => buildBoard(path.join(LIB, "boards", f), lib, titles)).filter((b) => !b.skip);
  const index = buildIndex(studies, boards);
  const pages = [index, ...studies, ...boards].map((p) => ({ path: p.path, title: p.title, description: p.description, indexable: INDEXABLE,
    ...(INDEXABLE ? {} : { review: "the library records each study as private; publishing needs the author's clearance" }) }));
  writeFileSync(path.join(OUT, "pages.json"), JSON.stringify({ builtBy: "scripts/build-studies.mjs", pages, skipped }, null, 1) + "\n");
  console.log(`studies: ${studies.length} studies, ${boards.length} boards, 1 index; ${skipped.length} skipped (empty templates)`);
}
main();
