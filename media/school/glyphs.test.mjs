// Every string any Night School film draws is made of glyphs its fonts have. The atlases carry a
// fixed character set (no "|" or "^", for instance), and a missing glyph draws as a box or a
// question mark, so this samples each film every two seconds and checks every character.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { sceneContext, loadScene, evaluate } from "../raw-native/tree-ada041f/web/motion/scene.mjs";
import { LABELS } from "./shared/lib.mjs";

const here = new URL("./", import.meta.url);
const glyphs = (f) => new Set(Object.keys(JSON.parse(readFileSync(new URL(`../explainers/motion/${f}.json`, here), "utf8")).glyphs));
const fonts = ["hanken-500", "hanken-650", "conso-400"].map(glyphs);
const fetcher = async (u) => ({ ok: true, json: async () => JSON.parse(readFileSync(fileURLToPath(u), "utf8")) });
const films = readdirSync(fileURLToPath(here)).filter((d) => existsSync(fileURLToPath(new URL(`${d}/film.scene.mjs`, here))));

test("every character every film draws is in all three font atlases", async () => {
  assert.ok(films.length >= 5, `found ${films.length} films`);
  for (const slug of films) {
    const url = new URL(`${slug}/film.scene.mjs`, here).href, scene = (await import(url)).default;
    const ctx = sceneContext(scene, { baseUrl: url, fetcher });
    await loadScene(scene, ctx);
    for (let t = 0; t < scene.duration; t += 2) for (const it of evaluate(scene, ctx, t).items) {
      const s = LABELS.get(it.shape);
      if (s) for (const ch of s) assert.ok(ch === " " || fonts.every((f) => f.has(ch)), `${slug} at ${t}s: "${ch}" in "${s}"`);
    }
  }
});
