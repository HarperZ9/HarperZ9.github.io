// CMMNS' word lists, kept apart from the matching code so they can be reviewed and updated in
// one place. Every list covers targets in every direction; tests/rhetoric.symmetry.test.js holds
// the scoring to equal treatment. Sources for slurs and coded terms: the ADL Hate Symbols
// database, Hatebase, GNET and ISD extremism glossaries; terms added for side recall on 2026-10-21 cite
// Wiktionary labels in project-docs/evidence/LEXICON-SOURCES.md. Words that people also use innocently
// (a jogger, crackers, gypsy as a self-name) go in the SOFT lists, which count for less.

// People named as groups. Matching any of these lets the grammar rules ("X are vermin",
// "all X are", "X want to destroy") apply.
export const GROUPS = [
  // origin, faith, ethnicity, nationality
  "immigrants", "migrants", "refugees", "foreigners", "asylum seekers", "muslims", "moslems", "jews", "christians", "hindus", "sikhs", "atheists",
  "arabs", "africans", "blacks", "black people", "whites", "white people", "asians", "latinos", "hispanics", "mexicans", "chinese",
  "indians", "pakistanis", "somalis", "haitians", "russians", "ukrainians", "americans", "europeans", "french", "roma", "natives",
  // faiths named as a whole, so "war on Islam" reads like "war on Muslims"
  "islam", "christianity", "judaism", "hinduism", "the church", "the west",
  // politics
  "leftists", "liberals", "progressives", "socialists", "communists", "commies", "conservatives", "republicans", "democrats",
  "rightists", "nationalists", "fascists", "libtards", "maga", "woke", "tories", "the left", "the right",
  // derogatory nicknames, so "mussie scum" reads like "muslims are scum"
  "mussie", "mussies", "muzzie", "muzzies", "third world", "third worlders", "magats", "magat", "fash", "nazis", "zionists",
  "globalists", "leftards", "rednecks", "leftoids", "leftoid", "rightoids", "rightoid", "commie", "libs", "conservatards",
  // class, role, identity
  "the rich", "billionaires", "elites", "the elite", "landlords", "bankers", "politicians", "police", "cops", "protesters",
  "rioters", "journalists", "the media", "boomers", "men", "women", "gays", "lesbians", "trans people", "transgenders",
  "feminists", "disabled people", "the disabled", "farmers", "unions",
  // added 2026-10-21 from the dev split, one per direction where both exist
  "evangelicals", "catholics", "white men", "white women", "black men", "black women", "straight people", "straights",
  "gay people", "gay men", "queers", "jewish people", "muslim people", "christian people", "caucasians", "white kids",
  "black kids", "white guys", "black guys", "white girls", "black girls", "hillbillies", "arab people", "asian people",
  // added 2026-10-21 for the side-recall fix (project-docs/evidence/LEXICON-SOURCES.md): a self-named group, and
  // political coinages from both directions, so the grammar reads "trumptards are scum" like "libtards are scum"
  "incels", "trumptards", "trumpanzees", "rethuglicans", "repugnicans", "demonrats", "conservatards",
];

// The dehumanising nouns that stay unambiguous right after a group ("commie filth", "migrant rats").
// Words with ordinary uses next to a group noun ("police dogs", "women with cancer") are left out.
export const DEHUMANISE_ADJACENT = ["vermin", "rats", "cockroaches", "roaches", "parasites", "leeches", "subhuman",
  "sub-human", "savages", "filth", "scum", "insects", "apes", "monkeys", "beasts", "pigs", "invaders"];

// A simile with a verb of spreading: "they are infecting every country like parasites", "X are
// spreading like a plague". The subject may be a group or "they" / "these people", since a reply
// often names its target only in the post it answers. Added 2026-10-23 from the feed test.
export const SIMILE_VERBS = ["infecting", "infect", "infests", "infesting", "infest", "breeding", "breed", "multiplying", "multiply",
  "swarming", "swarm", "spreading", "spread", "invading", "invade", "crawling"];
export const SIMILE_NOUNS = ["parasites", "vermin", "rats", "cockroaches", "roaches", "locusts", "leeches", "lice", "termites",
  "maggots", "a plague", "the plague", "a virus", "a cancer", "cancer", "a disease", "an infection", "a pestilence"];
export const SIMILE_SUBJECTS = ["these people", "those people", "such people"];
// After a bare "they", only verbs said of people or vermin: weeds and rumours also "spread".
export const SIMILE_THEY_VERBS = ["infecting", "infect", "infesting", "infest", "breeding", "breed", "multiplying", "multiply",
  "swarming", "swarm", "invading", "invade"];

// "An infestation of X", "hordes of X".
export const SWARM = ["infestation", "plague", "swarm", "swarms", "horde", "hordes"];

export const DEHUMANISE = ["vermin", "rats", "cockroaches", "roaches", "parasites", "leeches", "animals", "savages", "subhuman",
  "sub-human", "infestation", "plague", "disease", "cancer", "filth", "scum", "pigs", "insects", "invaders", "a virus", "apes",
  "monkeys", "beasts", "dogs"];

// Physical harm only: deporting or jailing people under a law is a policy position, not a marker.
export const VIOLENCE_VERBS = ["shot", "hanged", "hung", "executed", "killed", "exterminated", "eradicated", "wiped out", "gassed", "genocided",
  "lynched", "beaten", "burned alive", "purged", "eliminated",
  "murdered", "tortured"];

// Active calls: "we should exterminate X", "let's kill all the X". Physical harm only, as above.
export const KILL_VERBS = ["exterminate", "kill", "shoot", "hang", "gas", "lynch", "wipe out", "eradicate", "massacre",
  "slaughter", "execute", "burn", "genocide", "nuke", "murder", "torture"];

// Death wishes after "deserve to", "should all": "X deserve to die".
export const DEATH_WISH = ["die", "rot", "burn in hell", "be put down", "be wiped off the earth"];

export const VIOLENT_SLOGANS = ["free helicopter rides", "day of the rope", "string them up", "line them up", "round them up",
  "hang them all", "kill them all", "deport them all", "send them all back", "nuke them", "nuke the bastards", "pull out the guns",
  "get rid of them all", "guillotine them", "guillotines for", "bring out the guillotines", "bash the fash", "punch a nazi"];

export const VIGILANTE = ["will deal with them", "deal with them ourselves", "take care of them ourselves",
  "take matters into our own hands", "take matters into their own hands", "bring in the army", "bring their armies in",
  "bring their armies", "send in the army", "send in the military", "where's the military", "wheres the military",
  "where is the military", "where's the army", "where is the army", "time to arm up", "lock and load"];

export const CONSPIRACY = ["they don't want you to know", "they dont want you to know", "wake up people", "wake up, people",
  "time to wake up", "wake up sheeple", "sheeple", "do your own research", "it's all planned", "its all planned", "false flag",
  "paid actors", "crisis actors", "controlled opposition", "the media is hiding", "the media won't tell you",
  "the media wont tell you", "puppet masters", "great replacement", "funded by soros", "paid by soros", "soros funded",
  "soros-funded", "funded by the kochs", "koch funded", "koch-funded", "paid by the cia", "cia op", "psyop", "plandemic",
  "new world order", "deep state", "shadow government"];

export const ABSOLUTIST = ["traitors", "traitor", "enemy of the people", "enemies of the people", "enemies within", "enemy within",
  "civil war now", "civil war is coming", "time for civil war", "no middle ground", "you're either with us", "youre either with us",
  "real americans", "real patriots", "true french", "vrais français", "real french", "race traitor", "class traitor",
  "purge them", "the final solution", "treason", "treasonous"];

// Claims about a whole group, and replacement framing.
export const ESSENTIALISE = ["import third world", "import the third world", "importing the third world", "become third world",
  "is cultural", "it's in their blood", "its in their blood", "in their culture", "in their dna", "it's in their nature",
  "the natives are", "defend their own country", "defend our own country", "replace us", "replacing us",
  "demographic replacement", "cultural suicide", "acab", "all cops are bastards", "invaders multiply", "the invaders", "foreign invaders", "they breed",
  "outbreeding us", "civilizational suicide"];

// Stereotype traits: "<group> are <trait>" names a whole group by a trait.
export const STEREOTYPE_TRAITS = ["lazy", "criminals", "criminal", "thieves", "violent", "dirty", "filthy", "stupid", "dumb",
  "terrorists", "rapists", "savage", "greedy", "inbred", "degenerates", "degenerate", "pedophiles", "paedophiles", "groomers",
  "welfare queens", "freeloaders", "invaders", "breeders", "subhuman", "trash", "liars", "cheats", "brainwashed", "sheep", "evil",
  "disgusting", "worthless", "useless", "ugly", "garbage"];

// Groups named by faith, race or ethnicity, for the stereotype grammar added from the 2026-10-23 feed
// test. Political and class groups are left out on purpose: "billionaires control the media" is an
// argument about power, while "Jews control the media" names a people by an invented trait. Every
// faith and every race in GROUPS is here, whichever side usually targets it.
export const IDENTITY_GROUPS = ["muslims", "moslems", "jews", "christians", "hindus", "sikhs", "atheists", "catholics",
  "evangelicals", "mormons", "arabs", "africans", "blacks", "black people", "whites", "white people", "asians", "latinos",
  "hispanics", "roma", "caucasians", "jewish people", "muslim people", "christian people", "arab people", "asian people"];
// Peoples named by origin ("chinese" and "irish" are left out: they are also adjectives, as in
// "dirty chinese restaurant"). They join IDENTITY_GROUPS where a nationality cannot mean an army or a
// state ("illiterate X", "X will be our downfall"), and stay out where it can ("X will attack").
export const ORIGIN_GROUPS = ["immigrants", "migrants", "refugees", "foreigners", "asylum seekers", "mexicans",
  "indians", "pakistanis", "somalis", "haitians", "russians", "ukrainians", "americans", "europeans", "natives", "africans",
  "koreans", "nigerians", "afghans", "syrians", "turks", "poles", "romanians", "albanians", "italians", "germans"];
// "Jewish money controls ...", "Christian cabal", "white elites run ...": control put on a people.
export const CONTROL_NOUNS = ["cabal", "cabals", "money", "lobby", "bankers", "elite", "elites", "interests", "power brokers",
  "globalists", "puppet masters"];
export const CONTROL_VERBS = ["control", "controls", "controlled", "run", "runs", "own", "owns", "dictate", "dictates",
  "call the shots", "calls the shots", "calling the shots", "pull the strings", "pulls the strings", "pulling the strings"];
export const CONTROL_OBJECTS = ["the media", "media", "the news", "the government", "government", "the banks", "banks",
  "hollywood", "congress", "washington", "the world", "the economy", "policy", "foreign policy", "the law", "law", "laws",
  "politics", "everything", "the country", "this country", "our country", "america", "europe", "the west", "wall street",
  "finance", "the money", "the courts", "the un"];
// A whole people predicted to attack: "the Muslims will probably attack them".
export const ATTACK_VERBS = ["attack", "rape", "kill", "bomb", "behead", "stab", "rob", "murder", "terrorise", "terrorize",
  "massacre", "invade"];
// A people as a country's ruin: "X immigrants will cause your downfall".
export const RUIN_NOUNS = ["downfall", "destruction", "ruin", "end", "death", "collapse"];
// A trait word put before a people: "illiterate X", "inbred X".
export const ATTRIBUTIVE_TRAITS = ["illiterate", "lazy", "filthy", "dirty", "inbred", "savage", "subhuman", "backward",
  "uncivilised", "uncivilized", "primitive", "smelly", "stinking", "parasitic"];

// Intensifiers allowed between "are" and the trait: "X are fucking stupid", "X are inherently violent".
export const INTENSIFIERS = ["fucking", "so", "too", "really", "damn", "inherently", "naturally", "genetically", "always",
  "basically", "literally", "very"];

// Invented motives: "<group> want to destroy / replace / ban ..." puts an aim in a whole group's mouth.
export const MOTIVE_VERBS = ["destroy", "replace", "ban", "erase", "kill", "eliminate", "enslave", "take over", "wipe out",
  "outbreed", "control", "groom", "indoctrinate"];

// Slurs and coded terms that read as hateful on their own (weight 2).
export const SLURS = [
  // anti-Black
  "nigger", "niggers", "coon", "coons", "jigaboo", "porch monkey", "porch monkeys", "sambo", "darkie", "darkies", "jungle bunny",
  "spearchucker", "groid", "groids", "sheboon", "pavement ape", "chimp out", "chimped out",
  "black fatigue", "13/50", "despite being 13", "basketball americans", "fatherless behavior", "fatherless behaviour",
  "planet of the apes",
  // anti-Asian
  "chink", "chinks", "gook", "gooks", "slant eye", "slant eyes", "slanty", "zipperhead", "ching chong", "kung flu",
  "chinese virus", "china virus",
  // anti-South Asian
  "paki", "pakis", "pajeet", "pajeets", "curry muncher", "poo in loo",
  // anti-Latino
  "wetback", "wetbacks", "beaner", "beaners", "spic", "spics",
  // antisemitic
  "kike", "kikes", "hymie", "heeb", "heebs", "goyim know", "the goyim", "zog", "the jq", "6 million wasn't enough",
  "oy vey shut it down", "early life section", "the noticing",
  // added 2026-10-23 from the feed test; Blue Square Alliance, "Antisemitic Dog Whistles", 2025-08-22
  // (project-docs/evidence/LEXICON-SOURCES.md)
  "noticing will continue", "#thenoticing",
  // anti-Arab and anti-Muslim
  "towelhead", "towelheads", "raghead", "ragheads", "sand nigger", "sand niggers", "camel jockey", "mudslime", "mudslimes",
  "muzrat", "muzrats", "sand people", "goat lovers",
  // anti-Indigenous and anti-Roma
  "redskin", "redskins", "injun", "injuns", "squaw", "gyppo", "gyppos",
  // anti-white
  "whitey", "cracka", "crackas", "white devil", "peckerwood", "white devils", "kill all whites",
  // added 2026-10-21 (side-recall fix; sources in project-docs/evidence/LEXICON-SOURCES.md)
  "white trash", "trailer trash", "wigger", "wiggers", "whigger", "whiggers", "mudshark", "mudsharks",
  // anti-Christian and anti-Catholic
  "bible thumper", "bible thumpers", "bible-thumper", "bible-thumpers", "fundie", "fundies", "christofascist", "christofascists",
  "papist", "papists", "christard", "christards",
  // aimed at men and at conservatives
  "cuck", "cucks", "cuckservative", "cuckservatives", "soyboy", "soyboys", "soy boy", "soy boys",
  // anti-LGBTQ
  "faggot", "faggots", "tranny", "trannies", "troon", "troons", "shemale", "shemales", "poofter",
  // disability
  "retard", "retards", "retarded", "spaz", "spastic", "mongoloid",
  // misogynist and anti-men
  "foid", "foids", "femoid", "femoids", "roastie", "roasties", "kill all men", "men are trash",
  // neo-Nazi
  "1488", "14/88", "14 words", "sieg heil", "hitler was right", "hitler where are you", "hitler... where are you",
];

// Cues that turn "notice" into the antisemitic "noticing" code when they sit within a few words of it
// ("oy vey, stop noticing"). "Oy vey" and "goy" alone stay unmarked: both are ordinary Yiddish.
export const NOTICING_CUES = ["oy vey", "oy vei", "goy", "goys", "goyim", "goyum"];

// Context-dependent: innocent in many uses (weight 1, counted only beside another marker).
// Moved from SLURS on 2026-10-21: the upper 95% bound of their dev-split precision was under 0.75
// (project-docs/EVALUATION.md). One anti-white and one anti-Black term; the rule is the same for every list.
export const SLURS_DEMOTED = ["honky", "honkies", "honkey", "dindu", "dindu nuffin"];

export const SLURS_SOFT = [...SLURS_DEMOTED, "leftoid", "leftoids", "rightoid", "rightoids", "leftards", "conservatards", "suicidal empathy", "woke mind virus", "mind virus", "w0keism", "wokeism", "the fatigue is real", "fatigue is real", "jogger", "joggers", "cracker", "crackers", "groomers",
  "religion of peace", "it's always them", "its always them", "thug", "thugs", "ghetto", "illegals", "dyke", "dykes", "thot",
  "thots", "fag", "fags", "cripple", "cripples", "gypsy", "gypsies", "jap", "japs", "spook", "spooks", "uppity"];

// Disguised spellings: "n1gg3r", "f@g", "k1ke". Applied before slur matching only.
// "<identity> bitch", "<identity> whores": a gendered slur fused with an identity word. The same
// identity words for every direction (tests/rhetoric.symmetry.test.js).
export const IDENTITY_ADJ = ["white", "black", "asian", "mexican", "jewish", "arab", "muslim", "latina", "latino", "brown",
  "indian", "chinese", "gay", "christian", "hispanic"];
export const GENDERED_SLURS = ["bitch", "bitches", "hoe", "hoes", "whore", "whores", "slut", "sluts", "cunt", "cunts"];

export const LEET = { "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "@": "a", "$": "s", "!": "i" };

// "They hate beauty / us / the West": a hatred put in a whole group's mouth (counts as motive).
export const HATRED_OBJECTS = ["beauty", "us", "the west", "western civilization", "our way of life", "our culture", "our freedom",
  "freedom", "christians", "jews", "muslims", "white people", "black people", "women", "america", "europe", "france"];

// Declared hatred of a whole group ("I hate X", "fuck all the X"). Weight 1: anger counts for
// little on its own, and it never labels the post.
export const CONTEMPT_VERBS = ["hate", "despise", "loathe", "can't stand", "cant stand"];
