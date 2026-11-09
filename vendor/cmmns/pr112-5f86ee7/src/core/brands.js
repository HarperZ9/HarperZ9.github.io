// Brand look-alike accounts: a display name or handle that borrows a platform's or a major
// outlet's brand ("X Global", "BBC Breaking") on an account that is not one of that brand's own.
// Weak flag tier: context, never a verdict, and alone it never counts toward "flagged".
//
// The brand list is curated. Each entry names its Wikidata item, and `handles` are the X usernames
// that item lists (Wikidata property P2002, queried 2026-10-21). That list is incomplete, so the
// platform's own data comes first: X's affiliation badge for the brand, an organisation or
// government check, or X's parody, commentary or fan label each clear the flag.
//
// A name only counts when it carries the brand plus a word that makes it read as the brand's own
// voice ("breaking", "live", "support", "official"), or is the brand name alone. Fans, critics and
// archive accounts that say so ("fan", "parody", "not affiliated") are left alone.

import { TO_LATIN } from "./confusables-data.js";

const W = (q) => `https://www.wikidata.org/wiki/${q}`;
const P = "platform", O = "outlet";
// [name shown in the evidence, kind, Wikidata item, names the brand goes by, X usernames from Wikidata]
const RAW = [
  ["X", P, "Q918", ["X", "Twitter"], ["X"]],
  ["YouTube", P, "Q866", ["YouTube"], ["YouTube"]],
  ["Meta", P, "Q380", ["Meta"], ["Meta"]],
  ["Facebook", P, "Q355", ["Facebook"], ["FacebookApp"]],
  ["Instagram", P, "Q209330", ["Instagram"], ["instagram"]],
  ["Threads", P, "Q120281745", ["Threads"], []],
  ["TikTok", P, "Q48938223", ["TikTok"], ["tiktok_us"]],
  ["Bluesky", P, "Q78194383", ["Bluesky"], ["bluesky"]],
  ["Reddit", P, "Q1136", ["Reddit"], ["reddit", "Reddit_UK"]],
  ["Google", P, "Q95", ["Google"], ["Google", "GoogleUK", "GoogleIndia", "NewsFromGoogle"]],
  ["BBC News", O, "Q1160945", ["BBC News", "BBC"], ["BBCNews", "BBCBreaking", "BBCAfrica", "bbcchinese", "BBCNewsEnts", "bbcnewsjapan", "BBCSomali"]],
  ["BBC World News", O, "Q208491", ["BBC World", "BBC World News"], ["BBCWorld"]],
  ["CNN", O, "Q48340", ["CNN"], ["CNN", "cnni", "cnnbrk", "CNNOriginals", "CNNPolitics", "CNNPR", "cnnweather"]],
  ["Reuters", O, "Q130879", ["Reuters"], ["Reuters", "reuters_russia", "reutersbiz", "ReutersIndia", "ReutersIran", "ReutersJapan", "ReutersLegal", "reuterspictures", "ReutersScience", "ReutersUK", "ReutersWorld"]],
  ["Associated Press", O, "Q40469", ["Associated Press", "AP News", "AP"], ["AP"]],
  ["AFP", O, "Q40464", ["AFP", "Agence France-Presse", "AFP News"], ["AFP", "AFPar", "afpbbcom", "AFPde", "AFPespanol", "afpfr"]],
  ["Fox News", O, "Q186068", ["Fox News"], ["FoxNews", "foxheadlines", "foxnewsalert", "FoxNewsOpinion", "foxnewspolitics", "foxnewsvideo"]],
  ["NBC News", O, "Q2877626", ["NBC News"], ["NBCNews", "BreakingNews", "NBCNewsHealth", "NBCNewsTech"]],
  ["ABC News (US)", O, "Q287171", ["ABC News"], ["ABC"]],
  ["ABC News (Australia)", O, "Q4650197", ["ABC News"], ["abcnews"]],
  ["MS NOW (MSNBC)", O, "Q13973", ["MS NOW", "MSNBC"], []],
  ["NPR", O, "Q671510", ["NPR"], ["NPR", "nprpolitics", "NPRHealth", "nprmusic", "nprbooks"]],
  ["The New York Times", O, "Q9684", ["The New York Times", "New York Times", "NYT"], ["nytimes", "nytimesworld", "nytpolitics", "nytopinion", "NYTScience", "nytvideo", "nytgraphics"]],
  ["The Washington Post", O, "Q166032", ["The Washington Post", "Washington Post"], ["washingtonpost", "PostGraphics", "capitalweather"]],
  ["The Wall Street Journal", O, "Q164746", ["The Wall Street Journal", "Wall Street Journal", "WSJ"], ["WSJ"]],
  ["The Guardian", O, "Q11148", ["The Guardian"], ["guardian"]],
  ["Bloomberg News", O, "Q14270642", ["Bloomberg News", "Bloomberg"], []],
  ["Al Jazeera", O, "Q13477", ["Al Jazeera"], ["aljazeera", "AJABreaking", "AJArabic"]],
  ["Sky News", O, "Q217228", ["Sky News"], ["SkyNews", "SkyNewsBreak"]],
  ["Newsmax", O, "Q27037115", ["Newsmax"], ["NEWSMAX"]],
  ["Breitbart News", O, "Q4960434", ["Breitbart News", "Breitbart"], ["BreitbartNews", "BreitbartLondon"]],
  ["The Daily Wire", O, "Q25094513", ["The Daily Wire", "Daily Wire"], ["realDailyWire"]],
  ["HuffPost", O, "Q18049522", ["HuffPost"], ["HuffPost", "HuffPostPol", "HuffPostUK"]],
  ["Daily Mail", O, "Q210534", ["Daily Mail", "MailOnline"], ["MailOnline"]],
  ["USA Today", O, "Q39681", ["USA Today"], ["USATODAY"]],
  ["Politico", O, "Q3109740", ["Politico"], ["politico", "POLITICOMag"]],
  ["Axios", O, "Q28230873", ["Axios"], ["axios"]],
  ["Financial Times", O, "Q183399", ["Financial Times"], ["FT", "FinancialTimes"]],
  ["The Economist", O, "Q180089", ["The Economist"], ["TheEconomist"]],
  ["Deutsche Welle", O, "Q153770", ["Deutsche Welle", "DW News"], ["DeutscheWelle", "dw_europe"]],
  ["Le Monde", O, "Q12461", ["Le Monde"], ["lemondefr"]],
  ["Der Spiegel", O, "Q131478", ["Der Spiegel"], ["derspiegel", "SPIEGEL_EIL"]],
];

const LATIN = (() => { const a = [...TO_LATIN], m = new Map(); for (let i = 0; i + 1 < a.length; i += 2) m.set(a[i], a[i + 1]); return m; })();
// Styled letters ("𝕏", fullwidth) become plain, then a Cyrillic or Greek word made only of Latin
// look-alikes becomes Latin when the name also has a Latin word ("ВВС Breaking"), then single
// letters in a row join ("B B C" reads "bbc").
export function nameTokens(text) {
  const s = String(text || "").normalize("NFKC");
  let words = s.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  if (words.some((w) => /^[A-Za-z0-9]+$/.test(w))) {
    words = words.map((w) => ([...w].every((c) => /[A-Za-z0-9]/.test(c) || LATIN.has(c)) ? [...w].map((c) => LATIN.get(c) || c).join("") : w));
  }
  const out = [];
  for (const w of words.map((x) => x.toLowerCase())) {
    if (w.length === 1 && out.length && out[out.length - 1].single) out[out.length - 1].t += w;
    else out.push({ t: w, single: w.length === 1 });
  }
  return out.map((x) => x.t);
}

export const BRANDS = RAW.map(([name, kind, q, names, handles]) => ({ name, kind, source: W(q), names, handles,
  nameTokens: names.map(nameTokens), keys: names.map((n) => nameTokens(n).join("")).filter((k) => k.length >= 3) }));

const CUES = {
  outlet: ["breaking", "news", "live", "alert", "alerts", "update", "updates", "official", "world", "global", "hq", "now", "24", "247", "24h", "24x7", "flash", "report", "reports", "headlines"],
  platform: ["support", "help", "helpdesk", "safety", "security", "official", "global", "team", "verified", "verification", "admin", "hq", "appeals", "copyright", "care", "center", "centre", "trust", "moderation", "premium", "service"],
};
const LONG_CUES = { outlet: CUES.outlet.filter((c) => c.length >= 5), platform: CUES.platform.filter((c) => c.length >= 5) };
// Accounts that say what they are. "notaffiliated" covers "not affiliated" once spaces go.
const SAYS_UNOFFICIAL = /\b(?:fan|fans|parody|satire|unofficial|critic|critics|commentary)\b|not\s*affiliated/i;
const ORG_CHECK = new Set(["Business", "Government"]);

export const BRAND_DOES_NOT_PROVE = "A brand in the name, outside the official account list. Fans, critics, reporters and local partners put outlet and platform names in their profiles too, and the official list is partial.";

const at = (hay, needle) => { for (let i = 0; i + needle.length <= hay.length; i++) if (needle.every((t, j) => hay[i + j] === t)) return i; return -1; };

// The brand a display name borrows, as { brand, matched } or null.
function displayMatch(tokens) {
  let best = null;
  for (const b of BRANDS) {
    b.nameTokens.forEach((nt, i) => {
      const k = at(tokens, nt);
      if (k < 0) return;
      const rest = [...tokens.slice(0, k), ...tokens.slice(k + nt.length)];
      const alone = rest.length === 0 && nt.join("").length >= 4;
      if (!alone && !rest.some((t) => CUES[b.kind].includes(t))) return;
      if (!best || nt.length > best.len) best = { brand: b, matched: b.names[i], len: nt.length };
    });
  }
  return best;
}

// The brand a handle borrows: it starts with a brand name and the rest is digits or a cue word.
function handleMatch(handle) {
  const h = String(handle || "").toLowerCase();
  for (const b of BRANDS) for (const key of [...b.keys, ...b.handles.map((x) => x.toLowerCase()).filter((x) => x.length >= 3)]) {
    if (!h.startsWith(key) || h === key) continue;
    const rest = h.slice(key.length), parts = rest.split("_").filter(Boolean);
    if (/^[_\d]+$/.test(rest) || parts.some((p) => CUES[b.kind].includes(p)) || LONG_CUES[b.kind].some((c) => rest.includes(c))) return { brand: b, matched: key };
  }
  return null;
}

// account: { handle, display, affiliate?, verifiedType?, xLabel? }. Returns
// { brand, kind, where, evidence, source } or null.
export function brandLookalike(account) {
  const handle = String(account.handle || ""), display = String(account.display || "");
  if (/parody|commentary|fan/i.test(account.xLabel || "") || ORG_CHECK.has(account.verifiedType)) return null;
  if (SAYS_UNOFFICIAL.test(`${display} ${handle.replace(/_/g, " ")}`)) return null;
  const d = displayMatch(nameTokens(display));
  const m = d || handleMatch(handle);
  if (!m) return null;
  // Every brand that goes by the matched name ("ABC News" is two outlets) shares the check.
  const same = BRANDS.filter((b) => b === m.brand || b.names.some((n) => m.brand.names.includes(n)));
  const own = new Set(same.flatMap((b) => b.handles.map((x) => x.toLowerCase())));
  if (own.has(handle.toLowerCase())) return null;
  if (account.affiliate) {
    const aff = nameTokens(account.affiliate), affKey = aff.join("");
    if (own.has(affKey) || same.some((b) => b.nameTokens.some((nt) => at(aff, nt) >= 0))) return null;
  }
  const where = d ? `display name "${display.slice(0, 50)}"` : `handle @${handle}`;
  const who = d ? `; @${handle} is outside` : " and is outside";
  const evidence = `${where} uses the ${m.brand.name} brand${who} the ${m.brand.name} accounts Wikidata lists, and the page lacks a ${m.brand.name} affiliation badge or organisation check`;
  return { brand: m.brand.name, kind: m.brand.kind, where: d ? "display" : "handle", evidence, source: m.brand.source };
}
