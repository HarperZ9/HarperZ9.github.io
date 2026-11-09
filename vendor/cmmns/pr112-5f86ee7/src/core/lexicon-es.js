// Spanish word lists for the stance-neutral markers in rhetoric-es.js. Same families and the same
// rule as lexicon.js: a group named with marker grammar counts, disagreement and policy do not.
// Accented and unaccented spellings are both listed, since replies often drop accents. Sources:
// project-docs/evidence/LEXICON-SOURCES.md.

export const GROUPS_ES = [
  // origen, religión, nacionalidad
  "inmigrantes", "migrantes", "extranjeros", "refugiados", "musulmanes", "judíos", "judios", "cristianos", "católicos",
  "catolicos", "ateos", "árabes", "arabes", "africanos", "negros", "blancos", "gitanos", "latinos", "sudamericanos",
  "marroquíes", "marroquies", "rumanos", "chinos", "españoles", "espanoles", "catalanes", "vascos", "mexicanos",
  "venezolanos", "menas",
  // política, incluidos los apodos acuñados por cada lado
  "rojos", "progres", "comunistas", "socialistas", "izquierdistas", "zurdos", "kukas", "chairos", "perroflautas",
  "podemitas", "feminazis", "fachas", "fachos", "fascistas", "nazis", "derechistas", "conservadores", "liberales",
  "fifís", "fifis", "peperos", "voxeros", "nacionalistas", "independentistas", "separatistas",
  // clase, papel, identidad
  "ricos", "millonarios", "multimillonarios", "empresarios", "banqueros", "políticos", "politicos", "policías",
  "policias", "maderos", "manifestantes", "periodistas", "feministas", "homosexuales", "gays", "trans", "mujeres",
  "hombres", "curas", "okupas",
];

export const DEHUMANISE_ES = ["ratas", "cucarachas", "parásitos", "parasitos", "alimañas", "sabandijas", "animales",
  "bestias", "salvajes", "infrahumanos", "subhumanos", "plaga", "una plaga", "un cáncer", "cáncer", "cancer", "escoria",
  "basura", "gusanos", "piojos", "cerdos", "monos", "simios", "chusma", "lacra", "garrapatas", "virus"];

// Infinitives after "hay que", "tenemos que": physical harm only. Deporting or jailing is policy.
export const KILL_INF_ES = ["matar", "exterminar", "fusilar", "ahorcar", "colgar", "gasear", "masacrar", "erradicar",
  "quemar", "linchar", "ejecutar", "liquidar", "pegar un tiro a", "pegarles un tiro a"];

// Participles after "merecen ser", "deberían ser".
export const KILL_PP_ES = ["fusilados", "fusiladas", "ahorcados", "ahorcadas", "colgados", "exterminados", "exterminadas",
  "asesinados", "asesinadas", "gaseados", "masacrados", "eliminados", "eliminadas", "quemados", "quemadas", "linchados",
  "ejecutados", "ejecutadas", "aniquilados", "erradicados"];

export const STEREOTYPE_TRAITS_ES = ["criminales", "delincuentes", "ladrones", "violadores", "terroristas", "violentos",
  "vagos", "sucios", "salvajes", "bárbaros", "barbaros", "degenerados", "pedófilos", "pedofilos", "invasores",
  "mentirosos", "estúpidos", "estupidos", "subnormales", "retrasados"];

export const CONSPIRACY_ES = ["gran reemplazo", "gran sustitución", "gran sustitucion", "plan kalergi", "plandemia",
  "nuevo orden mundial", "estado profundo", "falsa bandera", "despierten, borregos", "despertad, borregos", "despertad borregos",
  "pagados por soros", "financiados por soros", "pagados por putin", "financiados por putin",
  "los medios os ocultan", "los medios te ocultan", "los medios nos ocultan"];

// Slogans with the group named ("muerte a los X", "X al paredón") are built in rhetoric-es.js.
export const SLOGANS_ES = ["matarlos a todos", "hay que matarlos a todos", "fusilarlos a todos", "colgarlos a todos"];

// Slurs that read as hateful on their own in Spanish. Context-dependent words (moro, panchito,
// gitano) are left out; they are group names or snacks as often as slurs.
export const SLURS_ES = ["sudaca", "sudacas", "negrata", "negratas", "moromierda", "moromierdas", "maricón", "maricones",
  "maricon", "joto", "jotos", "mongoloide", "mongoloides"];
