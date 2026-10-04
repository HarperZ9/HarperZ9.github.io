// node --test system/media-engine/colour.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { RISK_LEVELS, RISK_TOKENS, RISK_GROUNDS, riskOf, hotMark, markRisk, contrastRatio, riskCss } from "./colour.mjs";

test("every risk token clears WCAG AA as text on every ground of its pole", () => {
  for (const pole of ["light", "dark"]) {
    for (const key of [...RISK_LEVELS, "ink", "quiet"]) {
      for (const ground of RISK_GROUNDS[pole]) {
        const r = contrastRatio(RISK_TOKENS[pole][key], ground);
        assert.ok(r >= 4.5, `${pole} ${key} ${RISK_TOKENS[pole][key]} on ${ground} is ${r.toFixed(2)}:1`);
      }
    }
  }
  assert.ok(Math.abs(contrastRatio("#000000", "#ffffff") - 21) < 1e-9, "the contrast function itself");
});

test("verdict words map to liability levels, and unknown words read as moderate", () => {
  assert.equal(riskOf("MATCH"), "low");
  assert.equal(riskOf("unverifiable"), "moderate");
  assert.equal(riskOf("DRIFT"), "elevated");
  assert.equal(riskOf("refused"), "high");
  assert.equal(riskOf("high"), "high");
  assert.equal(riskOf("something new"), "moderate");
  assert.equal(riskOf(undefined), "moderate");
});

test("one hot mark per view: the highest liability, first on a tie, none for an empty view", () => {
  assert.equal(hotMark(["low", "elevated", "moderate", "elevated"]), 1);
  assert.equal(hotMark(["MATCH", "MATCH"]), 0, "a clean view still shows its result");
  assert.equal(hotMark(["low", "high", "DRIFT"]), 1);
  assert.equal(hotMark([]), -1);
});

test("markRisk sets data-risk on every node and data-risk-hot on exactly one", () => {
  const node = (verdict) => ({ dataset: { verdict } });
  const nodes = [node("MATCH"), node("DRIFT"), node("UNVERIFIABLE")];
  const hot = markRisk(nodes);
  assert.equal(hot, 1);
  assert.deepEqual(nodes.map((n) => n.dataset.risk), ["low", "elevated", "moderate"]);
  assert.equal(nodes.filter((n) => "riskHot" in n.dataset).length, 1);
  nodes[2].dataset.verdict = "FAIL";
  markRisk(nodes);
  assert.equal(nodes.filter((n) => "riskHot" in n.dataset).length, 1, "the hot mark moves, it does not multiply");
  assert.ok("riskHot" in nodes[2].dataset);
});

test("risk.css carries exactly the tokens colour.mjs generates", () => {
  const css = fs.readFileSync(new URL("./risk.css", import.meta.url), "utf8").replace(/\s+/g, "");
  assert.ok(css.includes(riskCss().replace(/\s+/g, "")), "regenerate risk.css from riskCss()");
  for (const level of RISK_LEVELS) assert.ok(css.includes(`[data-risk="${level}"][data-risk-hot]`), level);
});

// sense-core is a vendored library that keeps its own float OKLab; it must stay the contract's.
test("sense-core's OKLab gives the contract's floats bit for bit", async () => {
  const sc = await import("../lib/sense-core/colour-perceptual.mjs");
  const ss = await import("./contracts.mjs");
  for (let r = 0; r < 256; r += 15) for (let g = 0; g < 256; g += 15) for (let b = 0; b < 256; b += 15) {
    const lin = [r, g, b].map((c) => ss.srgbToLinear(c / 255));
    assert.deepEqual(lin, [r, g, b].map((c) => sc.srgbToLinear(c / 255)));
    const lab = ss.linearSrgbToOklab(...lin);
    assert.deepEqual(sc.linearRgbToOklab(...lin), lab);
    assert.deepEqual(sc.oklabToLinearRgb(...lab), ss.oklabToLinearSrgb(...lab));
  }
});

test("the risk tokens and verdict words are the contract's, and REFUTED reads high", async () => {
  const c = await import("./colour.mjs");
  assert.equal(c.riskOf("refuted"), "high");
  assert.equal(c.riskOf("verified"), "low");
  assert.equal(c.riskOf("unverifiable"), "moderate");
  assert.equal(c.hotMark(["low", "DRIFT", "moderate"]), 1);
});
