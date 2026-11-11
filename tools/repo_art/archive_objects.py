"""The archive's objects as link-card pictures: each object page's card shows the scan the page is about.

Pure data and pure functions. Every scan is public domain or CC0 and is credited on
world/exhibit/credits.html (the Dore and Muybridge plates on credits.html). The card crops the
scan and never redraws it. Two grey concrete textures are printed lighter (TREAT gives the gain),
so they read on a dark card; the scans on disk are untouched.

An object page is titled with its source's file name ("Concrete Layers 02"). NAMES gives the name
a card shows in its place, written from that title and from what the scan shows.

Layouts: "foot" for a wide scan (it fills the card above the title), "sheet" for a flat grey texture (a cut sheet of it leans
over a sheet of colour), "side" for a texture (it
fills the card behind the title), "plate" for an upright sheet (it stands down the right of the
card, cut from the top so a masthead or headline stays in view).
"""

from __future__ import annotations

import re
from pathlib import Path

EXHIBIT = "world/exhibit/assets/img/{0}.jpg"
SHELL = "world/ui/assets/{0}-1600.webp"

# key: (layout, anchor down the scan's height for the crop, what the picture shows)
OBJECTS = {
    "bread-line-bowery": ("foot", 0.55, "A glass-plate photograph of men in dark coats and hats standing in a long line under an iron awning on the Bowery."),
    "broadside-ballad": ("plate", 0.0, "A printed broadside in two columns of verse, its heading set in italic across the top."),
    "concrete-layers": ("sheet", 5.0, "A grey concrete wall cast in horizontal layers, with the board marks showing."),
    "concrete-worn": ("sheet", -6.0, "A dark concrete floor worn smooth, crossed by fine scratches."),
    "famine-bangalore": ("foot", 0.5, "A wood engraving from 1877: the gate and stone colonnade of a relief building in Bangalore, with a tree behind the wall."),
    "gods-word": ("plate", 0.5, "A woodcut of Justice holding a balance in a crowd of clergy and laymen, under a heading in blackletter."),
    "heart-ani": ("foot", 0.6, "A painted papyrus: Anubis kneels at a tall balance weighing a heart against a feather, with a row of seated gods above."),
    "heart-hunefer": ("foot", 0.45, "A painted papyrus: Anubis steadies a balance under columns of hieroglyphs while the devourer waits beside it."),
    "hessian": ("side", 0.5, "Coarse hessian cloth, its tan threads woven in an open grid."),
    "hohenzollerns": ("plate", 0.0, "A newspaper advertisement headed Spring Leaders for the book The Hohenzollerns in America, in heavy sans capitals."),
    "justice-etching": ("plate", 0.12, "An etching of a woman in a feathered hat and lace collar holding a sword upright and a small pair of scales."),
    "munchausen-dore": ("plate", 0.0, "An engraving of a bust of Baron Munchausen with a hooked nose, a curled wig and a pointed moustache."),
    "muybridge-758": ("foot", 0.4, "Rows of small photographs of a cockatoo in flight, each frame a moment later than the last."),
    "neratja": ("plate", 0.0, "The front page of the newspaper Neratja, its name in heavy black capitals above columns of small type."),
    "newspad-vaudeville": ("plate", 0.0, "A newspaper column advertising a vaudeville bill, headed New Novelty, The Big Show This Week."),
    "preanger": ("plate", 0.0, "The front page of De Preangerbode, its masthead in rounded capitals above five columns of type."),
    "rust-metal": ("side", 0.5, "A sheet of steel covered in brown rust, with patches of blue-grey metal showing through."),
    "telegrapher": ("plate", 0.0, "The front page of The Railroad Telegrapher, an ornate engraved masthead above three small cartoons of a man at a telegraph key."),
    "vrije-woord": ("plate", 0.0, "The front page of Het Vrije Woord, its name in a ruled panel above a boxed notice and two columns of type."),
    "wanted-booth": ("plate", 0.0, "A War Department broadside of 1865 with three small portraits above the words $100,000 reward, the murderer."),
    "wanted-mcdonald": ("plate", 0.0, "An Aberdeenshire Constabulary wanted notice on yellowed paper, with an engraved portrait of a bearded man beside the text."),
    "wanted-stephens": ("plate", 0.0, "A Police Gazette sheet headed Hue-and-Cry under a royal crest, with a proclamation offering one thousand pounds."),
    "wilnaer": ("plate", 0.0, "The front page of the Wilnaer Zeitung on tan paper, its blackletter masthead around a mounted knight."),
}

# What a card does to a scan beyond the plain cut. crop: the part used, as shares of width and height.
# The famine engraving is cut to the building and its gate, so no starving figure shows in a link preview;
# the page itself shows the whole plate. gain: exposure and contrast. under: the colour of the sheet beneath.
TREAT = {
    "concrete-layers": {"gain": 1.3, "under": "yellow"},
    "concrete-worn": {"gain": 1.75, "under": "red"},
    "famine-bangalore": {"crop": (0.334, 0.008, 0.871, 0.214)},
}

NAMES = {
    "broadside-ballad": "A Huy and Cry After Sir John Barlycorn, broadside ballad",
    "concrete-layers": "Concrete, cast in layers",
    "concrete-worn": "Concrete floor, worn smooth",
    "famine-bangalore": "Waiting for relief in Bangalore, 1877",
    "gods-word": "The weight of God's word against man's traditions",
    "heart-ani": "The weighing of the heart, Papyrus of Ani",
    "heart-hunefer": "The weighing of the heart, Papyrus of Hunefer",
    "hessian": "Hessian cloth",
    "hohenzollerns": "The Hohenzollerns in America, newspaper advertisement",
    "justice-etching": "Justice with a sword and a balance, etching",
    "munchausen-dore": "Baron Munchausen, Gustave Doré, 1862",
    "neratja": "Neratja, 26 October 1918",
    "newspad-vaudeville": "Vaudeville bill in a Kansas newspaper, 1908",
    "preanger": "De Preangerbode, 4 November 1918",
    "rust-metal": "Rusted steel",
    "telegrapher": "The Railroad Telegrapher, front page",
    "vrije-woord": "Het Vrije Woord, 16 November 1918",
    "wanted-booth": "Wanted poster for John Wilkes Booth, 1865",
    "wanted-mcdonald": "Wanted poster for William McDonald",
    "wanted-stephens": "Wanted poster for James Stephens",
    "wilnaer": "Wilnaer Zeitung, front page"  # the source record says 12 April 1918; the masthead in the scan reads 1917, so the card gives no date,
}

OBJECT_SLUG = re.compile(r"(?:^|--)obj-([a-z0-9-]+)$")


def object_key(slug: str) -> str | None:
    """The object a card slug names, when the slug is an archive object page and the object is known."""
    m = OBJECT_SLUG.search(slug)
    return m.group(1) if m and m.group(1) in OBJECTS else None


def object_work(slug: str, root: Path) -> tuple[str, str, str, float] | None:
    """(scan path, alt, layout, anchor) for an archive object page whose scan is in the repository."""
    key = object_key(slug)
    if key is None:
        return None
    layout, anchor, alt = OBJECTS[key]
    path = next((t.format(key) for t in (EXHIBIT, SHELL) if (root / t.format(key)).exists()), None)
    return (path, alt, layout, anchor) if path else None


def object_name(slug: str) -> str | None:
    """The name a card shows for an archive object, when its page title is a source file name."""
    return NAMES.get(object_key(slug) or "")


def object_treat(slug: str) -> dict:
    return dict(TREAT.get(object_key(slug) or "", {}))
