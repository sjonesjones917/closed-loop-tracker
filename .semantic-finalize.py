from pathlib import Path

def rep(path, old, new, count=1):
    p=Path(path); s=p.read_text()
    if s.count(old)!=count: raise SystemExit(f'{path}: expected {count} occurrence(s), found {s.count(old)} for {old[:80]!r}')
    p.write_text(s.replace(old,new,count))

# Prompt semantics: establish the deliverable honestly at Stage 01, never invent future regression success,
# and generate the confirmed deliverable rather than assuming every job is directly implementable.
rep('prompt-engine.js',
"1:'Initialize only this current job from this current job’s exact user input. Preserve the verbatim objective, exact deliverable, supplied-material inventory and provenance, inspection state, format requirements, temporal and geographic scope, user-supplied authority, tools, prohibitions, explicit user requirements, assumptions, unresolved unknowns, and controlled INPUT-vN identity. Assign and preserve this job’s unique JOB_ID before downstream artifacts. Do not create, prescribe, or instruct reuse of a master prompt, master job, reusable job definition, reusable target specification, or template for other jobs. Do not infer requirements for unrelated jobs from this job. Do not begin substantive external-source research or downstream production work.',",
"1:'Initialize only this current job from this current job’s exact user input. Preserve the verbatim objective, supplied-material inventory and provenance, inspection state, format requirements, temporal and geographic scope, user-supplied authority, tools, prohibitions, explicit user requirements, assumptions, unresolved unknowns, and controlled INPUT-vN identity. Assign and preserve this job’s unique JOB_ID before downstream artifacts. Do not create, prescribe, or instruct reuse of a master prompt, master job, reusable job definition, reusable target specification, or template for other jobs. Do not infer requirements for unrelated jobs from this job. Do not begin substantive external-source research or downstream production work. Determine the exact deliverable that can reliably satisfy the verbatim request with the capabilities actually available to this job. Preserve the user request unchanged. If the requested work is a large implementation that depends on an inaccessible external repository, service, deployment environment, or other unavailable execution surface, propose EXACT_DELIVERABLE_REQUESTED as a complete implementation-ready specification rather than pretending implementation can occur. State the limitation in ASSUMPTIONS or UNKNOWN_INFORMATION and let the normal human intent confirmation decide whether that represented deliverable is acceptable. Self-contained deliverables that can actually be produced with available tools remain direct deliverables.',")
rep('prompt-engine.js',
"15:'Convert every confirmed failure in this job into permanent regression data. Link REG_ID to DEFECT_ID and REQ_ID; preserve failure fixture and identity/hash when available, reproduction procedure, detection method, pre-correction result and evidence, correction, post-correction result and evidence, permanent test location, applicability, active/retired state, and retirement authority where applicable.',",
"15:'Convert every confirmed failure in this job into a permanent regression definition. Link REG_ID to DEFECT_ID and REQ_ID; preserve the failure fixture and identity/hash when available, reproduction procedure, detection method, actual pre-correction failing result and evidence, proposed correction target, permanent test location, applicability, active/retired state, and retirement authority where applicable. Stage 15 occurs before the correction is executed, so do not claim a post-correction result or post-correction evidence here. Actual post-correction success belongs to a later regressionExecutions record produced by a corrected or unchanged-confirmation execution.',")
rep('prompt-engine.js',
"21:'Generate this job’s finished target product here, in a fresh production context, using only the approved baseline materials. Before this stage the finished target product is not treated as existing. Assign PRODUCT_ID, PRODUCT_VERSION, BASELINE_ID, EXECUTION_ID, context, timestamps, instruction version, tool configuration, deviations, failures, and generated artifact inventory including filename, type, size, hash, and storage reference. No uncontrolled post-generation editing is permitted.',",
"21:'Generate the exact workflow deliverable confirmed at Stage 01, in a fresh production context, using only the approved baseline materials and current approved production instruction. The deliverable may be a self-contained finished product or, when direct implementation was not reliably available, the complete implementation-ready specification that the human confirmed at Stage 01. Before this stage the deliverable is not treated as existing. Do not claim access to a repository, service, deployment surface, file, or tool that is not actually present in the external execution context. Preserve execution facts and generated artifact claims; canonical PRODUCT_ID, PRODUCT_VERSION, BASELINE_ID, EXECUTION_ID, hashes, byte sizes, and lifecycle state remain application-controlled. No uncontrolled post-generation editing is permitted.',")
rep('prompt-engine.js',
"- Missing human-authority information requires HUMAN_INPUT_REQUIRED. Missing, stale, or incomplete canonical application context requires BLOCKED with MISSING_APPLICATION_CONTEXT. An unavailable external capability requires BLOCKED with MISSING_CAPABILITY, or EXECUTION_FAILED if an attempted execution failed. Work too large for the available environment requires BLOCKED with WORK_TOO_LARGE_FOR_ENVIRONMENT plus a complete implementation-ready specification; do not claim execution occurred. Self-contained deliverables that can actually be produced in the available environment should still be produced.\n",
"- Missing human-authority information requires HUMAN_INPUT_REQUIRED. Missing, stale, or incomplete canonical application context requires BLOCKED with MISSING_APPLICATION_CONTEXT. An unavailable external capability requires BLOCKED with MISSING_CAPABILITY, or EXECUTION_FAILED if an attempted execution failed. At Stage 01, a requested implementation that is too large or depends on an unavailable execution surface must be normalized as a proposed implementation-ready specification deliverable inside DATA_PROPOSAL and must be confirmed by the human. At a later stage, if a newly discovered capability limit invalidates the already-confirmed deliverable, return BLOCKED with WORK_TOO_LARGE_FOR_ENVIRONMENT and identify the earliest stage or human decision that must be revised; do not hide a replacement deliverable inside a BLOCKED response. Self-contained deliverables that can actually be produced in the available environment should still be produced.\n")
rep('prompt-engine.js',
"- When the environment cannot perform a requested implementation or execution, provide an implementation-ready specification rather than pretending implementation occurred.\n",
"- Never claim work was executed merely because it can be specified. The confirmed Stage 01 deliverable controls later stages; if that deliverable becomes infeasible, fail closed and route revision through the owning earlier stage instead of silently changing scope.\n")

# Regression definitions cannot require evidence from a correction that has not happened yet.
rep('workflow-schema.js',
"required:['FAILURE_FIXTURE','REPRODUCTION_PROCEDURE','DETECTION_METHOD','PRE_CORRECTION_RESULT','PRE_CORRECTION_EVIDENCE','CORRECTION','POST_CORRECTION_RESULT','POST_CORRECTION_EVIDENCE','PERMANENT_TEST_LOCATION','APPLICABILITY','ACTIVE_RETIRED_STATE']",
"required:['FAILURE_FIXTURE','REPRODUCTION_PROCEDURE','DETECTION_METHOD','PRE_CORRECTION_RESULT','PRE_CORRECTION_EVIDENCE','CORRECTION','PERMANENT_TEST_LOCATION','APPLICABILITY','ACTIVE_RETIRED_STATE']")

# Every execution/generation prompt that must act on the approved instruction sees the canonical instruction text.
rep('workflow-schema.js',
"10:['instructions','preflightRecords','tests','failureTests'],11:['candidateFreezes','iterations','freshContexts'],12:",
"10:['instructions','preflightRecords','tests','failureTests'],11:['candidateFreezes','iterations','freshContexts','instructions'],12:")
rep('workflow-schema.js',
"20:['confirmationRecords','candidateFreezes','iterations'],21:['baselines','freshContexts'],22:",
"20:['confirmationRecords','candidateFreezes','iterations'],21:['baselines','freshContexts','instructions'],22:")
rep('workflow-schema.js',
"EXECUTE_RUN:Object.freeze({readCollections:['candidateFreezes','iterations','runs','freshContexts'],agentWritableCollections:['runs']})",
"EXECUTE_RUN:Object.freeze({readCollections:['candidateFreezes','iterations','runs','freshContexts','instructions'],agentWritableCollections:['runs']})",2)

# Screen/workbook language must match actual gate chronology and exact matrix semantics.
rep('workbook.js',
"'Convert every confirmed defect into a permanent test that reproduces the failure before correction and succeeds after correction.'",
"'Convert every confirmed defect into a permanent test that reproduces the failure before correction; later corrected or confirmation executions must prove success.'")
rep('workbook.js',
"12:['Every mandatory requirement has one verification record per run','No generator validated its own output','Every result has evidence','Verification matrix count reconciles exactly']",
"12:['Every required REQ_ID × RUN_ID × TEST_ID triple has exactly one current verification record','No generator validated its own output','Every result has evidence','Verification matrix count reconciles exactly']")
rep('workbook.js',
"15:['Every confirmed defect has a permanent regression record','Every regression fails before correction and succeeds after correction','No applicable regression is deleted','Updated test and fixture identities are recorded']",
"15:['Every confirmed defect has a permanent regression record','Every regression has an actual pre-correction failing execution; post-correction success is proven only by a later actual execution','No applicable regression is deleted','Updated test and fixture identities are recorded']")
rep('workbook.js',
"'GENERATE THE FINISHED PRODUCT'",
"'GENERATE THE CONFIRMED DELIVERABLE'")
rep('workbook.js',
"'Generate the actual requested deliverable in a fresh context using only the approved baseline materials.'",
"'Generate the exact Stage 01-confirmed deliverable in a fresh context using only the approved baseline materials and approved production instruction.'")

# Semantic tests: no impossible future evidence, no BLOCKED-spec contradiction, and exact instruction content is present in execution contexts.
p=Path('verify-prompt-semantics.mjs'); s=p.read_text()
s=s.replace("if(!record.prompt.includes('implementation-ready specification rather than pretending implementation occurred'))issues.push('ENVIRONMENT_LIMIT_RULE_MISSING');",
"if(!record.prompt.includes('Never claim work was executed merely because it can be specified'))issues.push('ENVIRONMENT_LIMIT_RULE_MISSING');")
marker="const p=baseProject();\nconst original=prompts.buildPromptRecord(17,p,{operation:'EXECUTE_RUN'"
if marker not in s: raise SystemExit('verify-prompt-semantics insertion marker missing')
insert="""{
  const p=baseProject();
  p.projectData.instructions.push({id:'INSTRUCTION-CURRENT',active:true,stage:8,scope:{inputVersion:p.job.CURRENT_INPUT_VERSION,sourceSetVersion:p.job.CURRENT_SOURCE_SET_VERSION,requirementsVersion:p.job.CURRENT_REQUIREMENTS_VERSION,testSuiteVersion:p.job.CURRENT_TEST_SUITE_VERSION,instructionVersion:p.job.CURRENT_INSTRUCTION_VERSION},fields:{INSTRUCTION_ID:'INSTRUCTION-CURRENT',INSTRUCTION_TEXT:'EXACT-CANONICAL-INSTRUCTION-CONTENT'}});
  const s1=prompts.buildPromptRecord(1,p),s15=prompts.buildPromptRecord(15,p),s21=prompts.buildPromptRecord(21,p);
  if(!s1.prompt.includes('complete implementation-ready specification')||!s1.prompt.includes('human intent confirmation'))throw new Error('Stage 01 does not establish the honest specification fallback.');
  if(s1.prompt.includes('WORK_TOO_LARGE_FOR_ENVIRONMENT plus a complete implementation-ready specification'))throw new Error('Prompt still hides a replacement deliverable inside BLOCKED.');
  if(s15.prompt.includes('post-correction result and evidence')&&!s15.prompt.includes('do not claim a post-correction result'))throw new Error('Stage 15 still asks for impossible future evidence.');
  if(!s21.prompt.includes('exact workflow deliverable confirmed at Stage 01')||!s21.prompt.includes('implementation-ready specification'))throw new Error('Stage 21 contradicts Stage 01 deliverable selection.');
  const executions=[prompts.buildPromptRecord(11,p),prompts.buildPromptRecord(17,p,{operation:'EXECUTE_RUN',scope:{projectRevision:0,inputVersion:'INPUT-v001',sourceSetVersion:'SOURCE-SET-v001',requirementsVersion:'REQUIREMENTS-v001',testSuiteVersion:'TEST-SUITE-v001',instructionVersion:'INSTRUCTION-v001',iterationId:'ITERATION-000001',candidateId:'CANDIDATE-000001',runId:'RUN-000001',contextId:'CONTEXT-000001'}}),prompts.buildPromptRecord(19,p,{operation:'EXECUTE_RUN',scope:{projectRevision:0,inputVersion:'INPUT-v001',sourceSetVersion:'SOURCE-SET-v001',requirementsVersion:'REQUIREMENTS-v001',testSuiteVersion:'TEST-SUITE-v001',instructionVersion:'INSTRUCTION-v001',iterationId:'ITERATION-000001',candidateId:'CANDIDATE-000001',runId:'RUN-000001',contextId:'CONTEXT-000001',baselineId:'BASELINE-000001'}}),s21];
  for(const r of executions)if(!r.contextManifest.readCollections.instructions||!r.prompt.includes('EXACT-CANONICAL-INSTRUCTION-CONTENT'))throw new Error(`Stage ${r.stage} ${r.operation} cannot see the canonical production instruction it must execute.`);
}

"""
s=s.replace(marker,insert+marker,1)
s=s.replace("original.prompt.replace('implementation-ready specification rather than pretending implementation occurred','assume implementation occurred')",
"original.prompt.replace('Never claim work was executed merely because it can be specified','assume implementation occurred')")
p.write_text(s)

# Direct schema regression: a Stage 15 permanent regression definition must not require future post-correction evidence.
p=Path('verify-complete.mjs'); s=p.read_text(); marker="console.log(JSON.stringify({"
if marker not in s: raise SystemExit('verify-complete marker missing')
insert="""// Stage 15 cannot require evidence from a correction that has not been executed yet.
{
  const required=schema.RECORD_SCHEMAS.regressions.required;
  assert(!required.includes('POST_CORRECTION_RESULT')&&!required.includes('POST_CORRECTION_EVIDENCE'),'Stage 15 regression schema requires impossible future post-correction evidence.');
  const reads11=schema.operationContract(11,'COMPLETE').readCollections,reads17=schema.operationContract(17,'EXECUTE_RUN').readCollections,reads19=schema.operationContract(19,'EXECUTE_RUN').readCollections,reads21=schema.operationContract(21,'COMPLETE').readCollections;
  assert([reads11,reads17,reads19,reads21].every(x=>x.includes('instructions')),'An execution/generation stage cannot read the canonical production instruction.');
}

"""
s=s.replace(marker,insert+marker,1); p.write_text(s)
