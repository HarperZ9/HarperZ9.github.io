# S20 fact-check: "Case study: our MMBU Challenge entry"

Independent check, 2026-10-17 (UTC), read-only against the primary files. Nothing outside this file was written. The digest (C:/dev/mission-control/2026-10-15-learning-platform/mmbu/DIGEST.md) was used as a map only; each verdict below cites the primary file.

Path keys: `M/` = C:/dev/mission-control/2026-10-02-mmbu/. `L:n` = D:/prereg-ledger/ATTESTATIONS.md line n (SHA-256 3dc0a51eff0a..., same bytes as the digest read). `E<n>` = ledger entry n. Script ids are `segment.line` (0-based line index in film.json `segments[].lines`).

## Counts

| | Correct | Reword | Wrong |
|---|---|---|---|
| Script sentences (film.json, incl. headings and the predict question) | 46 | 25 | 3 |
| evidence.json source cards | 11 | 5 | 1 |
| **Total** | **57** | **30** | **4** |

## WRONG items

1. **bar.1**, the FT4 rows sentence. Only 17 of the 20 slice 4 sources are tier Q2 ("inferred present" in MMBU by a name search; 3 of those confirmed by dev near-duplicates). DERM12345, FDG_PET_CT_LESIONS_AUTOPET and RIVA_PAP are tier Q1, "unknown; no term hit". The 29,421 rows also hold 1,039 format copies, a stated confound.
2. **bar predict question**, "Twenty of the benchmark's own sources". Same error.
3. **miss.1**, "a second pass over the same rows". After bar.1 this reads as FT4's rows. FT5 trained on FT4's rows minus slice 4: FT3A's rows plus the format copies. By rule P1 the slice 4 rows did not go forward, which the line before says.
4. **evidence `mmbu-ft4`**, "FT4 added 20 of the benchmark's own public sources". Same error as item 1.

## Script, sentence by sentence

| Id | Sentence (abridged) | Verdict | Source | Replacement or note |
|---|---|---|---|---|
| title.0 | Case study: our MMBU Challenge entry. | CORRECT | | |
| title.1 | "For two weeks this boatyard built a small model for a public contest, and wrote down every bar before every run." | REWORD | Brief read 2026-10-02 (M/BRIEF.md:3); pause 2026-10-16 23:31Z (M/STATUS-2026-10-15.md:471). "Two weeks" holds. FT3 amendment 1 was signed after FT3 training began (E53); the bars are fixed before each result, not each run. "Built" overstates a LoRA fine-tune. | "For two weeks this boatyard fine-tuned a small model for a public contest, and wrote down every bar before the result it would judge." |
| title.2 | Tonight Tallow opens the logbook... | CORRECT | | Framing only. |
| challenge.0a | MMBU is a biomedical image benchmark from Stanford MARVL, built from 410 public datasets. | CORRECT | M/sources/paper.txt:123, 248, 265 ("publicly accessible datasets", 410 selected of 440); site "Organized by Stanford MARVL" (M/sources/site.html; live site fetched 2026-10-17). | Note: the paper is a Stanford-led, multi-institution author list. |
| challenge.0b | Each question comes with an image: blood cells, chest X-ray, keyhole surgery. | CORRECT | M/diag/prior_gap.json families (chest radiograph, laparoscopic); paper.txt:198 (bone marrow). | |
| challenge.0c | "A model answers in one pass, with no tools and no second tries." | REWORD | Live site: "one pass per example", no tools. Each example has two separate prompts (task and context, M/BRIEF.md:69-74), which the next sentence describes, so "one pass" then "scored twice" reads as a contradiction. | "A model answers each question once, with no tools and no second tries." |
| challenge.1a | It is scored twice: answer, and context (image kind, body part, specimen). | CORRECT | M/BRIEF.md:71-72; S = 0.8T + 0.2C. | Optional: "the answer counts for 80 percent". |
| challenge.1b | "...at most the size of a 4-billion model, which the organisers set at 4.66 billion numbers." | REWORD | M/ORGANIZER-NOTES-DISCORD-2026-10-14.md:6 (2026-10-07, "Qwen3.5-4B at 4.66B"); brief of 2026-10-09 (M/train/b4/PREREG-B4.md:28). The live challenge page (fetched 2026-10-17) still says "≤ 4B active parameters and ≤ 12B total". | "...at most the size of a 4-billion model, which the organisers' brief sets at 4.66 billion numbers (the web page still says 4 billion)." |
| challenge.2a | "...two open models from the Qwen 3.5 family, with about 2.3 billion and 4.7 billion numbers, by adding small LoRA strips of rank 16 and freezing the part that sees." | REWORD | E58 L:1187-1189: 2,274,069,824 and 4,659,865,088. "4.7 billion" reads as over the 4.66 limit; the 4B is exactly the limit. LoRA r16, language model only, vision tower frozen (M/train/PREREG.md:23; M/train/ft2/PREREG-FT2.md:44). In LoRA every base weight is frozen, so "freezing the part that sees" implies the rest was retrained. | "...with about 2.3 billion and 4.66 billion numbers, the second exactly at the limit. We left both models' own weights untouched and trained small LoRA strips of rank 16 on the language side only; the part that sees got no strips." |
| challenge.2b | "We trained on 86 public sources, every one disclosed, under the organisers' rule: all datasets are acceptable as long as disclosed." | REWORD | M/DATA-DISCLOSURE.md table: 86 sources across all runs (counted: 34 Q2, 1 Q2 confirmed, 51 Q1). The candidate FT7 used 67 (M/STATUS-2026-10-15.md:266). CORN_CCM_IMED is "restricted access granted on request" (DATA-DISCLOSURE.md:39); MATEK is TCIA. Nothing is submitted, so "disclosed" means listed in our file. The quote is organiser Discord guidance; the notes say the brief is the rule of record (ORGANIZER-NOTES:4, 8). | "Across all runs we trained on 86 sources, almost all open downloads and a few by access request, every one listed in our disclosure file, under the organiser's ruling that all datasets are acceptable as long as disclosed." |
| challenge.3a | This is benchmark work. Nothing here is a medical tool. | CORRECT | | No medical claim anywhere in the script. |
| challenge.3b | "...every score in this lesson is our own local stand-in for the contest's judge, which agreed with a hand check on 175 of 180 answers." | REWORD | M/STATUS-2026-10-12.md:54-58 and E48 L:888-891: the "hand check" was "graded by this session", the Claude lead session, "the same model family as the official judge". Sample: 180 non-detection rows from FT2r and Z4 on dev 94126985. "Which" can attach to the judge. Context, format and held-out scores are local scorers, not JP1. | "...every score in this lesson comes from our own local scorers, never the contest's judge. Our stand-in for the judge's answer grading agreed with a blind re-grade on 175 of 180 earlier answers; that re-grade was done by the AI session running the project, not by a person." |
| bar.0a | "Before every run, we wrote down the comparison that would decide it, and the bar it had to clear." | REWORD | Ledger header L:3-5; E53 (an FT3 amendment after training began, before any score). Only our unpushed record backs the order (see ledger). | "Before each result, we wrote down the comparison that would decide it, and the bar it had to clear." |
| bar.0b | "The usual bar: on the 3,091 public practice questions, the new model minus the old one, ... lower end sits above zero." | REWORD | Some bars are non-inferiority margins: K2, M4, N5 (lower bound above -0.02), N3 (above -0.01) (M/train/ft7/PREREG-FT7.md:28-30; bars_ft5/6/7.json). FT4's H1 was decided on 3,102 rows (M/train/ft4/bars_ft4.json n; parent.json H1 [-0.0074, -0.0184, 0.0039]); 3,091 is the later re-score. | "The usual bar: on about 3,100 public practice questions, the new model minus the old one, with an interval from a paired bootstrap whose lower end sits above zero. A few bars only ask that a score not fall by more than a set margin." |
| bar.1 | "The fourth run added 20 public datasets that the benchmark itself was built from, 29,421 training rows in all." | **WRONG** | M/train/ft4/PREREG-FT4.md:15-18 (slice 4 is "MMBU's public source datasets, plus RIVA_PAP, DERM12345 and FDG_PET_CT"; 1,039 format copies); M/DATA-DISCLOSURE.md:47, 53, 96 (those three are Q1); M/slice4/BUILD-SLICE4.md:20 (3 sources confirmed by dev near-duplicates). | "The fourth run added 20 public datasets, 17 of which look like sources the benchmark was built from, plus extra copies of format examples: 29,421 training rows in all." |
| bar.predict | "Twenty of the benchmark's own sources. Did the practice answers go up?" | **WRONG** | As bar.1. | "Seventeen of the benchmark's likely sources, and more. Did the practice answers go up?" |
| miss.0a | "No. The difference was -0.007, with an interval from -0.018 to 0.004." | CORRECT | M/train/ft4/bars_ft4.json H1 [-0.0074, -0.0184, 0.0039] (decision, 3,102 rows); bars_ft4_excl12.json [-0.0074, -0.0184, 0.0036] (3,091). Both round the same. | |
| miss.0b | Zero inside, bar missed, those rows did not go forward. | CORRECT | M/train/ft5/PREREG-FT5.md:23; parent.json. | |
| miss.1a | "The fifth run tried a second pass over the same rows." | **WRONG** | M/train/ft5/PREREG-FT5.md:23, 28-29: parent FT3A_4B, rows "FT4 rows minus the slice 4 rows: FT3A plus the format copies", one more epoch at lr 5e-5. | "The fifth run went back to the champion and gave it a second pass over its own training rows." |
| miss.1b | "Up 0.001, interval -0.007 to 0.009. Another miss." | CORRECT | M/train/ft5/bars_ft5.json K1 [0.001, -0.0071, 0.0091]. | |
| miss.1c | "More of the same was not the lever." | CORRECT | E67 L:1427 "epochs are not the lever". | |
| miss.2 | A miss is a result... | CORRECT | | |
| prior.heading | "Below a guess" | REWORD | The candidate (0.2294) is above chance (0.2074) and below only the oracle (0.2368) (M/diag/baselines.json). | "Below the label prior" or "Between a guess and a cheat". |
| prior.0a | "Then a worrying number. Our candidate model got 22.9 percent of the practice answers right." | REWORD | The baselines came at E58, when the candidate was FT3A_4B (0.2161 [0.2016, 0.231] on 3,091, M/train/ft7/bars_ft7.json arms). 0.2294 [0.2142, 0.2446] is FT7_4B, weeks of story later. No interval given. | "Then a worrying number. The candidate at the time, the third run's model, got 21.6 percent of the practice answers right (interval 20.2 to 23.1); even our final candidate gets only 22.9." |
| prior.0b | "Picking at random among the judge's options would score 20.7." | REWORD | M/diag/baselines.py:4-6: expected score of a uniform pick among the closed options the judge sees. Our model never sees those options (E63 L:1323-1325). A lay reader will think the model lost to a coin. | "A guesser who could see the judge's option list, which our model never sees, would average 20.7." |
| prior.0c | "Always giving each kind of question its most common answer, an oracle that peeks at the other answers, would score 23.7." | CORRECT | M/diag/baselines.py:7-9; baselines.json 0.2368. | |
| prior.1a | "We gave an earlier run blank images... fell from 20.9 percent right to 8.2." | REWORD | M/diag/image_audit.json: FT4_4B, 0.2087 to 0.0819, real minus blank +0.1268 [0.1129, 0.1411]. Missing interval and run name. | "We gave the fourth run blank images in place of every picture. Its answers fell from 20.9 percent right to 8.2, a drop of 12.7 points with an interval of 11.3 to 14.1." |
| prior.1b | "It looks." | REWORD | evidence `mmbu-audit` does_not_prove: "only that it uses it". | "It uses the picture, though this does not show it uses it well." |
| prior.2a | "For that run, the loss sat in a few families." | CORRECT | M/diag/prior_gap.json (FT4_4B; two families give about 62 of the 87-row gap). | |
| prior.2b | Chest X-ray regions: 2 of 82; common answer 40. | CORRECT | prior_gap.json worst_families [38, ..., 82, 2, 40]. | |
| prior.2c | 51 percent named none of the judge's options. | CORRECT | prior_gap.json off_taxonomy 0.5134. | |
| knows.0 | "So we asked the model a different way... showed it each option and measured how likely it found each one." | REWORD | The scored model is FT5_4B (M/diag/option_readout_FT5_4B.json); the reader last heard of FT4 and FT7. Evaluation only; the contest allows one generated reply. | "So we asked the fifth run's model a different way, for our eyes only, since the contest allows only a written reply: we showed it each option and measured how likely it found each one." |
| knows.1a | "Its favourite option was right 41 percent of the time. Its written answers were right 20 percent of the time." | REWORD | option_readout_FT5_4B.json: 2,654 single-label region and classification rows; R1 0.4137, G 0.1967, difference +0.217 [0.198, 0.236]. Missing denominator and interval. | "On 2,654 questions with one right label, its favourite option was right 41 percent of the time and its written answer 20 percent: a gap of 21.7 points, interval 19.8 to 23.6." |
| knows.1b | "It often knows the label and says it in other words." | REWORD | E68 L:1459-1462: "the gap is wording and label-space recall, not perception alone (inferred; teacher forcing over closed options is easier than open generation)". Overclaims a mental state. | "Picking from a list is easier than writing an answer, but the gap says much of the loss is in the words it writes, not in what it sees." |
| knows.2a | "The rule written before that readout picked the next step: teach the labels' own words." | CORRECT | E64 L:1340-1348 (rule fixed before any run); E68 L:1458 (set a). | Rests on the unpushed ledger, covered in the ledger segment. A first run crashed and its void readout is kept as INVALID (E67 L:1429-1437). |
| knows.2b | "The sixth run did, and answers on the region questions went up 0.026, interval 0.008 to 0.044." | REWORD | M/train/ft6/PREREG-FT6.md:39; bars_ft6.json M2: FT6_4B minus FT5_4B on 860 region rows. | "The sixth run did. On 860 region questions its answers beat the fifth run's by 0.026, interval 0.008 to 0.044." |
| rule.0a | The sixth run cleared every answer bar. | CORRECT | bars_ft6.json M1 to M4 met (M4 is a margin bar). | |
| rule.0b | Format bars; missed at 99.8 percent where the bar was 99.9. | CORRECT | bars_ft6.json M5 Pass 2 0.9984 [0.9962, 0.9993] against at least 0.999. | It also missed M6 by one reply (3,090 of 3,091). Optional to add. |
| rule.1a | The model it would replace did worse, 99.6 percent. | CORRECT | M/train/ft7/PREREG-FT7-AMENDMENT-2.md:12 (FT3A_4B 0.9958). | |
| rule.1b | The bar would turn away its own champion. | CORRECT | AMENDMENT-2.md:15. | |
| rule.2a | We did not change the sixth run's verdict. | CORRECT | AMENDMENT-2.md:4; E79 L:1811-1813. | |
| rule.2b | New rule: replace when every answer bar is met and the format is no worse. | CORRECT | AMENDMENT-2.md:19-25. | Precisely: no worse by point estimate on three format measures, and N3 was added as a further answer bar. |
| rule.2c | "Signed while the seventh run was at step 20, before any of its answers existed." | CORRECT | E79 L:1810-1812 (signed 07:13:43Z; last train log step 20 at 07:13:18Z; train/ft7/runs absent). | The amendment file says "step 10" and "about 07:20Z"; E79's correction says the 07:20Z time is wrong. Unpushed record. |
| rule.3a | The seventh run met it. | CORRECT | M/train/ft7/ft7_candidate_rule.json replaces_candidate true. | |
| rule.3b | "On the contest's combined score, adjusted for model size, it was up 0.043 on the champion, interval 0.035 to 0.050." | REWORD | bars_ft7.json N4 [0.0425, 0.0354, 0.0498] is adjS from JP1, our proxy. | "On our stand-in for the contest's combined score, adjusted for model size, it was up 0.043 on the champion, interval 0.035 to 0.050." |
| rule.3c | It became the candidate. | CORRECT | ft7_candidate_rule.json new_candidate FT7_4B. | |
| words.0 | "On our own held-out sources, the seventh run's context score fell by 0.089." | REWORD | bars_ft7.json reported, held-out context FT7_4B minus FT6_4B -0.08946 [-0.1025, -0.07628], 1,006 rows, 732 clusters. Comparator and interval missing. | "On our own held-out sources, the seventh run's context score fell 0.089 below the sixth run's, interval -0.103 to -0.076." |
| words.1a | Learned to answer in the paper's words: X-ray, not X-ray imaging. | CORRECT | E71 relabel; E88 L:2019-2022 ("X-Ray Imaging to X-ray"). | |
| words.1b | Our held-out key still used each source's old words. | CORRECT | E88. | |
| words.2a | Rewrote the key; the fall became a rise of 0.152, interval 0.135 to 0.172. | CORRECT | E88 L:2031; M/train/heldout_vocab/heldout_vocab_ft7.json. | |
| words.2b | Same replies, different key. | CORRECT | E87 (evaluate3.py unchanged). | |
| words.3a | Neither key is neutral. | CORRECT | E88 L:2034. | |
| words.3b | "...for these two runs it is a measurement, not a test; only the eighth run's reading was written down first." | REWORD | PREREG-HELDOUT-VOCAB.md:43-44; E87. FT8 stopped at step 500 and was never scored (M/train/ft8/run_ft8_4b.log), so no preregistered reading exists. The harmonised score file was written 18 s after the prereg file (E89 correction, L:2053-2057). | "...for these two runs it is a measurement, not a test. The eighth run's reading was written down first, but that run was paused before it was scored, so the test has not happened." |
| lights.0 | Hours on one shared graphics card. | CORRECT | M/STATUS-2026-10-15.md:415-425. | |
| lights.1 | Lock, saves every 50 steps, watchdog restarts after a crash or reboot. | CORRECT | M/train/ft7/ft7_chain.py; E53 L:1018-1020 (50 steps since 2026-10-13); logon task restarts the watchdog after a reboot. | |
| lights.2 | Saved step 665 in about half a second; picked up after about 6.2 hours with nothing lost. | CORRECT | E84 L:1916-1924 (0.53 s, 0 steps lost, about 6.2 h off). | Optional: "with no training step lost". |
| lights.3a | The failures cost more. | CORRECT | | |
| lights.3b | A branch never run idled the card about 10 hours. | CORRECT | M/STATUS-2026-10-15.md:118-123. | |
| lights.3c | After an app restart, two trainers ran at once and cost 40 steps. | CORRECT | E73 L:1660-1672. | |
| lights.3d | Fail closed: if the check cannot tell, it counts as alive. | CORRECT | E75 L:1722-1725. | |
| ledger.0a | "Every bar was fingerprinted into a ledger before its result." | REWORD | For entries 28 to 89 the order rests on the ledger's own text (L:1414, 1808, etc., "Not committed by the signer"). | "Every bar was fingerprinted into a ledger, and the ledger says each one came before its result." |
| ledger.0b | "Today the fingerprints of all 19 rule files still match." | REWORD | Re-hashed 2026-10-17 with sha256sum: 16 files match a full SHA-256 in the ledger. FT5 amendment 1, FT5 amendments 2-3 and FT6 amendment 1 appear only as 8-hex prefixes (684e83c0, 85ece906, 7859687c at L:1184, 1234, 1438), and those prefixes match. | "Today all 19 rule files still match the ledger: 16 by their full fingerprint, 3 by the short prefix the ledger recorded." |
| ledger.0c | "That proves the files have not changed since they were fingerprinted." | REWORD | Entries 28 to 89 are uncommitted edits to a local file (`git status`: M ATTESTATIONS.md, +1,548 lines). A file and its local hash line could be changed together. | "That proves each file still matches the fingerprint written beside it. For entries never pushed, it cannot rule out that both were changed together." |
| ledger.1a | When they were fingerprinted is another matter. | CORRECT | | |
| ledger.1b | Meant to be pushed to GitHub, which stamps the time, before each result. | CORRECT | L:3-5; L:23-26 ("GitHub's push event log is the independent timestamp"). | |
| ledger.1c | Only entries up to 27 were, the last on 4 October. | CORRECT | `git log origin/main`: 4f0d39e "Entry 27", 2026-10-04T09:57:29Z; local HEAD = origin/main; gh api pushed_at 2026-10-04T10:16:13Z. | Numbering has duplicates (two 6s, three 23s) and no 36, recorded in the ledger. |
| ledger.1d | Entries 28 to 89 sit in our own file; the repository is private. | CORRECT | `git status`; gh api visibility "private". | |
| ledger.2a | "So for most of this story, before the score rests on our own word." | REWORD | Every run in this lesson (FT4 prereg L:1120, onward to FT8 L:2043) is in an unpushed entry. The sentence also parses badly. | "So for every run in this lesson, the claim that the bar came before the score rests on our own word." |
| ledger.2b | Like the receipt in lesson E25, a fingerprint proves the bytes, not the hour. | CORRECT | media/school/receipts/film.json ("cannot prove the rows were true when they were written"). | E25 is "draft" in curriculum.json and is not in S20's `needs` (S19, L16, E24). Check it ships first. |
| ledger.2c | That is our gap, and it is in the log. | CORRECT | | |
| close.0a | Seventh run is the candidate, packaged and checked; nothing submitted. | CORRECT | M/STATUS-2026-10-15.md:467, 474. | Date-bound: add "as of 16 October" if the page can outlive it. |
| close.0b | The eighth run stopped at step 500 of 1,918 when the author paused the work. | CORRECT | M/train/ft8/run_ft8_4b.log last line step 500 of 1918, 23:30:08Z; FT8.stop; STATUS-2026-10-15.md:471. | |
| close.0c | The contest runs to 31 December 2026. | CORRECT | Luma window to 2026-12-31 23:30 Pacific (M/BRIEF.md:91); organiser Discord (M/AMENDMENT-ORGANIZER-ANSWERS-2026-10-03.md:25). The live site and brief state no date. | |
| close.1 | "In the lab, you can redo the logbook's intervals yourself, digit for digit, from the published scores." | REWORD | facts.json recomputed 8 intervals (K1, M1, N1, N3, N4, N5, both vocab). H1, M2, the option and audit intervals in the script are not in the lab. | "In the lab, you can redo eight of the logbook's intervals yourself, digit for digit, from the published scores." |

## evidence.json, card by card

| Card | Verdict | Source | Replacement or note |
|---|---|---|---|
| mmbu-paper | CORRECT | arXiv abs page fetched 2026-10-17 (v1 4 June 2026, first author Ryan D'Cunha); paper.txt:123. | |
| mmbu-brief | REWORD | Live site, fetched 2026-10-17: Track 3 "≤ 4B active parameters and ≤ 12B total", no date. 4.66B is in the 2026-10-09 brief and the 2026-10-07 Discord note. | "...Track 3 for models up to a 4B model (the web page: at most 4B active, 12B total; the brief of 9 October: 4.66 billion total parameters), scaled by (4.66e9 / P)^0.1..." |
| mmbu-organiser | CORRECT | ORGANIZER-NOTES:6-8. | Note the file's own caveat: guidance, the brief is the rule of record. |
| mmbu-prereg | REWORD | STATUS-2026-10-12.md:54-58; E48 L:888-891; bars_ft4.json n 3,102. | Replace the JP1 sentence: "JP1 agreed with a blind re-grade of 180 earlier dev answers (FT2r and Z4, dev 94126985) on 175, with no false accepts; the re-grade was done by the Claude lead session, the same model family as the official judge." n: "3,091 dev questions for FT5 to FT7; FT4 was decided on 3,102 and re-scored on 3,091." |
| mmbu-ft4 | **WRONG** | PREREG-FT4.md:15-18; DATA-DISCLOSURE.md:47, 53, 96. | "FT4 added 20 public sources, 17 of them inferred MMBU sources (tier Q2), plus 1,039 format copies (29,421 rows); H1 ... -0.007 [-0.018, 0.004], not met (decided on 3,102 rows; 3,091 after the 12-row exclusion)." |
| mmbu-ft5 | REWORD | PREREG-FT5.md:23, 28-29. | "K1, one more epoch from FT3A_4B over FT3A's rows plus the format copies: +0.001 [-0.007, 0.009], not met." |
| mmbu-baselines | CORRECT | baselines.json; baselines.py:4-9. | |
| mmbu-audit | CORRECT | image_audit.json. | |
| mmbu-prior | CORRECT | prior_gap.json. | |
| mmbu-option | CORRECT | E64, E68; option_readout_FT5_4B.json. | |
| mmbu-ft6 | REWORD | PREREG-FT6.md:39. | "M2, region-question answers, FT6_4B minus FT5_4B on 860 rows: +0.026 [0.008, 0.044], met; ..." |
| mmbu-amend2 | CORRECT | E79 L:1808-1827. | |
| mmbu-ft7 | CORRECT | bars_ft7.json; ft7_candidate_rule.json. | N3 is also a margin bar (0.01). |
| mmbu-vocab | CORRECT | E87, E88. | Add: "FT8 was paused before scoring, so no preregistered reading exists." |
| mmbu-survival | CORRECT | E84, E73, E75, STATUS-2026-10-15.md:118-123, 471; run_ft8_4b.log. | |
| mmbu-ledger | REWORD | sha256sum re-run 2026-10-17; L:1184, 1234, 1438. | "All 19 files match: 16 to a full fingerprint, 3 to the 8-character prefix the ledger recorded..." n: "Entries numbered 1 to 89 (92 headings; duplicates and a missing 36 are recorded in the ledger)." |
| ns-recompute | CORRECT | facts.json recomputed, equal true for all 8. | Not re-run independently here. |

## Other flags

- **Medical claims:** none. "Nothing here is a medical tool" stands.
- **Numbers missing their interval:** prior.0a (22.9), prior.1a (blank-image drop), knows.1a (41 vs 20), words.0 (-0.089). Replacements above add them.
- **Lay misreadings:** "hand check" (a model re-grade), "below a guess" (the guess sees the options), "4.7 billion" against a 4.66 limit, "the model" in knows.0 meaning FT5, "the same rows" in miss.1.
- **Checked and correct as written:** two weeks; 4.66B as the organisers' figure; frozen vision tower; FT4 vs FT7 and FT5 vs FT6 attributions of every interval; chance and oracle definitions; the option rule fixed before the readout (E64); format bar 0.999 vs 0.9984 and the champion's 0.9958; amendment 2 at step 20 with no FT7 output; vocabulary re-score post hoc for FT6 and FT7; survival numbers; 27 entries pushed, last 4 October, private repo; nothing submitted; FT8 at step 500 of 1,918; deadline 31 December 2026.
