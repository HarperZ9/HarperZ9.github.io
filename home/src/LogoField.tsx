import { useEffect, useRef, useState } from "react";

/* The brand mark, rendered by the site's own tooling: a WebGL fragment-shader aperture
   (public/system/logo-field.js, seed 58) that spreads wide and splits across parallax
   layers, blending to transparent at its edges so it is not a cropped tile. Falls back to
   the static generated SVG mark if WebGL is unavailable or the module fails to load. */
export default function LogoField({ seed = 58 }: { seed?: number }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const [fallback, setFallback] = useState(false);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    let handle: { destroy(): void } | null = null;
    let cancelled = false;
    const reduced =
      typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Native dynamic import of the shared public module, hidden from Vite's import
    // analysis (which otherwise rewrites /public imports to a 500). This fetches the
    // raw static file at /system/logo-field.js, served as-is in dev and in the build.
    const nativeImport = new Function("u", "return import(u)") as (u: string) => Promise<any>;
    nativeImport("/system/logo-field.js")
      .then((mod) => {
        if (cancelled) return;
        if (!mod.isLogoFieldAvailable()) { setFallback(true); return; }
        handle = mod.mountLogoField(canvas, { seed, reduced });
      })
      .catch(() => { if (!cancelled) setFallback(true); });

    return () => { cancelled = true; if (handle) handle.destroy(); };
  }, [seed]);

  if (fallback) {
    return <img className="brand-fallback" src="/favicon.svg" alt="" width="34" height="34" />;
  }
  return <canvas ref={ref} className="brand-canvas" aria-hidden="true" />;
}
