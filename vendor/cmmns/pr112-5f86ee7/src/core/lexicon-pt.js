// Portuguese word lists (Brazil and Portugal) for the stance-neutral markers in rhetoric-pt.js.
// Same families and the same rule as lexicon.js: a group named with marker grammar counts,
// disagreement and policy do not. Accented and unaccented spellings are both listed. Sources:
// project-docs/evidence/LEXICON-SOURCES.md.

export const GROUPS_PT = [
  // origem, religião, nacionalidade
  "imigrantes", "migrantes", "estrangeiros", "refugiados", "muçulmanos", "muculmanos", "judeus", "cristãos", "cristaos",
  "evangélicos", "evangelicos", "católicos", "catolicos", "ateus", "árabes", "arabes", "africanos", "negros", "pretos",
  "brancos", "ciganos", "nordestinos", "paulistas", "venezuelanos", "haitianos", "bolivianos", "brasileiros",
  "portugueses", "angolanos", "indígenas", "indigenas",
  // política, incluídos os apelidos cunhados por cada lado
  "comunistas", "comunas", "socialistas", "esquerdistas", "esquerdopatas", "petistas", "petralhas", "petralhada",
  "mortadelas", "lulistas", "bolsonaristas", "bolsominions", "bolsonarada", "coxinhas", "minions", "direitistas",
  "fascistas", "nazistas", "conservadores", "liberais", "isentões", "isentoes",
  // classe, papel, identidade
  "ricos", "milionários", "milionarios", "bilionários", "bilionarios", "empresários", "empresarios", "banqueiros",
  "políticos", "politicos", "policiais", "polícias", "policias", "manifestantes", "jornalistas", "feministas", "gays",
  "homossexuais", "trans", "travestis", "mulheres", "homens", "pastores", "padres",
];

export const DEHUMANISE_PT = ["ratos", "baratas", "parasitas", "vermes", "verme", "animais", "bichos", "bestas",
  "selvagens", "sub-humanos", "subumanos", "praga", "uma praga", "um câncer", "câncer", "cancer", "um cancro", "cancro",
  "escória", "escoria", "lixo", "porcos", "macacos", "piolhos", "carrapatos", "gado", "chorume", "gentalha", "ralé", "rale"];

// Infinitives after "temos que", "vamos": physical harm only. Deporting or jailing is policy.
export const KILL_INF_PT = ["matar", "exterminar", "fuzilar", "enforcar", "metralhar", "massacrar", "erradicar",
  "queimar", "linchar", "executar", "chacinar", "dizimar", "passar fogo em", "meter bala em", "meter bala nos"];

// Participles after "merecem ser", "deveriam ser".
export const KILL_PP_PT = ["fuzilados", "fuziladas", "enforcados", "enforcadas", "exterminados", "exterminadas",
  "mortos", "mortas", "assassinados", "massacrados", "eliminados", "eliminadas", "queimados", "queimadas", "linchados",
  "executados", "executadas", "metralhados", "chacinados"];

export const STEREOTYPE_TRAITS_PT = ["criminosos", "bandidos", "ladrões", "ladroes", "vagabundos", "estupradores",
  "terroristas", "violentos", "preguiçosos", "preguicosos", "sujos", "burros", "selvagens", "bárbaros", "barbaros",
  "degenerados", "pedófilos", "pedofilos", "invasores", "mentirosos", "imbecis", "retardados"];

export const CONSPIRACY_PT = ["grande substituição", "grande substituicao", "grande reposição", "plano kalergi",
  "plandemia", "nova ordem mundial", "estado profundo", "falsa bandeira", "marxismo cultural", "globalismo",
  "pagos pelo soros", "pagos por soros", "financiados pelo soros", "financiados por soros", "pagos pelo putin",
  "pagos por putin", "financiados pelo putin", "a mídia esconde", "a midia esconde", "a mídia não mostra"];

// Fixed slogans. "morte aos X" with a named group is built in rhetoric-pt.js.
export const SLOGANS_PT = ["bandido bom é bandido morto", "bandido bom e bandido morto", "matar todos eles",
  "fuzilar todos eles", "tem que matar tudo"];

// Slurs that read as hateful on their own. Context-dependent words (crioulo is also a language
// name, bicha also a queue, veado also a deer) are left out.
export const SLURS_PT = ["viado", "viados", "paneleiro", "paneleiros", "mongolóide", "mongoloide",
  "mongolóides", "mongoloides"];
