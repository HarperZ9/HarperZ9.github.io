/**
 * The Zentropy artwork is complete without GPU rendering. Keep WebGL as a
 * desktop enhancement only, where a fine pointer and ample viewport make the
 * extra motion useful rather than costly.
 */
export const desktopGpuArtQueries = [
  "(prefers-reduced-motion: reduce)",
  "(pointer: fine)",
  "(min-width: 900px)",
] as const;

export function shouldUseDesktopGpuArt(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;

  const [reducedMotion, finePointer, desktopWidth] = desktopGpuArtQueries.map((query) =>
    window.matchMedia(query),
  );

  return (
    !reducedMotion.matches &&
    finePointer.matches &&
    desktopWidth.matches
  );
}
