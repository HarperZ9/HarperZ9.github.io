// addresses-classify.mjs: which surface an address belongs to, and what kind of address it is.
//
// The surface comes from data the site already keeps, in this order: the six surfaces themselves; the work index
// (site-src/world/work-index.json), where every piece of work names its platform and its pages; the publication
// records, whose essays belong to Research; then the folder rules below. An address none of these place is
// "unassigned", for the author to place by hand in the ledger. A row already in the ledger is never reclassified
// here: the ledger is the record, and this module only proposes a row for an address seen for the first time.
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { SITE, SURFACES, addressOf, redirectTarget } from "./addresses-lib.mjs";

const PLATFORM = { THEPLYGRND: "playground", THECMMNS: "commons", THEFLYWHEEL: "flywheel", ARTIQL8: "articulate", BLDLNG: "buildlang", RSRCH: "research", site: "door" };
// Career documents sit under the door; they are records.
const CAREER = /^\/(cv|resume(-[a-z-]+)?|cover-letter|hire|dossier|flywheel-pilot|income-ledger|independence)\.html$/;
// Folder rules: [pattern, surface, kind].
const RULES = [
  [/^\/findings\//, "research", "record"],
  [/^\/(frontier-safety|briefings)\//, "research", "record"],
  [/^\/research-[a-z0-9-]+\.html$/, "research", "record"],
  [/^\/(studies|experiments|papers|publications|writing)\//, "research", "leaf"],
  [/^\/plugins\//, "flywheel", "record"],
  [/^\/analytics\//, "flywheel", "record"],
  [/^\/(media\/releases\/flywheel|media\/demos|demos\/crucible-cleanroom)\//, "flywheel", "leaf"],
  [/^\/(daylight-commons)\//, "commons", "leaf"],
  [/^\/night-school(-[a-z0-9-]+)?\.html$/, "commons", "leaf"],
  [/^\/(world|playground)\//, "playground", "leaf"],
  [/^\/(media\/raw-native|media\/releases\/raw-native)\//, "playground", "leaf"],
];

function workIndex(site) {
  const file = path.join(site, "site-src/world/work-index.json"), seen = new Map();
  if (!existsSync(file)) return seen;
  for (const e of JSON.parse(readFileSync(file, "utf8")).entries) {
    const surface = PLATFORM[e.platform];
    for (const p of e.pages || []) {
      const a = addressOf(p);
      if (!surface) { if (!seen.has(a)) seen.set(a, null); continue; }
      // a page listed under two platforms is left for the author to place
      seen.set(a, seen.has(a) && seen.get(a) !== null && seen.get(a) !== surface ? "unassigned" : surface);
    }
  }
  return seen;
}
function essays(site) {
  const dir = path.join(site, "publications/data/records"), out = new Set();
  if (!existsSync(dir)) return out;
  for (const f of readdirSync(dir).filter((n) => n.endsWith(".json"))) {
    const route = JSON.parse(readFileSync(path.join(dir, f), "utf8")).route;
    if (route) out.add(addressOf(route.replace(/^\//, "")));
  }
  for (const f of readdirSync(path.join(site, "publications/data/listings")).filter((n) => n.endsWith(".json"))) out.add(`/${f.replace(/\.json$/, ".html")}`);
  return out;
}

export function classifier(site = SITE) {
  const work = workIndex(site), essay = essays(site), surfaceAt = new Map(SURFACES.map((s) => [s.path, s.id]));
  function place(address) {
    if (surfaceAt.has(address)) return { kind: "surface", surface: surfaceAt.get(address) };
    if (CAREER.test(address)) return { kind: "record", surface: "door" };
    if (essay.has(address)) return { kind: "record", surface: "research" };
    const rule = RULES.find(([re]) => re.test(address));
    // a sample output and an explainer take the surface of the tool they show
    const tool = /^\/(?:repo-explainers\/)?([a-z0-9-]+?)(?:-sample)?\.html$/.exec(address);
    const listed = work.get(address) || (tool && (work.get(`/${tool[1]}.html`) || work.get(`/repo-explainers/${tool[1]}.html`)));
    if (listed) return { kind: rule && rule[1] === listed ? rule[2] : "leaf", surface: listed };
    if (rule) return { kind: rule[2], surface: rule[1] };
    return { kind: "leaf", surface: "unassigned" };
  }
  // classify(address, html) -> { kind, surface, to? }. A redirect stub takes the surface of the page it leads to.
  return function classify(address, html = "") {
    const [page, frag] = address.split("#");
    const to = frag ? null : redirectTarget(html, address);
    if (!to) return place(page);
    const own = place(page), target = place(to.split("#")[0]);
    const surface = own.surface !== "unassigned" ? own.surface : target.surface;
    return { kind: "redirect", surface, to };
  };
}
