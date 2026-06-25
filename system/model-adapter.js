/**
 * system/model-adapter.js
 * Browser ES module. Zero dependencies. Zero vendor lock-in.
 *
 * INTEGRATION CONTRACT FOR studio.js
 * ===================================
 * studio.js already owns the connectModel(fn) seam and the respond.js fallback.
 * Wire ModelAdapter at the bottom of studio.js, after the seam is defined:
 *
 *   import { ModelAdapter } from "./system/model-adapter.js";
 *
 *   (async () => {
 *     const cfg = await ModelAdapter.autodetect();
 *     if (cfg) {
 *       const fn = ModelAdapter.connect(cfg);
 *       if (fn) {
 *         window.Studio.connectModel(async (message, ctx, history) => {
 *           return fn(message, ctx);
 *         });
 *         return;
 *       }
 *     }
 *     // No reachable local model. Studio stays on the grounded respond.js floor.
 *     // window.Studio.connectModel is NOT called, so _connectedModelFn stays null,
 *     // and studio.js routes every message through respond() as it already does.
 *   })();
 *
 * The adapter NEVER replaces respond.js. Studio.js always has respond() in scope
 * as its final safety net (see the catch branch around _connectedModelFn in studio.js).
 * The adapter only provides a BETTER path when a local model happens to be reachable.
 *
 * MODES
 * ------
 * config.mode = 'local-ollama'
 *   POST http://localhost:11434/api/generate
 *   Body: { model, prompt, stream: false }
 *   No key required. config.model defaults to "llama3".
 *   Model list discoverable via GET /api/tags (used by autodetect to pick the first available).
 *
 * config.mode = 'local-openai'
 *   POST http://localhost:1234/v1/chat/completions  (LM Studio default; also vLLM, llama.cpp, etc.)
 *   Body: OpenAI-compatible chat completions object, stream: false.
 *   No key required. config.model defaults to "local-model".
 *   config.url overrides the base URL if the server runs on a different port.
 *
 * config.mode = 'endpoint'
 *   POST config.url with:
 *     (a) OpenAI-compatible chat completions if config.chatContract is true (default), or
 *     (b) plain { prompt: string } -> { text: string } if config.chatContract is false.
 *   config.key is optional; only sent when provided. Never stored beyond this session.
 *
 * config.mode = 'none'
 *   connect() returns null. Studio falls back to respond.js. Explicit no-op.
 *
 * CORS NOTE
 * ---------
 * Local inference servers (Ollama, LM Studio) must have CORS enabled for the page's
 * origin or use a blanket wildcard. Ollama: set OLLAMA_ORIGINS=* in the env.
 * LM Studio: toggle "Enable CORS" in the server settings panel.
 * If a CORS preflight fails, probe() returns false and the adapter degrades to grounded.
 * All failures are soft: no exception surfaces to the user.
 *
 * KEY SAFETY
 * ----------
 * Keys are never written to localStorage, sessionStorage, or IndexedDB.
 * They live only in the closure returned by connect() and are discarded when that
 * closure is garbage-collected. The page itself ships no key.
 */

// ── Internal constants ─────────────────────────────────────────────────────────

const OLLAMA_BASE    = "http://localhost:11434";
const OLLAMA_TAGS    = OLLAMA_BASE + "/api/tags";
const OLLAMA_GEN     = OLLAMA_BASE + "/api/generate";
const OLLAMA_CHAT    = OLLAMA_BASE + "/api/chat";

const LM_STUDIO_BASE = "http://localhost:1234";
const LM_STUDIO_CHAT = LM_STUDIO_BASE + "/v1/chat/completions";

const PROBE_TIMEOUT_MS  = 3000;   // probe() gives up after 3 s
const CALL_TIMEOUT_MS   = 30000;  // individual generate call; studio.js adds its own 8 s cap

// Default model names used when the user provides no config.model.
const DEFAULT_OLLAMA_MODEL     = "llama3";
const DEFAULT_LM_STUDIO_MODEL  = "local-model";

// ── Low-level helpers ──────────────────────────────────────────────────────────

/**
 * fetchWithTimeout(url, init, ms): fetch with an AbortController deadline.
 * Returns the Response or throws on network error / timeout.
 */
function fetchWithTimeout(url, init, ms) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  const req = fetch(url, { ...init, signal: ctrl.signal });
  return req.finally(() => clearTimeout(timer));
}

/**
 * perceptionToText(perception): flatten the Studio ctx object into a compact
 * plain-language paragraph the model can read. Never invents facts: it only
 * serialises what the perception object already contains.
 * perception is the ctx shape from buildCtx() in studio.js:
 *   { phash, features, dominantColors, hueName, edgeDensity, motion, audio,
 *     sourceName, width, height }
 */
function perceptionToText(perception) {
  if (!perception || !perception.phash || perception.phash === "—") {
    return "No frame loaded yet.";
  }
  const p = perception;
  const f = p.features || {};
  const parts = [
    "Current frame perception:",
    "source=" + (p.sourceName || "unknown"),
    "size=" + (p.width || 0) + "x" + (p.height || 0),
    "phash=" + p.phash,
  ];
  if (typeof f.contrast === "number") parts.push("contrast=" + f.contrast.toFixed(3));
  if (typeof f.entropy  === "number") parts.push("structure=" + f.entropy.toFixed(3));
  if (typeof f.balance  === "number") parts.push("balance=" + f.balance.toFixed(3));
  if (typeof p.edgeDensity === "number") parts.push("edgeDensity=" + p.edgeDensity.toFixed(3));
  if (typeof p.motion === "number") parts.push("motion=" + p.motion.toFixed(3));
  if (Array.isArray(p.dominantColors) && p.dominantColors.length) {
    parts.push("dominantColors=" + p.dominantColors.join(","));
  }
  if (p.hueName) parts.push("hue=" + p.hueName);
  if (p.audio && typeof p.audio.level === "number") {
    parts.push("audioLevel=" + p.audio.level.toFixed(3));
    if (typeof p.audio.pitch === "number") parts.push("audioPitch=" + Math.round(p.audio.pitch) + "Hz");
  }
  return parts.join(" | ");
}

/**
 * buildOllamaPrompt(message, perception): compose the full text prompt for Ollama.
 * Ollama's /api/generate expects a single "prompt" string.
 */
function buildOllamaPrompt(message, perception) {
  const percText = perceptionToText(perception);
  return (
    "You are a grounded visual assistant embedded in a browser Studio. " +
    "You can only speak to what the perception data tells you. " +
    "Never invent measurements or claim to see things not in the data. " +
    "If the question is outside what the data supports, say so honestly.\n\n" +
    percText + "\n\n" +
    "User: " + message + "\n" +
    "Assistant:"
  );
}

/**
 * buildChatMessages(message, perception): compose the messages array for an
 * OpenAI-compatible chat completions endpoint (LM Studio, vLLM, llama.cpp, etc.).
 */
function buildChatMessages(message, perception) {
  const percText = perceptionToText(perception);
  return [
    {
      role: "system",
      content:
        "You are a grounded visual assistant embedded in a browser Studio. " +
        "Only speak to what the perception data says. " +
        "Never invent measurements. If the question is outside what the data supports, say so honestly.\n\n" +
        percText,
    },
    { role: "user", content: message },
  ];
}

/**
 * extractOllamaText(json): pull the response string from an Ollama /api/generate reply.
 * Returns null if the shape is wrong.
 */
function extractOllamaText(json) {
  if (json && typeof json.response === "string" && json.response.trim()) {
    return json.response.trim();
  }
  return null;
}

/**
 * extractChatText(json): pull the first assistant message content from an
 * OpenAI-compatible /v1/chat/completions reply.
 * Returns null if the shape is wrong.
 */
function extractChatText(json) {
  try {
    const text = json.choices[0].message.content;
    if (typeof text === "string" && text.trim()) return text.trim();
  } catch (_) {}
  return null;
}

/**
 * extractPlainText(json): pull text from a plain { text } or { response } envelope.
 * Used for mode='endpoint' with chatContract=false.
 */
function extractPlainText(json) {
  if (json && typeof json.text === "string" && json.text.trim()) return json.text.trim();
  if (json && typeof json.response === "string" && json.response.trim()) return json.response.trim();
  return null;
}

// ── ModelAdapter public API ────────────────────────────────────────────────────

export const ModelAdapter = {

  /**
   * probe(config) -> Promise<boolean>
   * Returns true if the endpoint described by config is reachable and responds
   * with a plausible HTTP status. Never throws: all failures return false.
   *
   * For 'local-ollama': HEAD /api/tags (light, no model needed).
   * For 'local-openai': HEAD or OPTIONS on the chat endpoint (some servers reject HEAD;
   *   we fall through to a GET on the base URL if HEAD 405s).
   * For 'endpoint': HEAD on config.url.
   * For 'none': always false (nothing to probe).
   */
  async probe(config) {
    if (!config || config.mode === "none") return false;
    try {
      if (config.mode === "local-ollama") {
        const r = await fetchWithTimeout(OLLAMA_TAGS, { method: "GET" }, PROBE_TIMEOUT_MS);
        return r.ok || r.status === 200;
      }

      if (config.mode === "local-openai") {
        const base = (config.url ? config.url.replace(/\/v1\/.*$/, "") : LM_STUDIO_BASE);
        // GET the base URL; most OpenAI-compat servers return 200 or 404 (still reachable).
        const r = await fetchWithTimeout(base, { method: "GET" }, PROBE_TIMEOUT_MS);
        return r.status < 500;
      }

      if (config.mode === "endpoint") {
        if (!config.url) return false;
        const headers = {};
        if (config.key) headers["Authorization"] = "Bearer " + config.key;
        const r = await fetchWithTimeout(config.url, { method: "HEAD", headers }, PROBE_TIMEOUT_MS);
        // 405 (Method Not Allowed) on HEAD means the server is up but doesn't support HEAD.
        return r.status < 500;
      }
    } catch (_) {
      // Network error, CORS block, or timeout: server not reachable.
      return false;
    }
    return false;
  },

  /**
   * connect(config) -> async fn(prompt, perception) -> string  |  null
   *
   * Returns a callable that the Studio plugs into connectModel(fn).
   * The fn signature is fn(message, perception) -> Promise<string>.
   * studio.js calls _connectedModelFn(v, ctx, hist); the adapter ignores history
   * (history enrichment is handled by the Studio's own ring buffer / respond.js).
   *
   * Returns null when:
   *   - config.mode is 'none'
   *   - config is missing or malformed
   * The caller must fall back to respond.js when null is returned.
   *
   * The returned fn itself throws or rejects on a failed call so studio.js's
   * existing catch-and-fallback path handles it correctly.
   */
  connect(config) {
    if (!config || config.mode === "none") return null;

    if (config.mode === "local-ollama") {
      const model = config.model || DEFAULT_OLLAMA_MODEL;
      return async function ollamaFn(message, perception) {
        // Prefer /api/chat (structured) if the server is new enough; fall back to /api/generate.
        const messages = buildChatMessages(message, perception);
        let json;

        // Try chat endpoint first (Ollama 0.1.14+).
        try {
          const body = JSON.stringify({ model, messages, stream: false });
          const r = await fetchWithTimeout(
            OLLAMA_CHAT,
            { method: "POST", headers: { "Content-Type": "application/json" }, body },
            CALL_TIMEOUT_MS
          );
          if (r.ok) {
            json = await r.json();
            const text = extractChatText(json);
            if (text) return text;
          }
        } catch (_) { /* fall through to /api/generate */ }

        // Fallback: /api/generate (all Ollama versions).
        const prompt = buildOllamaPrompt(message, perception);
        const body2 = JSON.stringify({ model, prompt, stream: false });
        const r2 = await fetchWithTimeout(
          OLLAMA_GEN,
          { method: "POST", headers: { "Content-Type": "application/json" }, body: body2 },
          CALL_TIMEOUT_MS
        );
        if (!r2.ok) throw new Error("Ollama generate failed: " + r2.status);
        const json2 = await r2.json();
        const text2 = extractOllamaText(json2);
        if (!text2) throw new Error("Ollama returned an unreadable response shape");
        return text2;
      };
    }

    if (config.mode === "local-openai") {
      const model = config.model || DEFAULT_LM_STUDIO_MODEL;
      const chatUrl = config.url || LM_STUDIO_CHAT;
      return async function localOpenAIFn(message, perception) {
        const messages = buildChatMessages(message, perception);
        const body = JSON.stringify({ model, messages, stream: false });
        const r = await fetchWithTimeout(
          chatUrl,
          { method: "POST", headers: { "Content-Type": "application/json" }, body },
          CALL_TIMEOUT_MS
        );
        if (!r.ok) throw new Error("Local OpenAI server failed: " + r.status);
        const json = await r.json();
        const text = extractChatText(json);
        if (!text) throw new Error("Local OpenAI server returned an unreadable response shape");
        return text;
      };
    }

    if (config.mode === "endpoint") {
      if (!config.url) return null;
      const key = config.key || null;                         // held in closure, never persisted
      const useChatContract = config.chatContract !== false;  // default true
      const model = config.model || DEFAULT_LM_STUDIO_MODEL;
      return async function endpointFn(message, perception) {
        const headers = { "Content-Type": "application/json" };
        if (key) headers["Authorization"] = "Bearer " + key;
        let body;
        if (useChatContract) {
          const messages = buildChatMessages(message, perception);
          body = JSON.stringify({ model, messages, stream: false });
        } else {
          const prompt = buildOllamaPrompt(message, perception);
          body = JSON.stringify({ prompt });
        }
        const r = await fetchWithTimeout(
          config.url,
          { method: "POST", headers, body },
          CALL_TIMEOUT_MS
        );
        if (!r.ok) throw new Error("Endpoint failed: " + r.status);
        const json = await r.json();
        const text = useChatContract ? extractChatText(json) : extractPlainText(json);
        if (!text) throw new Error("Endpoint returned an unreadable response shape");
        return text;
      };
    }

    return null;
  },

  /**
   * autodetect() -> Promise<config | null>
   *
   * Tries common local inference server endpoints in priority order with no key.
   * Returns the first config that probe() confirms is alive, or null when none respond.
   * Called once at page load; the Studio should not re-call on every message.
   *
   * Order:
   *   1. Ollama on localhost:11434 (most common local setup)
   *   2. LM Studio on localhost:1234 (next most common)
   *
   * Both are attempted in parallel for faster detection; the order of the results
   * array determines which wins when both happen to be live (Ollama preferred).
   *
   * When a server is up but has no models loaded, probe() still returns true.
   * connect() will then fail on the first real call and studio.js will fall back
   * to respond.js via its existing catch block. This is the correct behavior:
   * we do not want autodetect() to load a model or send prompt tokens.
   */
  async autodetect() {
    const candidates = [
      { mode: "local-ollama" },
      { mode: "local-openai" },
    ];

    // Probe in parallel. First confirmed winner (by array order) wins.
    const results = await Promise.all(
      candidates.map(cfg => this.probe(cfg).then(ok => ok ? cfg : null).catch(() => null))
    );
    for (const r of results) {
      if (r) return r;
    }
    return null;
  },

};

// ── Selftest ──────────────────────────────────────────────────────────────────
// Validates request-shaping and response-parsing logic on synthetic data.
// No real network calls. Safe to run in any browser console via:
//   import { _selftest } from "./system/model-adapter.js"; _selftest();
//
// Returns { passed: number, failed: number, errors: string[] }.

export function _selftest() {
  const errors = [];
  let passed = 0;
  let failed = 0;

  function assert(label, cond) {
    if (cond) {
      passed++;
    } else {
      failed++;
      errors.push("FAIL: " + label);
    }
  }

  // ── perceptionToText ────────────────────────────────────────────────────────
  const noFrame = perceptionToText(null);
  assert("perceptionToText(null) returns a string", typeof noFrame === "string");
  assert("perceptionToText(null) does not claim to see anything", noFrame.toLowerCase().includes("no frame") || noFrame.toLowerCase().includes("nothing"));

  const fakeCtx = {
    phash: "aabbccdd11223344",
    features: { contrast: 0.72, entropy: 0.55, balance: 0.48 },
    dominantColors: ["#1a2b3c", "#ffee00"],
    hueName: "teal",
    edgeDensity: 0.18,
    motion: 0.03,
    audio: { level: 0.14, pitch: 440 },
    sourceName: "2D fractal",
    width: 800,
    height: 800,
  };
  const percText = perceptionToText(fakeCtx);
  assert("perceptionToText includes phash",    percText.includes("aabbccdd11223344"));
  assert("perceptionToText includes source",   percText.includes("2D fractal"));
  assert("perceptionToText includes size",     percText.includes("800x800"));
  assert("perceptionToText includes contrast", percText.includes("contrast="));
  assert("perceptionToText includes hue",      percText.includes("teal"));
  assert("perceptionToText includes pitch",    percText.includes("440Hz"));

  // ── buildOllamaPrompt ───────────────────────────────────────────────────────
  const ollamaPrompt = buildOllamaPrompt("what do you see", fakeCtx);
  assert("buildOllamaPrompt is a string",                  typeof ollamaPrompt === "string");
  assert("buildOllamaPrompt includes user message",        ollamaPrompt.includes("what do you see"));
  assert("buildOllamaPrompt includes perception",          ollamaPrompt.includes("aabbccdd11223344"));
  assert("buildOllamaPrompt ends with Assistant:",         ollamaPrompt.trim().endsWith("Assistant:"));
  assert("buildOllamaPrompt has no em-dash character",     !ollamaPrompt.includes("—"));

  // ── buildChatMessages ───────────────────────────────────────────────────────
  const msgs = buildChatMessages("describe the colours", fakeCtx);
  assert("buildChatMessages returns array of length 2",    Array.isArray(msgs) && msgs.length === 2);
  assert("first message is system role",                   msgs[0].role === "system");
  assert("second message is user role",                    msgs[1].role === "user");
  assert("system message includes perception",             msgs[0].content.includes("aabbccdd11223344"));
  assert("user message matches input",                     msgs[1].content === "describe the colours");
  assert("buildChatMessages has no em-dash in system",     !msgs[0].content.includes("—"));

  // ── extractOllamaText ───────────────────────────────────────────────────────
  assert("extractOllamaText pulls response field",
    extractOllamaText({ response: "  It looks teal.  " }) === "It looks teal.");
  assert("extractOllamaText returns null on missing response",
    extractOllamaText({ done: true }) === null);
  assert("extractOllamaText returns null on empty response",
    extractOllamaText({ response: "   " }) === null);
  assert("extractOllamaText returns null on null input",
    extractOllamaText(null) === null);

  // ── extractChatText ─────────────────────────────────────────────────────────
  const goodChat = { choices: [{ message: { role: "assistant", content: "  Hello.  " } }] };
  assert("extractChatText pulls first choice content",
    extractChatText(goodChat) === "Hello.");
  assert("extractChatText returns null on empty choices",
    extractChatText({ choices: [] }) === null);
  assert("extractChatText returns null on null",
    extractChatText(null) === null);
  assert("extractChatText returns null on malformed",
    extractChatText({ choices: [{ message: {} }] }) === null);

  // ── extractPlainText ────────────────────────────────────────────────────────
  assert("extractPlainText pulls text field",
    extractPlainText({ text: " answer " }) === "answer");
  assert("extractPlainText falls back to response field",
    extractPlainText({ response: " alt " }) === "alt");
  assert("extractPlainText returns null on neither",
    extractPlainText({ result: "x" }) === null);

  // ── connect() mode=none returns null ────────────────────────────────────────
  assert("connect({mode:'none'}) is null",
    ModelAdapter.connect({ mode: "none" }) === null);
  assert("connect(null) is null",
    ModelAdapter.connect(null) === null);
  assert("connect({mode:'endpoint', url:null}) is null",
    ModelAdapter.connect({ mode: "endpoint", url: null }) === null);

  // ── connect() returns functions for valid modes ──────────────────────────────
  assert("connect({mode:'local-ollama'}) returns a function",
    typeof ModelAdapter.connect({ mode: "local-ollama" }) === "function");
  assert("connect({mode:'local-openai'}) returns a function",
    typeof ModelAdapter.connect({ mode: "local-openai" }) === "function");
  assert("connect({mode:'endpoint', url:'http://x'}) returns a function",
    typeof ModelAdapter.connect({ mode: "endpoint", url: "http://x" }) === "function");

  // ── Simulated fetch: async network path tests ────────────────────────────────
  // Each simulated call runs sequentially (await between stubs) so fetch stubs do
  // not overwrite each other before the previous call resolves.
  const savedFetch = globalThis.fetch;
  const savedAbortController = globalThis.AbortController;

  // Stub AbortController so fetchWithTimeout runs without a real browser environment.
  // signal=null is spread into fetch init; our stub ignores the signal field.
  globalThis.AbortController = class {
    constructor() { this.signal = null; }
    abort() {}
  };

  const asyncAssert = (async () => {
    // ── Ollama generate fallback path ─────────────────────────────────────────
    // Stub /api/chat as 404 (old Ollama) so the code falls through to /api/generate.
    let chatAttempts = 0;
    globalThis.fetch = async (url) => {
      if (url === OLLAMA_CHAT) {
        chatAttempts++;
        return { ok: false, status: 404, json: async () => ({}) };
      }
      if (url === OLLAMA_GEN) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ response: "I see a teal fractal.", done: true }),
        };
      }
      throw new Error("unexpected url in ollama stub: " + url);
    };

    const ollamaFn = ModelAdapter.connect({ mode: "local-ollama", model: "llama3" });
    let ollamaResult = null;
    let ollamaError = null;
    try {
      ollamaResult = await ollamaFn("what do you see", fakeCtx);
    } catch (e) {
      ollamaError = e;
    }

    assert("Ollama fn called /api/chat first then /api/generate",  chatAttempts >= 1);
    assert("Ollama fn resolved to expected string",                 ollamaResult === "I see a teal fractal.");
    assert("Ollama fn did not error",                               ollamaError === null);

    // ── Local OpenAI-compat path ──────────────────────────────────────────────
    globalThis.fetch = async (url) => {
      if (url === LM_STUDIO_CHAT || url.includes("/v1/chat/completions")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            choices: [{ message: { role: "assistant", content: "Teal, high contrast." } }],
          }),
        };
      }
      throw new Error("unexpected url in openai stub: " + url);
    };

    const openAIFn = ModelAdapter.connect({ mode: "local-openai" });
    let openAIResult = null;
    let openAIError = null;
    try {
      openAIResult = await openAIFn("describe the frame", fakeCtx);
    } catch (e) {
      openAIError = e;
    }

    assert("OpenAI fn resolved to expected string",  openAIResult === "Teal, high contrast.");
    assert("OpenAI fn did not error",                openAIError === null);

    // ── Plain endpoint path ───────────────────────────────────────────────────
    globalThis.fetch = async () => ({
      ok: true,
      status: 200,
      json: async () => ({ text: "plain answer" }),
    });

    const plainFn = ModelAdapter.connect({ mode: "endpoint", url: "http://x.test/go", chatContract: false });
    let plainResult = null;
    try {
      plainResult = await plainFn("anything", fakeCtx);
    } catch (_) {}

    assert("Plain endpoint fn resolved to expected string", plainResult === "plain answer");

    // Restore globals.
    globalThis.fetch = savedFetch;
    globalThis.AbortController = savedAbortController;

    const summary = { passed, failed, errors };
    if (failed === 0) {
      console.log("[model-adapter _selftest] All " + passed + " checks passed.");
    } else {
      console.warn("[model-adapter _selftest] " + failed + " check(s) failed:");
      errors.forEach(e => console.warn("  " + e));
    }
    return summary;
  })();

  // Return the promise so callers can await it.
  return asyncAssert;
}
