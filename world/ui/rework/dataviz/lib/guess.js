// SPDX-License-Identifier: FSL-1.1-MIT
// Copyright 2026 Zain Dana Harper
//
// dataviz-art/guess: the thought channel. The viewer commits to a guess before the reveal.
// Nothing is stored or sent; the guess lives in the page until it closes.

// A slider guess. Returns a promise that resolves with the number when the viewer presses reveal.
export function sliderGuess(root) {
  const input = root.querySelector("input[type=range]"), out = root.querySelector("output"), go = root.querySelector("button");
  const show = () => { out.value = input.value; out.textContent = input.value + (input.dataset.unit || ""); };
  input.addEventListener("input", show); show();
  return new Promise((resolve) => go.addEventListener("click", () => { input.disabled = true; go.disabled = true; resolve(Number(input.value)); }, { once: true }));
}

// A choice guess: buttons with data-choice. Resolves with the chosen value.
export function choiceGuess(root) {
  const buttons = [...root.querySelectorAll("[data-choice]")];
  return new Promise((resolve) => buttons.forEach((b) => b.addEventListener("click", () => {
    buttons.forEach((x) => { x.setAttribute("aria-pressed", String(x === b)); x.disabled = true; });
    resolve(b.dataset.choice);
  })));
}

// Plain words for how far a guess sat from the value.
export function gapWords(guess, actual, unit) {
  const d = guess - actual, a = Math.abs(d);
  if (a < 0.5) return `You guessed ${guess}${unit}. The data says ${actual}${unit}. Right on it.`;
  return `You guessed ${guess}${unit}. The data says ${actual}${unit}: you were ${a.toFixed(a < 10 ? 1 : 0)}${unit} too ${d > 0 ? "high" : "low"}.`;
}
