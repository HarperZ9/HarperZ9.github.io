"""The attention lesson's page and the main entry that writes both Night School pages.

    python -m tools.school.lesson_page
"""

from __future__ import annotations

import json

from tools.school.page import ROOT, SCHOOL, E, head, foot, school_page, sources, transcript


def minutes(timing: list, close: float) -> str:
    s = round(timing[-1]["end"] + close)
    return f"{s // 60}:{s % 60:02d}"


def lesson_page(film: dict, ev: dict, facts: dict, timing: list) -> str:
    desc = "Watch Tallow show how attention lets a word use the words before it, then train a tiny transformer in your browser and watch its heads learn."
    pc = lambda v: f"{round(v * 100)}%"  # noqa: E731
    length = minutes(timing, film["host"]["close"]["seconds"])
    body = f"""<div class="frame">
  <div class="bar"><span class="nm">Zain Dana Harper</span><span class="rt"><a class="inline" href="night-school.html">night school</a> / L10</span></div>
  <div class="mid">
    <h1>Attention. <span class="g">How a language model decides what matters.</span></h1>
    <p class="lede">A word in a sentence often needs another word from much earlier. Attention is how a transformer goes and gets it. Tallow shows you in his lamp room, and then you train one yourself.</p>
  </div>
</div>

<main id="main">
<section class="mv" id="film" aria-labelledby="film-h">
  <h2 id="film-h">The film</h2>
  <p class="body-text">About {length}, hosted by Tallow. It asks you two questions and waits for your answer before it shows you. The guide's voice is not recorded yet, so for now the film plays with captions; the full words are also below.</p>
  <div class="ls" data-school="film" data-scene="media/school/attention/film.scene.mjs">
    <button type="button" class="ns-btn ns-go" data-school-open>Play the film</button>
    <p class="ns-note" data-school-note>Nothing loads until you press play.</p>
    <div data-school-stage></div>
  </div>
</section>

<section class="mv" id="lab" aria-labelledby="lab-h">
  <h2 id="lab-h">The lab: Tallow's lamp room</h2>
  <p class="body-text">Train the same kind of model the film uses: {facts["nLayers"]} layers, {facts["nHeads"]} heads each, {facts["params"]:,} numbers, starting from random. It learns from sentences about the coast, such as "rerun found a kettle . pylon put a cone on the", where the last word can only be guessed by looking back. Pick a head to light the sentence with, change the test sentence, or turn the lamp off and train again.</p>
  <p class="body-text">The film's own runs of {facts["steps"]:,} steps filled {pc(facts["copyOn"])} of the copy holes with attention on, {pc(facts["copyOff"])} when each word could see only itself, and {pc(facts["copyUniform"])} with even light and no choosing. Your run is a new one, so its numbers will differ a little.</p>
  <div class="ls" data-school="lab" data-lab="attention">
    <button type="button" class="ns-btn ns-go" data-school-open>Open the lamp room</button>
    <p class="ns-note" data-school-note>The model trains on your computer, in this page. Nothing is sent anywhere.</p>
    <div data-school-stage></div>
  </div>
</section>

<section class="mv" id="circuit" aria-labelledby="circuit-h">
  <h2 id="circuit-h">A circuit, switched off</h2>
  <p class="body-text">A second, short film: a different small model, trained on a computer's main processor to continue random strings with one repeated stretch. One head in its first layer moves each character one place forward; a head in its second layer finds the earlier copy and reads what came next. Switch the heads off and the model loses the repeat. That is a causal test, which a picture of attention weights alone is not.</p>
  <p class="body-text">About 73 seconds, with captions. The narration is a synthesized voice made from the author's own voice, and the author listened to this cut before it was published. Every number on screen comes from the model's data file in <a class="inline" href="https://github.com/HarperZ9/raw-native/tree/42363a1239a720a2e6d58e2bc560b751f196f5a0/docs/explainer/attention">raw-native</a>.</p>
  <video class="ns-video" controls preload="none" playsinline poster="media/school/attention/offers/explainer-kit/still-52.jpg" aria-label="A 73-second narrated film: a small model's attention moves each character forward, then finds the earlier copy and reads what came next; switching heads off removes the effect.">
    <source src="media/school/attention/offers/explainer-kit/attention-explainer.mp4" type="video/mp4">
    <track kind="captions" srclang="en" label="English" src="media/school/attention/offers/explainer-kit/attention-explainer.vtt" default>
  </video>
</section>

<section class="mv" id="words" aria-labelledby="words-h">
  <h2 id="words-h">Everything the film says</h2>
  <div class="sc-transcript">{transcript(film)}</div>
</section>

<section class="mv" id="sources" aria-labelledby="sources-h">
  <h2 id="sources-h">Sources</h2>
  <p class="body-text">Every claim in the film, with the paper it comes from and what that paper does not prove. The numbers about our model come from its weights file, which you can load and check: <a class="inline" href="media/school/attention/model.json">model.json</a> and <a class="inline" href="media/school/attention/facts.json">facts.json</a>.</p>
  {sources(ev)}
</section>

<section class="mv" id="limits" aria-labelledby="limits-h">
  <h2 id="limits-h">What this lesson leaves out</h2>
  <p class="body-text">The model here is tiny: two layers on a made-up language of 46 words, so it can train in your browser in about a minute. Large models have dozens of layers and many heads, and their heads do jobs that are much harder to name. Where a head puts its light tells you where it reads from; on its own it does not tell you why the model answered as it did.</p>
  <p class="body-text">Next along the coast: the transformer block that attention sits in (L11), and attention rebuilt as one fast trip through the GPU (K23). Both are planned, not made yet.</p>
</section>
</main>
"""
    return head("night-school-attention.html", "Attention: how a language model decides what matters", desc, "img/og/p/night-school-attention.jpg",
                "Attention, a Night School lesson by Zain Dana Harper. Fine threads of light arc from one word back to an earlier word along a sentence.") + body + foot("Night School, lesson L10: attention.")


def main() -> None:
    a = SCHOOL / "attention"
    load = lambda p: json.loads(p.read_text(encoding="utf-8"))  # noqa: E731
    film, ev, facts, timing = load(a / "film.json"), load(a / "evidence.json"), load(a / "facts.json"), load(a / "timing.json")
    cur = load(SCHOOL / "curriculum.json")
    (ROOT / "night-school.html").write_text(school_page(cur, facts), encoding="utf-8", newline="\n")
    (ROOT / "night-school-attention.html").write_text(lesson_page(film, ev, facts, timing), encoding="utf-8", newline="\n")
    from tools.school.lessons import write_all
    for rel in write_all(ROOT):
        print(rel, "written")
    # Point each head at its own link card (img/og/p, rendered by tools/repo_art/site_cards.py).
    from tools.repo_art import site_cards
    for c in site_cards.plan():
        if c["rel"].startswith("night-school"):
            site_cards.stamp(c)
    print("night-school.html and night-school-attention.html written")


if __name__ == "__main__":
    main()
