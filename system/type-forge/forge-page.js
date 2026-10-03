// type-forge.html: mint Zain Mint in the browser and set the visitor's text in it.
// Every change re-mints the face, writes the TrueType bytes, loads them as a FontFace under a name
// tied to the mint, and shows the receipt. Nothing leaves the page.

import { mint, DEFAULTS } from "./forge.mjs";
import { toTTF } from "./ttf.mjs";
import { digest } from "../media-engine/receipt.mjs";
import { markRisk, riskOf, RISK_LABELS } from "../media-engine/colour.mjs";

const $ = (id) => document.getElementById(id);
const KEYS = ["weight", "contrast", "width", "x_height", "roundness", "aperture"];
const FIXED = { weight: 3, contrast: 2, width: 2, x_height: 2, roundness: 2, aperture: 2 };
let loaded = null, timer = 0, token = 0;

function params() {
  const p = {};
  for (const k of KEYS) p[k] = +$("tf-" + k).value;
  if ($("tf-style").value) p.style = $("tf-style").value;
  return p;
}

function status(lines) {
  const list = $("tf-status");
  list.replaceChildren(...lines.map(([label, verdict, detail]) => {
    const li = document.createElement("li");
    li.dataset.verdict = verdict;
    const k = document.createElement("span"); k.textContent = label + ": ";
    const v = document.createElement("strong"); v.textContent = verdict.toLowerCase() + ", " + RISK_LABELS[riskOf(verdict)];
    li.append(k, v);
    if (detail) li.append(" " + detail);
    return li;
  }));
  markRisk(list.querySelectorAll("li"));
}

function missingGlyphs(face, text) {
  const miss = new Set();
  for (const ch of text) if (ch !== " " && ch !== "\n" && !face.glyphs[ch]) miss.add(ch);
  return [...miss];
}

async function remint() {
  const my = ++token;
  const p = params();
  for (const k of KEYS) $("tf-" + k + "-v").textContent = (+p[k]).toFixed(FIXED[k]);
  const face = mint(p, 58);
  if (face.refused) {
    document.body.classList.add("tf-refused");
    // Say it beside the sample too, so the refusal is read where the eye already is.
    $("tf-missing").textContent = "Refused, so the last face that passed stays greyed: " + face.refusals.join(" ");
    status([["Mint", "REFUSED", face.refusals.join(" ")], ["Font file", "UNVERIFIABLE", "no outlines were drawn"]]);
    return;
  }
  const bytes = toTTF(face, "Zain Mint", "Regular");
  const sha = await digest(bytes);
  if (my !== token) return;
  const family = "ZainMint-" + sha.slice(0, 12);
  try {
    const ff = new FontFace(family, bytes.buffer, { display: "block" });
    await ff.load();
    if (my !== token) return;
    document.fonts.add(ff);
    if (loaded && loaded !== ff) document.fonts.delete(loaded);
    loaded = ff;
  } catch (e) {
    console.error("[type-forge] the minted font would not load:", e);
    status([["Mint", "OK", Object.keys(face.glyphs).length + " glyphs"], ["Font file", "ERROR", "the browser refused the font: " + e.message]]);
    return;
  }
  document.body.classList.remove("tf-refused");
  document.documentElement.style.setProperty("--tf-family", `"${family}"`);
  const text = $("tf-text").value;
  $("tf-sample").textContent = text || " ";
  const miss = missingGlyphs(face, text);
  $("tf-missing").textContent = miss.length ? "Not in the face yet, so shown in the fallback: " + miss.join(" ") : "";
  status([
    ["Mint", "OK", Object.keys(face.glyphs).length + " glyphs, " + Object.keys(face.kerning).length + " kerning pairs"],
    ["Font file", "OK", bytes.length.toLocaleString("en") + " bytes, sha-256 " + sha.slice(0, 16)],
    ["Release", "PENDING", "in progress; not for sale or download"],
  ]);
}

function schedule() { clearTimeout(timer); timer = setTimeout(remint, 60); }

function boot() {
  const form = $("tf-controls");
  if (!form) return;
  form.addEventListener("input", schedule);
  form.addEventListener("change", schedule);
  form.addEventListener("submit", (e) => e.preventDefault());
  $("tf-text").addEventListener("input", schedule);
  for (const b of form.querySelectorAll("[data-weight]")) {
    b.addEventListener("click", () => { $("tf-weight").value = b.dataset.weight; schedule(); });
  }
  for (const k of KEYS) if ($("tf-" + k).value === "") $("tf-" + k).value = DEFAULTS[k];
  remint().catch((e) => console.error("[type-forge] mint failed:", e));
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true });
else boot();
