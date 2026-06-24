# Task 8m-seed — Studio Model-Connect: Local & Shared-Endpoint Enhancement

## Status: COMPLETE

## Changes

### system/studio-model.js (new)
Pure, zero-dep, node-testable header builder extracted from studio.js.
- `buildModelHeaders(key)` — returns `{ "Content-Type": "application/json" }` always;
  adds `Authorization: Bearer <key>` only when key is non-empty.
- Imported by studio.js; tested by system/studio-model.test.mjs.

### system/studio.js
1. **Import** `buildModelHeaders` from `./studio-model.js`.
2. **`DEFAULT_MODEL` constant** added near top of connect panel section (ships empty;
   operator fills `endpoint` to enable the shared-endpoint auto-connect).
3. **Key now optional** in the connect handler — removed the `if (!key) return` gate;
   keyless connects are accepted and show status
   `"Connected (no key — local endpoint) — free-text questions route to your local model."`.
4. **`makeModelFn`** — now delegates headers to `buildModelHeaders(key)`, which omits
   `Authorization` for empty/null/undefined keys.
5. **`tryDefaultModel()`** — guarded async IIFE on load: if `DEFAULT_MODEL.endpoint` is
   non-empty, does a 6-second-timeout probe fetch; on success wires `connectModel` and
   posts a one-line disclosure note in chat; on failure stays silent on the grounded
   responder. Ships inert (empty DEFAULT_MODEL).

### studio.html
- Added `.mc-hint` paragraph under the endpoint field listing:
  - Ollama: `http://localhost:11434/v1/chat/completions`
  - LM Studio: `http://localhost:1234/v1/chat/completions`
  - "self-host a model and connect it — your frames stay between your browser and that endpoint."
- API key label updated: "(optional — local models need none)"
- Key placeholder updated: "sk-… (leave blank for local endpoints)"

### system/studio-model.test.mjs (new)
7 node tests for `buildModelHeaders`:
- Empty key → no Authorization header
- null / undefined key → no Authorization header
- Non-empty key → `Bearer <key>` header present
- Two calls don't mutate each other
- Returns plain object (not `Headers` instance)
- Always includes `Content-Type: application/json`

## Test Results
- **Before:** 70/70 pass
- **After:** 77/77 pass (+7 new)

## Browser Verification (Playwright)
- Advanced panel opens and shows both local hints (Ollama + LM Studio URLs)
- Key label shows "(optional — local models need none)"
- Set endpoint to `http://localhost:9999/v1/chat/completions`, left key blank, clicked Connect:
  - Status: `"Connected (no key — local endpoint) — free-text questions route to your local model."`
  - Connect button disabled, Disconnect enabled — no "Enter your API key." block
- Sent free-text message "what colours do you see?":
  - Fetch to port 9999 failed; grounded responder answered ("Nothing loaded yet…")
  - No unhandled errors; page did not crash
- Clicked Disconnect:
  - Status: `"Disconnected. Using grounded responder."`
  - Connect re-enabled, Disconnect disabled

## Constraints Verified
- `DEFAULT_MODEL` ships `{ endpoint: "", key: "", model: "" }` — no key committed
- `.textContent` used for all model replies (untrusted content)
- Zero external dependencies (browser `fetch` only)
- Branch: `feat/site-restructure` — no branch switch
