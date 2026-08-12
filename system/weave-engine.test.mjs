import test from "node:test";
import assert from "node:assert/strict";
import { STRUCTURES, computeDraft, draftToWIF, weftPaletteFor } from "./weave-engine.js";

const flat = (ends, picks, v) => new Float32Array(ends * picks).fill(v);

test("plain weave drawdown is a checkerboard at toneDrive 0", () => {
  const d = computeDraft(flat(8, 8, 0.5), 8, 8, "plain", { toneDrive: 0 });
  for (let p = 0; p < 8; p++) for (let e = 0; e < 8; e++) {
    assert.equal(d.liftAt(e, p), (e + p) % 2 === 0, `cell ${e},${p}`);
  }
});

test("2/2 twill lift diagonal advances by one shaft per pick", () => {
  const d = computeDraft(flat(8, 8, 0.5), 8, 8, "twill22", { toneDrive: 0 });
  for (let p = 0; p < 4; p++) {
    const lifted = [0, 1, 2, 3].filter((e) => d.liftAt(e, p));
    const expect = [p % 4, (p + 1) % 4].sort();
    assert.deepEqual(lifted.sort(), expect, `pick ${p}`);
  }
});

test("satin 5 sateen lifts exactly one shaft per pick at toneDrive 0", () => {
  const d = computeDraft(flat(10, 10, 0.2), 10, 10, "satin5", { toneDrive: 0 });
  for (let p = 0; p < 5; p++) {
    let lifts = 0;
    for (let e = 0; e < 5; e++) if (d.liftAt(e, p)) lifts++;
    assert.equal(lifts, 1, `pick ${p}`);
  }
});

test("satin 5 flips to warp face on bright rows when tone drives", () => {
  const d = computeDraft(flat(10, 10, 0.95), 10, 10, "satin5", { toneDrive: 1 });
  let lifts = 0;
  for (let e = 0; e < 5; e++) if (d.liftAt(e, 0)) lifts++;
  assert.equal(lifts, 4);
});

test("overshot alternates pattern picks with tabby picks", () => {
  const d = computeDraft(flat(16, 8, 0.5), 16, 8, "overshot", { toneDrive: 0 });
  for (let p = 1; p < 8; p += 2) {
    assert.ok(d.treadling[p] >= 4, `pick ${p} should press a tabby treadle`);
    const lifted = [];
    for (let e = 0; e < 16; e++) if (d.liftAt(e, p)) lifted.push(e);
    for (const e of lifted) {
      assert.equal(d.threading[e] % 2, d.threading[lifted[0]] % 2, "tabby lifts one parity of shafts");
    }
  }
});

test("every structure exposes shafts and treadles matching its tieup", () => {
  for (const id of Object.keys(STRUCTURES)) {
    const s = STRUCTURES[id];
    assert.equal(s.tieup.length, s.treadles, id);
    for (const row of s.tieup) for (const sh of row) assert.ok(sh >= 0 && sh < s.shafts, id);
  }
});

test("WIF carries every required section with 1-based counts", () => {
  const d = computeDraft(flat(6, 4, 0.5), 6, 4, "twill22", { toneDrive: 0 });
  const wif = draftToWIF(d, { title: "test", warpHex: "#ffffff", weftHexes: ["#000000", "#808080"], weftIndexAt: (p) => p % 2 });
  for (const sec of ["[WIF]", "[CONTENTS]", "[COLOR PALETTE]", "[TEXT]", "[WEAVING]",
    "[WARP]", "[WEFT]", "[COLOR TABLE]", "[THREADING]", "[TIEUP]", "[TREADLING]", "[LIFTPLAN]", "[WEFT COLORS]"]) {
    assert.ok(wif.includes(sec), sec + " missing");
  }
  const section = (name) => wif.split(name)[1].split("[")[0].trim().split("\r\n").filter((l) => l.includes("="));
  assert.equal(section("[THREADING]").length, 6);
  assert.equal(section("[TREADLING]").length, 4);
  assert.equal(section("[TIEUP]").length, d.treadles);
  assert.equal(section("[COLOR TABLE]").length, 3);
  assert.ok(wif.includes("Shafts=4") && wif.includes("Rising Shed=yes"));
  assert.ok(wif.endsWith("\r\n"));
});

test("image weft palette buckets rows by tone and stays within 8 colors", () => {
  const picks = 24, ends = 4;
  const luma = new Float32Array(ends * picks);
  for (let p = 0; p < picks; p++) for (let e = 0; e < ends; e++) luma[p * ends + e] = p / picks;
  const d = computeDraft(luma, ends, picks, "plain", { toneDrive: 0 });
  const pal = weftPaletteFor(d, (p) => [p * 10, p * 10, p * 10], "image");
  assert.ok(pal.hexes.length >= 2 && pal.hexes.length <= 8);
  for (let p = 0; p < picks; p++) {
    const i = pal.indexAt(p);
    assert.ok(i >= 0 && i < pal.hexes.length);
  }
  assert.ok(pal.indexAt(0) <= pal.indexAt(picks - 1), "dark rows land in earlier buckets");
});

test("jacquard shading is inclusive and tracks tone per cell", () => {
  const ends = 16, picks = 16;
  const dark = computeDraft(flat(ends, picks, 0.1), ends, picks, "jacquard", { toneDrive: 1 });
  const bright = computeDraft(flat(ends, picks, 0.95), ends, picks, "jacquard", { toneDrive: 1 });
  let darkLifts = 0, brightLifts = 0;
  for (let p = 0; p < picks; p++) for (let e = 0; e < ends; e++) {
    const dl = dark.liftAt(e, p), bl = bright.liftAt(e, p);
    if (dl) darkLifts++;
    if (bl) brightLifts++;
    if (dl) assert.ok(bl, "inclusivity: every dark-tone riser survives at the brighter tone");
  }
  assert.ok(brightLifts > darkLifts * 2, "bright cells lift far more warp");
  const flat0 = computeDraft(flat(ends, picks, 0.9), ends, picks, "jacquard", { toneDrive: 0 });
  let lifts = 0;
  for (let p = 0; p < picks; p++) for (let e = 0; e < ends; e++) if (flat0.liftAt(e, p)) lifts++;
  assert.equal(lifts, (ends * picks) / 8, "toneDrive 0 collapses to the flat 1/7 satin base");
});

test("fixed palette maps rows to nearest luminance", () => {
  const d = computeDraft(flat(4, 4, 0.9), 4, 4, "plain", { toneDrive: 0 });
  const pal = weftPaletteFor(d, () => [250, 250, 250], ["#000000", "#ffffff"]);
  assert.equal(pal.hexes.length, 2);
  assert.equal(pal.indexAt(0), 1, "bright row picks the bright weft");
});
