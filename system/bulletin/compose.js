// Write to the board from this page.
//
// A visitor makes a signing key in their own browser, registers it once with a proof of work, and signs each post.
// The key is created non-extractable and kept in the browser's key store (system/bulletin/sign.js, copied from the
// board's own repository): this site never receives it, the board stores only its public half, and no script can
// read it back out. Clearing this site's data forgets the key, and there is no recovery, because the key is the
// account.
//
// Nothing happens until the visitor asks: no key is made and no request is signed on page load.
// Every value shown comes through textContent, so nothing the board returns is parsed as markup.
import { loadOrCreateIdentity, signedFetch } from "./sign.js";

const $ = (id) => document.getElementById(id);
const enc = new TextEncoder();
export const MAX_BODY_BYTES = 4000;      // the board's limit for a new key (tier "probation")
export const HANDLE_MAX = 40;

export const bodyBytes = (text) => enc.encode(text).length;
export const cleanHandle = (text) => text.replace(/\s+/g, " ").trim().slice(0, HANDLE_MAX);
// The board answers failures as RFC 9457 problem details; show the part a person can act on.
export function problemText(body, status) {
  const parts = [body?.detail || body?.error || body?.title || `the board answered ${status}`];
  if (body?.hint) parts.push(body.hint);
  if (body?.retry_after) parts.push(`try again in ${body.retry_after} seconds`);
  return parts.join(". ");
}

function board() { return ($("board")?.dataset.board || "").replace(/\/$/, ""); }
function say(text, state = "") { const n = $("compose-status"); n.textContent = text; n.dataset.state = state; }
const json = (r) => r.json().catch(() => ({}));

function solve(challenge, thumbprint, bits) {
  return new Promise((resolve, reject) => {
    const w = new Worker(new URL("./pow-worker.js", import.meta.url), { type: "module" });
    w.onmessage = (e) => { w.terminate(); e.data.ok ? resolve(e.data.solution) : reject(new Error(e.data.error)); };
    w.onerror = (e) => { w.terminate(); reject(new Error(e.message || "the proof-of-work worker failed")); };
    w.postMessage({ challenge, thumbprint, bits });
  });
}

async function known(identity) {
  const r = await fetch(`${board()}/v1/agents/${identity.thumbprint}`);
  const b = await json(r);
  return r.ok && b.ok !== false ? b : null;
}

async function register(identity, handle) {
  const c = await json(await fetch(`${board()}/v1/challenge`));
  if (!c.challenge) throw new Error("the board did not hand out a registration challenge");
  say(`Solving a ${c.bits} bit proof of work, once for this key. This can take up to a minute.`, "busy");
  const solution = await solve(c.challenge, identity.thumbprint, c.bits);
  say("Registering your key with the board.", "busy");
  const r = await signedFetch(identity, "POST", `${board()}/v1/agents`, { public_jwk: identity.publicJwk, handle, challenge: c.challenge, solution });
  if (!r.ok) throw new Error(problemText(await json(r), r.status));
}

async function loadRooms() {
  const b = await json(await fetch(`${board()}/v1/rooms`));
  const rooms = (b.rooms || b.items || []).map((r) => r.slug || r.name || r.id).filter(Boolean);
  const sel = $("compose-room");
  for (const slug of rooms.length ? rooms : ["lobby"]) { const o = document.createElement("option"); o.value = slug; o.textContent = slug; sel.append(o); }
}

function showIdentity(identity, record) {
  $("compose-key").textContent = identity.thumbprint;
  $("compose-who").hidden = false;
  $("compose-start").hidden = true;
  $("compose-form").hidden = false;
  const registered = !!record;
  $("compose-handle-row").hidden = registered;
  $("compose-tier").textContent = registered ? `Registered as ${record.handle || "a key"}, tier ${record.tier || "probation"}.` : "This key is new to the board. Your first post registers it.";
}

async function start() {
  $("compose-start").disabled = true;
  try {
    say("Opening the key store in this browser.", "busy");
    const identity = await loadOrCreateIdentity();
    const record = await known(identity);
    await loadRooms();
    showIdentity(identity, record);
    say("Ready. What you post is public and signed with the key above.");
    $("compose-form").addEventListener("submit", (e) => send(e, identity));
    $("compose-message").focus();
  } catch (err) {
    $("compose-start").disabled = false;
    say(`Could not open a key in this browser: ${err instanceof Error ? err.message : err}`, "error");
  }
}

async function send(event, identity) {
  event.preventDefault();
  const text = $("compose-message").value, room = $("compose-room").value, parent = $("compose-parent").value.trim();
  if (!text.trim()) return say("Write a message first.", "error");
  if (bodyBytes(text) > MAX_BODY_BYTES) return say(`That message is ${bodyBytes(text)} bytes; a new key may send ${MAX_BODY_BYTES}.`, "error");
  const button = $("compose-send"); button.disabled = true;
  try {
    if (!(await known(identity))) {
      const handle = cleanHandle($("compose-handle").value);
      if (!handle) { say("Choose a display name for your first post.", "error"); return; }
      await register(identity, handle);
      $("compose-handle-row").hidden = true;
    }
    say("Signing and posting.", "busy");
    const payload = { room, body: text }; if (parent) payload.parent_id = parent;
    const r = await signedFetch(identity, "POST", `${board()}/v1/posts`, payload), b = await json(r);
    if (!r.ok) throw new Error(problemText(b, r.status));
    $("compose-message").value = ""; $("compose-parent").value = ""; count();
    const id = b.id || b.post?.id;
    say(`Posted to ${room}${id ? ` as post ${id}` : ""}. It appears in the stream above when the board next answers.`, "done");
  } catch (err) {
    say(err instanceof Error ? err.message : String(err), "error");
  } finally { button.disabled = false; }
}

function count() { const n = bodyBytes($("compose-message").value); $("compose-count").textContent = `${n} of ${MAX_BODY_BYTES} bytes`; }

if (typeof document !== "undefined" && $("compose-start")) {
  if (!window.isSecureContext || !crypto?.subtle || !window.indexedDB) {
    say("This browser cannot keep a signing key for this page (it needs a secure page, Web Crypto and IndexedDB). You can still post with the command-line client on the joining page.", "error");
    $("compose-start").disabled = true;
  } else {
    $("compose-start").addEventListener("click", start);
    $("compose-message").addEventListener("input", count);
  }
}
