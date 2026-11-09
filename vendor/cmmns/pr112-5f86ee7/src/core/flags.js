// Authenticity flags for one account, each with its evidence and what it does not prove.
// A flag is a reason to look closer, never a verdict. The thresholds are starting points to be
// calibrated against the hand-labelled threads (project-docs/EVALUATION.md).

import { parseLabel } from "./places.js";
import { LOW_KARMA } from "./reddit.js";
import { brandLookalike, BRAND_DOES_NOT_PROVE } from "./brands.js";

export const NEW_ACCOUNT_DAYS = 30;
export const MANY_NAME_CHANGES = 3;
// About 100 posts a day, every day, is beyond what most people sustain by hand.
export const HIGH_VOLUME_PER_DAY = 100;
// X suggests handles like "Name12345678" at sign-up; many throwaway accounts keep them.
export const DEFAULT_HANDLE = /^[A-Za-z]+_?[0-9]{6,}$/;

const DAY = 86400000;
// Moderation label values about authenticity. Labels about content (rude, intolerant, nudity)
// are shown on the card but never flag the account.
export const PLATFORM_AUTH_LABELS = new Set(["spam", "impersonation", "scam", "inauthentic", "engagement-farming"]);
// X's own apps; posts from anything else came through a third-party or automation tool.
const COMMON_APP = /^(?:Twitter|X) (?:for (?:iPhone|Android|iPad|Mac)|Web App|Web Client)$/;
// Self-chosen names that carry documented hate symbols (ADL Hate Symbols database).
const HATE_NAME = /(?:^|[^\d])(?:1488|14\/88)(?:$|[^\d])|\b(?:aryan|foid|foids|sieg ?heil|groyper|groypers)\b/i;

// Rough standard UTC offsets per region, for the active-hours comparison.
const REGION_OFFSETS = { europe: [0, 3], "west asia": [2, 4], africa: [-1, 3], "south asia": [5, 6], "east asia": [7, 9], oceania: [8, 13], "north america": [-8, -4], "south america": [-5, -3] };

export const DOES_NOT_PROVE = {
  "hours-elsewhere": "The hours this account posts fit a day in another region. Night owls, shift workers, scheduling tools and travel shift these hours too.",
  "fast-replier": "This account often replies within a minute of the post, in threads timed to the second. Notifications make fast replies easy for close followers too.",
  "copied-elsewhere": "This account posts the same words in other threads. People also repeat text they agree with, and memes and quotes repeat.",
  "automation-app": "This account posts through an automation or scheduling app. News desks, brands and busy people use these apps too.",
  "no-sleep-gap": "This account posts in nearly every hour of the day, by times given to the hour or finer. Teams, shared accounts and scheduling tools post around the clock too.",
  "repost-only": "This account almost always reposts others. Some people keep an account for sharing.",
  "low-karma": "This account has low karma for its age. Many people read more than they post, and karma depends on the communities they use.",
  "new-account": "This account is new. Many real people join during a news event.",
  "name-changes": "This account changed its name, and repeated renames are most common among resold or repurposed accounts. People rename for many ordinary reasons too.",
  "default-handle": "This account uses the handle X suggested at sign-up. Many real people keep it.",
  "based-elsewhere": "The account speaks as a local, and X labels it as based elsewhere. VPNs, travel and X's own errors move the label, and people abroad speak for home.",
  "hate-symbol-name": "The account name carries a documented hate symbol. A name can be ironic or quoted.",
  "high-volume": "This account posts at a very high rate. Some people post all day, and news and alert accounts post automatically.",
  "follow-pattern": "This account follows many and few follow it back. New and small accounts often start this way.",
  "store-elsewhere": "The account's app store country differs from where it says it is. People move, travel and buy phones abroad.",
  "profile-location-elsewhere": "The profile location differs from the platform's label. People type their own profile location, and it can be old or a joke.",
  "flag-elsewhere": "The profile shows another country's flag. Expats, diaspora and supporters show flags of other countries too.",
  "platform-label": "The service put a moderation label on this account. The label is the service's own judgement.",
  "same-text": "Other accounts posted identical replies. That shows copying or coordination, and people also share text they agree with.",
  "brand-lookalike": BRAND_DOES_NOT_PROVE,
};

export function ageDays(joinDate, now = Date.now()) {
  const t = joinDate instanceof Date ? joinDate.getTime() : Date.parse(joinDate);
  return Number.isFinite(t) ? Math.max(0, Math.floor((now - t) / DAY)) : null;
}

// The country in "Connected via France App Store" or "... Google Play", or null.
export function storeCountry(connectedVia) {
  const m = String(connectedVia || "").match(/^(.+?)\s+(?:app store|google play|play store)/i);
  return m ? m[1].trim() : null;
}

// Countries shown as flag emoji in a display name: "Jack 🇺🇸" gives ["United States"].
export function nameFlags(display) {
  const names = typeof Intl !== "undefined" && Intl.DisplayNames ? new Intl.DisplayNames(["en"], { type: "region" }) : null;
  const out = [];
  for (const m of String(display || "").matchAll(/([\u{1F1E6}-\u{1F1FF}])([\u{1F1E6}-\u{1F1FF}])/gu)) {
    const iso = String.fromCharCode(m[1].codePointAt(0) - 0x1F1E6 + 65, m[2].codePointAt(0) - 0x1F1E6 + 65);
    out.push(names ? names.of(iso) : iso);
  }
  return out;
}

// Same place at country or region level. Unknown places never raise a flag.
function samePlace(a, b) {
  const A = parseLabel(a), B = parseLabel(b);
  if (!A || !B) return true;
  if (A.country && B.country) return A.country === B.country;
  return A.region === B.region;
}

// account: { handle, display, joinDate, nameChanges, basedIn, connectedVia }
// context: { mismatch: result of compare(), cluster: { size, authors } | null, now }
export function flagsFor(account, context = {}) {
  const out = [];
  // Volume and follow patterns from the counts X loads for the page.
  const ageForRate = ageDays(account.joinDate, context.now);
  if (Number.isFinite(account.postsCount) && ageForRate != null) {
    const perDay = account.postsCount / Math.max(1, ageForRate);
    if (perDay >= HIGH_VOLUME_PER_DAY) out.push({ id: "high-volume", evidence: `about ${Math.round(perDay)} posts a day since joining (${account.postsCount.toLocaleString()} posts)` });
  }
  if (Number.isFinite(account.followingCount) && Number.isFinite(account.followersCount) && account.followingCount >= 2000 && account.followersCount < 100) {
    out.push({ id: "follow-pattern", evidence: `follows ${account.followingCount.toLocaleString()} accounts; ${account.followersCount} follow back` });
  }
  // Inferred: when the account posts (from threads CMMNS has seen) against where it is labelled.
  const act = context.activity && context.activity.activeHours;
  const range = account.basedIn && REGION_OFFSETS[(parseLabel(account.basedIn) || {}).region];
  if (act && range && act.fit >= 0.8 && (act.utcOffset < range[0] - 2 || act.utcOffset > range[1] + 2)) {
    out.push({ id: "hours-elsewhere", evidence: `posts on a UTC${act.utcOffset >= 0 ? "+" : ""}${act.utcOffset} day (${act.posts} posts over ${act.days} days); labelled as based in ${account.basedIn}` });
  }
  if (context.activity && context.activity.fastReplies >= 3 && context.activity.medianDelay != null && context.activity.medianDelay <= 60) {
    out.push({ id: "fast-replier", evidence: `replied within a minute of the original post in ${context.activity.fastReplies} threads you viewed (median ${context.activity.medianDelay} s)` });
  }
  if (context.echo && context.echo.threads >= 1) {
    const by = context.echo.authors.filter((a) => a !== String(account.handle || "").toLowerCase());
    out.push({ id: "copied-elsewhere", evidence: `the same wording appeared in ${context.echo.threads} other thread${context.echo.threads === 1 ? "" : "s"} you viewed` + (by.length ? `, posted by ${by.slice(0, 6).map((a) => "@" + a).join(", ")}` : ", from this account") });
  }
  // How the account posts (src/core/pattern.js), from its posts X loaded.
  const P = account.pattern;
  if (P) {
    const app = (P.clients || []).find((c) => !COMMON_APP.test(c.name) && c.share >= 0.8);
    if (app) out.push({ id: "automation-app", evidence: `${Math.round(app.share * 100)}% of its last ${P.posts} posts were sent from ${app.name}` });
    if (P.days >= 3 && P.posts >= 40 && P.activeUtcHours >= 22) out.push({ id: "no-sleep-gap", evidence: `posted in ${P.activeUtcHours} of the 24 hours of the day across ${P.days} days (${P.posts} posts)` });
    if (P.posts >= 20 && P.reposts >= 0.9) out.push({ id: "repost-only", evidence: `${Math.round(P.reposts * 100)}% of its last ${P.posts} posts are reposts` });
  }
  const store = storeCountry(account.connectedVia);
  if (store && account.basedIn && !samePlace(store, account.basedIn)) out.push({ id: "store-elsewhere", evidence: `installed from the ${store} app store; labelled as based in ${account.basedIn}` });
  // The location a person typed on their profile, against X's label. Free text ("Paris",
  // "somewhere", "🇫🇷") only counts when it names a known place.
  if (account.profileLocation && account.basedIn && parseLabel(account.profileLocation) && !samePlace(account.profileLocation, account.basedIn)) {
    out.push({ id: "profile-location-elsewhere", evidence: `profile says "${account.profileLocation}"; labelled as based in ${account.basedIn}` });
  }
  const shown = nameFlags(account.display).find((c) => account.basedIn && !samePlace(c, account.basedIn));
  if (shown) out.push({ id: "flag-elsewhere", evidence: `shows the ${shown} flag in its name; labelled as based in ${account.basedIn}` });
  const age = ageDays(account.joinDate, context.now);
  if (age != null && age < NEW_ACCOUNT_DAYS) out.push({ id: "new-account", evidence: `account is ${age} day${age === 1 ? "" : "s"} old` });
  if (Number.isFinite(account.nameChanges) && account.nameChanges >= MANY_NAME_CHANGES) out.push({ id: "name-changes", evidence: `username changed ${account.nameChanges} times` });
  const name = `${account.display || ""} ${account.handle || ""}`;
  const sym = HATE_NAME.exec(name);
  if (sym) out.push({ id: "hate-symbol-name", evidence: `name contains "${sym[0].trim()}", a documented hate symbol or slur` });
  // A name that borrows a platform's or an outlet's brand (src/core/brands.js). Only where the site
  // gives the handle the brand list is keyed on (X), so the caller sets brandCheck.
  const brand = account.brandCheck ? brandLookalike(account) : null;
  if (brand) out.push({ id: "brand-lookalike", evidence: brand.evidence, source: brand.source });
  // Reddit: little karma after more than a month, and Reddit's suggested sign-up name.
  if (Number.isFinite(account.karma) && age != null && age > NEW_ACCOUNT_DAYS && account.karma < LOW_KARMA) out.push({ id: "low-karma", evidence: `${account.karma} karma after ${age} days` });
  // Bluesky: moderation labels about how an account behaves, not what it says.
  const auth = (account.platformLabels || []).filter((l) => PLATFORM_AUTH_LABELS.has(l));
  if (auth.length) out.push({ id: "platform-label", evidence: `labelled "${auth.join('", "')}" by ${account.labelSource || "the platform's moderation"}` });
  if (account.redditDefaultName) out.push({ id: "default-handle", evidence: "username has the pattern Reddit suggests at sign-up" });
  if (account.handle && DEFAULT_HANDLE.test(account.handle)) out.push({ id: "default-handle", evidence: `handle @${account.handle} has the sign-up pattern` });
  if (context.mismatch && context.mismatch.status === "mismatch") out.push({ id: "based-elsewhere", evidence: context.mismatch.reason + (account.proxyNote ? " (X notes a possible VPN or proxy, so the label may be wrong)" : "") });
  if (context.cluster && context.cluster.size >= 2) {
    const others = (context.cluster.authors || []).filter((a) => a !== account.handle).map((a) => "@" + a);
    const list = others.length ? `: ${others.slice(0, 8).join(", ")}${others.length > 8 ? ` and ${others.length - 8} more` : ""}` : "";
    out.push({ id: "same-text", evidence: `same text as ${context.cluster.size - 1} other repl${context.cluster.size === 2 ? "y" : "ies"} in this thread${list}` });
  }
  return out.map((f) => ({ ...f, doesNotProve: DOES_NOT_PROVE[f.id] }));
}

// An account counts as "flagged" for the thread report when it has one strong authenticity flag
// or two different weak ones. Weak flags are place and timing context that ordinary expats,
// diaspora and night owls trip; on a live thread about the riots in France they alone put half
// the repliers in the flagged group. The default-handle signal never counts, and neither does a
// hate symbol in the name: that is about what the account says, and counting it would make the
// report circular.
const NOT_AUTHENTICITY = new Set(["default-handle", "hate-symbol-name", "follow-pattern"]);
export const WEAK_FLAGS = new Set(["store-elsewhere", "profile-location-elsewhere", "flag-elsewhere", "hours-elsewhere",
  "fast-replier", "repost-only", "low-karma", "brand-lookalike"]);
export function isFlagged(flags) {
  const counted = flags.filter((f) => !NOT_AUTHENTICITY.has(f.id));
  if (counted.some((f) => !WEAK_FLAGS.has(f.id))) return true;
  return new Set(counted.map((f) => f.id)).size >= 2;
}
