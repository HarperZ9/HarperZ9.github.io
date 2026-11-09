// A small gazetteer: countries, their demonyms, a few large cities, and the broad regions an
// account label can name instead of a country. It only has to be good enough for the
// "speaking as a local" rule in mismatch.js; anything it does not know is "cannot compare".

// [country, region, demonyms..., cities...]. Region names are ours; regionOf() maps label
// wording onto them.
const ROWS = [
  ["France", "europe", "french", "frenchman", "frenchwoman", "paris", "marseille", "lyon", "toulouse", "nantes", "lille"],
  ["United Kingdom", "europe", "british", "brit", "english", "englishman", "englishwoman", "scottish", "welsh", "london", "manchester", "birmingham", "glasgow", "uk", "britain", "england", "scotland", "wales"],
  ["Germany", "europe", "german", "berlin", "munich", "hamburg", "cologne", "frankfurt"],
  ["Spain", "europe", "spanish", "spaniard", "madrid", "barcelona", "valencia", "seville"],
  ["Italy", "europe", "italian", "rome", "milan", "naples", "turin"],
  ["Netherlands", "europe", "dutch", "amsterdam", "rotterdam", "holland"],
  ["Belgium", "europe", "belgian", "brussels", "antwerp"],
  ["Ireland", "europe", "irish", "dublin", "cork"],
  ["Poland", "europe", "polish", "pole", "warsaw", "krakow"],
  ["Sweden", "europe", "swedish", "swede", "stockholm", "gothenburg"],
  ["Norway", "europe", "norwegian", "oslo"],
  ["Denmark", "europe", "danish", "dane", "copenhagen"],
  ["Portugal", "europe", "portuguese", "lisbon", "porto"],
  ["Greece", "europe", "greek", "athens"],
  ["Austria", "europe", "austrian", "vienna"],
  ["Switzerland", "europe", "swiss", "zurich", "geneva"],
  ["Hungary", "europe", "hungarian", "budapest"],
  ["Romania", "europe", "romanian", "bucharest"],
  ["Ukraine", "europe", "ukrainian", "kyiv", "kiev", "kharkiv", "odesa"],
  ["Russia", "europe", "russian", "moscow", "st petersburg"],
  ["Serbia", "europe", "serbian", "serb", "belgrade"],
  ["Turkey", "west asia", "turkish", "turk", "istanbul", "ankara", "turkiye"],
  ["Israel", "west asia", "israeli", "tel aviv", "jerusalem"],
  ["Iran", "west asia", "iranian", "persian", "tehran"],
  ["Saudi Arabia", "west asia", "saudi", "riyadh", "jeddah"],
  ["United Arab Emirates", "west asia", "emirati", "dubai", "abu dhabi", "uae"],
  ["Qatar", "west asia", "qatari", "doha"],
  ["Lebanon", "west asia", "lebanese", "beirut"],
  ["Egypt", "africa", "egyptian", "cairo", "alexandria"],
  ["Morocco", "africa", "moroccan", "casablanca", "rabat"],
  ["Algeria", "africa", "algerian", "algiers"],
  ["Tunisia", "africa", "tunisian", "tunis"],
  ["Nigeria", "africa", "nigerian", "lagos", "abuja"],
  ["Kenya", "africa", "kenyan", "nairobi"],
  ["Ghana", "africa", "ghanaian", "accra"],
  ["South Africa", "africa", "south african", "johannesburg", "cape town", "durban"],
  ["Ethiopia", "africa", "ethiopian", "addis ababa"],
  ["Senegal", "africa", "senegalese", "dakar"],
  ["India", "south asia", "indian", "delhi", "new delhi", "mumbai", "bangalore", "bengaluru", "kolkata", "chennai"],
  ["Pakistan", "south asia", "pakistani", "karachi", "lahore", "islamabad"],
  ["Bangladesh", "south asia", "bangladeshi", "dhaka"],
  ["Sri Lanka", "south asia", "sri lankan", "colombo"],
  ["China", "east asia", "chinese", "beijing", "shanghai", "shenzhen", "guangzhou"],
  ["Japan", "east asia", "japanese", "tokyo", "osaka", "kyoto"],
  ["South Korea", "east asia", "korean", "south korean", "seoul", "busan", "korea"],
  ["Taiwan", "east asia", "taiwanese", "taipei"],
  ["Philippines", "east asia", "filipino", "filipina", "manila"],
  ["Indonesia", "east asia", "indonesian", "jakarta"],
  ["Vietnam", "east asia", "vietnamese", "hanoi", "ho chi minh city"],
  ["Thailand", "east asia", "thai", "bangkok"],
  ["Malaysia", "east asia", "malaysian", "kuala lumpur"],
  ["Australia", "oceania", "australian", "aussie", "sydney", "melbourne", "brisbane", "perth"],
  ["New Zealand", "oceania", "new zealander", "kiwi", "auckland", "wellington"],
  ["United States", "north america", "american", "us", "usa", "america", "new york", "los angeles", "chicago", "houston", "texas", "california", "florida"],
  ["Canada", "north america", "canadian", "toronto", "montreal", "vancouver", "ottawa", "quebec"],
  ["Mexico", "north america", "mexican", "mexico city", "guadalajara"],
  ["Brazil", "south america", "brazilian", "sao paulo", "rio de janeiro", "brasilia"],
  ["Argentina", "south america", "argentine", "argentinian", "buenos aires"],
  ["Colombia", "south america", "colombian", "bogota", "medellin"],
  ["Chile", "south america", "chilean", "santiago"],
  ["Venezuela", "south america", "venezuelan", "caracas"],
  ["Peru", "south america", "peruvian", "lima"],
];

const COUNTRY = new Map();   // lower-case country name -> { name, region }
const ALIAS = new Map();     // any lower-case name, demonym or city -> country name
const DEMONYMS = new Set();  // lower-case demonyms only
for (const [name, region, ...rest] of ROWS) {
  COUNTRY.set(name.toLowerCase(), { name, region });
  ALIAS.set(name.toLowerCase(), name);
  for (const word of rest) ALIAS.set(word, name);
}
// Demonyms are the words that come first after the region in each row up to the first city;
// listing them explicitly keeps the rule readable.
for (const w of ["french", "frenchman", "frenchwoman", "englishman", "englishwoman", "british", "brit", "english", "scottish", "welsh", "german", "spanish", "spaniard", "italian", "dutch", "belgian", "irish", "polish", "swedish", "norwegian", "danish", "portuguese", "greek", "austrian", "swiss", "hungarian", "romanian", "ukrainian", "russian", "serbian", "turkish", "israeli", "iranian", "saudi", "emirati", "qatari", "lebanese", "egyptian", "moroccan", "algerian", "tunisian", "nigerian", "kenyan", "ghanaian", "south african", "ethiopian", "senegalese", "indian", "pakistani", "bangladeshi", "sri lankan", "chinese", "japanese", "korean", "taiwanese", "filipino", "indonesian", "vietnamese", "thai", "malaysian", "australian", "new zealander", "american", "canadian", "mexican", "brazilian", "argentine", "argentinian", "colombian", "chilean", "venezuelan", "peruvian"]) DEMONYMS.add(w);

export function countryOf(word) { return ALIAS.get(String(word || "").toLowerCase().trim()) || null; }
export function isDemonym(word) { return DEMONYMS.has(String(word || "").toLowerCase().trim()); }
export function knownPlaceWords() { return [...ALIAS.keys()].sort((a, b) => b.length - a.length); }

// X labels name a country or a broad region. Map a label to { country } or { region }, or null.
const REGION_WORDS = [
  [/europe/i, "europe"], [/west(ern)? asia|middle east/i, "west asia"], [/africa/i, "africa"],
  [/south asia/i, "south asia"], [/east asia|asia pacific|southeast asia|pacific/i, "east asia"],
  [/oceania|australasia/i, "oceania"], [/north america/i, "north america"],
  [/south america|latin america/i, "south america"],
];
export function parseLabel(label) {
  const s = String(label || "").trim();
  if (!s) return null;
  const c = COUNTRY.get(s.toLowerCase()) || (countryOf(s) && COUNTRY.get(countryOf(s).toLowerCase()));
  if (c) return { country: c.name, region: c.region };
  for (const [re, region] of REGION_WORDS) if (re.test(s)) return { region };
  // Free text such as "Paris, France" or "Lyon | FR": try each part, last part first.
  const parts = s.split(/[,|/·]+/).map((x) => x.trim()).filter(Boolean);
  if (parts.length > 1) for (const part of parts.reverse()) { const r = parseLabel(part); if (r) return r; }
  return null;
}
export function regionOfCountry(name) { const c = COUNTRY.get(String(name || "").toLowerCase()); return c ? c.region : null; }
