import {createVerifierRuntime} from './verifier-runtime.mjs';
import fs from 'node:fs';
import vm from 'node:vm';
import {recordProposal,evidence,reviewProofFixture,reviewApplicabilityFixture,canonicalFixtureRecord} from './test-fixtures.mjs';
import {projectStoreRuntime,hydrateRetainedPromptContexts} from './test-project-store-runtime.mjs';
import {authorizeSyntheticHandoff} from './test-handoff-authorization.mjs';
import {readStoreArchive} from './test-zip.mjs';
import {buildUnchangedConfirmationFixture} from './stage19-fixture.mjs';
globalThis.Event=globalThis.Event||class Event{constructor(type){this.type=type;}};
globalThis.dispatchEvent=globalThis.dispatchEvent||(()=>true);
for(const f of ['workbook.js','hash.js','workflow-schema.js','test-runtime.js','workflow-engine.js','prompt-engine.js','response-ingestion.js'])createVerifierRuntime.loadScript(globalThis,fs.readFileSync(f,'utf8'),{filename:f});
const core=globalThis.closedLoopCore,schema=globalThis.closedLoopWorkflowSchema,engine=globalThis.closedLoopWorkflowEngine,prompts=globalThis.closedLoopPromptEngine,ingestion=globalThis.closedLoopResponseIngestion;
const assert=(v,m)=>{if(!v)throw new Error(m)};

function base(jobId){
  const p=core.createBlankState(jobId);
  Object.assign(p.job,{JOB_TITLE:'Stage 09 independent preflight proof',EXACT_USER_OBJECTIVE_VERBATIM:'Produce the current required deliverable.',CURRENT_INPUT_VERSION:'INPUT-v001',CURRENT_SOURCE_SET_VERSION:'SOURCE-SET-v001',CURRENT_RESEARCH_VERSION:'RESEARCH-v001',CURRENT_REQUIREMENTS_VERSION:'REQUIREMENTS-v001',CURRENT_TEST_SUITE_VERSION:'TEST-SUITE-v001',CURRENT_INSTRUCTION_VERSION:'INSTRUCTION-v001'});
  engine.ensureShape(p);
  for(let n=1;n<=7;n++){p.stages[n].status='COMPLETE';p.stages[n].gate={complete:true,blocked:false,reasons:[]};}
  const scope=engine.currentScope(p),requirementScope={...scope,instructionVersion:null};
  p.projectData.requirements.push({id:'REQ-1',stage:4,active:true,scope:{...requirementScope},fields:{REQ_ID:'REQ-1',MANDATORY_OPTIONAL_STATUS:'MANDATORY',STATUS:'ACTIVE',OBLIGATION:'Produce the required deliverable.',OBSERVABLE_SATISFACTION_CONDITION:'Required output exists.',FAILURE_CONDITION:'Required output is absent.'}});
  p.projectData.propositions.push({id:'PROP-1',stage:4,active:true,scope:{...requirementScope},fields:{PROPOSITION_ID:'PROP-1',REQUIREMENT_ID:'REQ-1',PROPOSITION_TEXT:'The required deliverable is produced.',STATUS:'CURRENT'},relationships:{REQUIREMENT_ID:'REQ-1'}});
  p.projectData.applicabilityRecords.push({id:'APP-1',stage:5,active:true,scope:{...requirementScope},fields:{APPLICABILITY_ID:'APP-1',SUBJECT_ID:'PROP-1',PROPOSED_APPLICABILITY:'APPLICABLE',SELECTED_APPLICABILITY:'APPLICABLE',TRUTH_VALUE:'TRUE',EPISTEMIC_BASIS:'EXTERNALLY_SUPPORTED',CURRENT_SCOPE_STATUS:'CURRENT',FRESHNESS_STATUS:'CURRENT',CONTRADICTION_STATUS:'CLEAR',REASONS:['Current mandatory fixture applies.']},relationships:{SUBJECT_ID:'PROP-1'}});
  const fixtureRuntime={engine,prompts,ingestion,schema};reviewApplicabilityFixture(fixtureRuntime,p);Object.assign(p.job,{CURRENT_TEST_SUITE_VERSION:'TEST-SUITE-v001',CURRENT_INSTRUCTION_VERSION:'INSTRUCTION-v001'});const proofTest=canonicalFixtureRecord(fixtureRuntime,p,'tests',{...recordProposal(schema,'tests').fields,REQ_ID:'REQ-1',TARGET_PROPOSITION_IDS:['PROP-1'],VERIFICATION_PHASE:'FINAL_PRODUCT_DETERMINISTIC',EARLIEST_EXECUTABLE_STAGE:22,REQUIRED_BY_STAGE:22,PER_RUN_REQUIRED:false,FINAL_PRODUCT_REQUIRED:true},{scope:requirementScope,relationships:{REQ_ID:'REQ-1'}}),proofNode={type:'LEAF',testId:proofTest.id,requiredDisposition:'SATISFIED',truthExtraction:'ACCEPTED_ENTAILMENT',evidenceClasses:['OBSERVATION_RECORD','ACCEPTED_ENTAILMENT'],scopeBinding:'CURRENT'};
 canonicalFixtureRecord(fixtureRuntime,p,'proofExpressions',{TARGET_PROPOSITION_ID:'PROP-1',PROPOSED_EXPRESSION:proofNode,NORMALIZED_EXPRESSION:proofNode,SEMANTIC_RATIONALE:'Final product evidence remains deferred until its current completed target exists.'},{scope:requirementScope,relationships:{TARGET_PROPOSITION_ID:'PROP-1'}});
reviewProofFixture({engine,prompts,ingestion,schema},p);return p;
}
function instruction(){return recordProposal(schema,'instructions',{tempKey:'instruction',overrides:{OBJECTIVE:'Produce required content',AUTHORIZED_INPUTS:'Current canonical inputs',FAILURE_HANDLING:'Fail closed',AUTHORITY_RULES:'Use canonical authority',SCOPE:'Current job',PROHIBITIONS:'No invention',DEFINED_TERMS:'Defined',ORDERED_PROCEDURE:'Execute in order',TOOL_REQUIREMENTS:'Available tools only',OUTPUT_CONTRACT:'Structured output',FACTUAL_STATE_HANDLING:'Use explicit states',REJECTION_BLOCKING_RULES:'Block uncertainty',COMPLETION_CONDITIONS:'All gates pass',REQUIREMENT_TRACEABILITY:'Trace every requirement',INSTRUCTION_TEXT:'Controlled production instruction'}})}
function trace(){return recordProposal(schema,'instructionTraces',{tempKey:'trace',relationships:{REQ_ID:{recordId:'REQ-1'},INSTRUCTION_ID:{tempKey:'instruction'}},overrides:{INSTRUCTION_LOCATION:'Instruction section 1',IMPLEMENTED_BEHAVIOR:'Implements required content'}})}
function submitStage8(p){
  const pr={...prompts.buildPromptRecord(8,p,engine.preparePromptContext(p,8,{operation:'COMPLETE'}).options),generatedAt:new Date().toISOString()};p.projectData.generatedPrompts.push(pr);
  const envelope={schema:schema.RESPONSE_SCHEMA,contractProfileId:schema.CONTRACT_PROFILE_ID,jobId:p.job.JOB_ID,stage:8,operation:'COMPLETE',promptIdentity:{instructionId:pr.instructionId,bodySha256:pr.bodySha256,contractSha256:pr.contractSha256,contextSignature:pr.contextSignature},scope:pr.scope,responseType:'DATA_PROPOSAL',humanInputRequests:[],stageData:{},records:{instructions:[instruction()],instructionTraces:[trace()]},evidence:[evidence('stage-08-independent-preflight-prerequisite')],unresolved:[],warnings:[],attachments:[]};
  const prepared=ingestion.prepare(p,{stage:8,text:JSON.stringify(envelope),promptRecord:pr});
  assert(prepared.validation.valid,`Stage 08 prerequisite rejected: ${JSON.stringify(prepared.validation.issues)}`);
  const committed=ingestion.commit(prepared.project,prepared.proposal.proposalId,{operator:'STAGE13_VERIFIER'}).project;
  for(let n=1;n<=7;n++){committed.stages[n].status='COMPLETE';committed.stages[n].gate={complete:true,blocked:false,reasons:[]};}
  const gate=engine.gate(8,committed);assert(gate.complete,`Stage 08 prerequisite did not complete: ${JSON.stringify(gate)}`);
  committed.stages[8].status='COMPLETE';committed.stages[8].gate=gate;
  return committed;
}
function reviewerContext(p,label){
  const context=engine.registerFreshContext(p,{stage:9,externalContextIdentifier:label,operatorLabel:'STAGE13_VERIFIER',purpose:'REVIEWER'});
  for(let n=1;n<=8;n++){p.stages[n].status='COMPLETE';p.stages[n].gate={complete:true,blocked:false,reasons:[]};}
  return context;
}
function preflightRecord(overrides={}){
  const instructionId=engine.recordId(engine.recordsForCurrentScope(globalThis.__stage13Project,'instructions').at(-1),'instructions');
  return recordProposal(schema,'preflightRecords',{tempKey:'preflight',relationships:{INSTRUCTION_ID:{recordId:instructionId}},overrides:{CLAUSE:'Controlled production instruction',MULTIPLE_INTERPRETATIONS:'NONE',UNDEFINED_OBJECTS:'NONE',UNSUPPLIED_DEPENDENCIES:'NONE',INTERNAL_CONFLICTS:'NONE',UNAVAILABLE_CAPABILITIES:'NONE',OBJECTIVELY_VERIFIABLE:'TRUE',RESPONSIBLE_OPERATION_ASSIGNED:'TRUE',ORDER_CLEAR:'TRUE',FAILURE_BEHAVIOR_DEFINED:'TRUE',TRACEABILITY:'REQ-1 -> instruction section 1',DETERMINATION:'SATISFIED',FINDINGS:'No material ambiguity',EVIDENCE:'Independent preflight evidence',...overrides}});
}
const clearStageData={EVERY_SENTENCE_REVIEWED:'TRUE',KNOWN_MATERIAL_AMBIGUITIES:'NONE',KNOWN_MATERIAL_CONFLICTS:'NONE',UNAVAILABLE_REQUIRED_CAPABILITIES:'NONE',UNVERIFIABLE_INSTRUCTIONS:'NONE'};
function submitStage9(p,contextId,overrides={},stageDataOverrides={}){
  globalThis.__stage13Project=p;
  const pr={...prompts.buildPromptRecord(9,p,{operation:'COMPLETE',scope:{contextId}}),generatedAt:new Date().toISOString()};p.projectData.generatedPrompts.push(pr);
  const envelope={schema:schema.RESPONSE_SCHEMA,contractProfileId:schema.CONTRACT_PROFILE_ID,jobId:p.job.JOB_ID,stage:9,operation:'COMPLETE',promptIdentity:{instructionId:pr.instructionId,bodySha256:pr.bodySha256,contractSha256:pr.contractSha256,contextSignature:pr.contextSignature},scope:pr.scope,responseType:'DATA_PROPOSAL',humanInputRequests:[],stageData:{...clearStageData,...stageDataOverrides},records:{preflightRecords:[preflightRecord(overrides)]},evidence:[evidence('stage-09-independent-preflight')],unresolved:[],warnings:[],attachments:[]};
  const acceptedBefore=p.projectData.acceptedChanges.length,currentRecordsBefore=engine.recordsForCurrentScope(p,'preflightRecords').length,prepared=ingestion.prepare(p,{stage:9,text:JSON.stringify(envelope),promptRecord:pr});
  assert(prepared.validation.valid,`Stage 09 response rejected before semantic gate: ${JSON.stringify(prepared.validation.issues)}`);
  assert(prepared.project.projectData.acceptedChanges.length===acceptedBefore,'Stage 09 proposal mutated canonical accepted state before explicit acceptance.');
  assert(engine.recordsForCurrentScope(prepared.project,'preflightRecords').length===currentRecordsBefore,'Stage 09 proposal created canonical preflight records before explicit acceptance.');
  return {pr,prepared};
}
function commitStage9(prepared){const committed=ingestion.commit(prepared.project,prepared.proposal.proposalId,{operator:'STAGE13_VERIFIER'}).project;for(let n=1;n<=8;n++){committed.stages[n].status='COMPLETE';committed.stages[n].gate={complete:true,blocked:false,reasons:[]};}return committed;}

let promptSemanticsChecked=false;
const unfavorablePropertyCases=[];
const verificationObservations=[];
for(const property of ['OBJECTIVELY_VERIFIABLE','RESPONSIBLE_OPERATION_ASSIGNED','ORDER_CLEAR','FAILURE_BEHAVIOR_DEFINED'])for(const value of ['FALSE','UNKNOWN']){
  const p=submitStage8(base('JOB-PREFLIGHT-'+property+'-'+value)),ctx=reviewerContext(p,'PREFLIGHT-PROPERTY-'+property+'-'+value),{prepared}=submitStage9(p,ctx.id,{[property]:value}),committed=commitStage9(prepared),row=engine.recordsForCurrentScope(committed,'preflightRecords').at(-1),effective=engine.evaluateResultConsistency('preflightRecords',row,null,committed),gate=engine.gate(9,committed);
  assert(effective.determination==='UNDETERMINED'&&effective.reasons.some(reason=>reason.includes(property)),`PREFLIGHT_REQUIRED_PROPERTY_ORACLE: ${property}=${value} was accepted: ${JSON.stringify(effective)}`);
  assert(!gate.complete&&gate.reasons.some(reason=>reason.includes(property)),`PREFLIGHT_REQUIRED_PROPERTY_GATE_ORACLE: ${property}=${value} escaped Stage 09: ${JSON.stringify(gate)}`);
  unfavorablePropertyCases.push({property,value});
  verificationObservations.push({checkId:'stage09.required-property.'+property+'.'+value,requirementRefs:['specification/closed-loop-reliability-controlling-implementation-specification.txt:3469','specification/closed-loop-reliability-controlling-implementation-specification.txt:3472'],boundary:'Actual accepted independent preflight record effective determination and Stage09 gate',expected:{determination:'UNDETERMINED',complete:false},observed:{determination:effective.determination,complete:gate.complete},passed:true,violation:'PREFLIGHT_REQUIRED_PROPERTY_'+property+'_'+value,accepted:false});
}
const incompleteReviewCases=[];
async function incompleteReviewCase(kind,field,value,recordOverrides={},stageDataOverrides={}){
  const label=`${kind}.${field}.${value===undefined?'omitted':value===''?'empty':String(value).toLowerCase().replace(/[^a-z0-9]+/g,'-')}`;
  const p=submitStage8(base('JOB-PREFLIGHT-INCOMPLETE-'+label)),ctx=reviewerContext(p,'PREFLIGHT-INCOMPLETE-'+label),{prepared}=submitStage9(p,ctx.id,recordOverrides,stageDataOverrides),committed=commitStage9(prepared),row=engine.recordsForCurrentScope(committed,'preflightRecords').at(-1),effective=engine.evaluateResultConsistency('preflightRecords',row,null,committed),gate=engine.gate(9,committed);
  assert(effective.determination==='UNDETERMINED'&&effective.reasons.some(reason=>reason.includes(field)),`PREFLIGHT_INCOMPLETE_EFFECTIVE_ORACLE: ${label} became ${JSON.stringify(effective)}`);
  assert(!gate.complete&&gate.reasons.some(reason=>reason.includes(field)),`PREFLIGHT_INCOMPLETE_GATE_ORACLE: ${label} completed ${JSON.stringify(gate)}`);
  const checkId='stage09.incomplete-review.'+label;
  incompleteReviewCases.push({kind,field,value:value===undefined?'OMITTED':value,checkId,acceptedPartialRecord:true,effectiveDetermination:effective.determination,gateComplete:gate.complete});
  verificationObservations.push({checkId,requirementRefs:['specification/closed-loop-reliability-controlling-implementation-specification.txt:3469','specification/closed-loop-reliability-controlling-implementation-specification.txt:3472','specification/closed-loop-reliability-controlling-implementation-specification.txt:3474'],boundary:'Actual exported Stage09 prompt and accepted current preflight proposal, effective determination and gate',expected:{acceptedPartialRecord:true,determination:'UNDETERMINED',complete:false},observed:{acceptedPartialRecord:true,determination:effective.determination,complete:gate.complete},passed:true,violation:'STAGE09_INCOMPLETE_REVIEW_'+label,accepted:false});
}
for(const field of schema.PREFLIGHT_COMPLETION_POLICY.recordPositiveFields)for(const value of [undefined,'','UNKNOWN','UNRECOGNIZED'])await incompleteReviewCase('record-positive',field,value,{[field]:value});
for(const field of schema.PREFLIGHT_COMPLETION_POLICY.recordClearFields)for(const value of [undefined,'UNKNOWN','UNRECOGNIZED'])await incompleteReviewCase('record-clear',field,value,{[field]:value});
for(const field of schema.PREFLIGHT_COMPLETION_POLICY.stagePositiveFields)for(const value of [undefined,'UNKNOWN','UNRECOGNIZED'])await incompleteReviewCase('stage-positive',field,value,{}, {[field]:value});
for(const field of schema.PREFLIGHT_COMPLETION_POLICY.stageClearFields)for(const value of [undefined,'UNKNOWN','UNRECOGNIZED'])await incompleteReviewCase('stage-clear',field,value,{}, {[field]:value});
for(const value of ['UNKNOWN','PARTIAL','UNRECOGNIZED'])await incompleteReviewCase('decision','DETERMINATION',value,{DETERMINATION:value});
for(const value of [undefined,'UNKNOWN'])await incompleteReviewCase('mapping','TRACEABILITY',value,{TRACEABILITY:value});
{
  const p=submitStage8(base('JOB-PREFLIGHT-STALE-MERGED-DATA')),ctx=reviewerContext(p,'PREFLIGHT-STALE-MERGED-DATA'),{prepared}=submitStage9(p,ctx.id,{}, {EVERY_SENTENCE_REVIEWED:undefined}),committed=commitStage9(prepared);
  Object.assign(committed.stages[9].agentData,clearStageData);Object.assign(committed.stages[9].acceptedData,clearStageData);
  const gate=engine.gate(9,committed);
  assert(!gate.complete&&gate.reasons.some(reason=>reason.includes('EVERY_SENTENCE_REVIEWED')),'PREFLIGHT_STALE_MERGED_DATA_ORACLE: a stale stage-data view satisfied the current accepted partial proposal.');
  verificationObservations.push({checkId:'stage09.current-proposal-stage-data',requirementRefs:['specification/closed-loop-reliability-controlling-implementation-specification.txt:3469','specification/closed-loop-reliability-controlling-implementation-specification.txt:3472'],boundary:'Current accepted Stage09 proposal data versus stale merged stage view at actual gate',expected:{complete:false},observed:{complete:gate.complete},passed:true,violation:'STAGE09_STALE_MERGED_DATA',accepted:false});
}
{
  const p=submitStage8(base('JOB-STAGE13-MISSING-REVIEWER'));
  engine.recalculate(p);for(let n=1;n<=8;n++){p.stages[n].status='COMPLETE';p.stages[n].gate={complete:true,blocked:false,reasons:[]};}
  const gate=engine.gate(9,p),independence=engine.evaluateContextIndependence(p,{role:'PREFLIGHT_REVIEW',reviewerContextId:''});
  assert(!gate.complete,'Stage 09 completed without any accepted independent preflight review.');
  assert(independence.determination==='UNKNOWN','Missing Stage 09 reviewer context did not remain UNKNOWN.');
}
{
  const p=submitStage8(base('JOB-STAGE13-MATERIAL-AMBIGUITY')),ctx=reviewerContext(p,'PREFLIGHT-CONTEXT-MATERIAL-AMBIGUITY'),before=p.projectData.acceptedChanges.length;
  const {pr,prepared}=submitStage9(p,ctx.id,{MULTIPLE_INTERPRETATIONS:'TRUE',FINDINGS:'MATERIAL AMBIGUITY',DETERMINATION:'SATISFIED'});
  assert(prepared.project.projectData.acceptedChanges.length===before,'Material-ambiguity response mutated canonical state before acceptance.');
  const committed=commitStage9(prepared),row=engine.recordsForCurrentScope(committed,'preflightRecords').at(-1),effective=engine.evaluateResultConsistency('preflightRecords',row,null,committed),gate=engine.gate(9,committed);
  assert(effective.determination==='UNDETERMINED',`Claimed favorable preflight with material ambiguity was not downgraded: ${JSON.stringify(effective)}`);
  assert(!gate.complete&&gate.reasons.some(r=>/MULTIPLE_INTERPRETATIONS|material|preflight/i.test(r)),`Material ambiguity escaped Stage 09 gate: ${JSON.stringify(gate)}`);
  const prompt=pr.prompt.toLowerCase();for(const token of ['preflight','without executing','independent'])assert(prompt.includes(token),`Stage 09 prompt lacks controlling preflight semantic: ${token}`);promptSemanticsChecked=true;
  const published=prompts.responseContractDescriptor(9,'COMPLETE').preflightCompletionPolicy;
  assert(JSON.stringify(published)===JSON.stringify(schema.PREFLIGHT_COMPLETION_POLICY),'PREFLIGHT_PUBLISHED_POLICY_ORACLE: exported response contract differs from the gate policy.');
  assert(pr.prompt.includes('preflightCompletionPolicy')&&pr.prompt.includes('A partial preflight record may be accepted without completing the stage.')&&pr.promptEngineVersion===prompts.versionFor(9,'COMPLETE'),'PREFLIGHT_PUBLISHED_POLICY_ORACLE: the actual current instruction omitted its completion rules or scoped version.');
}
{
  const p=submitStage8(base('JOB-STAGE13-CONTAMINATED-REVIEWER')),ctx=reviewerContext(p,'PREFLIGHT-CONTEXT-CONTAMINATED'),{prepared}=submitStage9(p,ctx.id),committed=commitStage9(prepared),context=engine.records(committed,'freshContexts').find(r=>engine.recordId(r,'freshContexts')===ctx.id);
  context.fields.CONTAMINATION_STATUS='CONTAMINATED';context.CONTAMINATION_STATUS='CONTAMINATED';engine.refreshRecordHashes(context,'freshContexts');engine.recalculate(committed);for(let n=1;n<=8;n++){committed.stages[n].status='COMPLETE';committed.stages[n].gate={complete:true,blocked:false,reasons:[]};}
  const independence=engine.evaluateContextIndependence(committed,{role:'PREFLIGHT_REVIEW',reviewerContextId:ctx.id}),gate=engine.gate(9,committed);
  assert(independence.determination==='VIOLATED','Contaminated Stage 09 reviewer context did not violate independence.');
  assert(!gate.complete&&gate.reasons.some(r=>/independence|contamin/i.test(r)),`Contaminated reviewer escaped Stage 09 gate: ${JSON.stringify(gate)}`);
}
let repairedIndependenceBasis='';
{
  const p=submitStage8(base('JOB-STAGE13-REPAIRED')),ctx=reviewerContext(p,'PREFLIGHT-CONTEXT-CLEAN'),before=p.projectData.acceptedChanges.length,{prepared}=submitStage9(p,ctx.id);
  assert(prepared.project.projectData.acceptedChanges.length===before,'Clean Stage 09 proposal mutated canonical state before acceptance.');
  const committed=commitStage9(prepared),gate=engine.gate(9,committed),independence=engine.evaluateContextIndependence(committed,{role:'PREFLIGHT_REVIEW',reviewerContextId:ctx.id});
  repairedIndependenceBasis=independence.determination;
  assert(gate.complete&&gate.reasons.length===0,`Clean independent preflight did not progress: ${JSON.stringify(gate)}`);
  assert(engine.recordsForCurrentScope(committed,'preflightRecords').length===1,'Clean Stage 09 did not create exactly one current preflight record.');
  assert(independence.determination==='EXTERNALLY_SUPPORTED',`Stage 09 overclaimed unobservable provider independence as ${independence.determination}.`);
}
{
  const stopAtStage09=Symbol('stage09-package-prefix'),r=projectStoreRuntime(),contextFiles=[];let p=null,pr=null;
  try{buildUnchangedConfirmationFixture('JOB-STAGE09-PUBLISHED-ZIP',{onPrompt:(prompt,project)=>{contextFiles.push(...prompts.materializePromptContextFiles(prompt,project));if(prompt.stage===9&&prompt.operation==='COMPLETE'){p=engine.clone(project);pr=p.projectData.generatedPrompts.find(row=>row.instructionId===prompt.instructionId);throw stopAtStage09;}}});}
  catch(error){if(error!==stopAtStage09)throw error;}
  assert(p&&pr&&engine.gate(8,p).complete,'PREFLIGHT_PACKAGE_SETUP: the fixture did not establish Stage 08 before its saved Stage 09 instruction.');
  const fixtureProject=r.copy(p),fixturePrompt=fixtureProject.projectData.generatedPrompts.find(row=>row.instructionId===pr.instructionId);
  await hydrateRetainedPromptContexts(r,fixtureProject,contextFiles);
  let saved=await r.store.writeProject(fixtureProject,{createOnly:true,expectedProjectRevision:0,incrementRevision:false});
  const currentRevision=saved.revision,currentHash=saved.projectSha256,issued=r.prompts.reserveAndBuildPromptRecord(saved,9,{operation:'COMPLETE',scope:{contextId:pr.scope.contextId}}).prompt;
  saved=await r.store.writeProject(saved,{expectedProjectRevision:currentRevision,expectedStateSha256:currentHash});
  let savedPrompt=saved.projectData.generatedPrompts.find(row=>row.instructionId===issued.instructionId);
  const authorized=await authorizeSyntheticHandoff(r,{project:saved,prompt:savedPrompt});saved=authorized.project;savedPrompt=authorized.prompt;
  const pkg=await r.store.createExecutionPackage(authorized.request),members=readStoreArchive(new Uint8Array(await pkg.blob.arrayBuffer())),member=path=>members.find(row=>row.canonicalPath===path),manifest=JSON.parse(new TextDecoder().decode(member('manifest.json').bytes)),instruction=new TextDecoder().decode(member('instruction.txt').bytes),published=manifest.responseContract?.preflightCompletionPolicy;
  const policyKeys=Object.keys(schema.PREFLIGHT_COMPLETION_POLICY).sort();
  assert(published&&JSON.stringify(Object.keys(published).sort())===JSON.stringify(policyKeys)&&policyKeys.every(key=>JSON.stringify(published[key])===JSON.stringify(schema.PREFLIGHT_COMPLETION_POLICY[key])),'PREFLIGHT_PACKAGE_POLICY_ORACLE: actual Stage 09 ZIP manifest omitted or changed the completion policy.');
  assert(instruction===savedPrompt.prompt&&instruction.includes('A partial preflight record may be accepted without completing the stage.')&&instruction.includes('preflightCompletionPolicy'),'PREFLIGHT_PACKAGE_INSTRUCTION_ORACLE: actual Stage 09 ZIP instruction omitted the partial/completion distinction.');
  assert(manifest.instruction.promptEngineVersion===prompts.versionFor(9,'COMPLETE')&&manifest.responseContractSha256===savedPrompt.contractSha256,'PREFLIGHT_PACKAGE_VERSION_ORACLE: actual Stage 09 ZIP has a stale prompt version or contract digest.');
  verificationObservations.push({checkId:'stage09.exported-package-completion-policy',requirementRefs:['specification/closed-loop-reliability-controlling-implementation-specification.txt:3469','specification/closed-loop-reliability-controlling-implementation-specification.txt:3472'],boundary:'Saved current Stage 09 instruction -> synthetic operator handoff authorization -> production createExecutionPackage -> independently decoded ZIP manifest and instruction bytes',expected:{publishedPolicy:true,currentPromptVersion:true,partialCompletionDistinction:true},observed:{publishedPolicy:true,currentPromptVersion:true,partialCompletionDistinction:true},passed:true,violation:'STAGE09_PACKAGE_POLICY_OMISSION',accepted:false});
}
delete globalThis.__stage13Project;
console.log(JSON.stringify({controllerStage:'13',applicationStage:'09',independentPreflight:'PASS',verificationObservations,unfavorablePropertyCases,incompleteReviewCases,intentionalInvalidFixturesRejected:['missing-independent-reviewer','material-ambiguity-with-favorable-claim','contaminated-reviewer-context'],repairedPathProgressed:true,independenceEpistemicLimitPreserved:repairedIndependenceBasis==='EXTERNALLY_SUPPORTED',noMutationBeforeAcceptance:true,promptSemanticsChecked,isolatedDisposableProjects:true},null,2));
