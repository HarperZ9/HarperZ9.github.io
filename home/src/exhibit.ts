// The exhibit hall behind the front door. Each room is a set piece; the front
// door is the entrance. Rooms register here and only rooms marked public are
// drawn. Mediums (riso, halftone, cyanotype, photocopy loss, film burn, VHS,
// CRT and the rest) come from a shared library vendored to /system/mediums/;
// until it ships, applying a medium falls back to the local treatment.

export type Room = {
  id: string;
  title: string;
  analogy: string;     // the one-line analogy the room opens on
  ask: string;         // the question it puts to the visitor
  href: string | null; // null while the room is in preparation
  public: boolean;
  mediums: string[];
};

// Set pieces from mission-control/2026-10-23-phase-design (SETPIECES.md). They stay
// private until each one's sources are checked and the author approves it.
export const ROOMS: Room[] = [
  { id: "here", title: "We are here", public: true, href: "#here", mediums: ["riso"],
    analogy: "A claim is like a creature: it only survives where the conditions let it.",
    ask: "Where do the claims you repeat live?" },
  { id: "balance", title: "The false balance", public: false, href: null, mediums: ["cyanotype", "halftone"],
    analogy: "Every checker is a scale, and a scale is only as honest as what sits under it.",
    ask: "What sits under yours?" },
  { id: "palimpsest", title: "Palimpsest", public: false, href: null, mediums: ["photocopy", "film-burn"],
    analogy: "Nothing written over is ever gone.", ask: "What did your last edit write over?" },
  { id: "powers", title: "Powers of ten, for a lie", public: false, href: null, mediums: ["crt", "vhs"],
    analogy: "A dropped word is invisible up close and decisive from far away.", ask: "How far back do you stand?" },
  { id: "mirror", title: "Mirror", public: false, href: null, mediums: ["x-ray"],
    analogy: "The room shows you the choices you made on the way in.", ask: "Would you choose them again?" },
];

export const publicRooms = () => ROOMS.filter((r) => r.public);

type Medium = { apply(target: Element, options?: Record<string, unknown>): void };
const cache = new Map<string, Promise<Medium | null>>();

// The page lists vendored mediums in <html data-mediums="riso halftone">; nothing is
// fetched for a medium that is not listed, so a missing library costs no request.
export function loadMedium(name: string): Promise<Medium | null> {
  const listed = (document.documentElement.dataset.mediums ?? "").split(/\s+/).filter(Boolean);
  if (!listed.includes(name)) return Promise.resolve(null);
  if (!cache.has(name)) {
    const url = `/system/mediums/${name}.js`;
    cache.set(name, import(/* @vite-ignore */ url).then(
      (m: Partial<Medium>) => (typeof m.apply === "function" ? (m as Medium) : null),
      (err: unknown) => { console.warn(`[front door] medium ${name} did not load; using the local treatment:`, err); return null; },
    ));
  }
  return cache.get(name)!;
}

// Apply a room's mediums to its art. Returns true when the library handled it.
export async function dress(target: Element, room: Room): Promise<boolean> {
  let handled = false;
  for (const name of room.mediums) {
    const medium = await loadMedium(name);
    if (medium) { medium.apply(target); handled = true; }
  }
  if (!handled) target.classList.add("medium-local");
  return handled;
}
