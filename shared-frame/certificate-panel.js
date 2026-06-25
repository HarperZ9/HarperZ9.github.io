// certificate-panel.js: the witnessed certificate, rendered as a one-click verdict-diff.
//
// This is the user-visible half of the #1 user pain ("I cannot trust output without a re-checkable
// proof trail"). The verification core (certificate.js) already exists; this surfaces it. Per the spec
// HCI rule, the verify action must be cheaper than ignoring it: the certificate renders as a structured
// DIFF (the named criterion, the verdict as a clear state chip, the re-checkable evidence) ABOVE the
// model's prose; accept / reject / dispute is ONE control each; UNVERIFIABLE and DISPUTED are the most
// visually distinct states (never a quiet gray that reads like a pass); and a recheck control reproduces
// the verdict live from the certificate's own evidence. Cites: PaperTrail (CHI 26) 2602.21045.
//
// It renders EXACTLY what certificate.js produced. It never fakes a verdict or fabricates evidence. It
// is additive: the existing verdict.js / showcase flow is untouched; this is a richer renderer wired in
// where a full certificate.js certificate is available. Zero external dependencies; DOM is built from
// nodes (textContent only), never string-interpolated, so certificate content can never inject markup.
import { recheckCertificate2 } from "./certificate.js";

// The five verdict states, with a plain-language gloss the viewer needs no documentation to read.
// UNVERIFIABLE and DISPUTED are flagged loud so the UI can make them the most distinct (not a pass-gray).
export const VERDICT_META = Object.freeze({
  verified:     { label: "verified",     gloss: "the named criterion held, by a deterministic check" },
  refuted:      { label: "refuted",      gloss: "the named criterion did not hold" },
  unverifiable: { label: "unverifiable", gloss: "could not be measured against a named criterion", loud: true },
  superseded:   { label: "superseded",   gloss: "was true, now replaced by a newer certificate" },
  disputed:     { label: "disputed",     gloss: "the deterministic oracle and the model disagree", loud: true },
});

// The three operator actions, each a single control. Stamping one appends to the audit trail.
export const ACTIONS = Object.freeze([
  { key: "accepted", label: "Accept", title: "Accept this verdict and stamp it to the audit trail" },
  { key: "rejected", label: "Reject", title: "Reject this verdict and stamp it to the audit trail" },
  { key: "disputed", label: "Dispute", title: "Dispute this verdict and stamp it to the audit trail" },
]);

const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = String(text);
  return n;
};

function metaFor(verdict) {
  return VERDICT_META[verdict] || { label: String(verdict || "unverifiable"), gloss: "", loud: true };
}

// Build the verdict state chip: the verdict word, plus a data-attribute the CSS keys off for the
// per-state colour/shape. Shape + text always carry the state, never colour alone (accessibility).
function verdictChip(verdict) {
  const meta = metaFor(verdict);
  const chip = el("span", "cert-chip", meta.label);
  chip.dataset.verdict = verdict || "unverifiable";
  if (meta.loud) chip.dataset.loud = "true";
  chip.setAttribute("role", "status");
  return chip;
}

// Render the re-checkable evidence as labelled key/value rows: the viewer re-derives the verdict from
// these. Rendered verbatim from cert.evidence (the [k, v] wire shape certificate.js emits).
function evidenceList(cert) {
  const wrap = el("div", "cert-evidence");
  const rows = Array.isArray(cert.evidence) ? cert.evidence : [];
  for (const pair of rows) {
    if (!Array.isArray(pair) || pair.length !== 2) continue;
    const row = el("div", "cert-ev");
    row.appendChild(el("span", "cert-ek", pair[0]));
    row.appendChild(el("span", "cert-ev-v", pair[1]));
    wrap.appendChild(row);
  }
  return wrap;
}

// Render the live recheck result: recheckCertificate2 re-derives the verdict from the certificate's own
// evidence; matches:true is the proof reproducing itself, so the viewer does not have to trust the baked
// verdict. Distinct ok/bad styling; the re-derived verdict is shown next to the carried one.
function renderRecheck(outEl, cert) {
  const r = recheckCertificate2(cert);
  outEl.textContent = "";
  outEl.hidden = false;
  const line = el("div", "cert-rc-line");
  line.appendChild(el("span", "cert-rc-k", "re-derived in your browser"));
  const derived = el("span", "cert-chip cert-chip-sm", metaFor(r.verdict).label);
  derived.dataset.verdict = r.verdict || "unverifiable";
  line.appendChild(derived);
  outEl.appendChild(line);
  const verdictOut = el(
    "div",
    "cert-rc-match " + (r.matches ? "ok" : "bad"),
    r.matches
      ? "reproduces the certificate, so you did not have to trust it"
      : "does not reproduce the certificate"
  );
  outEl.appendChild(verdictOut);
  return r;
}

// renderCertificate(container, cert, opts): paint the verdict-diff into `container`. Returns a small
// controller { setStamp } so the host can reflect a stamped operator action without a re-render.
//
// opts:
//   onAction(actionKey, cert)  called when the operator clicks accept/reject/dispute (host appends to
//                              the audit log + stamps); single click, no form.
//   announce(msg)              optional live-region announcer (accessibility / status line).
export function renderCertificate(container, cert, { onAction, announce } = {}) {
  if (!container) return null;
  container.textContent = "";
  if (!cert) {
    container.appendChild(el("p", "cert-empty", "No certificate yet. Generate or judge a frame to issue one."));
    return null;
  }
  const meta = metaFor(cert.verdict);

  // ── the verdict-diff header: criterion + state chip, the decision, before any prose ──
  const head = el("div", "cert-head");
  const crit = el("div", "cert-criterion");
  crit.appendChild(el("span", "cert-crit-k", "criterion"));
  crit.appendChild(el("span", "cert-crit-v", cert.criterion || "none named"));
  head.appendChild(crit);
  head.appendChild(verdictChip(cert.verdict));
  container.appendChild(head);

  // the plain-language gloss: UNVERIFIABLE / DISPUTED need no interpretation.
  const gloss = el("p", "cert-gloss", meta.gloss);
  gloss.dataset.verdict = cert.verdict || "unverifiable";
  container.appendChild(gloss);

  // a compact fact line: oracle tier + whether a deterministic oracle drove it (certified).
  const facts = el("div", "cert-facts");
  const oracleFact = el("span", "cert-fact");
  oracleFact.appendChild(el("span", "cert-fact-k", "oracle"));
  oracleFact.appendChild(el("span", "cert-fact-v", (cert.tier && cert.tier !== "none" ? cert.tier + " / " : "") + (cert.oracle || "none")));
  facts.appendChild(oracleFact);
  const certFact = el("span", "cert-fact");
  certFact.appendChild(el("span", "cert-fact-k", "certified"));
  certFact.appendChild(el("span", "cert-fact-v", cert.certified ? "yes (deterministic)" : "no (advisory only)"));
  facts.appendChild(certFact);
  container.appendChild(facts);

  // ── the re-checkable evidence: re-derive the verdict from these numbers ──
  container.appendChild(el("div", "cert-ev-label", "re-checkable evidence"));
  container.appendChild(evidenceList(cert));

  // ── one-click operator actions: accept / reject / dispute (each a single control) ──
  const actions = el("div", "cert-actions");
  actions.setAttribute("role", "group");
  actions.setAttribute("aria-label", "Operator decision on this certificate");
  const stampOut = el("div", "cert-stamp");
  stampOut.hidden = true;
  for (const a of ACTIONS) {
    const btn = el("button", "cert-act", a.label);
    btn.type = "button";
    btn.dataset.action = a.key;
    btn.title = a.title;
    btn.addEventListener("click", () => {
      if (typeof onAction === "function") onAction(a.key, cert);
      reflectStamp(stampOut, a.key);
      if (typeof announce === "function") announce("Certificate " + a.key + " and stamped to the audit trail.");
    });
    actions.appendChild(btn);
  }
  container.appendChild(actions);
  container.appendChild(stampOut);

  // ── recheck affordance: reproduce the verdict live from the evidence ──
  const recheckRow = el("div", "cert-recheck");
  const recheckBtn = el("button", "cert-recheck-btn", "Re-derive this verdict");
  recheckBtn.type = "button";
  recheckBtn.title = "Re-run the check on this certificate's own evidence, here in your browser";
  const recheckOut = el("div", "cert-rc-out");
  recheckOut.hidden = true;
  recheckBtn.addEventListener("click", () => {
    const r = renderRecheck(recheckOut, cert);
    if (typeof announce === "function") {
      announce("Re-derived: " + (r.verdict || "unverifiable") + ", " + (r.matches ? "reproduces the certificate" : "does not reproduce") + ".");
    }
  });
  recheckRow.appendChild(recheckBtn);
  container.appendChild(recheckRow);
  container.appendChild(recheckOut);

  return { setStamp: key => reflectStamp(stampOut, key) };
}

// Show the operator's stamped decision under the action row. Idempotent; safe to call repeatedly.
function reflectStamp(stampOut, key) {
  if (!stampOut) return;
  stampOut.textContent = "";
  stampOut.hidden = false;
  stampOut.appendChild(el("span", "cert-stamp-k", "operator"));
  stampOut.appendChild(el("span", "cert-stamp-v cert-stamp-" + key, key));
}
