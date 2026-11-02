// Hosts and sites. A site is the registrable domain of a host ("transcripts.cnn.com" is cnn.com),
// except on shared hosts, where each subdomain is somebody's own site ("someone.blogspot.com").
// Used to file each fact-check review under the site where the reviewed claim appeared, and to look
// a link up in the site tables. The lists name services by what they do (people post there, it
// archives pages, it shortens links), with the same treatment for services of every country and
// every direction.

// Two-part public suffixes CMMNS meets in the feed and in links. Not the full Public Suffix List:
// a missing suffix files "x.co.zz" under "co.zz", which matches no table row and shows nothing.
const SUFFIX2 = new Set(("co.uk org.uk gov.uk ac.uk me.uk com.au net.au org.au gov.au edu.au co.nz govt.nz org.nz co.in gov.in org.in net.in nic.in " +
  "co.jp or.jp ne.jp go.jp com.br gov.br org.br jus.br leg.br co.za gov.za org.za com.mx gob.mx org.mx com.ar gob.ar com.tr gov.tr org.tr " +
  "com.pk gov.pk com.ng gov.ng com.ph gov.ph com.my gov.my com.sg gov.sg co.kr go.kr or.kr com.cn gov.cn org.cn com.tw gov.tw org.tw com.hk gov.hk " +
  "co.id go.id or.id com.ua gov.ua org.ua com.eg gov.eg co.il gov.il org.il com.sa gov.sa co.ke go.ke com.gh gov.gh com.co gov.co com.pe gob.pe " +
  "com.ve gob.ve com.bd gov.bd com.np gov.np com.lk gov.lk com.vn gov.vn co.th go.th in.th or.th com.qa gov.qa com.kw com.om com.lb com.jo " +
  "com.hr com.gr com.ro com.pl com.pt com.es com.de com.fr com.it com.ar com.au com.cy com.mt com.ec gob.ec com.bo com.py com.uy com.do com.gt com.sv com.hn com.ni com.pa co.cr com.cu com.pr com.et com.tn com.dz " +
  "co.ma gov.ma co.ug co.tz co.zw co.zm com.na org.ng com.af gov.af com.iq gov.iq com.ru org.ru com.by gov.by com.kz gov.kz").split(" "));

// Services where each subdomain belongs to whoever writes there.
const SHARED = new Set(["blogspot.com", "wordpress.com", "substack.com", "medium.com", "tumblr.com", "wixsite.com", "github.io", "weebly.com",
  "go.com", "livejournal.com", "typepad.com", "over-blog.com", "squarespace.com", "webnode.com", "jimdofree.com", "home.blog", "ghost.io",
  "neocities.org", "carrd.co", "telegra.ph", "beehiiv.com", "mailchimpsites.com", "sites.google.com", "netlify.app", "vercel.app", "pages.dev"]);

// Where people post their own material. A claim posted there is the poster's, not the service's.
const PLATFORM = ["facebook.com", "fb.watch", "fb.com", "instagram.com", "threads.net", "threads.com", "whatsapp.com", "messenger.com",
  "x.com", "twitter.com", "youtube.com", "youtu.be", "tiktok.com", "snapchat.com", "pinterest.com", "linkedin.com", "reddit.com", "redd.it",
  "t.me", "telegram.me", "telegram.org", "vk.com", "ok.ru", "dzen.ru", "rutube.ru", "weibo.com", "weibo.cn", "douyin.com", "bilibili.com",
  "kuaishou.com", "xiaohongshu.com", "qq.com", "wechat.com", "zhihu.com", "line.me", "kakao.com", "naver.com", "sharechat.com", "koo.in",
  "rumble.com", "truthsocial.com", "gab.com", "gettr.com", "parler.com", "bitchute.com", "odysee.com", "minds.com", "bsky.app", "mastodon.social",
  "vimeo.com", "dailymotion.com", "twitch.tv", "kick.com", "soundcloud.com", "spotify.com", "podcasts.apple.com", "discord.com", "discord.gg",
  "quora.com", "imgur.com", "flickr.com", "patreon.com", "change.org", "google.com", "docs.google.com", "drive.google.com", "dropbox.com",
  "scribd.com", "issuu.com", "slideshare.net"];
const ARCHIVE = ["archive.org", "web.archive.org", "archive.ph", "archive.is", "archive.today", "archive.md", "archive.li", "archive.vn", "archive.fo",
  "perma.cc", "ghostarchive.org", "megalodon.jp", "archive.st", "awesomescreenshot.com", "webcitation.org", "cachedview.nl", "screenshot.guru"];
const SHORTENER = ["bit.ly", "tinyurl.com", "t.co", "goo.gl", "ow.ly", "buff.ly", "is.gd", "rb.gy", "cutt.ly", "shorturl.at", "tiny.cc", "lnkd.in",
  "wapo.st", "nyti.ms", "trib.al", "dlvr.it", "linktr.ee", "mvau.lt", "s.id", "rebrand.ly", "bl.ink", "short.io", "amzn.to", "fb.me", "spoti.fi", "apple.co"];
// Services that carry other people's words verbatim (speech transcripts, transcript databases) or
// republish other outlets' articles (aggregators). A claim found there belongs to the speaker or the
// original outlet, so it is not filed under the service.
const TRANSCRIPT = ["rev.com", "factba.se", "c-span.org", "otter.ai", "happyscribe.com", "americanrhetoric.com", "millercenter.org", "presidency.ucsb.edu"];
const AGGREGATOR = ["yahoo.com", "msn.com", "news.google.com", "flipboard.com", "newsbreak.com", "dailyhunt.in", "operanewsapp.com", "smartnews.com", "ground.news",
  "newsnow.co.uk", "inshorts.com", "toutiao.com", "sohu.com", "163.com", "kknews.cc", "pressreader.com", "headtopics.com", "newsbreakapp.com", "ampproject.org"];
// Tools fact-checkers publish through: an appearance there is a fact-check, never the claim's source.
const CHECK_TOOLS = ["checkmedia.org", "meedan.com", "meedan.org"];
// Hosting and content delivery: the address names the host, not who published the page.
const HOSTING = ["googleusercontent.com", "wp.com", "cloudfront.net", "amazonaws.com", "akamaized.net", "blogger.com", "files.wordpress.com", "azureedge.net", "fbcdn.net", "twimg.com"];
const KIND = new Map([...PLATFORM.map((h) => [h, "platform"]), ...ARCHIVE.map((h) => [h, "archive"]), ...SHORTENER.map((h) => [h, "shortener"]),
  ...TRANSCRIPT.map((h) => [h, "transcript"]), ...AGGREGATOR.map((h) => [h, "aggregator"]), ...CHECK_TOOLS.map((h) => [h, "fact-check tool"]), ...HOSTING.map((h) => [h, "hosting"])]);

// "https://www.m.example.com/x" -> "example.com"; null for anything that is not an http(s) URL.
export function hostOf(url) {
  let h;
  try { const u = new URL(String(url || "").trim()); if (!/^https?:$/.test(u.protocol)) return null; h = u.hostname.toLowerCase(); } catch { return null; }
  for (let i = 0; i < 2; i++) h = h.replace(/^(?:www\d?|m|mobile|amp)\./, "");
  return h.replace(/\.$/, "") || null;
}

// The site a host belongs to, or null for an IP address, a bare suffix or a shared host itself.
export function siteKey(host) {
  const h = String(host || "").toLowerCase().replace(/^www\./, "");
  if (!h.includes(".") || /^\d+(?:\.\d+){3}$/.test(h) || h.includes(":")) return null;
  const parts = h.split(".");
  for (let n = 2; n <= 3; n++) {
    const tail = parts.slice(-n).join(".");
    if (SHARED.has(tail)) return parts.length > n ? parts.slice(-(n + 1)).join(".") : null;
  }
  const two = parts.slice(-2).join(".");
  if (SUFFIX2.has(two)) return parts.length >= 3 ? parts.slice(-3).join(".") : null;
  return two;
}

// What a host does with other people's material: "platform", "archive", "shortener", "transcript",
// "aggregator", "fact-check tool", "hosting", or null.
export function hostedKind(host) {
  const h = String(host || "").toLowerCase();
  if (KIND.has(h)) return KIND.get(h);
  const k = siteKey(h);
  return (k && KIND.get(k)) || null;
}

// The page an archive copy is of, when the archive address carries it; null otherwise.
export function unwrapArchive(url) {
  const s = String(url || "");
  const host = hostOf(s);
  if (!host || hostedKind(host) !== "archive") return null;
  const m = s.match(/^https?:\/\/[^/]+\/(?:web\/)?[\d.*-]{4,}[a-z_]*\/(.+)$/i);
  if (!m) return null;
  const inner = m[1];
  return /^https?:\/\//i.test(inner) ? inner : /^[a-z0-9-]+(?:\.[a-z0-9-]+)+(?:\/|$)/i.test(inner) ? "http://" + inner : null;
}

// One appearance URL: { site } | { hosted } | { excluded } | null. `checkers` holds the site keys of
// every fact-checker in the feed, so a claim "appearing" on a fact-check page is never filed there.
export function appearanceSite(url, checkers = new Set()) {
  const inner = unwrapArchive(url);
  const host = hostOf(inner || url);
  if (!host) return null;
  const kind = hostedKind(host);
  if (kind) return { hosted: kind };
  const key = siteKey(host);
  if (!key) return null;
  if (checkers.has(key)) return { excluded: "fact-checker" };
  return { site: key };
}

// Every site one ClaimReview item lists the claim as appearing on, once each, plus counts of the
// appearances that were set aside and why.
export function reviewSites(item, checkers = new Set()) {
  const ir = (item && item.itemReviewed) || {};
  const urls = [].concat(ir.appearance || [], ir.firstAppearance || []).map((a) => (a && typeof a === "object" ? a.url : a)).filter((u) => typeof u === "string");
  const own = siteKey(hostOf(item && item.url));
  const all = own ? new Set([...checkers, own]) : checkers;
  const sites = new Set(), hosted = [];
  let excluded = 0;
  for (const u of urls) {
    const a = appearanceSite(u, all);
    if (!a) continue;
    if (a.site) sites.add(a.site);
    else if (a.hosted) hosted.push(a.hosted);
    else excluded++;
  }
  return { sites: [...sites], hosted, excluded, urls: urls.length };
}

// The real address behind a platform or search-engine redirect, or the link itself. X's t.co
// links carry the address only in their visible text ("nytimes.com/2026/…"), so `text` is used.
export function realLink(href, text = "") {
  let u;
  try { u = new URL(String(href || "")); } catch { return null; }
  const h = u.hostname.replace(/^www\./, ""), q = (k) => u.searchParams.get(k);
  const asUrl = (s) => { try { const x = new URL(s); return /^https?:$/.test(x.protocol) ? x.toString() : null; } catch { return null; } };
  if (h === "t.co") {
    const t = String(text || "").trim().replace(/[…]+$/, "").replace(/^https?:\/\//, "");
    return /^[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,}(?:\/\S*)?$/i.test(t) ? "https://" + t : null;
  }
  if (/^(?:l|lm)\.facebook\.com$/.test(h) || h === "l.instagram.com") return asUrl(q("u"));
  if (h === "youtube.com" && u.pathname === "/redirect") return asUrl(q("q"));
  if (h === "out.reddit.com") return asUrl(q("url"));
  if (/^google\.[a-z.]+$/.test(h) && u.pathname === "/url") return asUrl(q("q") || q("url"));
  if (h === "duckduckgo.com" && u.pathname.startsWith("/l/")) return asUrl(q("uddg"));
  if (h === "bing.com" && u.pathname === "/ck/a") {
    const v = q("u");
    if (!v || !v.startsWith("a1")) return null;
    try { return asUrl(atob(v.slice(2).replace(/-/g, "+").replace(/_/g, "/"))); } catch { return null; }
  }
  return asUrl(u.toString());
}
