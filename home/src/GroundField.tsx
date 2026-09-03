import { useEffect, useRef } from "react";
import { desktopGpuArtQueries, shouldUseDesktopGpuArt } from "./visual-capability";

/* One continuous GPU field behind the entire page (public/system/field-ground.js). It is
   fixed to the viewport and anchored to the document by scroll, so every section floats on
   the same generative ground. Silent no-op if WebGL is unavailable. */
export default function GroundField({ seed = 58 }: { seed?: number }) {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;

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

      if (!shouldUseDesktopGpuArt()) {
        canvas.dataset.mode = "static";
        return;
      }

      delete canvas.dataset.mode;
      nativeImport("/system/field-ground.js?v=20260903-aperture")
        .then((mod) => {
          if (disposed || thisRequest !== request || !shouldUseDesktopGpuArt() || !mod.isFieldGroundAvailable()) return;
          handle = mod.mountFieldGround(canvas, {
            seed,
            principle: "zentropy",
            wander: false,
            // The aperture. field-ground.js was written with this page in mind and its own header
            // says so, but the flag shipped false, so the masthead ran on the background field
            // alone at the zentropy gain of 0.24, the lowest in the principle table by a factor of
            // four. Measured off the field canvas at 1440x900 the aperture now peaks at
            // (194, 255, 255), luminance 242, and falls to a dark iris interior before the rim ring
            // rises again; over the block the headline and subhead occupy it holds a maximum of 31
            // and a mean of 21, so the hot mark and the type do not fight. The aperture term is the
            // one thing that skips u_gain, so it comes up to full strength while the field behind
            // it stays restrained, and it dissolves on scroll before the first section arrives.
            hero: true,
            reduced: false,
          });
        })
        .catch(() => {});
    };

    const listen = (query: MediaQueryList) => {
      if (typeof query.addEventListener === "function") query.addEventListener("change", refresh);
      else query.addListener(refresh);
    };
    const unlisten = (query: MediaQueryList) => {
      if (typeof query.removeEventListener === "function") query.removeEventListener("change", refresh);
      else query.removeListener(refresh);
    };

    refresh();
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
