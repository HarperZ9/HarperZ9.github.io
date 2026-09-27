import type { ReactNode } from "react";
import { IDENT_SOURCE } from "./system-registry";

// Advisory IDs and package names inside registry text, each wrapped so the
// .ident rule in App.css keeps it on one line when the line has room. The
// pattern comes from scripts/ident-tokens.mjs through the generated registry
// module, so the home and the static pages mark the same tokens.
const IDENT = new RegExp(IDENT_SOURCE, "g");

export function Idents({ text }: { text: string | null | undefined }): ReactNode {
  if (!text) return text ?? null;
  const parts: ReactNode[] = [];
  let last = 0;
  for (const match of text.matchAll(IDENT)) {
    const start = (match.index ?? 0) + match[1].length;
    if (start > last) parts.push(text.slice(last, start));
    parts.push(<span className="ident" translate="no" key={start}>{match[2]}</span>);
    last = start + match[2].length;
  }
  if (last === 0) return text;
  if (last < text.length) parts.push(text.slice(last));
  return <>{parts}</>;
}
