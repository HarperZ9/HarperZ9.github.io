import { useEffect, useRef, useState } from "react";

/* Live, client-side demonstration of EMET's byte witness.
   Re-derives a digest from the bytes in your browser (SubtleCrypto,
   no server, no account), issues a receipt, and reports the only
   three verdicts it can express: MATCH, DRIFT, UNVERIFIABLE.
   It never says "trusted". Change the text and watch it re-check. */

type Verdict = "MATCH" | "DRIFT" | "UNVERIFIABLE";

async function sha256Hex(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

const SEED = "The witness re-derives the bytes. It does not trust them.";

export default function EmetWitness() {
  const [text, setText] = useState(SEED);
  const [digest, setDigest] = useState("");
  const [receipt, setReceipt] = useState<{ digest: string; bytes: number } | null>(null);
  const supported = typeof crypto !== "undefined" && !!crypto.subtle;
  const liveRef = useRef<HTMLParagraphElement | null>(null);

  useEffect(() => {
    let alive = true;
    if (!supported) return;
    sha256Hex(text).then((h) => { if (alive) setDigest(h); });
    return () => { alive = false; };
  }, [text, supported]);

  let verdict: Verdict = "UNVERIFIABLE";
  let reason = "No receipt issued yet. Issue one, then change the subject to see the witness re-check.";
  if (!supported) {
    reason = "This browser exposes no SubtleCrypto, so the digest cannot be re-derived here. UNVERIFIABLE, by construction, is the honest answer, not a pass.";
  } else if (receipt && digest) {
    if (digest === receipt.digest) { verdict = "MATCH"; reason = "The bytes re-derive to the digest on the receipt. The witness alters nothing and grants nothing; it only says the bytes are what the receipt witnessed."; }
    else { verdict = "DRIFT"; reason = "The re-derived digest disagrees with the receipt. Something changed since it was issued. The witness reports the fact; it does not decide whether the change is acceptable."; }
  }

  const vClass = "verdict verdict-" + verdict.toLowerCase();

  return (
    <div className="emet" aria-label="EMET byte-witness, live">
      <div className="emet-head">
        <span className="emet-tag mono">emet · witness · runs in your browser</span>
        <span className={vClass} role="status">{verdict}</span>
      </div>

      <label className="emet-label" htmlFor="emet-subject">Subject bytes</label>
      <textarea
        id="emet-subject"
        className="emet-input mono"
        value={text}
        spellCheck={false}
        rows={3}
        onChange={(e) => setText(e.target.value)}
        aria-describedby="emet-reason"
      />

      <div className="emet-row">
        <div className="emet-field">
          <span className="emet-field-label mono">re-derived SHA-256 · {new TextEncoder().encode(text).length} bytes</span>
          <code className="emet-digest mono">{supported ? (digest || "…") : "unavailable"}</code>
        </div>
        <button className="emet-btn" onClick={() => setReceipt(digest ? { digest, bytes: new TextEncoder().encode(text).length } : null)} disabled={!supported || !digest}>
          Issue witness receipt
        </button>
      </div>

      {receipt && (
        <div className="emet-field emet-receipt">
          <span className="emet-field-label mono">receipt digest (what MATCH is checked against)</span>
          <code className="emet-digest mono">{receipt.digest}</code>
        </div>
      )}

      <p id="emet-reason" ref={liveRef} className="emet-reason">{reason}</p>

      <p className="emet-foot mono">
        Only three verdicts exist. There is no <span className="emet-strike">TRUSTED</span>, no{" "}
        <span className="emet-strike">APPROVED</span>, no <span className="emet-strike">SAFE</span>. By construction.{" "}
        Re-run it anywhere: <a href="https://github.com/HarperZ9/emet" rel="noopener">github.com/HarperZ9/emet</a>.
      </p>
    </div>
  );
}
