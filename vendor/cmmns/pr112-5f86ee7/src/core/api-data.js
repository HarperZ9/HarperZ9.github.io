// The tables the radar-core API reads, handed in by the caller. The API never fetches or opens a
// file itself: the CLI reads them from disk, the extension from its own package. Each table is
// optional; evidence that needs a missing table is left out, never guessed.
//   sites   src/ext/sites.json   (Wikidata facts and fact-check records per site)
//   owners  src/ext/owners.json  (Wikidata ownership rows)
//   state   src/ext/state.json   (state links, each citing its source)
//   claims  src/ext/claims.json, joined with its parts (the fact-check table)

import { setSiteTable } from "./sites.js";
import { setOwnerRows } from "./owners.js";
import { setStateRows } from "./state.js";
import { buildClaimIndex } from "./claims.js";
import { joinClaims } from "./claims-parts.js";

let CLAIM_INDEX = null;
const rowsOf = (t) => (Array.isArray(t) ? t : (t && t.rows) || []);
const LOADED = { sites: 0, owners: 0, state: 0, claims: 0 };

// tables: { sites?, owners?, state?, claims?, claimParts? }, each as its file holds it (owners and
// state may also be plain row arrays). Returns how many rows each table holds.
export function useData(tables = {}) {
  if (tables.sites) LOADED.sites = setSiteTable(tables.sites);
  if (tables.owners) LOADED.owners = setOwnerRows(rowsOf(tables.owners));
  if (tables.state) { setStateRows(rowsOf(tables.state)); LOADED.state = rowsOf(tables.state).length; }
  if (tables.claims) {
    CLAIM_INDEX = buildClaimIndex(joinClaims(tables.claims, tables.claimParts || []));
    LOADED.claims = CLAIM_INDEX.n;
  }
  return { ...LOADED };
}

export const claimIndex = () => CLAIM_INDEX;
export const dataLoaded = () => ({ ...LOADED });
