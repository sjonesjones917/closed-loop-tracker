from pathlib import Path


def replace_once(path, old, new, label):
    p = Path(path)
    s = p.read_text()
    if old not in s:
        raise SystemExit(f'{label}: anchor not found')
    p.write_text(s.replace(old, new, 1))

# Stage 01 unresolved-question semantics.
replace_once(
    'prompt-engine.js',
    "Do not block Stage 01 merely because information will be needed by a later research, design, production, filing, verification, or execution stage. Record such later-needed information in UNKNOWN_INFORMATION and let the earliest stage that actually requires it resolve it.",
    "Classify every unresolved issue before finalizing Stage 01. BLOCKING_NOW means a genuinely human-only answer is required to define the objective, intended deliverable, or controlled input boundary. ASK_NOW_NONBLOCKING means the answer is genuinely human-only and foreseeably needed to achieve the requested outcome, but the human may answer UNKNOWN or DEFERRED without preventing a reliable Stage 01 job definition. LATER_RESOLVABLE means accessible supplied material, authorized research, or a later stage can establish the fact without human authority. Ask every BLOCKING_NOW and ASK_NOW_NONBLOCKING item conversationally before final Stage 01 JSON. Never ask a LATER_RESOLVABLE item now. If an ASK_NOW_NONBLOCKING item is answered UNKNOWN or DEFERRED, preserve it in UNKNOWN_INFORMATION and the intake accounting and continue when the job definition is otherwise complete. Only unresolved BLOCKING_NOW items require HUMAN_INPUT_REQUIRED.",
    'stage01 classification',
)

# Exhaustive early-stage behavior.
replace_once(
    'prompt-engine.js',
    "Build the independent external source inventory for this current job only. Treat any DESIRED OR SUGGESTED SOURCE COUNT as a search target, never as authority to invent sources.",
    "Build the independent external source inventory for this current job only. Continue discovery, inspection, authority, applicability, currency, supersession, and conflict-resolution passes until no new applicable controlling or correctness-relevant external source category is found and every discovered candidate has a supported disposition. Do not stop at the first plausible source or when a desired source count is reached. Treat any DESIRED OR SUGGESTED SOURCE COUNT as a search target, never as authority to invent sources.",
    'stage02 exhaustion',
)
replace_once(
    'prompt-engine.js',
    "Repeat discovery passes until saturation is actually supported by the evidence.",
    "Do not finalize Stage 03 until every current accepted Stage 02 source has current research coverage, every requirement-relevant canonical intent statement has candidate-obligation coverage, and a distinct conflict/exception/saturation pass finds no new material requirement category. If any current source cannot be inspected or any required coverage remains incomplete, return the exact blocker or gap instead of silently omitting it.",
    'stage03 closure',
)
replace_once(
    'prompt-engine.js',
    "Resolve the current job’s requirement set. Detect duplicate or conflicting requirements, impossible combinations, undefined terms, circular dependencies, missing prerequisites, unsupported requirements, uncertain applicability, and requirements lacking a verification method. Preserve the substantive defect, governing evidence, proposed resolution or unresolved state, affected requirement, and blockers. Human authority decides genuine user tradeoffs; the application owns controlled versions and downstream invalidation. Never silently guess away a conflict or manufacture authority.",
    "Resolve the current job’s requirement set exhaustively before downstream instruction work. Perform complete passes for duplicate or semantically overlapping requirements, conflicts, impossible combinations, undefined terms, circular dependencies, missing prerequisites, unsupported requirements, uncertain applicability, and requirements lacking a valid verification path. Account for every detected defect with governing evidence and an explicit resolution or blocker, then repeat the review against the resulting requirement set until no material defect remains unresolved except an explicit blocker. Preserve compatible user intent and governing-source meaning; never solve a conflict by silently deleting, weakening, or merging a distinct obligation. Human authority decides only genuine human tradeoffs; the application owns controlled versions and downstream invalidation.",
    'stage05 exhaustion',
)
replace_once(
    'prompt-engine.js',
    "If correction is required, identify the exact correction; the application controls versioning and repeated-review state. Do not execute target production during preflight.",
    "If correction is required, identify the exact correction; after a corrected instruction version is supplied, re-review the entire current instruction from the beginning rather than reviewing only the changed clause. Do not return a ready determination while any material clause remains ambiguous, conflicting, unsupported, unexecutable, or unverified. The application controls versioning and repeated-review state. Do not execute target production during preflight.",
    'stage09 full rereview',
)
replace_once(
    'prompt-engine.js',
    "Run the application-reserved ten independent execution targets using the identical frozen candidate in fresh contexts. For each supplied RUN_ID and CONTEXT_ID, perform only that exact execution lane and report contamination state, tool configuration, complete output, actual tool failures, substantive output observations, and evidence.",
    "The application creates exactly ten independent execution lanes, but this prompt authorizes exactly one reserved RUN_ID and CONTEXT_ID. Execute only this one lane using the identical frozen candidate and do not perform another run, verification, comparison, RCA, or correction in this context. Report contamination state, tool configuration, complete output, actual tool failures, substantive output observations, and evidence for this exact lane only.",
    'stage11 lane isolation',
)

# Composite stages must describe the current operation, not the whole batch as one agent task.
replace_once(
    'prompt-engine.js',
    "17:'After a material upstream correction, perform only the declared Stage 17 operation against the application-assigned corrected iteration and candidate. Use the exact supplied iteration, candidate, run, and context identities where the operation requires them. Execute ten new independent contexts across the batch, withhold prior outputs, use one identical corrected candidate package, and perform verification, comparison, RCA, regression execution, and any required correction through the declared operation subcontracts. Do not invent iteration, candidate, run, or context identities.',",
    "17:'Stage 17 is an application-orchestrated multi-operation corrected iteration. In this prompt perform only the CURRENT DECLARED OPERATION against the application-assigned corrected iteration and candidate; do not perform any other Stage 17 operation in the same response. Across the whole stage the application will separately orchestrate freeze, ten independent execution lanes, verification, comparison, RCA, regression, and correction as required. Use only exact application-supplied iteration, candidate, run, and context identities and never invent replacements.',",
    'stage17 base task',
)
replace_once(
    'prompt-engine.js',
    "19:'After convergence, perform only the declared unchanged-confirmation operations using the exact application-supplied converged component versions and hashes with zero material changes. Use the supplied new run/context identities, rerun the complete verification matrix and applicable regression suite across ten new independent contexts, compare all runs, and report any new defect, missed requirement, missed failure case, or correctness-affecting variance. The application evaluates unchanged-confirmation completion and owns iteration/run/context identity.',",
    "19:'Stage 19 is an application-orchestrated unchanged-confirmation iteration. In this prompt perform only the CURRENT DECLARED OPERATION and do not perform another Stage 19 operation in the same response. Across the complete stage the application will separately confirm the unchanged freeze, create ten new independent run contexts, execute, verify, compare, rerun applicable regressions, and calculate the final unchanged-confirmation determination. Use exact application-supplied identities and never invent or reuse a prior context.',",
    'stage19 base task',
)

p = Path('prompt-engine.js')
s = p.read_text()
anchor = "};\nconst recordId=(record,collection)=>"
if anchor not in s:
    raise SystemExit('operation task insertion anchor not found')
operation_fn = r"""};
const OPERATION_TASKS=Object.freeze({
  17:Object.freeze({
    FREEZE:'CURRENT DECLARED OPERATION: FREEZE. Review only the corrected candidate freeze produced from the accepted change set. Establish whether the exact corrected components, instruction/test/regression versions, artifacts, configuration, and unchanged components form one complete immutable candidate for the new iteration. Do not execute a run, verify a result, compare runs, perform RCA, create a regression, or propose another correction in this response.',
    EXECUTE_RUN:'CURRENT DECLARED OPERATION: EXECUTE_RUN. Execute exactly one application-reserved RUN_ID in exactly one application-reserved CONTEXT_ID using the frozen corrected candidate. Do not execute a second run and do not verify, compare, root-cause, regress, or correct in this response.',
    VERIFY:'CURRENT DECLARED OPERATION: VERIFY. Verify only the application-listed missing REQ_ID × RUN_ID × TEST_ID work for the current verification lane using the declared executor and evidence rules. Do not compare runs, perform RCA, create regressions, or correct defects in this response.',
    COMPARE:'CURRENT DECLARED OPERATION: COMPARE. Compare the complete current corrected ten-run verification set requirement-by-requirement and report variance/failure observations only. Do not perform RCA, create regressions, or correct defects in this response.',
    ROOT_CAUSE:'CURRENT DECLARED OPERATION: ROOT_CAUSE. Root-cause only the current material defects using the complete supplied upstream trace and identify the earliest defective layer. Do not create regression definitions or corrections in this response.',
    REGRESSION:'CURRENT DECLARED OPERATION: REGRESSION. Convert the confirmed current defects into permanent regression definitions and actual PRE_CORRECTION regression executions only. Do not apply the correction in this response.',
    CORRECT:'CURRENT DECLARED OPERATION: CORRECT. Propose only the exact correction to each confirmed earliest defective layer and the required invalidation/rerun effects. Do not execute the corrected iteration in this response.'
  }),
  19:Object.freeze({
    CONFIRM_FREEZE:'CURRENT DECLARED OPERATION: CONFIRM_FREEZE. Compare the converged candidate identity, component versions, and available hashes against the unchanged-confirmation candidate and establish zero material change only. Do not execute runs or tests in this response.',
    EXECUTE_RUN:'CURRENT DECLARED OPERATION: EXECUTE_RUN. Execute exactly one newly reserved unchanged-confirmation RUN_ID in exactly one newly reserved CONTEXT_ID using the unchanged frozen package. Do not verify, compare, or run another lane in this response.',
    VERIFY:'CURRENT DECLARED OPERATION: VERIFY. Verify only the application-listed current unchanged-confirmation triples using the declared executor/evidence rules. Do not compare the ten runs or issue the final confirmation in this response.',
    COMPARE:'CURRENT DECLARED OPERATION: COMPARE. Compare only the complete unchanged-confirmation run verification set and report current variance/failure observations. Do not run regressions or issue the final confirmation in this response.',
    REGRESSION_VERIFY:'CURRENT DECLARED OPERATION: REGRESSION_VERIFY. Execute only the still-applicable permanent regression tests against the unchanged-confirmation candidate and return actual current regression execution evidence. Do not issue the final confirmation in this response.',
    CONFIRM:'CURRENT DECLARED OPERATION: CONFIRM. Evaluate the complete supplied unchanged-confirmation observations for newly discovered requirements, missed failures, material defects, contradictions, or unexplained variance. Do not fabricate application-derived counts or identities; the application makes the final deterministic completion calculation.'
  })
});
function operationSpecificTask(stage,operation){return OPERATION_TASKS[stage]?.[operation]||'';}
const recordId=(record,collection)=>"""
s = s.replace(anchor, operation_fn, 1)
p.write_text(s)

replace_once(
    'prompt-engine.js',
    "STAGE-SPECIFIC TASK\n${procedures[stage]||'Perform the current stage completely and only the current stage.'}\n\nPERMITTED AGENT-OWNED STAGE DATA",
    "STAGE-SPECIFIC TASK\n${operationSpecificTask(stage,operation)}${operationSpecificTask(stage,operation)?'\\n\\n':''}${procedures[stage]||'Perform the current stage completely and only the current stage.'}\n\nPERMITTED AGENT-OWNED STAGE DATA",
    'operation-specific task injection',
)

# Context contracts: every stage receives exactly the upstream canonical record families needed for its task.
schema = Path('workflow-schema.js')
ss = schema.read_text()
start = ss.index('const READ_COLLECTIONS=Object.freeze(')
end = ss.index('const APPLICATION_COLLECTIONS=', start)
new_read = """const READ_COLLECTIONS=Object.freeze({1:[],2:['intentStatements'],3:['intentStatements','sources','sourceConflicts'],4:['intentStatements','research','candidateRequirements','sources','sourceConflicts'],5:['intentStatements','sources','sourceConflicts','research','candidateRequirements','requirements'],6:['requirements','requirementResolutions','sources','research'],7:['requirements','tests'],8:['requirements','tests','failureTests','requirementResolutions','sources','sourceConflicts'],9:['instructions','instructionTraces','requirements','tests','failureTests','requirementResolutions','sources','sourceConflicts'],10:['instructions','preflightRecords','tests','failureTests','artifacts'],11:['candidateFreezes','iterations','runs','freshContexts'],12:['runs','requirements','tests','freshContexts'],13:['verification','runs','requirements','tests'],14:['intentStatements','sources','sourceConflicts','research','candidateRequirements','requirements','requirementResolutions','tests','failureTests','instructions','instructionTraces','preflightRecords','candidateFreezes','iterations','runs','verification','comparisons','defects','products','deterministicResults','meaningResults','adversarialResults','representationInspections','artifacts','evidenceRecords'],15:['requirements','tests','runs','verification','comparisons','products','deterministicResults','meaningResults','adversarialResults','representationInspections','defects','rootCauses','regressions','regressionExecutions','artifacts','evidenceRecords'],16:['intentStatements','sources','sourceConflicts','research','candidateRequirements','requirements','requirementResolutions','tests','failureTests','instructions','instructionTraces','preflightRecords','candidateFreezes','iterations','runs','verification','comparisons','products','deterministicResults','meaningResults','adversarialResults','representationInspections','defects','rootCauses','regressions','regressionExecutions','changes','artifacts','evidenceRecords'],17:['changes','candidateFreezes','iterations','tests','regressions','regressionExecutions'],18:['requirements','tests','iterations','runs','verification','comparisons','defects','rootCauses','regressions','regressionExecutions','changes','blockers'],19:['convergenceRecords','candidateFreezes','tests','regressions','regressionExecutions'],20:['confirmationRecords','candidateFreezes','iterations','artifacts'],21:['baselines','freshContexts','instructions','artifacts'],22:['products','tests','artifacts'],23:['products','requirements','tests','sources','research','evidenceRecords'],24:['products','requirements','tests','regressions','regressionExecutions','sources','sourceConflicts','research','evidenceRecords','artifacts'],25:['products','artifacts'],26:['requirements','tests','instructions','instructionTraces','iterations','runs','verification','comparisons','defects','regressions','regressionExecutions','confirmationRecords','products','baselines','deterministicResults','meaningResults','adversarialResults','representationInspections','artifacts','evidenceRecords','blockers'],27:['products','baselines','convergenceRecords','confirmationRecords','requirements','tests','deterministicResults','meaningResults','adversarialResults','representationInspections','processAudits','productAudits','defects','blockers','regressions','regressionExecutions','evidenceRecords'],28:['releaseRecords','artifactIdentities','artifacts'],29:['sources','requirements','instructions','instructionTraces','runs','products','tests','verification','deterministicResults','meaningResults','adversarialResults','representationInspections','regressions','regressionExecutions','processAudits','productAudits','baselines','releaseRecords','artifactIdentities','evidenceRecords','evidenceChains','defects','blockers'],30:['requirements','defects','rootCauses','regressions','regressionExecutions','changes','baselines','evidenceRecords']});
"""
ss = ss[:start] + new_read + ss[end:]

ostart = ss.index('const OPERATION_CONTRACT_OVERRIDES=Object.freeze(')
oend = ss.index('function operationContract', ostart)
overrides = """const OPERATION_CONTRACT_OVERRIDES=Object.freeze({17:Object.freeze({FREEZE:Object.freeze({readCollections:['changes','candidateFreezes','iterations','instructions','preflightRecords','requirements','tests','failureTests','regressions','regressionExecutions','artifacts'],agentWritableCollections:[],allowedStageData:['NEW_FROZEN_VERSIONS','OLD_CONVERSATIONS_CONTINUED']}),EXECUTE_RUN:Object.freeze({readCollections:['candidateFreezes','iterations','runs','freshContexts'],agentWritableCollections:['runs'],allowedStageData:[]}),VERIFY:Object.freeze({readCollections:['runs','requirements','tests','freshContexts'],agentWritableCollections:['verification'],allowedStageData:[]}),COMPARE:Object.freeze({readCollections:['verification','runs','requirements','tests'],agentWritableCollections:['comparisons'],allowedStageData:[]}),ROOT_CAUSE:Object.freeze({readCollections:['intentStatements','sources','sourceConflicts','research','candidateRequirements','requirements','requirementResolutions','tests','failureTests','instructions','instructionTraces','preflightRecords','candidateFreezes','iterations','runs','verification','comparisons','defects','products','deterministicResults','meaningResults','adversarialResults','representationInspections','artifacts','evidenceRecords'],agentWritableCollections:['defects','rootCauses'],allowedStageData:['ROOT_CAUSE_COMPLETED']}),REGRESSION:Object.freeze({readCollections:['requirements','tests','runs','verification','comparisons','products','deterministicResults','meaningResults','adversarialResults','representationInspections','defects','rootCauses','regressions','regressionExecutions','artifacts','evidenceRecords'],agentWritableCollections:['regressions','regressionExecutions'],allowedStageData:[]}),CORRECT:Object.freeze({readCollections:['intentStatements','sources','sourceConflicts','research','candidateRequirements','requirements','requirementResolutions','tests','failureTests','instructions','instructionTraces','preflightRecords','candidateFreezes','iterations','runs','verification','comparisons','products','deterministicResults','meaningResults','adversarialResults','representationInspections','defects','rootCauses','regressions','regressionExecutions','changes','artifacts','evidenceRecords'],agentWritableCollections:['changes'],allowedStageData:['CORRECTIONS_COMPLETED']})}),19:Object.freeze({CONFIRM_FREEZE:Object.freeze({readCollections:['convergenceRecords','candidateFreezes','iterations','requirements','tests','regressions','regressionExecutions','artifacts'],agentWritableCollections:[],allowedStageData:[]}),EXECUTE_RUN:Object.freeze({readCollections:['candidateFreezes','iterations','runs','freshContexts'],agentWritableCollections:['runs'],allowedStageData:[]}),VERIFY:Object.freeze({readCollections:['runs','requirements','tests','freshContexts'],agentWritableCollections:['verification'],allowedStageData:[]}),COMPARE:Object.freeze({readCollections:['verification','runs','requirements','tests'],agentWritableCollections:['comparisons'],allowedStageData:[]}),REGRESSION_VERIFY:Object.freeze({readCollections:['regressions','regressionExecutions','runs','tests','requirements','artifacts','evidenceRecords','defects','rootCauses'],agentWritableCollections:['regressionExecutions'],allowedStageData:[]}),CONFIRM:Object.freeze({readCollections:['runs','verification','comparisons','regressionExecutions','candidateFreezes','requirements','tests','regressions','defects','blockers'],agentWritableCollections:['confirmationRecords'],allowedStageData:[]})})});
"""
ss = ss[:ostart] + overrides + ss[oend:]
schema.write_text(ss)
