"""Caption cues for a film, laid out for reading at any window width.

One timing.json row is one spoken sentence with its start and end. Each sentence becomes one or
more cues of at most two lines of at most WIDTH characters, so a player at 1280 px never has to
re-wrap a line and leave a word or two alone on the next one.

Where a line or a cue breaks is chosen by cost over every word boundary:

- a break inside a number phrase ("a hundred and twenty-six thousand") is not allowed;
- a line or cue of one or two words is not allowed when the sentence has more;
- a break after punctuation is preferred, a break after an article or a preposition costs,
  and so does a break between two words of a name;
- the two lines of a cue are kept close in length.

timing.json holds sentence times, not word times. A sentence split into several cues shares its
own span among them in proportion to each part's spoken length (its letters, plus a short pause
for each comma), so a longer part stays up longer. The words, in order, are the sentence's words
exactly; the test in tests/test_explainer_caption_lines.py holds that.
"""

from __future__ import annotations

import re
from functools import lru_cache

WIDTH = 42  # characters per line, the common broadcast limit
LINES = 2  # lines per cue
MIN_WORDS = 3  # a line or a cue holds at least this many words, unless the sentence is shorter

_UNITS = ("zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen "
          "fifteen sixteen seventeen eighteen nineteen twenty thirty forty fifty sixty seventy eighty ninety").split()
_NUMBER = set(_UNITS) | {"hundred", "thousand", "million", "billion", "point", "percent", "half", "dozen",
                         "hundredths", "thousandths", "tenths"}
_SCALE = {"hundred", "thousand", "million", "billion"}
_ARTICLE = {"a", "an", "the"}
_WEAK = {"of", "to", "in", "on", "for", "and", "or", "but", "nor", "with", "by", "at", "from", "as", "into",
         "about", "than", "like", "over", "under", "after", "before", "without", "through", "between", "across",
         "toward", "towards", "among", "per", "against", "within", "around", "since", "up", "out", "off",
         "is", "are", "was", "were", "be", "been", "it", "its", "it's", "this", "that", "these", "those", "your",
         "their", "his", "her", "my", "our", "not", "no", "every", "each", "any", "some", "other", "only", "can",
         "could", "will", "would", "does", "did", "do", "has", "had", "have", "i", "i'm", "you", "we", "they",
         "how", "much", "many", "more", "most", "very", "so", "if", "what", "which", "who", "own", "same"}
_OBJECT = {"you", "it", "them", "me", "us", "him"}
_PREP = {"at", "in", "on", "for", "from", "to", "with", "by", "over", "under", "after", "before", "without",
         "through", "between", "across", "toward", "towards", "among", "against", "within", "around", "since"}
_CLAUSE = {"which", "that", "where", "when", "because", "while", "so", "then", "though", "although", "whether", "until"}
_AUX = {"is", "are", "was", "were", "had", "has", "have", "did", "does", "can", "could", "will", "would",
        "should", "may", "might", "must"}
_UNIT = {"percent", "hundredths", "thousandths", "tenths", "half", "dozen"}
_PARTICLE = {"back", "up", "out", "down", "off", "away"}
# Noun compounds in the films' scripts that a word-level rule cannot see.
_COMPOUND = {("person", "hours"), ("rumor", "cascades"), ("test", "suite"), ("test", "suites"), ("peer", "review"),
             ("literature", "reviews"), ("unit", "tests"), ("reasoning", "model"), ("reasoning", "models"),
             ("preference", "model"), ("preference", "data"), ("catch", "rate"), ("quality", "target"),
             ("position", "paper"), ("passing", "patches"), ("psychology", "studies"), ("psychology", "papers"),
             ("truthful", "answer"), ("real", "bugs"), ("wrong", "answers"), ("real", "fix")}
_PAIRS = {("at", "least"), ("at", "most"), ("more", "than"), ("less", "than"), ("fewer", "than"), ("as", "long"),
          ("such", "as"), ("rather", "than"), ("each", "one"), ("no", "one"), ("every", "one"), ("as", "much")}


def _bare(word: str) -> str:
    return word.lower().strip(".,;:!?\"'()")


def _numeric(word: str) -> bool:
    """A number word or a plain figure ("2023", "3.7"); a name with digits ("GPT-4") is not one."""
    w = _bare(word)
    if re.fullmatch(r"[\d.,%$]+", w):
        return True
    return bool(w) and all(p in _NUMBER for p in w.split("-") if p)


def _capital(word: str) -> bool:
    return word[:1].isupper()


def _break_cost(words: tuple[str, ...], i: int) -> float:
    """Cost of ending a line after words[i]: negative where a reader expects a pause."""
    left, right = words[i], words[i + 1]
    lb, rb = _bare(left), _bare(right)
    nxt = words[i + 2] if i + 2 < len(words) else ""
    if left[-1] in ".?!":
        return -30.0
    if left[-1] in ",;:":
        return -25.0
    cost = 0.0
    # Number phrases stay whole: "six hundred and thirty-six", "a hundred", "two to four".
    # A number too long for one line may break after its scale word, at a cost.
    if _numeric(left) and _numeric(right):
        cost += 250 if lb in _SCALE else 400
    elif _numeric(left) and lb not in _UNIT and rb in {"and", "to", "of"} and _numeric(nxt):
        cost += 60 if rb == "of" else 300 if lb in _SCALE else 400
    elif lb in {"and", "to", "of"} and i > 0 and _numeric(words[i - 1]) and _bare(words[i - 1]) not in _UNIT and _numeric(right):
        cost += 60 if lb == "of" else 400
    elif lb in _ARTICLE and _numeric(right):
        cost += 400
    elif _numeric(left) and lb not in _UNIT:
        cost += 40  # a number stays with what it counts: "six / hours"
    if lb in _ARTICLE or re.search(r"\w('s|s')$", left):
        cost += 100  # "the / claim", "the model's / actions"
    elif (lb, rb) in _PAIRS:
        cost += 150
    elif lb in _WEAK:
        cost += 30
    if i > 0 and _capital(left) and (_capital(right) or _numeric(right)):
        cost += 60  # a name: "Esther Wilder", "Claude 3.7 Sonnet"
    if rb == "and" and _capital(left) and _capital(nxt) or lb == "and" and i > 0 and _capital(words[i - 1]) and _capital(right):
        cost += 60  # two names joined: "Walters and Esther"
    if (lb, rb) in _COMPOUND:
        cost += 80
    if rb in _PARTICLE:
        cost += 50  # "came / back"
    if rb in _OBJECT:
        cost += 20
    if rb in _CLAUSE or rb in _PREP or rb == "of":
        cost -= 5
    if rb in _AUX:
        cost -= 10  # between a subject and its verb
    return cost


def _short(n_words: int, sentence_words: int) -> float:
    """A line or cue of one or two words, when the sentence has more, is an orphan."""
    if n_words >= MIN_WORDS or n_words >= sentence_words:
        return 0.0
    return 600.0 if n_words == 1 else 300.0


def _length(words: tuple[str, ...]) -> int:
    return len(" ".join(words))


def _lines(words: tuple[str, ...], total: int) -> tuple[float, tuple[str, ...]] | None:
    """The best layout of one cue's words in one or two lines, with its cost; None if none fits."""
    n = len(words)
    if _length(words) <= WIDTH:
        return _short(n, total), (" ".join(words),)
    best = None
    for k in range(1, n):
        a, b = words[:k], words[k:]
        if _length(a) > WIDTH or _length(b) > WIDTH:
            continue
        c = _break_cost(words, k - 1) + _short(len(a), total) + _short(len(b), total)
        c += 0.02 * (_length(a) - _length(b)) ** 2
        if best is None or c < best[0]:
            best = (c, (" ".join(a), " ".join(b)))
    return best


MIN_SECONDS = 1.5  # a cue shorter than this is hard to read before it goes


def layout(text: str, seconds: float = 0.0) -> list[tuple[str, ...]]:
    """A sentence as cues, each a tuple of one or two lines, at the lowest total cost.
    seconds is the sentence's spoken span; with it, a cue that would flash by costs more."""
    words = tuple(text.split())
    n = len(words)
    whole = _weight((text,))

    @lru_cache(maxsize=None)
    def best(i: int):
        if i == n:
            return 0.0, ()
        out = None
        for j in range(i + 1, n + 1):
            if _length(words[i:j]) > LINES * WIDTH + 1:
                break
            lay = _lines(words[i:j], n)
            rest = best(j)
            if lay is None or rest is None:
                continue
            cost = lay[0] + rest[0]
            if j < n:  # a cue break: dearer than a line break, and a short cue is hard to catch
                b = _break_cost(words, j - 1)
                cost += 50 + 1.5 * b + (500 if b >= 250 else 0) + 3 * max(0, 25 - _length(words[i:j]))
            if seconds and n > 1 and (i or j < n):  # a part of a split sentence
                held = seconds * _weight((" ".join(words[i:j]),)) / whole
                cost += 200 * max(0.0, MIN_SECONDS - held)
            if out is None or cost < out[0]:
                out = (cost, (lay[1],) + rest[1])
        return out

    found = best(0)
    if found is None:
        raise ValueError(f"a word is longer than {WIDTH} characters: {text!r}")
    return list(found[1])


def _weight(lines: tuple[str, ...]) -> float:
    text = " ".join(lines)
    return len(text.replace(" ", "")) + 4 * sum(text.count(p) for p in ",;:")


def cues(timing: list[dict]) -> list[tuple[float, float, str]]:
    """(start, end, text) for every cue; text holds its lines joined by a newline."""
    out = []
    for row in timing:
        parts = layout(row["text"], row["end"] - row["start"])
        weights = [_weight(p) for p in parts]
        total, t = sum(weights), row["start"]
        span = row["end"] - row["start"]
        for k, (p, w) in enumerate(zip(parts, weights)):
            end = row["end"] if k == len(parts) - 1 else t + span * w / total
            out.append((t, end, "\n".join(p)))
            t = end
    return out
