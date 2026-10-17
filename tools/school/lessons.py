"""Night School lesson pages after the pilot, from one spec each: the film, the lab, everything the
film says, the sources with their does-not-prove lines, and what the lesson leaves out. The words
and numbers come from each lesson's own film.json, evidence.json and facts.json.

    python -m tools.school.lesson_page   (writes these with the school page and the pilot)
"""

from __future__ import annotations

import json

from tools.school.page import SCHOOL, E, head, foot, sources, transcript
from tools.school.lessons_small import spec_distill, spec_lora
from tools.school.lessons_eval import spec_errorbars, spec_gaming
from tools.school.lessons_pair10 import spec_evaluate, spec_threads
from tools.school.lessons_pair11 import spec_quant, spec_tiling
from tools.school.lessons_pair12 import spec_fused, spec_precision
from tools.school.lessons_pair13 import spec_denoiser, spec_receipts
from tools.school.lessons_pair14 import spec_search, spec_editdistance
from tools.school.lessons_s20 import spec_mmbu
from tools.school.lessons_lm import spec_tokens, spec_embeddings, spec_nextword, spec_decoding, spec_block, spec_trainloop, spec_data, spec_scaling


def _pct(v: float) -> str:
    return f"{round(v * 100)}%"


def spec_vectors(f: dict) -> dict:
    m = f["measurements"]
    return {
        "id": "F1", "slug": "vectors", "guide": "Pylon",
        "title": "Vectors: a list of numbers is a place",
        "h1": "Vectors. <span class=\"g\">A list of numbers is a place.</span>",
        "desc": "Watch Pylon turn crates into arrows, dot products and cosines, then drag them yourself and explore the attention model's own word table.",
        "lede": "Every word inside a language model is a list of numbers, and a list of numbers is a place. Pylon shows you on her harbour chart, and then hands you the chart and the model's own word table.",
        "film": "It asks you two questions and waits for your answer before it shows you.",
        "lab_h": "The lab: Pylon's chart room",
        "lab": (f"Drag two crates and watch the dot product, the lengths and the cosine change. Then open the word table of the model from the attention lesson: "
                f"{f['vocab']} words, {f['dModel']} numbers each. Pick a word and see its nearest neighbours, computed in your browser from the trained lists. "
                f"Two controls rebuild the table: the lists shuffled between words, and the lists from before training. In the film's measurement, "
                f"{_pct(m['wte']['top1'])} of words had a nearest neighbour of the same kind, about {_pct(m['wte']['control']['top1']['mean'])} with shuffled lists, "
                f"and {_pct(m['wteUntrained']['top1'])} before training."),
        "lab_btn": "Open the chart room", "lab_note": "Everything is computed on your computer, in this page. Nothing is sent anywhere.",
        "data": [("facts.json", "media/school/vectors/facts.json"), ("model.json", "media/school/attention/model.json")],
        "limits": [
            "The words here live in a tiny model trained on a made-up language of 46 words. Its neighbours track the job a word does in those sentences, which is exactly what next-word training rewards; they do not show that the model understands anything. The kinds of word (names, things, doing words and so on) were set by us before measuring, and other choices would give other numbers.",
            "The flat chart throws most of the space away: its two directions keep about a third of the spread. Any flat picture of a word space, including the ones in this lesson, should be read with that in mind.",
        ],
        "next": "Next along the hill: <a class=\"inline\" href=\"night-school-matrices.html\">Matrices move space</a> (F2).",
    }


def spec_matrices(f: dict) -> dict:
    q = f["finale"]
    return {
        "id": "F2", "slug": "matrices", "guide": "Pylon",
        "title": "Matrices move space",
        "h1": "Matrices. <span class=\"g\">One move for every place at once.</span>",
        "desc": "Watch Pylon's crane move the whole chart with a matrix, then drive it yourself and rebuild the attention model's question from its trained weights.",
        "lede": "A matrix is a move that takes every place on a chart somewhere at once. Pylon's crane shows you how to read one, why the order of two moves matters, and how the attention lesson's question was made by one.",
        "film": "It asks you two questions and waits for your answer before it shows you.",
        "lab_h": "The lab: Pylon's crane cab",
        "lab": (f"Type a matrix, or pick a move, and watch the tracing sheet go where it sends it; put two cranes in a row and swap their order. Then the attention question: "
                f"every earlier word's score, q . k / {q['sqrtDHead']}, computed in your browser from the trained query and key matrices ({q['dModel']} x {q['dHead']} each), "
                f"with a control that sets the query matrix to zero. In the film's sentence the score of \"{q['readingWord']}\" against \"{q['answerWord']}\" is "
                f"{q['qkRaw']:.2f} / {q['sqrtDHead']} = {q['scaled']:.2f}."),
        "lab_btn": "Climb into the cab", "lab_note": "Everything is computed on your computer, in this page. Nothing is sent anywhere.",
        "data": [("facts.json", "media/school/matrices/facts.json"), ("model.json", "media/school/attention/model.json")],
        "limits": [
            "Real models use matrices thousands of numbers wide, and what a trained query matrix has learned is far harder to read than a crane's turn. The lesson shows one head of a two-layer toy model on one sentence.",
            "The bends between matrices (GELU, softmax, layer normalisation) get one picture here; how a model learns the numbers in its matrices is the next lessons' subject.",
        ],
        "next": "Before this: <a class=\"inline\" href=\"night-school-vectors.html\">Vectors</a> (F1). Next along the hill: gradients, which way is downhill (F3), planned.",
    }


def _corrections(s: dict) -> str:
    """Dated corrections, placed after the film they correct. The film and its numbers stay as made."""
    out = "".join(f'<h3>{E(c["date"])}</h3>' + "".join(f'<p class="body-text">{p}</p>' for p in c["body"]) for c in s.get("corrections", []))
    return f'''<section class="mv" id="corrections" aria-labelledby="corrections-h">
  <h2 id="corrections-h">Since this lesson was made</h2>
  {out}
</section>

''' if out else ""


def lesson_page(s: dict, film: dict, ev: dict, timing: list) -> str:
    sec = round(timing[-1]["end"] + film["host"]["close"]["seconds"])
    slug, rel = s["slug"], f"night-school-{s['slug']}.html"
    data = ", ".join(f'<a class="inline" href="{p}">{E(n)}</a>' for n, p in s["data"])
    body = f"""<div class="frame">
  <div class="bar"><span class="nm">Zain Dana Harper</span><span class="rt"><a class="inline" href="night-school.html">night school</a> / {s["id"]}</span></div>
  <div class="mid">
    <h1>{s["h1"]}</h1>
    <p class="lede">{E(s["lede"])}</p>
  </div>
</div>

<main id="main">
<section class="mv" id="film" aria-labelledby="film-h">
  <h2 id="film-h">The film</h2>
  <p class="body-text">About {sec // 60}:{sec % 60:02d}, hosted by {s["guide"]}. {E(s["film"])} The guide's voice is not recorded yet, so for now the film plays with captions; the full words are also below.</p>
  <div class="ls" data-school="film" data-scene="media/school/{slug}/film.scene.mjs">
    <button type="button" class="ns-btn ns-go" data-school-open>Play the film</button>
    <p class="ns-note" data-school-note>Nothing loads until you press play.</p>
    <div data-school-stage></div>
  </div>
</section>

{_corrections(s)}<section class="mv" id="lab" aria-labelledby="lab-h">
  <h2 id="lab-h">{E(s["lab_h"])}</h2>
  <p class="body-text">{E(s["lab"])}</p>
  <div class="ls" data-school="lab" data-lab="{slug}">
    <button type="button" class="ns-btn ns-go" data-school-open>{E(s["lab_btn"])}</button>
    <p class="ns-note" data-school-note>{E(s["lab_note"])}</p>
    <div data-school-stage></div>
  </div>
</section>

<section class="mv" id="words" aria-labelledby="words-h">
  <h2 id="words-h">Everything the film says</h2>
  <div class="sc-transcript">{transcript(film)}</div>
</section>

<section class="mv" id="sources" aria-labelledby="sources-h">
  <h2 id="sources-h">Sources</h2>
  <p class="body-text">Every claim in the film, with where it comes from and what that source does not prove. The numbers about the model are computed from its weights, which you can load and check: {data}.</p>
  {sources(ev)}
</section>

<section class="mv" id="limits" aria-labelledby="limits-h">
  <h2 id="limits-h">What this lesson leaves out</h2>
  {"".join(f'<p class="body-text">{E(p)}</p>' for p in s["limits"])}
  <p class="body-text">{s["next"]}</p>
</section>
</main>
"""
    return head(rel, s["title"], s["desc"], f"img/og/p/{rel.removesuffix('.html')}.jpg",
                f"{s['title']}, a Night School lesson by Zain Dana Harper.") + body + foot(f"Night School, lesson {s['id']}: {slug}.")


def spec_gradients(f: dict) -> dict:
    b, g, o = f["bowl"], f["gradientNorm"], f["oneNumber"]
    return {
        "id": "F3", "slug": "gradients", "guide": "Pylon",
        "title": "Gradients: which way is downhill",
        "h1": "Gradients. <span class=\"g\">Which way is downhill.</span>",
        "desc": "Pylon feels her way down a hill in fog: the gradient, a step that goes over the edge, a real model's loss, then you walk the hills yourself.",
        "lede": "Training a model means walking downhill on a landscape you cannot see. Pylon does it in fog on the hill above the harbour, and then hands you her lantern.",
        "film": "It asks you two questions and waits for your answer before it shows you.",
        "lab_h": "The lab: Pylon in the fog",
        "lab": (f"Pick a hill, click the map to place your start, choose a step and walk down by gradient descent, seen from above or as a relief. On the tilted bowl the edge is "
                f"2 / {b['curvatures'][0]} = {b['predictedBound']}: try either side of it. Then turn the dial on the attention model's last matrix and step it with the model's own backward pass, "
                f"on 64 sentences it never trained on. In the film's run, the dial's lowest point was {o['sStar']:.2f}, and the gradient's length fell from {g['init']['rows256']['norm']:.2f} "
                f"before training to {g['trained']['rows256']['norm']:.2f} after."),
        "lab_btn": "Into the fog", "lab_note": "Everything is computed on your computer, in this page. Nothing is sent anywhere.",
        "data": [("facts.json", "media/school/gradients/facts.json"), ("model.json", "media/school/attention/model.json")],
        "limits": [
            "The bowl, the narrow valley and the two valleys are toy surfaces chosen to show one effect each. Real loss surfaces have thousands or billions of directions, and the slice of the model's loss in the film is one flat view through them along two random directions, which are almost at right angles to the steepest one.",
            "The model's own training uses AdamW with a warmup and gradient clipping, on 16 stretches of text per step, not the plain fixed-step descent shown here. Better ways to step are lesson F5.",
        ],
        "next": "Before this: <a class=\"inline\" href=\"night-school-matrices.html\">Matrices</a> (F2). Next along the hill: <a class=\"inline\" href=\"night-school-backprop.html\">Backpropagation</a> (F4).",
    }


def spec_backprop(f: dict) -> dict:
    tr, c = f["training"], f["cost"]
    return {
        "id": "F4", "slug": "backprop", "guide": "Pylon",
        "title": "Backpropagation: blame, passed backwards",
        "h1": "Backpropagation. <span class=\"g\">Blame, passed backwards.</span>",
        "desc": "A chain of buckets down the hill: how a network gets every number's slope in one walk back, checked number by number, then trained in your browser.",
        "lede": "A model needs the slope for every one of its numbers. Nudging each one costs a whole run apiece. Pylon's bucket chain shows the trick that gets them all in one walk back.",
        "film": "It asks you one question and waits for your answer before it shows you.",
        "lab_h": "The lab: Pylon's bucket chain",
        "lab": (f"Train a {'-'.join(str(x) for x in f['net']['sizes'])} network ({f['net']['nParams']} numbers) on two spirals, in your browser. Click any point to see its chain: the value in every bucket and the "
                f"blame arriving at it. Check the walk back against nudging every number, then break one link on purpose and watch the check point at it. In the film's run, one walk back cost "
                f"{c['backward']} multiply-adds against {c['forward']} for the forward pass, and the network was right on {tr['finalHeldAccuracy'] * 100:.1f}% of new points after {tr['steps']:,} steps."),
        "lab_btn": "Fill the buckets", "lab_note": "Everything is computed on your computer, in this page. Nothing is sent anywhere.",
        "data": [("facts.json", "media/school/backprop/facts.json")],
        "limits": [
            "The network is tiny and the spirals are a toy task, so it trains in well under a second. Large models are trained the same way in principle, by software that writes the backward pass automatically rather than by hand.",
            "The count of multiply-adds leaves out the curves (tanh, exp and log) and is for one point. The general bound for reverse mode is a small constant times the cost of the function; our measured 2.12 is one network, not that bound.",
        ],
        "next": "Before this: <a class=\"inline\" href=\"night-school-gradients.html\">Gradients</a> (F3). Next along the hill: optimisers (F5), planned.",
    }


def spec_optimisers(f: dict) -> dict:
    E, sp = f["races"]["rosenbrock"]["entrants"], f["spiral"]
    return {
        "id": "F5", "slug": "optimisers", "guide": "Pylon",
        "title": "Optimisers: momentum, Adam and the step size",
        "h1": "Optimisers. <span class=\"g\">Better ways to step.</span>",
        "desc": "Careful steps, a heavy ball and Adam race down the same valleys, then train a real network: who wins depends on the hill.",
        "lede": "Plain gradient descent crawls along narrow valleys. Pylon gives her walker weight, then a pair of shoes, and races all three on hills where each one wins.",
        "film": "It asks you one question and waits for your answer before it shows you.",
        "lab_h": "The lab: Pylon's race",
        "lab": (f"Race careful steps, the heavy ball and Adam on three hills, each with the step you give it, from wherever you click. On the long narrow valley, at the steps the film chose, "
                f"the heavy ball got down to stay in {E['momentum']['stepsToThreshold']:,} updates, careful steps in {E['sgd']['stepsToThreshold']:,} and Adam in {E['adam']['stepsToThreshold']:,}. "
                f"Then train the spiral network from the bucket chain with any walker and step, and compare the runs."),
        "lab_btn": "Line them up", "lab_note": "Everything is computed on your computer, in this page. Nothing is sent anywhere.",
        "data": [("facts.json", "media/school/optimisers/facts.json")],
        "limits": [
            "Which walker wins depends on the hill and on the handful of steps tried for each; comparisons between optimisers are sensitive to how carefully each one is tuned, and these are small, chosen surfaces.",
            f"The language model comparison covers its first {f['transformer']['steps']} updates only, a fifth of its training, before it has properly learned to copy; it shows who gets off the line fastest, not who finishes best.",
        ],
        "next": "Before this: <a class=\"inline\" href=\"night-school-backprop.html\">Backpropagation</a> (F4). Next: <a class=\"inline\" href=\"night-school-heldout.html\">The held-out set</a> (F6).",
    }


def spec_heldout(f: dict) -> dict:
    p, sp = f["poly"], f["spiral"]
    return {
        "id": "F6", "slug": "heldout", "guide": "Pylon",
        "title": "The held-out set: learning, or remembering?",
        "h1": "The held-out set. <span class=\"g\">Learning, or remembering?</span>",
        "desc": "A curve that passes through every point and fails on new ones: overfitting, the held-out set, a leash, and how even a held-out score is one draw.",
        "lede": "A model can learn its training examples by heart and still be lost on new ones. Pylon fits curves at her desk, keeps some points back, and shows what they reveal.",
        "film": "It asks you one question and waits for your answer before it shows you.",
        "lab_h": "The lab: practice and test",
        "lab": (f"Fit a curve of any flexibility to {p['nTrain']} points, with or without a leash, and see its error on them and on {p['nHeld']} held-out points; draw new training points and watch the best "
                f"flexibility move. Then train the spiral network on 10 to 400 points. In the film, 40 points gave {sp['small']['finalHeldAccuracy'] * 100:.1f}% on new points and 400 gave {sp['full']['finalHeldAccuracy'] * 100:.1f}%."),
        "lab_btn": "Open the chart", "lab_note": "Everything is computed on your computer, in this page. Nothing is sent anywhere.",
        "data": [("facts.json", "media/school/heldout/facts.json")],
        "limits": [
            "The curve and the spirals are toy problems with known answers, so overfitting is easy to see; in real work the truth is unknown and the held-out set is the only window onto it.",
            "Some choices in the film (the best degree, the best leash) were picked on the same held-out points they are scored on, which flatters them a little; the film says so, and the closing rule (a third set, looked at once) is the fix.",
        ],
        "next": "Before this: <a class=\"inline\" href=\"night-school-optimisers.html\">Optimisers</a> (F5). Next, at the dock: <a class=\"inline\" href=\"night-school-tokens.html\">Tokens</a> (L7).",
    }


SPECS = {"vectors": spec_vectors, "matrices": spec_matrices, "gradients": spec_gradients, "backprop": spec_backprop, "optimisers": spec_optimisers, "heldout": spec_heldout, "tokens": spec_tokens, "embeddings": spec_embeddings, "nextword": spec_nextword, "decoding": spec_decoding, "block": spec_block, "trainloop": spec_trainloop, "data": spec_data, "scaling": spec_scaling, "distill": spec_distill, "lora": spec_lora, "errorbars": spec_errorbars, "gaming": spec_gaming, "evaluate": spec_evaluate, "threads": spec_threads, "quant": spec_quant, "tiling": spec_tiling, "fused": spec_fused, "precision": spec_precision, "denoiser": spec_denoiser, "receipts": spec_receipts, "search": spec_search, "editdistance": spec_editdistance, "mmbu": spec_mmbu}


def write_all(root) -> list[str]:
    out = []
    for slug, spec in SPECS.items():
        d = SCHOOL / slug
        load = lambda n: json.loads((d / n).read_text(encoding="utf-8"))  # noqa: E731
        film, ev, facts, timing = load("film.json"), load("evidence.json"), load("facts.json"), load("timing.json")
        rows = timing["rows"] if isinstance(timing, dict) else timing
        rel = f"night-school-{slug}.html"
        (root / rel).write_text(lesson_page(spec(facts), film, ev, rows), encoding="utf-8", newline="\n")
        out.append(rel)
    return out
