# Convergent Implementation Governance

This repository is implemented under a single-retained-state process. These rules govern repository advancement in addition to the application specification. They do not weaken any application, verification, deployment, evidence, or live-operator requirement.

## Single-Retained-State Invariant

At every implementation iteration there SHALL be exactly one canonical incumbent and at most one canonical candidate authorized to replace it. Parallel agents MAY independently analyze, challenge, test, or construct isolated candidate variants from the exact same identified base state. No isolated candidate, agent branch, stale packet, or competing pull request becomes canonical merely by existing or passing a subset of tests.

A candidate replaces the incumbent only after satisfying the fixed acceptance criteria applicable to that transition. Upon replacement, the resulting exact commit becomes the sole new incumbent, and all unresolved work derived from earlier repository states becomes stale and MUST be revalidated against the new incumbent before use.

Correct existing implementation is sticky: demonstrated-correct behavior is not replaced merely because another implementation is different or appears cleaner.

## Repository identities

Every evaluation epoch establishes and records:

- `SPEC_ID` and `SPEC_SHA256`;
- `BASE_COMMIT` and `BASE_TREE_SHA`;
- `CANDIDATE_COMMIT` and `CANDIDATE_TREE_SHA`;
- `ACCEPTANCE_EPOCH_ID` and the acceptance-system hash;
- `CURRENT_ACCEPTANCE_STATE`;
- `EARLIEST_KNOWN_FAILURE`;
- allowed implementation scope;
- known regressions;
- exact acceptance commands;
- prohibited actions.

Supplied historical identities are evidence claims until re-established from GitHub. Repository advancement invalidates packets derived from the superseded state.

## Immutable Agent Build Packet

Every implementation, exploration, challenge, or proof agent operates from an immutable packet containing at least:

`SPEC_ID`, `SPEC_SHA256`, `BASE_COMMIT`, `BASE_TREE_SHA`, `CANDIDATE_COMMIT`, `CANDIDATE_TREE_SHA`, `CURRENT_ACCEPTANCE_STATE`, `EARLIEST_KNOWN_FAILURE`, `ALLOWED_SCOPE`, `CONTROLLING_SPECIFICATION`, `REPOSITORY_FACTS`, `KNOWN_REGRESSIONS`, `ACCEPTANCE_COMMANDS`, `PROHIBITED_ACTIONS`, and `OUTPUT_CONTRACT`.

The packet identity is computed from the controlling specification, incumbent identity, candidate identity, current failure state, and acceptance definition. An agent response MUST identify its packet. A response generated from a superseded packet cannot directly modify the current candidate; it must first be replayed and revalidated against the new candidate identity.

## Parallelism boundary

Parallelism is applied to diagnosis, challenge, proof, and isolated experiments—not to uncontrolled canonical writes.

Exploration agents propose diagnoses and minimal corrections. Challenge agents attempt to falsify candidate correctness and find regressions, missing evidence, ownership violations, prompt leakage, stale-state defects, UI failures, Test IR defects, and other specification violations. Proof executors run predefined acceptance operations and return execution evidence; they do not redefine acceptance criteria.

Agent agreement is diagnostic evidence, never correctness proof. Materially distinct proposed corrections may be evaluated in isolated worktrees or sandboxes against the same fixed acceptance epoch. Only one selected correction may advance the canonical candidate lineage.

## Earliest-failure serialization

The repository repair scheduler follows:

`one observable failure -> earliest responsible layer -> smallest complete correction -> exact path replay -> affected downstream proof -> permanent regression`

If gates `G1..Gj-1` pass and `Gj` fails, `Gj` is the controlling frontier. Canonical repair work is directed to `Gj` or to an earlier responsible layer demonstrated to cause it. Later-stage cleanup, refactoring, architecture changes, or visual changes are not authorized by an earlier failure.

## Fixed acceptance epoch

For an evaluation epoch, the acceptance system is frozen as the identified set of tests, fixtures, workflow, and acceptance rules. Product changes are evaluated against that fixed system.

If execution demonstrates that the acceptance system itself is defective, that defect is recorded explicitly. The acceptance correction creates a new epoch, and the complete candidate is reevaluated from the beginning under the new epoch. A gate MUST NOT be silently weakened or changed merely so a candidate passes.

## Candidate dominance and atomic promotion

A candidate may replace the incumbent only when objective execution establishes all applicable conditions:

- the controlling frontier is fixed;
- previously passing required gates remain passing;
- required regressions pass;
- no new mandatory failure is introduced;
- specification conformance is maintained;
- change scope is authorized;
- proof is valid for the exact candidate identity.

Promotion is atomic. After promotion, the exact resulting commit and tree become the new incumbent and all outstanding packets derived from the prior incumbent are stale.

## CI serialization authority

CI is the serialization authority for repository advancement. The controlling order is:

`syntax -> schema/ownership -> migration -> Stage 01 -> Stage 04 -> Test IR/security/runtime -> ingestion -> workflow/gates/full cycle -> prompt semantics/leakage -> local browser`

A candidate is not merge-eligible until every required pre-merge layer passes for its exact current identity. Partial green status is not acceptance.

## Merge, deployment, and completion

Merge is not completion. After merge, establish the exact `MERGED_COMMIT` and `MERGED_TREE`. Deployment must originate from that exact main state. Required deployed artifacts must be retrieved and byte-compared against the intended repository/build artifacts.

Completion requires all applicable layers to agree:

`source acceptance AND merge acceptance AND deployment success AND deployed-byte identity AND deployed-browser acceptance AND exact operator-path replay`.

A successful workflow, successful deployment, or matching hashes alone is insufficient.

If deployed verification fails, preserve the exact failure as regression evidence, identify the earliest responsible layer, create the next candidate from current main, and repeat the same serialized process. Do not create competing repair PR futures.

## Agent convergence protocol

Every implementation agent is instructed:

1. Verify supplied repository identities before relying on them.
2. Reproduce the controlling failure.
3. Identify the earliest responsible layer.
4. Preserve already-correct mechanisms.
5. Make no unrelated change.
6. Add or preserve regression coverage for reproduced defects.
7. Execute the required affected acceptance chain.
8. Return exact evidence.
9. Report uncertainty as uncertainty.
10. Treat repository advancement after packet issuance as making the result stale until revalidated.

Agents MUST NOT create competing implementation PRs unless explicitly assigned an isolated experiment; redefine acceptance criteria to make an implementation pass; claim tests, deployment, byte identity, or live correctness without execution evidence; treat agreement as proof; merge because a candidate merely appears better; modify unrelated architecture or visuals; or continue from a superseded repository state without revalidation.

## Permanent convergence regressions

Repository governance records demonstrated convergence failures that must remain covered by executable tests. The current permanent set includes the Stage 25 dual-semantics defect in which aggregate final-representation coverage required strict structured `OBSERVATIONS` JSON while effective result adjudication still interpreted only legacy prose such as `NO DEFECTS`. The repaired invariant is: aggregate Stage 25 coverage and Stage 25 effective determination SHALL consume the same strict structured coverage semantics; malformed or incomplete coverage remains fail-closed, and a favorable submitted determination cannot override the application-derived result.

The permanent set also includes the Stage 27 ownership-fixture defect in which an external release-review fixture attempted to submit `CONTROLLING_DECISION_RULE`, `CONTROLLING_REASON`, and `AFFIRMATIVE_EVIDENCE`. Those fields remain `APPLICATION` owned. External Stage 27 review may provide advisory agent content only; release state, controlling rule, controlling reason, and affirmative release evidence are derived by the application from current canonical evidence.

The permanent set also includes the Stage 30 registry-accounting fixture defect in which an external response attempted to submit `DEFECT_RECORDS_MISSING_REQUIRED_FIELDS`. That count remains `APPLICATION` owned. External Stage 30 content may describe registry location, retention, integrity evidence, and custodial evidence only within its writable contract; mechanically observable registry completeness and missing-field counts are derived by the application.

The permanent set also includes the stale deployed-proof acceptance assertion that searched for an obsolete workflow label rather than the actual deployed-byte proof operation. The repaired invariant is: definition-of-done acceptance SHALL establish that the one retained Pages workflow contains the current exact deployed-byte verification step and actually executes `verify-live.mjs`; acceptance MUST NOT depend on obsolete display wording while missing the executable proof command.
