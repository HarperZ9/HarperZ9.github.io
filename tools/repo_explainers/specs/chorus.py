SHA = "29cefb2b675beb0856444dff63b3cb224970ab84"
B = f"https://github.com/HarperZ9/chorus/blob/{SHA}/"
def L(path, label=None):
    return f'<a href="{B}{path}">{label or path}</a>'

FLOW = ["normalize", "engagement", "score", "weight", "cluster", "themes", "contested", "receipt"]

SPEC = {
    "slug": "chorus", "repo": "chorus", "sha": SHA, "name": "chorus", "version": "version 0.3.0",
    "description": "An animated walk through chorus: twelve comments scored with a small lexicon, weighted by engagement, clustered into themes, the contested topic named, and a digest receipt that re-derives from the inputs and rejects a doctored weight even when its hash is recomputed. Built from chorus at commit 29cefb2.",
    "lede": "Turn a comment section into a ranked digest you can re-check.",
    "for_you": "chorus reads a pile of comments and tells you what people are saying: the themes, ranked by how much the crowd engaged and how strongly it felt, the sharpest dissent, and the topics the crowd is split on. Every digest carries a receipt a stranger can re-run to get the same answer. It works on a corpus that gather captured, or on a plain JSON list.",
    "uses": [
        ("Themes, ranked", "Each theme has its size, a weight, a sentiment split, a controversy score and its strongest dissenting voice."),
        ("The fight, named", "A separate lens measures every comment that mentions a term, so a split topic is not hidden by clustering."),
        ("A receipt you can re-run", "<code>--verify</code> re-derives the digest from the inputs and rejects one that does not follow."),
        ("Honest nulls", "A missing engagement signal is recorded as absent, and a thin corpus says so."),
    ],
    "how_intro": "Scroll, or use the step buttons. The panel follows the bundled sample, <code>examples/discourse-sample.json</code>: twelve comments under one phone review. Every number is output from chorus at commit 29cefb2, with no model.",
    "steps": [
        {"title": "Twelve comments under one review",
         "paras": ["Five comments talk about the battery, four about the display and three about the camera. Each carries its like count. The battery comments disagree: two love it and three hate it."],
         "src": L("examples/discourse-sample.json"),
         "scene": [{"pipe": {"stages": FLOW, "active": 0}},
                   {"table": {"head": ["id", "likes", "comment"], "rows": [
                       ["c01", "340", "The battery life on this phone is incredible, easily lasts me two full days"], ["c02", "210", "battery life is amazing, best i have ever had on any phone honestly"],
                       ["c03", "290", "the battery is terrible, drains so fast, worst battery i have owned"], ["c04", "260", "awful battery life, dead by lunch, hugely disappointing for the price"],
                       ["c05", "150", "battery drains overnight, really bad, i regret buying it"], ["c06 to c09", "300, 240, 190, 170", "four comments praising the display"], ["c10 to c12", "60, 40, 30", "three comments calling the camera average"]]}}]},
        {"title": "Score each comment with a small lexicon",
         "paras": ["Sentiment comes from a lexicon of thirty words with rules for negation, intensifiers, capitals and punctuation. The same text always scores the same. c02 scores 0.79 on <code>amazing</code> and <code>best</code>; c03 scores -0.75 on <code>terrible</code> and <code>worst</code>.",
                   "c01 says the battery is <code>incredible</code>, a word the lexicon does not hold, so it scores 0. The digest states this coarseness about itself: English-only and literal."],
         "src": L("src/chorus/sentiment.py") + ", <code>score_text</code>",
         "scene": [{"pipe": {"stages": FLOW, "active": 2}},
                   {"table": {"head": ["id", "compound", "words that scored"], "rows": [["c01", "0.0", "none"], ["c02", "0.7906", "amazing, best"], ["c03", "-0.7543", "terrible, worst"], ["c04", "-0.5574", "awful"], ["c05", "-0.2617", "bad"]]}}]},
        {"title": "Weight by engagement, then by feeling",
         "paras": ["A comment's weight is log(1 + likes) multiplied by (1 + 0.5 times the size of its sentiment). A loud comment nobody engaged with stays small, and a neutral comment with many likes still counts.",
                   "c04 has 260 likes and a sentiment of -0.5574, so its weight is log(261) x 1.2787 = 7.115."],
         "src": L("src/chorus/synthesize.py") + ", <code>item_weight</code>",
         "scene": [{"pipe": {"stages": FLOW, "active": 3}},
                   {"io": {"lines": ["weight = log1p(engagement) * (1 + 0.5 * |compound|)", "", "c01  log1p(340) * (1 + 0.5 * 0.0000) = 5.832", "c02  log1p(210) * (1 + 0.5 * 0.7906) = 7.467",
                                     "c03  log1p(290) * (1 + 0.5 * 0.7543) = 7.813", ["c04  log1p(260) * (1 + 0.5 * 0.5574) = 7.115", "hi"], "c05  log1p(150) * (1 + 0.5 * 0.2617) = 5.674"]}}]},
        {"title": "Cluster into themes",
         "paras": ["Comments are clustered by hashed TF-IDF cosine over 512 dimensions, seeded most-engaged first. Five themes come out, ranked by weight. The display leads; the battery splits into a praise cluster and a complaint cluster; c04 stands alone and is labelled a singleton, so it is not presented as a broad crowd theme."],
         "src": L("src/chorus/synthesize.py") + ", <code>cluster</code>",
         "scene": [{"pipe": {"stages": FLOW, "active": 5}},
                   {"table": {"head": ["theme", "size", "weight", "sentiment"], "rows": [
                       ["display / screen / bright", "4", "28.06", "all positive"], ["drains / battery", "2", "13.49", "all negative"], ["phone / life / battery", "2", "13.30", "half positive, half neutral"],
                       ["camera / photos / average", "3", "11.26", "all neutral"], ["awful / dead / disappointing", "1, singleton", "7.12", "negative"]]}}]},
        {"title": "Name the contested topic",
         "paras": ["Clustering filed the battery praise and the battery complaints under different themes, which would hide the disagreement. The contested lens measures every comment that mentions a term. The battery appears in five comments, 60% negative and 20% positive: contested at 0.5386.",
                   "One-sided praise and neutral chatter are left out of this list. The display and the camera are not contested."],
         "src": L("src/chorus/synthesize.py") + ", <code>contested_aspects</code>",
         "scene": [{"pipe": {"stages": FLOW, "active": 6}},
                   {"table": {"head": ["term", "mentions", "positive", "negative", "contested"], "rows": [["life", "3", "0.333", "0.333", "0.5531"], ["battery", "5", "0.2", "0.6", "0.5386"]]}}]},
        {"title": "A receipt that re-derives",
         "paras": ["The receipt hashes the inputs, the parameters and the digest body. Verify re-scores every comment from its text, re-clusters and re-weights, then compares. The unchanged digest verifies.",
                   "Double a theme's weight and it fails. Double it and recompute the digest's own hash to match, and it still fails, because the weight does not follow from the inputs. Change one like count in the corpus and the old digest fails against it. Pick each case in the panel."],
         "src": L("src/chorus/receipt.py") + ", <code>verify</code>",
         "scene": [{"pipe": {"stages": FLOW, "active": 7}},
                   {"cases": {"label": "Choose an edit", "items": [
                       {"label": "nothing", "blocks": [{"io": {"cmd": "verify(digest, scored)", "lines": ["True"], "verdict": ["re-derived", "ok"]}}]},
                       {"label": "a theme weight doubled", "blocks": [{"io": {"cmd": "verify(edited, scored)", "lines": ["False"], "verdict": ["rejected", "drift", "the body hash no longer matches"]}}]},
                       {"label": "doubled, hash recomputed", "blocks": [{"io": {"cmd": "verify(edited_with_new_hash, scored)", "lines": ["False"], "verdict": ["rejected", "drift", "the weight does not follow from the inputs"]}}]},
                       {"label": "one like count changed", "blocks": [{"io": {"cmd": "verify(digest, scored_from_changed_corpus)", "lines": ["False"], "verdict": ["rejected", "drift", "the input hash no longer matches"]}}]}]}}]},
    ],
    "try": [
        ("Install from a checkout (Python 3.10 or newer). The deterministic path needs no service key and no model.",
         "$ git clone https://github.com/HarperZ9/chorus && cd chorus\n$ pip install -e .\n$ chorus run examples/discourse-sample.json --verify\n<span class=\"out\">  \"contested\": [ ... \"term\": \"battery\", \"contested\": 0.5386 ... ]</span>"),
    ],
    "try_src": "Output from chorus at 29cefb2 on Windows with Python 3.12. The tamper cases were run through the Python API, <code>chorus.receipt.verify</code>.",
    "limits": [
        "The lexicon is English-only and literal: no sarcasm, irony or context. A word outside it, like incredible, scores 0.",
        "Clustering is lexical. Comments that say the same thing in different words can land in different themes.",
        "Sentiment is a weight and never a verdict. A digest reports what people said; whether they are right is outside it.",
        "A model overlay with <code>--model</code> is tagged with its provenance and never enters the re-checkable core.",
        "The source-change gate reports whether sources changed. It does not decide whether a source claim is true.",
    ],
    "limits_src": "README.md at 29cefb2, \"What you get\" and \"Release notes\"; the digest's own method.coarseness field",
    "recall": [
        ("Why does c01 score 0 when it calls the battery incredible?", "The lexicon does not hold the word incredible, so nothing in c01 scores."),
        ("What is c04's weight, and where do its two factors come from?", "7.115: log(1 + 260 likes) times (1 + 0.5 x 0.5574), the size of its sentiment."),
        ("Clustering put battery praise and complaints in different themes. How does chorus still show the fight?", "The contested lens measures every comment that mentions a term, so the battery reads contested at 0.5386."),
        ("A digest's weight is edited and its hash recomputed to match. Why does verify still reject it?", "Verify re-derives the digest from the comments themselves, and the edited weight does not follow from them."),
    ],
    "license_line": "chorus is released under FSL-1.1-MIT.",
}
