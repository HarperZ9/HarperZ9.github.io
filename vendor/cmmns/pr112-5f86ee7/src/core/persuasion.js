// Persuasion techniques at the span level, after the SemEval-2020 Task 11 taxonomy (Da San Martino
// et al., the Propaganda Techniques Corpus) and SemEval-2023 Task 3. Each technique is a list of
// cues: short lexical or grammatical patterns that name no group, person, party or side. A cue
// says how a post argues. It never says whether the post is true or who wrote it.
// The cue lists in persuasion-cues.js were tuned on the PTC dev split only; the measured test
// precision in measured.js (MEASURED_PERSUASION) decides which techniques the window shows.
// A technique sign is evidence about one post's argument. It is never an account flag and never
// counts toward "flagged".

import { CUES_EN, CUES_FR } from "./persuasion-cues.js";
import { MEASURED_PERSUASION } from "./measured.js";

// Definitions follow the SemEval task guidelines, shortened to one line each.
export const TECHNIQUES = {
  "loaded-language": { name: "Loaded language", definition: "Strong emotional words that push the reader to feel a certain way. Look for words that judge instead of describe." },
  "name-calling": { name: "Name calling", definition: "A label or insult for a person or group. The label takes the place of a reason." },
  "bandwagon": { name: "Bandwagon", definition: "Tells the reader to agree because many people agree. Look for \"everyone knows\" or \"millions agree\"." },
  "appeal-to-fear": { name: "Appeal to fear", definition: "Makes the reader afraid of a result, to win support for an idea. Look for a threat that follows a choice." },
  "flag-waving": { name: "Flag-waving", definition: "Uses love of country or group to support a position. Look for the nation or the group as the reason." },
  "thought-terminating": { name: "Thought-terminating cliche", definition: "A stock phrase that ends the talk. It replaces an answer with a slogan." },
  "whataboutism": { name: "Whataboutism", definition: "Answers a criticism with the other side's conduct. Look for \"what about\" after a charge." },
  "black-and-white": { name: "Black-and-white fallacy", definition: "Gives two options as the full set. Other options exist." },
  "doubt": { name: "Doubt", definition: "Casts doubt on a person or a source by hint. Look for a question about trust, with the facts left out." },
  "appeal-to-authority": { name: "Appeal to authority", definition: "Says a claim is true because an expert backs it. The expert has no name or is a general group." },
  "exaggeration": { name: "Exaggeration", definition: "Makes something seem much larger, worse or more extreme than it is. Look for words like \"total\" and \"every\"." },
  "motive-attribution": { name: "Hidden motive", definition: "Says a person hides a secret aim behind their words. The post gives the aim and skips the evidence." },
  "just-asking": { name: "Just asking questions", definition: "Puts an accusation in the form of a question. The post suggests the charge and leaves it unclaimed." },
};

export const PERSUASION_DOES_NOT_PROVE = "A technique can carry a true claim; it describes how the post argues.";
// Ship rule: a technique shows only when its held-out precision is at least SHIP_PRECISION and its
// 95% interval starts at SHIP_LOW or above, from at least SHIP_MIN_N hits. Published systems reach
// F1 of about 30 to 44 on these techniques (SemEval-2023 Task 3; Jose and Greenstadt 2025), where a
// confident label is wrong more often than right, so the bar is on precision, not on F1.
export const SHIP_PRECISION = 0.8;
export const SHIP_LOW = 0.7;
export const SHIP_MIN_N = 20;
// Techniques that need the context of a whole exchange (what was said before, what the other side
// did) are never shown on a single reply, whatever a measurement says. Published detectors score
// near zero on them.
export const CONTEXT_ONLY = new Set(["whataboutism"]);

// A cue is a regex fragment, or { cue, caseSensitive } for the few that need capitals.
const EDGE = { en: ["(?<![\\w'])", "(?![\\w'])", ""], fr: ["(?<![\\p{L}\\p{N}_'])", "(?![\\p{L}\\p{N}_])", "u"] };
function compile(technique, c, lang) {
  const { cue, caseSensitive } = typeof c === "string" ? { cue: c } : c;
  const [b, e, u] = EDGE[lang];
  return { technique, cue, lang, re: new RegExp(`${b}(?:${cue})${e}`, (caseSensitive ? "g" : "gi") + u) };
}
const RULES = [["en", CUES_EN], ["fr", CUES_FR]].flatMap(([lang, cues]) =>
  Object.entries(cues).flatMap(([t, list]) => list.map((c) => compile(t, c, lang))));

// Every cue match as { technique, match, start, end, cue, lang }, overlapping matches of one
// technique merged into the first. `text` is used as given, so offsets index into it.
export function techniqueSpans(text) {
  // The curly apostrophe is one code unit, like "'", so offsets stay the same.
  const s = String(text || "").replace(/[’]/g, "'");
  const hits = [];
  for (const r of RULES) {
    r.re.lastIndex = 0;
    for (const m of s.matchAll(r.re)) hits.push({ technique: r.technique, match: m[0], start: m.index, end: m.index + m[0].length, cue: r.cue, lang: r.lang });
  }
  hits.sort((a, b) => a.start - b.start || b.end - a.end);
  const out = [];
  for (const h of hits) {
    if (out.some((o) => o.technique === h.technique && h.start < o.end && o.start < h.end)) continue;
    out.push(h);
  }
  return out;
}

const pc = (x) => Math.round(x * 100);
const ships = (r) => r && r.split === "test" && Number.isInteger(r.n) && r.n >= SHIP_MIN_N && Number.isFinite(r.low) && r.low >= SHIP_LOW
  && Number.isFinite(r.precision) && r.precision >= SHIP_PRECISION;

// The techniques the window may show.
export function shownTechniques(table = MEASURED_PERSUASION) {
  return Object.keys(TECHNIQUES).filter((t) => !CONTEXT_ONLY.has(t) && ships((table || {})[t]));
}

// { shown, text } for one technique: its measured line, or why it is held back.
export function techniqueStatus(id, table = MEASURED_PERSUASION) {
  const r = (table || {})[id];
  if (CONTEXT_ONLY.has(id)) return { shown: false, text: "held back: needs the whole exchange, so it waits for a full thread" };
  if (!r || !Number.isInteger(r.n) || !r.n) return { shown: false, text: "held back: not measured" };
  const m = `precision ${pc(r.precision)}% (95% interval ${pc(r.low)} to ${pc(r.high)}%), ${r.n} spans checked, held-out news articles`;
  if (ships(r)) return { shown: true, text: m };
  const why = r.n < SHIP_MIN_N ? `fewer than ${SHIP_MIN_N} hits` : r.precision < SHIP_PRECISION ? `precision under ${pc(SHIP_PRECISION)}%` : `interval starts below ${pc(SHIP_LOW)}%`;
  return { shown: false, text: `held back (${why}): ${m}` };
}

// One entry per shown technique in a post: { technique, name, definition, match, lang }.
export function persuasion(text, shown = shownTechniques()) {
  const on = new Set(shown), seen = new Set(), out = [];
  for (const h of techniqueSpans(text)) {
    if (!on.has(h.technique) || seen.has(h.technique)) continue;
    seen.add(h.technique);
    out.push({ technique: h.technique, ...TECHNIQUES[h.technique], match: h.match.trim().slice(0, 80), lang: h.lang });
  }
  return out;
}
