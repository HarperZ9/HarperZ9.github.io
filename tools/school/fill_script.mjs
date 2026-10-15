// Fill a Night School lesson's script from its facts: every {{path|format}} token in
// media/school/<slug>/film.template.json is read from media/school/<slug>/facts.json (or, with a
// "file:" prefix in the path, from another lesson's facts), so no number in a film is typed by hand.
//
//   node tools/school/fill_script.mjs vectors
//
// path: dotted keys into facts.json, e.g. measurements.wte.top1 or neighbours.wte.kettle.
// format: pct (0.804 -> "80"), pct1 (0.9975 -> "99.8"), int, f2, f4, words3 (the first three .word values, spoken as
// "map, shell and crate"), or none (the value as it is). An unknown path or format is an error,
// and so is any token left unfilled.
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const SCHOOL = join(ROOT, "media", "school");

const and = (xs) => (xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs.at(-1)}`);
export const FORMATS = {
  pct: (v) => String(Math.round(v * 100)),
  pct1: (v) => (v * 100).toFixed(1),
  int: (v) => Math.round(v).toLocaleString("en"),
  f2: (v) => v.toFixed(2),
  f4: (v) => v.toFixed(4),
  words3: (v) => and(v.slice(0, 3).map((x) => x.word)),
  none: (v) => String(v),
};

// A key may itself hold a dot (decoding's "t0.5", "p0.9"): at each step the longest run of
// segments that names a key wins.
export function lookup(facts, path) {
  const parts = path.split(".");
  let v = facts;
  for (let i = 0; i < parts.length;) {
    if (v === null || typeof v !== "object") throw new Error(`no value at ${path}`);
    let j = parts.length;
    while (j > i && !(parts.slice(i, j).join(".") in v)) j--;
    if (j === i) throw new Error(`no value at ${path}`);
    v = v[parts.slice(i, j).join(".")]; i = j;
  }
  return v;
}

export function fill(template, factsFor) {
  return template.replace(/\{\{([^}|]+)(?:\|(\w+))?\}\}/g, (_, path, fmt = "none") => {
    const [slug, p] = path.includes(":") ? path.split(":") : [null, path];
    if (!(fmt in FORMATS)) throw new Error(`unknown format ${fmt} in {{${path}|${fmt}}}`);
    return FORMATS[fmt](lookup(factsFor(slug), p.trim()));
  });
}

function main(slug) {
  const dir = join(SCHOOL, slug), cache = new Map();
  const factsFor = (s) => { const k = s || slug; if (!cache.has(k)) cache.set(k, JSON.parse(readFileSync(join(SCHOOL, k, "facts.json"), "utf8"))); return cache.get(k); };
  const film = fill(readFileSync(join(dir, "film.template.json"), "utf8"), factsFor);
  if (/\{\{/.test(film)) throw new Error("a token was left unfilled");
  JSON.parse(film);
  writeFileSync(join(dir, "film.json"), film);
  console.log(`media/school/${slug}/film.json written`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main(process.argv[2]);
