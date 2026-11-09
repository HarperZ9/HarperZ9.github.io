"""The archive's objects as link-card pictures: each object page's card shows the scan the page is about.

Pure data and two pure functions. Every scan is public domain or CC0 and is credited on
world/exhibit/credits.html (the Dore and Muybridge plates on credits.html). The card crops the
scan; it never redraws or retouches it.

Layouts: "foot" for a wide scan (it fills the card above the title), "side" for a texture (it
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
    "concrete-layers": ("side", 0.5, "A grey concrete wall cast in horizontal layers, with the board marks showing."),
    "concrete-worn": ("side", 0.5, "A dark concrete floor worn smooth, crossed by fine scratches."),
    "famine-bangalore": ("plate", 0.0, "A wood engraving from 1877 of people waiting for famine relief outside a gated building in Bangalore."),
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
