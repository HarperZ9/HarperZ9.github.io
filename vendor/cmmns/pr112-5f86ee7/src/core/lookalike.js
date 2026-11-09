// Look-alike news domains: a weak sign that a link copies the name of a major outlet, the way the
// Doppelganger and Endless Mayfly operations did (washingtonpost.pm, spiegel.ltd, theguaradian.com).
// Three patterns, each against the outlets in lookalike-outlets.js:
//   ending swap   the outlet's own name on an ending it does not use (washingtonpost.pm, bild.pics)
//   misspelling   one letter added, dropped, changed or two swapped (theatlatnic.com, speigel.net)
//   look-alike letters  an internationalised name whose letters only look like the outlet's
// An outlet's own domains and their subdomains never match. The sign is about the address, never
// about who posted it: real people share these links, often to warn others.
import { OUTLETS, UNRELATED_REAL } from "./lookalike-outlets.js";
import { TO_LATIN } from "./confusables-data.js";

// Second-level endings run by a country registry. Anything else with a dot (co.com, eu.com) is a
// private registry that sells look-alike endings and counts as a swapped ending.
const CC2 = /^(co|com|org|net|ac|gov|edu|or|ne|go|in|info|biz|news|ltd|plc|me)\.[a-z]{2}$/;
// Country endings that are sold as generic ones.
const GENERIC_CC = new Set(["pm", "ws", "me", "co", "cc", "tv", "io", "to", "nu", "la", "ai", "gg", "ly", "su", "fm", "am", "cx", "bz", "wf", "pw", "so"]);
// Private second-level endings sold to anyone, which look like a country's.
const PRIVATE2 = new Set(["co.com", "eu.com", "us.com", "uk.com", "de.com", "gb.com", "br.com", "cn.com", "ru.com", "sa.com", "za.com", "jpn.com", "in.net", "us.org"]);
const COMMON = new Set(["com", "net", "org"]);
const norm = (s) => s.replace(/-/g, "").replace(/vv/g, "w");

const LATIN = (() => { const a = [...TO_LATIN], m = new Map(); for (let i = 0; i + 1 < a.length; i += 2) m.set(a[i], a[i + 1]); return m; })();

// RFC 3492 decoding of one "xn--" label; null when it is not valid.
export function punyDecode(label) {
  if (!/^xn--/.test(label)) return label;
  const s = label.slice(4), base = 36, tmin = 1, tmax = 26, skew = 38, damp = 700;
  const cut = s.lastIndexOf("-"), out = cut > 0 ? [...s.slice(0, cut)] : [];
  let n = 128, i = 0, bias = 72, p = cut > 0 ? cut + 1 : 0;
  const digit = (c) => (c >= 48 && c < 58 ? c - 22 : c >= 97 && c < 123 ? c - 97 : 36);
  const adapt = (delta, len, first) => {
    delta = first ? Math.floor(delta / damp) : delta >> 1; delta += Math.floor(delta / len);
    let k = 0; for (; delta > ((base - tmin) * tmax) >> 1; k += base) delta = Math.floor(delta / (base - tmin));
    return k + Math.floor(((base - tmin + 1) * delta) / (delta + skew));
  };
  while (p < s.length) {
    const old = i;
    for (let w = 1, k = base; ; k += base) {
      if (p >= s.length) return null;
      const d = digit(s.charCodeAt(p++));
      if (d >= base) return null;
      i += d * w;
      const t = k <= bias ? tmin : k >= bias + tmax ? tmax : k - bias;
      if (d < t) break;
      w *= base - t;
    }
    bias = adapt(i - old, out.length + 1, old === 0);
    n += Math.floor(i / (out.length + 1)); i %= out.length + 1;
    out.splice(i++, 0, String.fromCodePoint(n));
  }
  return out.join("");
}

// A label in plain Latin letters: look-alike letters mapped, accents dropped.
function plain(label) {
  const u = punyDecode(label);
  if (u == null) return label;
  return [...u].map((c) => LATIN.get(c) || c).join("").normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

// How two names differ by one edit, or null: "swap" (two neighbours swapped), "change" (one letter
// changed), "extra" or "missing" (one letter added or dropped), "double" (a letter doubled).
export function oneEdit(a, b) {
  if (a === b || Math.abs(a.length - b.length) > 1) return null;
  let i = 0;
  while (i < a.length && a[i] === b[i]) i++;
  if (a.length === b.length) {
    if (a[i] === b[i + 1] && a[i + 1] === b[i] && a.slice(i + 2) === b.slice(i + 2)) return "swap";
    return a.slice(i + 1) === b.slice(i + 1) ? "change" : null;
  }
  const [long, short] = a.length > b.length ? [a, b] : [b, a];
  if (long.slice(i + 1) !== short.slice(i)) return null;
  if (long[i] === long[i - 1] || long[i] === long[i + 1]) return a.length > b.length ? "double" : "missing";
  return a.length > b.length ? "extra" : "missing";
}
// The shortest outlet name each kind of edit is checked on. Shorter names collide with real outlets
// (nypost and kypost, usatoday and uatoday, apnews and panews), found by the control in tests/lookalike.test.js.
const MIN_EDIT = { swap: 7, double: 4, change: 9, extra: 9, missing: 9 };

// The name part and the ending of a host: "theguardian.co.com" gives ["theguardian", "co.com"].
export function splitHost(host) {
  const parts = host.split("."), two = parts.slice(-2).join(".");
  const k = parts.length > 2 && (CC2.test(two) || PRIVATE2.has(two)) ? 2 : 1;
  return [parts[parts.length - k - 1] || "", parts.slice(-k).join(".")];
}

const own = (host, o) => o.domains.some((d) => host === d || host.endsWith("." + d));
// The outlet's own names: from its domains that have no subdomain ("abcnews.go.com" gives none).
const nameOf = (d) => { const [label, ending] = splitHost(d); return d === `${label}.${ending}` ? label : null; };
const INDEX = OUTLETS.map((o) => ({ o, names: new Set(o.domains.map(nameOf).filter(Boolean).map(norm)), aliases: new Set(o.aliases.map(norm)) }));
const KNOWN = new Set([...OUTLETS.flatMap((o) => o.domains), ...UNRELATED_REAL]);

function endingSwapped(ending, brand) {
  if (COMMON.has(ending)) return brand.length >= 8;
  if (/^[a-z]{2}$/.test(ending)) return GENERIC_CC.has(ending);
  if (CC2.test(ending)) return false;
  return true;
}

// { outlet, official, how } for a look-alike of a listed outlet, or null.
export function lookalikeOf(domain) {
  const host = String(domain || "").toLowerCase().replace(/^www\./, "").replace(/\.$/, "");
  if (!host.includes(".") || KNOWN.has(host) || UNRELATED_REAL.some((d) => host.endsWith("." + d))) return null;
  const [label, ending] = splitHost(host);
  const name = norm(plain(label)), puny = /^xn--/.test(label);
  for (const { o, names, aliases } of INDEX) {
    if (own(host, o)) return null;
    const hit = (how) => ({ outlet: o.name, official: o.domains[0], how });
    if (aliases.has(name)) return hit("copies the name");
    if (names.has(name)) {
      if (puny) return hit("look-alike letters");
      if (!o.generic && name.length >= 3 && endingSwapped(ending, name)) return hit("swapped ending");
      continue;
    }
    for (const n of names) {
      const kind = oneEdit(name, n);
      // A short name doubled on a sold ending (bildd.lol) counts; on .com it is often a real site.
      if (kind && n.length >= MIN_EDIT[kind] && (kind !== "double" || n.length >= 6 || endingSwapped(ending, n))) return hit(puny ? "look-alike letters" : "misspelling");
    }
  }
  return null;
}

export const LOOKALIKE_DOES_NOT_PROVE = "An address similar to a known outlet's. Outlets use other addresses too, and unrelated sites share common words, so open the outlet's own site and compare.";
