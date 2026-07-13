import { useEffect, useRef, type ReactNode } from "react";

/* An emphasis mark rendered by a living shader instead of a flat CSS fill: the highlighter,
   the name pill, and small ticks each host a tiny organic/glitchy WebGL canvas
   (public/system/emphasis-field.js) behind their text. Falls back to the CSS marker under
   .emph-* if WebGL is unavailable (the canvas simply stays empty and the base shows). */
export default function Emphasis({
  kind, seed = 58, children,
}: { kind: "mark" | "pill" | "tick"; seed?: number; children?: ReactNode }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let handle: { destroy(): void } | null = null;
    let cancelled = false;
    const reduced =
      typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
    const nativeImport = new Function("u", "return import(u)") as (u: string) => Promise<any>;
    nativeImport("/system/emphasis-field.js")
      .then((mod) => {
        if (cancelled || !mod.isEmphasisAvailable()) return;
        handle = mod.mountEmphasis(canvas, { kind, seed, reduced });
      })
      .catch(() => {});
    return () => { cancelled = true; if (handle) handle.destroy(); };
  }, [kind, seed]);

  return (
    <span className={"emph emph-" + kind}>
      <canvas ref={canvasRef} className="emph-canvas" aria-hidden="true" />
      <span className="emph-text">{children}</span>
    </span>
  );
}
