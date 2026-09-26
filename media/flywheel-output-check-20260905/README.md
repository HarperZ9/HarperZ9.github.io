# Flywheel: check the summary

Recorded September 5, 2026 with [Flywheel source 5a9f842](https://github.com/HarperZ9/flywheel/tree/5a9f8429c511dd6eccd9b0d5833f1c4bf5f617f3), version 0.3.11.

[Watch the video or read the text equivalent](../../flywheel.html#demo).
The video typesets actual checker output against synthetic inputs. It is not a
screen recording, a real CI run, or a model correcting itself.

## Reproduce

Use a checkout of the linked Flywheel source, whose license is FSL-1.1-MIT.
Copy this example's JSON files into a directory. From that directory, run the
following commands, replacing `PATH_TO_FLYWHEEL` with your checkout location:

```sh
python PATH_TO_FLYWHEEL/scripts/run_output_check.py --contract task.contract.json --answer answer-wrong.json --json
python PATH_TO_FLYWHEEL/scripts/run_output_check.py --contract task.contract.json --answer answer-matched.json --json
python PATH_TO_FLYWHEEL/scripts/run_output_check.py --contract task.contract.json --answer answer-uncited.json --json
```

These checks need no model, network request, or API credits. The nonzero exit
codes below are expected results, not installation failures.

| Input | Result | Fields confirmed | Exit | Captured output |
|:--|:--|:--|:--|:--|
| Claims 42; supplied record contains 41 | FAIL / HOLD | 0 of 1 | 1 | [JSON](report-wrong.json) |
| Claims 41 and names its source | PASS / RELEASE | 1 of 1 | 0 | [JSON](report-matched.json) |
| Claims 41 without a citation | UNVERIFIABLE / HOLD | 0 of 1 | 3 | [JSON](report-uncited.json) |

Inputs: [contract](task.contract.json), [synthetic record](test-results.json),
[wrong answer](answer-wrong.json), [matching answer](answer-matched.json),
[uncited answer](answer-uncited.json).

RELEASE is the answer-release decision for one structured field. It does not
mean a software release, a passing test suite, or general correctness. The caller
chooses the contract and must trust the supplied source. The run ID selects a
record; it does not authenticate that record or its author. These cases are not
a performance benchmark or evidence of customer deployment.

## Media

- `short.mp4`: 36 seconds, 1080 by 1920, 24 fps, silent H264, drawn for light pages.
- `short-dark.mp4`: the same cut drawn for dark pages. The page plays the one that matches the reader's theme.
- `poster.png` and `poster-dark.png`: the opening card after the record line appears, in each theme. They are title cards, not product screenshots.
- `captions.vtt`: English captions matching the cut.

The checks ran on September 5, 2026. On September 25, 2026 the six cards were redrawn in the site's
two typefaces with the same checker output, captions and timing; the redrawn frames carry no commit
id or frame counter. The source commit stays linked at the top of this page.
Later the same day the frames dropped their footer caption and wordmark, which sat under the
browser's playback controls, and every label grew to 48px or more in the 1080px frame, so it stays
readable in the page's player. The page states the synthetic-input note in text beside the video.

Video SHA-256: `dab2e6ef2308de29319a6987da6e9e7c4309dbb3a623b1ce675b0579052c11e8` (light) and `0ee80c12f9751f6541ad0ee9f6fd01de0f91aceaf94d52b1a0c31c372d915fff` (dark).
