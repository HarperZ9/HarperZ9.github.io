import { useEffect, useRef } from "react";

/* One continuous GPU field behind the entire page (public/system/field-ground.js). It is
   fixed to the viewport and anchored to the document by scroll, so every section floats on
   the same generative ground and blends into the next with no seam. Silent no-op if WebGL
   is unavailable -- the page background falls back to the void color underneath. */
export default function GroundField({ seed = 58 }: { seed?: number }) {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    let handle: { destroy(): void } | null = null;
    let cancelled = false;
    const reduced =
      typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

    const nativeImport = new Function("u", "return import(u)") as (u: string) => Promise<any>;
    nativeImport("/system/field-ground.js")
      .then((mod) => {
        if (cancelled || !mod.isFieldGroundAvailable()) return;
        handle = mod.mountFieldGround(canvas, { seed, principle: "origin", wander: true, hero: true, reduced });
      })
      .catch(() => {});

    return () => { cancelled = true; if (handle) handle.destroy(); };
  }, [seed]);

  return <canvas ref={ref} className="ground-field" aria-hidden="true" />;
}
