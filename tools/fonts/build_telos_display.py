from __future__ import annotations

import argparse
import math
from pathlib import Path

from fontTools.fontBuilder import FontBuilder
from fontTools.pens.ttGlyphPen import TTGlyphPen


CONSTRUCTION = "soft-technical-contour"
FONT_VERSION = "0.4.0"
BUILD_ID = "2026-07-09.4"

UNITS_PER_EM = 1000
ASCENT = 860
DESCENT = -220
ADVANCE = 760
WIDE_ADVANCE = 860
NARROW_ADVANCE = 430
STROKE = 88
CORNER_RADIUS = 34
TERMINAL_RADIUS = 44


PUNCT_NAMES = {
    ".": "period",
    ",": "comma",
    ":": "colon",
    ";": "semicolon",
    "/": "slash",
    "+": "plus",
    "-": "hyphen",
    "&": "ampersand",
    "(": "parenleft",
    ")": "parenright",
    "[": "bracketleft",
    "]": "bracketright",
    "?": "question",
    "!": "exclam",
    "'": "quotesingle",
    '"': "quotedbl",
    "@": "at",
    "#": "numbersign",
    "$": "dollar",
    "%": "percent",
    "*": "asterisk",
    "=": "equal",
    "_": "underscore",
    "<": "less",
    ">": "greater",
    "{": "braceleft",
    "}": "braceright",
    "|": "bar",
    "~": "asciitilde",
}

DIGIT_NAMES = {
    "0": "zero",
    "1": "one",
    "2": "two",
    "3": "three",
    "4": "four",
    "5": "five",
    "6": "six",
    "7": "seven",
    "8": "eight",
    "9": "nine",
}


SOFT_STROKES = {
    # Uppercase bars and stems.
    "bar_top": ("rr", 126, 624, 508, STROKE, 38),
    "bar_top_short": ("rr", 126, 624, 420, STROKE, 38),
    "bar_mid": ("rr", 126, 318, 508, 82, 34),
    "bar_mid_short": ("rr", 216, 318, 328, 78, 32),
    "bar_bottom": ("rr", 126, 12, 508, STROKE, 38),
    "bar_bottom_short": ("rr", 216, 12, 328, STROKE, 38),
    "left_full": ("rr", 78, 28, 86, 672, 40),
    "left_upper": ("rr", 78, 356, 86, 344, 40),
    "left_lower": ("rr", 78, 28, 86, 346, 40),
    "right_full": ("rr", 596, 28, 86, 672, 40),
    "right_upper": ("rr", 596, 356, 86, 344, 40),
    "right_lower": ("rr", 596, 28, 86, 346, 40),
    "center_full": ("rr", 337, 28, 86, 672, 40),
    "center_upper": ("rr", 337, 356, 86, 344, 40),
    "center_lower": ("rr", 337, 28, 86, 346, 40),
    "curve_s": ("cap", 164, 594, 572, 164, 72),
    "five_open_stem": ("rr", 88, 402, 92, 284, 36),
    "b_bowl_soft": ("cap", 548, 582, 640, 454, 72),
    "eight_waist": ("oval", 318, 278, 124, 124),
    "diag_a_left": ("cap", 128, 42, 318, 698, 90),
    "diag_a_right": ("cap", 632, 42, 442, 698, 90),
    "diag_down": ("cap", 630, 660, 130, 54, 88),
    "diag_up": ("cap", 130, 54, 630, 660, 88),
    "diag_k_up": ("cap", 162, 344, 628, 682, 88),
    "diag_k_down": ("cap", 164, 348, 632, 30, 88),
    "diag_v_left": ("cap", 116, 690, 380, 32, 94),
    "diag_v_right": ("cap", 644, 690, 380, 32, 94),
    "diag_y_left": ("cap", 116, 690, 380, 352, 88),
    "diag_y_right": ("cap", 644, 690, 380, 352, 88),
    "diag_m_left": ("cap", 154, 690, 380, 346, 78),
    "diag_m_right": ("cap", 606, 690, 380, 346, 78),
    "diag_n": ("cap", 150, 672, 610, 46, 84),
    "tail_q": ("cap", 448, 154, 692, -112, 76),
    "one_flag": ("cap", 264, 608, 380, 706, 78),
    "zero_slash": ("cap", 560, 642, 202, 70, 62),
    "w_inner_left": ("cap", 116, 42, 380, 272, 82),
    "w_inner_right": ("cap", 644, 42, 380, 272, 82),
    # Native lowercase.
    "lc_top": ("rr", 152, 452, 386, 74, 32),
    "lc_mid": ("rr", 152, 230, 386, 72, 30),
    "lc_bottom": ("rr", 152, 20, 386, 74, 32),
    "lc_left": ("rr", 112, 20, 78, 506, 34),
    "lc_left_upper": ("rr", 112, 260, 78, 266, 34),
    "lc_left_lower": ("rr", 112, 20, 78, 272, 34),
    "lc_right": ("rr", 500, 20, 78, 506, 34),
    "lc_right_upper": ("rr", 500, 260, 78, 266, 34),
    "lc_right_lower": ("rr", 500, 20, 78, 272, 34),
    "lc_center": ("rr", 306, 20, 78, 506, 34),
    "asc_left": ("rr", 112, 20, 78, 682, 34),
    "asc_right": ("rr", 500, 20, 78, 682, 34),
    "asc_center": ("rr", 306, 20, 78, 682, 34),
    "desc_left": ("rr", 112, -126, 78, 652, 34),
    "desc_right": ("rr", 500, -126, 78, 652, 34),
    "lc_dot": ("oval", 298, 626, 104, 104),
    "lc_a_bowl": ("cap", 158, 448, 120, 72, 68),
    "lc_e_crossbar": ("rr", 164, 242, 346, 68, 28),
    "lc_f_hook": ("cap", 338, 696, 458, 642, 72),
    "lc_f_bar": ("rr", 188, 438, 350, 70, 30),
    "lc_g_tail": ("cap", 500, 40, 284, -126, 76),
    "lc_j_tail": ("cap", 344, 34, 168, -126, 76),
    "lc_r_terminal": ("cap", 184, 454, 486, 404, 72),
    "lc_t_bar": ("rr", 188, 438, 350, 70, 30),
    "lc_t_foot": ("cap", 344, 46, 504, 30, 68),
    "lc_v_left": ("cap", 128, 508, 340, 24, 82),
    "lc_v_right": ("cap", 552, 508, 340, 24, 82),
    "lc_x_down": ("cap", 528, 500, 156, 34, 78),
    "lc_x_up": ("cap", 156, 34, 528, 500, 78),
    "lc_y_left": ("cap", 128, 508, 340, 132, 78),
    "lc_y_right": ("cap", 552, 508, 340, 132, 78),
    "lc_y_tail": ("cap", 340, 132, 230, -126, 76),
    "lc_z_diag": ("cap", 524, 486, 156, 52, 78),
    "lc_m_left": ("rr", 84, 20, 76, 506, 34),
    "lc_m_center": ("rr", 360, 20, 76, 506, 34),
    "lc_m_right": ("rr", 636, 20, 76, 506, 34),
    "lc_m_arch_left": ("cap", 132, 500, 360, 310, 70),
    "lc_m_arch_right": ("cap", 408, 500, 636, 310, 70),
    "lc_w_left": ("cap", 96, 508, 248, 24, 78),
    "lc_w_mid_left": ("cap", 248, 24, 402, 302, 72),
    "lc_w_mid_right": ("cap", 402, 302, 556, 24, 72),
    "lc_w_right": ("cap", 708, 508, 556, 24, 78),
}


PATTERNS = {
    "A": ["diag_a_left", "diag_a_right", "bar_mid_short"],
    "B": ["left_full", "bar_top", "bar_mid", "bar_bottom", "right_upper", "right_lower", "b_bowl_soft"],
    "C": ["left_full", "bar_top", "bar_bottom"],
    "D": ["left_full", "bar_top", "bar_bottom", "right_full"],
    "E": ["left_full", "bar_top", "bar_mid", "bar_bottom"],
    "F": ["left_full", "bar_top", "bar_mid"],
    "G": ["left_full", "bar_top", "bar_bottom", "right_lower", "bar_mid_short"],
    "H": ["left_full", "right_full", "bar_mid"],
    "I": ["bar_top_short", "bar_bottom_short", "center_full"],
    "J": ["right_full", "bar_bottom", "left_lower"],
    "K": ["left_full", "diag_k_up", "diag_k_down"],
    "L": ["left_full", "bar_bottom"],
    "M": ["left_full", "right_full", "diag_m_left", "diag_m_right"],
    "N": ["left_full", "right_full", "diag_n"],
    "O": ["left_full", "right_full", "bar_top", "bar_bottom"],
    "P": ["left_full", "bar_top", "bar_mid", "right_upper"],
    "Q": ["left_full", "right_full", "bar_top", "bar_bottom", "tail_q"],
    "R": ["left_full", "bar_top", "bar_mid", "right_upper", "diag_k_down"],
    "S": ["bar_top", "bar_mid", "bar_bottom", "left_upper", "right_lower", "curve_s"],
    "T": ["bar_top", "center_full"],
    "U": ["left_full", "right_full", "bar_bottom"],
    "V": ["diag_v_left", "diag_v_right"],
    "W": ["diag_v_left", "diag_v_right", "w_inner_left", "w_inner_right"],
    "X": ["diag_down", "diag_up"],
    "Y": ["diag_y_left", "diag_y_right", "center_lower"],
    "Z": ["bar_top", "bar_bottom", "diag_down"],
    "0": ["left_full", "right_full", "bar_top", "bar_bottom", "zero_slash"],
    "1": ["center_full", "one_flag", "bar_bottom_short"],
    "2": ["bar_top", "right_upper", "bar_mid", "left_lower", "bar_bottom"],
    "3": ["bar_top", "right_full", "bar_mid", "bar_bottom"],
    "4": ["left_upper", "right_full", "bar_mid"],
    "5": ["bar_top", "five_open_stem", "bar_mid", "right_lower", "bar_bottom"],
    "6": ["left_full", "bar_top", "bar_mid", "right_lower", "bar_bottom"],
    "7": ["bar_top", "diag_down"],
    "8": ["left_full", "right_full", "bar_top", "bar_mid", "bar_bottom", "eight_waist"],
    "9": ["left_upper", "right_full", "bar_top", "bar_mid", "bar_bottom"],
}


LOWERCASE_PATTERNS = {
    "a": ["lc_a_bowl", "lc_top", "lc_mid", "lc_bottom", "lc_right"],
    "b": ["asc_left", "lc_top", "lc_mid", "lc_bottom", "lc_right"],
    "c": ["lc_left", "lc_top", "lc_bottom"],
    "d": ["asc_right", "lc_left", "lc_top", "lc_mid", "lc_bottom"],
    "e": ["lc_left", "lc_top", "lc_e_crossbar", "lc_bottom"],
    "f": ["asc_center", "lc_f_hook", "lc_f_bar"],
    "g": ["lc_left", "lc_right", "lc_top", "lc_mid", "lc_bottom", "lc_g_tail"],
    "h": ["asc_left", "lc_mid", "lc_right"],
    "i": ["lc_dot", "asc_center"],
    "j": ["lc_dot", "desc_right", "lc_j_tail"],
    "k": ["asc_left", "lc_x_up", "lc_x_down"],
    "l": ["asc_center"],
    "m": ["lc_m_left", "lc_m_center", "lc_m_right", "lc_m_arch_left", "lc_m_arch_right"],
    "n": ["lc_left", "lc_mid", "lc_right"],
    "o": ["lc_left", "lc_right", "lc_top", "lc_bottom"],
    "p": ["desc_left", "lc_top", "lc_mid", "lc_bottom", "lc_right"],
    "q": ["desc_right", "lc_left", "lc_top", "lc_mid", "lc_bottom"],
    "r": ["lc_left", "lc_mid", "lc_r_terminal"],
    "s": ["lc_top", "lc_mid", "lc_bottom", "lc_left_upper", "lc_right_lower"],
    "t": ["asc_center", "lc_t_bar", "lc_t_foot"],
    "u": ["lc_left", "lc_right", "lc_bottom"],
    "v": ["lc_v_left", "lc_v_right"],
    "w": ["lc_w_left", "lc_w_mid_left", "lc_w_mid_right", "lc_w_right"],
    "x": ["lc_x_down", "lc_x_up"],
    "y": ["lc_y_left", "lc_y_right", "lc_y_tail"],
    "z": ["lc_top", "lc_bottom", "lc_z_diag"],
}


def profile_for_char(char: str) -> str:
    if char in LOWERCASE_PATTERNS:
        return "lowercase-native"
    if char.upper() in PATTERNS:
        return "uppercase-recipe"
    if char in PUNCT_NAMES:
        return "punctuation"
    if char == " ":
        return "space"
    return "empty"


def shapes_for_char(char: str) -> list:
    if char in LOWERCASE_PATTERNS:
        return list(LOWERCASE_PATTERNS[char])
    source = char.upper() if char.isalpha() else char
    return list(PATTERNS.get(source, []))


def glyph_name(char: str) -> str:
    if char == " ":
        return "space"
    if char.isdigit():
        return DIGIT_NAMES[char]
    if char in PUNCT_NAMES:
        return PUNCT_NAMES[char]
    return char


def tx(
    x: float,
    y: float,
    *,
    sx: float = 1.0,
    sy: float = 1.0,
    ox: float = 0.0,
    oy: float = 0.0,
) -> tuple[int, int]:
    return (round(ox + x * sx), round(oy + y * sy))


def add_round_rect(
    pen: TTGlyphPen,
    x: float,
    y: float,
    width: float,
    height: float,
    radius: float = CORNER_RADIUS,
    *,
    sx: float = 1.0,
    sy: float = 1.0,
    ox: float = 0.0,
    oy: float = 0.0,
) -> None:
    x0 = ox + x * sx
    y0 = oy + y * sy
    x1 = ox + (x + width) * sx
    y1 = oy + (y + height) * sy
    r = min(abs(radius * (sx + sy) * 0.5), abs(x1 - x0) / 2, abs(y1 - y0) / 2)

    pen.moveTo((round(x0 + r), round(y0)))
    pen.lineTo((round(x1 - r), round(y0)))
    pen.qCurveTo((round(x1), round(y0)), (round(x1), round(y0 + r)))
    pen.lineTo((round(x1), round(y1 - r)))
    pen.qCurveTo((round(x1), round(y1)), (round(x1 - r), round(y1)))
    pen.lineTo((round(x0 + r), round(y1)))
    pen.qCurveTo((round(x0), round(y1)), (round(x0), round(y1 - r)))
    pen.lineTo((round(x0), round(y0 + r)))
    pen.qCurveTo((round(x0), round(y0)), (round(x0 + r), round(y0)))
    pen.closePath()


def add_oval(
    pen: TTGlyphPen,
    x: float,
    y: float,
    width: float,
    height: float,
    *,
    sx: float = 1.0,
    sy: float = 1.0,
    ox: float = 0.0,
    oy: float = 0.0,
) -> None:
    x0 = ox + x * sx
    y0 = oy + y * sy
    x1 = ox + (x + width) * sx
    y1 = oy + (y + height) * sy
    cx = (x0 + x1) / 2
    cy = (y0 + y1) / 2

    pen.moveTo((round(cx), round(y0)))
    pen.qCurveTo((round(x1), round(y0)), (round(x1), round(cy)))
    pen.qCurveTo((round(x1), round(y1)), (round(cx), round(y1)))
    pen.qCurveTo((round(x0), round(y1)), (round(x0), round(cy)))
    pen.qCurveTo((round(x0), round(y0)), (round(cx), round(y0)))
    pen.closePath()


def add_soft_segment(
    pen: TTGlyphPen,
    x1: float,
    y1: float,
    x2: float,
    y2: float,
    width: float,
    *,
    sx: float = 1.0,
    sy: float = 1.0,
    ox: float = 0.0,
    oy: float = 0.0,
) -> None:
    ax = ox + x1 * sx
    ay = oy + y1 * sy
    bx = ox + x2 * sx
    by = oy + y2 * sy
    dx = bx - ax
    dy = by - ay
    length = math.hypot(dx, dy) or 1.0
    half = width * (sx + sy) * 0.25
    txv = dx / length
    tyv = dy / length
    nx = -tyv * half
    ny = txv * half
    cap = min(half, length * 0.24)

    start_left = (round(ax + nx), round(ay + ny))
    end_left = (round(bx + nx - txv * cap), round(by + ny - tyv * cap))
    end_ctrl = (round(bx + txv * cap), round(by + tyv * cap))
    end_right = (round(bx - nx - txv * cap), round(by - ny - tyv * cap))
    start_right = (round(ax - nx + txv * cap), round(ay - ny + tyv * cap))
    start_ctrl = (round(ax - txv * cap), round(ay - tyv * cap))

    pen.moveTo(start_left)
    pen.lineTo(end_left)
    pen.qCurveTo(end_ctrl, end_right)
    pen.lineTo(start_right)
    pen.qCurveTo(start_ctrl, start_left)
    pen.closePath()


def add_shape(
    pen: TTGlyphPen,
    shape,
    *,
    sx: float = 1.0,
    sy: float = 1.0,
    ox: float = 0.0,
    oy: float = 0.0,
) -> None:
    primitive = SOFT_STROKES[shape] if isinstance(shape, str) else shape
    kind = primitive[0]
    if kind == "rr":
        _, x, y, width, height, radius = primitive
        add_round_rect(pen, x, y, width, height, radius, sx=sx, sy=sy, ox=ox, oy=oy)
    elif kind == "cap":
        _, x1, y1, x2, y2, width = primitive
        add_soft_segment(pen, x1, y1, x2, y2, width, sx=sx, sy=sy, ox=ox, oy=oy)
    elif kind == "oval":
        _, x, y, width, height = primitive
        add_oval(pen, x, y, width, height, sx=sx, sy=sy, ox=ox, oy=oy)
    else:
        raise ValueError(f"unknown primitive: {kind}")


def empty_glyph():
    return TTGlyphPen(None).glyph()


def build_display_glyph(char: str):
    pen = TTGlyphPen(None)
    if char == " ":
        return pen.glyph()

    if char in LOWERCASE_PATTERNS or char.upper() in PATTERNS or char.isdigit():
        for shape in shapes_for_char(char):
            add_shape(pen, shape)
        return pen.glyph()

    return build_punctuation_glyph(char)


def build_modular_glyph(char: str):
    return build_display_glyph(char)


def build_punctuation_glyph(char: str):
    pen = TTGlyphPen(None)
    if char == ".":
        add_oval(pen, 100, 0, 104, 104)
    elif char == ",":
        add_oval(pen, 108, 14, 104, 104)
        add_soft_segment(pen, 170, 28, 84, -130, 58)
    elif char == ":":
        add_oval(pen, 106, 0, 100, 100)
        add_oval(pen, 106, 402, 100, 100)
    elif char == ";":
        add_oval(pen, 106, 402, 100, 100)
        add_oval(pen, 108, 14, 100, 100)
        add_soft_segment(pen, 170, 28, 84, -130, 58)
    elif char == "/":
        add_soft_segment(pen, 306, 720, 54, -84, 72)
    elif char == "+":
        add_round_rect(pen, 66, 302, 382, 74, 30)
        add_round_rect(pen, 220, 148, 74, 382, 30)
    elif char == "-":
        add_round_rect(pen, 76, 306, 354, 76, 32)
    elif char == "&":
        for shape in ["bar_top_short", "left_upper", "bar_mid", "bar_bottom_short", "right_lower"]:
            add_shape(pen, shape, sx=0.88, sy=0.96, ox=8, oy=0)
        add_soft_segment(pen, 178, 674, 626, 38, 74)
    elif char == "(":
        add_soft_segment(pen, 286, 720, 124, 360, 74)
        add_soft_segment(pen, 124, 360, 286, -80, 74)
    elif char == ")":
        add_soft_segment(pen, 62, 720, 224, 360, 74)
        add_soft_segment(pen, 224, 360, 62, -80, 74)
    elif char == "[":
        add_round_rect(pen, 94, 0, 82, 720, 32)
        add_round_rect(pen, 94, 624, 260, 82, 32)
        add_round_rect(pen, 94, 0, 260, 82, 32)
    elif char == "]":
        add_round_rect(pen, 278, 0, 82, 720, 32)
        add_round_rect(pen, 100, 624, 260, 82, 32)
        add_round_rect(pen, 100, 0, 260, 82, 32)
    elif char == "?":
        for shape in ["bar_top_short", "right_upper", "bar_mid_short"]:
            add_shape(pen, shape, sx=0.78, sy=0.9, ox=16, oy=72)
        add_oval(pen, 282, 0, 98, 98)
    elif char == "!":
        add_round_rect(pen, 184, 208, 94, 512, 38)
        add_oval(pen, 180, 0, 102, 102)
    elif char == "'":
        add_round_rect(pen, 124, 510, 82, 210, 34)
    elif char == '"':
        add_round_rect(pen, 104, 510, 74, 210, 32)
        add_round_rect(pen, 244, 510, 74, 210, 32)
    elif char == "@":
        for shape in ["left_full", "right_full", "bar_top", "bar_bottom", "bar_mid", "right_lower"]:
            add_shape(pen, shape, sx=0.76, sy=0.9, ox=22, oy=44)
        add_round_rect(pen, 274, 232, 146, 74, 30)
    elif char == "#":
        add_round_rect(pen, 84, 230, 422, 74, 28)
        add_round_rect(pen, 64, 426, 422, 74, 28)
        add_soft_segment(pen, 204, 656, 146, 42, 62)
        add_soft_segment(pen, 404, 656, 346, 42, 62)
    elif char == "$":
        for shape in ["bar_top", "bar_mid", "bar_bottom", "left_upper", "right_lower", "center_full"]:
            add_shape(pen, shape, sx=0.78, sy=0.96, ox=20, oy=0)
    elif char == "%":
        add_oval(pen, 76, 538, 118, 118)
        add_oval(pen, 348, 58, 118, 118)
        add_soft_segment(pen, 462, 690, 86, 0, 72)
    elif char == "*":
        add_soft_segment(pen, 92, 360, 454, 360, 66)
        add_soft_segment(pen, 274, 560, 274, 160, 66)
        add_soft_segment(pen, 122, 510, 426, 210, 62)
        add_soft_segment(pen, 426, 510, 122, 210, 62)
    elif char == "=":
        add_round_rect(pen, 78, 420, 376, 72, 28)
        add_round_rect(pen, 78, 220, 376, 72, 28)
    elif char == "_":
        add_round_rect(pen, 42, -84, 430, 72, 28)
    elif char == "<":
        add_soft_segment(pen, 378, 612, 92, 320, 74)
        add_soft_segment(pen, 92, 320, 378, 28, 74)
    elif char == ">":
        add_soft_segment(pen, 96, 612, 382, 320, 74)
        add_soft_segment(pen, 382, 320, 96, 28, 74)
    elif char == "{":
        add_soft_segment(pen, 316, 720, 170, 548, 68)
        add_soft_segment(pen, 170, 548, 170, 392, 68)
        add_soft_segment(pen, 170, 392, 86, 320, 68)
        add_soft_segment(pen, 86, 320, 170, 248, 68)
        add_soft_segment(pen, 170, 248, 170, 72, 68)
        add_soft_segment(pen, 170, 72, 316, -80, 68)
    elif char == "}":
        add_soft_segment(pen, 88, 720, 234, 548, 68)
        add_soft_segment(pen, 234, 548, 234, 392, 68)
        add_soft_segment(pen, 234, 392, 318, 320, 68)
        add_soft_segment(pen, 318, 320, 234, 248, 68)
        add_soft_segment(pen, 234, 248, 234, 72, 68)
        add_soft_segment(pen, 234, 72, 88, -80, 68)
    elif char == "|":
        add_round_rect(pen, 184, -80, 82, 800, 34)
    elif char == "~":
        add_soft_segment(pen, 70, 320, 194, 392, 62)
        add_soft_segment(pen, 194, 392, 318, 302, 62)
        add_soft_segment(pen, 318, 302, 446, 374, 62)
    return pen.glyph()


def glyph_advance(char: str) -> int:
    if char == " ":
        return 330
    if char in ".,:;'!\"":
        return 310
    if char in "ijl|":
        return NARROW_ADVANCE
    if char in "I/+-()[]?=#$_<>~":
        return 560
    if char in "{}@%*&MWmw":
        return WIDE_ADVANCE
    return ADVANCE


def build_font(out_dir: Path) -> tuple[Path, Path]:
    out_dir.mkdir(parents=True, exist_ok=True)
    chars = (
        " "
        + "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
        + "abcdefghijklmnopqrstuvwxyz"
        + "0123456789"
        + ".,:/+-&()[]?!;'\"@#$%*=_<>{}|~"
    )
    glyph_order = [".notdef"] + [glyph_name(char) for char in chars]
    glyphs = {".notdef": empty_glyph()}
    metrics = {".notdef": (ADVANCE, 0)}
    cmap = {}

    for char in chars:
        name = glyph_name(char)
        glyphs[name] = build_display_glyph(char)
        metrics[name] = (glyph_advance(char), 0)
        cmap[ord(char)] = name

    fb = FontBuilder(UNITS_PER_EM, isTTF=True)
    fb.setupGlyphOrder(glyph_order)
    fb.setupCharacterMap(cmap)
    fb.setupGlyf(glyphs)
    fb.setupHorizontalMetrics(metrics)
    fb.setupHorizontalHeader(ascent=ASCENT, descent=DESCENT)
    fb.setupOS2(
        sTypoAscender=ASCENT,
        sTypoDescender=DESCENT,
        sTypoLineGap=80,
        usWinAscent=920,
        usWinDescent=260,
        usWeightClass=740,
        usWidthClass=6,
    )
    fb.setupNameTable(
        {
            "familyName": "Telos Display",
            "styleName": "Regular",
            "uniqueFontIdentifier": f"Telos Display Regular {BUILD_ID}",
            "fullName": "Telos Display",
            "psName": "TelosDisplay-Regular",
            "version": f"Version {FONT_VERSION}",
        }
    )
    fb.setupPost()
    fb.setupMaxp()

    ttf_path = out_dir / "telos-display.ttf"
    woff2_path = out_dir / "telos-display.woff2"
    font = fb.font
    font.save(ttf_path)
    font.flavor = "woff2"
    font.save(woff2_path)
    return ttf_path, woff2_path


def main() -> None:
    parser = argparse.ArgumentParser(description="Build the generated Project Telos display face.")
    parser.add_argument("--out-dir", type=Path, default=Path("system/fonts"))
    args = parser.parse_args()
    ttf_path, woff2_path = build_font(args.out_dir)
    print(f"wrote {ttf_path}")
    print(f"wrote {woff2_path}")


if __name__ == "__main__":
    main()
