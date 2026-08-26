(()=>{
'use strict';
const core=globalThis.closedLoopCore;
const schema=globalThis.closedLoopWorkflowSchema;
const hash=globalThis.closedLoopHash;
if(!core||!schema||!hash)throw new Error('workbook.js, hash.js, and workflow-schema.js must load before prompt-engine.js.');
const show=v=>{if(v===undefined||v===null||v==='')return 'UNKNOWN';if(Array.isArray(v)&&!v.length)return 'NONE';if(typeof v==='object')return JSON.stringify(v,null,2);return String(v)};
const procedures={
1:'Initialize only this current job from this current job’s exact user input. Preserve the verbatim objective, exact deliverable, supplied-material inventory and provenance, inspection state, format requirements, temporal and geographic scope, user-supplied authority, tools, prohibitions, explicit user requirements, assumptions, unresolved unknowns, and controlled INPUT-vN identity. Use the application-supplied JOB_ID; do not assign or replace it. Do not create, prescribe, or instruct reuse of a master prompt, master job, reusable job definition, reusable target specification, or template for other jobs. Do not infer requirements for unrelated jobs from this job. Do not begin substantive external-source research or downstream production work.',
2:'Build the external governing source inventory for this current job only. Treat any DESIRED OR SUGGESTED SOURCE COUNT as a search target, never as authority to invent sources. Prefer primary, official, controlling sources when applicable. If no legitimate external authority applies after evidence-supported inspection, return an explicit no-applicable-source determination rather than inventing a source. Stage 01 User Job Input and Supplied Material remain authorized project inputs, but they are not automatically independent external governing sources and must not receive SOURCE_ID merely because they were supplied. Identify genuinely independent external authorities relevant to the not-yet-existing target product. Establish actual identity, issuing organization or author, source type, publication origin, URL/reference, version, date, retrieval date where applicable, authority level and role, relevance, applicable portions, inspection state, currency, supersession, controlling status, and actual SHA-256 only when controlled bytes exist. Establish an explicit authority hierarchy and separate source-conflict records. Never use the target product, this operating application, its repository, source code, UI, stored project state, screenshots, prior versions, previous generated targets, project outputs, generated prompts/instructions, or another implementation of the same target as governing source authority. Do not research requirements yet. Propose only legitimate external governing sources actually established in this stage; the application controls SOURCE-SET-vN identity and versioning. If none are established, return the evidence-supported no-applicable-source determination.',
3:'Research only the current accepted Stage 02 external governing source set, source-by-source and pass-by-pass. Examine exact portions and separately capture facts, mandatory obligations, recommendations, optional practices, examples, prohibitions, exceptions, dependencies, applicability facts, restrictions, invalidating material, conflicts, superseded guidance, source evidence, candidate requirement references, and unresolved questions. Do not research the target product, this operating application, repository source code, prior implementations, project-generated artifacts, or current UI behavior as requirement authority. Repeat discovery passes until saturation is actually supported by the evidence.',
4:'Compile atomic requirements for this current job from authorized User Job Input plus legitimately applicable Stage 03 external-source research, preserving provenance for each obligation. Each proposed requirement must express one independently testable obligation where possible and record type, mandatory/optional status, governing source or user-input relationship, exact source location when applicable, authority, applicability, dependencies, prohibitions, defined terms, observable satisfaction condition, intended verification method, expected evidence, failure condition, severity, status, and notes. The application assigns REQ_ID. Do not derive requirements from the target product or an existing implementation merely because that implementation contains a behavior.',
5:'Resolve the current job’s requirement set. Detect duplicate or conflicting requirements, impossible combinations, undefined terms, circular dependencies, missing prerequisites, unsupported requirements, uncertain applicability, and requirements lacking a verification method. Preserve the defect, governing evidence, proposed resolution or unresolved state, changed requirement, affected downstream work, and blockers. The application controls requirement-set versioning. Never silently guess away a conflict or manufacture authority.',
6:'Build this job’s verification suite before any production instruction is authored. Every active mandatory requirement must have at least one valid applicable test. Use the strongest suitable method, including exact computation, programmatic checks, schema or structure checks, source comparison, rule-based verification, and independent human meaning/content review where deterministic checks cannot establish satisfaction. Define inputs, tools, procedure, expected result, failure condition, and evidence to preserve. The application assigns TEST_ID and calculates exact mandatory requirement-to-test coverage; do not assert those application-derived values.',
7:'Build the substantive mutation and failure-test proposals that prove validators reject realistic invalid states. Include applicable missing inputs, invalid values, wrong versions, duplicate identifiers, contradictions, omitted required sections, prohibited material, corrupt references, malformed files, conflicting authority, unavailable tools, unsupported claims, injected source instructions, known-invalid artifacts, and other relevant mutations. Preserve fixture, expected rejection, actual result, validator defect where applicable, and evidence. The application controls canonical identities and suite versions.',
8:'Author this job’s production instruction only from the resolved current requirement set and verification architecture. Define objective, authorized inputs, authority rules, failure handling, scope, prohibitions, defined terms, ordered procedure, branches, tool requirements, output contract, TRUE/FALSE/UNKNOWN handling, rejection/blocking rules, completion conditions, and requirement traceability. Do not copy or imitate an existing target implementation as authority. Do not turn this job’s production instruction into a reusable instruction for unrelated jobs unless the current user input explicitly requires such a deliverable.',
9:'Preflight this job’s production instruction in an independent context where required. Review each material clause for multiple interpretations, undefined objects, unsupplied dependencies, internal conflicts, unavailable capabilities, objective verifiability, responsible operation, ordering, defined failure behavior, and traceability. Preserve findings, defects, proposed corrections, repeated review, and evidence. The application controls instruction versions and final workflow state. Do not execute target production during preflight.',
10:'Describe the exact candidate components selected by the human for this job and iteration and any substantive configuration facts the agent is permitted to provide. The application assigns CANDIDATE_ID and ITERATION_ID, freezes the selected artifact bytes, calculates hashes, and preserves immutable identity. The same candidate package must be used unchanged across the ten-run batch. A material change requires the application to create a new candidate identity.',
11:'Execute the application-reserved run for this job using the exact frozen candidate and fresh context identified in scope. Preserve permitted execution observations, contamination facts, tool configuration, complete output, tool failures, and evidence. The application owns RUN_ID, CONTEXT_ID, candidate identity, timestamps, receipt identity, and byte hashes. Runs may not see another run’s output, reviewer comments, prior failure explanations, or proposed corrections.',
12:'Verify each application-reserved execution independently. Create exactly one applicable verification proposal for every required current REQ_ID × RUN_ID × TEST_ID triple. Preserve verifier and verifier-context identity, independence status, inputs, procedure, expected result, observed result, exact evidence, SATISFIED/VIOLATED/UNDETERMINED, defect relationship where applicable, and reason for UNDETERMINED. The application reconciles matrix counts mathematically; do not let the generator act as its sole validator.',
13:'Compare all ten current executions for this job requirement-by-requirement. Preserve every run determination, interpretation variance, output variance, authorized versus unauthorized variance, inconclusive tests, repeated and unique failure patterns, correctness-affecting variance, linked defects, and evidence. The application calculates all-ten, any-violation, any-undetermined, and coverage values. Never discard a run because another run appears preferable.',
14:'Root-cause every material defect in this job by tracing backward through product/output, execution, instruction, requirement, research, source, user input, tool, and audit as applicable. Classify the root cause using the controlled categories, identify the earliest defective layer, preserve evidence, and identify downstream invalidation. Do not patch only the final symptom when an earlier layer is responsible.',
15:'Propose permanent regression content for every confirmed failure in this job. Relate it to the relevant defect and requirement; preserve failure fixture and identity/hash when available, reproduction procedure, detection method, pre-correction result and evidence, correction, post-correction result and evidence, permanent test location, applicability, and retirement rationale where applicable. The application assigns REG_ID and controls lifecycle state.',
16:'Propose a correction only at the responsible earliest defective layer for this job. Preserve triggering defects, RCA, responsible layer, old artifact version, exact modification, downstream invalidation, required reruns, instruction-change determination, repeated preflight requirement, and justified unchanged artifacts. The application assigns CHANGESET_ID, creates controlled versions, and performs downstream invalidation. Never overwrite a controlled version in place.',
17:'After a material upstream correction, perform only the requested Stage 17 operation for the application-created corrected iteration and candidate. The application creates ITERATION_ID, CANDIDATE_ID, run/context identities, and frozen hashes. Across the Stage 17 operations, use ten new independent contexts, withhold prior outputs, keep one identical candidate package across all ten runs, and repeat execution, verification, comparison, RCA, regression execution, and correction behavior as required.',
18:'Analyze the current corrected-iteration evidence and explain any remaining anomaly or missing evidence. Do not set convergence, coverage, counts, or success metrics. The application deterministically calculates mandatory requirement coverage, mandatory verification coverage, applicable regression success, defect/unknown/contradiction/ambiguity/variance counts, and the convergence result from the current corrected iteration.',
19:'After convergence, perform only the requested unchanged-confirmation operation using the exact application-identified converged candidate with zero material changes. The application preserves the candidate identity and creates a new confirmation iteration and ten fresh run/context identities. Rerun the complete test and regression suites as requested, compare all runs, and report new defects, missed requirements, missed failure cases, or correctness-affecting variance. Any failure routes back to the responsible earlier stage.',
20:'Provide only substantive supporting evidence requested for baseline review. Human authority decides whether to authorize the baseline; the application assigns BASELINE_ID, freezes exact approved versions and artifact bytes, calculates hashes, and records immutable baseline identity. Any material change removes baseline validity until required workflow is repeated.',
21:'Generate the finished target product in the application-reserved production identity and fresh production context using only approved baseline materials. Before this stage the finished target product is not treated as existing. Do not assign PRODUCT_ID, PRODUCT_VERSION, BASELINE_ID, EXECUTION_ID, timestamps, artifact IDs, byte sizes, or hashes; the application owns those identities and objective byte facts. Return only permitted substantive production fields, output content, deviations, failures, tool facts, and declared attachments for application byte verification. No uncontrolled post-generation editing is permitted.',
22:'Perform or report deterministic verification against the actual finished product only where the current environment can genuinely execute the check. Test applicable arithmetic, counts, schemas, required sections, ordering, references, links, dates, enumerations, required/prohibited text, package contents, structure, dimensions, and other objective properties; do not invent execution. Preserve tool/version, procedure, expected result, observed result, determination, evidence, and defect relationship. Application-owned file identities, byte sizes, hashes, inventory facts, and coverage calculations remain application-derived.',
23:'Perform independent meaning/content verification on this job’s actual finished product where deterministic checks cannot establish substantive satisfaction. For each applicable requirement preserve requirement identity, product location, external-source evidence where applicable, required meaning, observed meaning, evidence-based comparison, SATISFIED/VIOLATED/UNDETERMINED, defect, and reason a determination could not be made. Use human-facing terminology such as Meaning Verification or Content Verification.',
24:'Perform adversarial verification on this job’s finished product. Test applicable missing material, prohibited material, contradictions, impossible logic, unsupported facts, external-source misrepresentation, wrong versions, broken references, hidden assumptions, partial completion, nonsensical meaning, terminology inconsistency, unhandled exceptions, stale facts, malformed files, hidden content, export corruption, superficial keyword compliance, and historical regressions. Preserve attack, method, expected behavior, actual result, defect, severity, and evidence.',
25:'Inspect the human-visible meaning, rendering, and representation quality of this job’s exact final delivered artifacts and package. Report only irreducible inspection observations and evidence such as clipping, missing/blank content, broken layout, graphics, font substitution, overlap, hidden content, ordering, or export-visible corruption. Do not assert filenames, versions, byte sizes, SHA-256 values, package inventory counts, or other objective file facts that the application can derive from stored bytes.',
26:'Audit this job’s process evidence and product evidence as two separate propositions. Review approved versus actual inputs, instruction, tools, required tests, unauthorized modification, authorized changes, chain of custody, defects, blockers, substantive discrepancies, validator findings, and meaning/content findings. Do not set application-derived counts or final audit/release state where the schema reserves them to the application. Neither process correctness nor product correctness proves the other.',
27:'Review the complete current release evidence for omissions, contradictions, stale evidence, unresolved defects, blockers, or unsupported claims. Report substantive review findings and controlling evidence only through the permitted response surface. The application alone computes and records exactly one current release determination: ACCEPTED, REJECTED, or BLOCKED. Neither the agent nor the human may set that determination, and ACCEPTED does not itself authorize delivery.',
28:'After the application has a current Stage 27 ACCEPTED result, investigate any requested artifact-identity discrepancy or missing identity evidence. The application performs the authoritative one-to-one comparison of audited and delivery artifact identity, authorized filename, actual byte size, and SHA-256 from stored bytes, independent of file order. Do not assert an application-calculated identity match.',
29:'Investigate only missing evidence links or ambiguous provenance requested by the application. The application constructs the canonical evidence graph from existing IDs and requires every mandatory authority/user-authority -> requirement -> instruction trace -> execution/product -> applicable test -> required test result -> canonical evidence -> current release -> released-artifact edge. Do not invent or manually type routine canonical links; missing links remain missing and block as appropriate.',
30:'Preserve this job’s failure meaning and substantive regression/history information without rewriting prior records. The application maintains append-only defect and regression history, stable canonical identities, timestamps, lifecycle state, and superseding correction relationships. Report new defect/regression facts and correction evidence through the permitted response surface; applicable failed or UNDETERMINED regressions block approval.'
};
const contextCollections={
1:[],2:[],3:['sources','sourceConflicts'],4:['research','candidateRequirements','sources'],5:['requirements','research','sourceConflicts'],6:['requirements','requirementResolutions'],7:['requirements','tests'],8:['requirements','tests','failureTests','requirementResolutions'],9:['instructions','requirements','tests'],10:['instructions','preflightRecords','tests','failureTests'],11:['candidateFreezes','iterations','freshContexts'],12:['runs','requirements','tests','freshContexts'],13:['verification','runs','requirements'],14:['defects','comparisons','verification'],15:['defects','rootCauses'],16:['defects','rootCauses','regressions'],17:['changes','candidateFreezes','iterations','tests','regressions'],18:['iterations','runs','verification','comparisons','defects','regressions','blockers'],19:['convergenceRecords','candidateFreezes','tests','regressions'],20:['confirmationRecords','candidateFreezes','iterations'],21:['baselines','freshContexts'],22:['products','tests','artifacts'],23:['products','requirements','sources'],24:['products','requirements','regressions'],25:['products','artifacts'],26:['products','baselines','deterministicResults','meaningResults','adversarialResults','representationInspections'],27:['requirements','tests','deterministicResults','meaningResults','adversarialResults','representationInspections','processAudits','productAudits','defects','blockers'],28:['releaseRecords','artifactIdentities','artifacts'],29:['sources','requirements','instructions','runs','products','tests','verification','releaseRecords','artifactIdentities'],30:['defects','rootCauses','regressions','changes','baselines']
};
const recordId=(record,collection)=>String(record?.id||record?.recordId||record?.[schema.RECORD_SCHEMAS[collection]?.idField]||record?.fields?.[schema.RECORD_SCHEMAS[collection]?.idField]||'UNKNOWN');
function boundedCollection(state,collection){
 const list=Array.isArray(state?.projectData?.[collection])?state.projectData[collection]:[];if(!list.length)return 'NONE';
 const active=list.filter(x=>x?.active!==false&&!x?.invalidatedBy);
 return show({totalActive:active.length,records:active.map(record=>({id:recordId(record,collection),stage:record.stage??'UNKNOWN',scope:record.scope||{},fields:record.fields||record,relationships:record.relationships||{},contentSha256:record.contentSha256||record.sha256||'UNKNOWN'})),omitted:0,selectionRule:'All active records selected by the explicit stage readCollections contract; large artifact bytes are referenced by canonical artifact identity.'});
}
function contextFor(stage,state){
 const parts=[];
 if(stage>1){const prior=state?.stages?.[stage-1]?{agentData:state.stages[stage-1].agentData||state.stages[stage-1].acceptedData||{},humanData:state.stages[stage-1].humanData||{},derivedData:state.stages[stage-1].derivedData||{}}:'NONE';parts.push(`PRIOR STAGE DECISION AND ACCEPTED DATA\n${show(prior)}`);}
 const open=(state?.projectData?.blockers||[]).filter(x=>!x.invalidatedBy&&!['CLOSED','RESOLVED','RETIRED'].includes(String(x?.fields?.STATUS||x?.STATUS||x?.status||'OPEN').toUpperCase()));
 if(open.length)parts.push(`APPLICABLE OPEN BLOCKERS\n${show(open.slice(-20))}`);
 const questions=(state?.projectData?.humanInputRequests||[]).filter(x=>Number(x.stage)===stage&&String(x.status||'OPEN').toUpperCase()==='OPEN');
 if(questions.length)parts.push(`UNRESOLVED HUMAN INPUT REQUESTS\n${show(questions)}`);
 const answered=(state?.projectData?.humanInputAnswers||[]).filter(x=>Number(x.stage)===stage).map(x=>({questionId:x.requestId,question:x.question,answer:x.answer,answerType:x.answerType||'UNKNOWN',inputVersion:x.inputVersion||state?.job?.CURRENT_INPUT_VERSION||'UNKNOWN',operatorLabel:x.operatorLabel||x.operator||'UNSPECIFIED',affectedStageFields:x.affectedStageFields||[],affectedRecords:x.affectedRecords||[]}));
 if(answered.length)parts.push(`ANSWERED HUMAN CLARIFICATIONS\n${show(answered)}`);
 for(const collection of contextCollections[stage]||[])parts.push(`${collection.replace(/([a-z])([A-Z])/g,'$1 $2').replace(/_/g,' ').toUpperCase()}\n${boundedCollection(state,collection)}`);
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

AUTHORIZED BOUNDED CONTEXT FOR THIS STAGE
${contextFor(stage,state)}

STAGE-SPECIFIC TASK
${procedures[stage]}

PERMITTED AGENT-OWNED STAGE DATA
${fields}

PERMITTED RECORD COLLECTIONS AND AGENT-OWNED FIELDS
${collections}

COMPLETION CONDITIONS
${(d.completionGate||[]).map(x=>`- ${x}`).join('\n')}

MANDATORY RESPONSE RULES
- Before performing the stage task, assess whether the combined human input, current application context, accepted prior-stage evidence, and actually available capabilities are sufficient to proceed reliably. If not, use the specific fail-closed recovery type below instead of guessing or producing a knowingly incomplete result.
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
- If required authority, evidence, application context, capability, or decision rule is unavailable, return BLOCKED or HUMAN_INPUT_REQUIRED as applicable rather than inventing data.
- If execution itself is unavailable or fails, return EXECUTION_FAILED; do not represent unexecuted work as completed.
- If the prior agent response was inadequate or rejected, use only current accepted canonical context and produce a corrected complete response; rejected data is not canonical project truth.
- This static application has no external repository access unless repository contents are actually supplied in the authorized project context. Do not claim implementation in an inaccessible repository.
- When the requested implementation is too large or the environment cannot perform it reliably, provide a complete implementation-ready specification within the permitted response fields rather than pretending implementation occurred. Self-contained deliverables that can genuinely be completed in the available environment may be produced directly.

RESPONSE ENVELOPE
The application will provide the controlling prompt identity immediately after this hashed instruction body. Echo that identity exactly in promptIdentity.

END HASHED INSTRUCTION BODY`;
}
function buildPromptRecord(stageOrDefinition,state,options={}){
 const stage=Number(stageOrDefinition?.number||stageOrDefinition);if(!Number.isInteger(stage)||stage<1||stage>schema.STAGE_COUNT)throw new Error(`Stage must be 1 through ${schema.STAGE_COUNT}.`);
 const d=core.STAGES[stage-1],existing=(state?.projectData?.generatedPrompts||[]).filter(x=>Number(x.stage)===stage),activeExisting=existing.filter(x=>!x.invalidatedBy);const operation=options.operation||schema.STAGE_CONTRACTS[stage].operations[0];if(!schema.STAGE_CONTRACTS[stage].operations.includes(operation))throw new Error(`Operation ${operation} is not valid for Stage ${stage}.`);
 const opContract=schema.operationContract(stage,operation);const scope=scopeFor(stage,state,options.scope||{}),contextManifest={stage,operation,scope,readCollections:Object.fromEntries((opContract?.readCollections||schema.STAGE_CONTRACTS[stage].readCollections||[]).map(collection=>[collection,(state?.projectData?.[collection]||[]).filter(x=>x?.active!==false&&!x?.invalidatedBy).map(record=>({id:recordId(record,collection),scope:record.scope||{},contentSha256:record.contentSha256||record.sha256||hash.sha256Value(record.fields||record)}))])),answeredHumanClarifications:(state?.projectData?.humanInputAnswers||[]).filter(x=>Number(x.stage)===stage).map(x=>({requestId:x.requestId,answerId:x.answerId,inputVersion:x.inputVersion||state?.job?.CURRENT_INPUT_VERSION||null}))};
 const contextSignature=hash.sha256Value(contextManifest),bodyText=body(stage,state,operation),bodySha256=hash.sha256Text(bodyText),descriptor=responseContractDescriptor(stage,operation),contractSha256=hash.sha256Value(descriptor);
 const same=activeExisting.find(x=>x.contextSignature===contextSignature&&x.bodySha256===bodySha256&&x.contractSha256===contractSha256&&x.operation===operation);
 const instructionId=same?.instructionId||same?.promptId||`INSTRUCTION-${String(state?.job?.JOB_ID||'UNKNOWN').replace(/[^A-Za-z0-9-]/g,'')}-S${String(stage).padStart(2,'0')}-${String(existing.length+1).padStart(3,'0')}`;
 const identityBlock=`\n\nPROMPT IDENTITY — ECHO EXACTLY\nINSTRUCTION_ID: ${instructionId}\nBODY_SHA256: ${bodySha256}\nCONTRACT_SHA256: ${contractSha256}\nCONTEXT_SIGNATURE: ${contextSignature}\nOPERATION: ${operation}\nPROJECT_REVISION: ${scope.projectRevision}\n\nSTRICT RESPONSE CONTRACT\n${responseContract(stage,operation,instructionId,bodySha256,contractSha256,contextSignature,scope)}\n\nEND COPY BLOCK — STAGE ${String(stage).padStart(2,'0')}`;
 const prompt=bodyText+identityBlock;return {instructionId,promptId:instructionId,stage,operation,role:d.role,bodySha256,sha256:bodySha256,contractSha256,contextSignature,contextManifest,scope,scopeSha256:hash.sha256Value(scope),prompt,fullTextSha256:hash.sha256Text(prompt)};
}
function build(stageOrDefinition,state,options){return buildPromptRecord(stageOrDefinition,state,options).prompt;}
core.buildStagePrompt=build;
globalThis.closedLoopPromptEngine=Object.freeze({version:'closed-loop-prompt-engine/4',build,buildPromptRecord,procedures,contextCollections,contextFor,scopeFor,responseContractDescriptor,responseContract});
})();