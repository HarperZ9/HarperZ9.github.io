// findings-parts.mjs: what the findings pages share. Reading a write-up, its tier, its domains, the tier glyph and
// the plate figure. scripts/build-findings.mjs puts these together into findings/index.html and one page per finding.
import { esc } from "./studies-markdown.mjs";
import { LANE_MARKS } from "./marks/lane-marks.mjs";

// The register's tiers as a reader meets them. Each is told apart by its drawn glyph and its word, never by colour.
export const TIERS = {
  "A": { key: "candidate", label: "Publication candidate", order: 0, blurb: "a clean design, controls and a literature check, ready to submit" },
  "B*": { key: "strong", label: "Strong signal", order: 1, blurb: "real data, working controls and a result that held, with a named next test" },
  "B": { key: "signal", label: "Signal", order: 2, blurb: "a real effect on real data or a sharp known-answer test, with clear limits" },
  "D": { key: "null", label: "Honest null", order: 3, blurb: "a test that failed, a claim that did not hold, or our own error found and fixed" },
};

// The experiments page's domains (tools/experiments/select.py), so a reader meets one set of fields across the site.
export const DOMAINS = [
  ["method", "Method and statistics", /method|statistic|metascience|forecast|verification|reproduc|psychometric|causal|replication|evaluation/],
  ["physics", "Physics", /physics|mechanic|fluid|wave|quantum|nuclear|astronom|flight|fracture|geophys|thermo/],
  ["information", "Information and signal", /information|signal|compression|coding|cybernetic|disinformation|entropy/],
  ["instruments", "Instruments and control", /instrument|metrolog|sensor|valve|control|electronic|calibrat|transduc/],
  ["ai", "AI and machine learning", /\bai\b|interpretab|agent|model architecture|machine learning|neural/],
  ["optics", "Optics, colour and imaging", /optic|colour|color|film|imaging|spectro|photon|lens/],
  ["computing", "Computing and mathematics", /cs-|systems|graph|complexity|matri|mathemat|network/],
  ["ecology", "Plants, trees and earth", /plant|tree|forest|fung|myc|ecolog|climate|earth|wood/],
  ["biology", "Biology and medicine", /biolog|neuro|physiolog|medicin|evolution|biomechan/],
  ["psychology", "Psychology and perception", /psycholog|cognit|percept|human-stud|mood/],
  ["society", "Society and economics", /econom|sociolog|politic|law|governance|institution/],
  ["history", "History of science", /history|philosoph/],
  ["materials", "Materials and chemistry", /material|composite|chemi|polymer/],
  ["rendering", "Rendering and design", /render|design|typograph|visualis|graphics/],
  ["language", "Language and literature", /linguist|literat|language|reading/],
  ["sound", "Music and sound", /music|acoustic|sound/],
];
export const domainLabel = (id) => (DOMAINS.find(([d]) => d === id) || [, id])[1];
export function domainsOf(fields) {
  const out = [];
  for (const f of fields) for (const [id, , rx] of DOMAINS) if (rx.test(f) && !out.includes(id)) out.push(id);
  return out.length ? out : ["method"];
}

// One write-up: the front block (key: value, lists as [a, b]) and the Markdown body, split into its sections.
export function readWriteup(text, file) {
  const m = text.replace(/\r/g, "").match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!m) throw new Error(`${file}: no front block`);
  const front = {};
  for (const line of m[1].split("\n")) {
    const kv = line.match(/^([a-z_]+):\s*(.*)$/);
    if (!kv) continue;
    const v = kv[2].replace(/\s+#.*$/, "").trim();
    front[kv[1]] = /^\[.*\]$/.test(v) ? v.slice(1, -1).split(",").map((s) => s.trim()).filter(Boolean) : v;
  }
  if (!TIERS[front.tier]) throw new Error(`${file}: unknown tier ${front.tier}`);
  const sections = {};
  for (const part of m[2].split(/^## /m).slice(1)) { const nl = part.indexOf("\n"); sections[part.slice(0, nl).trim()] = part.slice(nl + 1).trim(); }
  const n = parseInt(front.id.slice(1), 10);
  return { ...front, n, tierInfo: TIERS[front.tier], domains: domainsOf(front.fields || []), sections, file };
}

// The tier glyph: strong is a filled disc, signal a ring, null a ring struck through, candidate a filled square.
export function glyph(tier, size = 14, cls = "fd-glyph") {
  const k = TIERS[tier].key, r = 5.2;
  const shape = {
    candidate: `<rect x="2" y="2" width="10" height="10" fill="currentColor"/>`,
    strong: `<circle cx="7" cy="7" r="${r}" fill="currentColor"/>`,
    signal: `<circle cx="7" cy="7" r="${r - .8}" fill="none" stroke="currentColor" stroke-width="1.6"/>`,
    null: `<circle cx="7" cy="7" r="${r - .8}" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M2.6 11.4 11.4 2.6" stroke="currentColor" stroke-width="1.6"/>`,
  }[k];
  return `<svg class="${cls}" width="${size}" height="${size}" viewBox="0 0 14 14" aria-hidden="true" focusable="false">${shape}</svg>`;
}

// each domain's drawn mark from the shared lanes sprite; the word beside it carries the meaning
export const laneMark = (id, cls = "xc-lane", size = 18) => LANE_MARKS[id] ? `<img class="${cls}" src="/media/world/icons/lanes.svg#${id}" width="${size}" height="${size}" alt="" loading="lazy" decoding="async">` : "";

// A period plate beside a physics or systems finding, credited, with the theory it was drawn for named plainly.
export function plate(fig, figures) {
  if (!fig) return "";
  const base = `/media/findings/traxler/traxler-1889-leaf-${fig.leaf}`;
  return `<figure class="fd-plate">
  <img src="${base}-720.webp" srcset="${base}-720.webp 720w, ${base}-1440.webp 1440w" sizes="(max-width: 760px) 92vw, 680px" width="${fig.width}" height="${fig.height}" alt="${esc(fig.alt)}" loading="lazy" decoding="async">
  <figcaption>${esc(fig.caption)} <span class="fd-credit">${esc(figures.credit)} ${esc(figures.theory_note)}</span></figcaption>
</figure>`;
}
