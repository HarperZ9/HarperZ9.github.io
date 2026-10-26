// SPDX-License-Identifier: FSL-1.1-MIT
// Copyright 2026 Zain Dana Harper
//
// dataviz-art/typeset: words set from data on one variable-font axis (FRAMEWORK.md section 2b).
// Hanken Grotesk ships a weight axis (100 to 900); that is the only axis we drive. Size, tracking and
// colour stay fixed so the weight reads alone. Each word keeps its value in data-value and a title,
// and the plain view sets every word at one weight while the table keeps the numbers.
import { escapeXml } from "../substrate/vector.mjs";

// value in [lo, hi] to a weight in [wMin, wMax], snapped to `step` so the printed key matches what is drawn.
export const weightFor = (v, { lo, hi, wMin = 200, wMax = 900, step = 50 }) => {
  const t = (Math.max(lo, Math.min(hi, v)) - lo) / (hi - lo);
  return Math.round((wMin + t * (wMax - wMin)) / step) * step;
};
// and back: the value a weight stands for, for the key and for read-back tests
export const valueFor = (w, { lo, hi, wMin = 200, wMax = 900 }) => lo + ((w - wMin) / (wMax - wMin)) * (hi - lo);

// words: [{ text, value, label }]; returns HTML spans with font-variation-settings on the weight axis.
export function setWords(words, scale, { unit = "" } = {}) {
  return words.map((w) => {
    const wt = weightFor(w.value, scale);
    return `<span class="tw" style="font-weight:${wt};font-variation-settings:'wght' ${wt}" data-value="${w.value}" title="${escapeXml(`${w.label}: ${w.value}${unit}`)}">${escapeXml(w.text)}</span>`;
  }).join(" ");
}

// The printed key: one sample word at evenly spaced weights, each with the value it stands for.
export function weightKey(sample, scale, { steps = 5, unit = "", digits = 0 } = {}) {
  const { wMin = 200, wMax = 900 } = scale, out = [];
  for (let k = 0; k < steps; k++) {
    const wt = Math.round(wMin + (k / (steps - 1)) * (wMax - wMin));
    out.push(`<span class="tk"><span class="tw" style="font-weight:${wt};font-variation-settings:'wght' ${wt}">${escapeXml(sample)}</span><small>${valueFor(wt, scale).toFixed(digits)}${escapeXml(unit)}</small></span>`);
  }
  return out.join("");
}
