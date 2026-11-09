// German word lists for the stance-neutral markers in rhetoric-de.js. Same families and the same
// rule as lexicon.js: a group named with marker grammar counts, disagreement and policy do not.
// Spellings with ä, ö, ü, ß and with ae, oe, ue, ss are both listed where replies use both.
// Sources: project-docs/evidence/LEXICON-SOURCES.md.

export const GROUPS_DE = [
  // Herkunft, Religion, Nationalität
  "Ausländer", "Auslaender", "Migranten", "Flüchtlinge", "Fluechtlinge", "Asylanten", "Asylbewerber", "Muslime",
  "Moslems", "Juden", "Christen", "Katholiken", "Araber", "Afrikaner", "Schwarze", "Weiße", "Weisse", "Türken",
  "Tuerken", "Roma", "Sinti", "Polen", "Russen", "Deutsche", "Deutschen", "Ossis", "Wessis", "Kartoffeln",
  // Politik, auch die geprägten Spitznamen beider Seiten
  "Linke", "Linken", "Linksradikale", "Linksextreme", "Kommunisten", "Sozialisten", "Grüne", "Gruene", "Grünen",
  "Antifa", "Gutmenschen", "Zecken", "Rechte", "Rechten", "Rechtsradikale", "Rechtsextreme", "Nazis", "Faschisten",
  "AfDler", "Konservative", "Liberale", "Querdenker",
  // Klasse, Rolle, Identität
  "Reiche", "Reichen", "Milliardäre", "Milliardaere", "Bonzen", "Banker", "Politiker", "Polizisten", "Bullen",
  "Demonstranten", "Journalisten", "Feministinnen", "Feministen", "Schwule", "Lesben", "Transfrauen", "Männer",
  "Maenner", "Frauen",
];

export const DEHUMANISE_DE = ["Ungeziefer", "Ratten", "Kakerlaken", "Parasiten", "Schmarotzer", "Tiere", "Viecher",
  "Bestien", "Untermenschen", "Abschaum", "Gesindel", "Geschmeiß", "Geschmeiss", "Pack", "Dreck", "Pest", "eine Pest",
  "Krebsgeschwür", "Krebsgeschwuer", "Schweine", "Affen", "Läuse", "Laeuse", "Zecken", "Volksschädlinge",
  "Volksschaedlinge", "Müll", "Muell"];

// Compound insults: "Asylantenpack", "Nazipack", "Bullenschweine". Stems from every side.
export const COMPOUND_STEMS_DE = ["Asylanten", "Ausländer", "Auslaender", "Flüchtlings", "Migranten", "Moslem", "Muslim",
  "Juden", "Türken", "Kanaken", "Nazi", "Nazi-", "Links", "Rechts", "Antifa", "Bullen", "Polizei", "Kommunisten",
  "Zecken", "Grünen", "Bonzen", "Gutmenschen", "Politiker"];
export const COMPOUND_TAILS_DE = ["pack", "gesindel", "schweine", "abschaum", "ratten", "ungeziefer", "geschmeiß",
  "geschmeiss", "brut"];

// Infinitives at the end of "man sollte alle X erschießen": physical harm only. Abschieben is policy.
export const KILL_INF_DE = ["erschießen", "erschiessen", "vergasen", "aufhängen", "aufhaengen", "abknallen",
  "ausrotten", "umbringen", "töten", "toeten", "abschlachten", "lynchen", "hinrichten", "vernichten", "verbrennen",
  "an die Wand stellen", "aufknüpfen", "aufknuepfen", "totschlagen"];

// Participles after "gehören", "sollten ... werden", "verdienen es, ... zu werden".
export const KILL_PP_DE = ["erschossen", "vergast", "aufgehängt", "aufgehaengt", "abgeknallt", "ausgerottet",
  "umgebracht", "getötet", "getoetet", "abgeschlachtet", "gelyncht", "hingerichtet", "vernichtet", "verbrannt",
  "an die Wand gestellt", "aufgeknüpft", "aufgeknuepft", "totgeschlagen"];

export const STEREOTYPE_TRAITS_DE = ["kriminell", "Kriminelle", "Verbrecher", "Diebe", "Vergewaltiger", "Terroristen",
  "gewalttätig", "gewalttaetig", "faul", "dumm", "asozial", "Asoziale", "Schmarotzer", "Sozialschmarotzer", "Lügner",
  "Luegner", "Messerstecher", "Messermänner", "Barbaren", "Invasoren", "Kinderschänder", "Kinderschaender", "Pädophile",
  "Paedophile", "degeneriert"];

// "Volksverräter" is absolutist framing, not conspiracy, and is left to a later list.
export const CONSPIRACY_DE = ["Umvolkung", "Bevölkerungsaustausch", "Bevoelkerungsaustausch", "großer Austausch",
  "großen Austausch", "große Austausch", "grosse Austausch", "grosser Austausch", "grossen Austausch", "Lügenpresse", "Luegenpresse", "Systempresse",
  "Systemmedien", "Plandemie", "neue Weltordnung", "Kalergi-Plan", "Kalergiplan", "BRD GmbH", "Chemtrails",
  "von Soros bezahlt", "von Soros finanziert", "Soros-finanziert", "von Putin bezahlt", "von Putin finanziert",
  "Putin-finanziert", "wacht endlich auf", "Schlafschafe"];

// Death-wish slogans with a fixed target, from the right and from the left. "Tod den X" and
// "X verrecke" with a named group are built in rhetoric-de.js.
export const SLOGANS_DE = ["Juda verrecke", "Rotfront verrecke", "Deutschland verrecke", "Deutschland verrecken",
  "Bullen platt wie Stullen", "alle an die Wand", "an die Wand mit ihnen"];

// Slurs that read as hateful on their own in German (Duden marks them as discriminatory).
export const SLURS_DE = ["Neger", "Nigger", "Kanake", "Kanaken", "Kanacke", "Kanacken", "Kümmeltürke", "Kümmeltürken",
  "Kuemmeltuerke", "Kuemmeltuerken", "Schwuchtel", "Schwuchteln", "Judensau", "Judenschwein"];
