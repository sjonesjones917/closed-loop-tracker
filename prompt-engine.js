(()=>{
'use strict';
const core=globalThis.closedLoopCore;
const schema=globalThis.closedLoopWorkflowSchema;
const hash=globalThis.closedLoopHash;
if(!core||!schema||!hash)throw new Error('workbook.js, hash.js, and workflow-schema.js must load before prompt-engine.js.');
const show=v=>{if(v===undefined||v===null||v==='')return 'UNKNOWN';if(Array.isArray(v)&&!v.length)return 'NONE';if(typeof v==='object')return JSON.stringify(v,null,2);return String(v)};
const procedures={
1:'Initialize only this current job from this current job’s exact user input. Preserve the verbatim objective, exact deliverable, supplied-material inventory and provenance, inspection state, format requirements, temporal and geographic scope, user-supplied authority, tools, prohibitions, explicit user requirements, assumptions, unresolved unknowns, and controlled INPUT-vN identity. Use and preserve the application-assigned JOB_ID; do not assign or alter it. Do not create, prescribe, or instruct reuse of a master prompt, master job, reusable job definition, reusable target specification, or template for other jobs. Do not infer requirements for unrelated jobs from this job. Do not begin substantive external-source research or downstream production work.',
2:'Build the external governing source inventory for this current job only. Treat any DESIRED OR SUGGESTED SOURCE COUNT as a search target, never as authority to invent sources. Prefer primary, official, controlling sources when applicable. If no legitimate external authority applies after evidence-supported inspection, return an explicit no-applicable-source determination rather than inventing a source. Stage 01 User Job Input and Supplied Material remain authorized project inputs, but they are not automatically independent external governing sources and must not receive SOURCE_ID merely because they were supplied. Identify genuinely independent external authorities relevant to the not-yet-existing target product. Establish actual identity, issuing organization or author, source type, publication origin, URL/reference, version, date, retrieval date where applicable, authority level and role, relevance, applicable portions, inspection state, currency, supersession, controlling status, and actual SHA-256 only when controlled bytes exist. Establish an explicit authority hierarchy and separate source-conflict records. Never use the target product, this operating application, its repository, source code, UI, stored project state, screenshots, prior versions, previous generated targets, project outputs, generated prompts/instructions, or another implementation of the same target as governing source authority. Do not research requirements yet. Propose only legitimate external governing sources actually established in this stage. The application creates the controlled SOURCE-SET version after accepted canonical ingestion; if no legitimate external governing source applies, use the explicit no-source determination instead of inventing one.',
3:'Research only the legitimate Stage 02 external governing source set; research only the current accepted Stage 02 external governing source set, source-by-source and pass-by-pass. Examine exact portions and separately capture facts, mandatory obligations, recommendations, optional practices, examples, prohibitions, exceptions, dependencies, applicability facts, restrictions, invalidating material, conflicts, superseded guidance, source evidence, candidate requirement IDs, and unresolved questions. Do not research the target product, this operating application, repository source code, prior implementations, project-generated artifacts, or current UI behavior as requirement authority. Repeat discovery passes until saturation is actually supported by the evidence.',
4:'Compile atomic requirements for this current job from authorized User Job Input plus legitimately applicable Stage 03 external-source research, preserving provenance for each obligation. Each REQ_ID must express one independently testable obligation where possible and record type, mandatory/optional status, governing source or user-input relationship, exact source location when applicable, authority, applicability, dependencies, prohibitions, defined terms, observable satisfaction condition, intended verification method, expected evidence, failure condition, severity, status, and notes. Do not derive requirements from the target product or an existing implementation merely because that implementation contains a behavior.',
5:'Resolve the current job’s requirement set. Detect duplicate or conflicting requirements, impossible combinations, undefined terms, circular dependencies, missing prerequisites, unsupported requirements, uncertain applicability, and requirements lacking a verification method. Preserve the defect, governing evidence, resolution or unresolved state, changed requirement, resulting controlled version, affected downstream work, and blockers. Never silently guess away a conflict or manufacture authority.',
6:'Build this job’s verification suite before any production instruction is authored. Every active mandatory REQ_ID must have at least one valid TEST_ID. Use the strongest suitable method, including exact computation, programmatic checks, schema or structure checks, source comparison, rule-based verification, and independent human meaning/content review where deterministic checks cannot establish satisfaction. Define inputs, tools, procedure, expected result, failure condition, and evidence to preserve. Calculate mandatory requirement-to-test coverage exactly and block progression below 100 percent.',
7:'Build this job’s MUTATION-SUITE-vN to prove validators reject realistic invalid states. Include applicable missing inputs, invalid values, wrong versions, duplicate identifiers, contradictions, omitted required sections, prohibited material, corrupt references, malformed files, conflicting authority, unavailable tools, unsupported claims, injected source instructions, known-invalid artifacts, and other relevant mutations. Preserve fixture, expected rejection, actual result, validator defect where applicable, and evidence.',
8:'Author this job’s production instruction only from the resolved current requirement set and verification architecture. Define objective, authorized inputs, authority rules, failure handling, scope, prohibitions, defined terms, ordered procedure, branches, tool requirements, output contract, TRUE/FALSE/UNKNOWN handling, rejection/blocking rules, completion conditions, and requirement traceability. Do not copy or imitate an existing target implementation as authority. Do not turn this job’s production instruction into a reusable instruction for unrelated jobs unless the current user input explicitly requires such a deliverable.',
9:'Preflight this job’s production instruction in an independent context where required. Review each material clause for multiple interpretations, undefined objects, unsupplied dependencies, internal conflicts, unavailable capabilities, objective verifiability, responsible operation, ordering, defined failure behavior, and traceability. Preserve findings, defects, corrections, repeated review, final approved instruction version, and evidence. Do not execute target production during preflight.',
10:'Freeze the exact candidate for this job and iteration. Human authority selects the candidate components and the application assigns CANDIDATE_ID and ITERATION_ID and computes byte hashes; the agent must not assign those values. Preserve only permitted substantive freeze observations and evidence. The same candidate package must be used unchanged across the ten-run batch. A material change terminates the candidate and requires a new identity.',
11:'Run exactly ten independent executions for this job using the identical frozen candidate in ten fresh contexts. For each RUN_ID preserve context identity, timestamps, frozen candidate identity, contamination check, tool configuration, execution status, complete output, output artifact identities and hashes where applicable, tool failures, and notes. Runs may not see another run’s output, reviewer comments, prior failure explanations, or proposed corrections. Never select a preferred run to discard the others.',
12:'Verify each of this job’s ten executions independently. Create exactly one current verification record for every applicable REQ_ID × RUN_ID × TEST_ID triple; each triple is the required REQ_ID × RUN_ID relation linked to its exact TEST_ID. Preserve verifier and verifier-context identity, independence status, inputs, procedure, expected result, observed result, exact evidence, SATISFIED/VIOLATED/UNDETERMINED, DEFECT_ID where applicable, and reason for UNDETERMINED. Reconcile counts mathematically and do not let the generator act as its sole validator.',
13:'Compare all ten executions for this job requirement-by-requirement. Preserve every run determination, all-ten satisfaction, any violation, any undetermined result, interpretation variance, output variance, authorized versus unauthorized variance, inconclusive tests, repeated and unique failure patterns, correctness-affecting variance, linked defects, and evidence. Never discard a run because another run appears preferable.',
14:'Root-cause every material defect in this job by tracing backward through product/output, execution, instruction, requirement, research, source, user input, tool, and audit as applicable. Classify the root cause using the controlled categories, identify the earliest defective layer, preserve evidence, and identify downstream invalidation. Do not patch only the final symptom when an earlier layer is responsible.',
15:'Convert every confirmed failure in this job into permanent regression data. Link REG_ID to DEFECT_ID and REQ_ID; preserve failure fixture and identity/hash when available, reproduction procedure, detection method, pre-correction result and evidence, correction, post-correction result and evidence, permanent test location, applicability, active/retired state, and retirement authority where applicable.',
16:'Revise only the responsible earliest defective layer for this job. Create a controlled CHANGESET_ID preserving triggering defects, RCA, responsible layer, old artifact version, exact modification, new version, downstream invalidation, required reruns, instruction-change determination, repeated preflight requirement, and justified unchanged artifacts. Never overwrite a controlled version in place.',
17:'After a material upstream correction, create a complete new ten-execution iteration for this job with new ITERATION_ID and CANDIDATE_ID. Freeze the corrected versions, use ten new independent contexts, withhold prior outputs, use one identical candidate package across all ten runs, and repeat execution, verification, comparison, RCA, regressions, corrections, and lineage.',
18:'Determine convergence for this job from evidence, never from run count alone. Calculate mandatory requirement coverage, mandatory verification coverage, applicable regression success, critical defect count, major defect count, mandatory unresolved unknown count, correctness-affecting contradiction count, correctness-affecting ambiguity count, and unexplained correctness-affecting variance count. Convergence exists only when required coverage and regression success are 100 percent and every blocking count is zero simultaneously.',
19:'After convergence, run this job’s unchanged confirmation iteration using the exact converged component versions with zero material changes. Verify versions/hashes, use ten new independent contexts, rerun the complete test and regression suites, compare all runs, and detect new defects, missed requirements, missed failure cases, or new correctness-affecting variance. Any failure routes back to the responsible earlier stage.',
20:'Freeze this job’s production baseline only after successful unchanged confirmation. Human authority authorizes the baseline and the application assigns BASELINE_ID, freezes exact artifact identities, and computes byte hashes. The agent may provide only permitted substantive review findings and evidence. Any material change removes baseline validity until required workflow is repeated.',
21:'Produce the approved deliverable in a fresh production context using only approved baseline materials when the external agent environment actually has the required capability. The application reserves PRODUCT_ID and EXECUTION_ID and owns versions, timestamps, byte sizes, hashes, lineage identities, and lifecycle state; the agent must not assign them. Report only permitted substantive execution results, deviations, failures, and artifact claims, and never claim repository changes, deployment, execution, or artifact creation that did not actually occur. This static browser application itself does not connect to or modify an external repository or external system. If direct implementation is unavailable or too large for the available environment, return the structured blocking/failure result and provide a complete implementation-ready specification when that is the appropriate achievable deliverable; self-contained artifacts that can actually be produced should still be produced. No uncontrolled post-generation editing is permitted.',
22:'Run deterministic verification against the actual finished product bytes wherever deterministic testing is possible. Verify applicable arithmetic, counts, schemas, filenames, inventory, hashes, required sections, ordering, identifiers, duplicates, references, links, dates, enumerations, required/prohibited text, package contents, structure, dimensions, and other objective properties. Preserve product identity/hash, tool/version, procedure, expected result, actual result, determination, evidence, and defect.',
23:'Perform independent meaning/content verification on this job’s actual finished product where deterministic checks cannot establish substantive satisfaction. For each applicable requirement preserve requirement identity, product location, external-source evidence where applicable, required meaning, observed meaning, evidence-based comparison, SATISFIED/VIOLATED/UNDETERMINED, defect, and reason a determination could not be made. Use human-facing terminology such as Meaning Verification or Content Verification.',
24:'Perform adversarial verification on this job’s finished product. Test applicable missing material, prohibited material, contradictions, impossible logic, unsupported facts, external-source misrepresentation, wrong versions, broken references, hidden assumptions, partial completion, nonsensical meaning, terminology inconsistency, unhandled exceptions, stale facts, malformed files, hidden content, export corruption, superficial keyword compliance, and historical regressions. Preserve attack, method, expected behavior, actual result, defect, severity, and evidence.',
25:'Inspect this job’s exact final delivered representation and package. Preserve artifact inventory, filename, version, byte size, SHA-256, requirement trace, transformation chain and tool versions, before/after hashes, actual rendering/opening evidence, clipping, missing/blank content, broken layout, graphics, font substitution, overlap, hidden content, ordering, export corruption, package inventory, missing/unexpected/duplicate/corrupt files, defects, and coverage counts.',
26:'Reconcile this job’s process evidence and product evidence as two separate propositions. Process audit must compare approved versus actual inputs, instruction, tools, required tests, unauthorized modification, authorized changes, chain of custody, defects, blockers, determination, and evidence. Product audit must reconcile mandatory requirement count, affirmative satisfaction count, mandatory test count, validator results, meaning/content verification results, critical/major defects, mandatory unknowns, blockers, determination, and evidence. Neither proposition proves the other.',
27:'Review the complete current release evidence and report permitted findings or missing evidence. The application alone computes and stores exactly one idempotent release determination: ACCEPTED, REJECTED, or BLOCKED; the agent and human must not set it. Preserve evidence that supports the application calculation. ACCEPTED does not itself authorize delivery.',
28:'Only after Stage 27 is ACCEPTED, verify exact artifact identity immediately before release. Compare audited artifact identity, filename, version, path/storage, byte size, SHA-256, and the exact artifact selected for delivery with its release filename/version/path/size and immediate pre-delivery SHA-256. Any mismatch or post-audit modification stops release.',
29:'Preserve this job’s complete evidence chain for every mandatory requirement: EXTERNAL SOURCE / USER AUTHORITY AS APPLICABLE -> REQUIREMENT -> INSTRUCTION -> EXECUTION -> PRODUCT ELEMENT -> TEST -> TEST RESULT -> EVIDENCE -> RELEASE DECISION and, when released, ARTIFACT HASH IDENTITY. Preserve exact IDs, versions, locations, relationships, and evidence. Missing links remain missing and produce FALSE, UNKNOWN, UNDETERMINED, or BLOCKED as appropriate; never fabricate a chain link.',
30:'Preserve this job’s failures permanently in append-only defect and regression history. Every defect record must retain stable identity, date, JOB_ID, ITERATION_ID, RUN_ID and/or PRODUCT_ID, REQ_ID, observed failure, expected condition, evidence, severity, root-cause category and cause, correction, changed artifacts, REG_ID, verification result, status, relationships, and append-only corrections. Every confirmed defect requires permanent regression information, and applicable regressions must be rerun for later baseline candidates; failed or UNDETERMINED applicable regressions block approval.'
};
const recordId=(record,collection)=>String(record?.id||record?.recordId||record?.[schema.RECORD_SCHEMAS[collection]?.idField]||record?.fields?.[schema.RECORD_SCHEMAS[collection]?.idField]||'UNKNOWN');
function boundedCollection(state,collection){
 const list=Array.isArray(state?.projectData?.[collection])?state.projectData[collection]:[];if(!list.length)return 'NONE';
 const active=list.filter(x=>x?.active!==false&&!x?.invalidatedBy);
 return show({totalActive:active.length,records:active.map(record=>({id:recordId(record,collection),stage:record.stage??'UNKNOWN',scope:record.scope||{},fields:record.fields||record,relationships:record.relationships||{},contentSha256:record.contentSha256||record.sha256||'UNKNOWN'})),omitted:0,selectionRule:'All active records selected by the explicit stage readCollections contract; large artifact bytes are referenced by canonical artifact identity.'});
}
function contextFor(stage,state,operation){
 const parts=[];
 if(stage>1){const prior=state?.stages?.[stage-1]?{agentData:state.stages[stage-1].agentData||state.stages[stage-1].acceptedData||{},humanData:state.stages[stage-1].humanData||{},derivedData:state.stages[stage-1].derivedData||{}}:'NONE';parts.push(`PRIOR STAGE DECISION AND ACCEPTED DATA\n${show(prior)}`);}
 const open=(state?.projectData?.blockers||[]).filter(x=>!x.invalidatedBy&&!['CLOSED','RESOLVED','RETIRED'].includes(String(x?.fields?.STATUS||x?.STATUS||x?.status||'OPEN').toUpperCase()));
 if(open.length)parts.push(`APPLICABLE OPEN BLOCKERS\n${show(open)}`);
 const questions=(state?.projectData?.humanInputRequests||[]).filter(x=>Number(x.stage)===stage&&String(x.status||'OPEN').toUpperCase()==='OPEN');
 if(questions.length)parts.push(`UNRESOLVED HUMAN INPUT REQUESTS\n${show(questions)}`);
 const answered=(state?.projectData?.humanInputAnswers||[]).filter(x=>Number(x.stage)===stage).map(x=>({questionId:x.requestId,question:x.question,answer:x.answer,answerType:x.answerType||'UNKNOWN',inputVersion:x.inputVersion||state?.job?.CURRENT_INPUT_VERSION||'UNKNOWN',operatorLabel:x.operatorLabel||x.operator||'UNSPECIFIED',affectedStageFields:x.affectedStageFields||[],affectedRecords:x.affectedRecords||[]}));
 if(answered.length)parts.push(`ANSWERED HUMAN CLARIFICATIONS\n${show(answered)}`);
 const validations=(state?.projectData?.responseValidations||[]).filter(x=>Number(x.stage)===stage&&x.valid===false).slice(-3).map(x=>({validationId:x.validationId,rawResponseId:x.rawResponseId,issues:(x.issues||[]).map(i=>({code:i.code,path:i.path,message:i.message}))}));
 if(validations.length)parts.push(`PRIOR RESPONSE VALIDATION FAILURES TO CORRECT\n${show(validations)}`);
 const corrections=(state?.projectData?.rejectedResponses||[]).filter(x=>Number(x.stage)===stage&&x.requestCorrection&&!x.invalidatedBy).map(x=>({rejectedResponseId:x.rejectedResponseId,reason:x.reason,rawResponseId:x.rawResponseId}));
 if(corrections.length)parts.push(`OPERATOR REQUESTED CORRECTIONS / REFINEMENTS\n${show(corrections)}`);
 const op=schema.operationContract(stage,operation||schema.STAGE_CONTRACTS[stage].operations[0]);
 for(const collection of op?.readCollections||schema.STAGE_CONTRACTS[stage].readCollections||[])parts.push(`${collection.replace(/([a-z])([A-Z])/g,'$1 $2').replace(/_/g,' ').toUpperCase()}\n${boundedCollection(state,collection)}`);
 return parts.join('\n\n')||'No additional stage-specific canonical records are established.';
}
function scopeFor(stage,state,overrides={}){const j=state?.job||{};const value={projectRevision:Number(state?.revision||0),inputVersion:j.CURRENT_INPUT_VERSION||null,sourceSetVersion:j.CURRENT_SOURCE_SET_VERSION||null,requirementsVersion:j.CURRENT_REQUIREMENTS_VERSION||null,testSuiteVersion:j.CURRENT_TEST_SUITE_VERSION||null,instructionVersion:j.CURRENT_INSTRUCTION_VERSION||null,iterationId:j.CURRENT_ITERATION||null,candidateId:state?.projectData?.candidateFreezes?.filter(x=>x?.active!==false&&!x?.invalidatedBy).at(-1)?.id||null,runId:overrides.runId||null,contextId:overrides.contextId||null,baselineId:j.CURRENT_BASELINE_ID&&!['NONE','NOT APPLICABLE'].includes(String(j.CURRENT_BASELINE_ID))?j.CURRENT_BASELINE_ID:null,productId:j.CURRENT_PRODUCT_ID&&!['NONE','NOT APPLICABLE'].includes(String(j.CURRENT_PRODUCT_ID))?j.CURRENT_PRODUCT_ID:null};return value;}
function responseContractDescriptor(stage,operation){const contract=schema.STAGE_CONTRACTS[stage],op=schema.operationContract(stage,operation);return {schema:schema.RESPONSE_SCHEMA,stage,operation,responseTypes:schema.RESPONSE_TYPES,scopeRequirements:op?.scopeRequirements||contract.scopeRequirements,agentStageFields:contract.allowedStageData,agentWritableCollections:op?.agentWritableCollections||contract.agentWritableCollections,resourceLimits:contract.resourceLimits};}
function responseContract(stage,operation,instructionId,bodySha256,contractSha256,contextSignature,scope){
 const contract=schema.STAGE_CONTRACTS[stage],op=schema.operationContract(stage,operation);const writable=op?.agentWritableCollections||contract.agentWritableCollections;
 const recordShape=Object.fromEntries(writable.map(collection=>[collection,[{tempKey:'response-local-key',targetId:null,fields:Object.fromEntries(schema.recordAgentFields(collection).map(name=>[name,'<value>'])),relationships:{},evidenceRefs:['evidence-1']}]]));
 return JSON.stringify({schema:schema.RESPONSE_SCHEMA,jobId:'<exact current JOB_ID>',stage,operation,promptIdentity:{instructionId,bodySha256,contractSha256,contextSignature},scope,responseType:'DATA_PROPOSAL',humanInputRequests:[],stageData:Object.fromEntries(contract.allowedStageData.map(name=>[name,'<value>'])),records:recordShape,evidence:[{temporaryKey:'evidence-1',kind:'WORKFLOW_EVIDENCE',description:'Exact evidence supporting proposed values',location:'<source/output location>',content:'<exact evidence or faithful excerpt>'}],unresolved:[],warnings:[],attachments:[]},null,2);
}
function body(stage,state,operation){
 const d=core.STAGES[stage-1],j=state?.job||{};
 const contract=schema.STAGE_CONTRACTS[stage],op=schema.operationContract(stage,operation||contract.operations[0]);
 const fields=contract.allowedStageData.length?contract.allowedStageData.map(x=>`- ${x}`).join('\n'):'- No agent-owned stageData fields; use permitted records/evidence only.';
 const writable=op?.agentWritableCollections||contract.agentWritableCollections;
 const collections=writable.length?writable.map(c=>`- ${c}: ${schema.recordAgentFields(c).join(', ')||'no agent-owned fields'}`).join('\n'):'- NONE';
 return `COPY BLOCK — STAGE ${String(stage).padStart(2,'0')} — ${d.title}

ROLE
You are the ${d.role}. Perform only Stage ${String(stage).padStart(2,'0')} for this single current project.

PROJECT-SCOPE BOUNDARY
This instruction belongs only to JOB_ID ${j.JOB_ID||'UNKNOWN'}. The project target is treated as not yet existing until Stage 21. The operating application, its repository, source code, UI, stored state, screenshots, prior target versions, generated project artifacts, and other implementations of the same target are never Stage 02 governing sources or Stage 03 requirement authority. They may be used only for implementation-side work when a project explicitly concerns implementation verification.

JOB CONTROL
JOB_ID: ${j.JOB_ID||'UNKNOWN'}
JOB_TITLE: ${j.JOB_TITLE||'UNKNOWN'}
CURRENT_ITERATION: ${j.CURRENT_ITERATION||'NOT APPLICABLE'}
CURRENT_STAGE: STAGE ${String(stage).padStart(2,'0')}
CURRENT_STATE: ${j.CURRENT_STATE||'UNKNOWN'}
NEXT_REQUIRED_ACTION: ${j.NEXT_REQUIRED_ACTION||'UNKNOWN'}
INPUT_VERSION: ${j.CURRENT_INPUT_VERSION||'UNKNOWN'}
SOURCE_SET_VERSION: ${j.CURRENT_SOURCE_SET_VERSION||'NOT APPLICABLE'}
REQUIREMENTS_VERSION: ${j.CURRENT_REQUIREMENTS_VERSION||'NOT APPLICABLE'}
TEST_SUITE_VERSION: ${j.CURRENT_TEST_SUITE_VERSION||'NOT APPLICABLE'}
INSTRUCTION_VERSION: ${j.CURRENT_INSTRUCTION_VERSION||'NOT APPLICABLE'}
BASELINE_ID: ${j.CURRENT_BASELINE_ID||'NOT APPLICABLE'}
PRODUCT_ID: ${j.CURRENT_PRODUCT_ID||'NOT APPLICABLE'}

AUTHORIZED USER JOB INPUT
VERBATIM REQUEST / OBJECTIVE:
${show(j.EXACT_USER_OBJECTIVE_VERBATIM)}

REQUESTED DELIVERABLE:
${show(j.EXACT_DELIVERABLE_REQUESTED)}

SUPPLIED MATERIALS:
${show(j.SUPPLIED_MATERIALS_INVENTORY)}

USER-SUPPLIED KNOWN AUTHORITY (classification preserved; do not automatically relabel as external authority):
${show(j.KNOWN_AUTHORITATIVE_SOURCES)}

AVAILABLE TOOLS:
${show(j.AVAILABLE_TOOLS)}

PROHIBITED ACTIONS:
${show(j.PROHIBITED_ACTIONS)}

EXPLICIT USER REQUIREMENTS:
${show(j.EXPLICIT_USER_REQUIREMENTS)}

${stage===2?`STAGE 02 SOURCE DISCOVERY GUIDANCE
DESIRED OR SUGGESTED SOURCE COUNT: ${show(j.DESIRED_SOURCE_COUNT)}
Treat this count as guidance, not a quota. When web access is available, search broadly enough to discover the relevant source landscape, then inspect and prefer original authoritative publications rather than summaries or search snippets. Prefer the most authoritative and reputable sources appropriate to the domain, prioritizing primary, official, controlling sources where they exist. Verify identity, currency, applicability, and authority before proposing a source. If no legitimate external governing source applies, return SOURCE_APPLICABILITY_DETERMINATION = NO_APPLICABLE_EXTERNAL_SOURCE with evidence; never invent a source merely to satisfy a count.
`:''}
AUTHORIZED BOUNDED CONTEXT FOR THIS STAGE
${contextFor(stage,state,operation)}

STAGE-SPECIFIC TASK
${procedures[stage]}

PERMITTED AGENT-OWNED STAGE DATA
${fields}

PERMITTED RECORD COLLECTIONS AND AGENT-OWNED FIELDS
${collections}

COMPLETION CONDITIONS
${(d.completionGate||[]).map(x=>`- ${x}`).join('\n')}

MANDATORY RESPONSE RULES
- Return exactly one JSON object and no Markdown fence, preamble, or trailing prose.
- Use schema ${schema.RESPONSE_SCHEMA} and echo the exact operation, scope, instructionId, bodySha256, contractSha256, and contextSignature supplied below.
- Use only DATA_PROPOSAL, HUMAN_INPUT_REQUIRED, BLOCKED, or EXECUTION_FAILED as responseType.
- Never assign canonical application IDs, versions, timestamps, counts, hashes, statuses, coverage values, release determinations, current stage/state, or other application-owned values. Use temporaryKey and response-local references where relationships are needed.
- Never set a HUMAN or HUMAN_DECISION-owned field. When unavailable human information is required, return HUMAN_INPUT_REQUIRED and structured humanInputRequests. Do not convert a missing human decision into an assumption.
- Include evidence for every agent-produced canonical value that requires provenance.
- Do not include collections or fields outside the current stage contract.
- Preserve TRUE/FALSE/UNKNOWN/NONE/NOT APPLICABLE and SATISFIED/VIOLATED/UNDETERMINED meanings exactly.
- Stage 02 may contain only genuinely independent external governing sources; target-product and repository artifacts are prohibited.
- Stage 03 may research only accepted Stage 02 external governing sources.
- If required authority, evidence, capability, or decision rule is unavailable, return BLOCKED or HUMAN_INPUT_REQUIRED as applicable rather than inventing data.
- If execution itself is unavailable, return EXECUTION_FAILED; do not represent unexecuted work as completed.
- A rejected response or rejected data is not canonical and must not be reused as accepted project truth.
- Before substantive work at this stage, decide whether the current human input, canonical application context, prior accepted outputs, evidence, and available capabilities are sufficient to proceed reliably for this specific job and stage. Do not use a generic hard-coded sufficiency threshold.
- Missing human-authority information requires HUMAN_INPUT_REQUIRED. Missing, stale, or incomplete canonical application context requires BLOCKED with MISSING_APPLICATION_CONTEXT. A materially inadequate accepted prior-stage agent result requires BLOCKED with INADEQUATE_PRIOR_OUTPUT and must identify the earliest result that needs refinement. An unavailable external capability requires BLOCKED with MISSING_CAPABILITY, or EXECUTION_FAILED if an attempted execution failed. Work too large for the available environment requires BLOCKED with WORK_TOO_LARGE_FOR_ENVIRONMENT plus a complete implementation-ready specification; do not claim execution occurred. Self-contained deliverables that can actually be produced in the available environment should still be produced.
- If the result is incomplete or needs refinement, identify the exact missing, incorrect, or insufficient work so the next controlling prompt can correct it without restarting the project.
- This static application does not itself read from or write to an external project repository. Treat repository implementation as unavailable unless the external agent execution context actually provides that capability and the current stage authorizes its use.
- When the environment cannot perform a requested implementation or execution, provide an implementation-ready specification rather than pretending implementation occurred.

RESPONSE ENVELOPE
The application will provide the controlling prompt identity immediately after this hashed instruction body. Echo that identity exactly in promptIdentity.

END HASHED INSTRUCTION BODY`;
}
function buildPromptRecord(stageOrDefinition,state,options={}){
 const stage=Number(stageOrDefinition?.number||stageOrDefinition);if(!Number.isInteger(stage)||stage<1||stage>schema.STAGE_COUNT)throw new Error(`Stage must be 1 through ${schema.STAGE_COUNT}.`);
 const d=core.STAGES[stage-1],existing=(state?.projectData?.generatedPrompts||[]).filter(x=>Number(x.stage)===stage),activeExisting=existing.filter(x=>!x.invalidatedBy);const operation=options.operation||schema.STAGE_CONTRACTS[stage].operations[0];if(!schema.STAGE_CONTRACTS[stage].operations.includes(operation))throw new Error(`Operation ${operation} is not valid for Stage ${stage}.`);
 const opContract=schema.operationContract(stage,operation);const scope=scopeFor(stage,state,options.scope||{}),contextManifest={stage,operation,scope,readCollections:Object.fromEntries((opContract?.readCollections||schema.STAGE_CONTRACTS[stage].readCollections||[]).map(collection=>[collection,(state?.projectData?.[collection]||[]).filter(x=>x?.active!==false&&!x?.invalidatedBy).map(record=>({id:recordId(record,collection),scope:record.scope||{},contentSha256:record.contentSha256||record.sha256||hash.sha256Value(record.fields||record)}))])),answeredHumanClarifications:(state?.projectData?.humanInputAnswers||[]).filter(x=>Number(x.stage)===stage).map(x=>({requestId:x.requestId,answerId:x.answerId,inputVersion:x.inputVersion||state?.job?.CURRENT_INPUT_VERSION||null})),validationFailures:(state?.projectData?.responseValidations||[]).filter(x=>Number(x.stage)===stage&&x.valid===false).slice(-3).map(x=>({validationId:x.validationId,rawResponseId:x.rawResponseId,issues:(x.issues||[]).map(i=>({code:i.code,path:i.path,message:i.message}))})),operatorCorrectionRequests:(state?.projectData?.rejectedResponses||[]).filter(x=>Number(x.stage)===stage&&x.requestCorrection&&!x.invalidatedBy).map(x=>({rejectedResponseId:x.rejectedResponseId,reason:x.reason,rawResponseId:x.rawResponseId}))};
 const contextSignature=hash.sha256Value(contextManifest),bodyText=body(stage,state,operation),bodySha256=hash.sha256Text(bodyText),descriptor=responseContractDescriptor(stage,operation),contractSha256=hash.sha256Value(descriptor);
 const same=activeExisting.find(x=>x.contextSignature===contextSignature&&x.bodySha256===bodySha256&&x.contractSha256===contractSha256&&x.operation===operation);
 const instructionId=same?.instructionId||same?.promptId||`INSTRUCTION-${String(state?.job?.JOB_ID||'UNKNOWN').replace(/[^A-Za-z0-9-]/g,'')}-S${String(stage).padStart(2,'0')}-${String(existing.length+1).padStart(3,'0')}`;
 const identityBlock=`\n\nPROMPT IDENTITY — ECHO EXACTLY\nINSTRUCTION_ID: ${instructionId}\nBODY_SHA256: ${bodySha256}\nCONTRACT_SHA256: ${contractSha256}\nCONTEXT_SIGNATURE: ${contextSignature}\nOPERATION: ${operation}\nPROJECT_REVISION: ${scope.projectRevision}\n\nSTRICT RESPONSE CONTRACT\n${responseContract(stage,operation,instructionId,bodySha256,contractSha256,contextSignature,scope)}\n\nEND COPY BLOCK — STAGE ${String(stage).padStart(2,'0')}`;
 const prompt=bodyText+identityBlock;return {instructionId,promptId:instructionId,stage,operation,role:d.role,bodySha256,sha256:bodySha256,contractSha256,contextSignature,contextManifest,scope,scopeSha256:hash.sha256Value(scope),prompt,fullTextSha256:hash.sha256Text(prompt)};
}
function build(stageOrDefinition,state,options){return buildPromptRecord(stageOrDefinition,state,options).prompt;}
core.buildStagePrompt=build;
globalThis.closedLoopPromptEngine=Object.freeze({version:'closed-loop-prompt-engine/4',build,buildPromptRecord,procedures,contextFor,scopeFor,responseContractDescriptor,responseContract});
})();
