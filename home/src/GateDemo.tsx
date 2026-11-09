import { useMemo, useState } from "react";

/* The default-deny gate from proof-surface, running live. Same decision
   logic as the shipped Python: one deny settles it, anything unknown
   escalates to a person, allow only on a clean sweep. */

type CheckV = "pass" | "deny" | "needs";
type Check = { name: string; v: CheckV; msg: string };

const TOGGLES = [
  { id: "receipt", label: "An authorization receipt is present", sub: "a real grant from a human principal" },
  { id: "expiry", label: "The receipt has an expiry", sub: "no expiry means invalid before the gate" },
  { id: "action", label: "The action is in the allowlist", sub: "an empty allowlist authorizes nothing" },
  { id: "budget", label: "Budget is known", sub: "unknown escalates to needs-human" },
  { id: "state", label: "Observed state is present", sub: "no observation escalates to needs-human" },
] as const;

type TId = (typeof TOGGLES)[number]["id"];
type Flags = Record<TId, boolean>;

const ALL_ON: Flags = { receipt: true, expiry: true, action: true, budget: true, state: true };

function derive(f: Flags): { decision: "allow" | "deny" | "needs-human"; checks: Check[] } {
  let auth: Check;
  if (!f.receipt) auth = { name: "authorization", v: "deny", msg: "no receipt, deny" };
  else if (!f.expiry) auth = { name: "authorization", v: "deny", msg: "receipt has no expiry, invalid before the gate" };
  else if (!f.action) auth = { name: "authorization", v: "deny", msg: "action not in allowlist, deny" };
  else auth = { name: "authorization", v: "pass", msg: "real, scoped, expiring grant, pass" };
  const bud: Check = f.budget
    ? { name: "budget", v: "pass", msg: "within budget, pass" }
    : { name: "budget", v: "needs", msg: "budget unknown, needs-human" };
  const st: Check = f.state
    ? { name: "state", v: "pass", msg: "observed state present, pass" }
    : { name: "state", v: "needs", msg: "no observation, needs-human" };
  const checks = [auth, bud, st];
  const anyDeny = checks.some((c) => c.v === "deny");
  const anyEscalate = checks.some((c) => c.v !== "pass");
  return { decision: anyDeny ? "deny" : anyEscalate ? "needs-human" : "allow", checks };
}

export default function GateDemo() {
  const [flags, setFlags] = useState<Flags>(ALL_ON);
  const { decision, checks } = useMemo(() => derive(flags), [flags]);

  return (
    <div className="gd">
      <div className="gd-head">
        <h3 className="demo-title">The gate</h3>
        <span className="demo-tag mono">proof-surface · default-deny · live</span>
      </div>
      <p className="demo-line">
        An agent action arrives hoping to go ahead. The answer is no until it is earned: one deny
        settles it, anything unknown stops for a person, and allow needs a clean sweep. Flip the
        conditions and watch how much has to be true at once.
      </p>
      <ul className="gd-toggles">
        {TOGGLES.map((t) => (
          <li key={t.id}>
            <label className="gd-tog">
              <input
                type="checkbox"
                checked={flags[t.id]}
                onChange={(e) => setFlags({ ...flags, [t.id]: e.target.checked })}
              />
              <span className="gd-tog-text">
                {t.label}
                <span className="gd-sub">{t.sub}</span>
              </span>
            </label>
          </li>
        ))}
      </ul>
      <div className={"gd-out gd-" + decision} aria-live="polite">
        <span className="gd-verdict">{decision.toUpperCase()}</span>
        <div className="gd-rows">
          {checks.map((c) => (
            <div key={c.name} className={"gd-row gd-r-" + c.v}>
              <span className="gd-rk mono">{c.name}</span> {c.msg}
            </div>
          ))}
        </div>
      </div>
      <p className="demo-note">
        This is the real decision logic, the same default-deny that ships in{" "}
        <a href="https://github.com/HarperZ9/proof-surface" rel="noopener">proof-surface</a>. Honest
        limit: the gate recommends; the program around it enforces.
      </p>
    </div>
  );
}
