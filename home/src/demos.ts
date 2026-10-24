// The small demos inside each panel. Each one enhances markup that already
// reads correctly without JavaScript: every state shown, controls hidden.

export function mountChoose(fig: HTMLElement) {
  const group = fig.querySelector<HTMLElement>(".fd-choices");
  const states = Array.from(fig.querySelectorAll<HTMLElement>(".fd-state"));
  if (!group || !states.length) return;
  const buttons = Array.from(group.querySelectorAll<HTMLButtonElement>("button"));
  const show = (key: string) => {
    for (const b of buttons) b.setAttribute("aria-pressed", String(b.dataset.show === key));
    for (const st of states) st.hidden = st.dataset.state !== key;
  };
  for (const b of buttons) b.addEventListener("click", () => show(b.dataset.show ?? "0"));
  group.hidden = false;
  show(buttons.find((b) => b.getAttribute("aria-pressed") === "true")?.dataset.show ?? "0");
}

export function mountWipe(fig: HTMLElement) {
  const frame = fig.querySelector<HTMLElement>(".fd-wipe-frame");
  const top = fig.querySelector<HTMLElement>(".fd-wipe-top");
  const control = fig.querySelector<HTMLElement>(".fd-wipe-control");
  const input = control?.querySelector<HTMLInputElement>("input");
  if (!frame || !top || !control || !input) return;
  const set = (v: number) => {
    const pct = Math.max(0, Math.min(100, v));
    input.value = String(Math.round(pct));
    top.style.clipPath = `inset(0 0 0 ${pct}%)`;
    frame.style.setProperty("--split", `${pct}%`);
  };
  input.addEventListener("input", () => set(Number(input.value)));
  let dragging = false;
  const fromPointer = (e: PointerEvent) => {
    const box = frame.getBoundingClientRect();
    set(((e.clientX - box.left) / box.width) * 100);
  };
  frame.addEventListener("pointerdown", (e) => { dragging = true; frame.setPointerCapture(e.pointerId); fromPointer(e); });
  frame.addEventListener("pointermove", (e) => { if (dragging) fromPointer(e); });
  frame.addEventListener("pointerup", () => { dragging = false; });
  frame.addEventListener("pointercancel", () => { dragging = false; });
  control.hidden = false;
  frame.classList.add("is-live");
  set(Number(input.value));
}

type FeedItem = { url: string; title: string; date_published?: string };

export async function mountNewest(list: HTMLElement) {
  try {
    const res = await fetch("/feed.json", { cache: "no-cache" });
    if (!res.ok) throw new Error(`feed.json answered ${res.status}`);
    const feed = (await res.json()) as { items?: FeedItem[] };
    const items = (feed.items ?? [])
      .filter((it) => it.url && it.title)
      .sort((a, b) => (b.date_published ?? "").localeCompare(a.date_published ?? ""))
      .slice(0, 3);
    if (!items.length) return;
    list.replaceChildren(...items.map((it) => {
      const li = document.createElement("li");
      const a = document.createElement("a");
      a.href = new URL(it.url).pathname;
      a.textContent = it.title;
      li.append(a);
      return li;
    }));
  } catch (err) {
    // The static links stay in place; say why the newest list did not load.
    console.warn("[front door] newest writing kept its static links:", err);
  }
}
