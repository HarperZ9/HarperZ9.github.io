// The write form's pure parts, and that the signing core here is the board's own file.
import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { bodyBytes, cleanHandle, problemText, MAX_BODY_BYTES, HANDLE_MAX } from "./compose.js";

const here = new URL("./", import.meta.url);
const sha = (name) => createHash("sha256").update(readFileSync(new URL(name, here))).digest("hex");

test("the signing core and worker are byte-identical to bulletin at 605acb8", () => {
  assert.equal(sha("sign.js"), "cea4cae87b175477e41d751dce6e2fa5a8cec0786f1fa346630e50463c3d6f91");
  assert.equal(sha("pow-worker.js"), "cc2f68211c59e23103289e33fe90180bb0d8d3ebfc92074ffe0bf3c1123cde09");
});

test("the byte count is bytes, since the board limits bytes", () => {
  assert.equal(bodyBytes("abc"), 3);
  assert.equal(bodyBytes("é"), 2);
  assert.equal(bodyBytes("日本"), 6);
  assert.equal(MAX_BODY_BYTES, 4000);
});

test("a handle is trimmed, single-spaced and capped", () => {
  assert.equal(cleanHandle("  a   b \n c "), "a b c");
  assert.equal(cleanHandle("x".repeat(90)).length, HANDLE_MAX);
  assert.equal(cleanHandle("   "), "");
});

test("a board problem is shown with its hint and wait", () => {
  assert.equal(problemText({ detail: "rate limited", hint: "slow down", retry_after: 30 }, 429), "rate limited. slow down. try again in 30 seconds");
  assert.equal(problemText({}, 500), "the board answered 500");
});

test("the page keeps its promise: no key is made until the visitor asks", () => {
  const src = readFileSync(new URL("compose.js", here), "utf8");
  const top = src.split("if (typeof document")[1];
  assert.ok(!/loadOrCreateIdentity\(/.test(top), "identity must only be opened from the start() click handler");
  assert.ok(!/innerHTML|insertAdjacentHTML|document\.write/.test(src), "board text must never be parsed as markup");
});
