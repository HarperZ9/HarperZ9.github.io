// Every live Night School lesson (a curriculum entry with an href) is in the sitemap, and every
// Night School page in the sitemap exists, so new lessons cannot ship unlisted.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";

const root = new URL("../", import.meta.url);
const sitemap = readFileSync(new URL("sitemap.xml", root), "utf8");
const curriculum = JSON.parse(readFileSync(new URL("media/school/curriculum.json", root), "utf8"));

test("every lesson with a page is in the sitemap", () => {
  const hrefs = curriculum.lessons.filter((l) => l.href).map((l) => l.href);
  assert.ok(hrefs.length >= 15, `expected at least 15 lesson pages, found ${hrefs.length}`);
  for (const h of hrefs) assert.ok(sitemap.includes(`https://harperz9.github.io/${h}</loc>`), `${h} is missing from sitemap.xml`);
});

test("every Night School page in the sitemap exists", () => {
  const pages = [...sitemap.matchAll(/https:\/\/harperz9\.github\.io\/(night-school[a-z-]*\.html)/g)].map((m) => m[1]);
  assert.ok(pages.length >= 16);
  for (const p of pages) assert.ok(existsSync(new URL(p, root)), `${p} is listed but does not exist`);
});
