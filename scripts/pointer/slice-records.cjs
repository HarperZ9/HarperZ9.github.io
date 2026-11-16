#!/usr/bin/env node
// Copy the material records the pointer is made of, and the CIE tables it is coloured with, out of The Playground's
// materials package into site-src/pointer/records.json. Run once when the records change; the pointer's build reads
// only the slice, so the site needs no checkout of the engine.
//
//   node scripts/pointer/slice-records.cjs <superframe checkout> <commit>
//
// The records are measurements (refractiveindex.info, CC0 1.0). The CIE tables are CC BY-SA 4.0 and keep that
// licence and their credit in the slice.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const [repo, commit] = process.argv.slice(2);
if (!repo || !commit) { console.error('usage: slice-records.cjs <superframe checkout> <commit>'); process.exit(2); }
const show = (p) => execFileSync('git', ['-C', repo, 'show', `${commit}:${p}`], { maxBuffer: 64 << 20 });
const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');

const IDS = ['rhodium', 'gold', 'silver', 'iridium', 'pmma', 'rhodamine_6g', 'lamp_black', 'pedot_pss'];
const recP = 'packages/materials/data/materials.json', cmfP = 'packages/materials/data/cie/CIE_xyz_1931_2deg.csv', d65P = 'packages/materials/data/cie/CIE_std_illum_D65.csv';
const recB = show(recP), cmfB = show(cmfP), d65B = show(d65P);
const all = JSON.parse(recB.toString('utf8'));
const grid = all.grid_nm;
const rows = (b) => Object.fromEntries(b.toString('utf8').trim().split(/\r?\n/).map((l) => { const [w, ...v] = l.split(',').map(Number); return [w, v]; }));
const cmf = rows(cmfB), d65 = rows(d65B);
const pick = (f) => f && { value: f.value, source: f.source, licence: f.licence, confidence: f.confidence, ...(f.extrapolated_nm ? { extrapolated_nm: f.extrapolated_nm } : {}), note: f.note };
const records = IDS.map((id) => {
  const r = all.materials.find((m) => m.id === id);
  if (!r) throw new Error(`no record ${id} at ${commit}`);
  return { id, name: r.name, class: r.class, conductor: !!r.optics.conductor, n: pick(r.optics.n), k: pick(r.optics.k) };
});
const out = {
  about: 'Material records and CIE tables for the site pointer, sliced from The Playground materials package. Written by scripts/pointer/slice-records.cjs; do not edit by hand.',
  source: { repo: 'HarperZ9/superframe', commit, files: { [recP]: sha(recB), [cmfP]: sha(cmfB), [d65P]: sha(d65B) } },
  grid_nm: grid,
  cie: {
    licence: 'CC-BY-SA-4.0',
    credit: 'CIE 1931 2 degree colour-matching functions (CIE 018:2019, Table 6, DOI 10.25039/CIE.DS.xvudnb9b) and CIE standard illuminant D65 (ISO/CIE 11664-2:2022, Table B.1), International Commission on Illumination (CIE), sampled at 5 nm.',
    xyz_bar: grid.map((w) => cmf[w]),
    d65: grid.map((w) => d65[w][0]),
  },
  records,
};
const file = path.join(__dirname, '../../site-src/pointer/records.json');
fs.mkdirSync(path.dirname(file), { recursive: true });
fs.writeFileSync(file, JSON.stringify(out) + '\n');
console.log(`pointer records: ${records.length} materials from ${commit.slice(0, 9)}`);
