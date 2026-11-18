// The engine's own shader code, loaded and checked before any of it runs.
//
// engine-sf-cac3416/ holds files carried unchanged from HarperZ9/superframe at commit cac34166 (native/):
//   post.wgsl     GTAO, mirror SSR and the TAA resolve: the GPU forms of post_gtao.cpp, post_ssr.cpp, taa.cpp
//   passes.wgsl   the ray-traced AO reference, with the engine's watertight ray-triangle test and BVH walk
//   common.wgsl   the definitions every engine pass shares (the per-pixel hash, vector helpers)
//   colour.wgsl, colour.mjs, aces2-sdr_srgb.json   the display pipelines: ACES 2.0, AgX, PBR Neutral, clip
// Each file is hashed here and compared with the list below (the same as engine-sf-cac3416/SHA256SUMS); a
// mismatch stops the page before a shader is compiled. Functions are lifted from passes.wgsl by name, text
// unchanged, so the page traces rays with the engine's arithmetic.
const DIR = new URL("./engine-sf-cac3416/", import.meta.url);
export const ENGINE_COMMIT = "cac34166";
export const PINNED = {
  "post.wgsl": "1fa378f6b8db9f38723bfb5b4b61586f88a8cea39a79c52b80521db9195f323a",
  "passes.wgsl": "14f2b330ef7fb1a329388f78eb36c28d4d7f6a22eab7a84568e438488f116eb7",
  "common.wgsl": "65a80ed9ec326df67d352f89b7f73611a203774492cad482c187e917f4e1691e",
  "colour.wgsl": "1a1ce3dbca16df2f1405c8578f6de6bf8de671d3bee393665ffdcc3549f7c711",
  "colour.mjs": "7458e70f24b1e0712d4f2d78ad6c73cd233d9f6764c620b3aa84ef15958d4131",
  "aces2-sdr_srgb.json": "38efba2866be5d721861dd2d7b8cfb0b9f947b8981b5c8d270a9c8119b347202",
};

async function checked(name) {
  const res = await fetch(new URL(name, DIR));
  if (!res.ok) throw new Error(`engine file ${name}: HTTP ${res.status}`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  const d = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)), (b) => b.toString(16).padStart(2, "0")).join("");
  if (d !== PINNED[name]) throw new Error(`engine file ${name} does not match its pin (${d.slice(0, 12)})`);
  return new TextDecoder().decode(bytes);
}

// "fn name(" ... the matching close brace, as written in the file
export function lift(text, name) {
  const at = text.search(new RegExp(`^fn ${name}\\(`, "m"));
  if (at < 0) throw new Error(`engine function ${name} not found`);
  let i = text.indexOf("{", at), depth = 0;
  for (; i < text.length; i++) {
    if (text[i] === "{") depth++;
    else if (text[i] === "}" && --depth === 0) return text.slice(at, i + 1);
  }
  throw new Error(`engine function ${name} is not closed`);
}

// the code before the first //@pass marker is shared; each pass is that plus its own part (raw-gpu.mjs wgslPasses)
export function passesOf(text) {
  const parts = text.replace(/\r\n/g, "\n").split(/^\/\/@pass (\w+)[^\S\n]*\n/m), out = {};
  for (let i = 1; i < parts.length; i += 2) out[parts[i]] = parts[0] + "\n" + parts[i + 1];
  return out;
}

export async function loadEngine() {
  const names = Object.keys(PINNED);
  const texts = Object.fromEntries(await Promise.all(names.map(async (n) => [n, await checked(n)])));
  const colour = await import(new URL("colour.mjs", DIR).href);   // the same bytes the check above just read
  const post = passesOf(texts["post.wgsl"]);
  const P = texts["passes.wgsl"], C = texts["common.wgsl"];
  // the engine's tracing, as written: watertight triangle test, BVH any-hit walk; plus its hash and helpers
  const trace = ["wt_frame", "wt_hit", "bvert", "bhit", "invDir", "bvhBlocked"].map((n) => lift(P, n)).join("\n");
  const helpers = ["vlen", "vnorm", "vcross", "vdot", "hash01"].map((n) => lift(C, n)).join("\n");
  return {
    commit: ENGINE_COMMIT,
    gtao: post.post_gtao, ssr: post.post_ssr, taa: post.post_taa,
    trace, helpers,
    colourWGSL: texts["colour.wgsl"], colourPack: colour.pack, aces: JSON.parse(texts["aces2-sdr_srgb.json"]),
  };
}
