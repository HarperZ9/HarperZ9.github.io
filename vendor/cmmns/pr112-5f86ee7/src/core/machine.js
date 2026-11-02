// Signs of machine-written text and spam in a reply. A light port of Articulate's AI-tell lists
// (Articulate, rules_medium_register.py) plus reply-bot and spam patterns.
//
// Why it is cautious: no detector reliably tells human from machine writing in a few sentences,
// and AI detectors are known to flag non-native English writers far more often (Liang et al.,
// 2023; Articulate's own fairness gates measure this). So:
//   - a leaked AI artifact ("As an AI language model") is strong evidence on its own;
//   - word-choice tells only count when several independent ones appear in a reply long enough to
//     judge (MIN_WORDS), and even then the label says "signs", never "written by AI";
//   - none of this is an account flag. It labels the reply, and counts in the thread report.

// Articulate's inflated-word pack (the core list), unchanged.
const INFLATED = /\b(?:delve[sd]?|delving|utili[sz]e[sd]?|utili[sz]ing|showcas(?:e[sd]?|ing)|seamless(?:ly)?|robust(?:ness)?|pivotal|crucial(?:ly)?|realm|landscape|tapestry|testament|nuanced|multifaceted|holistic(?:ally)?|myriad|plethora|endeavou?rs?|facilitate[sd]?|elevate[sd]?|elevating|embark(?:ing|ed)?|unlock(?:s|ing|ed)?|spearhead(?:s|ing|ed)?|resonate[sd]?|resonating|illuminat(?:e[sd]?|ing)|intricate(?:ly)?|meticulous(?:ly)?|comprehensive(?:ly)?|vibrant|bustling|garner(?:s|ing|ed)?|foster(?:s|ing|ed)?|cultivat(?:e[sd]?|ing)|underpin(?:s|ning|ned)?|streamlin(?:e[sd]?|ing)|paramount|transformative|groundbreaking|navigat(?:e[sd]?|ing) the (?:complexit\w*|landscape|challeng\w*|nuance\w*)|complexities of)\b/gi;

// Articulate's stock connectives and throat-clearing frames, as reply-sized phrases.
const STOCK = /\b(?:moreover|furthermore|additionally|that being said|in essence|ultimately|it'?s (?:important|worth|crucial) to (?:note|remember|consider)|at its core|when it comes to|in today'?s [a-z]+ (?:world|landscape|era)|a testament to|plays a (?:crucial|pivotal|vital) role)\b/gi;

// Reply-bot openers and closers: generic praise and engagement bait that fits any post.
const BOT_FRAME = /^(?:great (?:point|post|question|insight)s?|absolutely|this is (?:so )?(?:true|insightful|powerful)|well said|so true|couldn'?t agree more)\b|\b(?:what do you think\??|thoughts\??|let'?s discuss|agree\??)\s*$/i;

// Leaked artifacts: text a chatbot produced and a bot posted without editing.
const LEAK = /\b(?:as an ai(?: language model)?|i'?m (?:just )?an ai|i cannot (?:fulfill|comply with) (?:that|this) request|i (?:can'?t|cannot) assist with that|my (?:knowledge cutoff|training data)|here(?:'s| is) (?:a|an) (?:reply|response|tweet|comment) (?:to|for|that)|certainly! here|sure! here(?:'s| is)|\[insert [a-z ]+\]|regenerate response)\b/i;

// Spam: giveaways, crypto, adult and contact bait.
const SPAM = /\b(?:dm me|check (?:my|the) (?:bio|pinned)|link in (?:my )?bio|(?:crypto|nft|free|cash) giveaway|giveaway (?:link|alert|winners?)|airdrop|free (?:crypto|btc|eth|usdt)|claim your|whatsapp\s*\+?\d|telegram\s*@|onlyfans|0nlyfans|sugar daddy|investment (?:manager|opportunity)|earn \$?\d+[k]? (?:daily|weekly|a day)|forex|binary options|recover (?:your )?(?:lost|stolen) (?:funds|crypto))\b/i;

export const MIN_WORDS = 25;

// Returns { leak, spam, signs: [...], machineLike } for one reply.
export function machineSigns(text) {
  const s = String(text || "").replace(/[’]/g, "'");
  const words = (s.match(/\b\w+\b/g) || []).length;
  const leak = (s.match(LEAK) || [null])[0];
  const spam = (s.match(SPAM) || [null])[0];
  const signs = [];
  const inflated = [...new Set((s.match(INFLATED) || []).map((w) => w.toLowerCase()))];
  const stock = [...new Set((s.match(STOCK) || []).map((w) => w.toLowerCase()))];
  if (inflated.length >= 2) signs.push(`inflated words: ${inflated.slice(0, 4).join(", ")}`);
  if (stock.length) signs.push(`stock phrases: ${stock.slice(0, 3).join(", ")}`);
  if (BOT_FRAME.test(s.trim())) signs.push("generic praise or engagement bait");
  if ((s.match(/—/g) || []).length >= 2) signs.push("several em dashes");
  if (/(?:^|\n)\s*(?:[-•*]|\d\.)\s.+(?:\n\s*(?:[-•*]|\d\.)\s.+){2,}/.test(s)) signs.push("list formatting in a reply");
  if ((s.match(/#\w+/g) || []).length >= 4) signs.push("many hashtags");
  // Word-choice signs only mean something in a reply long enough to judge, and only together.
  const machineLike = !!leak || (words >= MIN_WORDS && signs.length >= 3);
  return { leak, spam, signs, machineLike, words };
}
