// The words the radar-core API puts on evidence items: labels, what a sign shows, where it came
// from and how to read it. They are the same words the extension's window uses
// (src/ext/signals.js and src/ext/panel.js), kept here so the API needs no DOM and no extension
// code. Every string is stance-neutral and names no account.

export const STRONG_LABEL = { slur: "slur or coded hate term", stereotype: "group stereotype", dehumanise: "dehumanising language", violence: "call for violence", vigilante: "call for vigilantes" };

export const STRONG_MEANING = {
  slur: "A slur, dog whistle or coined term with a documented hateful meaning (ADL Hate Symbols database, Hatebase, GNET, ISD).",
  stereotype: "Names a whole group of people by a trait, such as criminal, lazy or violent.",
  dehumanise: "Describes a group of people as vermin, disease, animals or filth.",
  violence: "Calls for violence or collective punishment against people.",
  vigilante: "Calls for people outside the law, or soldiers, to act against people.",
};

export const FLAG_LABEL = {
  "new-account": "new account", "name-changes": "renamed", "default-handle": "sign-up handle",
  "based-elsewhere": "speaks as local, labelled elsewhere", "same-text": "same text as others", "hate-symbol-name": "hate symbol in name",
  "store-elsewhere": "app store elsewhere", "flag-elsewhere": "flag of another country", "profile-location-elsewhere": "profile says elsewhere",
  "high-volume": "very high post rate", "hours-elsewhere": "active hours fit elsewhere", "fast-replier": "replies within a minute",
  "copied-elsewhere": "same words in other threads", "low-karma": "low karma for its age", "automation-app": "posts through an automation app",
  "no-sleep-gap": "posts around the clock", "repost-only": "almost only reposts", "follow-pattern": "follows many, few follow back",
  "platform-label": "moderation label", "brand-lookalike": "name borrows a brand",
};

export const SRC_RULES = "CMMNS' own rules, run on this device. Rules and measured error rates: CMMNS' EVALUATION.md.";
export const SRC_POSTS = "The posts in the input, as given, read by CMMNS on this device.";
export const SRC_ACCOUNTS = "Account details given in the input: what each platform discloses on profiles and About pages.";
export const SRC_FILE = "The file's bytes, read on this device: Content Credentials (C2PA) and IPTC or XMP metadata.";

export const STRONG_DOES_NOT_PROVE = "A match on the post's wording, which also turns up in quotes, irony and reported speech.";
export const LEAK_DOES_NOT_PROVE = "Chatbot boilerplate in the post, which people also paste as a quote or a joke.";
export const MACHINE_DOES_NOT_PROVE = "The post has three or more machine-writing signs. Detectors flag non-native English writers more often.";
export const SPAM_DOES_NOT_PROVE = "A giveaway or contact-detail pattern in the post, which real people post too.";
export const BURST_DOES_NOT_PROVE = "Replies that arrived within the same seconds, as they also do after a viral post or a mass notification. The test runs on times given to the second.";
export const COARSE_DOES_NOT_PROVE = "These times are rounded, so they can hide a burst or make one look like it.";
export const SITE_OWNER_DOES_NOT_PROVE = "The owner Wikidata lists, which can lag a sale and can differ from who runs the newsroom.";
export const THREAD_LIMIT = "This covers the posts in the input as given, in the order and selection the platform showed.";
export const TEXT_LIMIT = "This describes the wording of one piece of text.";
