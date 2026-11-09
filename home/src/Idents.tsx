import type { ReactNode } from "react";
import { IDENT_SOURCE } from "./system-registry";

// Advisory IDs and package names inside registry text, each wrapped so the
// .ident rule in App.css keeps it on one line when the line has room. The
// pattern comes from scripts/ident-tokens.mjs through the generated registry
// module, so the home and the static pages mark the same tokens. As there, an
// opening bracket or quote before the token and closing punctuation after it
// join the span, so neither can end or start a line alone.
const IDENT = new RegExp(IDENT_SOURCE, "g");
const OPENING = new Set(["(", "[", "{", "“", "‘", '"', "'"]);

export function Idents({ text }: { text: string | null | undefined }): ReactNode {
  if (!text) return text ?? null;
  const parts: ReactNode[] = [];
  let last = 0;
  for (const match of text.matchAll(IDENT)) {
    const lead = match[1];
    const glue = OPENING.has(lead.at(-1) ?? "") ? 1 : 0;
    const start = (match.index ?? 0) + lead.length - glue;
    const whole = `${lead.slice(lead.length - glue)}${match[2]}${match[3] ?? ""}`;
    if (start > last) parts.push(text.slice(last, start));
    parts.push(<span className="ident" translate="no" key={start}>{whole}</span>);
    last = start + whole.length;
  }
  if (last === 0) return text;
  if (last < text.length) parts.push(text.slice(last));
  return <>{parts}</>;
}
