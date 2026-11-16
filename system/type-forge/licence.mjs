// licence.mjs: Zain Mint is released under the SIL Open Font License 1.1 (OFL.txt beside this file), with the
// Reserved Font Name "Zain Mint". Every minted file carries the copyright and the licence in its name table (name IDs
// 0, 13 and 14). The licence keeps the reserved name for the original: a face minted with the sliders moved from the
// forge's defaults is a modified version, so it takes a derived family name, "Minted" and a code read from its numbers.
import { DEFAULTS } from "./forge.mjs";
import { toTTF } from "./ttf.mjs";

export const FAMILY = "Zain Mint";
export const COPYRIGHT = 'Copyright 2026 Zain Dana Harper, with Reserved Font Name "Zain Mint".';
export const LICENCE = "This Font Software is licensed under the SIL Open Font License, Version 1.1. This license is available with a FAQ at: https://openfontlicense.org";
export const LICENCE_URL = "https://openfontlicense.org";
export const RECORDS = Object.freeze([[0, COPYRIGHT], [13, LICENCE], [14, LICENCE_URL]]);

// the numbers that make a face differ from the original: any default moved, or a style other than drawn
export function changed(params = {}) {
  for (const [k, v] of Object.entries(params)) {
    if (k === "style") { if (v) return true; continue; }
    if (k in DEFAULTS && Math.abs(+v - DEFAULTS[k]) > 1e-9) return true;
  }
  return false;
}

// FNV-1a over the numbers in key order, eight hex digits: the same numbers give the same name
function code(params) {
  const text = Object.keys(params).sort().map((k) => `${k}=${params[k]}`).join(";");
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16).padStart(8, "0");
}

export const familyFor = (params = {}) => (changed(params) ? `Minted ${code(params)}` : FAMILY);

// The font file a visitor takes away: the family name the licence allows, and the copyright and licence records.
export function mintedTTF(face, params = {}, style = "Regular") {
  const family = familyFor(params);
  return { family, derived: family !== FAMILY, bytes: toTTF(face, family, style, RECORDS) };
}
