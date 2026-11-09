# Fact check: Night School F1, "Vectors: a list of numbers is a place"

Checked by: an independent sub-agent (it did not write the script). Date: 2026-10-15.
Script checked: `media/school/vectors/film.json` (the filled script, 29 spoken lines). Host stage directions are not spoken and are not judged.

## What was read, and how

| Source | How it was read |
|---|---|
| Mikolov, Chen, Corrado, Dean 2013, arXiv 1301.3781 | Full text (PDF from arXiv, text extracted). Sections read closely: 1 (introduction, the King/Queen sentence and its citation [20]), 4.1 (how analogy questions are answered), 4.2 (training data), 4.3 and Table 4 (training words per model). |
| Jolliffe and Cadima 2016, Phil Trans R Soc A, doi 10.1098/rsta.2015.0202 | Sections 2(a) to 2(c) through the open PubMed Central copy (PMC4792409). The publisher page returned HTTP 403. The rest of the paper was not read. |
| Strang, Introduction to Linear Algebra, 5th ed. | Not available for the cited sections. The free material on math.mit.edu/~gs/linearalgebra/ila5 is the table of contents and sample sections 1.3, 2.5, 3.5, 6.1, 7.1, 12.1. Sections 1.1 and 1.2, which `evidence.json` cites, are not free. I read the table of contents (confirms 1.1 "Vectors and Linear Combinations", 1.2 "Lengths and Dot Products") and section 1.3. The mathematical claims were checked on their own merits. |
| Our model and code | Full: `system/school/tinyformer-model.mjs`, `corpus.mjs`, `vectors.mjs`, `tools/school/fill_vectors.mjs`, `media/school/vectors/facts.json`, `film.template.json`. Recomputed on CPU with Node from `media/school/attention/model.json`: vocabulary 46, width 32, 32-D cosine top-1 share 0.8043, wte PCA variance share 0.3061, 2-D shares, and next/previous-word counts for cone, who, stood and mended over 48,000 sampled training positions. |

## Line by line

| Line | Verdict | Reason and source |
|---|---|---|
| title.0 | correct | Title. |
| title.1 | correct | Narrative. |
| place.0 | correct | Narrative setup. |
| place.1 | correct | An ordered list of numbers is a vector. Standard; Strang 1.1 (not freely readable, checked on merits). |
| place.2 | correct | Point and arrow from the origin are two readings of one vector. Standard. |
| arrows.0 | correct | Head-to-tail addition equals componentwise addition. Standard. |
| arrows.1 | correct | Scaling by 2 doubles length and keeps direction; by -1 reverses. Standard. |
| dot.0 | correct | Definition of the dot product. |
| dot.1 | correct | Narrative. |
| dot.2 | correct | For nonzero vectors the dot product is zero exactly at a right angle, positive under 90 degrees, negative over 90. "Big when they point the same way" depends on length too; the next segment says so, which is fair. |
| cosine.0 | correct | Setup. |
| cosine.1 | correct | Doubling one vector doubles the dot product (linearity). |
| cosine.2 | reword | The cosine formula is right. "It never goes past one" states only the upper bound. Schwarz gives abs(v.w) <= abs(v) abs(w), so the cosine stays between -1 and 1, and the line has just named -1 as a value. Also undefined for a zero-length arrow (not an issue on screen). |
| many.0 | correct | Vectors can have any number of components. |
| many.1 | correct | `wte` is 46 by 32 (`tinyformer-model.mjs` dModel 32; recomputed). A position vector `wpe` is added afterwards, so "starts as" is accurate. |
| many.2 | correct | Dot product and cosine generalise to 32 components. |
| words.0 | correct | Embeddings are trained by next-word loss. Minor: training ran a fixed 2,000 steps, so "until the model got better" is loose but not false. |
| words.1 | correct | facts.json `neighbours.wte`: kettle -> map 0.7063, shell 0.5999, crate 0.4517; tallow -> rerun 0.4104, pylon 0.3798, map 0.3291. |
| words.2 | reword | Numbers are right: top-1 0.8043 (37 of 46, per-category sums 3+11+13+6+4+0), shuffle mean 0.2251 (about 23), untrained 0.087 (9). Two wording issues. "Have a nearest neighbour of the same kind" can be heard as "one of their near neighbours"; the measure is the single nearest one. "Cargo by cargo": the noun category also holds dock, tide, bell and map, which are not cargo (`vectors.mjs` CATEGORIES). |
| words.3 | reword | Mikolov et al. 1301.3781, section 1, gives the King/Queen result as an earlier finding, citing [20] (Mikolov, Yih, Zweig, NAACL 2013). The vectors in [20] are RNN language-model vectors; Table 4 and section 4.3 give that training set as 320M words. The paper's own models used a Google News corpus of about 6B tokens (section 4.2). So "billions of words" does not describe the source of the King/Queen example. Section 4.1 also says the input question words are discarded from the search; without that, the nearest vector to king - man + woman is often king itself. |
| cone.0 | correct | Narrative. |
| cone.1 | correct | Cone is in the noun category; facts.json `neighbours.wte.cone`: who 0.5198, stood 0.4096, mended 0.3263. |
| cone.2 | wrong | First sentence correct: `corpus.mjs` emits cone only in `copyEpisode`, as "pylon put a cone on the <thing>"; recount: cone is preceded by "a" every time and followed by "on" every time. Second sentence is not supported. The three neighbours do not do cone's job in a sentence. "who" opens a question and is followed by a verb; "mended" is followed by "the"; only "stood" is also followed by "on" ("pylon stood on the dock"). The script states a cause the measurement does not show. |
| cone.3 | reword | "Closeness means used in the same way" is a general claim this lesson does not test, and cone is a counterexample to the simple form of it. "You can see exactly where it comes from" overclaims; we can see every sentence the model read, not the mechanism that placed cone. |
| flat.0 | correct | Narrative warning. |
| flat.1 | correct | `pca2` centres the data then takes the top two covariance eigenvectors, which is principal component analysis as Jolliffe and Cadima 2(a) define it (maximum variance linear combinations of centred variables). Variance share for wte 0.3061 (31 percent), recomputed. Jolliffe and Cadima 2(b) supports "best variance-preserving two-dimensional plot". |
| flat.2 | reword | 43 percent is `chartWte.top1In2D`, but `fill_vectors.mjs` measures it with cosine on the 2-D points, that is, by angle seen from the middle of the chart. A viewer judges nearest neighbour by distance on the chart. By distance the 2-D top-1 share is 0.5217 (52 percent), recomputed with `neighbourShare(p.coords, labels, 3, "distance")`. In 32-D cosine and distance agree (0.8043 both). "Flattening throws closeness away" is too absolute: it lost about 28 to 37 points, not all of it. |
| close.0 | reword | The second clause is right. The first contradicts cosine.1: the dot product mixes direction with length, as the lesson showed. |
| close.1 | correct | Narrative bridge to F2. |

Counts: correct 22, reword 6, wrong 1.

## Suggested rewordings

1. cosine.2, replace "It never goes past one." with:
   "It always stays between minus one and one."

2. words.2, replace the first sentence with:
   "Across all 46 words, 80 percent have a nearest neighbour of the same kind as themselves: names next to names, things next to things, doing words next to doing words."
   (Keep the two following sentences as they are.)

3. words.3, replace with:
   "Trained on hundreds of millions of words, the same idea goes much further. In 2013, researchers reported word lists where king, minus man, plus woman, landed closest to queen, once the three words in the question were left out of the search."

4. cone.2, replace with:
   "In our sentences a cone only ever turns up in one phrase: put a cone on. Nothing there marks it as cargo, so the model had no reason to park it with the crates. Where it did park it is something we measured. Why there, we can only guess."

5. cone.3, replace with:
   "Closeness in these lists comes from how words are used in the training sentences, not from what they mean. Here, with 46 words, you can read every sentence the model learned from."

6. flat.2, two options.
   Option A (preferred, needs one code change): in `tools/school/fill_vectors.mjs`, measure the flat chart by distance (`neighbourShare(p.coords, labels, K, "distance")`), refill, and say:
   "On the flat chart, only 52 percent of the words sit nearest to a word of the same kind. In all 32 directions it was 80. Flattening throws a lot of closeness away."
   Option B (keep the number): "On the flat chart, measured the same way by angle, only 43 percent of the words keep a nearest neighbour of the same kind. In all 32 directions it was 80. Flattening throws a lot of closeness away."

7. close.0, replace with:
   "A list of numbers is a place. The dot product mixes how much two places point the same way with how far out they are, and the cosine keeps only the direction."

## Notes outside the spoken lines

- `evidence.json`, mikolov2013: the claim "The models were trained on a Google News corpus of about 6 billion tokens" is true of the paper's own models, but sits next to the King/Queen claim as if it described it. The King/Queen vectors come from reference [20], 320M words. Suggest adding: "The King/Queen example is cited from Mikolov, Yih and Zweig 2013 (RNN vectors, 320M words); the question words are excluded from the search (section 4.1)."
- `evidence.json`, strang2016: "read: sample sections" is accurate, but the free sample sections (1.3, 2.5, 3.5, 6.1, 7.1, 12.1) do not include 1.1 or 1.2, which the claims cite. The claims are standard and correct; the section citations were not checked against the text.
- `evidence.json`, jolliffe2016: "read: full". This check read sections 2(a) to 2(c) only.
- Chart wiring: `facts.chart` is the wout table (top-1 in 2-D 0.7174), while the narration quotes `chartWte`. Whoever builds the flat segment must draw `chartWte`, or the picture and the words will disagree.
