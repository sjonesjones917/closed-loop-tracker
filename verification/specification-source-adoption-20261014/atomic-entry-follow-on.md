# Minimum atomic-entry follow-on within the existing manifest

Status: proposal for a separately authored and independently challenged change. This batch does not implement or approve an atomic-entry format.

The authoritative artifact remains `specification/closed-loop-normative-requirements.json`, schema `closed-loop-normative-requirements/1`. No second requirement universe, controller, or manifest is needed. Current source coverage is useful but does not establish the distinct-obligation completeness required by §2.2.

## Small compatible change to propose and review

1. Keep each requirement's exact source path, line range, full source-line hashes, owner/test/proof relationships and current disposition. Add a reviewed clause/component discriminator plus exact quoted source span(s). A span needs a declared offset unit, start/end offsets, exact text, and digest; UTF-8 byte offsets over the immutable source are unambiguous. Compound obligations that depend on shared modifiers retain explicit links to those modifiers instead of treating the fragment in isolation.
2. Let `requirements` contain multiple rows anchored to one physical line. Preserve `normativeRequirementId` uniqueness. For newly separated components, derive IDs from source identity, source spans and a stable reviewed component discriminator, not a transient array index or test result. Preserve an existing ID only for an actually unchanged one-to-one obligation; do not transfer a compound line's existing proof wholesale to its children.
3. Keep `sourceLineCoverage` as the one complete physical-line coverage map, but allow its `normativeRequirementIds` to name every applicable component on that line. Validate exact membership against the independently extracted/reconciled component set, with no empty normative mappings, duplicate IDs, missing components, unexplained extras, or lost cross-line modifiers.
4. Extend the existing source review and reconciliation inputs to carry those independently authored components and the one-to-one/one-to-many/retired-source-context ID crosswalk. Record old compound IDs as historical mapping information. These are evidence inputs to the same authoritative manifest, not a parallel requirement manifest.
5. Keep atomic completeness false until the distinct independent challenge and reconciliation cover the complete source/component universe. A migrated owner/test link is a candidate relationship until actually reviewed; execution evidence remains stale until genuinely reexecuted against the frozen current inputs.

## Existing assumptions that must change together

- `generate-specification-governance.mjs`: the `by` map, `requirementIdentity`, addition validation, `reqLine`, section membership, and source-line coverage currently identify one row per line. A mechanical candidate is a source anchor, not the final atomic requirement definition.
- `specification-governance-core.mjs`: `byLine`, the `Duplicated normative line` rejection, the one-ID `Normative line not mapped exactly once` guard, source-addition lookup, and mutation fixtures must become component-aware while preserving all exact source and missing/duplicated requirement controls.
- `review-specification-coverage.mjs`: retain its mechanical omission check as a candidate check. The independently reviewed component evidence supplies semantic atomicity; keyword splitting cannot certify it.
- `verification-evidence.mjs` and the existing normative-context/full-coverage consumers must use the reviewed new membership and crosswalk, not the old hardcoded context set or a source-line count as an atomic denominator. The read-only dependency report identifies 164 historical full-coverage declarations needing genuine review after the IDs stabilize.
- Each full-coverage declaration and acceptance metric must enumerate the actual atomic IDs and their owning proof. Splitting a line cannot manufacture more passing observations from one unrelated test.

## Representative compound source clauses

- §2.1, line 98: exact source authority; generation of both repository-only manifests; required source/identity inventory fields; manifest cross-binding; and the prohibition on a self-referential source digest are separate independently testable obligations in one physical paragraph.
- §14.5, line 1072: an undefined field contract must receive the prescribed blocker, block specification acceptance, and be resolved through a specification change rather than an implementation choice.
- §34.1, line 2884: registered hash preimages, exact scope dimensions, exact terminal records, undefined-preimage blocking, default array order, and the complete explicit set-pointer contract share one physical line. A single generic hash test cannot stand for all of them.
- §45.2, line 4924: allowed evidence submission channels and submitter recording; challenge single-use; rejection of reused/unknown/expired challenges; each build/origin/target/project binding; a fresh superseding challenge; the physical-observation evidence floor; and honest evidence labeling share one physical paragraph.

Permanent controls should omit one component while retaining its sibling on the same line, duplicate a component ID, alter a span or governing modifier, falsely carry a parent proof to children, and overclaim atomic completeness. Each invalid case must fail and its unchanged fully reviewed positive control must pass.

This is a representational/acceptance-evidence dependency. It does not justify inventing unresolved runtime semantics or changing the exact supplied source.
