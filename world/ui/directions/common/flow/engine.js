// flow/engine.js: the one medium engine (BLEED.md spine 2; the lead's decision, 2026-10-26: one engine, two views).
// Pages take the top view from the superframe's lib/medium (topview.mjs). Where a page is served without the
// superframe beside it (the site), the local copy in this folder stands in; it is the same code, copied there on
// 2026-10-26, and fixes now go to lib/medium/gpu. `engine` says which one a page got.
let mod = null, engine = "local copy";
try { mod = await import("../../../../superframe/lib/medium/topview.mjs"); engine = "superframe lib/medium"; }
catch (e) { console.info("medium: lib/medium is not served here, the local copy stands in:", e.message); }
if (!mod) mod = await import("./medium.js");
export const createMedium = mod.topView || mod.createMedium;
export { engine };
