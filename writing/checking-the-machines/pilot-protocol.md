# A first test of portable evidence records

Proposed research protocol · 20 September 2026 · For author and independent-methods review

This protocol accompanies *An Open Letter on Checking the Machines*. It has not been preregistered or run. It is a proposed low-risk experiment, not a deployment standard. It does not test whether AI systems are generally safe.

## Question and hypotheses

Does a portable evidence packet help a reviewer distinguish an erroneous AI-assisted analysis from a correct analysis, compared with the ordinary output and source links, under the same review-time allowance?

The primary hypothesis concerns the proportion of known erroneous analyses that reviewers accept. Secondary questions concern rejection of correct work, unresolved cases, preparation cost, review time, and confidence calibration. A reduction in accepted errors would have to be considered alongside those other outcomes. A method that prevents errors only by leaving almost everything unresolved may have little practical value.

## Task and limits

Use calculations and short source-grounded explanations drawn from public, non-personal datasets. Define the permitted interpretations and calculation tolerances before constructing submissions. Preserve an immutable copy of each source. Test cases may contain a changed input, a missing qualifier, a unit mismatch, an omitted failed attempt, or an incorrect calculation. Include correct submissions and genuinely underdetermined cases.

The work must have no authority over anyone's employment, health care, money, legal status, or access to a service. Exclude private communications and operational security data. No study submission may execute arbitrary code, access external accounts, or actuate a physical device. Any executable checker must be separately reviewed and run in a constrained environment. Represent hostile or malformed records as inert test data.

## Study arms and allocation

The comparison arm receives a completed analysis with the source links and ordinary supporting material. The evidence arm receives an equivalent analysis plus the proposed packet. Preserve the same underlying answer, defect distribution, and source availability across arms. Record any additional information in the packet so that an observed effect is not attributed merely to its format.

An optional third arm can receive the same substantive evidence in ordinary files without the receipt interface. That comparison would help distinguish the effect of more evidence from the effect of packaging and replay. Treat it as optional until resources and statistical power are assessed.

Randomize task versions and reviewers within prespecified experience strata. Each reviewer should encounter only one version of a particular case. Counterbalance task order and prevent access to the withheld answers. Analyze dependence between judgments by the same reviewer and repeated uses of the same underlying task. Participants cannot be blinded to the visible interface; blind the defect labels and adjudication where possible.

Set the review-time allowance in advance. Count preparation and maintenance time separately; do not treat them as free because they occur before review. Use the same training and access to support for each arm.

## Packet and verdict design

A packet identifies the claim, source snapshot, relevant context, output, software versions, and check definition. It names exclusions and unavailable evidence. It records the scope of permitted actions and the observed result where an action occurred. It states the conditions under which a check can be replayed and any tolerance used.

Keep separate fields for source integrity, check execution, check result, missing evidence, and permission status. A digest match cannot automatically populate a correctness field. A reviewer should be able to see that a test was skipped without mistaking the record for a successful test. Model-generated assessments must be labeled and kept distinct from deterministic checks.

Construct two checking implementations from the public specification. Use independent authors where feasible, record shared dependencies, and test their agreement on both valid and defective cases. Include cases where both checkers conform to a flawed specification. Agreement alone is not the study endpoint.

## Outcomes and analysis

Define the primary accepted-error rate as accepted erroneous cases divided by all assigned erroneous cases with an eligible reviewer outcome. Report the complete assigned denominator and explain any exclusion. Separately report accepted errors as a share of all accepted work, because that answers a different question. Neither denominator should silently replace the other.

Report rejection of correct work against the assigned correct-case denominator. Give unresolved cases their own count and proportion. Report completion within the time allowance and the distribution of preparation and review times. Measure confidence using a prespecified scale, including confidence that a receipt establishes more than its stated scope.

Publish raw counts with uncertainty intervals that account for task and reviewer clustering. Determine sample size before the confirmatory run using a stated minimally useful effect, plausible baseline error rate, and clustering assumptions. Use a separate exploratory pilot to estimate those quantities. No sample size or effect is claimed to be adequate before that work is done.

Specify missing-data handling, multiplicity treatment for secondary outcomes, and the criteria for excluding a task before outcomes are opened. Publish deviations from the plan. Do not replace the primary endpoint because a secondary result looks more favorable.

## Adjudication, privacy, and stopping

An independent group establishes the reference answers and defect labels before randomization. A disputed reference answer triggers a documented review with the affected case retained in a sensitivity analysis where feasible. Record disagreement rather than letting the tool's verdict settle its own ground truth.

Collect only the participant information required for the study. Obtain appropriate consent and any applicable institutional review before recruitment. Publish de-identified results and agree retention periods for participant records. Public task evidence and personal study data require different access rules.

Pause collection after an unexpected external action, exposure of private data, or a defect that compromises allocation or answer secrecy. Preserve the incident record. Resume only after reviewing its effect on participant risk and study validity.

## What would count against the proposal

The proposal would lose support in this setting if the packet fails to reduce accepted errors, substantially increases rejection of correct work or unresolved cases, consumes more review resources than its benefit justifies, or increases confidence without improving discrimination. Set the acceptable tradeoffs before the confirmatory run.

Publish null findings and the complete costs. A favorable result would support replication in another bounded task with different reviewers. It would not establish capture resistance, legal sufficiency, general model capability, or safety in consequential deployments.

## Research context

The design draws methodological motivation from [Attack Selection in Agentic AI Control Evaluations Meaningfully Decreases Safety](https://arxiv.org/abs/2606.06529v1) and [Control Tax](https://arxiv.org/abs/2506.05296). Their publication summaries were inspected during the preceding research review; their experiments were not rerun. Its allocation, endpoint definitions, and falsification conditions are proposals made for this project. No external paper is claimed to have validated this exact design.

AI assistance: ChatGPT helped draft this protocol. Publication of this proposal does not constitute independent statistical or ethics approval. Recruitment and a confirmatory experiment require further review.
