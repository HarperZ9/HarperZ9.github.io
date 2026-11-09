// French word lists for the stance-neutral markers in rhetoric-fr.js. Same families and the same
// rule as lexicon.js: a group named with marker grammar counts, disagreement and policy do not.
// Accented and unaccented spellings are both listed, since replies often drop accents.

export const GROUPS_FR = [
  // origine, religion, nationalité
  "immigrés", "immigres", "migrants", "étrangers", "etrangers", "réfugiés", "refugies", "musulmans", "juifs", "chrétiens",
  "chretiens", "arabes", "africains", "noirs", "blancs", "asiatiques", "maghrébins", "maghrebins", "roms", "gitans",
  "turcs", "algériens", "algeriens", "marocains", "français", "francais",
  // politique
  "gauchistes", "gauchos", "fachos", "fascistes", "communistes", "nationalistes", "macronistes", "wokistes", "islamistes",
  // classe, rôle, identité
  "riches", "milliardaires", "patrons", "flics", "policiers", "manifestants", "émeutiers", "emeutiers", "journalistes",
  "féministes", "feministes", "homosexuels", "trans", "femmes", "hommes",
];

export const DEHUMANISE_FR = ["vermine", "rats", "cafards", "parasites", "animaux", "sauvages", "sous-hommes", "sous-humains",
  "racaille", "racailles", "ordures", "déchets", "dechets", "porcs", "chiens", "singes", "bêtes", "betes", "cancer", "peste",
  "gangrène", "gangrene", "cloportes", "nuisibles"];

// Infinitives after "il faut", "on doit": physical harm only. Expelling or jailing is policy.
export const KILL_INF_FR = ["exterminer", "tuer", "fusiller", "pendre", "gazer", "massacrer", "éradiquer", "eradiquer", "buter",
  "abattre", "brûler", "bruler", "lyncher", "flinguer", "liquider", "exécuter", "executer"];

// Participles after "méritent d'être", "doivent être".
export const KILL_PP_FR = ["fusillés", "fusilles", "pendus", "exterminés", "extermines", "tués", "tues", "gazés", "gazes",
  "massacrés", "massacres", "éliminés", "elimines", "abattus", "éradiqués", "eradiques", "brûlés", "brules", "lynchés",
  "lynches", "exécutés", "executes"];

export const STEREOTYPE_TRAITS_FR = ["criminels", "voleurs", "violents", "sales", "terroristes", "violeurs", "délinquants",
  "delinquants", "barbares", "dégénérés", "degeneres", "fainéants", "faineants", "menteurs", "pédophiles", "pedophiles",
  "envahisseurs", "cons", "débiles", "debiles", "stupides"];

export const CONSPIRACY_FR = ["grand remplacement", "faux drapeau", "réveillez-vous", "reveillez-vous", "les médias vous cachent",
  "les medias vous cachent", "on vous ment", "payés par soros", "payes par soros", "financés par soros", "finances par soros",
  "financé par soros", "état profond", "etat profond", "nouvel ordre mondial"];

// Pronoun slogans with no group named.
export const SLOGANS_FR = ["tous les buter", "il faut tous les tuer", "on va tous les buter", "tous les fusiller"];
