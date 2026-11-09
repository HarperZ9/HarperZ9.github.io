import { useState } from "react";

/* "Which engine do I need?": the guide.html picker, rebuilt as an
   interactive chip row. Pick the problem, get the engine and the command. */

type Pick = { problem: string; engine: string; line: string; cmd: string; href: string };

const PICKS: Pick[] = [
  { problem: "Pull sources from the web, PDFs, video", engine: "gather",
    line: "Captures web, papers, scanned PDFs, browser, OCR, and audio into structured research packets.",
    cmd: "pip install gather-engine", href: "https://pypi.org/project/gather-engine/" },
  { problem: "Understand a big codebase fast", engine: "index",
    line: "Maps one repo into a wiki or a whole workspace into an atlas, offline, from file:line evidence.",
    cmd: "pip install index-graph", href: "https://pypi.org/project/index-graph/" },
  { problem: "Run several agents together, safely", engine: "forum",
    line: "Routes fleets of agents with gates and contracts, and keeps a replayable causal ledger.",
    cmd: "pip install forum-engine", href: "https://pypi.org/project/forum-engine/" },
  { problem: "Check whether a claim actually holds", engine: "crucible",
    line: "Registers the thesis, steelmans it, and measures it against the thing that could break it.",
    cmd: "pip install crucible-bench", href: "https://pypi.org/project/crucible-bench/" },
  { problem: "Know if a file changed", engine: "emet",
    line: "Re-derives the bytes and answers MATCH, DRIFT, or UNVERIFIABLE. Four languages, frozen spec.",
    cmd: "pip install emet", href: "https://pypi.org/project/emet/" },
  { problem: "Compile typed, effect-checked programs", engine: "buildlang",
    line: "A systems language where what a function may do is part of its type. Native binaries out.",
    cmd: "cargo install buildlang", href: "https://crates.io/crates/buildlang" },
  { problem: "Actually learn the material", engine: "learn",
    line: "Turns your own notes into a course: spaced repetition, retrieval practice, honest grading.",
    cmd: "git clone https://github.com/HarperZ9/learn", href: "https://github.com/HarperZ9/learn" },
  { problem: "The whole workbench", engine: "telos",
    line: "Shared human/model workspace: durable state, senses, actuation, and proof packets. Honestly early.",
    cmd: "git clone https://github.com/HarperZ9/telos", href: "https://github.com/HarperZ9/telos" },
];

export default function Picker() {
  const [sel, setSel] = useState(0);
  const p = PICKS[sel];

  return (
    <div className="picker reveal">
      <h3 className="picker-title">Which one do you need?</h3>
      <div className="picker-chips" role="tablist" aria-label="Pick your problem">
        {PICKS.map((x, i) => (
          <button
            key={x.engine}
            role="tab"
            aria-selected={i === sel}
            className={"picker-chip" + (i === sel ? " on" : "")}
            onClick={() => setSel(i)}
          >
            {x.problem}
          </button>
        ))}
      </div>
      <div className="picker-out" role="tabpanel">
        <div className="picker-name-row">
          <span className="picker-name">{p.engine}</span>
          <a className="picker-open mono" href={p.href} rel="noopener">open ↗</a>
        </div>
        <p className="picker-line">{p.line}</p>
        <code className="picker-cmd mono">{p.cmd}</code>
      </div>
    </div>
  );
}
