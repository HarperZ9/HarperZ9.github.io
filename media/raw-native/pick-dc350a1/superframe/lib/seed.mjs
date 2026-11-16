// seed.mjs: one seed rule for the whole graph, the superstack rule xmur3-mulberry32/1.
// A recipe seed (string or number) and a node instance id give that node its own substream, so adding a node
// to a recipe never changes the randomness of the nodes already in it.
import { xmur3, Mulberry32, substream } from '../../substrate/lib/vendor/superstack.mjs';

export const SEED_RULE = 'xmur3-mulberry32/1';

export function nodeSeed(recipeSeed, instanceId) {
  const s = substream(String(recipeSeed), instanceId);
  const u32 = xmur3(s);
  const m = new Mulberry32(u32);
  const rng = () => m.nextFloat();
  // seedInt: a positive 31-bit integer for upstream modules that take integer seeds (most of them).
  return { seed: s, seedInt: (u32 % 2147483646) + 1, rng };
}

export function rngFrom(str) { const m = new Mulberry32(xmur3(String(str))); return () => m.nextFloat(); }
