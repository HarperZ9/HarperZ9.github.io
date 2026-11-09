---
id: F515
slug: llm-compression-and-memorisation
title: A small language model squeezes the UDHR to 0.27 bits a letter, and fresh text to 1.59
tier: B
fields: [information-theory, linguistics-literature]
date_found: 2026-11-01
standfirst: Used as a compressor, SmolLM2 encodes the English Universal Declaration of Human Rights at 0.27 bits per character, far below any classical compressor. On 30,000 characters written after its training it needs 1.59, so most of the headline figure comes from text the model has already seen.
status: keep
figure: none
data: Universal Declaration of Human Rights translations from the NLTK udhr2 collection (source URL not recorded; licence not established, numbers only); Lewis Carroll, Alice's Adventures in Wonderland, Project Gutenberg via the NLTK Gutenberg selection; SmolLM2-360M (https://huggingface.co/HuggingFaceTB/SmolLM2-360M, Apache-2.0) and Qwen3-0.6B (https://huggingface.co/Qwen/Qwen3-0.6B, Apache-2.0). The unseen control text is an unpublished research log and is not released.
---
## What it means

A language model that predicts the next token well is also a compressor, and compression figures are often quoted as a measure of how well a model "understands" text. Those figures are usually taken on famous public text. When we gave two small models a text they could not have seen, their advantage over classical compressors shrank from tenfold to below twofold. A compression number on well-known text measures recall of that text as much as modelling of language, and should be checked on fresh text before it is read as either.

## The question

How many bits per character do small open language models need, used as arithmetic coders, compared with xz and with a PPM context model? And how much of the result survives on text written after the models were trained?

## How we tested it

We turned each model's next-token probabilities into an exact code length, the number of bits an arithmetic coder would emit, and divided by the number of characters. We checked that this is a real code: an arithmetic encoder and decoder round-tripped a 120-token passage exactly with both models. We compared against xz, a PPM context model starting cold, and the same PPM model pre-trained on 5 million characters of Project Gutenberg. The forecast file was written and hashed before any measurement.

The texts were the English UDHR (10,637 characters), a held-out Gutenberg book, Alice's Adventures in Wonderland (30,000 characters), and, added after we saw the first results, 30,000 characters of our own technical writing from October 2026. That last control was not in the forecast file and is labelled post hoc.

## Controls and planted checks

- Exact round trip on 120 tokens with both models, so the bit counts are achievable code lengths.
- Trained on character-shuffled Gutenberg text, the PPM model lost all of its advantage on the UDHR and more (3.59 bits against 2.57 cold); trained on word-shuffled text it lost a fifth of it (2.10 against 1.99). The context model gains from letter order, as it should.
- The unseen text acts as the control for prior exposure. Cold PPM, which has seen nothing, finds it only slightly harder than the UDHR (2.70 against 2.57 bits), so a large jump for a language model points at familiarity with the UDHR.

## Result

Bits per character:

| Text | xz | PPM cold | PPM trained | SmolLM2-360M | Qwen3-0.6B |
|---|---|---|---|---|---|
| English UDHR | 2.83 | 2.57 | 1.99 | 0.27 | 0.57 |
| Alice (Gutenberg) | 3.12 | 2.84 | 2.14 | 0.89 | 1.16 |
| Unseen, Oct 2026 | 2.74 | 2.70 | 2.89 | 1.59 | 1.66 |

- On the unseen text, SmolLM2 needs about 6 times the bits it needs on the UDHR.
- PPM trained on Gutenberg does worse than cold PPM on the unseen technical text, 2.89 against 2.70. Its training helps on literary text and hurts here.
- Counting the model file as part of the message, SmolLM2 (724 MB) gains 1.15 bits per character over xz on unseen text, so it pays for itself after about 5 billion characters. That is our arithmetic from those two numbers.
- Bits to send a known answer given its question, Qwen3, mean over prompts: a capital city 0.95 bits (20 prompts), a one-digit sum 1.29 (30), a three-digit sum 9.11 (30).

Our forecasts were 1.2 bits for SmolLM2 on the UDHR (got 0.27), 1.0 for Qwen3 (got 0.57) and 2.0 for SmolLM2 on the Gutenberg book (got 0.89).

## Limits

There is one unseen text, it is our own technical writing in one register, and it was added after we saw the headline numbers. That it was written after the models' training rests on its date. A technical log differs from the UDHR in style as well as in novelty; the cold PPM comparison suggests the difficulty gap is small, and a wider set of fresh texts across registers is needed before the size of the memorisation share can be stated. Both models are small. The round trip covered 120 tokens; the long-document figures are ideal code lengths. All UDHR and Alice rows for the language models carry the same contamination. Scoring was by our own code.

## Verified

Verified: every bits-per-character value in the table, the 10,637 and 30,000 character counts, the round trip on 120 tokens for both models, the answer costs 0.95, 1.29 and 9.11, the model file size 723,674,912 bytes, the shuffled-training values and the three forecast values were re-read from the study's result files on 2026-11-09 and match the ledger. The forecast file's hash matches its recorded hash. The 5 billion character payback is our arithmetic. Not re-run.

## Reproduce

Download SmolLM2-360M and Qwen3-0.6B from the Hugging Face Hub. For each text, tokenize, run the model, and sum minus log2 of the probability of each actual next token; divide by the character count. Confirm with an arithmetic coder on a short passage that the bits decode back to the same text. Compare with xz and an order-5 or higher PPM model, cold and pre-trained. Repeat on any text you can show was written after the models were released.

## Sources

- United Nations, Universal Declaration of Human Rights, translations as distributed in the NLTK udhr2 corpus.
- Lewis Carroll, Alice's Adventures in Wonderland, Project Gutenberg.
- SmolLM2-360M, Hugging Face model card; Qwen3-0.6B, Hugging Face model card.
