import { useEffect, useState } from "react";

/* Live, client-side demonstration of a Proof Packet: a verdict
   DERIVED from checks over the packet's own materials, never read
   from the packet. Tamper with an artifact -> DRIFT. Remove its
   body -> UNVERIFIABLE by path. Claim MATCH -> the derived verdict
   still wins. A self-asserted pass cannot win. */

type Verdict = "MATCH" | "DRIFT" | "UNVERIFIABLE";

async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

type Row = { name: string; body: string; sealed: string | null };

const INITIAL: Row[] = [
  { name: "result.json", body: '{"answer": 42, "unit": "checked"}', sealed: null },
  { name: "run.log", body: "step 1 ok\nstep 2 ok\nexit 0", sealed: null },
];

function fold(vs: Verdict[]): Verdict {
  if (vs.some((v) => v === "DRIFT")) return "DRIFT";
  if (vs.some((v) => v === "UNVERIFIABLE")) return "UNVERIFIABLE";
  return "MATCH";
}

export default function ProofPacket() {
  const supported = typeof crypto !== "undefined" && !!crypto.subtle;
  const [rows, setRows] = useState<Row[]>(INITIAL);
  const [claimed, setClaimed] = useState<Verdict>("MATCH");
  const [checks, setChecks] = useState<{ path: string; verdict: Verdict; note: string }[]>([]);

  const seal = async () => {
    const next = await Promise.all(rows.map(async (r) => ({ ...r, sealed: r.body.trim() ? await sha256Hex(r.body) : null })));
    setRows(next);
  };

  useEffect(() => {
    let alive = true;
    if (!supported) { setChecks([{ path: "crypto.subtle", verdict: "UNVERIFIABLE", note: "no digest available in this browser" }]); return; }
    (async () => {
      const out: { path: string; verdict: Verdict; note: string }[] = [];
      for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        if (r.sealed === null) { out.push({ path: `outputs[${i}].sealed`, verdict: "UNVERIFIABLE", note: "not sealed yet, no digest to check against" }); continue; }
        if (!r.body.trim()) { out.push({ path: `outputs[${i}].body`, verdict: "UNVERIFIABLE", note: "embedded body missing, cannot re-derive" }); continue; }
        const h = await sha256Hex(r.body);
        if (h === r.sealed) out.push({ path: `outputs[${i}] (${r.name})`, verdict: "MATCH", note: "re-derived digest equals the sealed digest" });
        else out.push({ path: `outputs[${i}] (${r.name})`, verdict: "DRIFT", note: "re-derived digest disagrees with the sealed digest" });
      }
      if (alive) setChecks(out);
    })();
    return () => { alive = false; };
  }, [rows, supported]);

  const derived: Verdict = checks.length ? fold(checks.map((c) => c.verdict)) : "UNVERIFIABLE";
  const overridden = claimed === "MATCH" && derived !== "MATCH";
  const sealed = rows.some((r) => r.sealed !== null);

  return (
    <div className="pp" aria-label="Proof packet verifier, live">
      <div className="pp-head">
        <span className="pp-tag mono">proof packet · derive, don&rsquo;t trust · runs in your browser</span>
        <span className="pp-claimed mono">
          claimed:
          <select value={claimed} onChange={(e) => setClaimed(e.target.value as Verdict)} aria-label="claimed verdict in the packet">
            <option>MATCH</option><option>DRIFT</option><option>UNVERIFIABLE</option>
          </select>
        </span>
        <span className={"verdict verdict-" + derived.toLowerCase()} role="status" aria-label="derived verdict">{derived}</span>
      </div>

      <div className="pp-outputs">
        {rows.map((r, i) => (
          <div className="pp-out" key={r.name}>
            <div className="pp-out-head">
              <span className="pp-out-name mono">{r.name}</span>
              <button className="pp-clear mono" onClick={() => setRows((rs) => rs.map((x, j) => (j === i ? { ...x, body: "" } : x)))} title="remove the embedded body">drop body</button>
            </div>
            <textarea
              className="pp-body mono" rows={2} spellCheck={false} value={r.body}
              onChange={(e) => setRows((rs) => rs.map((x, j) => (j === i ? { ...x, body: e.target.value } : x)))}
              aria-label={`embedded artifact body for ${r.name}`}
            />
          </div>
        ))}
      </div>

      <div className="pp-controls">
        <button className="emet-btn" onClick={seal} disabled={!supported}>{sealed ? "Re-seal packet" : "Seal packet"}</button>
        <span className="pp-hint">seal, then edit an artifact (→ DRIFT), drop a body (→ UNVERIFIABLE), or claim MATCH above (→ still can&rsquo;t win)</span>
      </div>

      <ul className="pp-checks">
        {checks.map((c, i) => (
          <li className={"pp-check pp-" + c.verdict.toLowerCase()} key={i}>
            <span className="pp-cv mono">{c.verdict}</span>
            <span className="pp-cp mono">{c.path}</span>
            <span className="pp-cn">{c.note}</span>
          </li>
        ))}
      </ul>

      {overridden && (
        <p className="pp-override mono">
          The packet claims <b>MATCH</b>. The derived verdict is <b>{derived}</b>. A self-asserted pass cannot win:
          the verdict is a function of the checks, never read from the packet.
        </p>
      )}
      <p className="emet-foot mono">
        The verdict is derived from checks over the packet&rsquo;s own materials. Read the paper:{" "}
        <a href="https://doi.org/10.5281/zenodo.21231406" rel="noopener">Proof Packets (Zenodo)</a>.
      </p>
    </div>
  );
}
