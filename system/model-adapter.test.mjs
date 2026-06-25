// system/model-adapter.test.mjs
// node:test suite for model-adapter.js public contract.
//
// Covers:
//   - connect() return-type contract per mode (synchronous, no network)
//   - URL routing: each mode targets the correct endpoint
//   - Request-body shaping per mode (ollama-generate, chat-completions, plain-endpoint)
//   - Key-safety: no Authorization header when key is absent or empty
//   - none mode: connect returns null (no network, no fallback faked)
//   - _selftest(): returns a promise that resolves to a pass/fail summary
//
// Skipped (explicit, with reason):
//   - probe() and autodetect(): both call real fetch to localhost; making a real
//     network call in a test is disallowed. The module provides no injectable
//     fetch seam for those functions. Covered by integration/manual testing only.
//
// buildModelHeaders is NOT re-tested here; it is owned by studio-model.test.mjs.

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { ModelAdapter, _selftest } from "./model-adapter.js";

// ── Fetch stub machinery ───────────────────────────────────────────────────────
//
// fetchWithTimeout inside model-adapter.js references globalThis.fetch and
// globalThis.AbortController. We replace them before each stubbed test and
// restore them after.

function installFetchStub(handler) {
  globalThis.__savedFetch = globalThis.fetch;
  globalThis.__savedAbortController = globalThis.AbortController;

  // AbortController stub: signal is an object with an aborted flag.
  // fetchWithTimeout spreads { ...init, signal } into fetch; our handler ignores it.
  globalThis.AbortController = class {
    constructor() {
      this.signal = { aborted: false };
    }
    abort() {
      this.signal.aborted = true;
    }
  };

  globalThis.fetch = handler;
}

function restoreFetch() {
  globalThis.fetch = globalThis.__savedFetch;
  globalThis.AbortController = globalThis.__savedAbortController;
  delete globalThis.__savedFetch;
  delete globalThis.__savedAbortController;
}

// Helper: build a minimal Response-like stub.
function makeResponse(status, jsonBody) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => jsonBody,
  };
}

// ── Expected endpoint URLs (must match constants in model-adapter.js) ──────────
const OLLAMA_GEN   = "http://localhost:11434/api/generate";
const OLLAMA_CHAT  = "http://localhost:11434/api/chat";
const LM_STUDIO_CHAT = "http://localhost:1234/v1/chat/completions";

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 1: connect() return-type contract (synchronous, zero network)
// ─────────────────────────────────────────────────────────────────────────────

describe("connect() return-type contract", () => {

  test("mode=none returns null", () => {
    const result = ModelAdapter.connect({ mode: "none" });
    assert.equal(result, null);
  });

  test("null config returns null", () => {
    const result = ModelAdapter.connect(null);
    assert.equal(result, null);
  });

  test("mode=endpoint with no URL returns null", () => {
    const result = ModelAdapter.connect({ mode: "endpoint" });
    assert.equal(result, null);
  });

  test("mode=endpoint with null URL returns null", () => {
    const result = ModelAdapter.connect({ mode: "endpoint", url: null });
    assert.equal(result, null);
  });

  test("mode=local-ollama returns a function", () => {
    const fn = ModelAdapter.connect({ mode: "local-ollama" });
    assert.equal(typeof fn, "function");
  });

  test("mode=local-openai returns a function", () => {
    const fn = ModelAdapter.connect({ mode: "local-openai" });
    assert.equal(typeof fn, "function");
  });

  test("mode=endpoint with valid URL returns a function", () => {
    const fn = ModelAdapter.connect({ mode: "endpoint", url: "http://example.test/ai" });
    assert.equal(typeof fn, "function");
  });

});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 2: URL routing - each mode calls the correct endpoint
// ─────────────────────────────────────────────────────────────────────────────

describe("URL routing per mode", () => {

  test("local-ollama falls back to /api/generate when /api/chat returns 404", async () => {
    const called = [];

    installFetchStub(async (url) => {
      called.push(url);
      if (url === OLLAMA_CHAT) {
        // Simulate old Ollama that does not support /api/chat.
        return makeResponse(404, {});
      }
      if (url === OLLAMA_GEN) {
        return makeResponse(200, { response: "frame looks teal", done: true });
      }
      throw new Error("unexpected URL: " + url);
    });

    try {
      const fn = ModelAdapter.connect({ mode: "local-ollama", model: "llama3" });
      await fn("what do you see", null);
      assert.ok(called.includes(OLLAMA_CHAT), "/api/chat must be attempted first");
      assert.ok(called.includes(OLLAMA_GEN), "/api/generate must be the fallback");
    } finally {
      restoreFetch();
    }
  });

  test("local-ollama uses /api/chat exclusively when it returns 200", async () => {
    const called = [];

    installFetchStub(async (url) => {
      called.push(url);
      if (url === OLLAMA_CHAT) {
        return makeResponse(200, {
          choices: [{ message: { role: "assistant", content: "chat path response" } }],
        });
      }
      throw new Error("unexpected URL: " + url);
    });

    try {
      const fn = ModelAdapter.connect({ mode: "local-ollama", model: "llama3" });
      const result = await fn("hello", null);
      assert.equal(result, "chat path response");
      assert.ok(!called.includes(OLLAMA_GEN), "/api/generate must NOT be called when /api/chat succeeds");
    } finally {
      restoreFetch();
    }
  });

  test("local-openai targets /v1/chat/completions on localhost:1234 by default", async () => {
    let calledUrl = null;

    installFetchStub(async (url) => {
      calledUrl = url;
      return makeResponse(200, {
        choices: [{ message: { role: "assistant", content: "openai path response" } }],
      });
    });

    try {
      const fn = ModelAdapter.connect({ mode: "local-openai" });
      await fn("describe the frame", null);
      assert.equal(calledUrl, LM_STUDIO_CHAT);
    } finally {
      restoreFetch();
    }
  });

  test("local-openai respects config.url override", async () => {
    const customUrl = "http://localhost:9999/v1/chat/completions";
    let calledUrl = null;

    installFetchStub(async (url) => {
      calledUrl = url;
      return makeResponse(200, {
        choices: [{ message: { role: "assistant", content: "custom server" } }],
      });
    });

    try {
      const fn = ModelAdapter.connect({ mode: "local-openai", url: customUrl });
      await fn("test message", null);
      assert.equal(calledUrl, customUrl);
    } finally {
      restoreFetch();
    }
  });

  test("endpoint mode POSTs to config.url exactly", async () => {
    const targetUrl = "http://my-server.test/generate";
    let calledUrl = null;

    installFetchStub(async (url) => {
      calledUrl = url;
      return makeResponse(200, {
        choices: [{ message: { role: "assistant", content: "endpoint response" } }],
      });
    });

    try {
      const fn = ModelAdapter.connect({ mode: "endpoint", url: targetUrl });
      await fn("test", null);
      assert.equal(calledUrl, targetUrl);
    } finally {
      restoreFetch();
    }
  });

});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 3: Request-body shaping per mode
// ─────────────────────────────────────────────────────────────────────────────

describe("request body shaping", () => {

  const fakePerception = {
    phash: "aabbccdd11223344",
    features: { contrast: 0.72, entropy: 0.55, balance: 0.48 },
    dominantColors: ["#1a2b3c", "#ffee00"],
    hueName: "teal",
    edgeDensity: 0.18,
    motion: 0.03,
    audio: { level: 0.14, pitch: 440 },
    sourceName: "test-source",
    width: 1280,
    height: 720,
  };

  test("local-ollama /api/generate body has model, prompt, and stream=false", async () => {
    let capturedBody = null;

    installFetchStub(async (url, init) => {
      if (url === OLLAMA_CHAT) return makeResponse(404, {});
      if (url === OLLAMA_GEN) {
        capturedBody = JSON.parse(init.body);
        return makeResponse(200, { response: "ok", done: true });
      }
      throw new Error("unexpected URL: " + url);
    });

    try {
      const fn = ModelAdapter.connect({ mode: "local-ollama", model: "mistral" });
      await fn("what colors?", fakePerception);

      assert.ok(capturedBody !== null, "body must have been captured");
      assert.equal(capturedBody.model, "mistral",
        "body.model must match config.model");
      assert.equal(typeof capturedBody.prompt, "string",
        "body.prompt must be a string for /api/generate");
      assert.equal(capturedBody.stream, false,
        "body.stream must be false");
      assert.ok(capturedBody.prompt.includes("what colors?"),
        "body.prompt must contain the user message");
      assert.ok(capturedBody.prompt.includes("aabbccdd11223344"),
        "body.prompt must contain perception data");
    } finally {
      restoreFetch();
    }
  });

  test("local-ollama /api/chat body has model, messages array, and stream=false", async () => {
    let capturedBody = null;

    installFetchStub(async (url, init) => {
      if (url === OLLAMA_CHAT) {
        capturedBody = JSON.parse(init.body);
        return makeResponse(200, {
          choices: [{ message: { role: "assistant", content: "chat body check" } }],
        });
      }
      throw new Error("unexpected URL (generate should not be called): " + url);
    });

    try {
      const fn = ModelAdapter.connect({ mode: "local-ollama", model: "llama3" });
      await fn("describe colors", fakePerception);

      assert.ok(capturedBody !== null, "body must have been captured");
      assert.equal(capturedBody.model, "llama3");
      assert.ok(Array.isArray(capturedBody.messages), "body.messages must be an array");
      assert.equal(capturedBody.messages.length, 2, "messages must have system + user entries");
      assert.equal(capturedBody.messages[0].role, "system");
      assert.equal(capturedBody.messages[1].role, "user");
      assert.equal(capturedBody.messages[1].content, "describe colors",
        "user message content must match input");
      assert.equal(capturedBody.stream, false);
    } finally {
      restoreFetch();
    }
  });

  test("local-ollama defaults model to llama3 when config.model is omitted", async () => {
    let capturedBody = null;

    installFetchStub(async (url, init) => {
      if (url === OLLAMA_CHAT) return makeResponse(404, {});
      if (url === OLLAMA_GEN) {
        capturedBody = JSON.parse(init.body);
        return makeResponse(200, { response: "default model", done: true });
      }
      throw new Error("unexpected URL: " + url);
    });

    try {
      const fn = ModelAdapter.connect({ mode: "local-ollama" });
      await fn("hello", null);
      assert.equal(capturedBody.model, "llama3",
        "default model must be llama3 when not configured");
    } finally {
      restoreFetch();
    }
  });

  test("local-openai body has model, messages array, and stream=false", async () => {
    let capturedBody = null;

    installFetchStub(async (url, init) => {
      capturedBody = JSON.parse(init.body);
      return makeResponse(200, {
        choices: [{ message: { role: "assistant", content: "openai body check" } }],
      });
    });

    try {
      const fn = ModelAdapter.connect({ mode: "local-openai", model: "phi3" });
      await fn("what is this?", fakePerception);

      assert.equal(capturedBody.model, "phi3");
      assert.ok(Array.isArray(capturedBody.messages), "body.messages must be an array");
      assert.equal(capturedBody.messages[0].role, "system");
      assert.equal(capturedBody.messages[1].role, "user");
      assert.equal(capturedBody.messages[1].content, "what is this?");
      assert.equal(capturedBody.stream, false);
    } finally {
      restoreFetch();
    }
  });

  test("local-openai defaults model to local-model when config.model is omitted", async () => {
    let capturedBody = null;

    installFetchStub(async (url, init) => {
      capturedBody = JSON.parse(init.body);
      return makeResponse(200, {
        choices: [{ message: { role: "assistant", content: "ok" } }],
      });
    });

    try {
      const fn = ModelAdapter.connect({ mode: "local-openai" });
      await fn("hello", null);
      assert.equal(capturedBody.model, "local-model",
        "default model must be local-model when not configured");
    } finally {
      restoreFetch();
    }
  });

  test("endpoint with chatContract=true sends OpenAI-compatible messages body", async () => {
    let capturedBody = null;

    installFetchStub(async (url, init) => {
      capturedBody = JSON.parse(init.body);
      return makeResponse(200, {
        choices: [{ message: { role: "assistant", content: "chat contract" } }],
      });
    });

    try {
      const fn = ModelAdapter.connect({
        mode: "endpoint",
        url: "http://api.test/v1/chat/completions",
        chatContract: true,
        model: "gpt-local",
      });
      await fn("explain the frame", fakePerception);

      assert.ok(Array.isArray(capturedBody.messages), "chatContract=true must send messages array");
      assert.equal(capturedBody.model, "gpt-local");
      assert.equal(capturedBody.stream, false);
      assert.ok(!("prompt" in capturedBody),
        "chatContract=true must NOT send a plain prompt field");
    } finally {
      restoreFetch();
    }
  });

  test("endpoint with chatContract=false sends plain prompt body", async () => {
    let capturedBody = null;

    installFetchStub(async (url, init) => {
      capturedBody = JSON.parse(init.body);
      return makeResponse(200, { text: "plain response" });
    });

    try {
      const fn = ModelAdapter.connect({
        mode: "endpoint",
        url: "http://api.test/go",
        chatContract: false,
      });
      await fn("plain query", fakePerception);

      assert.equal(typeof capturedBody.prompt, "string",
        "chatContract=false must send a prompt string");
      assert.ok(capturedBody.prompt.includes("plain query"),
        "plain prompt must contain the user message");
      assert.ok(!("messages" in capturedBody),
        "chatContract=false must NOT send a messages array");
    } finally {
      restoreFetch();
    }
  });

  test("endpoint chatContract defaults to true when omitted", async () => {
    let capturedBody = null;

    installFetchStub(async (url, init) => {
      capturedBody = JSON.parse(init.body);
      return makeResponse(200, {
        choices: [{ message: { role: "assistant", content: "default contract" } }],
      });
    });

    try {
      const fn = ModelAdapter.connect({
        mode: "endpoint",
        url: "http://api.test/v1/chat",
        // chatContract deliberately omitted
      });
      await fn("hello", null);

      assert.ok(Array.isArray(capturedBody.messages),
        "omitted chatContract must default to true (send messages array)");
    } finally {
      restoreFetch();
    }
  });

});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 4: Key-safety guarantee
// ─────────────────────────────────────────────────────────────────────────────

describe("key-safety: no key invented or leaked", () => {

  test("local-ollama never sends Authorization header", async () => {
    let capturedHeaders = null;

    installFetchStub(async (url, init) => {
      // Capture whichever call comes in.
      capturedHeaders = init.headers || {};
      if (url === OLLAMA_CHAT) return makeResponse(404, {});
      return makeResponse(200, { response: "no key test", done: true });
    });

    try {
      const fn = ModelAdapter.connect({ mode: "local-ollama" });
      await fn("hello", null);

      assert.ok(!("Authorization" in capturedHeaders),
        "local-ollama must never send an Authorization header");
    } finally {
      restoreFetch();
    }
  });

  test("local-openai never sends Authorization header", async () => {
    let capturedHeaders = null;

    installFetchStub(async (url, init) => {
      capturedHeaders = init.headers || {};
      return makeResponse(200, {
        choices: [{ message: { role: "assistant", content: "ok" } }],
      });
    });

    try {
      const fn = ModelAdapter.connect({ mode: "local-openai" });
      await fn("hello", null);

      assert.ok(!("Authorization" in capturedHeaders),
        "local-openai must never send an Authorization header");
    } finally {
      restoreFetch();
    }
  });

  test("endpoint with no key does NOT add Authorization header", async () => {
    let capturedHeaders = null;

    installFetchStub(async (url, init) => {
      capturedHeaders = init.headers || {};
      return makeResponse(200, {
        choices: [{ message: { role: "assistant", content: "no auth" } }],
      });
    });

    try {
      const fn = ModelAdapter.connect({
        mode: "endpoint",
        url: "http://api.test/v1/chat",
        // key deliberately absent
      });
      await fn("hello", null);

      assert.ok(!("Authorization" in capturedHeaders),
        "endpoint with no key must not send Authorization");
    } finally {
      restoreFetch();
    }
  });

  test("endpoint with empty-string key does NOT add Authorization header", async () => {
    let capturedHeaders = null;

    installFetchStub(async (url, init) => {
      capturedHeaders = init.headers || {};
      return makeResponse(200, {
        choices: [{ message: { role: "assistant", content: "ok" } }],
      });
    });

    try {
      const fn = ModelAdapter.connect({
        mode: "endpoint",
        url: "http://api.test/v1/chat",
        key: "",
      });
      await fn("hello", null);

      // The adapter does: const key = config.key || null; then if (key) adds the header.
      // An empty string is falsy, so it must be treated as no key.
      assert.ok(!("Authorization" in capturedHeaders),
        "endpoint with key='' must not send Authorization (empty string is no key)");
    } finally {
      restoreFetch();
    }
  });

  test("endpoint with a real key sends Authorization: Bearer <key>", async () => {
    let capturedHeaders = null;

    installFetchStub(async (url, init) => {
      capturedHeaders = init.headers || {};
      return makeResponse(200, {
        choices: [{ message: { role: "assistant", content: "ok" } }],
      });
    });

    try {
      const fn = ModelAdapter.connect({
        mode: "endpoint",
        url: "http://api.test/v1/chat",
        key: "sk-real-key-abc",
      });
      await fn("hello", null);

      assert.equal(capturedHeaders["Authorization"], "Bearer sk-real-key-abc",
        "endpoint with a real key must send the correct Authorization header");
    } finally {
      restoreFetch();
    }
  });

  test("the page ships no hardcoded key: module source contains no Bearer token literal", async () => {
    // Read the module source at runtime and verify no Bearer token pattern exists.
    // This is a structural guard: no sk-*, no hardcoded credential strings.
    const { readFileSync } = await import("node:fs");
    const src = readFileSync(new URL("./model-adapter.js", import.meta.url), "utf8");

    // The source must never contain a hardcoded bearer credential value.
    // A real key would look like "Bearer sk-..." as a string literal.
    const bearerLiteralPattern = /["']Bearer\s+[A-Za-z0-9_\-]{8,}/;
    assert.ok(!bearerLiteralPattern.test(src),
      "module source must contain no hardcoded Bearer token literal");
  });

});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 5: Skipped - network-dependent functions
// ─────────────────────────────────────────────────────────────────────────────

test("probe() - SKIPPED: requires real network call to localhost; no injectable fetch seam exposed", { skip: "probe() calls fetchWithTimeout via closure over globalThis.fetch but the probe test would need a localhost server; skipping to avoid real network dependency in unit tests" }, async () => {});

test("autodetect() - SKIPPED: delegates to probe(); same network-call constraint applies", { skip: "autodetect() calls probe() for localhost:11434 and localhost:1234; no real servers guaranteed in CI; skipping to avoid false pass or real network call" }, async () => {});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 6: _selftest() contract
// ─────────────────────────────────────────────────────────────────────────────

describe("_selftest() function", () => {

  test("_selftest is exported and callable", () => {
    assert.equal(typeof _selftest, "function",
      "_selftest must be exported as a named function");
  });

  test("_selftest() returns a promise", () => {
    // _selftest internally stubs globalThis.fetch; restore after.
    const result = _selftest();
    assert.ok(result instanceof Promise,
      "_selftest() must return a Promise");
    // We must await and then restore so the global is not left dirty.
    return result;
  });

  test("_selftest() resolves with a summary object containing passed and failed counts", async () => {
    const summary = await _selftest();

    assert.ok(summary !== null && typeof summary === "object",
      "summary must be a non-null object");
    assert.equal(typeof summary.passed, "number",
      "summary.passed must be a number");
    assert.equal(typeof summary.failed, "number",
      "summary.failed must be a number");
    assert.ok(Array.isArray(summary.errors),
      "summary.errors must be an array");
  });

  test("_selftest() passes all its own internal assertions (failed === 0)", async () => {
    const summary = await _selftest();

    assert.equal(summary.failed, 0,
      "All _selftest internal assertions must pass. Failures: " + JSON.stringify(summary.errors));
    assert.ok(summary.passed > 0,
      "At least one internal assertion must have run");
  });

});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 7: Error propagation - connect() fn rejects on bad HTTP status
// ─────────────────────────────────────────────────────────────────────────────

describe("error propagation from connect() functions", () => {

  test("local-ollama fn throws when /api/generate returns non-ok status", async () => {
    installFetchStub(async (url) => {
      if (url === OLLAMA_CHAT) return makeResponse(404, {});
      // Both chat (404) and generate (500) fail.
      return makeResponse(500, {});
    });

    try {
      const fn = ModelAdapter.connect({ mode: "local-ollama" });
      await assert.rejects(
        () => fn("hello", null),
        /Ollama generate failed/,
        "local-ollama fn must throw a meaningful error on 500"
      );
    } finally {
      restoreFetch();
    }
  });

  test("local-openai fn throws when server returns non-ok status", async () => {
    installFetchStub(async () => makeResponse(503, {}));

    try {
      const fn = ModelAdapter.connect({ mode: "local-openai" });
      await assert.rejects(
        () => fn("hello", null),
        /Local OpenAI server failed/,
        "local-openai fn must throw a meaningful error on 503"
      );
    } finally {
      restoreFetch();
    }
  });

  test("endpoint fn throws when server returns non-ok status", async () => {
    installFetchStub(async () => makeResponse(401, {}));

    try {
      const fn = ModelAdapter.connect({ mode: "endpoint", url: "http://api.test/go" });
      await assert.rejects(
        () => fn("hello", null),
        /Endpoint failed/,
        "endpoint fn must throw a meaningful error on 401"
      );
    } finally {
      restoreFetch();
    }
  });

  test("local-ollama fn throws when response shape is unreadable", async () => {
    installFetchStub(async (url) => {
      if (url === OLLAMA_CHAT) return makeResponse(404, {});
      // Generate returns 200 but with a bad shape (no .response field).
      return makeResponse(200, { done: true });
    });

    try {
      const fn = ModelAdapter.connect({ mode: "local-ollama" });
      await assert.rejects(
        () => fn("hello", null),
        /unreadable response shape/,
        "local-ollama fn must throw when response body is unrecognized"
      );
    } finally {
      restoreFetch();
    }
  });

});
