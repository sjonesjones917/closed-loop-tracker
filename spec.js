(function(global){
"use strict";
const STAGE_NAMES = [
"Initialize the job","Build the source inventory","Research the requirements","Compile the requirement specification",
"Resolve the requirement set","Build the verification suite before writing the production instruction","Build failure tests",
"Author the production instruction","Preflight the production instruction","Freeze the test candidate","Run ten independent executions",
"Verify each execution independently","Compare the ten executions","Root-cause every defect",
"Convert every confirmed failure into a regression test","Revise the responsible layer",
"Re-run the complete ten-execution iteration","Continue until convergence","Run an unchanged confirmation iteration",
"Freeze the production baseline","Generate the finished product","Run deterministic verification on the finished product",
"Run independent semantic verification","Run adversarial verification","Inspect the final representation",
"Reconcile process and product evidence","Apply the release gate","Verify artifact identity before release",
"Preserve the complete evidence chain","Preserve failures permanently"
];

const STAGE_INSTRUCTIONS = {
2:`Identify every source that may govern correctness.

For each source, record:
• source identifier;
• title or description;
• source type;
• origin;
• version;
• publication or effective date when relevant;
• authority level;
• whether it is mandatory, informative, or evidentiary;
• which portions are relevant;
• whether it conflicts with another source.

When current external facts affect correctness, research them using authoritative and current sources.
When the task depends on supplied files, inspect the actual supplied files rather than relying on filenames, summaries, or prior descriptions.
When multiple sources conflict, determine which source controls by applying the appropriate authority hierarchy for the task.
Do not silently choose between unresolved authoritative conflicts.
Record unresolved conflicts as blockers.`,
3:`For each source in the inventory:
1. Read the portions capable of imposing, limiting, or defining the requested result.
2. Extract every statement that changes what the final product must contain, omit, preserve, calculate, demonstrate, or accomplish.
3. Separate mandatory requirements from recommendations, examples, explanatory text, and optional practices.
4. Identify requirements created directly by the user’s request even when no external authority states them.
5. Identify requirements created by the intended output format or technical medium.
6. Identify requirements created by dependencies between parts of the deliverable.
7. Identify factual propositions that must be true for a requirement to apply.
8. Identify edge conditions and exceptions.
9. Record exact source evidence for each externally derived requirement.
10. Search specifically for requirements that could invalidate, contradict, or restrict requirements already found.

Continue research until another research pass produces no new material requirement category and every known controlling source has been examined.
Do not stop because the initial obvious requirements have been found.`,
4:`Create one atomic requirement record for every independently testable obligation.

Use this structure:
REQ_ID:
REQUIREMENT:
TYPE:
SOURCE:
SOURCE_LOCATION:
AUTHORITY:
APPLICABILITY:
DEPENDENCIES:
PROHIBITIONS:
VERIFICATION_METHOD:
EXPECTED_EVIDENCE:
FAILURE_CONDITION:
STATUS:

Write requirements so that two independent evaluators applying the same evidence should reach the same result.
Split compound requirements.
For every qualitative requirement, define what observable condition establishes satisfaction.
Do not use undefined criteria such as good, strong, professional, complete, correct, sufficient, appropriate, or perfect.
Replace each with measurable conditions.`,
5:`Check the complete requirement set for:
• duplicate requirements;
• conflicting requirements;
• requirements that cannot simultaneously be satisfied;
• undefined terms;
• circular dependencies;
• missing prerequisites;
• unsupported requirements;
• requirements whose applicability cannot be determined;
• requirements with no possible verification method.

Resolve every resolvable defect.
If a mandatory requirement cannot be resolved because required authority or evidence is unavailable, mark the affected work BLOCKED.
Do not proceed as though the requirement were satisfied.`,
6:`Create at least one verification procedure for every mandatory requirement.

Use:
TEST_ID:
REQ_ID:
TEST_TYPE:
INPUTS_REQUIRED:
PROCEDURE:
EXPECTED_RESULT:
FAILURE_CONDITION:
EVIDENCE_PRODUCED:

Choose the strongest available verification method in this order:
1. formal proof or exact computation;
2. deterministic programmatic test;
3. schema or structural validation;
4. exact source comparison;
5. rule-based evaluation;
6. independent semantic evaluation;
7. expert or authorized human judgment when the task requires it.

Do not use an AI evaluator for a property that can be deterministically checked.
Create separate tests for separate requirements.
Confirm that every mandatory requirement is covered.
Calculate mandatory_test_coverage = mandatory_requirements_with_tests / total_mandatory_requirements.
Do not proceed until mandatory_test_coverage = 1.00 unless a requirement is explicitly blocked and the workflow is stopping on that blocker.`,
7:`For every requirement, determine at least one way the requirement could be violated.
Construct malformed, incomplete, contradictory, stale, incorrect, or adversarial cases where applicable.
For each test, define the required system response.
The system must detect the defect, reject the affected result, or block the affected operation.
A validator that accepts a deliberately constructed invalid case is defective.
Correct the validator before continuing.`,
8:`Write the instruction from the compiled requirements, not directly from memory of the original request.

The instruction must explicitly specify:
Objective
Inputs
Source authority
Scope
Defined terms
Required procedure
Decision rules
Tool rules
Output contract
Failure handling
Completion criteria

Describe actual operations and their required order.
Do not use vague commands such as "Research all requirements" or "Verify the result."
Require TRUE → requirement established; FALSE → requirement violated; UNKNOWN → requirement not established.
Never permit UNKNOWN to be silently converted to TRUE.`,
9:`Use a separate evaluation process to inspect the instruction without executing the target work.
Examine every sentence for material ambiguity, undefined objects, unsupplied information dependencies, conflicts, unavailable capabilities, objective verifiability, responsible operation, ordering, failure behavior, and requirement/control traceability.
Correct every material defect.
Repeat preflight until no known material instruction defect remains.
Version the result as INSTRUCTION-vN.`,
10:`Freeze together:
INPUT-vN
SOURCE-SET-vN
REQUIREMENTS-vN
TEST-SUITE-vN
INSTRUCTION-vN
TOOL-CONFIGURATION-vN
Record hashes for file-based artifacts where practical.
Do not alter any frozen component during the iteration batch.
If anything must change, terminate the current batch and start a new version.`,
11:`Create ten fresh execution contexts.
Give every execution exactly the same frozen input, sources, requirements where intended, production instruction, and tool configuration.
Do not give any execution another execution’s output, reviewer comments, prior failure explanations, or proposed corrections.
Run all ten independently.
Store every output separately as RUN-001 through RUN-010.`,
12:`Run the complete verification suite against each result.
For every requirement and run, record REQ_ID, RUN_ID, RESULT = SATISFIED | VIOLATED | UNDETERMINED, TEST_ID, EVIDENCE, and DEFECT_ID if applicable.
Do not ask the generating agent whether its own work is correct.
Run deterministic validators independently.
Run semantic evaluation independently.
Run adversarial evaluation independently where applicable.`,
13:`Compare outcomes requirement-by-requirement.
Identify requirements satisfied by all ten; violated by one or more; producing inconsistent interpretations; outputs varying where variation is prohibited; requirements tests cannot conclusively evaluate; repeated failures; unique failures.
Do not select the best execution and discard evidence from the others.
Treat correctness-affecting variance as a defect requiring investigation.`,
14:`For each defect, determine the earliest layer at which the condition became incorrect.
Use SOURCE_DEFECT, RESEARCH_DEFECT, REQUIREMENT_DEFECT, TEST_DEFECT, INSTRUCTION_DEFECT, INPUT_DEFECT, EXECUTION_DEFECT, TOOL_DEFECT, or AUDIT_DEFECT.
Trace backward from bad output to execution compliance, instruction correctness, requirement correctness, and source authority/completeness.
Correct the earliest defective layer.`,
15:`For each confirmed defect:
1. preserve an example that reproduces it;
2. create a test that fails before the correction;
3. make the correction;
4. confirm the new test succeeds after the correction;
5. add the test permanently to the suite.
Record REG_ID, ORIGINAL_DEFECT_ID, REQ_ID, FAILURE_FIXTURE, DETECTION_METHOD, EXPECTED_REJECTION_OR_CORRECTION.
Do not remove the regression test while the governing requirement remains applicable.`,
16:`If research was wrong, redo the affected research.
If requirements were wrong, correct the requirements and every dependent artifact.
If tests were wrong, correct the tests and rerun affected validation.
If the instruction was wrong, correct the instruction.
If execution alone was wrong, preserve the instruction unless analysis establishes that additional constraint is required.
If tools were wrong, repair or replace the tool path.
Increment every changed artifact’s version.
Never modify a version in place.`,
17:`After any material change to source interpretation, requirement, production instruction, validator, tool configuration, or input contract, freeze the new versions and run ten new independent executions.
Do not continue the old conversations.
Repeat EXECUTE → VERIFY → COMPARE → ROOT-CAUSE → CORRECT → ADD REGRESSION TEST → RE-EXECUTE.`,
18:`After every iteration calculate mandatory requirement coverage, mandatory verification coverage, regression-test success, critical defects, major defects, mandatory unresolved unknowns, correctness-affecting contradictions, correctness-affecting ambiguities, and unexplained correctness-affecting execution variance.
Do not freeze the production instruction until all convergence conditions in the workflow are simultaneously true.`,
19:`After the first iteration satisfying all convergence conditions:
1. change nothing;
2. freeze exactly the same versions;
3. create ten new independent execution contexts;
4. execute the same production instruction again;
5. run the complete verification suite again.
If any new critical or major defect appears, return to root-cause analysis.
If a new requirement is discovered, return to requirement research.
If a test fails to detect an injected defect, return to test development.
Only establish the baseline after an unchanged confirmation iteration satisfies the complete acceptance criteria.`,
20:`Record exact approved versions:
BASELINE_ID
INPUT_CONTRACT_VERSION
SOURCE_SET_VERSION
REQUIREMENTS_VERSION
INSTRUCTION_VERSION
TEST_SUITE_VERSION
VALIDATOR_VERSION
TOOL_CONFIGURATION_VERSION
Hash every immutable file.
No changed component retains baseline status automatically.`,
21:`Create a fresh execution context.
Supply only the approved baseline materials required for production.
Generate the actual requested deliverable.
Record PRODUCT_ID, BASELINE_ID, EXECUTION_ID, OUTPUT_FILES, OUTPUT_HASHES.
Do not edit the output outside the controlled workflow.
If editing is required, create a new product version.`,
22:`Execute every applicable deterministic test against the actual generated artifact.
Check, where applicable, arithmetic, counts, schemas, filenames, file inventory, hashes, section presence/order, identifiers, duplicate identifiers, references, links, dates, enumerations, tables, required/prohibited text, package contents, structural constraints, and formatting dimensions.
Store actual test results.
Any failed mandatory deterministic test rejects the product.`,
23:`Give a separate evaluator the actual finished product, requirement registry, relevant source evidence, and evaluation rubric.
For each semantic requirement, require REQ_ID, PRODUCT_LOCATION, SOURCE_EVIDENCE, OBSERVED_MEANING, REQUIRED_MEANING, DETERMINATION.
Require SATISFIED, VIOLATED, or UNDETERMINED.
Do not accept unsupported statements such as looks correct, appears compliant, pass, or good.`,
24:`Attempt to disprove product correctness.
Search deliberately for missing required material, prohibited material, contradictions, impossible logic, unsupported facts, misrepresented sources, wrong versions, broken references, hidden assumptions, partial completion, semantic nonsense, inconsistent terminology, unhandled exceptions, stale external information, malformed generated files, visually hidden content, export corruption, and requirements technically mentioned but not actually satisfied.
A discovered defect returns the product to root-cause analysis.`,
25:`Audit the exact form that will be delivered.
If production contains transformations such as source → DOCX → PDF → ZIP, inspect the resulting final files.
Verify rendered pages, clipping, missing content, blank pages, broken tables, misplaced graphics, material font substitution, corrupt files, missing/unexpected packaged files, wrong filenames, and inconsistent versions.
Do not rely solely on validation of an upstream representation.`,
26:`Before release, prove process correctness and product correctness independently.
Process correctness: approved inputs used; approved instruction used; required tools ran; required tests ran; no unauthorized modification.
Product correctness: every mandatory product requirement satisfied; every mandatory test succeeded; every semantic requirement has supporting evidence; no unresolved critical or major defect.
Do not infer one from the other.`,
27:`Assign exactly one state:
ACCEPTED — all mandatory requirements have affirmative supporting evidence and all mandatory validators succeed.
REJECTED — at least one mandatory requirement is demonstrably violated.
BLOCKED — at least one mandatory requirement cannot be established because required evidence, authority, input, or capability is unavailable.
Do not treat absence of detected defects as proof by itself.`,
28:`Calculate the cryptographic hash of every artifact that completed final verification.
Immediately before delivery, calculate the hash again.
Require RELEASE_HASH = AUDITED_HASH.
If any hash differs, stop release, identify modification, create a new product version, rerun affected validation, and perform the release gate again.
Never release a modified artifact under an earlier audit.`,
29:`For every mandatory requirement preserve:
SOURCE → REQUIREMENT → INSTRUCTION → EXECUTION → PRODUCT ELEMENT → TEST → TEST RESULT → EVIDENCE → RELEASE DECISION.
The absence of any required link prevents affirmative acceptance of that requirement.`,
30:`Maintain a defect registry.
For every defect record DEFECT_ID, DATE, ITERATION, PRODUCT_VERSION, REQUIREMENT, OBSERVED_FAILURE, ROOT_CAUSE, CORRECTION, REGRESSION_TEST, VERIFICATION_RESULT.
Before approving any later baseline, execute all still-applicable regression tests.
A previously solved defect that reappears is a regression and prevents release.`
};

const MANDATORY_RULES = `1. Do not begin production before requirements and acceptance tests exist.
2. Do not invent missing facts.
3. Do not silently resolve authoritative conflicts.
4. Do not allow the generator to be its sole validator.
5. Use deterministic verification whenever the property is deterministically testable.
6. Require affirmative evidence for every mandatory requirement.
7. Treat mandatory unknowns as BLOCKED.
8. Root-cause every material failure before changing anything.
9. Correct the earliest defective layer rather than merely patching the final output.
10. Convert every confirmed defect into a permanent regression test.
11. Re-run independent executions after every material upstream change.
12. Do not allow independent iterations to see one another’s outputs.
13. Do not freeze a baseline merely because ten runs completed.
14. Require an unchanged confirmation iteration.
15. Validate the actual finished artifact, not merely its source representation.
16. Invalidate affected downstream verification whenever an upstream artifact changes materially.
17. Do not release any product containing an unresolved critical or major defect.
18. Do not release a product whose mandatory requirement cannot be verified.
19. Do not release bytes different from the bytes that were audited.
20. Preserve enough evidence to reproduce every acceptance decision.`;

const ENUMS = Object.freeze({
  stageStatus:["NOT_STARTED","IN_PROGRESS","COMPLETE","BLOCKED","FAILED"],
  truth:["TRUE","FALSE","UNKNOWN"],
  verificationResult:["SATISFIED","VIOLATED","UNDETERMINED"],
  releaseState:["ACCEPTED","REJECTED","BLOCKED"],
  sourceRole:["MANDATORY","INFORMATIVE","EVIDENTIARY"],
  defectCategory:["SOURCE_DEFECT","RESEARCH_DEFECT","REQUIREMENT_DEFECT","TEST_DEFECT","INSTRUCTION_DEFECT","INPUT_DEFECT","EXECUTION_DEFECT","TOOL_DEFECT","AUDIT_DEFECT"],
  verificationMethod:["FORMAL_PROOF","EXACT_COMPUTATION","DETERMINISTIC_PROGRAMMATIC_TEST","SCHEMA_OR_STRUCTURAL_VALIDATION","EXACT_SOURCE_COMPARISON","RULE_BASED_EVALUATION","INDEPENDENT_SEMANTIC_EVALUATION","AUTHORIZED_HUMAN_JUDGMENT"]
});

global.ClosedLoopSpec={STAGE_NAMES,STAGE_INSTRUCTIONS,MANDATORY_RULES,ENUMS};
})(typeof window!=="undefined"?window:globalThis);
