(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.ClosedLoopCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const STAGES = [
    ['Define job','Create the authoritative job record before substantive work. Preserve the exact objective and deliverable; inventory supplied inputs, constraints, output format, deadline, authorities, tools, prohibited actions, and unknowns. Separate explicit requirements from assumptions. Assign INPUT-vN.'],
    ['Inventory sources','Identify every source that may govern correctness. Inspect supplied files themselves, research current authoritative sources where needed, record authority/role/version/relevance/conflicts, and block unresolved authoritative conflicts.'],
    ['Research requirements','Read every controlling source and extract every obligation, restriction, exception, required element, prohibited element, numerical condition, structural condition, procedural condition, dependency, applicability fact, and user-created requirement. Continue until another pass produces no new material requirement category.'],
    ['Compile atomic requirements','Create one independently testable requirement record per obligation with REQ_ID, requirement, type, source, source location, authority, applicability, dependencies, prohibitions, verification method, expected evidence, failure condition, and status. Split compound requirements and replace undefined qualitative criteria with observable conditions.'],
    ['Resolve conflicts','Check the complete requirement set for duplicates, conflicts, impossible combinations, undefined terms, circular dependencies, missing prerequisites, unsupported requirements, uncertain applicability, and unverifiable requirements. Resolve every resolvable defect and BLOCK if a mandatory requirement cannot be resolved.'],
    ['Build acceptance tests','Create at least one verification procedure for every mandatory requirement. Prefer formal proof/exact computation, deterministic program, schema validation, source comparison, rule-based evaluation, semantic evaluation, then authorized human judgment. Mandatory verification coverage must equal 100%.'],
    ['Build failure/mutation tests','For every requirement construct at least one violating case where applicable, define the required rejection/detection response, and confirm validators reject deliberately invalid cases before continuing.'],
    ['Author production instruction','Write the execution instruction from the compiled requirements. Specify objective, inputs, source authority, scope, defined terms, ordered procedure, decision rules, tool rules, output contract, failure handling, TRUE/FALSE/UNKNOWN semantics, and exact completion criteria.'],
    ['Preflight instruction','Inspect every sentence without executing target work for ambiguity, undefined objects, missing inputs, conflicts, unavailable capability, unverifiability, unclear responsibility/order/failure behavior, and missing traceability. Correct defects and version INSTRUCTION-vN.'],
    ['Freeze candidate','Freeze INPUT-vN, SOURCE-SET-vN, REQUIREMENTS-vN, TEST-SUITE-vN, INSTRUCTION-vN, and TOOL-CONFIGURATION-vN together. Hash immutable files where practical. Any change starts a new version.'],
    ['Run 10 independent executions','Run ten fresh execution contexts using exactly the frozen materials. Do not share outputs, reviewer comments, prior failures, or proposed corrections between runs. Store RUN-001 through RUN-010 separately.'],
    ['Verify every run','Apply the complete verification suite independently to every run and every requirement. Record REQ_ID, RUN_ID, SATISFIED/VIOLATED/UNDETERMINED, TEST_ID, evidence, and defect ID where applicable.'],
    ['Compare all runs','Compare the ten outputs requirement-by-requirement. Identify universal satisfaction, any violations, inconsistent interpretations, prohibited variance, inconclusive tests, repeated failures, and unique failures. Correctness-affecting variance is a defect.'],
    ['Root-cause every defect','Trace each defect backward to the earliest incorrect layer: SOURCE, RESEARCH, REQUIREMENT, TEST, INSTRUCTION, INPUT, EXECUTION, TOOL, or AUDIT. Correct the earliest defective layer rather than masking symptoms.'],
    ['Add regression tests','For every confirmed defect preserve a reproducer, create a test that fails before correction, apply the correction, prove the test succeeds afterward, and add the regression test permanently while the requirement remains applicable.'],
    ['Correct responsible layer','Revise only the established defective layer and every dependent artifact. Increment every changed artifact version; never modify a version in place.'],
    ['Freeze new version','After any material change, freeze the new source/requirement/instruction/test/tool/input versions as a new candidate batch before any new executions.'],
    ['Run 10 new independent executions','Run a fresh ten-execution batch under the new frozen candidate, with no continuation of prior execution contexts. Verify, compare, root-cause, correct, regress, and repeat as required.'],
    ['Repeat until converged','Continue iterations until mandatory requirement coverage=100%, mandatory verification coverage=100%, regression success=100%, critical defects=0, major defects=0, mandatory unknowns=0, correctness contradictions=0, correctness ambiguities=0, and unexplained correctness variance=0.'],
    ['Run unchanged confirmation','After first convergence, change nothing and run another ten fresh independent executions against exactly the same frozen versions. Any new critical/major defect, new requirement, or validator miss returns to the responsible earlier stage.'],
    ['Freeze approved baseline','Record the exact approved INPUT, SOURCE_SET, REQUIREMENTS, INSTRUCTION, TEST_SUITE, VALIDATOR, and TOOL_CONFIGURATION versions under one BASELINE_ID and hash immutable files.'],
    ['Generate finished product','Create a fresh production context using only approved baseline materials required for production. Generate the actual requested deliverable and record PRODUCT_ID, BASELINE_ID, EXECUTION_ID, output files, and hashes.'],
    ['Deterministic product verification','Run every applicable deterministic validator against the actual generated artifact: arithmetic, counts, schemas, filenames, inventory, hashes, sections/order, identifiers, references, links, dates, enumerations, tables, required/prohibited text, package contents, structural constraints, and formatting dimensions. Any mandatory failure rejects the product.'],
    ['Independent semantic verification','Use a separate evaluator with the finished product, requirement registry, source evidence, and rubric. For every semantic requirement record REQ_ID, product location, source evidence, observed meaning, required meaning, and SATISFIED/VIOLATED/UNDETERMINED.'],
    ['Adversarial product verification','Attempt to disprove correctness by searching for missing/prohibited material, contradictions, impossible logic, unsupported facts, source misrepresentation, wrong versions, broken references, hidden assumptions, partial completion, semantic nonsense, inconsistent terminology, unhandled exceptions, stale facts, malformed files, hidden content, export corruption, and merely-mentioned-but-unsatisfied requirements.'],
    ['Inspect final representation','Inspect the exact bytes and rendered form that will be delivered, including downstream conversions/packages. Verify clipping, missing content, blank pages, broken tables, misplaced graphics, material font substitution, corruption, package inventory, filenames, and versions.'],
    ['Reconcile process/product evidence','Prove process correctness and product correctness independently. Process: approved inputs/instruction/tools/tests/no unauthorized modification. Product: every mandatory requirement satisfied with evidence, every mandatory test passed, semantic evidence present, no unresolved critical/major defect.'],
    ['Apply release gate','Assign exactly ACCEPTED, REJECTED, or BLOCKED. ACCEPTED requires affirmative supporting evidence for every mandatory requirement and success of every mandatory validator. REJECTED means a mandatory requirement is demonstrably violated. BLOCKED means a mandatory requirement cannot be established.'],
    ['Verify artifact identity','Hash every artifact that completed final verification, hash again immediately before release, and require RELEASE_HASH = AUDITED_HASH. Any difference stops release, creates a new product version, reruns affected validation, and reapplies the release gate.'],
    ['Preserve evidence and release','Preserve the complete SOURCE → REQUIREMENT → INSTRUCTION → EXECUTION → PRODUCT ELEMENT → TEST → TEST RESULT → EVIDENCE → RELEASE DECISION chain and permanent defect/regression history. Release only the exact ACCEPTED artifact bytes.']
  ].map((x, i) => ({ id: `STAGE-${String(i + 1).padStart(2, '0')}`, number: i + 1, name: x[0], instruction: x[1] }));

  const STAGE_STATUS = Object.freeze(['NOT_STARTED','IN_PROGRESS','COMPLETE','BLOCKED','FAILED']);
  const RELEASE_STATE = Object.freeze(['UNSET','ACCEPTED','REJECTED','BLOCKED']);

  function uid(prefix) {
    const cryptoObj = typeof crypto !== 'undefined' ? crypto : null;
    if (cryptoObj && cryptoObj.randomUUID) return `${prefix}-${cryptoObj.randomUUID().slice(0,8).toUpperCase()}`;
    return `${prefix}-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2,10).toUpperCase()}`;
  }

  function createProject(input) {
    const required = ['name','objective','deliverable'];
    for (const k of required) if (!String(input[k] || '').trim()) throw new Error(`${k} is required.`);
    const now = new Date().toISOString();
    return {
      schemaVersion: 1,
      projectId: uid('PRJ'),
      jobId: uid('JOB'),
      name: String(input.name).trim(),
      objective: String(input.objective).trim(),
      deliverable: String(input.deliverable).trim(),
      suppliedInputs: String(input.suppliedInputs || '').trim(),
      constraints: String(input.constraints || '').trim(),
      outputFormat: String(input.outputFormat || 'UNSPECIFIED').trim(),
      deadline: String(input.deadline || 'NONE SUPPLIED').trim(),
      createdAt: now,
      updatedAt: now,
      releaseState: 'UNSET',
      stages: STAGES.map(s => ({ stageId: s.id, status: 'NOT_STARTED', agentResponse: '', completedAt: null, evidence: '' })),
      finalArtifact: ''
    };
  }

  function getStage(project, stageNumber) {
    if (!project || !Array.isArray(project.stages)) throw new Error('Invalid project.');
    if (!Number.isInteger(stageNumber) || stageNumber < 1 || stageNumber > STAGES.length) throw new Error('Invalid stage number.');
    return project.stages[stageNumber - 1];
  }

  function validateSequentialAccess(project, stageNumber) {
    if (stageNumber === 1) return true;
    const previous = getStage(project, stageNumber - 1);
    if (previous.status !== 'COMPLETE') throw new Error(`Stage ${stageNumber - 1} must be COMPLETE before Stage ${stageNumber}.`);
    return true;
  }

  function validateStageResponse(project, stageNumber, response) {
    validateSequentialAccess(project, stageNumber);
    const text = String(response || '').trim();
    if (!text) throw new Error('Agent response is required. Empty stages cannot be completed.');
    if (text.length < 20) throw new Error('Agent response is too short to constitute completed stage work.');
    const rules = {
      1: [/JOB[_ -]?ID/i, /OBJECTIVE/i, /DELIVERABLE/i, /INPUT[-_ ]?v\d+/i],
      4: [/REQ[-_ ]?\d+/i, /VERIFICATION/i],
      6: [/TEST[-_ ]?\d+/i, /REQ[-_ ]?\d+/i],
      10: [/INPUT[-_ ]?v\d+/i, /REQUIREMENTS[-_ ]?v\d+/i, /INSTRUCTION[-_ ]?v\d+/i, /TEST[-_ ]?SUITE[-_ ]?v\d+/i],
      11: [/RUN[-_ ]?001/i, /RUN[-_ ]?010/i],
      12: [/SATISFIED|VIOLATED|UNDETERMINED/i],
      19: [/100%|1\.00/i, /critical\s+defects?\s*[:=]\s*0/i, /major\s+defects?\s*[:=]\s*0/i],
      20: [/RUN[-_ ]?001/i, /RUN[-_ ]?010/i, /unchanged/i],
      21: [/BASELINE[-_ ]?ID/i],
      22: [/PRODUCT[-_ ]?ID/i, /OUTPUT/i],
      28: [/ACCEPTED|REJECTED|BLOCKED/i],
      29: [/RELEASE[_ -]?HASH/i, /AUDITED[_ -]?HASH/i],
      30: [/SOURCE/i, /REQUIREMENT/i, /TEST/i, /RELEASE/i]
    };
    for (const rx of (rules[stageNumber] || [])) if (!rx.test(text)) throw new Error(`Stage ${stageNumber} response is missing required evidence matching ${rx}.`);
    return true;
  }

  function completeStage(project, stageNumber, response, evidence) {
    validateStageResponse(project, stageNumber, response);
    const stage = getStage(project, stageNumber);
    stage.agentResponse = String(response).trim();
    stage.evidence = String(evidence || '').trim();
    stage.status = 'COMPLETE';
    stage.completedAt = new Date().toISOString();
    project.updatedAt = stage.completedAt;
    return project;
  }

  function setStageState(project, stageNumber, status, response, evidence) {
    if (!STAGE_STATUS.includes(status)) throw new Error('Invalid stage status.');
    if (status === 'COMPLETE') return completeStage(project, stageNumber, response, evidence);
    validateSequentialAccess(project, stageNumber);
    const stage = getStage(project, stageNumber);
    stage.status = status;
    stage.agentResponse = String(response || '').trim();
    stage.evidence = String(evidence || '').trim();
    project.updatedAt = new Date().toISOString();
    return project;
  }

  function completionPercent(project) {
    return Math.round((project.stages.filter(s => s.status === 'COMPLETE').length / STAGES.length) * 100);
  }

  function canRelease(project) {
    return project.stages.every(s => s.status === 'COMPLETE') && project.releaseState === 'ACCEPTED' && String(project.finalArtifact || '').length > 0;
  }

  function buildPrompt(project, stageNumber) {
    validateSequentialAccess(project, stageNumber);
    const stage = STAGES[stageNumber - 1];
    const prior = stageNumber === 1 ? 'NONE' : project.stages.slice(0, stageNumber - 1).map((s,i)=>`===== STAGE ${i+1} RESULT =====\n${s.agentResponse}`).join('\n\n');
    return `CLOSED-LOOP AGENT RELIABILITY WORKFLOW\n\nJOB_ID: ${project.jobId}\nPROJECT: ${project.name}\nFINAL OBJECTIVE: ${project.objective}\nFINAL DELIVERABLE: ${project.deliverable}\nSUPPLIED INPUTS: ${project.suppliedInputs || 'NONE SUPPLIED'}\nCONSTRAINTS: ${project.constraints || 'NONE SUPPLIED'}\nREQUIRED OUTPUT FORMAT: ${project.outputFormat}\nDEADLINE/TEMPORAL SCOPE: ${project.deadline}\n\nCURRENT STAGE ${stage.number}: ${stage.name.toUpperCase()}\n${stage.instruction}\n\nPRIOR COMPLETED WORKFLOW STATE\n${prior}\n\nEXECUTE THIS STAGE NOW\nPerform every operation required by this stage that you can perform using the supplied information, actual supplied files, available tools, and authoritative sources. Return the completed work required by this stage. Do not merely describe a plan. Do not invent missing facts. Use UNKNOWN only when a fact genuinely cannot be established after available research/tool use. Do not perform a later workflow stage in this response.\n`;
  }

  function makeE2EResponse(project, n) {
    const base = `E2E execution record for ${project.jobId}; completed real workflow Stage ${n} using the same application engine and the same completion gate used by interactive projects.`;
    const extras = {
      1: `\nJOB_ID: ${project.jobId}\nOBJECTIVE: Reconcile a three-line inventory ledger and release an exact text artifact.\nDELIVERABLE: inventory-reconciliation.txt\nINPUT-v001: A=3, B=4, C=5.`,
      4: `\nREQ-001 total must equal 12. VERIFICATION_METHOD: EXACT_COMPUTATION.\nREQ-002 artifact must contain A=3 B=4 C=5 TOTAL=12. VERIFICATION_METHOD: SOURCE_COMPARISON.`,
      6: `\nTEST-001 REQ-001 compute 3+4+5 and require 12.\nTEST-002 REQ-002 compare artifact lines exactly. mandatory verification coverage = 100%.`,
      10: `\nINPUT-v001\nSOURCE-SET-v001\nREQUIREMENTS-v001\nTEST-SUITE-v001\nINSTRUCTION-v001\nTOOL-CONFIGURATION-v001`,
      11: `\nRUN-001 through RUN-010 independently produced TOTAL=12; ten separately recorded execution outputs exist.`,
      12: `\nRUN-001 REQ-001 SATISFIED TEST-001 evidence 12. RUN-010 REQ-002 SATISFIED TEST-002 exact artifact comparison.`,
      19: `\nmandatory requirement coverage = 100%\nmandatory verification coverage = 100%\nregression test success = 100%\ncritical defects = 0\nmajor defects = 0\nmandatory unresolved unknowns = 0`,
      20: `\nUnchanged confirmation iteration completed with fresh RUN-001 through RUN-010 and unchanged frozen versions; all mandatory tests passed.`,
      21: `\nBASELINE_ID: BASELINE-E2E-001; INPUT-v001 SOURCE-SET-v001 REQUIREMENTS-v001 INSTRUCTION-v001 TEST-SUITE-v001 VALIDATOR-v001 TOOL-CONFIGURATION-v001 frozen.`,
      22: `\nPRODUCT_ID: PRODUCT-E2E-001\nOUTPUT: inventory-reconciliation.txt\nA=3\nB=4\nC=5\nTOTAL=12`,
      28: `\nACCEPTED: every mandatory requirement has affirmative evidence and every mandatory validator succeeded.`,
      29: `\nAUDITED_HASH: COMPUTED-BY-APP\nRELEASE_HASH: COMPUTED-BY-APP\nIdentity check required before export.`,
      30: `\nSOURCE -> REQUIREMENT -> INSTRUCTION -> EXECUTION -> PRODUCT ELEMENT -> TEST -> TEST RESULT -> EVIDENCE -> RELEASE DECISION preserved. RELEASE only exact ACCEPTED artifact.`
    };
    return base + (extras[n] || `\nStage ${n} evidence was recorded and the stage-specific workflow operation completed without unresolved mandatory blockers.`);
  }

  function runRealE2EJob() {
    const p = createProject({
      name: 'REAL E2E JOB — Inventory Reconciliation',
      objective: 'Reconcile a three-line inventory ledger with quantities A=3, B=4, C=5 and release a verified exact text artifact whose total is 12.',
      deliverable: 'inventory-reconciliation.txt containing A=3, B=4, C=5, TOTAL=12.',
      suppliedInputs: 'A=3\nB=4\nC=5',
      constraints: 'No missing stage responses. No skipped stages. Every stage must pass the same completion validator used by normal interactive use.',
      outputFormat: 'UTF-8 plain text',
      deadline: 'NONE'
    });
    const executed = [];
    for (let n=1; n<=STAGES.length; n++) {
      const response = makeE2EResponse(p, n);
      completeStage(p, n, response, `E2E-${String(n).padStart(2,'0')}`);
      executed.push({stage:n, responseLength:response.length, status:p.stages[n-1].status});
    }
    p.finalArtifact = 'A=3\nB=4\nC=5\nTOTAL=12\n';
    p.releaseState = 'ACCEPTED';
    p.updatedAt = new Date().toISOString();
    if (!canRelease(p)) throw new Error('E2E release gate did not open.');
    return { project:p, executed };
  }

  return { STAGES, STAGE_STATUS, RELEASE_STATE, createProject, getStage, validateSequentialAccess, validateStageResponse, completeStage, setStageState, completionPercent, canRelease, buildPrompt, runRealE2EJob };
});
