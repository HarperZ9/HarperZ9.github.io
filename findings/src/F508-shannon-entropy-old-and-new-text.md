---
id: F508
slug: shannon-entropy-old-and-new-text
title: Shannon's 1951 letter statistics hold on old and new English; his third-order value reads high
tier: B
fields: [information-theory, linguistics-literature]
date_found: 2026-11-01
standfirst: Shannon's first- and second-order entropy figures for English letters match ours within 0.12 bits on books from 1788 to 1925 and on present-day Wikipedia. His third-order figure sits 0.23 to 0.39 bits above ours, and an n-gram reader never gets near his 1.3 bits per letter.
status: keep
figure: none
data: Project Gutenberg public-domain texts (The Federalist 1788, Austen 1813, Bronte 1847, Melville 1851, Dickens 1859, Doyle 1892, Joyce 1914 and 1916, Wodehouse 1920, Fitzgerald 1925) and Wikipedia featured articles (CC BY-SA, used for statistics only), https://www.gutenberg.org and https://en.wikipedia.org
---
## What it means

Shannon's 1951 table of how much information each English letter carries is still quoted as a fact about the language. On text two centuries apart, the parts of the table that depend on single letters and letter pairs hold up. The part that depends on letter triples does not, by about a third of a bit, which is a warning about quoting the higher rows. A reader built from letter counts alone stays well above Shannon's human estimate, so his 1.3 bits per letter describes a reader with knowledge of the world, and our n-gram reader has none.

## The question

Does the 1951 table (27 symbols: F0 4.76, F1 4.03, F2 3.32, F3 3.1 bits per letter, and 2.14 from word statistics) hold on present data? Does a simple statistical reader reach his 1.3 bits? And when a reader trained on one kind of text reads another, which costs more: a change of era or a change of genre?

## How we tested it

We reduced each text to 26 letters and a space. F1, F2 and F3 are the entropies of a letter given 0, 1 and 2 letters before it, computed on three pooled corpora: old (1788 to 1859, four novels and The Federalist), mid (1892 to 1925, five works of fiction) and new (Wikipedia featured articles). For the reader we built a PPM-style mixture of letter-context counts, trained it on one corpus and measured its bits per letter on held-out text of each corpus. It also played Shannon's guessing game, ranking the next letter, from which his bounds follow.

The first run had a fault of ours: a promised shuffle of books was never done, so the old held-out text was all The Federalist and era was read through one book. We wrote a second preregistration to fix it before rerunning; it was not blind, since the first run had been seen. The first run stands as recorded.

## Controls and planted checks

- A planted second-order Markov text with known entropy: the reader came within 0.004 bits of the truth (kill above 0.1).
- Held-out text with its characters shuffled: the real reader beat every one of 20 shuffles.

## Result

Shannon's table against ours (bits per letter):

| | Shannon 1951 | Old | Mid | New |
|---|---|---|---|---|
| F1 | 4.03 | 4.09 | 4.07 | 4.11 |
| F2 | 3.32 | 3.35 | 3.32 | 3.44 |
| F3 | 3.1 | 2.71 | 2.70 | 2.87 |
| Word-based | 2.14 | 1.80 | 1.85 | 1.75 |

- F1 and F2 differ from his by at most 0.12 (largest gap F2 on new text, 0.120).
- F3 reads 0.39 lower than his on old text and 0.23 lower on new text.
- The word-based figure differs by 0.34 to 0.39, likely because he extended a Zipf-law tail where we counted words directly.
- The reader on its own kind of text, second run: 1.93 (old fiction), 2.15 (mid fiction), 1.63 (The Federalist), 2.41 (Wikipedia). It never reached 1.3.
- Change of era within fiction cost 0.10 bits (old reader on mid text) and 0.25 (mid reader on old text). Change of genre, fiction to The Federalist in the same era, cost 0.44. A reader trained on The Federalist lost 1.37 bits on Wikipedia, where era and topic change together. Our preregistered claim that era costs more than genre failed, as we had forecast.

Forecasts held 4 of 9 in the first run and 4 of 5 in the second.

## Limits

Wikipedia is the only new text, so era and genre stay tangled in the new-text rows. No large language model was used as a reader; that was the frame we most wanted to change and it stays open. The word-based gap may be his Zipf tail against our plug-in count. Shannon's own test text is not openly available, so we compare against his table. Scoring was by our own code, not blind.

## Verified

Verified: every F1, F2, F3 and word-based value in the table, the gaps 0.055, 0.025, 0.388, 0.083, 0.120 and 0.228, the reader values, the era and genre penalties, the planted gap 0.004 and the shuffle control were re-read from both runs' result files on 2026-11-09 and match the ledger. The forecast counts 4 of 9 and 4 of 5 were counted from the forecast rows in those files. Shannon's table values are as recorded in the preregistration from the paper scan. Not re-run.

## Reproduce

Take the listed public-domain books from Project Gutenberg and a sample of Wikipedia featured articles. Strip the Project Gutenberg header and footer, lowercase, and map everything outside a to z to a single space. Compute conditional entropies of each letter given 0, 1 and 2 previous letters on each pooled corpus. Train an n-gram mixture reader on part of one corpus and measure its average bits per letter on held-out text from each corpus. Compare with Shannon's 1951 table.

## Sources

- Shannon, 1951, the printed-English prediction paper whose table is re-tested here.
- Shannon, 1948, named in the study's background.
- Project Gutenberg texts listed under data; Wikipedia featured articles.
