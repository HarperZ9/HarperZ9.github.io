// llm.test.mjs: the solve loop, tested deterministically with a SCRIPTED chat backend (no live model).
// This proves the loop logic - propose -> tool -> certify, refusing non-conserved submissions - works
// independently of any model, and that the chat backend is cleanly injectable (Ollama, an OpenAI-style
// endpoint, the Studio's connected model, or a test script). Run: node --test system/discovery/llm.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { makeTools } from "./tools.js";
import { sho } from "./systems.js";
import { solveLoop, parseAction } from "./llm.js";

test("parseAction extracts the last JSON tool action", () => {
  assert.deepEqual(parseAction('thinking... {"tool":"fit","terms":["x^2","v^2"]}'), { tool: "fit", terms: ["x^2", "v^2"] });
  assert.deepEqual(parseAction('{"tool":"submit","expr":"x^2+v^2"} done'), { tool: "submit", expr: "x^2+v^2" });
  assert.equal(parseAction("no action here"), null);
});

test("solveLoop drives a SCRIPTED model to a certified solution (backend-agnostic chat)", async () => {
  const tools = makeTools(sho, { dt: 0.01, n: 1500, trials: 6, tol: 0.02 });
  const scripted = [
    '{"tool":"fit","terms":["x","v"]}',       // wrong basis -> refuted, the loop pushes back
    '{"tool":"fit","terms":["x^2","v^2"]}',   // correct -> verified -> the loop certifies and stops
  ];
  let i = 0;
  const r = await solveLoop(tools, { maxSteps: 6, chat: async () => scripted[Math.min(i++, scripted.length - 1)] });
  assert.equal(r.solved, true, JSON.stringify(r.transcript));
  assert.equal(r.certificate.verdict, "verified");
});

test("solveLoop refuses to certify a model that only ever proposes a non-conserved quantity", async () => {
  const tools = makeTools(sho, { dt: 0.01, n: 1500, trials: 6, tol: 0.02 });
  const r = await solveLoop(tools, { maxSteps: 4, chat: async () => '{"tool":"fit","terms":["x","v"]}' });
  assert.equal(r.solved, false); // never verified -> the verifier (the floor) holds
});

test("solveLoop reports model-unreachable cleanly when the chat backend throws", async () => {
  const tools = makeTools(sho, { dt: 0.01, n: 1500, trials: 6, tol: 0.02 });
  const r = await solveLoop(tools, { maxSteps: 3, chat: async () => { throw new Error("ECONNREFUSED"); } });
  assert.equal(r.solved, false);
  assert.ok(/unreachable/.test(r.error));
});
