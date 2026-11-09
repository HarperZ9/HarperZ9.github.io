# Fact check: Night School L7, "Tokens: cutting text into crates"

Checked by: an independent sub-agent (it did not write the script). Date: 2026-10-15.
Script checked: `media/school/tokens/film.json` (the filled script, 20 spoken lines). Host stage directions and the `predict` prompt are not spoken claims and are not judged.

Result: 13 correct, 6 reword, 1 wrong.

## What was read, and how

| Source | How it was read |
|---|---|
| Sennrich, Haddow, Birch, arXiv 1508.07909 (v5, 10 Jun 2016; ACL 2016) | Full PDF fetched from arxiv.org, text extracted with pdftotext. Read closely: abstract, section 1 (contributions), section 3.2 and Algorithm 1, Figure 1, the sentence on applying merges at test time. |
| Gage 1994, "A New Algorithm for Data Compression" | Full text of the reconstructed copy at derczynski.com (PDF, text extracted). Read closely: abstract and section 1 "Theory". The copy names "The C User Journal" and DOI 10.5555/177910.177914; it does not show volume, issue or pages. |
| Radford et al. 2019, GPT-2 paper | Full PDF from cdn.openai.com, text extracted. Read closely: section 2.2 "Input Representation" (whole) and section 2.3 "Model" (vocabulary size). |
| UTF-8 byte lengths | RFC 3629 section 3 table (rfc-editor.org, plain text): U+0000 to U+007F one octet, U+0080 to U+07FF two, U+0800 to U+FFFF three, U+10000 to U+10FFFF four. Checked with Node TextEncoder and Python unicodedata (Unicode 15.0): U+00E9 is 2 bytes, e + U+0301 (combining acute) is 3 bytes, U+2019 is 3, U+1F9AD is named SEAL and is 4. |
| Project Gutenberg texts | Not fetched. The passages were checked as they appear in `system/school/tokens-texts.mjs` and `facts.json`, not against Gutenberg. |
| Our code and numbers | Read in full: `system/school/tokens.mjs`, `tools/school/fill_tokens.mjs`, `media/school/tokens/facts.json`, `evidence.json`. Read in part: `corpus.mjs` (VOCAB), `media/school/attention/model.json` (config). Recomputed on CPU with Node from the shipped modules: the first five merges, "the" at 4 and 5 merges, lamplit's pieces, 1.80 at 50 merges, lighthouse at 400 and at 878 English merges, the 16 unknown pieces by character, word counts with and without punctuation. |

## Line by line

| Line | Verdict | Reason and source |
|---|---|---|
| title.0 | correct | Title. |
| title.1 | correct | Narrative. |
| sizes.0 | correct | Models of the GPT-2 kind take token ids from a fixed vocabulary (GPT-2 section 2.2). Character- and byte-level models exist (GPT-2 section 2.2 mentions byte-level LMs), so "a language model doesn't read letters" is a generalisation, acceptable in context. |
| sizes.1 | reword | The number equals facts.json `corpus.curveTrain[0].tokensPerWord` 4.394. It is not letters per word. It is 159,526 characters plus one end-of-word symbol per word (206,528 pieces), divided by 47,002 pre-tokenized words, of which 9,334 are "." or "?" (`tokens.mjs` pretokenize; facts.json `method.tokensPerWord`). Letters alone per pre-tokenized word are 3.39; per real word (37,668 letter words) 3.99 letters, or 4.99 pieces with the end mark. A listener hears "cut by letter, 4.39 per word" as letters per word. The end-of-word mark is also never introduced, yet later lines rely on it ("lit at the end of a word", the first merge). |
| sizes.2 | correct | A word-level vocabulary has no entry for an unseen word. |
| merge.0 | correct | Matches Sennrich 3.2: start from characters, count all symbol pairs, replace the most frequent pair with a new symbol, repeat; pairs that cross word boundaries are not considered. Gage section 1 for the compression origin. The end-of-word symbol is left out here; the sizes.1 rewording supplies it. |
| merge.1 | reword | facts.json `corpus.firstMerges[0]` is e + `</w>`, and merge 5 is t + he`</w>` = the`</w>` (recomputed: "the" is t, he`</w>` after 4 merges and one piece after 5). Both facts are right. "Joins an e to the end of a word" reads as appending an e to words. The merge joins an e to the end-of-word mark, so a word-final e becomes one piece. |
| merge.2 | correct | 1.8011 at 50 merges (recomputed 1.80105); 1.00 at 136 merges, every training word one piece (`tieIn.everyWordWholeAtMerges` 136). "Word" here also counts "." and "?"; fixed once by the sizes.1 rewording. |
| unseen.0 | correct | `corpus.unseen[0]`: lamplit, `seenInTraining` false. |
| unseen.1 | reword | Pieces l, am, p, lit`</w>` match facts.json and recompute. "Nothing is thrown away": `unknownPieces` is empty. Sennrich et al. do use BPE to encode rare and unknown words as subword sequences (abstract; section 3.2, test time: split into characters, apply the learned merges). Two small overstatements: "exactly this" (they ran it on Moses-tokenized text, and also tested joint BPE; our pre-tokenizer and tie rule differ, as `tokens.mjs` states) and "in 2016" (first posted on arXiv August 2015, published ACL 2016). |
| english.0 | wrong | "The guides only know 46 words": VOCAB has 46 entries, two of which are "." and "?" (44 words). "716 words of it": 716 is the pre-tokenized count with every punctuation mark counted as a word (facts.json `english.words`). The passage has 599 words split on spaces (614 runs of letters, since hyphens split words like water-gazers). A word count of a famous text is checkable, so 716 is wrong for a general audience. |
| english.1 | correct | `english.curveHeld` at 400 merges: 2.1423. Lighthouse: facts.json gives li, gh, thou, se`</w>` with all 878 merges; recomputed at 400 merges, the same four pieces, so the line is right as worded. Per-word figure counts punctuation as words (281 pre-tokens, 233 words); fixed once by the sizes.1 rewording. |
| random.0 | correct | `corpus.randomControl.train` at 136 merges: min 1.319, max 1.6703, 10 seeds; random pick is uniform among pairs present (`pickRandom`). |
| bytes.0 | reword | facts.json `english.heldUnknownChars` is curly open and close quotes, D and E. Recomputed: 7 open quotes, 7 close quotes, 1 D (in "Do"), 1 E (in "England") = the 16 in bytes.2. The line names only the quotes, then bytes.2 cites 16, so a listener assumes 16 quote marks. Also the base is characters (letters and punctuation), not letters only (`english.base`). |
| bytes.1 | reword | GPT-2 section 2.2: "a byte-level version of BPE only requires a base vocabulary of size 256", and the approach "can assign a probability to any Unicode string". Byte counts match RFC 3629 and facts.json `bytes.table`. One gap: an accented e is 2 bytes only as the single precomposed character U+00E9; written as e plus a combining accent (U+0301) it is 3. |
| bytes.2 | correct | `bytes.byteBPE.heldUnknownTokens` 0, `bytes.charBPE.heldUnknownTokens` 16, both at 878 merges on Moby-Dick. |
| ours.0 | reword | `model.json` config vocab 46; the attention model is word-level. Two of the 46 are "." and "?", so "46 words" overcounts words by two. |
| ours.1 | correct | 24 base symbols + 136 merges = 160 (Sennrich 3.2: final vocabulary = initial vocabulary + number of merges). "Every piece it made on the way stays in the vocabulary" is the paper's counting rule, and facts.json `english.vocabCurve` shows symbols in use falling below the vocabulary size. |
| close.0 | correct | Summary of segments above; byte base covers every byte. |
| close.1 | correct | Points to the next lesson (embeddings). |

## Suggested rewordings (exact replacement text)

**sizes.1**
> Cut by letter, with one extra mark for the end of each word, and the guides' sentences take about 4.39 pieces per word, counting each full stop and question mark as a word: tiny crates, a great many trips.

**merge.1**
> On the guides' sentences, the first merge joins an e to the end-of-word mark, so an e that ends a word gets one crate. By the fifth merge, the whole word 'the' has its own crate.

**unseen.1**
> So it's cut into pieces that do have crates: l, am, p, and lit at the end of a word. Nothing is thrown away. Rico Sennrich and his colleagues used this method, in a 2016 paper, to translate rare words.

**english.0**
> The guides only know 44 words and two marks. So here's real English: the opening of Moby-Dick, about 600 words of it, to learn the merges from.

**bytes.0**
> There's one more choice: what the very first pieces are. Characters run out fast. The page from Pride and Prejudice has curly quotation marks, and a capital D and E, that Moby-Dick never used, so with characters as the base, they have no crate.

**bytes.1**
> GPT-2 starts from bytes instead. There are only 256 of them, and any text at all is some list of bytes. An a is one byte, an e with its accent built in is two, a curly apostrophe three, and a seal emoji four.

**ours.0**
> The little language model from the attention lesson skips all of this. It has one crate per word, 46 of them counting the full stop and question mark, because its whole world is those 46.

If `english.0` should stay filled from facts.json, the filler needs a real word count (split on spaces: 599 for Moby-Dick, 233 for Pride and Prejudice) next to the pre-token count; today facts.json has only the pre-token count.

## Corrections to evidence.json

- `sennrich2016.read`: replace "to be confirmed by the fact-check" with:
  "full text, read 2026-10-15 by an independent fact-check (arXiv PDF v5, 10 Jun 2016, text extracted): abstract, section 1, section 3.2, Algorithm 1, Figure 1. The prose of 3.2 writes the end-of-word symbol as a middle dot; Algorithm 1 writes it as </w>. Pairs that cross word boundaries are not counted. First posted to arXiv in August 2015; published at ACL 2016."
- `gage1994.read`: replace with:
  "full text of the reconstructed copy (Derczynski, 2020, from the C Users Journal HTML), read 2026-10-15 by an independent fact-check: abstract and section 1. The copy gives DOI 10.5555/177910.177914 but not volume, issue or pages; 12(2), 23-38 is not confirmed from it."
- `gage1994.claims[0]`: replace with:
  "Byte pair encoding began as a compression method: find the most frequent pair of adjacent bytes, replace every instance with a byte not in the original data, and repeat until no pair is frequent or no unused byte is left (section 1, Theory)."
- `radford2019.read`: replace with:
  "full text of sections 2.2 and 2.3, read by the core's builder and confirmed 2026-10-15 by an independent fact-check (OpenAI PDF, text extracted)."
- `ours-corpus.claims[0]`: replace "4.39 tokens per word at 0 merges (letters)" with "4.39 tokens per word at 0 merges (characters plus one end-of-word symbol per word; '.' and '?' count as words)".
- `ours-corpus.n`: replace with:
  "47,002 pre-tokenized corpus words, of which 9,334 are '.' or '?' (37,668 letter words); English: 716 and 281 pre-tokenized words (599 and 233 words split on spaces); 10 random-merge seeds."
- `ours-corpus.claims[2]`: append "; lighthouse gets the same four pieces at 400 merges and at all 878."
- `ours-corpus.claims[3]`: replace with "The attention model is word-level with 46 entries: 44 words plus '.' and '?'."
- `ours-bytes.claims[1]`: replace the parenthesis with "(14 curly quotation marks, 7 open and 7 close, plus one D and one E never seen in the Moby-Dick passage)".
- `ours-bytes.claims[0]`: append "An accented e is 2 bytes as the precomposed U+00E9; written as e plus combining U+0301 it is 3 (RFC 3629, section 3)."
