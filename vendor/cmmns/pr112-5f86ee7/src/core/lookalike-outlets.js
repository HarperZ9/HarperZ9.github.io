// Major news outlets whose names influence operations have copied (the cloned and look-alike domains
// in data/ops-sources) and other widely read outlets. Each row: the names a look-alike would copy,
// and every domain the outlet itself uses, which never match. "generic" names (a common word many
// unrelated outlets use) are checked for misspellings only, never for a swapped ending.
// Official domains checked against Wikidata's official-website property and the outlets' own pages
// in October 2026.
export const OUTLETS = [
  ["The Washington Post", ["washingtonpost.com", "wapo.st"]], ["Fox News", ["foxnews.com", "foxbusiness.com"]],
  ["Der Spiegel", ["spiegel.de"]], ["Frankfurter Allgemeine", ["faz.net"]], ["Le Monde", ["lemonde.fr"]],
  ["Le Parisien", ["leparisien.fr"]], ["RBC", ["rbc.ru", "rbc.ua"], ["rbk"]], ["Süddeutsche Zeitung", ["sueddeutsche.de", "sz.de"]],
  ["Der Tagesspiegel", ["tagesspiegel.de"], ["dertagesspiegel"]], ["Bild", ["bild.de", "bild.tv"]], ["Die Welt", ["welt.de"]],
  ["Daily Mail", ["dailymail.co.uk", "dailymail.com"]], ["La Repubblica", ["repubblica.it"]], ["Delfi", ["delfi.lt", "delfi.lv", "delfi.ee"]],
  ["20 Minutes", ["20minutes.fr", "20min.ch", "20minutes.ch", "20minutes.tv"]], ["ANSA", ["ansa.it"]], ["The Guardian", ["theguardian.com"]],
  ["t-online", ["t-online.de"]], ["nd", ["nd-aktuell.de"]], ["BBC", ["bbc.com", "bbc.co.uk"]], ["The New York Times", ["nytimes.com", "nyti.ms"]],
  ["CNN", ["cnn.com"]], ["Reuters", ["reuters.com"]], ["AP News", ["apnews.com"]], ["Al Jazeera", ["aljazeera.com", "aljazeera.net"]],
  ["Al Arabiya", ["alarabiya.net"], ["alarabyia"]], ["Haaretz", ["haaretz.com", "haaretz.co.il"]], ["The Times of Israel", ["timesofisrael.com"]],
  ["The Jerusalem Post", ["jpost.com"], ["jerusalempost", "thejerusalempost"]], ["Israel Hayom", ["israelhayom.com", "israelhayom.co.il"]],
  ["Israel National News", ["israelnationalnews.com"]], ["The Independent", ["independent.co.uk"], [], true],
  ["The Atlantic", ["theatlantic.com"]], ["Foreign Policy", ["foreignpolicy.com"]], ["Bloomberg", ["bloomberg.com"]],
  ["HuffPost", ["huffpost.com", "huffingtonpost.com", "huffingtonpost.co.uk", "huffingtonpost.fr", "huffingtonpost.es", "huffingtonpost.it", "huffingtonpost.de", "huffingtonpost.jp", "huffingtonpost.kr", "huffingtonpost.gr"]],
  ["Politico", ["politico.com", "politico.eu"]], ["France 24", ["france24.com"]], ["Le Soir", ["lesoir.be"], [], true],
  ["National Post", ["nationalpost.com"]], ["The Globe and Mail", ["theglobeandmail.com"]], ["Washington Examiner", ["washingtonexaminer.com"]],
  ["MintPress News", ["mintpressnews.com"]], ["The Herald", ["heraldscotland.com"], ["theheraldscotland"]], ["Breaking Israel News", ["breakingisraelnews.com"]],
  ["The Brussels Times", ["brusselstimes.com"]], ["Budapest Beacon", ["budapestbeacon.com"]], ["Emarat Al Youm", ["emaratalyoum.com"]],
  ["Al Jazirah", ["al-jazirah.com"]], ["Al Riyadh", ["alriyadh.com"]], ["Sharjah 24", ["sharjah24.ae"]], ["Shorouk News", ["shorouknews.com"]],
  ["El Watan News", ["elwatannews.com"]], ["Arabi21", ["arabi21.com"]], ["Euronews", ["euronews.com"]], ["Le Figaro", ["lefigaro.fr"]],
  ["Corriere della Sera", ["corriere.it"]], ["El País", ["elpais.com"]], ["Die Zeit", ["zeit.de"]], ["The Kyiv Independent", ["kyivindependent.com"]],
  ["Kyiv Post", ["kyivpost.com"]], ["USA Today", ["usatoday.com"]], ["NBC News", ["nbcnews.com"]], ["CBS News", ["cbsnews.com"]],
  ["Los Angeles Times", ["latimes.com"]], ["New York Post", ["nypost.com"]], ["Newsweek", ["newsweek.com"]],
  ["South China Morning Post", ["scmp.com"]], ["The Straits Times", ["straitstimes.com"]], ["The Japan Times", ["japantimes.co.jp"]],
  ["The Korea Times", ["koreatimes.co.kr", "koreatimes.com"], ["thekoreatimes"]], ["Jakarta Globe", ["jakartaglobe.id"]], ["Bangkok Post", ["bangkokpost.com"], ["dailybangkokpost"]],
  ["The Times of India", ["timesofindia.indiatimes.com", "indiatimes.com"], ["timesofindia"]], ["Hürriyet", ["hurriyet.com.tr", "hurriyetdailynews.com"]],
  ["Ukrainska Pravda", ["pravda.com.ua"], ["pravda-ua"]], ["Kommersant", ["kommersant.ru", "kommersant.com", "kommersant.uk"]], ["Meduza", ["meduza.io"]],
  ["Le Point", ["lepoint.fr"]], ["Libération", ["liberation.fr"]], ["Ouest-France", ["ouest-france.fr"]], ["Deutsche Welle", ["dw.com"]],
  ["Agence France-Presse", ["afp.com"]], ["Associated Press", ["ap.org"]], ["The Wall Street Journal", ["wsj.com"]], ["Financial Times", ["ft.com"]],
  ["The Economist", ["economist.com"]], ["The Telegraph", ["telegraph.co.uk"], [], true], ["Sky News", ["news.sky.com", "sky.com"]],
  ["ABC News", ["abcnews.go.com", "abc.net.au", "abcnews.com"]], ["Berliner Morgenpost", ["morgenpost.de"]], ["La Stampa", ["lastampa.it"]],
  ["UNIAN", ["unian.ua", "unian.net", "unian.info", "unian.tv"]], ["Obozrevatel", ["obozrevatel.com"]], ["La Croix", ["la-croix.com"]],
  ["Polskie Radio", ["polskieradio.pl", "polskieradio24.pl", "polskieradio.com"]], ["Slate", ["slate.com", "slate.fr"]], ["The New Yorker", ["newyorker.com"]],
  ["Berliner Zeitung", ["berliner-zeitung.de"]], ["Walla", ["walla.co.il"]], ["Mako", ["mako.co.il"]], ["Spektrum", ["spektrum.de"]],
  ["Psychologie Heute", ["psychologie-heute.de"]], ["Closer", ["closermag.fr"]], ["Cosmopolitan", ["cosmopolitan.com", "cosmopolitan.fr", "cosmopolitan.de", "cosmopolitan.tv"]],
  ["EatingWell", ["eatingwell.com"]], ["Real Simple", ["realsimple.com"]], ["Grazia", ["grazia.it", "grazia.fr"]],
  ["Herder", ["herder.de"]], ["Bundespolizei", ["bundespolizei.de"]], ["Onmeda", ["onmeda.de"]], ["Sciences Humaines", ["scienceshumaines.com"]], ["Axios", ["axios.com"]], ["The Hill", ["thehill.com"]], ["Al-Monitor", ["al-monitor.com"]],
].map(([name, domains, aliases = [], generic = false]) => ({ name, domains, aliases, generic }));

// Real outlets that are not any listed outlet but sit one edit from one (found by the control test
// over the owner and site tables). They never match.
export const UNRELATED_REAL = ["20minutos.es", "alwatannews.net", "economista.com.mx", "ekonomist.me", "indypendent.org", "republica.com", "republica.com.uy"];
