"""Night School lesson page specs for the language-model track (L7 onward): lede, film and lab
blurbs, data links, limits and next links. Split from lessons.py to keep each file short;
lessons.SPECS lists them all."""
from __future__ import annotations

def spec_tokens(f: dict) -> dict:
    c, e = f["corpus"], f["english"]
    return {
        "id": "L7", "slug": "tokens", "guide": "Pylon",
        "title": "Tokens: cutting text into crates",
        "h1": "Tokens. <span class=\"g\">Cutting text into crates.</span>",
        "desc": "How a language model cuts text into pieces: letters, merges learned from counts (byte-pair encoding), and bytes so nothing is left on the dock.",
        "lede": "A model never sees letters or words. It sees pieces. Pylon runs the customs shed where text is cut into crates, and the crates are learned from counting pairs.",
        "film": "It asks you one question and waits for your answer before it shows you.",
        "lab_h": "The lab: the customs shed",
        "lab": (f"Type any text and cut it with merges learned on the guides' sentences, on Moby-Dick's opening, or on your own text. Slide the number of merges and switch the base to bytes. "
                f"On the guides' {c['words']:,} words, every word is one piece after {c['totalMerges']} merges; Moby-Dick's opening takes {e['totalMerges']}."),
        "lab_btn": "Open the shed", "lab_note": "Everything is computed on your computer, in this page. Nothing is sent anywhere.",
        "data": [("facts.json", "media/school/tokens/facts.json")],
        "limits": [
            "The merges here are learned on small texts, so the pieces are short and odd; production tokenizers learn tens of thousands of merges on far more text.",
            "Real tokenizers add rules this one leaves out (how spaces attach, special tokens, normalisation), so their pieces for the same text will differ.",
        ],
        "next": "Before this: <a class=\"inline\" href=\"night-school-heldout.html\">The held-out set</a> (F6). Next: <a class=\"inline\" href=\"night-school-embeddings.html\">Embeddings</a> (L8).",
    }


def spec_embeddings(f: dict) -> dict:
    c = f["comparison"]
    return {
        "id": "L8", "slug": "embeddings", "guide": "Tallow",
        "title": "Embeddings: every token gets coordinates",
        "h1": "Embeddings. <span class=\"g\">Every token gets coordinates.</span>",
        "desc": "How a list of numbers per word comes to mean something: the skip-gram learns places from the company words keep, measured against a shuffled control.",
        "lede": "Each piece of text gets a list of numbers, and training moves those lists until words that keep the same company sit close. Tallow hangs the words as cards in her lamp room and lets them drift.",
        "film": "It asks you one question and waits for your answer before it shows you.",
        "lab_h": "The lab: the lamp room",
        "lab": (f"Train your own skip-gram on the guides' sentences: choose the seed, the numbers per word, the window and the noise words, then step through its snapshots and pick a word to see its neighbours. "
                f"The film's run ends with {c['skipGram']['top1'] * 100:.0f}% of words beside a word of the same kind, against about {c['skipGram']['control']['top1']['mean'] * 100:.0f}% shuffled."),
        "lab_btn": "Light the lamp", "lab_note": "Everything is computed on your computer, in this page. Nothing is sent anywhere.",
        "data": [("facts.json", "media/school/embeddings/facts.json")],
        "limits": [
            "Forty-six words from a made-up corpus are enough to see the effect and far too few to show what large tables learn; the categories used to score neighbours are ours.",
            "The chart shows two directions out of many, so two cards can look close and be far apart; neighbours are measured in all the dimensions.",
        ],
        "next": "Before this: <a class=\"inline\" href=\"night-school-tokens.html\">Tokens</a> (L7). Next: <a class=\"inline\" href=\"night-school-nextword.html\">Next-word prediction</a> (L9).",
    }


def spec_nextword(f: dict) -> dict:
    h = f["held"]["scores"]
    return {
        "id": "L9", "slug": "nextword", "guide": "Tallow",
        "title": "Next-word prediction and the loss",
        "h1": "Next-word prediction. <span class=\"g\">One guess, spread over every word.</span>",
        "desc": "How a language model guesses the next word as a spread of belief, how softmax makes it, and how the loss scores it as surprise.",
        "lede": "A language model is first trained to say what comes next. Its answer is never one word: it is a share of belief for every word. Tallow cuts that belief into a wheel, and scores it by how surprised it was.",
        "film": "It asks you two questions and waits for your answer before it shows you.",
        "lab_h": "The lab: the scoring wheel",
        "lab": (f"Type a line from the guides' world and step through it: the model's spread for each next word, the rules' own odds beside it, and the surprise of the word that came. "
                f"On {f['held']['positions']:,} held-out next words the model is torn between {h['trained']['all']['perplexity']:.2f} words; the rules themselves, {h['generator']['all']['perplexity']:.2f}."),
        "lab_btn": "Turn the wheel", "lab_note": "Everything is computed on your computer, in this page. Nothing is sent anywhere.",
        "data": [("facts.json", "media/school/nextword/facts.json")],
        "limits": [
            "The held-out rows are new, but the sentences in them all occur somewhere in training: a 46-word grammar can only make so many. Real held-out text is far less forgiving.",
            "We can show the floor only because we wrote the rules; for real text the floor is unknown, so no one can say how much lower a loss could go.",
        ],
        "next": "Before this: <a class=\"inline\" href=\"night-school-embeddings.html\">Embeddings</a> (L8). Next: <a class=\"inline\" href=\"night-school-attention.html\">Attention</a> (L10), then <a class=\"inline\" href=\"night-school-block.html\">The transformer block</a> (L11). Later: <a class=\"inline\" href=\"night-school-decoding.html\">Decoding</a> (L15).",
    }


def spec_decoding(f: dict) -> dict:
    o = next(p for p in f["prompts"] if p["key"] == "open")["settings"]
    return {
        "id": "L15", "slug": "decoding", "guide": "Tallow",
        "title": "Decoding: temperature, top-k, top-p",
        "h1": "Decoding. <span class=\"g\">Turning guesses into sentences.</span>",
        "desc": "How a language model's spread of belief becomes text: greedy choice, sampling, temperature, top-k and top-p, measured against the rules.",
        "lede": "A model's guess is a spread over every word, and a sentence needs one word at a time. Tallow spins the wheel, and shows what each way of cutting it writes.",
        "film": "It asks you two questions and waits for your answer before it shows you.",
        "lab_h": "The lab: the wheel room",
        "lab": (f"Give the model a start, cut the wheel by temperature, top-k or top-p, and spin once or two hundred times; each run is checked against the rules that wrote the guides' sentences. "
                f"From pylon at temperature 1, {o['t1']['grammatical'] * 100:.0f}% of runs follow the rules; at temperature 2, {o['t2']['grammatical'] * 100:.0f}%."),
        "lab_btn": "Open the wheel room", "lab_note": "Everything is computed on your computer, in this page. Nothing is sent anywhere.",
        "data": [("facts.json", "media/school/decoding/facts.json")],
        "limits": [
            "One small model and a 46-word grammar: a setting that does well here is not shown to do well on open-ended text, and the papers' main findings are about large models.",
            "Following the rules is a strict check, but not the only one that matters: a run can follow every rule and still say nothing new.",
        ],
        "next": "Before this: <a class=\"inline\" href=\"night-school-nextword.html\">Next-word prediction</a> (L9). Next: evaluating a language model (L16), planned.",
    }


def spec_block(f: dict) -> dict:
    a, c = f["ablations"]["trained"], f["params"]["counts"]
    return {
        "id": "L11", "slug": "block", "guide": "Tallow",
        "title": "The transformer block",
        "h1": "The transformer block. <span class=\"g\">Two floors, one stream.</span>",
        "desc": "What one transformer block does: layer norm, attention, the MLP and the residual stream, taken apart room by room on a real model.",
        "lede": "Every word's list of numbers climbs the tower. On each floor, attention and a small network read it and add to it. Tallow switches the rooms off one at a time to see what each was doing.",
        "film": "It asks you two questions and waits for your answer before it shows you.",
        "lab_h": "The lab: the tower",
        "lab": (f"Switch off any head or MLP of the attention model, or make a room replace the stream instead of adding to it, and score it on its held-out rows. "
                f"With everything on it copies {a['base']['copyAccuracy'] * 100:.0f}% of far-back words; attention and the MLP hold {c['attention']:,} and {c['mlp']:,} of its {c['total']:,} numbers."),
        "lab_btn": "Climb the tower", "lab_note": "Everything is computed on your computer, in this page. Nothing is sent anywhere.",
        "data": [("facts.json", "media/school/block/facts.json")],
        "limits": [
            "Two layers and two heads on a 46-word grammar: large models spread the same jobs over many more parts, and a knockout here shows what this model needs, not what a part means.",
            "Reading the stream early uses the model's own final norm and output table; other readouts give other numbers, and facts.json gives both.",
        ],
        "next": "Before this: <a class=\"inline\" href=\"night-school-attention.html\">Attention</a> (L10). Next: <a class=\"inline\" href=\"night-school-trainloop.html\">The training loop</a> (L12).",
    }


def spec_trainloop(f: dict) -> dict:
    r = f["reproduce"]
    return {
        "id": "L12", "slug": "trainloop", "guide": "Pylon",
        "title": "The training loop",
        "h1": "The training loop. <span class=\"g\">Five steps, two thousand times.</span>",
        "desc": "Batch, forward, loss, backward, step: the whole loop that trains a language model, rerun exactly, with one setting changed at a time.",
        "lede": "Every earlier lesson holds one piece of training. Pylon runs them round the dock together and watches a blind guess become a model that copies.",
        "film": "It asks you two questions and waits for your answer before it shows you.",
        "lab_h": "The lab: the training dock",
        "lab": (f"Train the attention model from scratch in this page with your own step size, batch, clipping and weight decay, and watch its held-out loss and copy rate against the film's run. "
                f"Rerun from its seeds, the loop gives back the lesson's model exactly: {r['tensorsEqual']} of {r['tensorsTotal']} weight tables."),
        "lab_btn": "Open the dock", "lab_note": "Everything is computed on your computer, in this page. Nothing is sent anywhere.",
        "data": [("facts.json", "media/school/trainloop/facts.json")],
        "limits": [
            "Each changed setting is one run with one seed; only differences larger than the spread of the noise runs mean anything.",
            "Timings are from one test machine; the lab's runs in your browser will be slower or faster.",
        ],
        "next": "Before this: <a class=\"inline\" href=\"night-school-block.html\">The transformer block</a> (L11). Next: data, what goes in comes out (L13), planned.",
    }

