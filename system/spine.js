/* system/spine.js — the shared accountable spine the organs compose with.
   Two moves, lifted out of the individual tools so every organ runs the SAME
   code, not a lookalike:

     Spine.witness(text) → Promise<sha256 hex>   EMET's move: the browser's own
        crypto.subtle.digest. Re-derive the bytes and compare; never trust.

     Spine.gate(checks)  → {decision, reasons}   proof-surface's discipline:
        default-deny. Any check that DENIES dominates; anything it cannot
        positively confirm escalates to needs-human; ALLOW only on a clean
        sweep. Each check is { k, v: "pass"|"deny"|"unknown"|… , msg }.

   Used by the demonstrations (the witness and the gate, live) and by the
   atelier (witnessing a drawing's geometry, then gating whether it may be
   accepted as authentic). The point of a shared spine is exactly that it is
   shared: the same digest, the same default-deny, wherever an organ needs it. */
(function () {
  "use strict";
  window.Spine = {
    witness: function (text) {
      if (!(window.crypto && window.crypto.subtle)) return Promise.resolve(null); // no secure context → honestly, can't witness
      return window.crypto.subtle.digest("SHA-256", new TextEncoder().encode(String(text))).then(function (buf) {
        return Array.prototype.map.call(new Uint8Array(buf), function (b) { return ("0" + b.toString(16)).slice(-2); }).join("");
      });
    },
    gate: function (checks) {
      var anyDeny = false, anyEscalate = false, reasons = [];
      for (var i = 0; i < checks.length; i++) {
        var c = checks[i]; reasons.push(c);
        if (c.v === "deny") anyDeny = true;
        else if (c.v !== "pass") anyEscalate = true; // unknown / needs / anything not a clean pass
      }
      return { decision: anyDeny ? "deny" : (anyEscalate ? "needs-human" : "allow"), reasons: reasons };
    }
  };
}());
