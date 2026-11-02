// Italian word lists for the stance-neutral markers in rhetoric-it.js. Same families and the same
// rule as lexicon.js: a group named with marker grammar counts, disagreement and policy do not.
// Sources: project-docs/evidence/LEXICON-SOURCES.md.

export const GROUPS_IT = [
  // origine, religione, nazionalità
  "immigrati", "migranti", "stranieri", "profughi", "clandestini", "musulmani", "ebrei", "cristiani", "cattolici", "atei",
  "arabi", "africani", "neri", "bianchi", "rom", "zingari", "sinti", "meridionali", "settentrionali", "albanesi",
  "rumeni", "cinesi", "italiani", "nordafricani",
  // politica, compresi i soprannomi coniati da ciascuna parte
  "comunisti", "zecche", "zecche rosse", "piddini", "sinistroidi", "buonisti", "radical chic",
  "grillini", "fascisti", "fasci", "fasciorazzisti", "leghisti", "sovranisti", "destrorsi", "nazisti", "conservatori",
  "progressisti", "liberali",
  // classe, ruolo, identità
  "ricchi", "milionari", "miliardari", "banchieri", "padroni", "politici", "poliziotti", "sbirri", "carabinieri",
  "manifestanti", "giornalisti", "femministe", "gay", "omosessuali", "trans", "donne", "uomini", "preti",
];

export const DEHUMANISE_IT = ["ratti", "topi", "scarafaggi", "parassiti", "vermi", "animali", "bestie", "selvaggi",
  "subumani", "sottouomini", "piaga", "una piaga", "un cancro", "cancro", "feccia", "spazzatura", "immondizia", "porci",
  "maiali", "scimmie", "pidocchi", "zecche", "letame", "bestiame"];

// Infinitives after "bisogna", "dobbiamo": physical harm only. Expelling or jailing is policy.
export const KILL_INF_IT = ["uccidere", "ammazzare", "sterminare", "fucilare", "impiccare", "gasare", "massacrare",
  "bruciare", "linciare", "giustiziare", "sparare a", "sparare ai", "sparare agli", "sparare alle",
  "sopprimere"];

// Participles after "vanno", "meritano di essere", "dovrebbero essere".
export const KILL_PP_IT = ["fucilati", "fucilate", "impiccati", "impiccate", "uccisi", "uccise", "ammazzati",
  "ammazzate", "sterminati", "sterminate", "gasati", "massacrati", "eliminati", "eliminate", "bruciati", "bruciate",
  "linciati", "giustiziati", "appesi", "appesi a testa in giù", "soppressi"];

export const STEREOTYPE_TRAITS_IT = ["criminali", "delinquenti", "ladri", "stupratori", "terroristi", "violenti",
  "sporchi", "fannulloni", "scansafatiche", "stupidi", "barbari", "degenerati", "pedofili", "invasori", "bugiardi",
  "imbecilli", "ritardati"];

export const CONSPIRACY_IT = ["grande sostituzione", "sostituzione etnica", "piano kalergi", "plandemia",
  "nuovo ordine mondiale", "stato profondo", "falsa bandiera", "svegliatevi pecoroni", "svegliatevi, pecoroni",
  "pagati da soros", "finanziati da soros", "pagati da putin", "finanziati da putin", "i media vi nascondono",
  "i giornali non ve lo dicono"];

// Fixed slogans. "morte ai X" and "uccidere un X non è reato" are built in rhetoric-it.js.
export const SLOGANS_IT = ["ammazzarli tutti", "fucilarli tutti", "impiccarli tutti", "sterminarli tutti"];

// Slurs that read as hateful on their own in Italian. "negro" is left out because it is the
// ordinary word for black in Spanish and Portuguese, which share this scorer.
export const SLURS_IT = ["negri", "frocio", "froci", "culattone", "culattoni",
  "mongoloide", "mongoloidi"];
