import { useEffect, useRef } from "react";

/* Live generative supergraphic: a flow field whose particles trace
   plotter-thin curved lines that organize into large tangential arcs
   (the 70s supergraphic form), color-banded across the spectrum.
   The "reconcile" as motion: paths perceived, advected, re-drawn.
   Static composed frame under prefers-reduced-motion. */

const SPECTRUM = [
  "oklch(0.685 0.255 352)", // magenta
  "oklch(0.760 0.190 46)",  // ember
  "oklch(0.860 0.155 90)",  // gold
  "oklch(0.870 0.215 133)", // lime
  "oklch(0.825 0.135 200)", // cyan
  "oklch(0.695 0.200 286)", // iris
];

type P = { x: number; y: number; life: number; max: number; band: number };

export default function FlowField() {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let w = 0, h = 0, dpr = 1;
    let particles: P[] = [];
    let raf = 0;
    let t = 0;
    let running = true;

    const count = () => {
      const a = w * h;
      const base = Math.round(a / 950);
      return Math.max(360, Math.min(reduce ? 1200 : 2400, base));
    };

    const spawn = (): P => {
      // center is OFF-SCREEN (upper right): arcs read as big clean sweeps,
      // no visible convergence point. color-band by radius -> concentric
      // rainbow rings sweeping across the field.
      const cx = w * 1.15, cy = h * 0.18;
      const x = Math.random() * w * 1.06 - w * 0.03;
      const y = Math.random() * h * 1.06 - h * 0.03;
      const r = Math.hypot(x - cx, y - cy);
      const maxR = Math.hypot(w, h) * 1.25;
      const band = Math.floor((r / maxR) * SPECTRUM.length * 1.5 + Math.random() * 0.25) % SPECTRUM.length;
      return { x, y, life: 0, max: 140 + Math.random() * 300, band };
    };

    const field = (x: number, y: number, time: number) => {
      // clean tangential sweep around an off-screen center (big smooth arcs).
      // noise kept low so the field stays near divergence-free: no focus, no
      // stagnation point where trajectories pile up into a hot spot.
      const cx = w * 1.15, cy = h * 0.18;
      const tangent = Math.atan2(y - cy, x - cx) + Math.PI / 2;
      const n =
        Math.sin(x * 0.00085 + time * 0.10) * 0.5 +
        Math.cos(y * 0.00100 - time * 0.08) * 0.5;
      return tangent + n * 0.2;
    };

    const resize = () => {
      const parent = canvas.parentElement;
      const rect = parent ? parent.getBoundingClientRect() : { width: window.innerWidth, height: window.innerHeight };
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = Math.max(1, Math.floor(rect.width));
      h = Math.max(1, Math.floor(rect.height));
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = w + "px";
      canvas.style.height = h + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = "oklch(0.155 0.052 316)";
      ctx.fillRect(0, 0, w, h);
      particles = Array.from({ length: count() }, spawn);
      if (reduce) staticFrame();
    };

    const step = (fade: number) => {
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = `oklch(0.155 0.052 316 / ${fade})`;
      ctx.fillRect(0, 0, w, h);
      ctx.globalCompositeOperation = "lighter";
      ctx.lineWidth = 1.7;
      ctx.lineCap = "round";
      for (const p of particles) {
        const a = field(p.x, p.y, t);
        const nx = p.x + Math.cos(a) * 1.5;
        const ny = p.y + Math.sin(a) * 1.5;
        ctx.strokeStyle = SPECTRUM[p.band];
        ctx.globalAlpha = 0.44;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(nx, ny);
        ctx.stroke();
        p.x = nx; p.y = ny; p.life++;
        if (p.life > p.max || p.x < -40 || p.x > w + 40 || p.y < -40 || p.y > h + 40) {
          Object.assign(p, spawn());
        }
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
    };

    const staticFrame = () => {
      // advance the sim many steps without per-frame fade -> one composed still
      for (let i = 0; i < 260; i++) { t = i * 0.02; step(0.02); }
    };

    const loop = () => {
      if (!running) return;
      t += 0.0135;
      step(0.02);
      raf = requestAnimationFrame(loop);
    };

    const onVis = () => {
      if (document.hidden) { running = false; cancelAnimationFrame(raf); }
      else if (!reduce) { running = true; raf = requestAnimationFrame(loop); }
    };

    let ro: ResizeObserver | null = null;
    resize();
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(() => resize());
      if (canvas.parentElement) ro.observe(canvas.parentElement);
    } else {
      window.addEventListener("resize", resize);
    }
    document.addEventListener("visibilitychange", onVis);
    if (!reduce) raf = requestAnimationFrame(loop);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      document.removeEventListener("visibilitychange", onVis);
      if (ro) ro.disconnect(); else window.removeEventListener("resize", resize);
    };
  }, []);

  return <canvas ref={ref} className="hero-canvas" aria-hidden="true" />;
}
