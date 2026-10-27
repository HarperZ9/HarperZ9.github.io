// import-extras.mjs: the two importer steps that are not plain copies.
//
// syncAccession  copies the Accession release folder whole (the typeface's INSTALL.md: "Copy dist/release/ as a
//                whole"; the paths inside accession.css are relative to it) to system/fonts/accession, and
//                refreshes every imported fonts/accession copy from it. The SIL OFL 1.1 text travels with the
//                fonts; a release without OFL.txt is reported, since the fonts must not ship without it.
// elementThumbs  the element table's reference thumbnails (the author, 2026-10-26: "Publish the 83 reference
//                thumbnails on the site with credit and links"). A thumbnail ships only when its record has a
//                title, a creator credit and a public link; the rest lose the thumbnail and are listed.
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";

function copyTree(from, to) {
  for (const f of readdirSync(from, { withFileTypes: true })) {
    const a = path.join(from, f.name), b = path.join(to, f.name);
    if (f.isDirectory()) copyTree(a, b);
    else { mkdirSync(to, { recursive: true }); copyFileSync(a, b); }
  }
}

export function syncAccession({ cfg, SRC, site, manifest, dry }) {
  const a = cfg.accession; if (!a) return { targets: 0, licence: false };
  const from = path.join(SRC, a.from);
  if (!existsSync(from)) { console.warn(`import: Accession release ${a.from} not found`); return { targets: 0, licence: false }; }
  const licence = existsSync(path.join(from, a.licence || "OFL.txt"));
  if (!licence) console.warn(`import: ${a.from} has no ${a.licence}; the fonts must ship with their licence text`);
  const copies = new Set(manifest.filter((m) => m.path.includes("/fonts/accession/")).map((m) => m.path.slice(0, m.path.indexOf("/fonts/accession/") + 17)));
  const targets = [a.to, ...copies].map((t) => path.join(site, t));
  if (!dry) for (const t of targets) { rmSync(t, { recursive: true, force: true }); copyTree(from, t); }
  return { targets: targets.length, licence };
}

export function elementThumbs({ cfg, SRC, OUT, folders, dry }) {
  const e = cfg.elements; if (!e) return { kept: 0, withheld: [] };
  const top = e.json.split("/")[0], local = path.join(OUT, folders[top], e.json.slice(top.length + 1));
  if (!existsSync(local)) return { kept: 0, withheld: [] };
  const data = JSON.parse(readFileSync(local, "utf8")), kept = new Set(), withheld = new Map();
  for (const el of data.elements || []) for (const r of el.refs || []) {
    if (!r.thumb) continue;
    const ok = /^https:\/\//.test(r.source || "") && (r.creator || "").trim() && (r.title || "").trim();
    if (ok) kept.add(r.thumb); else { withheld.set(r.thumb, { title: r.title || null, creator: r.creator || null, source: r.source || null }); delete r.thumb; }
  }
  if (!dry) {
    writeFileSync(local, JSON.stringify(data));
    const base = path.join(SRC, e.thumbs), dest = path.join(OUT, folders[top], e.thumbs.slice(top.length + 1));
    for (const t of kept) {
      const src = path.join(base, t);
      if (existsSync(src) && statSync(src).isFile()) { mkdirSync(path.dirname(path.join(dest, t)), { recursive: true }); copyFileSync(src, path.join(dest, t)); }
      else withheld.set(t, { missing: true });
    }
  }
  return { kept: kept.size, withheld: [...withheld].map(([thumb, why]) => ({ thumb, ...why })) };
}

// A universe place whose landing page was held back (import config "hold") lands nowhere rather than on a missing
// page: its land is cleared in the imported universe.json, and the map then offers its live page or nothing.
export function pruneLands({ OUT, dry }) {
  const f = path.join(OUT, "universe", "universe.json"); if (!existsSync(f)) return [];
  const u = JSON.parse(readFileSync(f, "utf8")), cleared = [];
  for (const n of u.nodes || []) if (n.land && !existsSync(path.join(OUT, n.land))) { cleared.push(`${n.id}: ${n.land}`); n.land = null; }
  if (cleared.length && !dry) writeFileSync(f, JSON.stringify(u));
  return cleared;
}
