// Reddit account data from Reddit's own public endpoint (/user/<name>/about.json), which the site
// serves to anyone viewing a profile. Only fields Reddit shows publicly are kept.

// Reddit suggests names like "Lumpy_Garden_4821" at sign-up; many throwaway accounts keep them.
export const REDDIT_DEFAULT_NAME = /^[A-Z][a-z]+[-_][A-Z][a-z]+[-_]?\d{1,4}$/;

export function redditAbout(json) {
  const d = json && json.data;
  if (!d || !d.name) return null;
  const created = Number(d.created_utc);
  const r = {
    handle: d.name,
    joinDate: Number.isFinite(created) ? new Date(created * 1000).toISOString().slice(0, 10) : null,
    karma: Number.isFinite(d.total_karma) ? d.total_karma : (Number(d.link_karma) || 0) + (Number(d.comment_karma) || 0),
    postKarma: Number.isFinite(d.link_karma) ? d.link_karma : null,
    commentKarma: Number.isFinite(d.comment_karma) ? d.comment_karma : null,
    emailVerified: d.has_verified_email === true ? true : d.has_verified_email === false ? false : null,
    premium: d.is_gold === true ? true : null,
    moderator: d.is_mod === true ? true : null,
    employee: d.is_employee === true ? true : null,
    suspended: d.is_suspended === true ? true : null,
    bio: d.subreddit && d.subreddit.public_description ? String(d.subreddit.public_description).slice(0, 280) : null,
    defaultName: REDDIT_DEFAULT_NAME.test(d.name) ? true : null,
    aboutRead: true,
  };
  return Object.fromEntries(Object.entries(r).filter(([, v]) => v !== null && v !== undefined));
}

// Low karma for the account's age: under LOW_KARMA after more than a month. New accounts are
// covered by the new-account flag instead.
export const LOW_KARMA = 20;
