// studio-model.js: pure, zero-dep, node-testable model-connection helpers.
// Consumed by studio.js; extracted so header logic can be tested without a DOM.

// buildModelHeaders(key): returns the fetch headers object for an OpenAI-compatible endpoint.
// Authorization is only added when a non-empty key is provided; local servers (Ollama, LM Studio)
// either ignore or reject auth headers, so we omit it when keyless.
export function buildModelHeaders(key) {
  const h = { "Content-Type": "application/json" };
  if (key) h["Authorization"] = "Bearer " + key;
  return h;
}
