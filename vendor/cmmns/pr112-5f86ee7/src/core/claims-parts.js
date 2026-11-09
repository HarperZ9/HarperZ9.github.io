// The fact-check table (src/ext/claims.json) ships in parts: the Firefox add-on linter refuses to
// read any file over 5 MB, and AMO will not sign a package it cannot read. claims.json keeps the
// header and the first rows and names the other parts in `parts`; each part is { rows }.

const bytes = (x) => new TextEncoder().encode(JSON.stringify(x)).length;
export const CLAIMS_PART_MAX = 4500000;   // bytes per file, under the linter's 5 MB

// [main, part2, part3, ...] for a table; one file when it fits.
export function splitClaims(table, max = CLAIMS_PART_MAX) {
  if (bytes(table) <= max) return [table];
  const { rows, ...head } = table;
  const groups = [[]];
  let size = bytes({ ...head, rows: [], parts: [] }) + 64;
  for (const r of rows) {
    const n = bytes(r) + 1;
    if (size + n > max && groups[groups.length - 1].length) { groups.push([]); size = 16; }
    groups[groups.length - 1].push(r);
    size += n;
  }
  const parts = groups.slice(1).map((_, i) => `claims-${i + 2}.json`);
  return [{ ...head, parts, rows: groups[0] }, ...groups.slice(1).map((g) => ({ rows: g }))];
}

// The whole table again, from the main file and its parts in order.
export function joinClaims(main, parts = []) {
  const { parts: names, rows, ...head } = main;
  return { ...head, rows: [...rows, ...parts.flatMap((p) => p.rows)] };
}
