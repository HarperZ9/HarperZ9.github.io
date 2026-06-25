// llm.js: the cheap, stateless model as the SOLVER.
//
// The engine provides perception + tools + a sound verifier; THIS runs a bounded loop in
// which a cheap LLM perceives the data, hypothesizes a conserved quantity, tests it with a
// tool, and submits. The model supplies reasoning and search; it never sees the equations.
// Talks to a local Ollama over a structured-action protocol (the model emits one JSON action;
// we execute it and feed the result back) so it works with any cheap model. Never fakes a
// solve: if no model is reachable, it says so. Zero dependencies (uses global fetch).
import { renderPerception } from "./observables.js";

const SYSTEM_PROMPT = (vars) =>
  `You are a physicist studying an unknown system from data alone. The measured variables are: ${vars.join(", ")}.\n` +
  `There is a CONSERVED QUANTITY: some combination of these variables stays constant over time, even as the variables themselves swing. Your job is to discover which TERMS it is built from. You do NOT compute the weights; a tool does that for you.\n\n` +
  `Reply with exactly ONE JSON object on its own line:\n` +
  `  {"tool":"fit","terms":["<term>","<term>"]}\n` +
  `It takes the list of candidate terms you think matter and returns whether they combine into a conserved quantity (verdict=verified means YES, you found it).\n\n` +
  `Each term uses only the variables (${vars.join(", ")}), numbers, + - * / ^, parentheses, and sin cos sqrt abs. A term is a simple building block, for example "${vars[0]}^2" or "${vars[vars.length - 1]}^2".\n\n` +
  `FIRST inspect the data: if a measured variable barely changes over the whole trajectory (its range is tiny next to the others), that variable may ITSELF be the conserved quantity. Try fit with just that one variable, e.g. {"tool":"fit","terms":["b"]}.\n` +
  `Otherwise the conserved quantity is a COMBINATION. You may give fit MANY candidate terms in ONE call: it finds the best-conserved combination and gives unhelpful terms near-zero weight. So list SEVERAL plausible terms together rather than guessing one pair at a time.\n` +
  `Good terms to include: the square of each variable; the product of pairs of variables; and for any variable that looks like an angle, cos and sin of it. Example: fit(["a^2","b^2","a*b","cos(a)"]).\n` +
  `If a set is refuted, add or swap terms and try again. Output nothing except the single JSON object.`;

const USER_PROMPT = (perception) =>
  `Here is the data:\n\n${renderPerception(perception)}\n\nFind a conserved quantity. Begin by evaluating a candidate formula.`;

// Pull the last flat JSON action object that carries a "tool" field out of a model reply.
export function parseAction(text) {
  const matches = [...String(text).matchAll(/\{[^{}]*"tool"[^{}]*\}/g)];
  for (let i = matches.length - 1; i >= 0; i--) {
    try { const o = JSON.parse(matches[i][0]); if (o && typeof o.tool === "string") return o; }
    catch { /* keep scanning earlier matches */ }
  }
  return null;
}

async function ollamaChat(messages, { model, host, temperature }) {
  const res = await fetch(`${host}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages, stream: false, options: { temperature } }),
  });
  if (!res.ok) throw new Error(`ollama HTTP ${res.status}`);
  const data = await res.json();
  return (data && data.message && data.message.content) || "";
}

// Run the solve loop. Returns { solved, submittedExpr, certificate, transcript, error? }.
export async function solveLoop(tools, opts = {}) {
  const { model = "qwen2.5:3b", host = "http://localhost:11434", maxSteps = 10, temperature = 0.2, log = () => {},
          systemPrompt = SYSTEM_PROMPT, userPrompt = USER_PROMPT,
          chat = (msgs) => ollamaChat(msgs, { model, host, temperature }) } = opts;
  const vars = tools.system.vars;
  const transcript = [];
  const messages = [
    { role: "system", content: systemPrompt(vars) },
    { role: "user", content: userPrompt(tools.perception) },
  ];
  for (let step = 0; step < maxSteps; step++) {
    let content;
    try { content = await chat(messages); }
    catch (e) { return { solved: false, error: `model unreachable: ${e.message}`, transcript }; }
    transcript.push({ role: "assistant", content });
    messages.push({ role: "assistant", content });
    log(`model> ${content.trim().replace(/\s+/g, " ").slice(0, 240)}`);

    const action = parseAction(content);
    if (!action) {
      const nudge = 'Reply with ONLY one JSON action on its own line, e.g. {"tool":"evaluate","expr":"0.5*v^2 + 0.5*x^2"}.';
      messages.push({ role: "user", content: nudge });
      transcript.push({ role: "tool", content: nudge });
      continue;
    }
    if (action.tool === "submit") {
      // Block submitting a non-conserved formula: force the model to keep refining. Only a
      // formula the (cheap) check already calls verified is accepted, then fully certified.
      const check = tools.evaluate(action.expr || "");
      if (check.verdict !== "verified") {
        const back = `That formula is NOT conserved (verdict=${check.verdict}, conservationScore=${check.conservationScore}). Do not submit it. Keep using evaluate to refine until a formula returns verdict=verified, then submit THAT one.`;
        messages.push({ role: "user", content: back });
        transcript.push({ role: "tool", content: `rejected submit ${action.expr} (${check.verdict})` });
        log(`reject-submit> ${action.expr} (${check.verdict})`);
        continue;
      }
      const cert = tools.submit(action.expr);
      transcript.push({ role: "tool", content: `submit ${action.expr} -> ${cert.verdict}` });
      log(`SUBMIT ${action.expr} -> ${cert.verdict} (certified=${cert.certified})`);
      return { solved: cert.verdict === "verified", submittedExpr: action.expr, certificate: cert, transcript };
    }
    let fb;
    if (action.tool === "fit") {
      const r = tools.fit(action.terms);
      if (r.ok && r.verdict === "verified") {
        // the model chose the right terms: certify the fitted law (the sound floor) and stop
        const cert = tools.submit(r.expr);
        transcript.push({ role: "tool", content: `fit ${JSON.stringify(action.terms)} -> ${r.expr} -> ${cert.verdict}` });
        log(`SOLVED via fit ${JSON.stringify(action.terms)} -> ${r.expr} -> ${cert.verdict} (certified=${cert.certified})`);
        return { solved: cert.verdict === "verified", submittedExpr: r.expr, certificate: cert, transcript };
      }
      fb = (r.ok
        ? `fit(${JSON.stringify(action.terms)}) -> formula="${r.expr}", verdict=${r.verdict}, conservationScore=${r.conservationScore}`
        : `fit failed: ${r.reason}`) + "\nThose terms do not combine into a conserved quantity. Try fit with a DIFFERENT set of terms.";
    } else {
      const res = tools.evaluate(action.expr || "");
      fb =
        `evaluate(${action.expr}) -> verdict=${res.verdict}, conservationScore=${res.conservationScore}` +
        (res.reason ? `, reason=${res.reason}` : "") +
        '\nUse fit to find a conserved quantity: {"tool":"fit","terms":["...","..."]}.';
    }
    transcript.push({ role: "tool", content: fb });
    log(`tool> ${fb.replace(/\s+/g, " ").slice(0, 240)}`);
    messages.push({ role: "user", content: fb });
  }
  return { solved: false, reason: "step budget reached", transcript };
}
