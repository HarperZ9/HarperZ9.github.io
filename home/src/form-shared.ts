// Shared types and helpers for the front-door forms.

export type Palette = { ink: string; paper: string; soft: string; line: string; dark: boolean };

export type FormState = {
  n: number;            // facet count
  rot: number;          // current rotation, radians
  sel: number;          // selected facet
  preview: number | null;
  t: number;            // seconds of ambient time
  px: number;           // pointer, -1..1
  py: number;
  water: number;        // 0..1, Low Water's rising line
  pointAngle: number;   // screen angle the selected facet turns toward
  energy: number;       // 0..1, how fast the cursor has been moving
  split: number;        // 0..1, a long press pulls the form apart
  idle: number;         // 0..1, rises after a while with no input
  spin: number;         // extra ring spin, fed by scrolling
  selAt: number;        // s.t when the current facet was chosen
  eclipse: number;      // 0..1, the hidden mode
  calm: boolean;        // reduced motion: snap, never drift
  shocks: Array<{ x: number; y: number; t: number }>; // click ripples, canvas pixels
};

export function freshState(n: number): FormState {
  return {
    n, rot: 0, sel: 0, preview: null, t: 0, px: 0, py: 0, water: 0, pointAngle: 0,
    energy: 0, split: 0, idle: 0, spin: 0, selAt: -10, eclipse: 0, calm: false, shocks: [],
  };
}

export type FormRenderer = {
  name: string;
  draw(ctx: CanvasRenderingContext2D, size: number, s: FormState, p: Palette): void;
  pick(x: number, y: number, size: number, s: FormState): number | null;
  targetRot(i: number, s: FormState): number;
};

export const TAU = Math.PI * 2;

export function wrap(a: number): number {
  a = (a + Math.PI) % TAU;
  if (a < 0) a += TAU;
  return a - Math.PI;
}

// Three sines at unrelated rates: smooth, cheap, and never quite repeating.
export function field(a: number, k: number, t: number): number {
  return Math.sin(a * 3 + k * 0.7 + t) * 0.5
    + Math.sin(a * 7 - k * 0.3 + t * 1.3) * 0.3
    + Math.sin(a * 13 + k * 1.1 - t * 0.7) * 0.2;
}

export function alpha(color: string, a: number): string {
  // color is #rrggbb from the site tokens
  const m = /^#([0-9a-f]{6})$/i.exec(color.trim());
  if (!m) return color;
  const v = parseInt(m[1], 16);
  return `rgba(${(v >> 16) & 255},${(v >> 8) & 255},${v & 255},${a})`;
}

// The single spectral flare the art is allowed: three channel-offset strokes.
export const FLARE = ["rgba(255,70,90,", "rgba(80,220,140,", "rgba(90,140,255,"];

export function readPalette(): Palette {
  const cs = getComputedStyle(document.documentElement);
  const get = (name: string, fallback: string) => cs.getPropertyValue(name).trim() || fallback;
  const paper = get("--paper", "#ebe5d8");
  const v = parseInt(paper.replace("#", ""), 16);
  const lum = Number.isNaN(v) ? 1 : (((v >> 16) & 255) * 0.3 + ((v >> 8) & 255) * 0.59 + (v & 255) * 0.11) / 255;
  return { ink: get("--ink", "#16130f"), paper, soft: get("--soft", "#4a443b"), line: get("--line", "#c9bfab"), dark: lum < 0.4 };
}
