// node --test system/type-forge/licence.test.mjs
// Zain Mint under the SIL Open Font License 1.1: the records are read back from minted files, byte by byte.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { mint } from "./forge.mjs";
import { toTTF } from "./ttf.mjs";
import { mintedTTF, familyFor, COPYRIGHT, LICENCE, LICENCE_URL } from "./licence.mjs";

// the name table of a TrueType file: { nameID: text } for the Windows Unicode English records
function names(bytes) {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), n = v.getUint16(4);
  let at = -1;
  for (let i = 0; i < n; i++) { const r = 12 + 16 * i; if (String.fromCharCode(...bytes.subarray(r, r + 4)) === "name") at = v.getUint32(r + 8); }
  assert.ok(at > 0, "the file has a name table");
  const count = v.getUint16(at + 2), store = at + v.getUint16(at + 4), out = {}, ids = [];
  for (let i = 0; i < count; i++) {
    const r = at + 6 + 12 * i, [pid, eid, lang, id, len, off] = [0, 2, 4, 6, 8, 10].map((k) => v.getUint16(r + k));
    assert.deepEqual([pid, eid, lang], [3, 1, 0x409]);
    let s = ""; for (let j = 0; j < len; j += 2) s += String.fromCharCode(v.getUint16(store + off + j));
    out[id] = s; ids.push(id);
  }
  assert.deepEqual(ids, [...ids].sort((a, b) => a - b), "records are in nameID order");
  return out;
}

test("a file minted at the defaults is Zain Mint and carries the copyright and the licence", () => {
  const { bytes, family, derived } = mintedTTF(mint({}, 58), {});
  const got = names(bytes);
  assert.equal(family, "Zain Mint"); assert.equal(derived, false);
  assert.equal(got[0], 'Copyright 2026 Zain Dana Harper, with Reserved Font Name "Zain Mint".');
  assert.equal(got[0], COPYRIGHT);
  assert.match(got[13], /SIL Open Font License, Version 1\.1/); assert.equal(got[13], LICENCE);
  assert.equal(got[14], LICENCE_URL);
  assert.equal(got[1], "Zain Mint"); assert.equal(got[4], "Zain Mint Regular"); assert.equal(got[6], "ZainMint-Regular");
});

test("a face with a slider moved takes a derived family name and keeps the licence", () => {
  for (const params of [{ weight: 0.145 }, { contrast: 0.6, width: 1.2 }, { style: "runic" }]) {
    const { bytes, family, derived } = mintedTTF(mint(params, 58), params);
    const got = names(bytes);
    assert.equal(derived, true); assert.match(family, /^Minted [0-9a-f]{8}$/);
    for (const id of [1, 3, 4, 6]) assert.ok(!/Zain ?Mint/i.test(got[id]), `name ${id} "${got[id]}" uses the reserved name`);
    assert.equal(got[0], COPYRIGHT); assert.equal(got[13], LICENCE); assert.equal(got[14], LICENCE_URL);
    assert.equal(familyFor({ ...params }), family, "the same numbers give the same name");
  }
  assert.notEqual(familyFor({ weight: 0.145 }), familyFor({ weight: 0.146 }));
  assert.equal(familyFor({ weight: 0.085, contrast: 0.82 }), "Zain Mint", "numbers at their defaults are the original");
});

test("without the records the bytes stay the Python engine's (the parity test holds)", () => {
  const face = mint({}, 58);
  assert.deepEqual(names(toTTF(face))[0], undefined);
  assert.notDeepEqual(toTTF(face), mintedTTF(face, {}).bytes);
});

test("OFL.txt sits beside the font source with the copyright and the reserved name", () => {
  const text = readFileSync(new URL("./OFL.txt", import.meta.url), "utf8");
  assert.ok(text.startsWith('Copyright 2026 Zain Dana Harper, with Reserved Font Name "Zain Mint".'));
  assert.match(text, /SIL OPEN FONT LICENSE Version 1\.1 - 26 February 2007/);
});
