"""Night School's coast map, the Lantern Coast: one page that draws the curriculum as the guides'
places along one shore at night, with every lesson a light that links to its page. Lights, labels
and the lit paths between them come from media/school/curriculum.json; where each light stands is
drawn by hand in PLACES and LIGHTS below.

    python -m tools.school.coast            (writes night-school-coast.html)
"""

from __future__ import annotations

import json
import math

from tools.school.page import ROOT, SCHOOL, E, GUIDE, head, foot

W, H = 1200, 760

# Each place: name, guide, track, the place's anchor and the drawing that marks it.
PLACES = {
    "hill": ("The hill above the harbour", "pylon", "F", (250, 215)),
    "dock": ("The dock and the customs shed", "pylon", "L", (455, 545)),
    "light": ("The lighthouse", "tallow", "L", (655, 600)),
    "boatyard": ("The small boatyard", "tallow", "S", (830, 590)),
    "cannery": ("The cannery", "rerun", "K", (880, 300)),
    "tides": ("The tide tables", "rerun", "A", (1015, 700)),
    "prism": ("The prism at the tide line", "rerun", "E", (1170, 556)),
}

# Every lesson's light: (place, x, y). A lesson missing here fails the build, not the page.
LIGHTS = {
    "F1": ("hill", 110, 340), "F2": ("hill", 170, 255), "F3": ("hill", 255, 320), "F4": ("hill", 325, 240),
    "F5": ("hill", 400, 310), "F6": ("hill", 335, 140),
    "L7": ("dock", 285, 420), "L13": ("dock", 365, 455), "L12": ("dock", 440, 505), "L14": ("dock", 500, 455),
    "L8": ("light", 575, 445), "L9": ("light", 645, 425), "L10": ("light", 655, 550), "L11": ("light", 600, 510),
    "L15": ("light", 705, 445), "L16": ("light", 700, 515),
    "S17": ("boatyard", 795, 535), "S18": ("boatyard", 850, 550), "S19": ("boatyard", 905, 535), "S20": ("boatyard", 850, 485),
    "K21": ("cannery", 800, 250), "K22": ("cannery", 860, 205), "K23": ("cannery", 930, 225), "K24": ("cannery", 985, 300),
    "K25": ("cannery", 950, 365),
    "A26": ("tides", 955, 665), "A27": ("tides", 1080, 672),
    "E23": ("prism", 1040, 470), "E24": ("prism", 1110, 430), "E25": ("prism", 1120, 520),
}

# The shore, west to east: land above, sea below. A harbour bay under the dock, a headland for the
# lighthouse, a cove for the boatyard, then the flats where the tide tables are kept.
SHORE = [(0, 430), (80, 442), (160, 425), (240, 440), (320, 478), (360, 525), (410, 565), (470, 578), (530, 562),
         (570, 575), (605, 612), (645, 642), (690, 648), (725, 618), (745, 575), (785, 568), (830, 612), (875, 615),
         (915, 590), (960, 600), (1010, 622), (1075, 612), (1135, 580), (1200, 572)]


def _smooth(pts: list, close_to=None) -> str:
    """Catmull-Rom through the points, as cubic Bezier segments."""
    d = [f"M{pts[0][0]:.1f},{pts[0][1]:.1f}"]
    for i in range(len(pts) - 1):
        p0, p1, p2 = pts[max(i - 1, 0)], pts[i], pts[i + 1]
        p3 = pts[min(i + 2, len(pts) - 1)]
        c1 = (p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6)
        c2 = (p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6)
        d.append(f"C{c1[0]:.1f},{c1[1]:.1f} {c2[0]:.1f},{c2[1]:.1f} {p2[0]:.1f},{p2[1]:.1f}")
    if close_to:
        d.append(close_to)
    return " ".join(d)


def _soundings() -> str:
    """Depth lines: the shore pushed out to sea in steps, each fainter, the chart's fine line-work."""
    out = []
    for k in range(1, 9):
        dy = k * 15 + k * k * 1.5
        pts = [(x, y + dy + 6 * math.sin(x / 70 + k)) for x, y in SHORE]
        out.append(f'<path d="{_smooth(pts)}" class="cm-sea" style="opacity:{0.42 - k * 0.04:.2f}"/>')
    return "".join(out)


def _hill() -> str:
    """Height lines on the hill: nested, slightly irregular rings."""
    cx, cy = PLACES["hill"][3]
    out = []
    for k in range(1, 8):
        rx, ry = 40 + k * 26, 24 + k * 15
        pts = [(cx + 10 + rx * math.cos(t / 24 * math.tau) * (1 + 0.06 * math.sin(3 * t / 24 * math.tau + k)),
                cy + ry * math.sin(t / 24 * math.tau)) for t in range(25)]
        out.append(f'<path d="{_smooth(pts)}Z" class="cm-land" style="opacity:{0.34 - k * 0.03:.2f}"/>')
    return "".join(out)


def _marks() -> str:
    """One small line drawing per place."""
    x, y = PLACES["light"][3]
    tower = (f'<path d="M{x-11},{y+38} L{x-6},{y-6} L{x+6},{y-6} L{x+11},{y+38} Z M{x-8},{y-6} h16 v-9 h-16 Z M{x-4},{y-15} l4,-7 l4,7"/>'
             f'<path class="cm-beam" d="M{x},{y-11} L{x-260},{y-60} L{x-250},{y-30} Z"/>')
    dx, dy = PLACES["dock"][3]
    dock = f'<path d="M{dx-70},{dy+40} h120 M{dx-60},{dy+40} v14 M{dx-20},{dy+40} v14 M{dx+20},{dy+40} v14 M{dx-50},{dy-8} h44 v26 h-44 Z M{dx-54},{dy-8} l26,-14 l26,14"/>'
    bx, by = PLACES["boatyard"][3]
    boat = f'<path d="M{bx-30},{by+8} q30,22 60,0 Z M{bx},{by+8} v-30 l18,22 h-18"/>'
    kx, ky = PLACES["cannery"][3]
    cannery = f'<path d="M{kx-45},{ky+20} v-22 l15,-12 v12 l15,-12 v12 l15,-12 v12 l15,-12 v12 l15,-12 v34 Z M{kx+20},{ky-10} v-22 h7 v18"/>'
    tx, ty = PLACES["tides"][3]
    tide = "".join(f'<path d="M{tx-40+i*16},{ty-14} v32 M{tx-40},{ty-14+i*8} h64"/>' for i in range(5))
    px, py = PLACES["prism"][3]
    prism = f'<path d="M{px-18},{py+14} L{px},{py-18} L{px+18},{py+14} Z"/>'
    return f'<g class="cm-mark" aria-hidden="true">{tower}{dock}{boat}{cannery}{tide}{prism}</g>'


def _paths(le: dict) -> str:
    """Lit paths into one lesson: a faint curve from each lesson that helps first."""
    _, x2, y2 = LIGHTS[le["id"]]
    out = []
    for need in le["needs"]:
        _, x1, y1 = LIGHTS[need]
        mx, my = (x1 + x2) / 2, (y1 + y2) / 2 - 0.12 * abs(x2 - x1) - 8
        out.append(f'<path d="M{x1},{y1} Q{mx:.0f},{my:.0f} {x2},{y2}"/>')
    return f'<g data-to="{le["id"]}">{"".join(out)}</g>'


def _place_labels() -> str:
    out = []
    spots = {"hill": (40, 62), "dock": (300, 640), "light": (545, 380), "boatyard": (770, 668), "cannery": (790, 140),
             "tides": (900, 734), "prism": (965, 395)}
    for key, (name, guide, _, _) in PLACES.items():
        x, y = spots[key]
        out.append(f'<text x="{x}" y="{y}" class="cm-place">{E(name)}<tspan x="{x}" dy="20" class="cm-guide">{GUIDE[guide]}</tspan></text>')
    return f'<g aria-hidden="true">{"".join(out)}</g>'


def _tip(le: dict) -> str:
    return f"{le['id']}: {le['title']}" + ("" if le.get("href") else " (planned, not made yet)")


def _lights(cur: dict) -> str:
    """Three layers, so a name is never under a light: the paths, the lights, then the names.
    Pointing at a light (or tabbing to it) lights its paths and shows its name, through :has()."""
    paths, lights, names, rules = [], [], [], []
    for le in cur["lessons"]:
        i, (_, x, y) = le["id"], LIGHTS[le["id"]]
        live, tip = bool(le.get("href")), _tip(le)
        paths.append(_paths(le))
        w = 12 + 8.3 * len(tip)
        tx = min(max(x - w / 2, 4), W - w - 4)
        ty = y - 46 if y > 70 else y + 22
        names.append(f'<g class="cm-name" data-for="{i}"><rect x="{tx:.0f}" y="{ty}" width="{w:.0f}" height="28" rx="3"/>'
                     f'<text x="{tx + 6:.0f}" y="{ty + 19}">{E(tip)}</text></g>')
        dot = (f'<circle cx="{x}" cy="{y}" r="17" class="cm-halo"/><circle cx="{x}" cy="{y}" r="6.5" class="cm-lit"/>' if live
               else f'<circle cx="{x}" cy="{y}" r="6.5" class="cm-unlit"/>')
        inner = f'<circle cx="{x}" cy="{y}" r="22" class="cm-hit"/>{dot}<text x="{x + 12}" y="{y + 5}" class="cm-id">{i}</text>'
        if live:
            lights.append(f'<a href="{le["href"]}" data-id="{i}" aria-label="{E(tip)}">{inner}</a>')
        else:
            lights.append(f'<g class="cm-planned" data-id="{i}" role="img" aria-label="{E(tip)}">{inner}</g>')
        on = f'.cm:has([data-id="{i}"]:is(:hover,:focus-visible))'
        rules.append(f'{on} [data-for="{i}"]{{opacity:1}}{on} [data-to="{i}"] path{{opacity:.85;stroke-width:1.6}}')
    return (f'<style>{"".join(rules)}</style><g class="cm-path" aria-hidden="true">{"".join(paths)}</g>'
            f'<g class="cm-lights">{"".join(lights)}</g><g class="cm-names" aria-hidden="true">{"".join(names)}</g>')


def coast_svg(cur: dict) -> str:
    missing = [le["id"] for le in cur["lessons"] if le["id"] not in LIGHTS]
    if missing:
        raise SystemExit(f"coast map: no light placed for {', '.join(missing)}")
    land = _smooth(SHORE, f"L{W},0 L0,0 Z")
    return (f'<svg class="cm" viewBox="0 0 {W} {H}" role="group" aria-labelledby="cm-t" xmlns="http://www.w3.org/2000/svg">'
            f'<title id="cm-t">The Lantern Coast: Night School\'s lessons as lights along one shore</title>'
            f'<path d="{land}" class="cm-ground" aria-hidden="true"/>'
            f'<path d="{_smooth(SHORE)}" class="cm-shore" aria-hidden="true"/>'
            f'<g aria-hidden="true">{_soundings()}{_hill()}</g>{_marks()}{_place_labels()}{_lights(cur)}</svg>')


def place_list(cur: dict) -> str:
    """The same map as text: each place, its guide, and its lessons in order, every one linked."""
    out = []
    for key, (name, guide, track, _) in PLACES.items():
        items = []
        for le in cur["lessons"]:
            if LIGHTS[le["id"]][0] != key:
                continue
            t = f'<a class="inline" href="{le["href"]}">{E(le["title"])}</a>' if le.get("href") else f'{E(le["title"])} <span class="sc-status">planned, not made yet</span>'
            items.append(f'<li><span class="sc-id">{le["id"]}</span> {t}</li>')
        out.append(f'<section class="cm-where" aria-labelledby="p-{key}"><h3 id="p-{key}">{E(name)}</h3>'
                   f'<p class="sc-place">{GUIDE[guide]}</p><ol class="cm-list">{"".join(items)}</ol></section>')
    return "\n".join(out)


def coast_page(cur: dict) -> str:
    n = len(cur["lessons"])
    k = sum(1 for le in cur["lessons"] if le.get("href"))
    desc = "Night School's lessons drawn as lights along one coast at night. Every light links to its lesson; faint paths join the lessons that help first."
    body = f"""<div class="frame">
  <div class="bar"><span class="nm">Zain Dana Harper</span><span class="rt"><a class="inline" href="night-school.html">night school</a> / the coast</span></div>
  <div class="mid">
    <h1>The Lantern Coast. <span class="g">Every lesson is a light on the shore.</span></h1>
    <p class="lede">Night School's {n} lessons, drawn where they happen: the hill where Pylon rolls a ball downhill, the dock and the lighthouse where language models are built, the boatyard, the cannery, the tide tables and Rerun's prism. A filled light is a lesson you can open now; a hollow one is planned. The faint paths join each lesson to the ones that help first. Nothing is locked.</p>
  </div>
</div>

<main id="main">
<section class="mv" id="map" aria-labelledby="map-h">
  <h2 id="map-h">The map</h2>
  <p class="body-text">{k} of {n} lights are lit. Point at a light, or move to it with the Tab key, to read its lesson; press it to go there. The same map is written out below.</p>
  <figure class="cm-fig">{coast_svg(cur)}</figure>
</section>

<section class="mv" id="places" aria-labelledby="places-h">
  <h2 id="places-h">The places and their lessons</h2>
  <p class="body-text">The same coast as a list, place by place along the shore from west to east. For the order to take them in, start with <a class="inline" href="night-school.html#start">the school page</a>.</p>
  {place_list(cur)}
</section>
</main>
"""
    return (head("night-school-coast.html", "The Lantern Coast: Night School's map", desc, "img/og/p/night-school-coast.jpg",
                 "The Lantern Coast, by Zain Dana Harper: Night School's lessons as lights along a coast drawn in fine lines.")
            .replace("</head>", '<link rel="stylesheet" href="system/school/coast.css?v=20261016-coast-1">\n</head>', 1)
            + body + foot("Night School: the Lantern Coast."))


def main() -> None:
    cur = json.loads((SCHOOL / "curriculum.json").read_text(encoding="utf-8"))
    (ROOT / "night-school-coast.html").write_text(coast_page(cur), encoding="utf-8", newline="\n")
    print("night-school-coast.html")


if __name__ == "__main__":
    main()
