# crucible report: Binary search comparison bounds

## Summary

- thesis_id: `bd7404c02eb2036e`
- thesis_seal: `bd7404c02eb2036e5e77283b865758db140d7047cb4749790aec60897dfe10a8`
- assessment_seal: `3c7f449900263ca00e7be049af12b8e39dfe19d1dad25bbf39bde94686227618`
- counts: MATCH 1 / DRIFT 1 / UNVERIFIABLE 1
- integrity: seals_ok=True, thesis_ok=True, verdicts_rederive=True

## Verdicts

| Claim | Status | Disposition | Margin | Method | Grounds |
| --- | --- | --- | ---: | --- | --- |
| binary search over a sorted array of 1024 elements does at most 11 comparisons | MATCH | publishable | 1 | comparison-count | deviation 0 within tolerance 0.5 |
| binary search over a sorted array of 1024 elements does at most 3 comparisons | DRIFT | publishable | -15 | comparison-count | deviation 8 exceeds tolerance 0.5 |
| binary search is more elegant than linear search | UNVERIFIABLE | publishable |  | none | claim states no falsification condition |

## Measurement Evidence

| Claim | Method | Evidence |
| --- | --- | --- |
| binary search over a sorted array of 1024 elements does at most 11 comparisons | comparison-count | worst-case probes for n=1024 is floor(log2(1024)) + 1 = 11 |
| binary search over a sorted array of 1024 elements does at most 3 comparisons | comparison-count | worst case is 11, claimed bound 3, excess 8 |

## Unmeasured Claims

- binary search is more elegant than linear search
