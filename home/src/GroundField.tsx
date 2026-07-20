import { useEffect, useRef } from "react";
import { desktopGpuArtQueries, shouldUseDesktopGpuArt } from "./visual-capability";

/* One continuous GPU field behind the entire page (public/system/field-ground.js). It is
   fixed to the viewport and anchored to the document by scroll, so every section floats on
   the same generative ground and blends into the next with no seam. Silent no-op if WebGL
   is unavailable -- the page background falls back to the void color underneath. */
export default function GroundField({ seed = 58 }: { seed?: number }) {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;

    // Some older mobile WebViews do not implement matchMedia at all. Keep the
    // page static rather than letting a visual enhancement interrupt the app.
    if (typeof window.matchMedia !== "function") {
      canvas.dataset.mode = "static";
      return;
    }

    let handle: { destroy(): void } | null = null;
    let disposed = false;
    let request = 0;
    const media = desktopGpuArtQueries.map((query) => window.matchMedia(query));

    const nativeImport = new Function("u", "return import(u)") as (u: string) => Promise<any>;

    const refresh = () => {
      const thisRequest = ++request;
      if (handle) {
        handle.destroy();
        handle = null;
      }

      // Mobile is intentionally a complete static experience. Do not allocate a
      // WebGL context for touch, narrow, or reduced-motion visitors.
      if (!shouldUseDesktopGpuArt()) {
        canvas.dataset.mode = "static";
        return;
      }

      delete canvas.dataset.mode;
      nativeImport("/system/field-ground.js?v=20260718-zentropy")
        .then((mod) => {
          if (disposed || thisRequest !== request || !shouldUseDesktopGpuArt() || !mod.isFieldGroundAvailable()) return;
          handle = mod.mountFieldGround(canvas, {
            seed,
            principle: "zentropy",
            wander: false,
            hero: false,
            reduced: false,
          });
        })
        .catch(() => {});
    };

    refresh();
    const listen = (query: MediaQueryList) => {
      if (typeof query.addEventListener === "function") query.addEventListener("change", refresh);
      else query.addListener(refresh);
    };
    const unlisten = (query: MediaQueryList) => {
      if (typeof query.removeEventListener === "function") query.removeEventListener("change", refresh);
      else query.removeListener(refresh);
    };
    media.forEach(listen);

    return () => {
      disposed = true;
      request += 1;
      media.forEach(unlisten);
      if (handle) handle.destroy();
    };
  }, [seed]);

  return <canvas ref={ref} className="ground-field" aria-hidden="true" />;
}
