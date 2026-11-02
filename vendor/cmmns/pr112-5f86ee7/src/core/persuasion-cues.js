// Cue lists for persuasion.js, one regex fragment per cue. No cue names a group, person, party,
// ideology or side, so the same sentence scores alike whoever it is about. Tuned on the PTC dev
// split: a cue stays when its dev hits mostly fall on spans the annotators labelled with that
// technique (scripts/eval/persuasion-eval.mjs --split dev --cues).

const W = "[\\w'-]+";
// Up to `n` characters of French words and spaces, starting and ending on a letter.
const FR_WORDS = (n) => `\\p{L}[\\p{L}' ]{0,${n}}\\p{L}`;

export const CUES_EN = {
  "loaded-language": [
    "disgraceful", "despicable", "shameful", "shamelessly", "horrific", "horrifying", "horror", "appalling",
    "atrocious", "heinous", "sickening", "disgusting", "disgusted", "vile", "wicked", "sinister", "barbaric", "draconian",
    "hysteria", "hysterical", "insane", "insanity", "deranged", "unhinged", "diabolical",
    "catastrophic", "disastrous", "bloodbath", "smear(?:s|ed|ing)?", "demoni[sz](?:e|es|ed|ing)",
    "vilification", "nefarious", "treacherous", "ruthless", "brutal", "brutally", "vicious(?:ly)?", "obscene", "grotesque",
    "shocking", "terrifying", "disturbing", "destructive", "pathetic", "laughable", "phony", "bogus", "nonsense", "farce",
    "charade", "egregious", "abominable", "blatant(?:ly)?", "dishonest", "hypocritical",
    "sheer", "ugly", "scandali[sz]ed",
  ],
  "name-calling": [
    "idiots?", "morons?", "imbeciles?", "clowns?", "thugs?", "crooks?", "liars?", "lunatics?", "loons?", "zealots?",
    "bigots?", "hypocrites?", "snowflakes?", "sheeple", "puppets?", "stooges?", "shills?", "lackeys?", "henchmen",
    "demagogues?", "tyrants?", "despots?", "grifters?", "charlatans?", "quacks?", "traitors?", "psychopaths?",
    "haters", "witch[- ]hunts?", "self-styled", "self-proclaimed", "wannabes?",
  ],
  "bandwagon": [
    "everyone knows", "everybody knows", "everyone agrees", "everybody agrees", "we all know", "as we all know",
    "everyone can see", "everybody can see", "the whole world knows", "the whole world can see",
    "most people (?:agree|know|realize|realise|believe)", "nobody believes", "no one believes",
    "millions of (?:people|us) (?:agree|know|are waking up)", "people are waking up", "join the millions",
    "(?:the )?overwhelming majority (?:of (?:people|us) )?(?:agree|know|want|believe)s?",
  ],
  "appeal-to-fear": [
    "before it'?s too late", "you could be next", "you(?:'re| are) next", "no one is safe", "nobody is safe",
    "existential threat", "be afraid", "be very afraid", "(?:are|is) coming for (?:you|your|our)",
    "threat to (?:our|your) (?:children|kids|families|way of life|freedom|freedoms|safety|survival)",
    "(?:will|could|would) (?:destroy|wipe out|end) (?:our|this|the) (?:country|nation|way of life|civilization|civilisation|democracy|freedom)",
    "the end of (?:our|this|the) (?:country|nation|republic|democracy|civilization|civilisation|way of life)",
    "lose everything", "our children (?:are|will be) (?:in danger|at risk|next)",
  ],
  "flag-waving": [
    "as (?:americans|patriots|a nation|a people)", "(?:real|true) (?:americans|patriots|citizens)", "un-?american",
    "unpatriotic", "our great (?:nation|country)", "this great (?:nation|country)", "patriotic duty",
    "love (?:our|this) country", "for the sake of our (?:nation|country)", "national (?:pride|honou?r)",
    "the greatest (?:country|nation)", "god bless (?:america|our country)", "(?:betray|betrayal of|betraying|betrayed) (?:our|the|this) (?:country|nation)",
    "our (?:sovereignty|heritage|forefathers|founding fathers)",
    // a nation's people named as one will ("the American people", "the Iranian people"); case-sensitive
    { cue: "[Tt]he [A-Z][a-z]+(?:an|ian|ish|ese|i|ch) people", caseSensitive: true },
  ],
  "thought-terminating": [
    "it is what it is", "end of (?:story|discussion|debate)", "enough said", "nuff said", "let that sink in",
    "think about (?:that|it)", "do your (?:own )?research", "wake up,? (?:people|sheeple|america|everyone)",
    "that'?s (?:just )?the way it is", "you can'?t make this (?:stuff )?up", "the science is settled",
    "facts don'?t care about your feelings", "boys will be boys", "it'?s not rocket science", "case closed",
    "don'?t be fooled", "the truth is out there", "say no more",
  ],
  "whataboutism": [
    "(?:but |and |so )?what about (?:the|when|all|their|his|her|those|them)",
    "where (?:was|were) (?:the )?(?:outrage|you|they|these people) when",
    "funny how (?:no one|nobody)", "(?:nobody|no one) (?:said|says|cared|complained) (?:anything|a word) when",
    "why (?:is|was|isn'?t|wasn'?t) (?:no one|nobody|anyone) talking about",
  ],
  "black-and-white": [
    "(?:you'?re|you are) either with us or", "either (?:you|we) (?:are|stand|support)" + `(?: ${W}){1,6}` + ",? or (?:you|we)",
    "there (?:are|is) only two (?:options|choices|sides|kinds|types)", "there is no (?:middle ground|third option|alternative)",
    "the only (?:choice|option|alternative) is", "if you'?re not with us", "if you (?:are not|aren'?t) with us",
    "if you (?:are not|aren'?t) part of the solution",
  ],
  "doubt": [
    "questions? (?:remain|linger)s?", "(?:can|should) (?:we|you) (?:really )?(?:trust|believe)",
    "is (?:it|this|that|he|she) really", "(?:conveniently|suspiciously)", "if (?:that|this|it) is (?:even )?true",
    "(?:dubious|questionable|bogus) (?:claims?|evidence|science|data)", "who (?:really )?benefits",
  ],
  "appeal-to-authority": [
    "experts (?:say|agree|warn|believe)", "scientists (?:say|agree|warn|believe)", "studies (?:show|prove)",
    "according to (?:experts|scientists|doctors|economists)", "(?:leading|top|renowned|respected|prominent) (?:experts?|scientists?|doctors?|economists?)",
    "(?:doctors|economists) agree", "science says", "research (?:shows|proves)",
  ],
  "exaggeration": [
    "(?:the )?(?:worst|greatest|biggest|best) " + `(?:${W} ){0,2}` + "(?:in (?:human |american |modern |recorded )?history|ever|of all time)",
    "never (?:before )?in (?:human |our |modern )?history", "like never before",
    "(?:totally|completely|utterly) (?:destroyed|ruined|failed|collapsed)", "the most " + `${W} ${W}` + " in history",
    "a million times", "beyond (?:belief|comprehension)", "of epic proportions",
  ],
  "motive-attribution": [
    "(?:masked|disguised|dressed up|masquerading) as", "under the guise of", "the real (?:reason|agenda|motive|goal|aim|purpose|plan)",
    "(?:hidden|secret|true) (?:agenda|motive|motives|aim|aims|plan)", "secretly (?:want|wants|wanted|plan|plans|planning|working|trying|hoping)",
    "textbook (?:move|tactic|playbook|strategy|propaganda)", "(?:it|this) (?:was|is) never (?:really )?about", "(?:just|only|merely) a (?:cover|pretext|smokescreen|front) for",
    "what (?:they|he|she) (?:really|actually) want", "(?:their|his|her) real (?:intention|intentions|motive|motives)",
  ],
  "just-asking": [
    "just asking(?: (?:questions|a question))?", "i'?m just asking", "just a question", "(?:makes|make|should make) you (?:wonder|think)",
    "isn'?t it (?:strange|odd|funny|interesting|curious|convenient) (?:that|how)", "why (?:is|are) (?:no one|nobody) asking",
    "ask yourselves? (?:why|who|how)", "is (?:it|this) (?:just )?(?:a )?coincidence", "coincidence\\?", "(?:one|you) (?:has|have) to wonder",
    "i'?m not saying (?:it|they|he|she|that)[^.?!]{0,40}but",
  ],
};

// French cues for the same techniques. SemEval-2023 Task 3 has French data, but its terms allow use
// only inside that shared task, so the French cues have no measurement of their own. They show only
// for a technique the English measurement ships, and the window says the French cues are unmeasured.
export const CUES_FR = {
  "loaded-language": [
    "scandaleu(?:x|se|ses)", "honteu(?:x|se|ses)", "ignoble(?:s)?", "abject(?:e|es|s)?", "odieu(?:x|se|ses)", "infâme(?:s)?",
    "répugnant(?:e|es|s)?", "écœurant(?:e|es|s)?", "monstrueu(?:x|se|ses)", "diabolique(?:s)?", "sinistre(?:s)?",
    "barbare(?:s)?", "délirant(?:e|es|s)?", "hystérique(?:s)?", "hystérie", "catastrophique(?:s)?", "désastreu(?:x|se|ses)",
    "nauséabond(?:e|es|s)?", "abominable(?:s)?", "grotesque(?:s)?", "pathétique(?:s)?", "ridicule(?:s)?", "mascarade",
    "imposture", "infamie", "diabolis(?:er|é|ée|és|ées|ent|e)",
  ],
  "name-calling": [
    "idiots?", "crétins?", "imbéciles?", "abrutis?", "clowns?", "voyous?", "escrocs?", "menteu(?:r|rs|se|ses)",
    "fanatiques?", "hypocrites?", "marionnettes?", "pantins?", "laquais", "larbins?", "valets?", "sbires?", "traîtres?",
    "charlatans?", "démagogues?", "tyrans?", "despotes?", "soi-disant", "autoproclamé(?:e|es|s)?",
  ],
  "bandwagon": [
    "tout le monde (?:le )?sait", "tout le monde est d'accord", "nous savons tous", "on le sait tous", "comme chacun sait",
    "personne n'y croit", "les gens se réveillent", "la majorité des gens (?:pense|sait|veut)",
  ],
  "appeal-to-fear": [
    "avant qu'il ne soit trop tard", "avant qu'il soit trop tard", "vous serez les prochains", "personne n'est à l'abri",
    "menace existentielle", "menace pour (?:nos|vos) (?:enfants|familles|libertés)",
    "(?:va|vont|pourrait|pourraient) détruire (?:notre|ce) (?:pays|nation|civilisation|démocratie|mode de vie)",
    "la fin de (?:notre|la) (?:pays|nation|république|démocratie|civilisation)",
  ],
  "flag-waving": [
    "en tant que (?:patriotes|nation|citoyens|peuple)", "(?:vrais|véritables) (?:patriotes|citoyens)", "antipatriotique",
    "notre grande? (?:nation|pays)", "devoir patriotique", "fierté nationale", "honneur national",
    "trahi(?:r|t|son de)? (?:notre|la) (?:patrie|nation)", "le peuple (?:français|belge|suisse|canadien|québécois|allemand|américain|italien|espagnol|russe|chinois|ukrainien|israélien|palestinien|algérien|marocain)",
  ],
  "thought-terminating": [
    "c'est comme ça", "fin de (?:l'histoire|la discussion|du débat)", "tout est dit", "point final", "faites vos recherches",
    "réveillez-vous", "on ne peut pas inventer ça", "c'est du bon sens", "circulez,? il n'y a rien à voir",
  ],
  "whataboutism": [
    "et (?:que dire de|qu'en est-il de|pourquoi pas) ", "où (?:était|étaient) (?:l'indignation|vous|ils) quand",
    "bizarrement,? personne", "personne n'a rien dit quand",
  ],
  "black-and-white": [
    "(?:vous êtes|tu es) avec nous ou contre nous", "soit (?:vous|on|nous) " + FR_WORDS(40) + ",? soit", "il n'y a que deux (?:options|choix|camps)",
    "il n'y a pas d'alternative", "pas de juste milieu", "la seule (?:option|solution|alternative) est",
  ],
  "doubt": [
    "des questions (?:demeurent|subsistent)", "peut-on (?:vraiment )?(?:croire|faire confiance)", "est-ce vraiment",
    "comme par hasard", "étrangement", "à qui profite le crime",
  ],
  "appeal-to-authority": [
    "les experts (?:disent|affirment|s'accordent|préviennent)", "les scientifiques (?:disent|affirment|s'accordent)",
    "les études (?:montrent|prouvent)", "selon les experts", "la science (?:dit|a tranché)",
  ],
  "exaggeration": [
    "(?:le|la) (?:pire|plus grand(?:e)?) " + FR_WORDS(30) + " (?:de l'histoire|de tous les temps)", "jamais (?:vu )?dans l'histoire",
    "sans précédent", "(?:totalement|complètement) (?:détruit|ruiné|anéanti)(?:e|es|s)?", "un million de fois",
  ],
};
